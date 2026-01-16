"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  FileText,
  MessageSquare,
  Calendar,
  Clock,
  GraduationCap,
  Settings,
  BookOpen,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { HeaderActions } from "@/components/header-actions";
import { Footer } from "@/components/footer";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("common");

  const sidebarItems = [
    { href: "/admin", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/admin/assignments", label: t("nav.assignments"), icon: BookOpen },
    { href: "/admin/upload", label: t("nav.upload"), icon: Upload },
    { href: "/admin/submissions", label: t("nav.submissions"), icon: FileText },
    { href: "/admin/reviews", label: t("nav.reviews"), icon: MessageSquare },
    { href: "/admin/seminars", label: t("nav.seminars"), icon: Calendar },
    { href: "/admin/slots", label: t("nav.slots"), icon: Clock },
    { href: "/admin/grading", label: t("nav.grading"), icon: GraduationCap },
    { href: "/admin/settings", label: t("nav.settings"), icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-sidebar">
        <div className="flex h-16 items-center border-b px-6">
          <Logo href="/admin" />
        </div>
        <div className="p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("portal.admin")}
          </span>
        </div>
        <nav className="space-y-1 px-3">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-h-screen flex-col pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <HeaderActions />
        </header>
        <main className="flex-1 p-6">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
