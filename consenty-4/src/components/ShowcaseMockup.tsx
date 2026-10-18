"use client";

import { useEffect, useRef, useState } from "react";
import { getProduct, getVariant, printGeometry, resolveSide, wrapStartMm } from "@/config/products";
import { renderCylinder } from "@/lib/mockup/cylinder";
import { loadImage, loadMockupImages, renderMockup, type DesignSource } from "@/lib/mockup/render";
import type { SideId } from "@/lib/types";

/**
 * Демонстрация товара с примером принта. Использует тот же рендерер,
 * что и конструктор, — то есть показывает реальный результат пайплайна.
 */
export function ShowcaseMockup({
  productId,
  variantId,
  side = "front",
  art,
  className = "",
  label,
}: {
  productId: string;
  variantId?: string;
  side?: SideId;
  art: string | null;
  className?: string;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const product = getProduct(productId);
    if (!product) return;
    const spec = resolveSide(product, getVariant(product, variantId), side);
    if (!spec) return;
    (async () => {
      // у товаров «по кругу» пример растягивается на весь обхват
      const geo = printGeometry(product.wrap ? resolveSide(product, getVariant(product, variantId), "wrap")!.print : spec.print);
      const mockup = spec.mockups[0];
      const images = await loadMockupImages(mockup);
      let design: DesignSource | null = null;
      if (art) {
        const img = await loadImage(art);
        const k = 0.6;
        const c = document.createElement("canvas");
        c.width = Math.round(geo.trim.width * k);
        c.height = Math.round(geo.trim.height * k);
        const ctx = c.getContext("2d")!;
        // Вписываем пример «по заполнению», как кнопка «Заполнить» в редакторе
        const s = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);
        const w = img.naturalWidth * s;
        const h = img.naturalHeight * s;
        ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
        design = { source: c, width: c.width, height: c.height, cornerRadius: geo.radius * k };
      }
      if (cancelled || !ref.current) return;
      if (mockup.kind === "cylinder" && mockup.cylinder && product.wrap) {
        const [w, h] = product.wrap.stickerMm;
        renderCylinder(ref.current, { ...mockup.cylinder, width: mockup.width, height: mockup.height, stickerWMm: w, stickerHMm: h },
          { base: images.base, shade: images.shade, overlay: images.overlay }, design, wrapStartMm(product, "around"), 0.7);
      } else {
        renderMockup(ref.current, mockup, images, design, 0.7);
      }
      setReady(true);
    })().catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [productId, variantId, side, art]);

  return (
    <div className={`relative aspect-square overflow-hidden bg-alu-2 ${className}`}>
      <canvas ref={ref} role="img" aria-label={label} className={`size-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}
