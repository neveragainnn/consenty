import { getStorageMode, getTelegramConfig } from "@/server/env";
import { PRODUCTS } from "@/config/products";

export const dynamic = "force-dynamic";

/** Состояние интеграций без раскрытия секретов — для подсказок разработчику в интерфейсе. */
export async function GET() {
  return Response.json({
    telegram: getTelegramConfig() ? "configured" : "not_configured",
    storage: getStorageMode(),
    demoPrices: PRODUCTS.some((p) => p.priceIsDemo),
  });
}
