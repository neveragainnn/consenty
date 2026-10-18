import Link from "next/link";
import type { ProductConfig } from "@/config/products";
import { productSides } from "@/config/products";
import { formatPrice } from "@/lib/format";
import { SITE } from "@/config/site";
import { ShowcaseMockup } from "./ShowcaseMockup";

export function ProductCard({ product, art }: { product: ProductConfig; art: string }) {
  const sides = productSides(product);
  return (
    <article className="group flex flex-col">
      <Link href={`/constructor?product=${product.id}`} className="block overflow-hidden rounded-[24px]">
        <ShowcaseMockup productId={product.id} art={art} label={`${product.name} с примером принта`} />
      </Link>
      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl">{product.name}</h3>
          <p className="mt-1 max-w-sm text-steel">{product.tagline}</p>
        </div>
        {SITE.showPrices && (
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums">от {formatPrice(product.price)}</p>
            {product.priceIsDemo && <p className="text-xs text-signal-ink">демо-цена, настраивается</p>}
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-steel">Цвет:</span>
          {product.variants.map((v) => (
            <span key={v.id} title={v.name} className="size-5 rounded-full border border-ink/20" style={{ background: v.swatch }} />
          ))}
        </div>
        <span className="text-steel">
          Печать: {sides.length > 1 ? "одна или обе стороны" : "одна сторона"}
          {SITE.showPrices && sides.length > 1 && product.secondSidePrice > 0 ? `, вторая +${formatPrice(product.secondSidePrice)}` : ""}
        </span>
      </div>
      <Link
        href={`/constructor?product=${product.id}`}
        className="mt-5 inline-flex w-fit items-center rounded-full bg-ink px-5 py-3 font-medium text-alu hover:bg-ink-2"
      >
        Открыть в конструкторе
      </Link>
    </article>
  );
}
