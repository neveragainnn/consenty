"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useEditor } from "@/lib/design/store";
import { ShowcaseMockup } from "./ShowcaseMockup";

const SAMPLES = [
  { src: "/samples/sample-sunset.svg", label: "Закат" },
  { src: "/samples/sample-waves.svg", label: "Волны" },
  { src: "/samples/sample-type.svg", label: "Надпись" },
];

const PRODUCTS = [
  { id: "cardholder", label: "Картхолдер" },
  { id: "lighter", label: "Зажигалка" },
];

/** Живая витрина на главной: примеры принтов + загрузка своего фото сразу в конструктор. */
export function HeroDemo() {
  const [art, setArt] = useState(0);
  const [product, setProduct] = useState("cardholder");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const setPendingFile = useEditor((s) => s.setPendingFile);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setPendingFile(file);
    router.push(`/constructor?product=${product}`);
  };

  return (
    <div className="reveal">
      <div className="relative overflow-hidden rounded-[28px] shadow-[0_40px_80px_-40px_rgb(29_30_33/0.55)]">
        <ShowcaseMockup productId={product} art={SAMPLES[art].src} label={`Пример: ${SAMPLES[art].label} на товаре`} />
        <div className="absolute left-3 top-3 flex rounded-full bg-alu/80 p-1 text-sm backdrop-blur">
          {PRODUCTS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProduct(p.id)}
              aria-pressed={product === p.id}
              className={`rounded-full px-3 py-1.5 ${product === p.id ? "bg-ink text-alu" : "text-ink hover:bg-ink/5"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {SAMPLES.map((s, i) => (
          <button
            key={s.src}
            type="button"
            onClick={() => setArt(i)}
            aria-label={`Показать пример «${s.label}»`}
            aria-pressed={art === i}
            className={`size-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${art === i ? "border-ink" : "border-transparent opacity-70 hover:opacity-100"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.src} alt="" className="size-full object-cover" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex h-14 flex-1 items-center justify-center rounded-xl border-2 border-dashed border-ink/30 px-3 text-sm font-medium hover:border-ink"
        >
          Примерить своё фото
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
    </div>
  );
}
