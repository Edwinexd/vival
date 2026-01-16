"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const locales = [
  { code: "en", label: "English", flag: "GB" },
  { code: "sv", label: "Svenska", flag: "SE" },
] as const;

export function LanguageSwitcher() {
  const router = useRouter();
  const t = useTranslations("common");

  const setLocale = (locale: string) => {
    // eslint-disable-next-line react-hooks/immutability -- intentional browser cookie API usage
    document.cookie = `locale=${locale};path=/;max-age=31536000`;
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="sr-only">{t("language.switchTo")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            onClick={() => setLocale(locale.code)}
          >
            <span className="mr-2">{locale.flag === "GB" ? "🇬🇧" : "🇸🇪"}</span>
            {locale.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
