import React from 'react';
import { AchievementFrame } from '../types';

interface FrameSVGProps {
  frame: AchievementFrame;
  className?: string;
}

export const AchievementFrameSVG: React.FC<FrameSVGProps> = ({ frame, className = '' }) => {
  if (!frame || frame === 'none' || frame === 'default') {
    return null;
  }

  switch (frame) {
    // ----------------------------------------------------
    // 1. BRONZE STAR (نجمة برونزية / المحارب البرونزي)
    // ----------------------------------------------------
    case 'bronze_star':
    case 'star':
      return (
        <svg
          viewBox="0 0 200 200"
          className={`w-full h-full pointer-events-none drop-shadow-md select-none ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="brz_base" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0A3D62" />
              <stop offset="25%" stopColor="#16324F" />
              <stop offset="50%" stopColor="#C7CDD3" />
              <stop offset="75%" stopColor="#6F7882" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <linearGradient id="brz_gold" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#C7CDD3" />
              <stop offset="50%" stopColor="#0A3D62" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <linearGradient id="brz_dark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#16324F" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <radialGradient id="brz_glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#C7CDD3" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#16324F" stopOpacity="0" />
            </radialGradient>
            <filter id="brz_shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#16324F" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Side Wing Blades Left */}
          <path
            d="M 38 100 C 22 86 18 64 24 46 C 30 62 44 76 56 86 Z"
            fill="url(#brz_base)"
            stroke="#16324F"
            strokeWidth="1.5"
            filter="url(#brz_shadow)"
          />
          <path
            d="M 32 104 C 16 116 14 136 22 154 C 28 138 40 126 52 116 Z"
            fill="url(#brz_base)"
            stroke="#16324F"
            strokeWidth="1.5"
            filter="url(#brz_shadow)"
          />

          {/* Side Wing Blades Right */}
          <path
            d="M 162 100 C 178 86 182 64 176 46 C 170 62 156 76 144 86 Z"
            fill="url(#brz_base)"
            stroke="#16324F"
            strokeWidth="1.5"
            filter="url(#brz_shadow)"
          />
          <path
            d="M 168 104 C 184 116 186 136 178 154 C 172 138 160 126 148 116 Z"
            fill="url(#brz_base)"
            stroke="#16324F"
            strokeWidth="1.5"
            filter="url(#brz_shadow)"
          />

          {/* Outer Heavy Bronze Ring */}
          <circle
            cx="100"
            cy="100"
            r="78"
            stroke="url(#brz_base)"
            strokeWidth="10"
            filter="url(#brz_shadow)"
          />
          <circle cx="100" cy="100" r="83" stroke="#16324F" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="73" stroke="#16324F" strokeWidth="1.5" />

          {/* Inner Golden Bevel Ring */}
          <circle cx="100" cy="100" r="67" stroke="url(#brz_gold)" strokeWidth="4" />
          <circle cx="100" cy="100" r="65" stroke="#C7CDD3" strokeWidth="1" strokeOpacity="0.7" />

          {/* Rivets on Ring */}
          <circle cx="48" cy="62" r="2.5" fill="#C7CDD3" stroke="#16324F" strokeWidth="1" />
          <circle cx="152" cy="62" r="2.5" fill="#C7CDD3" stroke="#16324F" strokeWidth="1" />
          <circle cx="48" cy="138" r="2.5" fill="#C7CDD3" stroke="#16324F" strokeWidth="1" />
          <circle cx="152" cy="138" r="2.5" fill="#C7CDD3" stroke="#16324F" strokeWidth="1" />
          <circle cx="34" cy="100" r="2.5" fill="#C7CDD3" stroke="#16324F" strokeWidth="1" />
          <circle cx="166" cy="100" r="2.5" fill="#C7CDD3" stroke="#16324F" strokeWidth="1" />

          {/* Bottom Bronze Crest Shield */}
          <g filter="url(#brz_shadow)">
            <path
              d="M 82 166 L 100 190 L 118 166 L 100 160 Z"
              fill="url(#brz_base)"
              stroke="#16324F"
              strokeWidth="1.5"
            />
            <polygon points="100,166 104,175 114,175 106,181 109,190 100,184 91,190 94,181 86,175 96,175" fill="#C7CDD3" />
          </g>

          {/* Top Giant Bronze Star Headpiece */}
          <g filter="url(#brz_shadow)">
            {/* Star Mount Wings */}
            <path
              d="M 68 38 Q 100 24 132 38 Q 100 48 68 38 Z"
              fill="url(#brz_dark)"
              stroke="url(#brz_base)"
              strokeWidth="2"
            />
            {/* Main Bronze Star */}
            <polygon
              points="100,10 108,30 130,30 112,43 118,64 100,51 82,64 88,43 70,30 92,30"
              fill="url(#brz_gold)"
              stroke="#16324F"
              strokeWidth="2"
            />
            {/* Star Facet Highlights */}
            <polygon points="100,10 108,30 100,51" fill="#FFFFFF" fillOpacity="0.6" />
            <polygon points="130,30 112,43 100,51" fill="#FFFFFF" fillOpacity="0.4" />
            <polygon points="82,64 100,51 88,43" fill="#16324F" fillOpacity="0.5" />
            {/* Center Gem on Star */}
            <circle cx="100" cy="38" r="4.5" fill="#C7CDD3" stroke="#16324F" strokeWidth="1.5" />
            <circle cx="98.5" cy="36.5" r="1.5" fill="#FFFFFF" />
          </g>
        </svg>
      );

    // ----------------------------------------------------
    // 2. SILVER SCHOLAR (طالب الكشمير المتميز / وسام التميز الأكاديمي)
    // ----------------------------------------------------
    case 'silver_scholar':
    case 'silver':
      return (
        <svg
          viewBox="0 0 200 200"
          className={`w-full h-full pointer-events-none drop-shadow-md select-none ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="slv_metal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#C7CDD3" />
              <stop offset="50%" stopColor="#FFFFFF" />
              <stop offset="75%" stopColor="#6F7882" />
              <stop offset="100%" stopColor="#C7CDD3" />
            </linearGradient>
            <linearGradient id="slv_blue_gem" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C7CDD3" />
              <stop offset="50%" stopColor="#0A3D62" />
              <stop offset="100%" stopColor="#0A3D62" />
            </linearGradient>
            <linearGradient id="slv_dark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#16324F" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <filter id="slv_shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#16324F" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Left Cashmere Laurel Wing Flourish */}
          <path
            d="M 38 78 C 18 64 12 40 26 22 C 34 42 46 62 60 74 Z"
            fill="url(#slv_metal)"
            stroke="#16324F"
            strokeWidth="1.5"
            filter="url(#slv_shadow)"
          />
          <path
            d="M 30 114 C 12 126 10 152 24 172 C 32 152 46 134 58 122 Z"
            fill="url(#slv_metal)"
            stroke="#16324F"
            strokeWidth="1.5"
            filter="url(#slv_shadow)"
          />

          {/* Right Cashmere Laurel Wing Flourish */}
          <path
            d="M 162 78 C 182 64 188 40 174 22 C 166 42 154 62 140 74 Z"
            fill="url(#slv_metal)"
            stroke="#16324F"
            strokeWidth="1.5"
            filter="url(#slv_shadow)"
          />
          <path
            d="M 170 114 C 188 126 190 152 176 172 C 168 152 154 134 142 122 Z"
            fill="url(#slv_metal)"
            stroke="#16324F"
            strokeWidth="1.5"
            filter="url(#slv_shadow)"
          />

          {/* Heavy Outer Ring */}
          <circle
            cx="100"
            cy="100"
            r="78"
            stroke="url(#slv_metal)"
            strokeWidth="10"
            filter="url(#slv_shadow)"
          />
          <circle cx="100" cy="100" r="83" stroke="#16324F" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="73" stroke="#16324F" strokeWidth="1.5" />

          {/* Specular Bevel */}
          <circle cx="100" cy="100" r="67" stroke="url(#slv_metal)" strokeWidth="4" />
          <circle cx="100" cy="100" r="65" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.9" />

          {/* Side Crystal Studs */}
          <polygon points="34,100 40,94 46,100 40,106" fill="url(#slv_blue_gem)" stroke="#16324F" strokeWidth="1" />
          <polygon points="166,100 160,94 154,100 160,106" fill="url(#slv_blue_gem)" stroke="#16324F" strokeWidth="1" />

          {/* Bottom Scholar Ribbon & Gem */}
          <g filter="url(#slv_shadow)">
            <path
              d="M 70 168 Q 100 182 130 168 Q 100 196 70 168 Z"
              fill="url(#slv_metal)"
              stroke="#16324F"
              strokeWidth="1.5"
            />
            <polygon points="100,166 108,176 100,186 92,176" fill="url(#slv_blue_gem)" stroke="#16324F" strokeWidth="1.5" />
            <circle cx="98" cy="174" r="1.5" fill="#FFFFFF" />
          </g>

          {/* Top Scholar Crest */}
          <g filter="url(#slv_shadow)">
            <path
              d="M 64 42 L 100 16 L 136 42 L 100 52 Z"
              fill="url(#slv_dark)"
              stroke="url(#slv_metal)"
              strokeWidth="2"
            />
            {/* Crown Plumes */}
            <path d="M 100 8 L 106 28 L 100 36 L 94 28 Z" fill="url(#slv_metal)" stroke="#16324F" strokeWidth="1" />
            <path d="M 80 20 L 92 34 L 84 40 L 76 26 Z" fill="url(#slv_metal)" stroke="#16324F" strokeWidth="1" />
            <path d="M 120 20 L 108 34 L 116 40 L 124 26 Z" fill="url(#slv_metal)" stroke="#16324F" strokeWidth="1" />
            {/* Center Radiant Diamond */}
            <polygon
              points="100,24 110,36 100,48 90,36"
              fill="url(#slv_blue_gem)"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            <polygon points="100,24 105,36 100,48" fill="#FFFFFF" fillOpacity="0.5" />
          </g>
        </svg>
      );

    // ----------------------------------------------------
    // 3. GOLD CHAMPION (بطل البرونز الملكي)
    // ----------------------------------------------------
    case 'gold_champion':
    case 'gold':
      return (
        <svg
          viewBox="0 0 200 200"
          className={`w-full h-full pointer-events-none drop-shadow-lg select-none ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="gld_base" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="20%" stopColor="#0A3D62" />
              <stop offset="45%" stopColor="#C7CDD3" />
              <stop offset="70%" stopColor="#16324F" />
              <stop offset="90%" stopColor="#0A3D62" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <linearGradient id="gld_bright" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="30%" stopColor="#C7CDD3" />
              <stop offset="70%" stopColor="#0A3D62" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <linearGradient id="gld_ruby" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#16324F" />
              <stop offset="50%" stopColor="#0A3D62" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <filter id="gld_shadow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#16324F" floodOpacity="0.65" />
            </filter>
            <filter id="gld_glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grand Left Golden Champion Wings */}
          <g filter="url(#gld_shadow)">
            <path
              d="M 44 80 C 14 62 4 32 20 10 C 28 34 46 58 64 74 Z"
              fill="url(#gld_base)"
              stroke="#16324F"
              strokeWidth="2"
            />
            <path
              d="M 34 100 C 6 92 -2 68 8 44 C 18 64 34 82 50 94 Z"
              fill="url(#gld_bright)"
              stroke="#16324F"
              strokeWidth="1.5"
            />
            <path
              d="M 38 120 C 12 134 6 160 22 184 C 28 162 44 144 60 130 Z"
              fill="url(#gld_base)"
              stroke="#16324F"
              strokeWidth="2"
            />
          </g>

          {/* Grand Right Golden Champion Wings */}
          <g filter="url(#gld_shadow)">
            <path
              d="M 156 80 C 186 62 196 32 180 10 C 172 34 154 58 136 74 Z"
              fill="url(#gld_base)"
              stroke="#16324F"
              strokeWidth="2"
            />
            <path
              d="M 166 100 C 194 92 202 68 192 44 C 182 64 166 82 150 94 Z"
              fill="url(#gld_bright)"
              stroke="#16324F"
              strokeWidth="1.5"
            />
            <path
              d="M 162 120 C 188 134 194 160 178 184 C 172 162 156 144 140 130 Z"
              fill="url(#gld_base)"
              stroke="#16324F"
              strokeWidth="2"
            />
          </g>

          {/* Outer Heavy Bronze Ring */}
          <circle
            cx="100"
            cy="100"
            r="78"
            stroke="url(#gld_base)"
            strokeWidth="11"
            filter="url(#gld_shadow)"
          />
          <circle cx="100" cy="100" r="84" stroke="#16324F" strokeWidth="2" />
          <circle cx="100" cy="100" r="72" stroke="#16324F" strokeWidth="2" />

          {/* Inner Specular Bevel Ring */}
          <circle cx="100" cy="100" r="67" stroke="url(#gld_bright)" strokeWidth="4.5" />
          <circle cx="100" cy="100" r="65" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.9" />

          {/* Decorative Corner Ornaments */}
          <circle cx="48" cy="62" r="3" fill="#FFFFFF" stroke="#16324F" strokeWidth="1.5" />
          <circle cx="152" cy="62" r="3" fill="#FFFFFF" stroke="#16324F" strokeWidth="1.5" />
          <circle cx="48" cy="138" r="3" fill="#FFFFFF" stroke="#16324F" strokeWidth="1.5" />
          <circle cx="152" cy="138" r="3" fill="#FFFFFF" stroke="#16324F" strokeWidth="1.5" />

          {/* Bottom Champion Crest Shield */}
          <g filter="url(#gld_shadow)">
            <path
              d="M 76 164 L 100 196 L 124 164 L 100 156 Z"
              fill="url(#gld_base)"
              stroke="#16324F"
              strokeWidth="2"
            />
            {/* Embedded Burgundy Shield Gem */}
            <polygon
              points="100,166 110,178 100,190 90,178"
              fill="url(#gld_ruby)"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            <circle cx="97" cy="175" r="1.5" fill="#FFFFFF" />
          </g>

          {/* Top Majestic Champion Crown Crest */}
          <g filter="url(#gld_shadow)">
            {/* Background Horn Arc */}
            <path
              d="M 52 44 Q 100 18 148 44 Q 100 36 52 44 Z"
              fill="#16324F"
              stroke="url(#gld_base)"
              strokeWidth="2"
            />
            {/* Triple Sunburst Spikes */}
            <polygon points="100,4 108,26 100,36 92,26" fill="url(#gld_bright)" stroke="#16324F" strokeWidth="1.5" />
            <polygon points="76,14 88,32 80,38 70,24" fill="url(#gld_base)" stroke="#16324F" strokeWidth="1.5" />
            <polygon points="124,14 112,32 120,38 130,24" fill="url(#gld_base)" stroke="#16324F" strokeWidth="1.5" />
            {/* Grand Center Burgundy Star Medallion */}
            <circle cx="100" cy="34" r="11" fill="url(#gld_base)" stroke="#16324F" strokeWidth="2" />
            <circle cx="100" cy="34" r="7" fill="url(#gld_ruby)" stroke="#C7CDD3" strokeWidth="1.5" />
            <circle cx="97.5" cy="31.5" r="2" fill="#FFFFFF" />
          </g>
        </svg>
      );

    // ----------------------------------------------------
    // 4. PLATINUM (نخبة الكشمير الفاخرة)
    // ----------------------------------------------------
    case 'platinum':
      return (
        <svg
          viewBox="0 0 200 200"
          className={`w-full h-full pointer-events-none drop-shadow-md select-none ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="plt_metal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#C7CDD3" />
              <stop offset="50%" stopColor="#FFFFFF" />
              <stop offset="75%" stopColor="#C7CDD3" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <linearGradient id="plt_cyan" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#0A3D62" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <filter id="plt_shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#16324F" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Sharp Cashmere Blades Left */}
          <path
            d="M 42 70 L 14 36 L 36 62 L 18 80 L 48 94 Z"
            fill="url(#plt_metal)"
            stroke="#16324F"
            strokeWidth="1.5"
            filter="url(#plt_shadow)"
          />
          <path
            d="M 42 130 L 14 164 L 36 138 L 18 120 L 48 106 Z"
            fill="url(#plt_metal)"
            stroke="#16324F"
            strokeWidth="1.5"
            filter="url(#plt_shadow)"
          />

          {/* Sharp Cashmere Blades Right */}
          <path
            d="M 158 70 L 186 36 L 164 62 L 182 80 L 152 94 Z"
            fill="url(#plt_metal)"
            stroke="#16324F"
            strokeWidth="1.5"
            filter="url(#plt_shadow)"
          />
          <path
            d="M 158 130 L 186 164 L 164 138 L 182 120 L 152 106 Z"
            fill="url(#plt_metal)"
            stroke="#16324F"
            strokeWidth="1.5"
            filter="url(#plt_shadow)"
          />

          {/* Cashmere Outer Ring */}
          <circle
            cx="100"
            cy="100"
            r="78"
            stroke="url(#plt_metal)"
            strokeWidth="10"
            filter="url(#plt_shadow)"
          />
          <circle cx="100" cy="100" r="83" stroke="#16324F" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="73" stroke="#16324F" strokeWidth="1.5" />

          {/* Bronze Glow Specular Bevel */}
          <circle cx="100" cy="100" r="67" stroke="url(#plt_cyan)" strokeWidth="4" />
          <circle cx="100" cy="100" r="65" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.9" />

          {/* Bottom Spike */}
          <g filter="url(#plt_shadow)">
            <polygon points="100,158 116,174 100,196 84,174" fill="url(#plt_metal)" stroke="#16324F" strokeWidth="1.5" />
            <polygon points="100,166 108,176 100,188 92,176" fill="url(#plt_cyan)" stroke="#FFFFFF" strokeWidth="1" />
          </g>

          {/* Top Sovereign Crown */}
          <g filter="url(#plt_shadow)">
            <polygon points="100,6 112,32 100,44 88,32" fill="url(#plt_metal)" stroke="#16324F" strokeWidth="1.5" />
            <polygon points="74,18 90,36 80,44 68,28" fill="url(#plt_metal)" stroke="#16324F" strokeWidth="1.5" />
            <polygon points="126,18 110,36 120,44 132,28" fill="url(#plt_metal)" stroke="#16324F" strokeWidth="1.5" />
            {/* Center Crystal Gem */}
            <polygon points="100,20 110,34 100,48 90,34" fill="url(#plt_cyan)" stroke="#FFFFFF" strokeWidth="1.5" />
            <polygon points="100,20 105,34 100,48" fill="#FFFFFF" fillOpacity="0.6" />
          </g>
        </svg>
      );

    // ----------------------------------------------------
    // 5. EMERALD HONOR (شرف الجوز الإمبراطوري)
    // ----------------------------------------------------
    case 'emerald_honor':
      return (
        <svg
          viewBox="0 0 200 200"
          className={`w-full h-full pointer-events-none drop-shadow-lg select-none ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="emr_gem" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C7CDD3" />
              <stop offset="30%" stopColor="#0A3D62" />
              <stop offset="70%" stopColor="#6F7882" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <linearGradient id="emr_gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#0A3D62" />
              <stop offset="80%" stopColor="#16324F" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <filter id="emr_shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#16324F" floodOpacity="0.7" />
            </filter>
          </defs>

          {/* Left Vines */}
          <g filter="url(#emr_shadow)">
            <path
              d="M 40 76 C 14 56 6 30 20 14 C 28 36 44 60 60 74 Z"
              fill="url(#emr_gem)"
              stroke="#16324F"
              strokeWidth="2"
            />
            <path
              d="M 46 80 L 18 42 L 32 64 Z"
              fill="url(#emr_gold)"
              stroke="#16324F"
              strokeWidth="1"
            />
            <path
              d="M 38 124 C 12 144 8 170 24 186 C 30 164 46 140 60 126 Z"
              fill="url(#emr_gem)"
              stroke="#16324F"
              strokeWidth="2"
            />
          </g>

          {/* Right Vines */}
          <g filter="url(#emr_shadow)">
            <path
              d="M 160 76 C 186 56 194 30 180 14 C 172 36 156 60 140 74 Z"
              fill="url(#emr_gem)"
              stroke="#16324F"
              strokeWidth="2"
            />
            <path
              d="M 154 80 L 182 42 L 168 64 Z"
              fill="url(#emr_gold)"
              stroke="#16324F"
              strokeWidth="1"
            />
            <path
              d="M 162 124 C 188 144 192 170 176 186 C 170 164 154 140 140 126 Z"
              fill="url(#emr_gem)"
              stroke="#16324F"
              strokeWidth="2"
            />
          </g>

          {/* Outer Ring with Bronze Bindings */}
          <circle
            cx="100"
            cy="100"
            r="78"
            stroke="url(#emr_gem)"
            strokeWidth="11"
            filter="url(#emr_shadow)"
          />
          <circle cx="100" cy="100" r="84" stroke="#16324F" strokeWidth="2" />
          <circle cx="100" cy="100" r="72" stroke="#16324F" strokeWidth="2" />

          {/* Inner Bronze Bevel Ring */}
          <circle cx="100" cy="100" r="67" stroke="url(#emr_gold)" strokeWidth="4.5" />
          <circle cx="100" cy="100" r="65" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.9" />

          {/* Filigree Claws on Ring */}
          <path d="M 32 100 L 44 94 L 44 106 Z" fill="url(#emr_gold)" stroke="#16324F" strokeWidth="1" />
          <path d="M 168 100 L 156 94 L 156 106 Z" fill="url(#emr_gold)" stroke="#16324F" strokeWidth="1" />

          {/* Bottom Lotus Crest */}
          <g filter="url(#emr_shadow)">
            <path
              d="M 74 164 L 100 194 L 126 164 L 100 154 Z"
              fill="url(#emr_gold)"
              stroke="#16324F"
              strokeWidth="1.5"
            />
            <polygon
              points="100,162 112,176 100,190 88,176"
              fill="url(#emr_gem)"
              stroke="#C7CDD3"
              strokeWidth="1.5"
            />
            <circle cx="97" cy="172" r="1.5" fill="#FFFFFF" />
          </g>

          {/* Top Giant Marquise Jewel & Crown */}
          <g filter="url(#emr_shadow)">
            <path
              d="M 60 42 L 100 10 L 140 42 L 100 32 Z"
              fill="url(#emr_gold)"
              stroke="#16324F"
              strokeWidth="2"
            />
            <polygon
              points="100,12 116,32 100,52 84,32"
              fill="url(#emr_gem)"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            <polygon points="100,12 108,32 100,52" fill="#C7CDD3" fillOpacity="0.6" />
            <circle cx="96" cy="28" r="2.5" fill="#FFFFFF" />
          </g>
        </svg>
      );

    // ----------------------------------------------------
    // 6. DIAMOND ELITE (نخبة العاج والبرونز)
    // ----------------------------------------------------
    case 'diamond_elite':
      return (
        <svg
          viewBox="0 0 200 200"
          className={`w-full h-full pointer-events-none drop-shadow-xl select-none ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="dia_prism" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#C7CDD3" />
              <stop offset="50%" stopColor="#0A3D62" />
              <stop offset="75%" stopColor="#16324F" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <linearGradient id="dia_bright" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#C7CDD3" />
              <stop offset="100%" stopColor="#0A3D62" />
            </linearGradient>
            <filter id="dia_shadow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor="#16324F" floodOpacity="0.7" />
            </filter>
            <filter id="dia_glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 4 Diagonal Protruding Shards */}
          <polygon points="36,46 16,18 48,34" fill="url(#dia_bright)" stroke="#16324F" strokeWidth="1.5" filter="url(#dia_shadow)" />
          <polygon points="164,46 184,18 152,34" fill="url(#dia_bright)" stroke="#16324F" strokeWidth="1.5" filter="url(#dia_shadow)" />
          <polygon points="36,154 16,182 48,166" fill="url(#dia_prism)" stroke="#16324F" strokeWidth="1.5" filter="url(#dia_shadow)" />
          <polygon points="164,154 184,182 152,166" fill="url(#dia_prism)" stroke="#16324F" strokeWidth="1.5" filter="url(#dia_shadow)" />

          {/* Side Crystal Shards Left & Right */}
          <polygon points="30,100 8,100 24,86" fill="url(#dia_prism)" stroke="#16324F" strokeWidth="1.5" filter="url(#dia_shadow)" />
          <polygon points="30,100 8,100 24,114" fill="url(#dia_bright)" stroke="#16324F" strokeWidth="1.5" filter="url(#dia_shadow)" />
          <polygon points="170,100 192,100 176,86" fill="url(#dia_prism)" stroke="#16324F" strokeWidth="1.5" filter="url(#dia_shadow)" />
          <polygon points="170,100 192,100 176,114" fill="url(#dia_bright)" stroke="#16324F" strokeWidth="1.5" filter="url(#dia_shadow)" />

          {/* Heavy Faceted Outer Ring */}
          <circle
            cx="100"
            cy="100"
            r="78"
            stroke="url(#dia_prism)"
            strokeWidth="11"
            filter="url(#dia_shadow)"
          />
          <circle cx="100" cy="100" r="84" stroke="#16324F" strokeWidth="2" />
          <circle cx="100" cy="100" r="72" stroke="#16324F" strokeWidth="2" />

          {/* Glowing Inner Prism Ring */}
          <circle cx="100" cy="100" r="67" stroke="url(#dia_bright)" strokeWidth="4.5" />
          <circle cx="100" cy="100" r="65" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.95" />

          {/* Bottom Cluster Bracket */}
          <g filter="url(#dia_shadow)">
            <polygon points="100,160 118,176 100,198 82,176" fill="url(#dia_prism)" stroke="#16324F" strokeWidth="1.5" />
            <polygon points="100,166 110,178 100,190 90,178" fill="url(#dia_bright)" stroke="#FFFFFF" strokeWidth="1.5" />
            <polygon points="100,166 105,178 100,190" fill="#FFFFFF" fillOpacity="0.6" />
          </g>

          {/* Top 8-Point Star */}
          <g filter="url(#dia_shadow)">
            <polygon points="100,2 108,24 134,32 108,40 100,62 92,40 66,32 92,24" fill="url(#dia_bright)" stroke="#16324F" strokeWidth="2" />
            <polygon points="100,32 120,12 110,32" fill="#FFFFFF" fillOpacity="0.8" />
            <polygon points="100,32 80,12 90,32" fill="#C7CDD3" fillOpacity="0.8" />
            <polygon points="100,22 108,32 100,42 92,32" fill="#FFFFFF" stroke="#0A3D62" strokeWidth="1.5" />
            <circle cx="98" cy="30" r="2" fill="#FFFFFF" />
          </g>
        </svg>
      );

    // ----------------------------------------------------
    // 7. CROWN (التاج الملكي الإمبراطوري)
    // ----------------------------------------------------
    case 'crown':
      return (
        <svg
          viewBox="0 0 200 200"
          className={`w-full h-full pointer-events-none drop-shadow-xl select-none ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="crw_gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#0A3D62" />
              <stop offset="50%" stopColor="#C7CDD3" />
              <stop offset="75%" stopColor="#16324F" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <linearGradient id="crw_ruby" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#16324F" />
              <stop offset="40%" stopColor="#0A3D62" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <linearGradient id="crw_sapphire" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C7CDD3" />
              <stop offset="50%" stopColor="#0A3D62" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <filter id="crw_shadow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#16324F" floodOpacity="0.75" />
            </filter>
          </defs>

          {/* Royal Scepter Wings Left */}
          <g filter="url(#crw_shadow)">
            <path
              d="M 40 76 C 16 58 10 32 24 16 C 32 38 48 60 62 74 Z"
              fill="url(#crw_gold)"
              stroke="#16324F"
              strokeWidth="1.5"
            />
            <circle cx="24" cy="16" r="3.5" fill="#FFFFFF" stroke="#16324F" strokeWidth="1" />
            <path
              d="M 38 124 C 14 142 8 168 22 184 C 30 162 46 140 60 126 Z"
              fill="url(#crw_gold)"
              stroke="#16324F"
              strokeWidth="1.5"
            />
            <circle cx="22" cy="184" r="3.5" fill="#FFFFFF" stroke="#16324F" strokeWidth="1" />
          </g>

          {/* Royal Scepter Wings Right */}
          <g filter="url(#crw_shadow)">
            <path
              d="M 160 76 C 184 58 190 32 176 16 C 168 38 152 60 138 74 Z"
              fill="url(#crw_gold)"
              stroke="#16324F"
              strokeWidth="1.5"
            />
            <circle cx="176" cy="16" r="3.5" fill="#FFFFFF" stroke="#16324F" strokeWidth="1" />
            <path
              d="M 162 124 C 186 142 192 168 178 184 C 170 162 154 140 140 126 Z"
              fill="url(#crw_gold)"
              stroke="#16324F"
              strokeWidth="1.5"
            />
            <circle cx="178" cy="184" r="3.5" fill="#FFFFFF" stroke="#16324F" strokeWidth="1" />
          </g>

          {/* Outer Royal Ring */}
          <circle
            cx="100"
            cy="100"
            r="78"
            stroke="url(#crw_gold)"
            strokeWidth="11"
            filter="url(#crw_shadow)"
          />
          <circle cx="100" cy="100" r="84" stroke="#16324F" strokeWidth="2" />
          <circle cx="100" cy="100" r="72" stroke="#16324F" strokeWidth="2" />

          {/* Inner Specular Bevel Ring */}
          <circle cx="100" cy="100" r="67" stroke="url(#crw_gold)" strokeWidth="4.5" />
          <circle cx="100" cy="100" r="65" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.9" />

          {/* Side Crown Jewels */}
          <circle cx="34" cy="100" r="4" fill="url(#crw_sapphire)" stroke="#FFFFFF" strokeWidth="1" />
          <circle cx="166" cy="100" r="4" fill="url(#crw_sapphire)" stroke="#FFFFFF" strokeWidth="1" />

          {/* Bottom Royal Mantle Shield */}
          <g filter="url(#crw_shadow)">
            <path
              d="M 72 162 Q 100 176 128 162 L 100 196 Z"
              fill="url(#crw_gold)"
              stroke="#16324F"
              strokeWidth="2"
            />
            {/* Imperial Burgundy Gem */}
            <polygon points="100,166 110,178 100,190 90,178" fill="url(#crw_ruby)" stroke="#FFFFFF" strokeWidth="1.5" />
            <circle cx="97" cy="175" r="1.5" fill="#FFFFFF" />
          </g>

          {/* Top Imperial 5-Peak Royal Crown */}
          <g filter="url(#crw_shadow)">
            <path
              d="M 64 36 Q 100 18 136 36 Q 100 46 64 36 Z"
              fill="url(#crw_ruby)"
              stroke="#16324F"
              strokeWidth="1.5"
            />
            <path
              d="M 58 40 L 64 16 L 82 28 L 100 4 L 118 28 L 136 16 L 142 40 Q 100 48 58 40 Z"
              fill="url(#crw_gold)"
              stroke="#16324F"
              strokeWidth="2"
            />
            <circle cx="64" cy="16" r="3" fill="#FFFFFF" stroke="#16324F" strokeWidth="1" />
            <circle cx="100" cy="4" r="4" fill="#FFFFFF" stroke="#16324F" strokeWidth="1.2" />
            <circle cx="136" cy="16" r="3" fill="#FFFFFF" stroke="#16324F" strokeWidth="1" />

            <circle cx="78" cy="38" r="3" fill="url(#crw_sapphire)" stroke="#FFFFFF" strokeWidth="1" />
            <circle cx="100" cy="36" r="4.5" fill="url(#crw_ruby)" stroke="#FFFFFF" strokeWidth="1.2" />
            <circle cx="122" cy="38" r="3" fill="url(#crw_sapphire)" stroke="#FFFFFF" strokeWidth="1" />
            <circle cx="98.5" cy="34.5" r="1.5" fill="#FFFFFF" />
          </g>
        </svg>
      );

    // ----------------------------------------------------
    // 8. LEGENDARY CHAMPION (البطل الأسطوري)
    // ----------------------------------------------------
    case 'champion':
      return (
        <svg
          viewBox="0 0 200 200"
          className={`w-full h-full pointer-events-none drop-shadow-2xl select-none ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="leg_gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="20%" stopColor="#0A3D62" />
              <stop offset="40%" stopColor="#C7CDD3" />
              <stop offset="65%" stopColor="#16324F" />
              <stop offset="85%" stopColor="#6F7882" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <linearGradient id="leg_crimson" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#16324F" />
              <stop offset="30%" stopColor="#0A3D62" />
              <stop offset="70%" stopColor="#16324F" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <linearGradient id="leg_bright_gold" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="30%" stopColor="#C7CDD3" />
              <stop offset="70%" stopColor="#0A3D62" />
              <stop offset="100%" stopColor="#16324F" />
            </linearGradient>
            <radialGradient id="leg_core_glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0A3D62" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0A3D62" stopOpacity="0" />
            </radialGradient>
            <filter id="leg_shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3.5" stdDeviation="3.5" floodColor="#16324F" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Grand Layered Wings Left */}
          <g filter="url(#leg_shadow)">
            <path
              d="M 46 84 C 10 64 -6 28 8 2 C 20 30 38 60 62 76 Z"
              fill="url(#leg_crimson)"
              stroke="#16324F"
              strokeWidth="2"
            />
            <path
              d="M 38 116 C 4 136 -4 168 12 198 C 22 170 42 144 60 128 Z"
              fill="url(#leg_crimson)"
              stroke="#16324F"
              strokeWidth="2"
            />
            <path
              d="M 44 80 C 14 62 4 32 20 10 C 28 34 46 58 64 74 Z"
              fill="url(#leg_gold)"
              stroke="#16324F"
              strokeWidth="2"
            />
            <path
              d="M 32 100 C 4 92 -4 68 6 44 C 16 64 32 82 48 94 Z"
              fill="url(#leg_bright_gold)"
              stroke="#16324F"
              strokeWidth="1.5"
            />
            <path
              d="M 38 120 C 12 134 6 160 22 184 C 28 162 44 144 60 130 Z"
              fill="url(#leg_gold)"
              stroke="#16324F"
              strokeWidth="2"
            />
          </g>

          {/* Grand Layered Wings Right */}
          <g filter="url(#leg_shadow)">
            <path
              d="M 154 84 C 190 64 206 28 192 2 C 180 30 162 60 138 76 Z"
              fill="url(#leg_crimson)"
              stroke="#16324F"
              strokeWidth="2"
            />
            <path
              d="M 162 116 C 196 136 204 168 188 198 C 178 170 158 144 140 128 Z"
              fill="url(#leg_crimson)"
              stroke="#16324F"
              strokeWidth="2"
            />
            <path
              d="M 156 80 C 186 62 196 32 180 10 C 172 34 154 58 136 74 Z"
              fill="url(#leg_gold)"
              stroke="#16324F"
              strokeWidth="2"
            />
            <path
              d="M 168 100 C 196 92 204 68 194 44 C 184 64 168 82 152 94 Z"
              fill="url(#leg_bright_gold)"
              stroke="#16324F"
              strokeWidth="1.5"
            />
            <path
              d="M 162 120 C 188 134 194 160 178 184 C 172 162 156 144 140 130 Z"
              fill="url(#leg_gold)"
              stroke="#16324F"
              strokeWidth="2"
            />
          </g>

          {/* Heavy Dual-Tone Legendary Ring */}
          <circle
            cx="100"
            cy="100"
            r="80"
            stroke="url(#leg_crimson)"
            strokeWidth="13"
            filter="url(#leg_shadow)"
          />
          <circle
            cx="100"
            cy="100"
            r="77"
            stroke="url(#leg_gold)"
            strokeWidth="8"
          />
          <circle cx="100" cy="100" r="85" stroke="#16324F" strokeWidth="2" />
          <circle cx="100" cy="100" r="71" stroke="#16324F" strokeWidth="2" />

          {/* Glowing Inner Bevel Specular Ring */}
          <circle cx="100" cy="100" r="67" stroke="url(#leg_bright_gold)" strokeWidth="5" />
          <circle cx="100" cy="100" r="65" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.95" />

          {/* Corner Horn Spikes */}
          <polygon points="44,60 28,48 48,52" fill="url(#leg_bright_gold)" stroke="#16324F" strokeWidth="1.5" />
          <polygon points="156,60 172,48 152,52" fill="url(#leg_bright_gold)" stroke="#16324F" strokeWidth="1.5" />
          <polygon points="44,140 28,152 48,148" fill="url(#leg_bright_gold)" stroke="#16324F" strokeWidth="1.5" />
          <polygon points="156,140 172,152 152,148" fill="url(#leg_bright_gold)" stroke="#16324F" strokeWidth="1.5" />

          {/* Bottom Shield & Burgundy Core */}
          <g filter="url(#leg_shadow)">
            <path
              d="M 64 168 L 100 198 L 136 168 L 100 156 Z"
              fill="url(#leg_gold)"
              stroke="#16324F"
              strokeWidth="2"
            />
            <polygon
              points="100,164 114,178 100,194 86,178"
              fill="url(#leg_crimson)"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            <polygon points="100,164 107,178 100,194" fill="#16324F" fillOpacity="0.6" />
            <circle cx="96.5" cy="174.5" r="2" fill="#FFFFFF" />
          </g>

          {/* Top Legendary Crest */}
          <g filter="url(#leg_shadow)">
            <polygon points="100,0 114,24 100,34 86,24" fill="url(#leg_crimson)" stroke="#16324F" strokeWidth="1.5" />
            <polygon points="68,10 84,30 76,38 60,20" fill="url(#leg_crimson)" stroke="#16324F" strokeWidth="1.5" />
            <polygon points="132,10 116,30 124,38 140,20" fill="url(#leg_crimson)" stroke="#16324F" strokeWidth="1.5" />

            <polygon points="100,4 110,26 100,38 90,26" fill="url(#leg_bright_gold)" stroke="#16324F" strokeWidth="2" />
            <polygon points="76,14 90,32 80,40 68,26" fill="url(#leg_gold)" stroke="#16324F" strokeWidth="1.5" />
            <polygon points="124,14 110,32 120,40 132,26" fill="url(#leg_gold)" stroke="#16324F" strokeWidth="1.5" />

            <circle cx="100" cy="34" r="12" fill="url(#leg_gold)" stroke="#16324F" strokeWidth="2" />
            <polygon
              points="100,24 109,34 100,44 91,34"
              fill="url(#leg_crimson)"
              stroke="#FFFFFF"
              strokeWidth="1.8"
            />
            <circle cx="97" cy="31" r="2.5" fill="#FFFFFF" />
          </g>
        </svg>
      );

    default:
      return null;
  }
};
