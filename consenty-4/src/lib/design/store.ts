"use client";

import { create } from "zustand";
import type { FileRole } from "@/config/limits";
import type { DesignState, ImageAsset, SideDesign, SideId, WrapMode } from "../types";

/** Файл, который уходит в заказ: макет печати, превью или оригинал фото. */
export interface ExportedFile {
  role: FileRole;
  side: SideId;
  blob: Blob;
  /** Подпись ракурса для превью. */
  label?: string;
}

export interface ExportedDesign {
  productId: string;
  variantId: string;
  /** Стороны с дизайном (для подписи в заказе). */
  sides: SideId[];
  files: ExportedFile[];
  previews: { url: string; label: string }[];
  /** Ключ идемпотентности заказа: один на один вариант дизайна. */
  idempotencyKey: string;
  createdAt: number;
}

export interface LastOrder {
  orderId: string;
  idempotencyKey: string;
  notification: { status: string; error?: string };
  previewUrls: string[];
  productId: string;
}

export const emptySide = (): SideDesign => ({ image: null, texts: [] });
export const emptyDesign = (): DesignState => ({ front: emptySide(), back: emptySide(), wrap: emptySide() });

const HISTORY_LIMIT = 60;

interface EditorState {
  productId: string;
  variantId: string;
  activeSide: SideId;
  /** Режим раскладки для товаров с принтом по кругу. */
  wrapMode: WrapMode;
  selectedId: string | null;

  /** Текущий дизайн (в т.ч. промежуточные состояния во время перетаскивания). */
  design: DesignState;
  /** Последнее зафиксированное состояние — точка отсчёта для undo. */
  committed: DesignState;
  past: DesignState[];
  future: DesignState[];

  assets: Record<string, ImageAsset>;
  /** Фото, выбранное на главной странице — подхватывается конструктором. */
  pendingFile: File | null;
  exported: ExportedDesign | null;
  lastOrder: LastOrder | null;
  /** Сохранять пропорции фото при масштабировании. */
  lockRatio: boolean;
  setLockRatio(v: boolean): void;

  setProduct(productId: string, variantId: string): void;
  setVariant(variantId: string): void;
  setActiveSide(side: SideId): void;
  setWrapMode(mode: WrapMode, firstSide: SideId): void;
  select(id: string | null): void;
  /** Промежуточное изменение без записи в историю. */
  update(fn: (d: DesignState) => DesignState): void;
  /** Фиксирует текущее состояние в истории. */
  commit(): void;
  /** Изменение + фиксация. */
  apply(fn: (d: DesignState) => DesignState): void;
  undo(): void;
  redo(): void;
  addAsset(asset: ImageAsset): void;
  setPendingFile(file: File | null): void;
  setExported(e: ExportedDesign | null): void;
  setLastOrder(o: LastOrder | null): void;
}

export const updateSide = (side: SideId, fn: (s: SideDesign) => SideDesign) => (d: DesignState): DesignState => ({
  ...d,
  [side]: fn(d[side]),
});

export const useEditor = create<EditorState>()((set, get) => ({
  productId: "cardholder",
  variantId: "",
  activeSide: "front",
  wrapMode: "two",
  selectedId: null,
  design: emptyDesign(),
  committed: emptyDesign(),
  past: [],
  future: [],
  assets: {},
  pendingFile: null,
  exported: null,
  lastOrder: null,
  lockRatio: true,
  setLockRatio(v) {
    set({ lockRatio: v });
  },

  setProduct(productId, variantId) {
    const fresh = emptyDesign();
    set({ productId, variantId, design: fresh, committed: fresh, past: [], future: [], selectedId: null, activeSide: "front", wrapMode: "two", exported: null });
  },
  setVariant(variantId) {
    set({ variantId, exported: null });
  },
  setActiveSide(side) {
    set({ activeSide: side, selectedId: null });
  },
  setWrapMode(mode, firstSide) {
    // дизайны обоих режимов хранятся отдельно — переключение ничего не стирает
    set({ wrapMode: mode, activeSide: firstSide, selectedId: null, exported: null });
  },
  select(id) {
    set({ selectedId: id });
  },
  update(fn) {
    set((s) => ({ design: fn(s.design) }));
  },
  commit() {
    const s = get();
    if (s.design === s.committed) return;
    set({ past: [...s.past, s.committed].slice(-HISTORY_LIMIT), committed: s.design, future: [], exported: null });
  },
  apply(fn) {
    get().update(fn);
    get().commit();
  },
  undo() {
    const s = get();
    let past = s.past;
    let committed = s.committed;
    if (s.design !== committed) {
      past = [...past, committed];
      committed = s.design;
    }
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({ past: past.slice(0, -1), future: [committed, ...s.future], design: prev, committed: prev, exported: null });
  },
  redo() {
    const s = get();
    if (!s.future.length) return;
    const next = s.future[0];
    set({ past: [...s.past, s.committed], future: s.future.slice(1), design: next, committed: next, exported: null });
  },
  addAsset(asset) {
    set((s) => ({ assets: { ...s.assets, [asset.id]: asset } }));
  },
  setPendingFile(file) {
    set({ pendingFile: file });
  },
  setExported(e) {
    set({ exported: e });
  },
  setLastOrder(o) {
    set({ lastOrder: o });
  },
}));

export const sideHasContent = (s: SideDesign) => Boolean(s.image) || s.texts.some((t) => t.text.trim().length > 0);

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
