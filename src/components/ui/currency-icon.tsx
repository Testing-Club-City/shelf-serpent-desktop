import React from 'react';

interface CurrencyIconProps {
  className?: string;
}

/**
 * A component that displays the Kenya Shilling currency symbol.
 * Use this when the Currency icon from lucide-react is not available.
 */
export function KenyaShillingIcon({ className = "" }: CurrencyIconProps) {
  return (
    <div className={`bg-green-100 rounded-full flex items-center justify-center p-1 ${className}`}>
      <span className="text-green-700 font-bold text-xs">KES</span>
    </div>
  );
} 