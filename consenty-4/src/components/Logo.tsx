import Link from "next/link";
import { SITE } from "@/config/site";

/** Логотип-заглушка. Замените SITE.brand или укажите SITE.logoSrc в src/config/site.ts. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 ${className}`} aria-label={`${SITE.brand} — на главную`}>
      {SITE.logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={SITE.logoSrc} alt={SITE.brand} className="h-7 w-auto" />
      ) : (
        <>
          <span aria-hidden className="grid size-7 place-items-center rounded-[7px] bg-ink text-alu">
            <span className="block size-3 rounded-[3px] border-2 border-signal" />
          </span>
          <span className="font-display text-lg leading-none tracking-tight">{SITE.brand}</span>
        </>
      )}
    </Link>
  );
}
