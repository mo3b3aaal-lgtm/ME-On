import React, { useEffect } from "react";
import { AppIcon } from "./AppIcon";

interface BottomSheetProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg" | "full";
  showHandle?: boolean;
  showClose?: boolean;
  headerLeading?: React.ReactNode;
  headerTrailing?: React.ReactNode;
  bodyClassName?: string;
  maxWidthClass?: string;
  footer?: React.ReactNode;
  zIndex?: number;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  id,
  isOpen,
  onClose,
  title,
  subtitle,
  size = "md",
  showHandle = true,
  showClose = true,
  headerLeading,
  headerTrailing,
  bodyClassName = "",
  maxWidthClass = "max-w-lg",
  footer,
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
    <div id={id} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />
      <div 
        className={`relative z-10 w-full ${maxWidthClass} bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col ${heightClasses} transition-transform duration-300 ease-out`}
      >
        {showHandle && (
          <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden" />
        )}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            {headerLeading}
            {!headerLeading && <div className="w-1.5 h-5 bg-[#0F2A4A] rounded-full shrink-0" />}
            <div className="min-w-0">
              {title && <h2 className="text-lg font-bold text-[#0F2A4A] truncate">{title}</h2>}
              {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {headerTrailing}
            {showClose && (
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <AppIcon name="close" size={16} />
              </button>
            )}
          </div>
        </div>
        <div className={`flex-1 overflow-y-auto p-6 space-y-4 ${bodyClassName}`}>
          {children}
        </div>
        {footer && (
          <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/50 rounded-b-[28px]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
