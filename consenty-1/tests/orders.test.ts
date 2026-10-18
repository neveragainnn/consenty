import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { getProduct } from "@/config/products";
import { createOrder, cleanupTemporaryFiles, notifyOrder, prepareUploads } from "@/server/orders";
import type { CreateOrderRequest } from "@/lib/validation";
import { fakeTelegram, FAKE_BYTES, JPEG_BYTES, MemoryStorage, PNG_BYTES, SECRET } from "./helpers";

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
});

async function uploadSet(key = randomUUID(), opts: { fakePrint?: boolean } = {}) {
  const prep = await prepareUploads(
    {
      idempotencyKey: key,
      files: [
        { role: "print", side: "front", contentType: "image/png", size: 1000 },
        { role: "preview", side: "front", contentType: "image/png", size: 1000 },
        { role: "original", side: "front", contentType: "image/jpeg", size: 1000 },
      ],
    },
    { storage, secret: SECRET },
  );
  for (const f of prep.files) {
    const bytes = f.role === "original" ? JPEG_BYTES : opts.fakePrint && f.role === "print" ? FAKE_BYTES : PNG_BYTES;
    storage.put(f.key, bytes, f.headers["Content-Type"]);
  }
  const req: CreateOrderRequest = {
    idempotencyKey: key,
    upload: { uploadId: prep.uploadId, expiresAt: prep.expiresAt, ticket: prep.ticket, files: prep.files.map(({ role, side, key }) => ({ role, side, key })) },
    productId: "cardholder",
    variantId: "silver",
    quantity: 3,
    customer: { name: "Иван", contact: "ivan_test" },
    comment: "Побыстрее, пожалуйста",
  };
  return { prep, req };
}

describe("создание заказа", () => {
  it("создаёт заказ, считает цену на сервере и переносит файлы", async () => {
    const { req } = await uploadSet();
    const { order, created } = await createOrder(req, { storage, secret: SECRET });
    expect(created).toBe(true);
    expect(order.id).toMatch(/^[A-Z2-9]{5}$/);
    expect(order.price.total).toBe(getProduct("cardholder")!.price * 3);
    expect(order.customer.contact).toBe("@ivan_test");
    expect(order.files.every((f) => f.key.startsWith(`orders/${order.id}/`))).toBe(true);
    expect([...storage.files.keys()].some((k) => k.startsWith("tmp/"))).toBe(false);
    expect(await storage.getJson(`orders/${order.id}/order.json`)).toBeTruthy();
  });

  it("повторный запрос с тем же ключом не создаёт дубль", async () => {
    const { req } = await uploadSet();
    const a = await createOrder(req, { storage, secret: SECRET });
    const b = await createOrder(req, { storage, secret: SECRET });
    expect(b.created).toBe(false);
    expect(b.order.id).toBe(a.order.id);
    expect([...storage.files.keys()].filter((k) => k.endsWith("order.json"))).toHaveLength(1);
  });

  it("отклоняет поддельный билет загрузки", async () => {
    const { req } = await uploadSet();
    req.upload.ticket = "0".repeat(64);
    await expect(createOrder(req, { storage, secret: SECRET })).rejects.toThrow(/билет/i);
  });

  it("отклоняет подмену ключа файла", async () => {
    const { req } = await uploadSet();
    req.upload.files[0].key = "orders/other/print-front.png";
    await expect(createOrder(req, { storage, secret: SECRET })).rejects.toThrow();
  });

  it("отклоняет файл, который не является изображением, и освобождает ключ для повтора", async () => {
    const { req, prep } = await uploadSet(randomUUID(), { fakePrint: true });
    await expect(createOrder(req, { storage, secret: SECRET })).rejects.toThrow(/не является изображением/);
    // Клиент перезагружает корректный файл и повторяет с тем же ключом
    storage.put(prep.files[0].key, PNG_BYTES, "image/png");
    const { created } = await createOrder(req, { storage, secret: SECRET });
    expect(created).toBe(true);
  });

  it("отклоняет неизвестный вариант товара", async () => {
    const { req } = await uploadSet();
    req.variantId = "gold";
    await expect(createOrder(req, { storage, secret: SECRET })).rejects.toThrow(/Вариант/);
  });

  it("не принимает файлы с неверным типом на этапе подписи", async () => {
    await expect(
      prepareUploads(
        {
          idempotencyKey: randomUUID(),
          files: [
            { role: "print", side: "front", contentType: "image/jpeg", size: 10 },
            { role: "preview", side: "front", contentType: "image/png", size: 10 },
          ],
        },
        { storage, secret: SECRET },
      ),
    ).rejects.toThrow(/формат/i);
  });
});

