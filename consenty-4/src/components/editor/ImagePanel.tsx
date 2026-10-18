"use client";

import { useRef, useState } from "react";
import type { PrintGeometry } from "@/config/products";
import { coverScale } from "@/lib/geometry";
import { createImageLayer, fillLayer, fitLayer } from "@/lib/design/layers";
import { updateSide, useEditor } from "@/lib/design/store";
import { ImageFileError, readImageFile } from "@/lib/design/upload";
import type { ImageLayer, SideId } from "@/lib/types";
import { Button } from "../ui/Button";
import { Slider } from "../ui/Slider";
import { IconCrop, IconRotate, IconTrash, IconUpload } from "./icons";

export function useImageUpload(sideId: SideId, geo: PrintGeometry) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const addAsset = useEditor((s) => s.addAsset);
  const apply = useEditor((s) => s.apply);
  const select = useEditor((s) => s.select);

  const upload = async (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const asset = await readImageFile(file);
      addAsset(asset);
      const layer = createImageLayer(asset, geo);
      apply(updateSide(sideId, (s) => ({ ...s, image: layer })));
      select(layer.id);
    } catch (e) {
      setError(e instanceof ImageFileError ? e.message : "Не удалось загрузить фото. Попробуйте другой файл.");
    } finally {
      setBusy(false);
    }
  };
  return { upload, error, busy, clearError: () => setError(null) };
}

export function ImagePanel({
  sideId,
  geo,
  onCrop,
}: {
  sideId: SideId;
  geo: PrintGeometry;
  onCrop(): void;
}) {
  const image = useEditor((s) => s.design[sideId].image);
  const assets = useEditor((s) => s.assets);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);
  const apply = useEditor((s) => s.apply);
  const select = useEditor((s) => s.select);
  const lockRatio = useEditor((s) => s.lockRatio);
  const setLockRatio = useEditor((s) => s.setLockRatio);
  const input = useRef<HTMLInputElement>(null);
  const { upload, error, busy } = useImageUpload(sideId, geo);
  const [dragOver, setDragOver] = useState(false);

  const patch = (p: Partial<ImageLayer>, record = false) => {
    const fn = updateSide(sideId, (s) => (s.image ? { ...s, image: { ...s.image, ...p } } : s));
    if (record) apply(fn);
    else update(fn);
  };
  const transform = (fn: (l: ImageLayer) => ImageLayer) =>
    apply(updateSide(sideId, (s) => (s.image ? { ...s, image: fn(s.image) } : s)));

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="hidden"
      onChange={(e) => {
        upload(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  if (!image) {
    return (
      <div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            upload(e.dataTransfer.files?.[0]);
          }}
          disabled={busy}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragOver ? "border-signal bg-signal/10" : "border-ink/25 hover:border-ink"
          }`}
        >
          <IconUpload />
          <span className="font-medium">{busy ? "Загружаем…" : "Загрузить фото"}</span>
          <span className="text-sm text-steel">JPG, PNG или WebP до 20 МБ. Можно перетащить файл сюда.</span>
        </button>
        {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
        {fileInput}
      </div>
    );
  }

  const asset = assets[image.assetId];
  const ratio = image.ratio ?? 1;
  const cover = coverScale(image.crop, image.rotation, geo.width, geo.height, ratio);
  const relative = Math.round((image.scale / cover) * 100);
  const norm = (r: number) => ((((r + 180) % 360) + 360) % 360) - 180;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {asset && <img src={asset.url} alt="" className="size-14 rounded-lg object-cover" />}
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-medium">{asset?.name ?? "Фото"}</p>
          <p className="text-steel tabular-nums">
            {asset?.width} × {asset?.height} px
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
          <IconUpload /> Заменить
        </Button>
        <Button variant="outline" size="sm" onClick={onCrop}>
          <IconCrop /> Кадр
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            apply(updateSide(sideId, (s) => ({ ...s, image: null })));
            select(null);
          }}
        >
          <IconTrash /> Удалить
        </Button>
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {fileInput}

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" className="bg-ink/5" onClick={() => transform((l) => fillLayer(l, geo))}>
          Заполнить
        </Button>
        <Button variant="ghost" size="sm" className="bg-ink/5" onClick={() => transform((l) => fitLayer(l, geo))}>
          Вписать
        </Button>
        <Button variant="ghost" size="sm" className="bg-ink/5" onClick={() => patch({ x: geo.width / 2, y: geo.height / 2 }, true)}>
          По центру
        </Button>
        <Button variant="ghost" size="sm" className="bg-ink/5" onClick={() => patch({ rotation: norm(image.rotation + 90) }, true)}>
          <IconRotate /> 90°
        </Button>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl bg-ink/5 px-3 py-2.5 text-sm">
        <span>
          Сохранять пропорции
          <span className="block text-xs text-steel">Выключите, чтобы растягивать фото как угодно</span>
        </span>
        <input type="checkbox" className="size-5 accent-[#1d1e21]" checked={lockRatio} onChange={(e) => setLockRatio(e.target.checked)} />
      </label>

      {lockRatio ? (
        <Slider
          label="Масштаб"
          value={relative}
          min={10}
          max={400}
          format={(v) => `${v}%`}
          onChange={(v) => patch({ scale: (v / 100) * cover })}
          onCommit={commit}
        />
      ) : (
        <>
          <Slider
            label="Ширина"
            value={Math.round((image.scale / cover) * 100)}
            min={10}
            max={400}
            format={(v) => `${v}%`}
            onChange={(v) => {
              // меняем только ширину: высота остаётся прежней
              const newScale = (v / 100) * cover;
              patch({ scale: newScale, ratio: (image.scale * ratio) / newScale });
            }}
            onCommit={commit}
          />
          <Slider
            label="Высота"
            value={Math.round(((image.scale * ratio) / cover) * 100)}
            min={10}
            max={400}
            format={(v) => `${v}%`}
            onChange={(v) => patch({ ratio: ((v / 100) * cover) / image.scale })}
            onCommit={commit}
          />
        </>
      )}
      {Math.abs(ratio - 1) > 0.005 && (
        <Button variant="ghost" size="sm" className="bg-ink/5" onClick={() => transform((l) => ({ ...l, ratio: 1 }))}>
          Вернуть пропорции
        </Button>
      )}
      <Slider
        label="Поворот"
        value={Math.round(norm(image.rotation))}
        min={-180}
        max={180}
        format={(v) => `${v}°`}
        onChange={(v) => patch({ rotation: v })}
        onCommit={commit}
      />
      <Slider
        label="По горизонтали"
        value={Math.round((image.x / geo.width) * 100)}
        min={0}
        max={100}
        format={(v) => `${v - 50 > 0 ? "+" : ""}${v - 50}`}
        onChange={(v) => patch({ x: (v / 100) * geo.width })}
        onCommit={commit}
      />
      <Slider
        label="По вертикали"
        value={Math.round((image.y / geo.height) * 100)}
        min={0}
        max={100}
        format={(v) => `${v - 50 > 0 ? "+" : ""}${v - 50}`}
        onChange={(v) => patch({ y: (v / 100) * geo.height })}
        onCommit={commit}
      />
      <p className="text-xs text-steel">На телефоне фото можно масштабировать и поворачивать двумя пальцами.</p>
    </div>
  );
}
