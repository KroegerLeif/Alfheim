import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SpecularProps extends HTMLAttributes<HTMLDivElement> {
  opacityClassName?: string;
}

/**
 * Renders a subtle light highlight edge for glassmorphic elements.
 * Adapts to theme colors via Tailwind gradients.
 */
export function Specular({ opacityClassName = "via-white/40 dark:via-white/20", className, ...props }: SpecularProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute top-0 left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-transparent to-transparent pointer-events-none z-10",
        opacityClassName,
        className
      )}
      {...props}
    />
  );
}
