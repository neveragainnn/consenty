import type { Metadata } from "next";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS } from "@/config/products";
import { SITE } from "@/config/site";

export const metadata: Metadata = { title: "Каталог" };

const ART = ["/samples/sample-waves.svg", "/samples/sample-type.svg", "/samples/sample-sunset.svg"];

export default function CatalogPage() {
  const demo = SITE.showPrices && PRODUCTS.some((p) => p.priceIsDemo);
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
      <h1 className="font-display text-4xl sm:text-5xl">Каталог</h1>
      <p className="mt-3 max-w-[56ch] text-steel">
        Выберите изделие — в конструкторе можно загрузить фото, добавить надпись и посмотреть результат на товаре.
      </p>
      {demo && (
        <p className="mt-4 max-w-[64ch] rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm">
          Цены пока демонстрационные. Владелец магазина задаёт их в файле <code>src/config/products.ts</code>.
        </p>
      )}
      <div className="mt-12 grid gap-14 md:grid-cols-2 md:gap-10">
        {PRODUCTS.map((p, i) => (
          <div key={p.id}>
            <ProductCard product={p} art={ART[i % ART.length]} />
            <p className="mt-4 max-w-[60ch] text-sm text-steel">{p.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
