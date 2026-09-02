import React, { useState, useEffect } from 'react';
import { Wifi, BatteryMedium, Signal } from 'lucide-react';

interface AndroidStatusBarProps {
  appName?: string;
}

export const AndroidStatusBar: React.FC<AndroidStatusBarProps> = () => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      // Arabic formatted time or simple clean HH:MM
      const hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const isPm = hours >= 12;
      const formattedHours = hours % 12 || 12;
      setTime(`${formattedHours}:${minutes} ${isPm ? 'م' : 'ص'}`);
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-[#2D332A] text-[#F9F7F2] px-4 py-1.5 flex items-center justify-between text-[11px] font-medium select-none shrink-0 z-40 border-b border-[#3D4539]">
      {/* Time in Arabic format */}
      <span className="font-semibold tracking-wide font-sans">{time}</span>

      {/* System Status Icons */}
      <div className="flex items-center gap-2 text-[#E8E2D6]/80">
        <Signal className="w-3.5 h-3.5" />
        <Wifi className="w-3.5 h-3.5" />
        <div className="flex items-center gap-0.5">
          <span className="text-[10px] font-mono">92%</span>
          <BatteryMedium className="w-4 h-4 text-[#748C70]" />
        </div>
      </div>
    </div>
  );
};
