import type { ObjectInfo, StorageDriver } from "@/server/storage/types";

/** Хранилище в памяти для тестов (с атомарной условной записью, как в S3). */
export class MemoryStorage implements StorageDriver {
  readonly kind = "local" as const;
  files = new Map<string, { data: Uint8Array; contentType: string; mtime: Date }>();

  async presignPut(key: string, contentType: string) {
    return { url: `memory://${key}`, headers: { "Content-Type": contentType } };
  }
  async presignGet(key: string) {
    return `https://files.example/${key}?sig=test`;
  }
  put(key: string, data: Uint8Array, contentType: string, mtime = new Date()) {
    this.files.set(key, { data, contentType, mtime });
  }
  async head(key: string): Promise<ObjectInfo | null> {
    const f = this.files.get(key);
    return f ? { key, size: f.data.byteLength, contentType: f.contentType, lastModified: f.mtime } : null;
  }
  async readHead(key: string, bytes: number) {
    return this.files.get(key)!.data.subarray(0, bytes);
  }
  async getBuffer(key: string) {
    const f = this.files.get(key);
    if (!f) throw new Error(`missing ${key}`);
    return f.data;
  }
  async putJson(key: string, data: unknown, opts?: { ifNoneMatch?: boolean }) {
    if (opts?.ifNoneMatch && this.files.has(key)) return false;
    this.put(key, new TextEncoder().encode(JSON.stringify(data)), "application/json");
    return true;
  }
  async getJson<T>(key: string) {
    const f = this.files.get(key);
    return f ? (JSON.parse(new TextDecoder().decode(f.data)) as T) : null;
  }
  async copy(src: string, dst: string) {
    const f = this.files.get(src);
    if (!f) throw new Error(`missing ${src}`);
    this.files.set(dst, { ...f });
  }
  async delete(keys: string[]) {
    keys.forEach((k) => this.files.delete(k));
  }
  async list(prefix: string) {
    return [...this.files.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([key, f]) => ({ key, size: f.data.byteLength, lastModified: f.mtime }));
  }
}

export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 1, 2, 3]);
export const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 1, 1, 1]);
export const FAKE_BYTES = new TextEncoder().encode("<script>alert(1)</script>");

export const SECRET = "test-secret-".padEnd(48, "x");

export function fakeTelegram() {
  const calls: { method: string; arg?: unknown }[] = [];
  let failOn: string | null = null;
  const make =
    (method: string) =>
    async (arg?: unknown) => {
      if (failOn === method) {
        failOn = null;
        throw new Error(`Telegram: ${method} failed`);
      }
      calls.push({ method, arg });
      return { message_id: calls.length };
    };
  return {
    calls,
    failNext(method: string) {
      failOn = method;
    },
    client: {
      sendMessage: make("sendMessage"),
      sendPhoto: make("sendPhoto"),
      sendMediaGroup: make("sendMediaGroup"),
      sendDocument: make("sendDocument"),
    } as never,
  };
}
