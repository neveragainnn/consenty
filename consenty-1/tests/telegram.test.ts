import { describe, expect, it, vi } from "vitest";
import { createTelegramClient, TelegramError } from "@/server/telegram";

const cfg = { token: "123:ABC", chatId: "42", timeoutMs: 50, maxAttempts: 3 };
const ok = (result: unknown = { message_id: 1 }) => new Response(JSON.stringify({ ok: true, result }), { status: 200 });

describe("клиент Telegram", () => {
  it("повторяет при 429 с учётом retry_after", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, description: "Too Many Requests", parameters: { retry_after: 2 } }), { status: 429 }))
      .mockResolvedValueOnce(ok());
    const sleep = vi.fn().mockResolvedValue(undefined);
    const tg = createTelegramClient(cfg, fetchMock as never, sleep);
    await expect(tg.sendMessage("hi")).resolves.toEqual({ message_id: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("не повторяет при ошибке клиента (400) и не раскрывает токен", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, description: "Bad Request: chat not found" }), { status: 400 }));
    const tg = createTelegramClient(cfg, fetchMock as never, async () => undefined);
    const err = await tg.sendMessage("hi").catch((e) => e);
    expect(err).toBeInstanceOf(TelegramError);
    expect(err.message).toContain("chat not found");
    expect(err.message).not.toContain(cfg.token);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("обрабатывает тайм-аут и сдаётся после maxAttempts", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.reject(Object.assign(new Error("timeout"), { name: "TimeoutError" })));
    const tg = createTelegramClient(cfg, fetchMock as never, async () => undefined);
    await expect(tg.sendMessage("hi")).rejects.toThrow(/Тайм-аут/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("отправляет фото как multipart с chat_id и caption", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    const tg = createTelegramClient(cfg, fetchMock as never);
    await tg.sendPhoto({ data: new Uint8Array([1, 2, 3]), filename: "p.png", contentType: "image/png" }, "Заказ");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot123:ABC/sendPhoto");
    const body = init.body as FormData;
    expect(body.get("chat_id")).toBe("42");
    expect(body.get("caption")).toBe("Заказ");
    expect(body.get("photo")).toBeInstanceOf(Blob);
  });
});
