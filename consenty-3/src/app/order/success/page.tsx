import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrderSuccess } from "@/components/checkout/OrderResult";

export const metadata: Metadata = { title: "Макет отправлен", robots: { index: false } };

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ id?: string; n?: string }> }) {
  const { id, n } = await searchParams;
  if (!id || !/^[A-HJ-NP-Z2-9]{5}$/.test(id)) redirect("/");
  return <OrderSuccess id={id} notification={n ?? "sent"} />;
}
