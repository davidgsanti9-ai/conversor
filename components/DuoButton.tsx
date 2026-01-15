
import React from 'react';

interface DuoButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
}

export const DuoButton: React.FC<DuoButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '',
  disabled = false
}) => {
  const baseStyles = "relative px-6 py-3 rounded-2xl font-black text-lg transition-all active:translate-y-1 active:border-b-0 uppercase tracking-wide";
  
  const variants = {
    primary: "bg-[#58cc02] text-white border-b-4 border-[#46a302] hover:bg-[#61e002]",
    secondary: "bg-[#1cb0f6] text-white border-b-4 border-[#1899d6] hover:bg-[#20c4ff]",
    ghost: "bg-white text-[#afafaf] border-2 border-[#e5e5e5] border-b-4 hover:bg-[#f7f7f7]",
    danger: "bg-[#ff4b4b] text-white border-b-4 border-[#d33131] hover:bg-[#ff5c5c]"
  };

  return (
    <button 
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
    >
      {children}
    </button>
  );
};
