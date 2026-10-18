import Link from "next/link";
import { HeroDemo } from "@/components/HeroDemo";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS } from "@/config/products";

const STEPS = [
  { title: "Загрузите фото", text: "Любое изображение с телефона или компьютера: JPG, PNG или WebP." },
  { title: "Соберите принт", text: "Подвиньте, приблизьте, поверните, добавьте надпись — и сразу смотрите, как это выглядит на изделии." },
  { title: "Отправьте макет", text: "Укажите имя с Авито и получите короткий код. Пришлите код продавцу в чате Авито — по нему он найдёт ваш макет." },
];

const CATALOG_ART = ["/samples/sample-type.svg", "/samples/sample-sunset.svg"];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-8 sm:px-6 md:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div>
          <h1 className="font-display text-[clamp(2.6rem,7.5vw,5.6rem)] leading-[0.95] tracking-[-0.02em]">
            Создай аксессуар со своим принтом
          </h1>
          <p className="mt-6 max-w-[34ch] text-lg text-ink-2">
            Картхолдеры и зажигалки, на которых — твоё фото. Собираешь дизайн прямо в браузере и видишь результат на изделии ещё до заказа.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/constructor" className="rounded-full bg-signal px-6 py-3.5 font-medium text-ink hover:brightness-95">
              Создать свой дизайн
            </Link>
            <Link href="/catalog" className="rounded-full border border-ink/25 px-6 py-3.5 font-medium hover:border-ink">
              Смотреть каталог
            </Link>
          </div>
        </div>
        <HeroDemo />
      </section>

      <section className="border-y border-ink/10 bg-alu-2/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl sm:text-4xl">Как это работает</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative border-t-2 border-ink pt-5">
                <span className="font-display text-5xl text-ink/15" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="mt-2 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 max-w-[36ch] text-steel">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-3xl sm:text-4xl">Что можно сделать</h2>
          <Link href="/catalog" className="text-sm underline underline-offset-4 hover:text-signal-ink">
            Весь каталог
          </Link>
        </div>
        <div className="mt-10 grid gap-14 md:grid-cols-2 md:gap-10">
          {PRODUCTS.map((p, i) => (
            <ProductCard key={p.id} product={p} art={CATALOG_ART[i % CATALOG_ART.length]} />
          ))}
        </div>
      </section>
    </>
  );
}
