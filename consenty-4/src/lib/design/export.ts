"use client";
/**
 * Экспорт дизайна.
 *  - Производственный файл: PNG точно в размере области печати + вылеты,
 *    при DPI из конфигурации, с прозрачным фоном. Никаких направляющих.
 *  - Превью: дизайн, натянутый на mockup товара.
 * Konva используется и в редакторе, и здесь, с одними и теми же атрибутами
 * слоёв (layers.ts), поэтому файл печати совпадает с тем, что видно в редакторе.
 */
import { printGeometry, productSides, resolveSide, wrapStartMm, type MockupSpec, type PrintGeometry, type ProductConfig, type ProductVariant } from "@/config/products";
import { loadImage, loadMockupImages, renderMockup, type DesignSource } from "../mockup/render";
import { renderCylinder } from "../mockup/cylinder";
import { SIDE_LABEL, type DesignState, type ImageAsset, type SideDesign, type SideId, type WrapMode } from "../types";
import { imageAttrs, textAttrs } from "./layers";
import { newId, sideHasContent, type ExportedDesign, type ExportedFile } from "./store";

export async function ensureFonts(families: string[]) {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([...new Set(families)].map((f) => document.fonts.load(`48px ${f}`, "АаZz0").catch(() => undefined)));
}

/** Рендер стороны в canvas (pixelRatio < 1 — уменьшенная копия для превью). */
export async function renderSideCanvas(
  side: SideDesign,
  geo: PrintGeometry,
  assets: Record<string, ImageAsset>,
  pixelRatio = 1,
): Promise<HTMLCanvasElement> {
  const Konva = (await import("konva")).default;
  await ensureFonts(side.texts.map((t) => t.fontFamily));
  const asset = side.image ? assets[side.image.assetId] : undefined;
  const img = asset ? await loadImage(asset.url) : null;

  const container = document.createElement("div");
  const stage = new Konva.Stage({ container, width: geo.width, height: geo.height });
  try {
    const layer = new Konva.Layer({ listening: false });
    stage.add(layer);
    if (side.image && img) layer.add(new Konva.Image({ image: img, ...imageAttrs(side.image) }));
    for (const t of side.texts) if (t.text.trim()) layer.add(new Konva.Text(textAttrs(t)));
    layer.draw();
    return layer.toCanvas({ x: 0, y: 0, width: geo.width, height: geo.height, pixelRatio });
  } finally {
    stage.destroy();
  }
}

/** Вырезает из полного файла область по линии реза (без вылетов) — она и натягивается на mockup. */
export function cropToTrim(canvas: HTMLCanvasElement, geo: PrintGeometry, pixelRatio: number) {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(geo.trim.width * pixelRatio));
  out.height = Math.max(1, Math.round(geo.trim.height * pixelRatio));
  out
    .getContext("2d")!
    .drawImage(canvas, geo.trim.x * pixelRatio, geo.trim.y * pixelRatio, geo.trim.width * pixelRatio, geo.trim.height * pixelRatio, 0, 0, out.width, out.height);
  return out;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Не удалось сохранить изображение"))), type, quality),
  );
}

/** Полный принт «по кругу» (с вылетами): одна картинка или [лицевая | оборотная] по половинам. */
export async function composeWrap(
  product: ProductConfig,
  variant: ProductVariant,
  mode: WrapMode,
  design: DesignState,
  assets: Record<string, ImageAsset>,
  ratio: number,
): Promise<{ canvas: HTMLCanvasElement; geo: PrintGeometry }> {
  const gW = printGeometry(resolveSide(product, variant, "wrap")!.print);
  if (mode === "around") return { canvas: await renderSideCanvas(design.wrap, gW, assets, ratio), geo: gW };
  const gH = printGeometry(resolveSide(product, variant, "front")!.print);
  const c = document.createElement("canvas");
  c.width = Math.round(gW.width * ratio);
  c.height = Math.round(gW.height * ratio);
  const ctx = c.getContext("2d")!;
  const f = await renderSideCanvas(design.front, gH, assets, ratio);
  const b = await renderSideCanvas(design.back, gH, assets, ratio);
  const split = (gW.bleed + gH.trim.width) * ratio;
  // левая половина — лицевая сторона, правая — оборотная; вылеты по краям берутся от каждой половины
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, split, c.height); ctx.clip(); ctx.drawImage(f, 0, 0); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(split, 0, c.width - split, c.height); ctx.clip(); ctx.drawImage(b, gH.trim.width * ratio, 0); ctx.restore();
  return { canvas: c, geo: gW };
}

