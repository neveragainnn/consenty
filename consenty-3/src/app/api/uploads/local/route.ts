import { getSigningSecret, getStorageMode } from "@/server/env";
import { jsonError } from "@/server/http";
import { safeEqualHex } from "@/server/signing";
import { getStorage } from "@/server/storage";
import { LocalStorage, localUploadSignature } from "@/server/storage/local";
import { sniffImageMime } from "@/lib/files";

export const runtime = "nodejs";

/**
 * Приём файла в локальное хранилище (режим разработки).
 * Ссылка подписана HMAC и ограничена по времени, типу и размеру — аналог presigned PUT в S3.
 */
export async function PUT(req: Request) {
  if (getStorageMode() !== "local") return jsonError(404, "Not found");
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const ct = url.searchParams.get("ct") ?? "";
  const max = Number(url.searchParams.get("max"));
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";

  const expected = localUploadSignature(getSigningSecret(), key, ct, max, exp);
  if (!safeEqualHex(sig, expected)) return jsonError(403, "Недействительная ссылка загрузки");
  if (exp * 1000 < Date.now()) return jsonError(403, "Ссылка загрузки устарела");
  if (req.headers.get("content-type") !== ct) return jsonError(400, "Неверный Content-Type");
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > max) return jsonError(413, "Файл слишком большой");

  const data = new Uint8Array(await req.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > max) return jsonError(413, "Недопустимый размер файла");
  if (sniffImageMime(data.subarray(0, 16)) !== ct) return jsonError(400, "Содержимое файла не совпадает с типом");

  const storage = getStorage() as LocalStorage;
  await storage.writeBinary(key, data, ct);
  return new Response(null, { status: 200 });
}
