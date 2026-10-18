import { readFile } from "node:fs/promises";
import { getSigningSecret, getStorageMode } from "@/server/env";
import { jsonError } from "@/server/http";
import { safeEqualHex } from "@/server/signing";
import { getStorage } from "@/server/storage";
import { LocalStorage, localDownloadSignature } from "@/server/storage/local";

export const runtime = "nodejs";

/** Выдача приватного файла из локального хранилища по временной подписанной ссылке. */
export async function GET(req: Request) {
  if (getStorageMode() !== "local") return jsonError(404, "Not found");
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const exp = Number(url.searchParams.get("exp"));
  const dl = url.searchParams.get("dl") ?? "";
  const sig = url.searchParams.get("sig") ?? "";
  if (!safeEqualHex(sig, localDownloadSignature(getSigningSecret(), key, exp, dl))) return jsonError(403, "Недействительная ссылка");
  if (exp * 1000 < Date.now()) return jsonError(403, "Срок действия ссылки истёк");

  const storage = getStorage() as LocalStorage;
  const info = await storage.head(key);
  if (!info) return jsonError(404, "Файл не найден");
  const data = await readFile(storage.path(key));
  const headers: Record<string, string> = {
    "Content-Type": info.contentType ?? "application/octet-stream",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (dl) headers["Content-Disposition"] = `attachment; filename="${dl.replace(/[^\w.\-]/g, "_")}"`;
  return new Response(new Uint8Array(data), { headers });
}
