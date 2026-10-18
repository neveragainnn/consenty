import { z } from "zod";
import { getSigningSecret, getTelegramConfig } from "@/server/env";
import { enforceRateLimit, handleRouteError, jsonError, readJson } from "@/server/http";
import { startDirectOrder } from "@/server/direct";
import { createTelegramClient } from "@/server/telegram";
import { customerSchema, sideSchema, zodMessage } from "@/lib/validation";
import { MAX_COMMENT_LENGTH } from "@/config/limits";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  idempotencyKey: z.string().uuid(),
  productId: z.string().max(64),
  variantId: z.string().max(64),
  sides: z.array(sideSchema).min(1).max(3),
  customer: customerSchema.pick({ name: true }),
  comment: z.string().trim().max(MAX_COMMENT_LENGTH, "Комментарий слишком длинный").optional().default(""),
  website: z.string().max(0).optional(),
});

/** Начало отправки макета: код + сообщение в Telegram. */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "send-start", 12, 10 * 60 * 1000);
  if (limited) return limited;
  try {
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, zodMessage(parsed.error), "validation");
    const cfg = getTelegramConfig();
    const result = await startDirectOrder(parsed.data, { secret: getSigningSecret(), telegram: cfg ? createTelegramClient(cfg) : null });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return handleRouteError(e);
  }
}
