/** Ограничения на файлы. Используются и на клиенте, и на сервере. */
export const MB = 1024 * 1024;

export type FileRole = "original" | "print" | "preview";

export const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageMime = (typeof IMAGE_MIME)[number];

export const MIME_EXT: Record<ImageMime, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

export const FILE_RULES: Record<FileRole, { mimes: readonly ImageMime[]; maxBytes: number }> = {
  /** Фото, которое загружает покупатель. */
  original: { mimes: IMAGE_MIME, maxBytes: 20 * MB },
  /** Производственный файл (PNG с прозрачностью). */
  print: { mimes: ["image/png"], maxBytes: 40 * MB },
  /** Превью на фото товара (PNG или JPEG). */
  preview: { mimes: ["image/png", "image/jpeg"], maxBytes: 15 * MB },
};

/** Минимальная сторона загружаемого фото, px. */
export const MIN_IMAGE_SIDE = 300;
/** Ниже этого эффективного DPI показываем предупреждение о качестве. */
export const LOW_DPI_WARNING = 150;
export const MAX_TEXT_LAYERS = 8;
export const MAX_TEXT_LENGTH = 120;
export const MAX_COMMENT_LENGTH = 1000;
