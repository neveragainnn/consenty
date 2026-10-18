import { getTmpTtlHours } from "@/server/env";
import { handleRouteError, jsonError } from "@/server/http";
import { cleanupTemporaryFiles } from "@/server/orders";
import { safeEqualHex, sha256Hex } from "@/server/signing";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Очистка временных загрузок (tmp/), которые не стали заказами.
 * Вызывается Vercel Cron (см. vercel.json) с заголовком Authorization: Bearer $CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return jsonError(503, "CRON_SECRET не задан");
  const auth = req.headers.get("authorization") ?? "";
  if (!safeEqualHex(sha256Hex(auth), sha256Hex(`Bearer ${secret}`))) return jsonError(401, "Unauthorized");
  try {
    const result = await cleanupTemporaryFiles(getStorage(), getTmpTtlHours());
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return handleRouteError(e);
  }
}
