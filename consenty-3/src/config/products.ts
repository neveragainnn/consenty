/**
 * КАТАЛОГ И MOCKUP.
 *
 * Здесь настраиваются товары, цены, варианты, области печати и mockup.
 * Чтобы добавить товар — добавьте объект в PRODUCTS. Редактор и превью
 * подхватят его автоматически, менять код компонентов не нужно.
 *
 * ⚠️ Все цены и размеры ниже — ДЕМОНСТРАЦИОННЫЕ. Замените на реальные.
 */
import geometry from "./mockup-geometry.json";
import { insetQuad } from "./quad";
import type { Quad, SideId, WrapMode } from "@/lib/types";

export interface PrintSpec {
  /** Размер готового принта (по линии реза), мм. */
  widthMm: number;
  heightMm: number;
  /** Вылеты за линию реза с каждой стороны, мм. */
  bleedMm: number;
  /** Безопасный отступ внутрь от линии реза для текста и важных деталей, мм. */
  safeMm: number;
  /** Скругление углов поверхности, мм (используется для маски превью и направляющих). */
  cornerRadiusMm: number;
  /** Разрешение производственного файла. */
  dpi: number;
  /** true, если размеры ещё не сверены с производством. */
  isDemo: boolean;
}

export interface EditorBackground {
  /** Плоское (фронтальное) изображение товара для редактора. */
  image: string;
  /** Размер всего изображения в мм. */
  imageMm: [number, number];
  /** Где на изображении лежит левый верхний угол области печати (линия реза), мм. */
  trimOffsetMm: [number, number];
}

/**
 * Конфигурация 2D-mockup. `kind` оставлен для будущих рендереров
 * (например, "three" — 3D-просмотр через Three.js).
 */
/** Параметры цилиндрического ракурса (наклейка вокруг корпуса). */
export interface CylinderView {
  cx: number;
  pxPerMm: number;
  stickerTop: number;
  aMm: number;
  bMm: number;
  /** Какая точка обхвата смотрит на зрителя, мм от центра лицевой стороны. */
  viewCenterMm: number;
}

export interface MockupSpec {
  /** quad2d — плоская поверхность в перспективе; cylinder — наклейка вокруг корпуса. */
  kind: "quad2d" | "cylinder";
  cylinder?: CylinderView;
  /** Название ракурса для переключателя в превью («Закрыт», «Открыт»…). */
  label?: string;
  /** Фото/рендер товара — подложка. */
  image: string;
  /** Блики и тени поверх принта (PNG/SVG с прозрачностью). Необязательно. */
  overlay?: string;
  overlayBlend?: GlobalCompositeOperation;
  overlayOpacity?: number;
  /** Затенение (режим «умножение»): тени, линия разъёма крышки поверх принта. */
  shade?: string;
  /**
   * Принт разбит на части, каждая — на свой четырёхугольник (например, у открытой
   * зажигалки верх принта на откинутой крышке, низ — на корпусе).
   * src — доля принта [u0, v0, u1, v1]. Если задано, quad используется только для превью-рамки.
   */
  parts?: { quad: Quad; src: [number, number, number, number] }[];
  /** Маска поверхности: белое — где принт виден. Если не задана — скруглённый четырёхугольник. */
  mask?: string;
  /** Насколько сильно проступает текстура подложки сквозь принт (0–1). */
  materialStrength?: number;
  width: number;
  height: number;
  /** Углы области печати (линия реза) на изображении: TL, TR, BR, BL. */
  quad: Quad;
}

export interface SideSpec {
  label: string;
  print: PrintSpec;
  editor: EditorBackground;
  /** Один или несколько ракурсов превью. Первый — основной: он уходит в заказ и Telegram. */
  mockups: MockupSpec[];
}

export interface ProductVariant {
  id: string;
  name: string;
  swatch: string;
  priceDelta: number;
  /** Подмена изображений для варианта (например, другой цвет корпуса). */
  images?: Partial<Record<SideId, { editor?: string; mockups?: (string | undefined)[] }>>;
}

/** Товар с принтом по кругу корпуса: два режима раскладки. */
export interface WrapConfig {
  /** Полный размер принта по кругу: ширина = обхват, высота. */
  stickerMm: [number, number];
  modes: Record<WrapMode, SideId[]>;
}

export interface ProductConfig {
  id: string;
  wrap?: WrapConfig;
  name: string;
  tagline: string;
  description: string;
  /** Цена за 1 шт. с печатью на одной стороне. */
  price: number;
  /** Доплата за печать на второй стороне (за 1 шт.). */
  secondSidePrice: number;
  priceIsDemo: boolean;
  quantity: { min: number; max: number };
  variants: ProductVariant[];
  sides: Partial<Record<SideId, SideSpec>>;
}

