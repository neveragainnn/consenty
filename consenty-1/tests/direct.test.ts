import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fileToken, orderCodeFor, sendDirectFile, startDirectOrder } from "@/server/direct";
import { fakeTelegram, FAKE_BYTES, JPEG_BYTES, PNG_BYTES, SECRET } from "./helpers";

const start = (key = randomUUID(), telegram: unknown = fakeTelegram().client) =>
  startDirectOrder(
    { idempotencyKey: key, productId: "bic", variantId: "black", sides: ["front", "back"], customer: { name: "Иван Авито" }, comment: "<b>ярче</b>" },
    { secret: SECRET, telegram: telegram as never },
  );

describe("отправка макета прямо в Telegram", () => {
  it("код короткий и одинаковый при повторе той же отправки", async () => {
    const key = randomUUID();
    expect(orderCodeFor(SECRET, key)).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    expect(orderCodeFor(SECRET, key)).toBe(orderCodeFor(SECRET, key));
    expect(orderCodeFor(SECRET, randomUUID())).not.toBe(orderCodeFor(SECRET, key));
  });

  it("сообщение содержит код, имя на Авито и экранированный комментарий", async () => {
    const tg = fakeTelegram();
    const r = await start(randomUUID(), tg.client);
    expect(r.notification.status).toBe("sent");
    const text = tg.calls[0].arg as string;
    expect(text).toContain(r.code);
    expect(text).toContain("Иван Авито");
    expect(text).toContain("&lt;b&gt;ярче&lt;/b&gt;");
  });

  it("без Telegram — честный статус disabled", async () => {
    const r = await start(randomUUID(), null);
    expect(r.notification.status).toBe("disabled");
  });

  it("превью уходит фото, печать и оригинал — документами, с кодом в подписи", async () => {
    const tg = fakeTelegram();
    const r = await start(randomUUID(), tg.client);
    const base = { code: r.code, exp: r.exp, token: r.token };
    await sendDirectFile({ ...base, role: "preview", side: "front", label: "Спереди", file: { data: PNG_BYTES, type: "image/png", name: "p" } }, { secret: SECRET, telegram: tg.client });
    await sendDirectFile({ ...base, role: "print", side: "wrap", file: { data: PNG_BYTES, type: "image/png", name: "p" } }, { secret: SECRET, telegram: tg.client });
    await sendDirectFile({ ...base, role: "original", side: "front", file: { data: JPEG_BYTES, type: "image/jpeg", name: "o" } }, { secret: SECRET, telegram: tg.client });
    expect(tg.calls.map((c) => c.method)).toEqual(["sendMessage", "sendPhoto", "sendDocument", "sendDocument"]);
  });

  it("отклоняет чужой токен, просроченную отправку и не-изображения", async () => {
    const tg = fakeTelegram();
    const r = await start(randomUUID(), tg.client);
    const deps = { secret: SECRET, telegram: tg.client };
    const file = { data: PNG_BYTES, type: "image/png", name: "p" };
    await expect(sendDirectFile({ code: r.code, exp: r.exp, token: "0".repeat(64), role: "print", side: "front", file }, deps)).rejects.toThrow(/Недействительная/);
    const old = Math.floor(Date.now() / 1000) - 10;
    await expect(sendDirectFile({ code: r.code, exp: old, token: fileToken(SECRET, r.code, old), role: "print", side: "front", file }, deps)).rejects.toThrow(/истекло/);
    await expect(
      sendDirectFile({ ...{ code: r.code, exp: r.exp, token: r.token }, role: "print", side: "front", file: { data: FAKE_BYTES, type: "image/png", name: "x" } }, deps),
    ).rejects.toThrow(/не является изображением/);
    // файл печати — только PNG
    await expect(
      sendDirectFile({ ...{ code: r.code, exp: r.exp, token: r.token }, role: "print", side: "front", file: { data: JPEG_BYTES, type: "image/jpeg", name: "x" } }, deps),
    ).rejects.toThrow(/формат/i);
  });
});
