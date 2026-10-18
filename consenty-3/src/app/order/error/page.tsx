import type { Metadata } from "next";
import { OrderError } from "@/components/checkout/OrderResult";

export const metadata: Metadata = { title: "Ошибка отправки заказа", robots: { index: false } };

export default async function ErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string; id?: string; msg?: string }> }) {
  const { reason = "submit", id, msg } = await searchParams;
  const safeId = id && /^[A-HJ-NP-Z2-9]{5}$/.test(id) ? id : undefined;
  return <OrderError reason={reason} id={safeId} msg={msg?.slice(0, 300)} />;
}
