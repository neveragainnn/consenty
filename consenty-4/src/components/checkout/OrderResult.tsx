"use client";

import Link from "next/link";
import { useState } from "react";
import { useEditor } from "@/lib/design/store";
import { OrderSubmitError, retryNotification } from "@/lib/order-client";
import { Button } from "../ui/Button";

export function OrderSuccess({ id, notification }: { id: string; notification: string }) {
  const last = useEditor((s) => s.lastOrder);
  const previews = last?.orderId === id ? last.previewUrls : [];
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* буфер обмена недоступен — код виден на экране */
    }
  };
  return (
    <div className="mx-auto max-w-3xl px-4 pt-14 sm:px-6">
      <p className="text-sm text-ok">Макет отправлен продавцу</p>
      <h1 className="mt-2 font-display text-3xl sm:text-4xl">Ваш код макета</h1>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <span className="rounded-2xl bg-ink px-6 py-4 font-display text-4xl tracking-[0.18em] text-alu sm:text-5xl" aria-label={`Код ${id.split("").join(" ")}`}>
          {id}
        </span>
        <Button variant="outline" size="lg" onClick={copy}>
          {copied ? "Скопировано" : "Скопировать код"}
        </Button>
      </div>
      <p className="mt-6 max-w-[52ch] text-lg text-ink-2">
        <b>Отправьте этот код продавцу в чате Авито</b> — по нему продавец найдёт ваш макет. Сохраните код, пока не получите ответ.
      </p>
      {notification === "disabled" && (
        <div className="mt-6 rounded-xl border border-dashed border-ink/30 bg-white/40 px-4 py-3 text-sm">
          <p className="font-medium">Для владельца сайта: уведомление в Telegram не отправлено</p>
          <p className="mt-1 text-ink-2">
            Telegram-бот не настроен, поэтому макет никуда не отправлен. Добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID — инструкция в README.
          </p>
        </div>
      )}
      {previews.length > 0 && (
        <div className={`mt-8 grid gap-4 ${previews.length > 1 ? "sm:grid-cols-2" : "max-w-md"}`}>
          {previews.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="Превью макета" className="aspect-square w-full rounded-[22px] object-cover" />
          ))}
        </div>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/constructor" className="rounded-full bg-ink px-6 py-3 font-medium text-alu">
          Сделать ещё один макет
        </Link>
      </div>
    </div>
  );
}

export function OrderError({ reason, id, msg }: { reason: string; id?: string; msg?: string }) {
  const last = useEditor((s) => s.lastOrder);
  const setLastOrder = useEditor((s) => s.setLastOrder);
  const hasDesign = useEditor((s) => Boolean(s.exported));
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const canRetryNotify = reason === "notify" && id && last?.orderId === id;

  const retry = async () => {
    if (!last || state === "busy") return;
    setState("busy");
    setError(null);
    try {
      const r = await retryNotification(last.orderId, last.idempotencyKey);
      setLastOrder({ ...last, notification: r.notification });
      if (r.notification.status === "sent") setState("done");
      else {
        setState("error");
        setError(r.notification.error ?? "Уведомление снова не отправлено.");
      }
    } catch (e) {
      setState("error");
      setError(e instanceof OrderSubmitError ? e.message : "Не удалось связаться с сервером.");
    }
  };

  if (reason === "notify") {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-14 sm:px-6">
        <p className="text-sm text-signal-ink">Макет сохранён, но уведомление продавцу не дошло</p>
        <h1 className="mt-2 font-display text-4xl">Код макета: {id}</h1>
        <p className="mt-4 max-w-[56ch] text-lg text-ink-2">
          Макет и файлы сохранены. Продавец пока не получил уведомление — повторите отправку. Повтор не создаст второй макет. Код всё равно отправьте продавцу в чате Авито.
        </p>
        {state === "done" ? (
          <p className="mt-6 rounded-xl bg-ok/10 px-4 py-3 text-ok">Готово, продавец получил макет. Отправьте код {id} в чате Авито.</p>
        ) : (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {canRetryNotify && (
              <Button variant="signal" size="lg" onClick={retry} disabled={state === "busy"}>
                {state === "busy" ? "Отправляем…" : "Повторить отправку"}
              </Button>
            )}
            <Link href="/" className="rounded-full border border-ink/25 px-6 py-3 font-medium">
              На главную
            </Link>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <p className="mt-6 text-sm text-steel">Если повтор не помогает — напишите продавцу на Авито и назовите код макета.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-14 sm:px-6">
      <p className="text-sm text-danger">Макет не отправлен</p>
      <h1 className="mt-2 font-display text-4xl">Не получилось отправить макет</h1>
      <p className="mt-4 max-w-[56ch] text-lg text-ink-2">{msg || "Произошла ошибка при отправке."}</p>
      <p className="mt-2 max-w-[56ch] text-steel">
        Дизайн сохранён в этой вкладке. Повторная отправка безопасна: если макет на самом деле успел отправиться, второй не появится.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {hasDesign ? (
          <Link href="/checkout" className="rounded-full bg-signal px-6 py-3 font-medium text-ink">
            Вернуться к отправке
          </Link>
        ) : (
          <Link href="/constructor" className="rounded-full bg-ink px-6 py-3 font-medium text-alu">
            Открыть конструктор
          </Link>
        )}
        <Link href="/" className="rounded-full border border-ink/25 px-6 py-3 font-medium">
          На главную
        </Link>
      </div>
    </div>
  );
}
