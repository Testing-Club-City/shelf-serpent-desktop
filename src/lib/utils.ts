import { ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { 
    minimumFractionDigits: 0,
    maximumFractionDigits: 2 
  })}`;
}