const toQuad = (q: number[][]): Quad => q.map(([x, y]) => ({ x, y })) as Quad;
const g = geometry;
const cf = g.cardholder.flat;
/** Область печати картхолдера на ракурсе: отступ внутри панели корпуса. */
const cardPlate = (body: number[][]) => insetQuad(body, cf.bodyMm, cf.trimMm, cf.trimOffsetMm);

function flatEditor(product: "cardholder" | "lighter", image: string): EditorBackground {
  const f = g[product].flat as { bodyMm: number[]; lidMm?: number; trimOffsetMm: number[] };
  const lid = f.lidMm ?? 0;
  return {
    image,
    imageMm: [f.bodyMm[0], f.bodyMm[1] + lid],
    trimOffsetMm: [f.trimOffsetMm[0], f.trimOffsetMm[1] + lid],
  };
}

/** Размер принта картхолдера: 90 × 59 мм (ширина × высота). */
const cardholderPrint: PrintSpec = {
  widthMm: g.cardholder.flat.trimMm[0],
  heightMm: g.cardholder.flat.trimMm[1],
  bleedMm: 2,
  safeMm: 3,
  cornerRadiusMm: 0, // острые углы принта
  dpi: 300,
  isDemo: false,
};

/** Размер принта металлической зажигалки: 32 × 51 мм (ширина × высота). */
const lighterPrint: PrintSpec = {
  widthMm: g.lighter.flat.trimMm[0],
  heightMm: g.lighter.flat.trimMm[1],
  bleedMm: 2,
  safeMm: 2.5,
  cornerRadiusMm: 0, // острые углы принта
  dpi: 300,
  isDemo: false,
};

/**
 * Ракурсы картхолдера — НАСТОЯЩИЕ фото товара (public/mockups/photo/).
 * shade/gloss — карты освещения, извлечённые из того же фото: принт сохраняет
 * градиенты, шлифовку металла и блики. Пересобрать: scripts/build-photo-mockups.py.
 */
const cp = g.cardholder.photo;
const cardholderMockups = (): MockupSpec[] => [
  {
    kind: "quad2d",
    label: "Закрыт",
    image: "/mockups/photo/cardholder-closed.jpg",
    shade: "/mockups/photo/cardholder-closed-shade.png",
    overlay: "/mockups/photo/cardholder-closed-gloss.png",
    overlayBlend: "screen",
    overlayOpacity: 1,
    width: cp.size,
    height: cp.size,
    quad: toQuad(cp.closed),
  },
  {
    kind: "quad2d",
    label: "Открыт",
    image: "/mockups/photo/cardholder-open.jpg",
    shade: "/mockups/photo/cardholder-open-shade.png",
    overlay: "/mockups/photo/cardholder-open-gloss.png",
    overlayBlend: "screen",
    overlayOpacity: 1,
    width: cp.size,
    height: cp.size,
    quad: toQuad(cp.open),
  },
];
const cardholderEditor: EditorBackground = {
  image: "/mockups/photo/cardholder-editor.jpg",
  imageMm: [cp.editor.imageMm[0], cp.editor.imageMm[1]],
  trimOffsetMm: [cp.editor.trimOffsetMm[0], cp.editor.trimOffsetMm[1]],
};

/**
 * Металлическая зажигалка — НАСТОЯЩИЕ фото товара (закрыта / открыта).
 * Фото узкой модели растянуто по ширине до пропорций принта 32 × 51 мм.
 * В открытом виде верх принта (крышка) лежит на откинутой крышке, низ — на корпусе.
 */
const lp = g.lighter.photo;
const lighterMockups = (): MockupSpec[] => [
  {
    kind: "quad2d",
    label: "Закрыта",
    image: "/mockups/photo/lighter-closed.jpg",
    shade: "/mockups/photo/lighter-closed-shade.png",
    overlay: "/mockups/photo/lighter-closed-gloss.png",
    overlayBlend: "screen",
    overlayOpacity: 1,
    width: lp.size,
    height: lp.size,
    quad: toQuad(lp.closed),
  },
  {
    kind: "quad2d",
    label: "Открыта",
    image: "/mockups/photo/lighter-open.jpg",
    shade: "/mockups/photo/lighter-open-shade.png",
    overlay: "/mockups/photo/lighter-open-gloss.png",
    overlayBlend: "screen",
    overlayOpacity: 1,
    width: lp.size,
    height: lp.size,
    quad: toQuad(lp.open.quad),
    parts: lp.open.parts.map((p) => ({ quad: toQuad(p.quad), src: p.src as [number, number, number, number] })),
  },
];
const lighterEditor: EditorBackground = {
  image: "/mockups/photo/lighter-editor.jpg",
  imageMm: [lp.editor.imageMm[0], lp.editor.imageMm[1]],
  trimOffsetMm: [lp.editor.trimOffsetMm[0], lp.editor.trimOffsetMm[1]],
};


