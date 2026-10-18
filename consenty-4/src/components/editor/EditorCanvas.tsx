"use client";
/**
 * Интерактивная рабочая область (Konva).
 *
 * Координаты всех слоёв — в пикселях производственного файла; Stage лишь
 * масштабируется под экран. Изображение рисуется дважды:
 *  - «призрак» (полупрозрачный, без обрезки) — за него можно взять и тянуть
 *    даже ту часть, что вне области печати;
 *  - чистая копия, обрезанная по области печати, — то, что попадёт в файл.
 */
import type Konva from "konva";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KImage, Layer, Rect, Stage, Text as KText, Transformer } from "react-konva";
import type { PrintGeometry, SideSpec } from "@/config/products";
import { clamp } from "@/lib/geometry";
import { imageAttrs, textAttrs } from "@/lib/design/layers";
import { useLoadedImage } from "@/lib/design/useLoadedImage";
import type { DesignState, ImageAsset, ImageLayer, SideDesign, SideId, TextLayer } from "@/lib/types";

interface Props {
  sideId: SideId;
  spec: SideSpec;
  geo: PrintGeometry;
  design: SideDesign;
  assets: Record<string, ImageAsset>;
  selectedId: string | null;
  warn: boolean;
  /** Сохранять пропорции фото при растягивании за ручки. */
  lockRatio: boolean;
  onSelect(id: string | null): void;
  onUpdate(fn: (d: DesignState) => DesignState): void;
  onCommit(): void;
}

const MIN_SCALE = 0.02;
const MAX_SCALE = 12;

