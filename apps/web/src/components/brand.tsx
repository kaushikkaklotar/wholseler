import { Boxes } from "lucide-react";

export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 ${dark ? "text-white" : "text-foreground"}`}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
        <Boxes className="size-5" />
      </span>
      <span className="text-xl font-semibold tracking-tight">
        wholseler<span className="text-primary">.</span>
      </span>
    </div>
  );
}