/* ------------------- Пластиковые зажигалки: принт по кругу ------------------- */
/** Геометрия, снятая с фото товара (scripts/build-photo-mockups-*.py). */
interface WrapPhotoGeo {
  width: number;
  height: number;
  cx: number;
  pxPerMm: number;
  stickerTop: number;
  aMm: number;
  bMm: number;
  perimeterMm: number;
  printHMm: number;
  editor: { heightMm: number; trimTopMm: number };
}

/**
 * Собирает стороны и ракурсы товара с принтом на весь корпус.
 * assets — файлы в public/mockups/photo/: <prefix>-front.jpg, -shade.png, -gloss.png, -editor-*.jpg.
 */
function wrapProduct(geo: WrapPhotoGeo, prefix: string, backAssets: { image: string; shade: string; overlay: string; editor: string }) {
  const print = (widthMm: number): PrintSpec => ({ widthMm, heightMm: geo.printHMm, bleedMm: 2, safeMm: 2.5, cornerRadiusMm: 0, dpi: 300, isDemo: false });
  const view = (label: string, a: { image: string; shade: string; overlay: string }, viewCenterMm: number): MockupSpec => ({
    kind: "cylinder",
    label,
    ...a,
    overlayBlend: "screen",
    overlayOpacity: 1,
    width: geo.width,
    height: geo.height,
    quad: toQuad([[0, 0], [1, 0], [1, 1], [0, 1]]), // не используется для цилиндра
    cylinder: { cx: geo.cx, pxPerMm: geo.pxPerMm, stickerTop: geo.stickerTop, aMm: geo.aMm, bMm: geo.bMm, viewCenterMm },
  });
  const front = { image: `/mockups/photo/${prefix}-front.jpg`, shade: `/mockups/photo/${prefix}-shade.png`, overlay: `/mockups/photo/${prefix}-gloss.png` };
  const views = (): MockupSpec[] => [view("Спереди", front, 0), view("Сзади", backAssets, geo.perimeterMm / 2)];
  const side = (label: string, widthMm: number, editorImage: string): SideSpec => ({
    label,
    print: print(widthMm),
    editor: { image: editorImage, imageMm: [widthMm, geo.editor.heightMm], trimOffsetMm: [0, geo.editor.trimTopMm] },
    mockups: views(),
  });
  return {
    wrap: { stickerMm: [geo.perimeterMm, geo.printHMm] as [number, number], modes: { two: ["front", "back"] as SideId[], around: ["wrap"] as SideId[] } },
    sides: {
      front: side("Лицевая", geo.perimeterMm / 2, `/mockups/photo/${prefix}-editor-front.jpg`),
      back: side("Оборотная", geo.perimeterMm / 2, backAssets.editor),
      wrap: side("По кругу", geo.perimeterMm, `/mockups/photo/${prefix}-editor-wrap.jpg`),
    },
  };
}

const bic = wrapProduct(g.bic.photo as WrapPhotoGeo, "bic", {
  image: "/mockups/photo/bic-back.jpg",
  shade: "/mockups/photo/bic-shade-back.png",
  overlay: "/mockups/photo/bic-gloss-back.png",
  editor: "/mockups/photo/bic-editor-back.jpg",
});
// У Cricket вид сзади — тот же снимок (зеркалить нельзя: на колпачке надпись)
const cricket = wrapProduct(g.cricket.photo as WrapPhotoGeo, "cricket", {
  image: "/mockups/photo/cricket-front.jpg",
  shade: "/mockups/photo/cricket-shade.png",
  overlay: "/mockups/photo/cricket-gloss.png",
  editor: "/mockups/photo/cricket-editor-front.jpg",
});