export default function EditorCanvas(props: Props) {
  const { sideId, spec, geo, design, assets, selectedId, warn, lockRatio, onSelect, onUpdate, onCommit } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const trRef = useRef<Konva.Transformer>(null);
  const imageRef = useRef<Konva.Image>(null);
  const textRefs = useRef(new Map<string, Konva.Text>());
  const pinch = useRef<{ dist: number; angle: number; scale: number; rotation: number; fontSize: number } | null>(null);
  const [coarse, setCoarse] = useState(false);

  const bg = useLoadedImage(spec.editor.image);
  const asset = design.image ? assets[design.image.assetId] : undefined;
  const photo = useLoadedImage(asset?.url);

  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Подложка-товар в координатах дизайна
  const bgRect = useMemo(() => {
    const k = geo.pxPerMm;
    const [iw, ih] = spec.editor.imageMm;
    const [ox, oy] = spec.editor.trimOffsetMm;
    return { x: geo.trim.x - ox * k, y: geo.trim.y - oy * k, width: iw * k, height: ih * k };
  }, [geo, spec.editor]);

  // Область просмотра: товар целиком + запас вокруг
  const view = useMemo(() => {
    const pad = Math.max(geo.width, geo.height) * 0.08;
    const minX = Math.min(0, bgRect.x) - pad;
    const minY = Math.min(0, bgRect.y) - pad;
    const maxX = Math.max(geo.width, bgRect.x + bgRect.width) + pad;
    const maxY = Math.max(geo.height, bgRect.y + bgRect.height) + pad;
    const vw = maxX - minX;
    const vh = maxY - minY;
    const scale = box.w && box.h ? Math.min(box.w / vw, box.h / vh) : 0;
    return { scale, x: (box.w - vw * scale) / 2 - minX * scale, y: (box.h - vh * scale) / 2 - minY * scale };
  }, [box, bgRect, geo]);

  // Привязка трансформера к выбранному слою
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    let node: Konva.Node | undefined;
    if (selectedId && design.image?.id === selectedId) node = imageRef.current ?? undefined;
    else if (selectedId) node = textRefs.current.get(selectedId);
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, design, photo]);

  const patchImage = (patch: Partial<ImageLayer>) =>
    onUpdate((d) => {
      const img = d[sideId].image;
      return img ? { ...d, [sideId]: { ...d[sideId], image: { ...img, ...patch } } } : d;
    });
  const patchText = (id: string, patch: Partial<TextLayer>) =>
    onUpdate((d) => ({
      ...d,
      [sideId]: { ...d[sideId], texts: d[sideId].texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) },
    }));

  /* -------- Изображение -------- */
  const onImageDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const n = e.target;
    // Центр фото не может уйти за пределы области печати
    n.x(clamp(n.x(), 0, geo.width));
    n.y(clamp(n.y(), 0, geo.height));
    patchImage({ x: n.x(), y: n.y() });
  };
  const onImageTransform = (e: Konva.KonvaEventObject<Event>) => {
    const n = e.target;
    const sx = clamp(Math.abs(n.scaleX()), MIN_SCALE, MAX_SCALE);
    const sy = clamp(Math.abs(n.scaleY()), MIN_SCALE, MAX_SCALE);
    patchImage({ x: n.x(), y: n.y(), scale: sx, ratio: sy / sx, rotation: n.rotation() });
  };

  /* -------- Текст -------- */
  const onTextTransform = (t: TextLayer) => (e: Konva.KonvaEventObject<Event>) => {
    const n = e.target as Konva.Text;
    const fontSize = clamp(n.fontSize() * n.scaleX(), 8, geo.height * 1.5);
    n.scale({ x: 1, y: 1 });
    patchText(t.id, { x: n.x(), y: n.y(), rotation: n.rotation(), fontSize });
  };

  /* -------- Жесты двумя пальцами: масштаб и поворот -------- */
  const onTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (touches.length !== 2 || !selectedId) return;
    e.evt.preventDefault();
    const isImage = design.image?.id === selectedId;
    const node = isImage ? imageRef.current : textRefs.current.get(selectedId);
    if (!node) return;
    if (node.isDragging()) node.stopDrag();
    const [a, b] = [touches[0], touches[1]];
    const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const angle = (Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180) / Math.PI;
    const text = design.texts.find((t) => t.id === selectedId);
    if (!pinch.current) {
      pinch.current = {
        dist,
        angle,
        scale: design.image?.scale ?? 1,
        rotation: isImage ? design.image!.rotation : text?.rotation ?? 0,
        fontSize: text?.fontSize ?? 0,
      };
      return;
    }
    const k = dist / pinch.current.dist;
    const rotation = pinch.current.rotation + (angle - pinch.current.angle);
    if (isImage) patchImage({ scale: clamp(pinch.current.scale * k, MIN_SCALE, MAX_SCALE), rotation });
    else if (text) patchText(text.id, { fontSize: clamp(pinch.current.fontSize * k, 8, geo.height * 1.5), rotation });
  };
  const onTouchEnd = () => {
    if (pinch.current) {
      pinch.current = null;
      onCommit();
    }
  };

  const deselectIfEmpty = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const t = e.target;
    if (t === t.getStage() || t.name() === "backdrop") onSelect(null);
  };

  const img = design.image;
  const imgProps = img && photo ? { image: photo, ...imageAttrs(img) } : null;
  const anchor = coarse ? 22 : 12;
  // Текст масштабируется только пропорционально; фото — свободно, если снят замок
  const freeStretch = !lockRatio && !!img && selectedId === img.id;
  const anchors = freeStretch
    ? ["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"]
    : ["top-left", "top-right", "bottom-left", "bottom-right"];
  const inv = view.scale ? 1 / view.scale : 1;

  return (
    <div ref={wrap} className="absolute inset-0 touch-none select-none" aria-label="Рабочая область конструктора" role="application">
      {view.scale > 0 && (
        <Stage
          width={box.w}
          height={box.h}
          scaleX={view.scale}
          scaleY={view.scale}
          x={view.x}
          y={view.y}
          onMouseDown={deselectIfEmpty}
          onTouchStart={deselectIfEmpty}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <Layer listening={false}>
            {bg ? (
              <KImage image={bg} {...bgRect} />
            ) : (
              <Rect {...bgRect} fill="#3a3b3f" cornerRadius={geo.radius * 2} />
            )}
          </Layer>

          <Layer>
            <Rect name="backdrop" x={-1e5} y={-1e5} width={2e5} height={2e5} fill="transparent" />
            {imgProps && img && (
              <KImage
                ref={imageRef}
                {...imgProps}
                opacity={0.3}
                draggable
                onMouseDown={() => onSelect(img.id)}
                onTouchStart={() => onSelect(img.id)}
                onDragMove={onImageDragMove}
                onDragEnd={onCommit}
                onTransform={onImageTransform}
                onTransformEnd={onCommit}
              />
            )}
            {/* То, что попадёт в печать */}
            <Group clipX={0} clipY={0} clipWidth={geo.width} clipHeight={geo.height} listening={false}>
              {imgProps && <KImage {...imgProps} />}
              {design.texts.map((t) => (
                <KText key={t.id} {...textAttrs(t)} />
              ))}
            </Group>
            {design.texts.map((t) => (
              <KText
                key={t.id}
                ref={(n) => {
                  if (n) textRefs.current.set(t.id, n);
                  else textRefs.current.delete(t.id);
                }}
                {...textAttrs(t)}
                opacity={0.3}
                draggable
                // увеличенная зона захвата — мелкую надпись легко взять пальцем
                hitFunc={(ctx, shape) => {
                  const p = 24 / (shape.getStage()?.scaleX() || 1);
                  ctx.beginPath();
                  ctx.rect(-p, -p, shape.width() + 2 * p, shape.height() + 2 * p);
                  ctx.closePath();
                  ctx.fillStrokeShape(shape);
                }}
                onMouseDown={() => onSelect(t.id)}
                onTouchStart={() => onSelect(t.id)}
                onDragMove={(e) => patchText(t.id, { x: e.target.x(), y: e.target.y() })}
                onDragEnd={onCommit}
                onTransform={onTextTransform(t)}
                onTransformEnd={onCommit}
              />
            ))}
            <Transformer
              ref={trRef}
              rotateEnabled
              keepRatio={!freeStretch}
              flipEnabled={false}
              enabledAnchors={anchors}
              rotationSnaps={[0, 90, 180, 270]}
              rotationSnapTolerance={4}
              anchorSize={anchor}
              anchorCornerRadius={anchor / 2}
              anchorStroke="#1d1e21"
              anchorFill="#ffffff"
              borderStroke="#ffffff"
              borderDash={[4, 4]}
              rotateAnchorOffset={coarse ? 36 : 28}
              ignoreStroke
              boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 16 || Math.abs(newBox.height) < 16 ? oldBox : newBox)}
            />
          </Layer>

          {/* Направляющие: вылеты, линия реза, безопасная зона */}
          <Layer listening={false}>
            <Rect x={0} y={0} width={geo.width} height={geo.height} stroke="#ffffff" strokeWidth={1 * inv} dash={[3 * inv, 3 * inv]} opacity={0.5} />
            <Rect
              {...geo.trim}
              cornerRadius={geo.radius}
              stroke={warn ? "#d23b3b" : "#ff5b14"}
              strokeWidth={(warn ? 2.5 : 1.5) * inv}
            />
            <Rect {...geo.safe} cornerRadius={Math.max(0, geo.radius - (geo.safe.x - geo.trim.x))} stroke="#ff5b14" opacity={0.6} strokeWidth={1 * inv} dash={[6 * inv, 5 * inv]} />
          </Layer>
        </Stage>
      )}
    </div>
  );
}
