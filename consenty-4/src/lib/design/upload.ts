"use client";
import { MIN_IMAGE_SIDE } from "@/config/limits";
import { checkFileMeta } from "../files";
import { loadImage } from "../mockup/render";
import type { ImageAsset } from "../types";
import { newId } from "./store";

export class ImageFileError extends Error {}

/** Проверяет и декодирует фото покупателя. Оригинал файла сохраняется без изменений. */
export async function readImageFile(file: File): Promise<ImageAsset> {
  const lower = file.name.toLowerCase();
  if (file.type === "image/heic" || file.type === "image/heif" || lower.endsWith(".heic") || lower.endsWith(".heif")) {
    throw new ImageFileError("Формат HEIC не поддерживается. На iPhone выберите «Наиболее совместимый» формат или сохраните фото как JPG.");
  }
  const check = checkFileMeta("original", { name: file.name, type: file.type, size: file.size });
  if (!check.ok) throw new ImageFileError(check.error);
  const url = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await loadImage(url);
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageFileError("Не удалось прочитать изображение. Возможно, файл повреждён.");
  }
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (Math.min(width, height) < MIN_IMAGE_SIDE) {
    URL.revokeObjectURL(url);
    throw new ImageFileError(`Фото слишком маленькое (${width}×${height}). Нужно хотя бы ${MIN_IMAGE_SIDE} пикселей по короткой стороне.`);
  }
  return { id: newId(), file, url, width, height, name: file.name };
}
