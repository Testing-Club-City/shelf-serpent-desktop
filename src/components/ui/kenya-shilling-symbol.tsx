import React from 'react';

interface KenyaShillingSymbolProps {
  className?: string;
}

export const KenyaShillingSymbol: React.FC<KenyaShillingSymbolProps> = ({ className = "" }) => {
  return (
    <div className={`bg-green-100 p-1 rounded-full flex items-center justify-center ${className}`}>
      <span className="text-green-700 font-bold text-xs">KES</span>
    </div>
  );
}; 