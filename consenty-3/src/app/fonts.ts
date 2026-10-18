import { Caveat, Dela_Gothic_One, Golos_Text, Rubik_Mono_One } from "next/font/google";

/** Шрифт заголовков интерфейса. */
export const display = Dela_Gothic_One({ weight: "400", subsets: ["latin", "cyrillic"], variable: "--nf-display", display: "swap" });
/** Основной шрифт интерфейса. */
export const body = Golos_Text({ subsets: ["latin", "cyrillic"], variable: "--nf-body", display: "swap" });

const mono = Rubik_Mono_One({ weight: "400", subsets: ["latin", "cyrillic"], display: "swap" });
const hand = Caveat({ subsets: ["latin", "cyrillic"], weight: ["600"], display: "swap" });

/** Шрифты, доступные покупателю для надписей на принте. */
export const EDITOR_FONTS = [
  { id: "display", label: "Гротеск жирный", family: display.style.fontFamily },
  { id: "body", label: "Простой", family: body.style.fontFamily },
  { id: "mono", label: "Широкий", family: mono.style.fontFamily },
  { id: "hand", label: "Рукописный", family: hand.style.fontFamily },
] as const;
