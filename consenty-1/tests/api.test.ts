import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareUploads } from "@/server/orders";
import { resetRateLimits } from "@/server/rate-limit";
import { fakeTelegram, JPEG_BYTES, MemoryStorage, PNG_BYTES, SECRET } from "./helpers";

const ctx = vi.hoisted(() => ({ storage: null as unknown, telegram: null as unknown }));

vi.mock("@/server/deps", () => ({
  orderDeps: () => ({ storage: ctx.storage, secret: SECRET }),
  notifyDeps: () => ({ storage: ctx.storage, telegram: ctx.telegram, linkTtlSec: 3600 }),
}));
vi.mock("@/server/storage", () => ({
  getStorage: () => ctx.storage,
  StorageUnavailableError: class extends Error {},
}));

const { POST: createOrderRoute } = await import("@/app/api/orders/route");
const { POST: notifyRoute } = await import("@/app/api/orders/[id]/notify/route");

async function preparedBody(storage: MemoryStorage, key = randomUUID()) {
  const prep = await prepareUploads(
    {
      idempotencyKey: key,
      files: [
        { role: "print", side: "front", contentType: "image/png", size: 100 },
        { role: "preview", side: "front", contentType: "image/png", size: 100 },
        { role: "print", side: "back", contentType: "image/png", size: 100 },
        { role: "preview", side: "back", contentType: "image/png", size: 100 },
        { role: "original", side: "front", contentType: "image/jpeg", size: 100 },
      ],
    },
    { storage, secret: SECRET },
  );
  for (const f of prep.files) storage.put(f.key, f.role === "original" ? JPEG_BYTES : PNG_BYTES, f.headers["Content-Type"]);
  return {
    idempotencyKey: key,
    upload: { uploadId: prep.uploadId, expiresAt: prep.expiresAt, ticket: prep.ticket, files: prep.files.map(({ role, side, key }) => ({ role, side, key })) },
    productId: "lighter",
    variantId: "chrome",
    quantity: 2,
    customer: { name: "Мария", contact: "+7 900 123 45 67" },
    comment: "",
    // Клиент пытается подсунуть цену — сервер её игнорирует
    price: 1,
  };
}

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}`, ...headers },
    body: JSON.stringify(body),
  });

describe("POST /api/orders", () => {
  let storage: MemoryStorage;
  let tg: ReturnType<typeof fakeTelegram>;
  beforeEach(() => {
    resetRateLimits();
    storage = new MemoryStorage();
    tg = fakeTelegram();
    ctx.storage = storage;
    ctx.telegram = tg.client;
  });

  it("создаёт заказ и отправляет уведомление один раз даже при повторе запроса", async () => {
    const body = await preparedBody(storage);
    const r1 = await createOrderRoute(req(body));
    expect(r1.status).toBe(201);
    const j1 = await r1.json();
    expect(j1.notification.status).toBe("sent");
    expect(j1.total).toBeGreaterThan(1);
    // две стороны → медиагруппа, текст, два файла печати и оригинал фото
    expect(tg.calls.map((c) => c.method)).toEqual(["sendMediaGroup", "sendMessage", "sendDocument", "sendDocument", "sendDocument"]);

    const r2 = await createOrderRoute(req(body));
    expect(r2.status).toBe(200);
    const j2 = await r2.json();
    expect(j2.orderId).toBe(j1.orderId);
    expect(j2.duplicate).toBe(true);
    expect(tg.calls).toHaveLength(5);
  });

  it("сообщает о демо-режиме, если Telegram не настроен", async () => {
    ctx.telegram = null;
    const r = await createOrderRoute(req(await preparedBody(storage)));
    const j = await r.json();
    expect(r.status).toBe(201);
    expect(j.notification.status).toBe("disabled");
    expect(j.notification.error).toMatch(/TELEGRAM_BOT_TOKEN/);
  });

  it("возвращает failed, если Telegram недоступен, а повтор через /notify досылает", async () => {
    tg.failNext("sendMediaGroup");
    const body = await preparedBody(storage);
    const j = await (await createOrderRoute(req(body))).json();
    expect(j.notification.status).toBe("failed");

    const bad = await notifyRoute(req({}, { "x-idempotency-key": randomUUID() }), { params: Promise.resolve({ id: j.orderId }) });
    expect(bad.status).toBe(404);

    const good = await notifyRoute(req({}, { "x-idempotency-key": body.idempotencyKey }), { params: Promise.resolve({ id: j.orderId }) });
    expect((await good.json()).notification.status).toBe("sent");
  });

  it("валидирует обязательные поля", async () => {
    const body = await preparedBody(storage);
    body.customer.contact = "не контакт";
    const r = await createOrderRoute(req(body));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/Telegram|телефон/);
  });

  it("ограничивает частоту запросов", async () => {
    const body = { broken: true };
    let last: Response | null = null;
    for (let i = 0; i < 11; i++) last = await createOrderRoute(req(body, { "x-forwarded-for": "1.2.3.4" }));
    expect(last!.status).toBe(429);
  });
});
