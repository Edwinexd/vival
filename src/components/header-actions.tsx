"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { DevLoginSwitcher } from "@/components/dev-login-switcher";

export function HeaderActions() {
  return (
    <div className="ml-auto flex items-center space-x-4">
      <LanguageSwitcher />
      <DevLoginSwitcher />
    </div>
  );
}
