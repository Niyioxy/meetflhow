export const locales = ["en", "hi", "zh", "fr", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  zh: "中文",
  fr: "Français",
  es: "Español",
};

export const localeCookieName = "NEXT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