/** Рисует один ракурс (плоский или цилиндрический) с готовым принтом по линии реза. */
async function drawView(target: HTMLCanvasElement, product: ProductConfig, mode: WrapMode, mockup: MockupSpec, design: DesignSource | null, scale: number) {
  const images = await loadMockupImages(mockup);
  if (mockup.kind === "cylinder" && mockup.cylinder && product.wrap) {
    const [w, h] = product.wrap.stickerMm;
    renderCylinder(
      target,
      { ...mockup.cylinder, width: mockup.width, height: mockup.height, stickerWMm: w, stickerHMm: h },
      { base: images.base, shade: images.shade, overlay: images.overlay },
      design,
      wrapStartMm(product, mode),
      scale,
    );
    return;
  }
  renderMockup(target, mockup, images, design, scale);
}

/** Рендер превью на изделии в переданный canvas. */
export async function renderSidePreview(
  target: HTMLCanvasElement,
  product: ProductConfig,
  variant: ProductVariant,
  sideId: SideId,
  design: DesignState,
  assets: Record<string, ImageAsset>,
  opts: { mockupScale: number; designRatio: number; view?: number; mode?: WrapMode },
) {
  const mode = opts.mode ?? "two";
  const spec = resolveSide(product, variant, sideId);
  if (!spec) throw new Error("Сторона не настроена");
  const mockup = spec.mockups[Math.min(opts.view ?? 0, spec.mockups.length - 1)];
  let src: DesignSource | null = null;
  if (product.wrap) {
    if (productSides(product, mode).some((s) => sideHasContent(design[s]))) {
      const { canvas, geo } = await composeWrap(product, variant, mode, design, assets, opts.designRatio);
      const trim = cropToTrim(canvas, geo, opts.designRatio);
      src = { source: trim, width: trim.width, height: trim.height, cornerRadius: 0 };
    }
  } else if (sideHasContent(design[sideId])) {
    const geo = printGeometry(spec.print);
    const full = await renderSideCanvas(design[sideId], geo, assets, opts.designRatio);
    const trim = cropToTrim(full, geo, opts.designRatio);
    src = { source: trim, width: trim.width, height: trim.height, cornerRadius: geo.radius * opts.designRatio };
  }
  await drawView(target, product, mode, mockup, src, opts.mockupScale);
}

/** Полный экспорт: файлы печати, превью и оригиналы фото. */
export async function exportDesign(
  product: ProductConfig,
  variant: ProductVariant,
  design: DesignState,
  assets: Record<string, ImageAsset>,
  mode: WrapMode = "two",
): Promise<ExportedDesign> {
  const used = productSides(product, mode).filter((s) => sideHasContent(design[s]));
  if (!used.length) throw new Error("Добавьте фото или текст хотя бы на одну сторону");
  const files: ExportedFile[] = [];
  const previews: ExportedDesign["previews"] = [];
  const addPreview = async (mockup: MockupSpec, src: DesignSource, side: SideId) => {
    const c = document.createElement("canvas");
    await drawView(c, product, mode, mockup, src, 1);
    const blob = await canvasToBlob(c);
    files.push({ role: "preview", side, blob, label: mockup.label });
    previews.push({ url: URL.createObjectURL(blob), label: mockup.label ?? SIDE_LABEL[side] });
  };

  if (product.wrap) {
    // Один файл печати на весь корпус + превью спереди и сзади
    const { canvas, geo } = await composeWrap(product, variant, mode, design, assets, 1);
    files.push({ role: "print", side: "wrap", blob: await canvasToBlob(canvas) });
    const trim = cropToTrim(canvas, geo, 1);
    const src = { source: trim, width: trim.width, height: trim.height, cornerRadius: 0 };
    const views = resolveSide(product, variant, used[0])!.mockups;
    const viewSides: SideId[] = ["front", "back"];
    for (let i = 0; i < Math.min(views.length, 2); i++) await addPreview(views[i], src, viewSides[i]);
  } else {
    for (const sideId of used) {
      const spec = resolveSide(product, variant, sideId)!;
      const geo = printGeometry(spec.print);
      const full = await renderSideCanvas(design[sideId], geo, assets, 1);
      files.push({ role: "print", side: sideId, blob: await canvasToBlob(full) });
      const trim = cropToTrim(full, geo, 1);
      // в заказ уходит основной (первый) ракурс
      await addPreview(spec.mockups[0], { source: trim, width: trim.width, height: trim.height, cornerRadius: geo.radius }, sideId);
    }
  }
  // Оригиналы фото покупателя — без изменений
  for (const sideId of used) {
    const img = design[sideId].image;
    const file = img ? assets[img.assetId]?.file : undefined;
    if (file) files.push({ role: "original", side: sideId, blob: file });
  }
  return { productId: product.id, variantId: variant.id, sides: used, files, previews, idempotencyKey: newId(), createdAt: Date.now() };
}

/** Скачивание файла печати (для проверки дизайнером или покупателем). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
