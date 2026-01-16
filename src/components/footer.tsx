"use client";

import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("common.footer");

  return (
    <footer className="border-t bg-muted/50 py-6">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center gap-4 text-center text-sm text-muted-foreground">
          <p>{t("suProgram")}</p>
          <p>
            Copyright © Edwin Sundberg 2026 - AGPL 3 |{" "}
            <a
              href="mailto:lambda@dsv.su.se"
              className="hover:text-foreground underline"
            >
              lambda@dsv.su.se
            </a>
          </p>
          <p className="max-w-md text-xs">{t("privacy")}</p>
        </div>
      </div>
    </footer>
  );
}
