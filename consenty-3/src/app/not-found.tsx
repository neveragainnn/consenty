import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-4xl">Страница не найдена</h1>
      <p className="mt-3 text-steel">Проверьте адрес или начните с конструктора.</p>
      <Link href="/constructor" className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 font-medium text-alu">
        Открыть конструктор
      </Link>
    </div>
  );
}
