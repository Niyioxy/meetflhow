import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { defaultLocale, isLocale, localeCookieName } from "./config";

export default getRequestConfig(async () => {
  const session = await auth();
  let locale: string | undefined = session?.user?.language;

  if (!isLocale(locale)) {
    const cookieLocale = cookies().get(localeCookieName)?.value;
    locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
