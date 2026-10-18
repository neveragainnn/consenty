import { getSigningSecret, getTelegramConfig } from "@/server/env";
import { enforceRateLimit, handleRouteError, jsonError } from "@/server/http";
import { DIRECT_FILE_LIMIT, sendDirectFile } from "@/server/direct";
import { createTelegramClient } from "@/server/telegram";
import { roleSchema, sideSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Один файл макета → Telegram. */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "send-file", 60, 10 * 60 * 1000);
  if (limited) return limited;
  try {
    if (Number(req.headers.get("content-length") ?? 0) > DIRECT_FILE_LIMIT + 64 * 1024) return jsonError(413, "Файл слишком большой", "too_large");
    const form = await req.formData();
    const role = roleSchema.safeParse(form.get("role"));
    const side = sideSchema.safeParse(form.get("side"));
    const file = form.get("file");
    if (!role.success || !side.success || !(file instanceof Blob)) return jsonError(400, "Некорректный запрос", "validation");
    const cfg = getTelegramConfig();
    await sendDirectFile(
      {
        code: String(form.get("code") ?? ""),
        exp: Number(form.get("exp")),
        token: String(form.get("token") ?? ""),
        role: role.data,
        side: side.data,
        label: form.get("label") ? String(form.get("label")).slice(0, 40) : undefined,
        compressed: form.get("compressed") === "1",
        file: { data: new Uint8Array(await file.arrayBuffer()), type: file.type, name: "file" },
      },
      { secret: getSigningSecret(), telegram: cfg ? createTelegramClient(cfg) : null },
    );
    return Response.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
