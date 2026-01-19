"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Shield, LogOut } from "lucide-react";

interface Session {
  username: string;
  isAdmin: boolean;
}

export function DevLoginSwitcher() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [customUsername, setCustomUsername] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSession(data))
      .catch(() => setSession(null));
  }, []);

  async function switchUser(username: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isAdmin) {
          router.push("/admin");
        } else {
          router.push("/");
        }
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function handleCustomLogin(e: FormEvent) {
    e.preventDefault();
    if (customUsername.trim()) {
      switchUser(customUsername.trim());
      setCustomUsername("");
    }
  }

  const isProduction = process.env.NEXT_PUBLIC_AUTH_MODE === "saml";

  // Production: just show username, no logout (SAML handles auth)
  if (isProduction) {
    if (!session) return null;
    return (
      <Button variant="outline" size="sm" className="cursor-default">
        {session.isAdmin ? (
          <Shield className="mr-2 h-4 w-4" />
        ) : (
          <User className="mr-2 h-4 w-4" />
        )}
        {session.username}
      </Button>
    );
  }

  // Development: full login switcher
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          {session?.isAdmin ? (
            <Shield className="mr-2 h-4 w-4" />
          ) : (
            <User className="mr-2 h-4 w-4" />
          )}
          {session?.username || "Not logged in"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Dev Login</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form onSubmit={handleCustomLogin} className="px-2 py-1.5">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Username"
              value={customUsername}
              onChange={(e) => setCustomUsername(e.target.value)}
              className="h-8 text-sm"
              disabled={loading}
            />
            <Button type="submit" size="sm" disabled={loading || !customUsername.trim()}>
              Login
            </Button>
          </div>
        </form>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => switchUser("edsu8469")}>
          <Shield className="mr-2 h-4 w-4" />
          Admin (edsu8469)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => switchUser("zeoz8466")}>
          <User className="mr-2 h-4 w-4" />
          Student (zeoz8466)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
