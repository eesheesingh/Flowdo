"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { logOutUser } from "@/lib/auth/logout";

export function UserMenu({ email }: { email: string }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await logOutUser(supabase);
    router.push("/login");
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium"
          aria-label="User menu"
        >
          {email.charAt(0).toUpperCase()}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-[200px] rounded-md border border-border bg-background p-1 shadow-md"
        >
          <div className="px-2 py-1.5 text-sm text-muted-foreground">{email}</div>
          <DropdownMenu.Item asChild>
            <Link
              href="/app/settings/profile"
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
            >
              <User className="h-4 w-4" /> Profile
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link
              href="/app/settings/security"
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Settings className="h-4 w-4" /> Security
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={handleLogout}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