describe("Авито: имя без контакта и товар по кругу", () => {
  it("принимает макет только с именем на Авито", async () => {
    const { req } = await uploadSet();
    req.customer = { name: "Иван Авито", contact: "" };
    const { order } = await createOrder(req, { storage, secret: SECRET });
    expect(order.customer.name).toBe("Иван Авито");
    expect(order.customer.contactKind).toBe("none");
  });

  it("BIC: один файл печати по кругу и превью спереди/сзади", async () => {
    const key = randomUUID();
    const prep = await prepareUploads(
      {
        idempotencyKey: key,
        files: [
          { role: "print", side: "wrap", contentType: "image/png", size: 100 },
          { role: "preview", side: "front", contentType: "image/png", size: 100 },
          { role: "preview", side: "back", contentType: "image/png", size: 100 },
          { role: "original", side: "front", contentType: "image/jpeg", size: 100 },
        ],
      },
      { storage, secret: SECRET },
    );
    for (const f of prep.files) storage.put(f.key, f.role === "original" ? JPEG_BYTES : PNG_BYTES, f.headers["Content-Type"]);
    const { order } = await createOrder(
      {
        idempotencyKey: key,
        upload: { uploadId: prep.uploadId, expiresAt: prep.expiresAt, ticket: prep.ticket, files: prep.files.map(({ role, side, key }) => ({ role, side, key })) },
        productId: "bic",
        variantId: "black",
        quantity: 1,
        customer: { name: "Мария", contact: "" },
        comment: "",
      },
      { storage, secret: SECRET },
    );
    expect(order.sides).toEqual(["wrap"]);
    expect(order.files.filter((f) => f.role === "preview")).toHaveLength(2);
  });
});

describe("уведомление в Telegram", () => {
  it("без настроек — статус disabled, без имитации успеха", async () => {
    const { req } = await uploadSet();
    const { order } = await createOrder(req, { storage, secret: SECRET });
    const n = await notifyOrder(order, { storage, telegram: null, linkTtlSec: 3600 });
    expect(n.status).toBe("disabled");
  });

  it("отправляет превью, текст и файл печати; повтор после сбоя не дублирует сообщения", async () => {
    const { req } = await uploadSet();
    const { order } = await createOrder(req, { storage, secret: SECRET });
    const tg = fakeTelegram();
    tg.failNext("sendMessage");
    const first = await notifyOrder(order, { storage, telegram: tg.client, linkTtlSec: 3600 });
    expect(first.status).toBe("failed");
    expect(tg.calls.map((c) => c.method)).toEqual(["sendPhoto"]);

    const second = await notifyOrder(order, { storage, telegram: tg.client, linkTtlSec: 3600 });
    expect(second.status).toBe("sent");
    // файл печати + оригинал фото
    expect(tg.calls.map((c) => c.method)).toEqual(["sendPhoto", "sendMessage", "sendDocument", "sendDocument"]);
    const text = tg.calls[1].arg as string;
    expect(text).toContain(order.id);
    expect(text).toContain("@ivan_test");
    expect(text).toContain("Имя на Авито");
    expect(text).toContain("Макет для печати");
    expect(text).toContain("Оригинал фото");

    // После успешной отправки — ничего повторно
    await notifyOrder(order, { storage, telegram: tg.client, linkTtlSec: 3600 });
    expect(tg.calls).toHaveLength(4);
  });

  it("экранирует HTML в данных покупателя", async () => {
    const { req } = await uploadSet();
    req.comment = "<b>жирный</b> & <script>";
    const { order } = await createOrder(req, { storage, secret: SECRET });
    const tg = fakeTelegram();
    await notifyOrder(order, { storage, telegram: tg.client, linkTtlSec: 3600 });
    const text = tg.calls.find((c) => c.method === "sendMessage")!.arg as string;
    expect(text).toContain("&lt;b&gt;жирный&lt;/b&gt; &amp; &lt;script&gt;");
  });
});

describe("очистка", () => {
  it("удаляет только устаревшие временные файлы", async () => {
    storage.put("tmp/a/print-front.png", PNG_BYTES, "image/png", new Date(Date.now() - 48 * 3600e3));
    storage.put("tmp/b/print-front.png", PNG_BYTES, "image/png", new Date());
    storage.put("orders/x/print-front.png", PNG_BYTES, "image/png", new Date(Date.now() - 48 * 3600e3));
    const r = await cleanupTemporaryFiles(storage, 24);
    expect(r.deleted).toBe(1);
    expect(storage.files.has("tmp/b/print-front.png")).toBe(true);
    expect(storage.files.has("orders/x/print-front.png")).toBe(true);
  });
});
