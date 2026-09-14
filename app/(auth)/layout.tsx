import { FlowDoMark } from "@/components/brand/flowdo-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-container-low px-4">
      <div className="flex items-center gap-2">
        <FlowDoMark className="h-8 w-8" />
        <div className="flex flex-col leading-none">
          <span className="font-serif text-lg text-on-surface">FlowDo</span>
          <span className="text-[11px] italic text-on-surface-variant">Find your flow.</span>
        </div>
      </div>
      <div className="w-full max-w-sm rounded-xl bg-surface-lowest p-8 shadow-sm">{children}</div>
    </div>
  );
}
