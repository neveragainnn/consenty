/**
 * Основные настройки бренда. Чтобы заменить логотип — поменяйте `brand`
 * и/или положите свой файл в public/ и укажите путь в `logoSrc`.
 */
export const SITE = {
  brand: "consenty",
  /** Путь к картинке логотипа (svg/png в public/). null — текстовый логотип. */
  logoSrc: null as string | null,
  description: "Картхолдеры и зажигалки с вашим собственным принтом",
  /** Валюта для отображения цен. Цены в products.ts — в целых единицах этой валюты. */
  currency: "RUB",
  /** Показывать цены на сайте. Сейчас выключено: стоимость обсуждается с покупателем лично. */
  showPrices: false,
  locale: "ru-RU",
  /** Часовой пояс, в котором дата заказа показывается в Telegram. */
  timeZone: process.env.ORDER_TIMEZONE || "Europe/Moscow",
  contacts: {
    telegram: "@your_shop", // замените
    email: "hello@example.com", // замените
  },
} as const;
