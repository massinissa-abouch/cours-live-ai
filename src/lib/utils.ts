import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Wrap a promise with a timeout. Rejects with a friendly error if the promise
 * doesn't settle in `ms` milliseconds. Use for network calls that could
 * otherwise hang forever on a slow/unreachable backend.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 15000, label = "Requête"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} : délai dépassé, réseau instable ?`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}
