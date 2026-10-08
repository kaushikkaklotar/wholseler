import Image from "next/image";
import { cn } from "@/lib/utils";

export function Brand({ dark = false, compact = false, className }: {
  dark?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("brand-lockup inline-flex shrink-0 items-center", dark && "brand-on-dark", className)}>
      <Image
        src={compact ? "/brand/bulksaathi-mark.png" : "/brand/bulksaathi-logo.png"}
        alt="BulkSaathi"
        width={compact ? 64 : 560}
        height={compact ? 64 : 128}
        priority
        className={compact ? "size-9 object-contain" : "h-auto w-[180px] sm:w-[198px]"}
      />
    </span>
  );
}
