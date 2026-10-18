import Link from "next/link";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-alu/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link href="/catalog" className="rounded-full px-3 py-2 hover:bg-ink/5">
            Каталог
          </Link>
          <Link href="/constructor" className="hidden rounded-full px-3 py-2 hover:bg-ink/5 sm:inline-block">
            Конструктор
          </Link>
          <Link href="/constructor" className="rounded-full bg-ink px-4 py-2 font-medium text-alu hover:bg-ink-2">
            Создать дизайн
          </Link>
        </nav>
      </div>
    </header>
  );
}
