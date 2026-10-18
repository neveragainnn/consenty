import { describe, expect, it } from "vitest";
import { applyHomography, coverScale, homography, imageCoversRect, rectQuad } from "@/lib/geometry";
import { normalizeContact } from "@/lib/validation";
import { quotePrice } from "@/lib/pricing";
import type { ImageLayer, Quad } from "@/lib/types";

describe("перспектива", () => {
  it("гомография переводит углы прямоугольника в углы четырёхугольника", () => {
    const dst: Quad = [
      { x: 100, y: 640 },
      { x: 718, y: 385 },
      { x: 1080, y: 600 },
      { x: 470, y: 870 },
    ];
    const h = homography(rectQuad(1000, 600), dst);
    rectQuad(1000, 600).forEach((p, i) => {
      const r = applyHomography(h, p);
      expect(r.x).toBeCloseTo(dst[i].x, 6);
      expect(r.y).toBeCloseTo(dst[i].y, 6);
    });
  });
});

describe("покрытие области", () => {
  const layer = (scale: number, rotation = 0): ImageLayer => ({
    id: "i",
    kind: "image",
    assetId: "a",
    x: 500,
    y: 300,
    scale,
    rotation,
    crop: { x: 0, y: 0, width: 2000, height: 1000 },
  });
  it("масштаб «заполнить» закрывает область и с поворотом", () => {
    for (const rot of [0, 15, 45, 90]) {
      const s = coverScale(layer(1).crop, rot, 1000, 600);
      expect(imageCoversRect(layer(s, rot), { x: 0, y: 0, width: 1000, height: 600 })).toBe(true);
      expect(imageCoversRect(layer(s * 0.95, rot), { x: 0, y: 0, width: 1000, height: 600 })).toBe(false);
    }
  });
});

describe("свободное растяжение", () => {
  it("«Заполнить» учитывает растяжение по вертикали", () => {
    const crop = { x: 0, y: 0, width: 2000, height: 1000 };
    for (const ratio of [0.5, 1, 2.5]) {
      const scale = coverScale(crop, 10, 1000, 600, ratio);
      const l: ImageLayer = { id: "i", kind: "image", assetId: "a", x: 500, y: 300, scale, ratio, rotation: 10, crop };
      expect(imageCoversRect(l, { x: 0, y: 0, width: 1000, height: 600 })).toBe(true);
      expect(imageCoversRect({ ...l, scale: scale * 0.95 }, { x: 0, y: 0, width: 1000, height: 600 })).toBe(false);
    }
  });
});

describe("контакт и цена", () => {
  it("нормализует Telegram и телефон", () => {
    expect(normalizeContact("ivan_petrov")).toEqual({ kind: "telegram", value: "@ivan_petrov" });
    expect(normalizeContact("https://t.me/ivan_petrov")).toEqual({ kind: "telegram", value: "@ivan_petrov" });
    expect(normalizeContact("+7 (900) 123-45-67")).toEqual({ kind: "phone", value: "+79001234567" });
    expect(normalizeContact("123")).toBeNull();
  });
  it("цена считается из конфигурации", () => {
    const one = quotePrice({ productId: "cardholder", variantId: "silver", quantity: 2, sides: ["front"] });
    const two = quotePrice({ productId: "cardholder", variantId: "silver", quantity: 2, sides: ["front", "back"] });
    expect(two.total).toBeGreaterThan(one.total);
    expect(() => quotePrice({ productId: "cardholder", variantId: "nope", quantity: 1, sides: ["front"] })).toThrow();
    expect(() => quotePrice({ productId: "cardholder", variantId: "silver", quantity: 0, sides: ["front"] })).toThrow();
  });
});
