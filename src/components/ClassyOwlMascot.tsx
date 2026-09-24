import React from 'react';

interface ClassyOwlMascotProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  className?: string;
  pose?: 'welcome' | 'happy' | 'smart' | 'waving';
  glow?: boolean;
}

export const ClassyOwlMascot: React.FC<ClassyOwlMascotProps> = ({
  size = 'md',
  className = '',
  pose = 'welcome',
  glow = true,
}) => {
  const sizeMap = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32',
    xl: 'w-44 h-44',
    hero: 'w-56 h-56',
  };

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${sizeMap[size]} ${className}`}>
      {/* Soft Ambient Glow Aura (Electric Violet & Coral) */}
      {glow && (
        <div className="absolute inset-0 bg-gradient-to-tr from-[#7657F6]/35 via-[#FF647C]/25 to-[#55C7E8]/25 rounded-full blur-xl transform scale-125 pointer-events-none -z-10 animate-pulse" />
      )}

      {/* Vector Illustrated Classy Owl */}
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full filter drop-shadow-[0_8px_20px_rgba(23,22,61,0.2)]"
      >
        <defs>
          {/* Owl Body Gradient - Midnight & Royal Indigo & Violet */}
          <linearGradient id="owlBodyGrad" x1="40" y1="20" x2="160" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7657F6" />
            <stop offset="50%" stopColor="#403B9C" />
            <stop offset="100%" stopColor="#17163D" />
          </linearGradient>

          {/* Owl Belly Gradient - Soft Lavender to White */}
          <linearGradient id="owlBellyGrad" x1="100" y1="90" x2="100" y2="175" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#F4F3FF" />
            <stop offset="100%" stopColor="#E8E7FF" />
          </linearGradient>

          {/* Eye Glasses / Accent Gradient - Vibrant Coral */}
          <linearGradient id="owlCoralGrad" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF7A90" />
            <stop offset="100%" stopColor="#FF647C" />
          </linearGradient>

          {/* Beak & Feet - Golden Amber */}
          <linearGradient id="owlGoldGrad" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD166" />
            <stop offset="100%" stopColor="#FF9F1C" />
          </linearGradient>

          {/* Graduation Cap Grad - Midnight Indigo */}
          <linearGradient id="capGrad" x1="50" y1="10" x2="150" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2A2468" />
            <stop offset="100%" stopColor="#17163D" />
          </linearGradient>

          {/* Floating Sparkle Gradient */}
          <linearGradient id="sparkleGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#55C7E8" />
            <stop offset="100%" stopColor="#7657F6" />
          </linearGradient>
        </defs>

        {/* Ambient Sparkles */}
        <path
          d="M32 45L34.5 37.5L42 35L34.5 32.5L32 25L29.5 32.5L22 35L29.5 37.5L32 45Z"
          fill="url(#sparkleGrad)"
          className="animate-pulse"
        />
        <path
          d="M172 65L174 59L180 57L174 55L172 49L170 55L164 57L170 59L172 65Z"
          fill="#55C7E8"
          opacity="0.9"
        />
        <circle cx="168" cy="140" r="3.5" fill="#FF647C" opacity="0.8" />
        <circle cx="28" cy="130" r="2.5" fill="#7657F6" opacity="0.7" />

        {/* Feet / Talons */}
        <g id="feet">
          {/* Left Foot */}
          <ellipse cx="82" cy="180" rx="9" ry="5" fill="url(#owlGoldGrad)" />
          <ellipse cx="73" cy="179" rx="7" ry="4.5" fill="url(#owlGoldGrad)" />
          <ellipse cx="91" cy="179" rx="7" ry="4.5" fill="url(#owlGoldGrad)" />

          {/* Right Foot */}
          <ellipse cx="118" cy="180" rx="9" ry="5" fill="url(#owlGoldGrad)" />
          <ellipse cx="109" cy="179" rx="7" ry="4.5" fill="url(#owlGoldGrad)" />
          <ellipse cx="127" cy="179" rx="7" ry="4.5" fill="url(#owlGoldGrad)" />
        </g>

        {/* Outer Body / Head Shape with Tufted Feather Ears */}
        <path
          d="M48 65
             C42 45, 52 35, 62 48
             C74 38, 126 38, 138 48
             C148 35, 158 45, 152 65
             C165 95, 168 150, 142 174
             C128 184, 72 184, 58 174
             C32 150, 35 95, 48 65 Z"
          fill="url(#owlBodyGrad)"
        />

        {/* Left Wing */}
        <path
          d={
            pose === 'waving'
              ? "M45 100 C20 80, 15 50, 35 45 C45 65, 52 90, 48 120 Z"
              : "M48 95 C32 110, 32 145, 54 160 C58 145, 56 115, 48 95 Z"
          }
          fill="#5B3CE0"
          stroke="#403B9C"
          strokeWidth="2"
        />

        {/* Right Wing */}
        <path
          d={
            pose === 'waving'
              ? "M152 95 C168 110, 168 145, 146 160 C142 145, 144 115, 152 95 Z"
              : "M152 95 C168 110, 168 145, 146 160 C142 145, 144 115, 152 95 Z"
          }
          fill="#5B3CE0"
          stroke="#403B9C"
          strokeWidth="2"
        />

        {/* Belly Plumes / Vest */}
        <path
          d="M68 105
             C68 90, 132 90, 132 105
             C132 148, 124 172, 100 172
             C76 172, 68 148, 68 105 Z"
          fill="url(#owlBellyGrad)"
        />

        {/* Belly Decorative Chevron Feathers */}
        <path
          d="M88 122 Q100 130 112 122"
          stroke="#C8B5F5"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M84 138 Q100 148 116 138"
          stroke="#C8B5F5"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M90 154 Q100 162 110 154"
          stroke="#C8B5F5"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Eye Sockets / Facial Discs */}
        <ellipse cx="77" cy="85" rx="22" ry="22" fill="#FFFFFF" />
        <ellipse cx="123" cy="85" rx="22" ry="22" fill="#FFFFFF" />

        {/* Left Eye */}
        <ellipse cx="78" cy="85" rx="14" ry="14" fill="#17163D" />
        <ellipse cx="80" cy="82" rx="12" ry="12" fill="#403B9C" />
        <ellipse cx="81" cy="84" rx="9" ry="9" fill="#191A2E" />
        {/* Eye Highlights */}
        <circle cx="77" cy="80" r="4.5" fill="#FFFFFF" />
        <circle cx="84" cy="88" r="2" fill="#FFFFFF" />

        {/* Right Eye */}
        <ellipse cx="122" cy="85" rx="14" ry="14" fill="#17163D" />
        <ellipse cx="120" cy="82" rx="12" ry="12" fill="#403B9C" />
        <ellipse cx="119" cy="84" rx="9" ry="9" fill="#191A2E" />
        {/* Eye Highlights */}
        <circle cx="116" cy="80" r="4.5" fill="#FFFFFF" />
        <circle cx="123" cy="88" r="2" fill="#FFFFFF" />

        {/* Smart Glasses Frames (Warm Coral) */}
        <circle cx="77" cy="85" r="23" stroke="url(#owlCoralGrad)" strokeWidth="3.5" fill="none" opacity="0.95" />
        <circle cx="123" cy="85" r="23" stroke="url(#owlCoralGrad)" strokeWidth="3.5" fill="none" opacity="0.95" />
        {/* Bridge */}
        <line x1="97" y1="84" x2="103" y2="84" stroke="url(#owlCoralGrad)" strokeWidth="3.5" strokeLinecap="round" />

        {/* Beak */}
        <polygon points="100,90 92,104 108,104" fill="url(#owlGoldGrad)" />
        <polygon points="100,108 94,104 106,104" fill="#E08700" />

        {/* Cheerful Blush Patches */}
        <ellipse cx="58" cy="98" rx="7" ry="4" fill="#FF647C" opacity="0.45" />
        <ellipse cx="142" cy="98" rx="7" ry="4" fill="#FF647C" opacity="0.45" />

        {/* Academic Graduation Cap (Mortarboard) */}
        <g id="gradCap">
          {/* Skull Cap Base */}
          <path
            d="M80 44 C80 37, 120 37, 120 44 L116 52 C116 54, 84 54, 84 52 Z"
            fill="#17163D"
          />
          {/* Diamond Top */}
          <polygon
            points="100,20 152,36 100,48 48,36"
            fill="url(#capGrad)"
            stroke="#7657F6"
            strokeWidth="1.5"
          />
          {/* Cap Button / Center Pin */}
          <ellipse cx="100" cy="35" rx="3.5" ry="2.5" fill="#FFD166" />
          {/* Tassel Ribbon & Drop */}
          <path
            d="M100 35 Q135 37 142 54"
            stroke="#FFD166"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <polygon points="142,54 138,68 146,68" fill="#FF9F1C" />
        </g>
      </svg>
    </div>
  );
};
