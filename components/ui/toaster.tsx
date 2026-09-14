"use client";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!bg-inverse-surface !text-inverse-on-surface !rounded-xl !shadow-md !border-0 !font-sans",
          description: "!text-inverse-on-surface/80",
        },
      }}
    />
  );
}
