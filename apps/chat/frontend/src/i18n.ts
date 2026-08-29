import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales } from "./navigation";
import { getSharedMessages, Language } from "@alfheim/shared";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;

  // Validate that the incoming locale is supported
  if (!locale || !locales.includes(locale as any)) {
    notFound();
  }

  const messages = getSharedMessages(locale as Language);

  return {
    locale,
    messages,
  };
});
