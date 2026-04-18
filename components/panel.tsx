import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.6rem] border border-white/[0.05] bg-[#121a1f] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.24)]",
        className,
      )}
    >
      {children}
    </section>
  );
}
