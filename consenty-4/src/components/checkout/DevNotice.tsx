"use client";

import { useEffect, useState } from "react";

interface Health {
  telegram: "configured" | "not_configured";
  storage: "s3" | "local" | "unavailable";
}

/** Подсказка владельцу сайта, если интеграции не настроены. Секреты не раскрываются. */
export function DevNotice() {
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setH)
      .catch(() => undefined);
  }, []);
  if (!h) return null;
  const items: string[] = [];
  // Макеты отправляются прямо в Telegram, хранилище не требуется
  if (h.telegram === "not_configured")
    items.push("Telegram не настроен — макеты никуда не отправятся. Добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID (см. README).");
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-dashed border-ink/30 bg-white/40 px-4 py-3 text-sm text-ink-2">
      <p className="font-medium">Демо-режим (видно, пока интеграции не настроены)</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
