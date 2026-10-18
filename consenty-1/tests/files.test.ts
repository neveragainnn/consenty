import { describe, expect, it } from "vitest";
import { MB } from "@/config/limits";
import { checkFileMeta, sniffImageMime } from "@/lib/files";
import { JPEG_BYTES, PNG_BYTES, FAKE_BYTES } from "./helpers";

describe("валидация файла", () => {
  it("принимает JPEG/PNG/WebP фото с правильным расширением", () => {
    expect(checkFileMeta("original", { name: "photo.JPG", type: "image/jpeg", size: 2 * MB }).ok).toBe(true);
    expect(checkFileMeta("original", { name: "a.png", type: "image/png", size: 100 }).ok).toBe(true);
    expect(checkFileMeta("original", { name: "a.webp", type: "image/webp", size: 100 }).ok).toBe(true);
  });

  it("отклоняет неподдерживаемые типы", () => {
    const r = checkFileMeta("original", { name: "a.gif", type: "image/gif", size: 100 });
    expect(r.ok).toBe(false);
    expect(checkFileMeta("original", { name: "a.heic", type: "image/heic", size: 100 }).ok).toBe(false);
    expect(checkFileMeta("original", { name: "a.svg", type: "image/svg+xml", size: 100 }).ok).toBe(false);
  });

  it("отклоняет несовпадение расширения и MIME", () => {
    const r = checkFileMeta("original", { name: "photo.png", type: "image/jpeg", size: 100 });
    expect(r).toMatchObject({ ok: false });
  });

  it("проверяет размер", () => {
    expect(checkFileMeta("original", { name: "a.jpg", type: "image/jpeg", size: 21 * MB }).ok).toBe(false);
    expect(checkFileMeta("original", { name: "a.jpg", type: "image/jpeg", size: 0 }).ok).toBe(false);
  });

  it("файл печати и превью — только PNG", () => {
    expect(checkFileMeta("print", { type: "image/jpeg", size: 100 }).ok).toBe(false);
    expect(checkFileMeta("preview", { type: "image/png", size: 100 }).ok).toBe(true);
  });

  it("определяет тип по сигнатуре", () => {
    expect(sniffImageMime(PNG_BYTES)).toBe("image/png");
    expect(sniffImageMime(JPEG_BYTES)).toBe("image/jpeg");
    expect(sniffImageMime(new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]))).toBe("image/webp");
    expect(sniffImageMime(FAKE_BYTES)).toBeNull();
  });
});
