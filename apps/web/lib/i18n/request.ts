import { getRequestConfig } from "next-intl/server";

type Locale = "tr" | "en";

export default getRequestConfig(async () => {
  // For now use cookie/header to determine locale, default to Turkish
  const locale: Locale = "tr";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
