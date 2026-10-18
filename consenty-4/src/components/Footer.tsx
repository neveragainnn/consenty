import Link from "next/link";
import { SITE } from "@/config/site";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink/10">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-steel sm:grid-cols-3 sm:px-6">
        <div>
          <p className="font-display text-base text-ink">{SITE.brand}</p>
          <p className="mt-2 max-w-xs">{SITE.description}.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/catalog" className="hover:text-ink">Каталог</Link>
          <Link href="/constructor" className="hover:text-ink">Конструктор</Link>
        </div>
        <div className="flex flex-col gap-2">
          <span>Telegram: {SITE.contacts.telegram}</span>
          <span>Почта: {SITE.contacts.email}</span>
        </div>
      </div>
    </footer>
  );
}
