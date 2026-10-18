import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = { title: "Отправка макета", robots: { index: false } };

export default function CheckoutPage() {
  return <CheckoutForm />;
}
