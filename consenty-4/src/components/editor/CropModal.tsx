"use client";
/** Кадрирование исходного фото. Результат — прямоугольник в пикселях оригинала. */
import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Image as KImage, Layer, Rect, Shape, Stage, Transformer } from "react-konva";
import { useLoadedImage } from "@/lib/design/useLoadedImage";
import type { CropRect, ImageAsset } from "@/lib/types";
import { Button } from "../ui/Button";

type Aspect = "free" | "surface" | "square";

function largestCentered(w: number, h: number, ratio: number): CropRect {
  let cw = w;
  let ch = w / ratio;
  if (ch > h) {
    ch = h;
    cw = h * ratio;
  }
  return { x: (w - cw) / 2, y: (h - ch) / 2, width: cw, height: ch };
}

export function CropModal({
  asset,
  initial,
  surfaceRatio,
  onApply,
  onClose,
}: {
  asset: ImageAsset;
  initial: CropRect;
  surfaceRatio: number;
  onApply(c: CropRect): void;
  onClose(): void;
}) {
  const img = useLoadedImage(asset.url);
  const wrap = useRef<HTMLDivElement>(null);
  const rectRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropRect>(initial);
  const [aspect, setAspect] = useState<Aspect>("free");

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [img, box]);

  const W = asset.width;
  const H = asset.height;
  const s = box.w && box.h ? Math.min(box.w / W, box.h / H) : 0;
  const ox = (box.w - W * s) / 2;
  const oy = (box.h - H * s) / 2;

  const setPreset = (a: Aspect) => {
    setAspect(a);
    if (a === "free") return;
    setCrop(largestCentered(W, H, a === "square" ? 1 : surfaceRatio));
  };

  const readRect = () => {
    const r = rectRef.current!;
    const width = r.width() * r.scaleX();
    const height = r.height() * r.scaleY();
    r.scale({ x: 1, y: 1 });
    setCrop({ x: r.x(), y: r.y(), width, height });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/90 p-3 text-alu sm:p-6" role="dialog" aria-modal aria-label="Кадрирование фото">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl">Кадрирование</h2>
        <div className="flex flex-wrap gap-1 rounded-full bg-alu/10 p-1 text-sm">
          {(
            [
              ["free", "Свободно"],
              ["surface", "Как поверхность"],
              ["square", "1:1"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPreset(id)}
              aria-pressed={aspect === id}
              className={`rounded-full px-3 py-1.5 ${aspect === id ? "bg-alu text-ink" : "hover:bg-alu/10"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div ref={wrap} className="relative my-4 min-h-0 flex-1 touch-none">
        {img && s > 0 && (
          <Stage width={box.w} height={box.h} scaleX={s} scaleY={s} x={ox} y={oy}>
            <Layer>
              <KImage image={img} width={W} height={H} listening={false} />
              <Shape
                listening={false}
                sceneFunc={(ctx) => {
                  const c = (ctx as unknown as { _context: CanvasRenderingContext2D })._context;
                  c.save();
                  c.fillStyle = "rgba(20,20,22,0.6)";
                  c.beginPath();
                  c.rect(0, 0, W, H);
                  c.rect(crop.x + crop.width, crop.y, -crop.width, crop.height);
                  c.fill("evenodd");
                  c.restore();
                }}
              />
              <Rect
                ref={rectRef}
                {...crop}
                stroke="#ff5b14"
                strokeWidth={2 / s}
                draggable
                dragBoundFunc={(pos) => {
                  // pos — абсолютные координаты; переводим в координаты фото и ограничиваем
                  const x = Math.min(Math.max((pos.x - ox) / s, 0), W - crop.width);
                  const y = Math.min(Math.max((pos.y - oy) / s, 0), H - crop.height);
                  return { x: x * s + ox, y: y * s + oy };
                }}
                onDragMove={(e) => setCrop((c) => ({ ...c, x: e.target.x(), y: e.target.y() }))}
                onTransform={readRect}
              />
              <Transformer
                ref={trRef}
                rotateEnabled={false}
                keepRatio={aspect !== "free"}
                enabledAnchors={
                  aspect === "free"
                    ? ["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"]
                    : ["top-left", "top-right", "bottom-left", "bottom-right"]
                }
                anchorSize={18}
                anchorCornerRadius={9}
                anchorFill="#ffffff"
                anchorStroke="#1d1e21"
                borderEnabled={false}
                ignoreStroke
                boundBoxFunc={(oldBox, nb) => {
                  const minPx = 40;
                  const inside =
                    nb.x >= ox - 0.5 &&
                    nb.y >= oy - 0.5 &&
                    nb.x + nb.width <= ox + W * s + 0.5 &&
                    nb.y + nb.height <= oy + H * s + 0.5;
                  return inside && nb.width >= minPx && nb.height >= minPx ? nb : oldBox;
                }}
              />
            </Layer>
          </Stage>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-alu/70 tabular-nums">
          {Math.round(crop.width)} × {Math.round(crop.height)} px
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" className="text-alu hover:bg-alu/10" onClick={() => setCrop({ x: 0, y: 0, width: W, height: H })}>
            Без кадрирования
          </Button>
          <Button variant="outline" className="border-alu/30 text-alu hover:border-alu" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="signal"
            onClick={() =>
              onApply({ x: Math.round(crop.x), y: Math.round(crop.y), width: Math.round(crop.width), height: Math.round(crop.height) })
            }
          >
            Применить
          </Button>
        </div>
      </div>
    </div>
  );
}
