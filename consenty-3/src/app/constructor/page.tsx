import type { Metadata } from "next";
import { ConstructorClient } from "@/components/editor/ConstructorClient";

export const metadata: Metadata = { title: "Конструктор" };

export default async function ConstructorPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product } = await searchParams;
  return (
    <>
      <h1 className="sr-only">Конструктор принта</h1>
      <ConstructorClient productId={product ?? null} />
    </>
  );
}
