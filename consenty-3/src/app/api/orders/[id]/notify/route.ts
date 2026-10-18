import { enforceRateLimit, handleRouteError, jsonError } from "@/server/http";
import { loadOrder, notifyOrder, ownsOrder } from "@/server/orders";
import { notifyDeps } from "@/server/deps";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Повторная отправка уведомления в Telegram для уже созданного заказа.
 * Доступ — только у того, кто создал заказ (знает ключ идемпотентности).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(req, "notify", 6, 10 * 60 * 1000);
  if (limited) return limited;
  try {
    const { id } = await ctx.params;
    const key = req.headers.get("x-idempotency-key") ?? "";
    const order = await loadOrder(getStorage(), id);
    if (!order || !ownsOrder(order, key)) return jsonError(404, "Заказ не найден");
    const n = await notifyOrder(order, notifyDeps());
    return Response.json({ ok: true, orderId: order.id, notification: { status: n.status, error: n.status === "sent" ? undefined : n.lastError } });
  } catch (e) {
    return handleRouteError(e);
  }
}
