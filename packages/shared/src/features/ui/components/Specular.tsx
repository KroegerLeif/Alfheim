"use client";

import { HTMLAttributes } from "react";

interface SpecularProps extends HTMLAttributes<HTMLDivElement> {
  opacityClassName?: string;
}

export function Specular({ opacityClassName = "via-white/40 dark:via-white/20", className, ...props }: SpecularProps) {
  return (
    <div
      aria-hidden
      className={["absolute top-0 left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-transparent to-transparent pointer-events-none z-10", opacityClassName, className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}
