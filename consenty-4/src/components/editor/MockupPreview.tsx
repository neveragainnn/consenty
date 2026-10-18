"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductConfig, ProductVariant } from "@/config/products";
import { renderSidePreview } from "@/lib/design/export";
import type { DesignState, ImageAsset, SideId, WrapMode } from "@/lib/types";

/** Живой предпросмотр на изделии без элементов редактора. Перерисовывается с небольшой задержкой. */
export function MockupPreview({
  product,
  variant,
  sideId,
  design,
  mode = "two",
  assets,
  quality = "live",
  view = 0,
  className = "",
}: {
  product: ProductConfig;
  variant: ProductVariant;
  sideId: SideId;
  design: DesignState;
  mode?: WrapMode;
  assets: Record<string, ImageAsset>;
  quality?: "live" | "high";
  view?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const job = useRef(0);

  useEffect(() => {
    const id = ++job.current;
    const t = setTimeout(
      async () => {
        if (!ref.current) return;
        try {
          const off = document.createElement("canvas");
          await renderSidePreview(off, product, variant, sideId, design, assets, {
            mode,
            mockupScale: quality === "high" ? 1 : 0.6,
            designRatio: quality === "high" ? 1 : 0.5,
            view,
          });
          if (id !== job.current || !ref.current) return;
          // Рисуем в видимый canvas одним кадром — без мигания
          const c = ref.current;
          c.width = off.width;
          c.height = off.height;
          c.getContext("2d")!.drawImage(off, 0, 0);
          setState("ready");
        } catch (e) {
          console.error(e);
          if (id === job.current) setState("error");
        }
      },
      state === "loading" ? 0 : 180,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, variant, sideId, design, mode, assets, quality, view]);

  return (
    <div className={`relative aspect-square overflow-hidden bg-alu-2 ${className}`}>
      <canvas ref={ref} role="img" aria-label="Предпросмотр дизайна на изделии" className="size-full" />
      {state === "loading" && <div className="absolute inset-0 animate-pulse bg-alu-3/50" />}
      {state === "error" && (
        <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-danger">Не удалось построить превью.</p>
      )}
    </div>
  );
}
