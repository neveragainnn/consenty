import { coverScale, containScale, imageCoversRect, rectCoverage, rectInside, rotatedBounds } from "../geometry";
import type { ImageAsset, ImageLayer, SideDesign, TextLayer } from "../types";
import type { PrintGeometry } from "@/config/products";
import { LOW_DPI_WARNING } from "@/config/limits";
import { newId } from "./store";

/** Атрибуты Konva для слоя-изображения. Используются и редактором, и экспортом — поэтому результат совпадает. */
export function imageAttrs(l: ImageLayer) {
  return {
    x: l.x,
    y: l.y,
    width: l.crop.width,
    height: l.crop.height,
    offsetX: l.crop.width / 2,
    offsetY: l.crop.height / 2,
    scaleX: l.scale,
    scaleY: l.scale * (l.ratio ?? 1),
    rotation: l.rotation,
    crop: { ...l.crop },
  };
}

export const TEXT_LINE_HEIGHT = 1.1;

export function textAttrs(t: TextLayer) {
  return {
    x: t.x,
    y: t.y,
    text: t.text,
    fontSize: t.fontSize,
    fontFamily: t.fontFamily,
    fill: t.fill,
    rotation: t.rotation,
    lineHeight: TEXT_LINE_HEIGHT,
    align: "center" as const,
  };
}

export function createImageLayer(asset: ImageAsset, geo: PrintGeometry): ImageLayer {
  const crop = { x: 0, y: 0, width: asset.width, height: asset.height };
  return {
    id: newId(),
    kind: "image",
    assetId: asset.id,
    x: geo.width / 2,
    y: geo.height / 2,
    rotation: 0,
    scale: coverScale(crop, 0, geo.width, geo.height),
    crop,
  };
}

export function fillLayer(l: ImageLayer, geo: PrintGeometry): ImageLayer {
  return { ...l, x: geo.width / 2, y: geo.height / 2, scale: coverScale(l.crop, l.rotation, geo.width, geo.height, l.ratio ?? 1) };
}
export function fitLayer(l: ImageLayer, geo: PrintGeometry): ImageLayer {
  return { ...l, x: geo.width / 2, y: geo.height / 2, scale: containScale(l.crop, l.rotation, geo.trim.width, geo.trim.height, l.ratio ?? 1) };
}

/* -------------------------- Измерение текста -------------------------- */

let measureCtx: CanvasRenderingContext2D | null = null;

export function measureText(t: Pick<TextLayer, "text" | "fontSize" | "fontFamily">): { width: number; height: number } {
  const lines = t.text.split("\n");
  if (typeof document === "undefined") return { width: t.text.length * t.fontSize * 0.6, height: lines.length * t.fontSize * TEXT_LINE_HEIGHT };
  measureCtx ??= document.createElement("canvas").getContext("2d");
  const ctx = measureCtx!;
  ctx.font = `normal normal ${t.fontSize}px ${t.fontFamily}`;
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
  return { width, height: lines.length * t.fontSize * TEXT_LINE_HEIGHT };
}

export function createTextLayer(geo: PrintGeometry, fontFamily: string, index: number): TextLayer {
  const text = "Ваш текст";
  let fontSize = Math.round(geo.trim.height * 0.14);
  // на узких изделиях уменьшаем, чтобы надпись сразу помещалась в безопасную зону
  const w0 = measureText({ text, fontSize, fontFamily }).width;
  if (w0 > geo.safe.width * 0.9) fontSize = Math.max(8, Math.floor((fontSize * geo.safe.width * 0.9) / w0));
  const { width, height } = measureText({ text, fontSize, fontFamily });
  return {
    id: newId(),
    kind: "text",
    text,
    fontSize,
    fontFamily,
    fill: "#FFFFFF",
    rotation: 0,
    x: geo.width / 2 - width / 2,
    y: Math.min(geo.height / 2 - height / 2 + index * fontSize * 1.3, geo.safe.y + geo.safe.height - height),
  };
}

/** Переместить текст так, чтобы его центр оказался в центре области. */
export function centerText(t: TextLayer, geo: PrintGeometry): TextLayer {
  const { width, height } = measureText(t);
  return { ...t, rotation: 0, x: geo.width / 2 - width / 2, y: geo.height / 2 - height / 2 };
}

/* ------------------------------ Проверки ------------------------------ */

export interface DesignWarning {
  id: string;
  level: "info" | "warn";
  text: string;
}

export function designWarnings(side: SideDesign, geo: PrintGeometry, dpi: number): DesignWarning[] {
  const out: DesignWarning[] = [];
  const area = { x: 0, y: 0, width: geo.width, height: geo.height };
  const img = side.image;
  if (img) {
    // Важно, сколько области печати осталось пустой, а не какая часть фото обрезана
    if (rectCoverage(img, area) < 0.5) {
      out.push({ id: "outside", level: "warn", text: "Фото закрывает меньше половины области печати — сдвиньте или увеличьте его." });
    } else if (!imageCoversRect(img, area)) {
      out.push({ id: "gaps", level: "warn", text: "Фото не закрывает всю область печати: по краям останется фон изделия. Нажмите «Заполнить», если это не задумано." });
    }
    const effectiveDpi = dpi / Math.max(img.scale, img.scale * (img.ratio ?? 1));
    const r = img.ratio ?? 1;
    if (r > 1.6 || r < 0.625) {
      out.push({ id: "stretch", level: "info", text: "Фото заметно растянуто — пропорции изображения искажены. Если это не задумано, нажмите «Вернуть пропорции»." });
    }
    if (effectiveDpi < LOW_DPI_WARNING) {
      out.push({
        id: "dpi",
        level: "warn",
        text: `Фото растянуто: примерно ${Math.round(effectiveDpi)} точек на дюйм. Печать может получиться размытой — уменьшите масштаб или загрузите фото крупнее.`,
      });
    }
  }
  for (const t of side.texts) {
    if (!t.text.trim()) continue;
    const { width, height } = measureText(t);
    const b = rotatedBounds(t.x, t.y, width, height, t.rotation);
    if (!rectInside(b, geo.safe)) {
      out.push({ id: `text-${t.id}`, level: "warn", text: `Надпись «${t.text.slice(0, 24)}» выходит за безопасную зону — её край может обрезаться.` });
    }
  }
  return out;
}
