"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EDITOR_FONTS } from "@/app/fonts";
import { getProduct, getVariant, PRODUCTS, printGeometry, productSides, resolveSide } from "@/config/products";
import { formatPrice } from "@/lib/format";
import { SITE } from "@/config/site";
import { designWarnings, fillLayer } from "@/lib/design/layers";
import { composeWrap, downloadBlob, ensureFonts, exportDesign, renderSideCanvas, canvasToBlob } from "@/lib/design/export";
import { emptyDesign, sideHasContent, updateSide, useEditor } from "@/lib/design/store";
import { SIDE_LABEL, type SideId } from "@/lib/types";
import { Button } from "../ui/Button";
import { CropModal } from "./CropModal";
import { ImagePanel, useImageUpload } from "./ImagePanel";
import { IconRedo, IconReset, IconUndo, IconUpload } from "./icons";
import { MockupPreview } from "./MockupPreview";
import { TextPanel } from "./TextPanel";

const EditorCanvas = dynamic(() => import("./EditorCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center text-sm text-alu/60">Загружаем редактор…</div>,
});

type View = "edit" | "preview";
type Tab = "photo" | "text";

export function Constructor({ initialProductId }: { initialProductId: string | null }) {
  const router = useRouter();
  const s = useEditor();
  const product = getProduct(s.productId) ?? PRODUCTS[0];
  const variant = getVariant(product, s.variantId);
  const sides = productSides(product, s.wrapMode);
  const sideId: SideId = sides.includes(s.activeSide) ? s.activeSide : sides[0];
  const spec = resolveSide(product, variant, sideId)!;
  const geo = useMemo(() => printGeometry(spec.print), [spec.print]);
  const side = s.design[sideId];

  const [view, setView] = useState<View>("edit");
  const [angle, setAngle] = useState(0);
  const angleIdx = Math.min(angle, spec.mockups.length - 1);
  const [tab, setTab] = useState<Tab>("photo");
  const [cropOpen, setCropOpen] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { upload, error: uploadError, busy } = useImageUpload(sideId, geo);

  // Выбор товара из адреса страницы (?product=…)
  useEffect(() => {
    const wanted = getProduct(initialProductId);
    if (wanted && wanted.id !== useEditor.getState().productId) {
      useEditor.getState().setProduct(wanted.id, wanted.variants[0].id);
    } else if (!useEditor.getState().variantId) {
      useEditor.getState().setVariant(product.variants[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductId]);

  // Фото, выбранное на главной странице. Ждём, пока применится товар из адреса,
  // чтобы фото легло в область печати нужного товара.
  useEffect(() => {
    if (initialProductId && getProduct(initialProductId) && product.id !== initialProductId) return;
    const file = useEditor.getState().pendingFile;
    if (file) {
      useEditor.getState().setPendingFile(null);
      upload(file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, initialProductId]);

  // Заранее загружаем шрифты — Konva рисует текст только уже загруженными шрифтами
  useEffect(() => {
    ensureFonts(EDITOR_FONTS.map((f) => f.family)).then(() => setFontTick((t) => t + 1));
  }, []);

  // Горячие клавиши: отмена/повтор, удаление выбранного слоя
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      const mod = e.ctrlKey || e.metaKey;
      const st = useEditor.getState();
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        st.redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && st.selectedId) {
        const id = st.selectedId;
        st.apply(
          updateSide(sideId, (sd) => ({
            image: sd.image?.id === id ? null : sd.image,
            texts: sd.texts.filter((t) => t.id !== id),
          })),
        );
        st.select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sideId]);

  const warnings = useMemo(() => designWarnings(side, geo, spec.print.dpi), [side, geo, spec.print.dpi, fontTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const anyContent = sides.some((sd) => sideHasContent(s.design[sd]));
  const usedSides = sides.filter((sd) => sideHasContent(s.design[sd]));
  const unitPrice = product.price + variant.priceDelta + (usedSides.length > 1 ? product.secondSidePrice : 0);
  const selectedIsText = side.texts.some((t) => t.id === s.selectedId);
  const activeTab: Tab = selectedIsText ? "text" : tab;

  const changeProduct = (id: string) => {
    if (id === product.id) return;
    if (anyContent && !confirm("Сменить товар? Текущий дизайн будет сброшен.")) return;
    const p = getProduct(id)!;
    s.setProduct(p.id, p.variants[0].id);
    router.replace(`/constructor?product=${p.id}`, { scroll: false });
  };

  const resetAll = () => {
    if (!anyContent) return;
    if (!confirm("Сбросить все изменения на обеих сторонах?")) return;
    s.apply(() => emptyDesign());
    s.select(null);
  };

  const downloadPrint = async () => {
    try {
      // у товаров «по кругу» скачивается весь принт целиком
      const canvas = product.wrap
        ? (await composeWrap(product, variant, s.wrapMode, s.design, s.assets, 1)).canvas
        : await renderSideCanvas(side, geo, s.assets, 1);
      downloadBlob(await canvasToBlob(canvas), `${product.id}-${product.wrap ? "wrap" : sideId}-print.png`);
    } catch {
      setExportError("Не удалось сохранить файл печати.");
    }
  };

  const finish = async () => {
    setExportError(null);
    if (!anyContent) {
      setExportError("Добавьте фото или надпись хотя бы на одну сторону.");
      return;
    }
    setExporting(true);
    try {
      const exported = await exportDesign(product, variant, s.design, s.assets, s.wrapMode);
      s.setExported(exported);
      router.push("/checkout");
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Не удалось подготовить файлы дизайна.");
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-3 pb-10 pt-4 sm:px-6">
      {/* Товар, цвет, сторона */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-alu-2 p-1" role="tablist" aria-label="Товар">
          {PRODUCTS.map((p) => (
            <button
              key={p.id}
              role="tab"
              type="button"
              aria-selected={p.id === product.id}
              onClick={() => changeProduct(p.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${p.id === product.id ? "bg-ink text-alu" : "hover:bg-ink/5"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2" aria-label="Цвет">
          {product.variants.map((v) => (
            <button
              key={v.id}
              type="button"
              title={v.name}
              aria-label={`Цвет: ${v.name}`}
              aria-pressed={v.id === variant.id}
              onClick={() => s.setVariant(v.id)}
              className={`size-8 rounded-full border border-ink/20 ${v.id === variant.id ? "ring-2 ring-ink ring-offset-2 ring-offset-alu" : ""}`}
              style={{ background: v.swatch }}
            />
          ))}
          <span className="text-sm text-steel">{variant.name}</span>
        </div>
        {product.wrap && (
          <div className="flex rounded-full bg-alu-2 p-1 text-sm" aria-label="Вариант принта">
            {(
              [
                ["two", "Разные фото с двух сторон"],
                ["around", "Одно фото по кругу"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={s.wrapMode === m}
                onClick={() => {
                  s.setWrapMode(m, product.wrap!.modes[m][0]);
                  setAngle(0);
                }}
                className={`rounded-full px-3 py-2 font-medium ${s.wrapMode === m ? "bg-ink text-alu" : "hover:bg-ink/5"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {product.wrap && (
        <p className="mt-2 max-w-[70ch] text-sm text-steel">
          {s.wrapMode === "around"
            ? `Принт на весь корпус, ${Math.round(product.wrap.stickerMm[0])} × ${Math.round(product.wrap.stickerMm[1])} мм по кругу: середина картинки видна спереди, края сходятся сзади.`
            : `Принт на весь корпус, ${Math.round(product.wrap.stickerMm[0])} × ${Math.round(product.wrap.stickerMm[1])} мм: левая половина — лицевая сторона, правая — оборотная.`}
        </p>
      )}

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Рабочая область */}
        <section className="flex flex-col">
          <div className="flex items-center justify-between gap-2 rounded-t-[22px] bg-bench px-2 pt-2 text-alu">
            <div className="flex rounded-full bg-bench-2 p-1 text-sm">
              {sides.map((sd) => (
                <button
                  key={sd}
                  type="button"
                  onClick={() => {
                    s.setActiveSide(sd);
                    // у зажигалки «по кругу» показываем ту сторону, которую редактируем
                    if (product.wrap && sd !== "wrap") setAngle(sd === "back" ? 1 : 0);
                  }}
                  aria-pressed={sd === sideId}
                  className={`rounded-full px-3 py-1.5 ${sd === sideId ? "bg-alu text-ink" : "text-alu/80 hover:text-alu"}`}
                >
                  {SIDE_LABEL[sd]}
                  {sideHasContent(s.design[sd]) && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-signal align-middle" aria-label="есть дизайн" />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={s.undo} disabled={!s.past.length && s.design === s.committed} className="rounded-full p-2 hover:bg-alu/10 disabled:opacity-30" aria-label="Отменить" title="Отменить (Ctrl+Z)">
                <IconUndo />
              </button>
              <button type="button" onClick={s.redo} disabled={!s.future.length} className="rounded-full p-2 hover:bg-alu/10 disabled:opacity-30" aria-label="Повторить" title="Повторить (Ctrl+Shift+Z)">
                <IconRedo />
              </button>
              <button type="button" onClick={resetAll} disabled={!anyContent} className="rounded-full p-2 hover:bg-alu/10 disabled:opacity-30" aria-label="Сбросить всё" title="Сбросить всё">
                <IconReset />
              </button>
            </div>
          </div>

          <div className="relative h-[min(62vh,560px)] min-h-[320px] overflow-hidden bg-bench brushed">
            {view === "edit" ? (
              <>
                <EditorCanvas
                  key={`${product.id}-${sideId}-${fontTick}`}
                  sideId={sideId}
                  spec={spec}
                  geo={geo}
                  design={side}
                  assets={s.assets}
                  selectedId={s.selectedId}
                  warn={warnings.some((w) => w.id === "outside" || w.id === "gaps")}
                  lockRatio={s.lockRatio}
                  onSelect={s.select}
                  onUpdate={s.update}
                  onCommit={s.commit}
                />
                {!side.image && !side.texts.length && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                    <label className="pointer-events-auto inline-flex cursor-pointer items-center gap-2 rounded-full bg-signal px-5 py-3 font-medium text-ink shadow-lg">
                      <IconUpload /> {busy ? "Загружаем…" : "Загрузить фото"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 grid place-items-center p-3">
                <MockupPreview product={product} variant={variant} sideId={sideId} design={s.design} mode={s.wrapMode} assets={s.assets} quality="high" view={angleIdx} className="h-full max-h-full w-auto rounded-2xl" />
                {spec.mockups.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 rounded-full bg-bench-2/90 p-1 text-sm text-alu backdrop-blur" aria-label="Ракурс">
                    {spec.mockups.map((m, i) => (
                      <button key={i} type="button" onClick={() => setAngle(i)} aria-pressed={i === angleIdx} className={`rounded-full px-3 py-1.5 ${i === angleIdx ? "bg-alu text-ink" : "text-alu/80 hover:text-alu"}`}>
                        {m.label ?? `Ракурс ${i + 1}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-[22px] bg-bench px-3 py-2 text-xs text-alu/70">
            <div className="flex rounded-full bg-bench-2 p-1 text-sm">
              <button type="button" onClick={() => setView("edit")} aria-pressed={view === "edit"} className={`rounded-full px-3 py-1.5 ${view === "edit" ? "bg-alu text-ink" : "text-alu/80"}`}>
                Редактор
              </button>
              <button type="button" onClick={() => setView("preview")} aria-pressed={view === "preview"} className={`rounded-full px-3 py-1.5 ${view === "preview" ? "bg-alu text-ink" : "text-alu/80"}`}>
                На изделии
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-signal" /> линия реза</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-signal/70" /> безопасная зона</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t border-dashed border-alu/60" /> вылеты</span>
            </div>
          </div>

          {(uploadError || warnings.length > 0) && (
            <ul className="mt-3 space-y-2" aria-live="polite">
              {uploadError && <li className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger">{uploadError}</li>}
              {warnings.map((w) => (
                <li key={w.id} className="rounded-xl border border-signal/40 bg-signal/10 px-4 py-2.5 text-sm">
                  {w.text}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Панель настроек */}
        <aside className="flex flex-col gap-5">
          <div className="hidden lg:block">
            <MockupPreview product={product} variant={variant} sideId={sideId} design={s.design} mode={s.wrapMode} assets={s.assets} view={angleIdx} className="rounded-[22px]" />
          </div>

          <div className="rounded-[22px] bg-alu-2/70 p-4">
            <div className="mb-4 flex rounded-full bg-alu p-1 text-sm" role="tablist">
              {(
                [
                  ["photo", "Фото"],
                  ["text", "Текст"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  aria-selected={activeTab === id}
                  onClick={() => {
                    setTab(id);
                    if (id === "photo" && selectedIsText) s.select(side.image?.id ?? null);
                    if (id === "text" && !selectedIsText) s.select(side.texts[0]?.id ?? null);
                  }}
                  className={`flex-1 rounded-full px-3 py-2 font-medium ${activeTab === id ? "bg-ink text-alu" : "hover:bg-ink/5"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {activeTab === "photo" ? (
              <ImagePanel sideId={sideId} geo={geo} onCrop={() => setCropOpen(true)} />
            ) : (
              <TextPanel sideId={sideId} geo={geo} />
            )}
          </div>

          <div className="rounded-[22px] bg-ink p-5 text-alu">
            {SITE.showPrices ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-alu/70">Цена за 1 шт.</span>
                  <span className="text-2xl font-semibold tabular-nums">{formatPrice(unitPrice)}</span>
                </div>
                <p className="mt-1 text-xs text-alu/60">
                  {usedSides.length > 1 ? "Печать с двух сторон. " : ""}
                  {product.priceIsDemo ? "Демо-цена — итог подтвердит менеджер." : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-alu/70">Стоимость и сроки подтвердим после проверки макета.</p>
            )}
            <Button variant="signal" size="lg" className="mt-4 w-full" onClick={finish} disabled={exporting}>
              {exporting ? "Готовим файлы…" : "Отправить макет продавцу"}
            </Button>
            {exportError && <p className="mt-3 text-sm text-[#ff9c9c]" role="alert">{exportError}</p>}
            <button type="button" onClick={downloadPrint} disabled={!sideHasContent(side)} className="mt-3 w-full text-center text-sm text-alu/70 underline-offset-4 hover:text-alu hover:underline disabled:opacity-40">
              {product.wrap ? "Скачать файл печати (весь корпус, PNG)" : `Скачать файл печати этой стороны (PNG, ${geo.width}×${geo.height})`}
            </button>
            {spec.print.isDemo && (
              <p className="mt-2 text-center text-xs text-alu/50">
                Размер области печати {spec.print.widthMm}×{spec.print.heightMm} мм — демонстрационный.
              </p>
            )}
          </div>
        </aside>
      </div>

      {cropOpen && side.image && s.assets[side.image.assetId] && (
        <CropModal
          asset={s.assets[side.image.assetId]}
          initial={side.image.crop}
          surfaceRatio={geo.width / geo.height}
          onClose={() => setCropOpen(false)}
          onApply={(crop) => {
            // После кадрирования фото снова заполняет область печати
            s.apply(updateSide(sideId, (sd) => (sd.image ? { ...sd, image: fillLayer({ ...sd.image, crop }, geo) } : sd)));
            setCropOpen(false);
          }}
        />
      )}
    </div>
  );
}
