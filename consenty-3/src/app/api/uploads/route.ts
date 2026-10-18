import { StorageUnavailableError } from "@/server/storage";
import { enforceRateLimit, handleRouteError, jsonError, readJson } from "@/server/http";
import { prepareUploads } from "@/server/orders";
import { orderDeps } from "@/server/deps";
import { uploadRequestSchema, zodMessage } from "@/lib/validation";

export const runtime = "nodejs";

/** Выдаёт подписанные ссылки для прямой загрузки файлов заказа в хранилище. */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "uploads", 20, 10 * 60 * 1000);
  if (limited) return limited;
  try {
    const parsed = uploadRequestSchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, zodMessage(parsed.error), "validation");
    const result = await prepareUploads(parsed.data, orderDeps());
    return Response.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof StorageUnavailableError) return jsonError(503, e.message, "storage_unavailable");
    return handleRouteError(e);
  }
}
