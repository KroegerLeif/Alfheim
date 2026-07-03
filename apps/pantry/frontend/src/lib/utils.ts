import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple ClassValue objects and merges conflicting Tailwind classes.
 * Useful for composing dynamic classes in React/Tailwind applications.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
