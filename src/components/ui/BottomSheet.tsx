import React, { useEffect } from "react";
import { AppIcon } from "./AppIcon";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "md" | "lg" | "full";
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  size = "md",
  children,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const heightClasses = {
    sm: "max-h-[40vh]",
    md: "max-h-[65vh]",
    lg: "max-h-[85vh]",
    full: "max-h-[95vh] h-[95vh]",
  }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />
      <div 
        className={`relative z-10 w-full max-w-lg bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col ${heightClasses} transition-transform duration-300 ease-out`}
      >
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 bg-[#0F2A4A] rounded-full" />
            <h2 className="text-lg font-bold text-[#0F2A4A]">{title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};
