"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetCloseButton } from "@/components/ui/sheet";
import { FlowDoMark } from "@/components/brand/flowdo-mark";
import { NAV_ITEMS } from "./sidebar";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-4">
        <div className="mb-4 flex items-center justify-between">
          <SheetTitle asChild>
            <Link href="/app/today" onClick={() => setOpen(false)} className="flex items-center gap-2">
              <FlowDoMark className="h-7 w-7" />
              <span className="font-serif text-lg text-on-surface">FlowDo</span>
            </Link>
          </SheetTitle>
          <SheetCloseButton />
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-secondary-container font-medium text-on-secondary-fixed-variant"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