export const PRODUCTS: ProductConfig[] = [
  {
    id: "cardholder",
    name: "Картхолдер",
    tagline: "Металлический футляр для карт с вашим принтом на крышке",
    description:
      "Принт 90 × 59 мм на плоской панели футляра — одной или обеих. Внутри — отделения для карт.",
    price: 1990,
    secondSidePrice: 600,
    priceIsDemo: true,
    quantity: { min: 1, max: 50 },
    variants: [{ id: "silver", name: "Серебристый", swatch: "#D3D6DA", priceDelta: 0 }],
    sides: {
      front: {
        label: "Лицевая",
        print: cardholderPrint,
        editor: cardholderEditor,
        mockups: cardholderMockups(),
      },
      back: {
        label: "Оборотная",
        print: cardholderPrint,
        editor: cardholderEditor,
        mockups: cardholderMockups(),
      },
    },
  },
  {
    id: "lighter",
    name: "Зажигалка металлическая",
    tagline: "Хромированная зажигалка с откидной крышкой — принт на всю сторону",
    description: "Принт 32 × 51 мм занимает всю лицевую сторону — и корпус, и крышку.",
    price: 1490,
    secondSidePrice: 400,
    priceIsDemo: true,
    quantity: { min: 1, max: 50 },
    variants: [{ id: "chrome", name: "Хром", swatch: "#CDD0D4", priceDelta: 0 }],
    sides: {
      front: { label: "Лицевая", print: lighterPrint, editor: lighterEditor, mockups: lighterMockups() },
      back: { label: "Оборотная", print: lighterPrint, editor: lighterEditor, mockups: lighterMockups() },
    },
  },
  {
    id: "bic",
    name: "Зажигалка BIC",
    tagline: "Пластиковая зажигалка с принтом по всему корпусу",
    description: "Принт на весь корпус: разные фото с двух сторон или одно фото по кругу.",
    price: 690,
    secondSidePrice: 0,
    priceIsDemo: true,
    quantity: { min: 1, max: 50 },
    variants: [{ id: "black", name: "Чёрный корпус", swatch: "#1d1e21", priceDelta: 0 }],
    ...bic,
  },
  {
    id: "cricket",
    name: "Зажигалка Cricket",
    tagline: "Пластиковая зажигалка с принтом по всему корпусу",
    description: "Принт 56 × 66 мм на весь корпус: разные фото с двух сторон или одно фото по кругу.",
    price: 690,
    secondSidePrice: 0,
    priceIsDemo: true,
    quantity: { min: 1, max: 50 },
    variants: [{ id: "black", name: "Чёрный корпус", swatch: "#1d1e21", priceDelta: 0 }],
    ...cricket,
  },
];

export const SIDE_ORDER: SideId[] = ["front", "back", "wrap"];

export function getProduct(id: string | null | undefined): ProductConfig | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getVariant(product: ProductConfig, variantId: string | null | undefined): ProductVariant {
  return product.variants.find((v) => v.id === variantId) ?? product.variants[0];
}

/** Стороны, доступные для редактирования (у товаров «по кругу» — в зависимости от режима). */
export function productSides(product: ProductConfig, mode: WrapMode = "two"): SideId[] {
  if (product.wrap) return product.wrap.modes[mode];
  return SIDE_ORDER.filter((s) => product.sides[s]);
}

/** Где на обхвате начинается левый край принта: в режиме «две стороны» лицевая половина по центру спереди. */
export function wrapStartMm(product: ProductConfig, mode: WrapMode): number {
  const w = product.wrap!.stickerMm[0];
  return mode === "around" ? -w / 2 : -w / 4;
}

/** Спецификация стороны с учётом изображений выбранного варианта. */
export function resolveSide(product: ProductConfig, variant: ProductVariant, side: SideId): SideSpec | undefined {
  const spec = product.sides[side];
  if (!spec) return undefined;
  const override = variant.images?.[side];
  return {
    ...spec,
    editor: { ...spec.editor, image: override?.editor ?? spec.editor.image },
    mockups: spec.mockups.map((m, i) => ({ ...m, image: override?.mockups?.[i] ?? m.image })),
  };
}

/** Геометрия производственного файла в пикселях. */
export function printGeometry(print: PrintSpec) {
  const pxPerMm = print.dpi / 25.4;
  const bleed = Math.round(print.bleedMm * pxPerMm);
  const trimW = Math.round(print.widthMm * pxPerMm);
  const trimH = Math.round(print.heightMm * pxPerMm);
  const safe = Math.round(print.safeMm * pxPerMm);
  return {
    pxPerMm,
    width: trimW + bleed * 2,
    height: trimH + bleed * 2,
    bleed,
    trim: { x: bleed, y: bleed, width: trimW, height: trimH },
    safe: { x: bleed + safe, y: bleed + safe, width: trimW - safe * 2, height: trimH - safe * 2 },
    radius: print.cornerRadiusMm * pxPerMm,
  };
}
export type PrintGeometry = ReturnType<typeof printGeometry>;
