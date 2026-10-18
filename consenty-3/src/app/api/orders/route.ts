import { StorageUnavailableError } from "@/server/storage";
import { enforceRateLimit, handleRouteError, jsonError, readJson } from "@/server/http";
import { createOrder, notifyOrder } from "@/server/orders";
import { notifyDeps, orderDeps } from "@/server/deps";
import { createOrderSchema, zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "orders", 10, 10 * 60 * 1000);
  if (limited) return limited;
  try {
    const parsed = createOrderSchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, zodMessage(parsed.error), "validation");

    const { order, created } = await createOrder(parsed.data, orderDeps());
    // Повторный запрос с тем же ключом не создаёт новый заказ;
    // уведомление досылается, только если в прошлый раз не дошло.
    const notification =
      order.notification.status === "sent" ? order.notification : await notifyOrder(order, notifyDeps());

    return Response.json(
      {
        ok: true,
        orderId: order.id,
        createdAt: order.createdAt,
        total: order.price.total,
        duplicate: !created,
        notification: { status: notification.status, error: notification.status === "sent" ? undefined : notification.lastError },
      },
      { status: created ? 201 : 200 },
    );
  } catch (e) {
    if (e instanceof StorageUnavailableError) return jsonError(503, e.message, "storage_unavailable");
    return handleRouteError(e);
  }
}
