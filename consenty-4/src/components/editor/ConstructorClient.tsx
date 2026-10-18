"use client";

import dynamic from "next/dynamic";

/** Конструктор работает только в браузере (canvas), поэтому без серверного рендеринга. */
const Constructor = dynamic(() => import("./Constructor").then((m) => m.Constructor), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-6">
      <div className="h-[min(62vh,560px)] min-h-[320px] animate-pulse rounded-[22px] bg-bench" />
    </div>
  ),
});

export function ConstructorClient({ productId }: { productId: string | null }) {
  return <Constructor initialProductId={productId} />;
}
