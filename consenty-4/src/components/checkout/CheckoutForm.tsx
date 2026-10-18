"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { MAX_COMMENT_LENGTH } from "@/config/limits";
import { getProduct, getVariant } from "@/config/products";
import { useEditor } from "@/lib/design/store";
import { OrderSubmitError, submitOrder } from "@/lib/order-client";
import { SIDE_LABEL } from "@/lib/types";
import { customerSchema } from "@/lib/validation";
import { Button } from "../ui/Button";
import { DevNotice } from "./DevNotice";

type Errors = Partial<Record<"name" | "comment" | "form", string>>;

const STAGE_TEXT = { upload: "Готовим загрузку…", files: "Загружаем файлы", order: "Отправляем макет…" } as const;

/**
 * Отправка макета продавцу. Заказ и переписка — на Авито, поэтому здесь
 * только имя из профиля Авито и комментарий. После отправки покупатель
 * получает короткий код и пересылает его продавцу в чате Авито.
 */
export function CheckoutForm() {
  const router = useRouter();
  const exported = useEditor((s) => s.exported);
  const setExported = useEditor((s) => s.setExported);
  const setLastOrder = useEditor((s) => s.setLastOrder);

  const product = exported ? getProduct(exported.productId) : undefined;
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [stage, setStage] = useState<string | null>(null);
  const submitting = useRef(false);

  if (!exported || !product) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <h1 className="font-display text-3xl">Сначала соберите дизайн</h1>
        <p className="mt-3 text-steel">Здесь появится ваш макет, когда вы нажмёте «Отправить макет продавцу» в конструкторе.</p>
        <Link href="/constructor" className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 font-medium text-alu">
          Открыть конструктор
        </Link>
      </div>
    );
  }

  const variant = getVariant(product, exported.variantId);

  const validate = (): boolean => {
    const next: Errors = {};
    const r = customerSchema.safeParse({ name });
    if (!r.success) for (const i of r.error.issues) next[i.path[0] as "name"] ??= i.message;
    if (comment.length > MAX_COMMENT_LENGTH) next.comment = "Комментарий слишком длинный";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return; // защита от двойного нажатия
    if (!validate()) return;
    submitting.current = true;
    setErrors({});
    try {
      const res = await submitOrder(exported, { name, comment, website }, (st, detail) =>
        setStage(`${STAGE_TEXT[st]}${detail ? ` (${detail})` : ""}`),
      );
      setLastOrder({
        orderId: res.orderId,
        idempotencyKey: exported.idempotencyKey,
        notification: res.notification,
        previewUrls: exported.previews.map((p) => p.url),
        productId: product.id,
      });
      setExported(null);
      const q = new URLSearchParams({ id: res.orderId });
      if (res.notification.status === "failed") {
        q.set("reason", "notify");
        router.replace(`/order/error?${q}`);
      } else {
        q.set("n", res.notification.status);
        router.replace(`/order/success?${q}`);
      }
    } catch (err) {
      const msg = err instanceof OrderSubmitError ? err.message : "Не удалось отправить макет.";
      if (err instanceof OrderSubmitError && (err.code === "validation" || err.code === "invalid_product")) {
        setErrors({ form: msg });
      } else {
        router.push(`/order/error?${new URLSearchParams({ reason: "submit", msg })}`);
      }
      submitting.current = false;
      setStage(null);
    }
  };

  const field = "mt-1 w-full rounded-xl border bg-white/60 px-4 py-3 outline-none transition focus:border-ink";

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-8 sm:px-6 lg:grid-cols-[1fr_440px]">
      <section>
        <h1 className="font-display text-3xl sm:text-4xl">Отправка макета</h1>
        <p className="mt-2 text-steel">
          {product.name}, {variant.name.toLowerCase()} — {exported.sides.map((s) => SIDE_LABEL[s].toLowerCase()).join(", ")}
        </p>
        <div className={`mt-6 grid gap-4 ${exported.previews.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {exported.previews.map((p) => (
            <figure key={p.url} className="overflow-hidden rounded-[22px] bg-alu-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Превью: ${p.label}`} className="aspect-square w-full object-cover" />
              <figcaption className="px-4 py-3 text-sm text-steel">{p.label}</figcaption>
            </figure>
          ))}
        </div>
        <Link href="/constructor" className="mt-4 inline-block text-sm underline underline-offset-4 hover:text-signal-ink">
          Вернуться к редактированию
        </Link>
      </section>

      <form onSubmit={onSubmit} noValidate className="h-fit space-y-5 rounded-[24px] bg-alu-2/70 p-5 sm:p-6">
        <DevNotice />
        <div className="rounded-xl bg-white/50 px-4 py-3 text-sm text-ink-2">
          Заказ оформляется на Авито. Здесь вы отправляете продавцу готовый макет — после отправки получите короткий код,
          который нужно прислать продавцу в чате Авито.
        </div>
        <label className="block">
          <span className="text-sm font-medium">Ваше имя на Авито</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Как вы подписаны в профиле Авито"
            autoComplete="name"
            className={`${field} ${errors.name ? "border-danger" : "border-ink/20"}`}
            aria-invalid={!!errors.name}
          />
          {errors.name && <span className="mt-1 block text-sm text-danger">{errors.name}</span>}
        </label>
        <label className="block">
          <span className="text-sm font-medium">Комментарий к макету</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={MAX_COMMENT_LENGTH}
            placeholder="Например: сделать фото чуть ярче, текст по центру"
            className={`${field} resize-none border-ink/20`}
          />
        </label>
        {/* Поле-ловушка для ботов */}
        <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />

        {errors.form && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{errors.form}</p>}

        <Button type="submit" variant="signal" size="lg" className="w-full" disabled={stage !== null}>
          {stage ?? "Отправить макет продавцу"}
        </Button>
        <p className="text-xs text-steel">Нажимая кнопку, вы соглашаетесь на передачу макета, фото и имени продавцу для выполнения заказа.</p>
      </form>
    </div>
  );
}
