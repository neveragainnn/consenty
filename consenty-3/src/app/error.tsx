"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl">Что-то пошло не так</h1>
      <p className="mt-3 text-steel">Страница не загрузилась из-за ошибки. Попробуйте ещё раз.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-full bg-ink px-6 py-3 font-medium text-alu">
        Обновить
      </button>
    </div>
  );
}
