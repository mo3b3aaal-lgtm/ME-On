import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Exact Classy Owl SVG content as rendered in Splash & Mascot component
const owlSvgCore = `
  <defs>
    <!-- Owl Body Gradient - Indigo / Violet -->
    <linearGradient id="owlBodyGrad" x1="40" y1="20" x2="160" y2="180" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#8A70FF" />
      <stop offset="50%" stop-color="#6C5CE7" />
      <stop offset="100%" stop-color="#4A3EC7" />
    </linearGradient>

    <!-- Owl Belly Gradient - Soft Lavender / Rose -->
    <linearGradient id="owlBellyGrad" x1="100" y1="90" x2="100" y2="175" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="60%" stop-color="#F5EDFF" />
      <stop offset="100%" stop-color="#E9DEFC" />
    </linearGradient>

    <!-- Eye Glasses / Accent Gradient - Vibrant Coral / Amber -->
    <linearGradient id="owlCoralGrad" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FF758C" />
      <stop offset="100%" stop-color="#FF5E62" />
    </linearGradient>

    <!-- Beak & Feet - Golden Amber -->
    <linearGradient id="owlGoldGrad" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFD166" />
      <stop offset="100%" stop-color="#FF9F1C" />
    </linearGradient>

    <!-- Graduation Cap Grad -->
    <linearGradient id="capGrad" x1="50" y1="10" x2="150" y2="50" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#252646" />
      <stop offset="100%" stop-color="#15162B" />
    </linearGradient>

    <!-- Floating Sparkle Gradient -->
    <linearGradient id="sparkleGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFAA2C" />
      <stop offset="100%" stop-color="#FF5E62" />
    </linearGradient>

    <!-- Icon Background Radial Lighting -->
    <radialGradient id="iconBgGrad" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#28224C" />
      <stop offset="65%" stop-color="#1A1B36" />
      <stop offset="100%" stop-color="#14152C" />
    </radialGradient>

    <!-- Ambient Glow behind Owl -->
    <radialGradient id="ambientAura" cx="100" cy="100" r="90" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7B61FF" stop-opacity="0.4" />
      <stop offset="50%" stop-color="#FF5E62" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#38B6FF" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Ambient Glow -->
  <circle cx="100" cy="100" r="90" fill="url(#ambientAura)" />

  <!-- Ambient Sparkles -->
  <path
    d="M32 45L34.5 37.5L42 35L34.5 32.5L32 25L29.5 32.5L22 35L29.5 37.5L32 45Z"
    fill="url(#sparkleGrad)"
  />
  <path
    d="M172 65L174 59L180 57L174 55L172 49L170 55L164 57L170 59L172 65Z"
    fill="#38B6FF"
    opacity="0.85"
  />
  <circle cx="168" cy="140" r="3.5" fill="#FF758C" opacity="0.75" />
  <circle cx="28" cy="130" r="2.5" fill="#8A70FF" opacity="0.6" />

  <!-- Feet / Talons -->
  <g id="feet">
    <ellipse cx="82" cy="180" rx="9" ry="5" fill="url(#owlGoldGrad)" />
    <ellipse cx="73" cy="179" rx="7" ry="4.5" fill="url(#owlGoldGrad)" />
    <ellipse cx="91" cy="179" rx="7" ry="4.5" fill="url(#owlGoldGrad)" />

    <ellipse cx="118" cy="180" rx="9" ry="5" fill="url(#owlGoldGrad)" />
    <ellipse cx="109" cy="179" rx="7" ry="4.5" fill="url(#owlGoldGrad)" />
    <ellipse cx="127" cy="179" rx="7" ry="4.5" fill="url(#owlGoldGrad)" />
  </g>

  <!-- Outer Body / Head Shape with Tufted Feather Ears -->
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

  <!-- Left Wing -->
  <path
    d="M48 95 C32 110, 32 145, 54 160 C58 145, 56 115, 48 95 Z"
    fill="#5D50FE"
    stroke="#4A3EC7"
    stroke-width="2"
  />

  <!-- Right Wing -->
  <path
    d="M152 95 C168 110, 168 145, 146 160 C142 145, 144 115, 152 95 Z"
    fill="#5D50FE"
    stroke="#4A3EC7"
    stroke-width="2"
  />

  <!-- Belly Plumes / Vest -->
  <path
    d="M68 105
       C68 90, 132 90, 132 105
       C132 148, 124 172, 100 172
       C76 172, 68 148, 68 105 Z"
    fill="url(#owlBellyGrad)"
  />

  <!-- Belly Decorative Chevron Feathers -->
  <path
    d="M88 122 Q100 130 112 122"
    stroke="#C8B5F5"
    stroke-width="2.5"
    stroke-linecap="round"
    fill="none"
  />
  <path
    d="M84 138 Q100 148 116 138"
    stroke="#C8B5F5"
    stroke-width="2.5"
    stroke-linecap="round"
    fill="none"
  />
  <path
    d="M90 154 Q100 162 110 154"
    stroke="#C8B5F5"
    stroke-width="2.5"
    stroke-linecap="round"
    fill="none"
  />

  <!-- Eye Sockets / Facial Discs -->
  <ellipse cx="77" cy="85" rx="22" ry="22" fill="#FFFFFF" />
  <ellipse cx="123" cy="85" rx="22" ry="22" fill="#FFFFFF" />

  <!-- Left Eye -->
  <ellipse cx="78" cy="85" rx="14" ry="14" fill="#1A1B36" />
  <ellipse cx="80" cy="82" rx="12" ry="12" fill="#4A3EC7" />
  <ellipse cx="81" cy="84" rx="9" ry="9" fill="#131429" />
  <circle cx="77" cy="80" r="4.5" fill="#FFFFFF" />
  <circle cx="84" cy="88" r="2" fill="#FFFFFF" />

  <!-- Right Eye -->
  <ellipse cx="122" cy="85" rx="14" ry="14" fill="#1A1B36" />
  <ellipse cx="120" cy="82" rx="12" ry="12" fill="#4A3EC7" />
  <ellipse cx="119" cy="84" rx="9" ry="9" fill="#131429" />
  <circle cx="116" cy="80" r="4.5" fill="#FFFFFF" />
  <circle cx="123" cy="88" r="2" fill="#FFFFFF" />

  <!-- Smart Glasses Frames (Warm Coral / Rose) -->
  <circle cx="77" cy="85" r="23" stroke="url(#owlCoralGrad)" stroke-width="3.5" fill="none" opacity="0.95" />
  <circle cx="123" cy="85" r="23" stroke="url(#owlCoralGrad)" stroke-width="3.5" fill="none" opacity="0.95" />
  <!-- Bridge -->
  <line x1="97" y1="84" x2="103" y2="84" stroke="url(#owlCoralGrad)" stroke-width="3.5" stroke-linecap="round" />

  <!-- Beak -->
  <polygon points="100,90 92,104 108,104" fill="url(#owlGoldGrad)" />
  <polygon points="100,108 94,104 106,104" fill="#E08700" />

  <!-- Cheerful Blush Patches -->
  <ellipse cx="58" cy="98" rx="7" ry="4" fill="#FF758C" opacity="0.45" />
  <ellipse cx="142" cy="98" rx="7" ry="4" fill="#FF758C" opacity="0.45" />

  <!-- Academic Graduation Cap (Mortarboard) -->
  <g id="gradCap">
    <path
      d="M80 44 C80 37, 120 37, 120 44 L116 52 C116 54, 84 54, 84 52 Z"
      fill="#121326"
    />
    <polygon
      points="100,20 152,36 100,48 48,36"
      fill="url(#capGrad)"
      stroke="#6C5CE7"
      stroke-width="1.5"
    />
    <ellipse cx="100" cy="35" rx="3.5" ry="2.5" fill="#FFD166" />
    <path
      d="M100 35 Q135 37 142 54"
      stroke="#FFD166"
      stroke-width="2.5"
      stroke-linecap="round"
      fill="none"
    />
    <polygon points="142,54 138,68 146,68" fill="#FF9F1C" />
  </g>
`;

// Full App Icon SVG with Royal background (for launcher & web)
const fullIconSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="115" fill="url(#iconBgGrad)" />
  <g transform="translate(56, 56) scale(2)">
    ${owlSvgCore}
  </g>
</svg>
`;

// Round App Icon SVG (for round launcher icon)
const roundIconSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="256" cy="256" r="256" fill="url(#iconBgGrad)" />
  <g transform="translate(56, 56) scale(2)">
    ${owlSvgCore}
  </g>
</svg>
`;

// Adaptive Icon Foreground (transparent background, safe centered for 108dp Android adaptive icon)
const adaptiveForegroundSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Scaled into safe area (66% of 512 = ~340px centered) -->
  <g transform="translate(86, 86) scale(1.7)">
    ${owlSvgCore}
  </g>
</svg>
`;

// Splash Screen artwork with Classy branding
const splashSvg = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1080" height="1920" fill="#14152C" />
  <circle cx="540" cy="850" r="380" fill="#7B61FF" opacity="0.18" filter="blur(80px)" />
  <circle cx="540" cy="850" r="240" fill="#FF5E62" opacity="0.15" filter="blur(60px)" />
  
  <g transform="translate(340, 650) scale(2)">
    ${owlSvgCore}
  </g>
  
  <text x="540" y="1120" font-family="'IBM Plex Sans Arabic', sans-serif" font-size="52" font-weight="900" fill="#FFFFFF" text-anchor="middle">Classy كلاسـي</text>
  <text x="540" y="1170" font-family="'IBM Plex Sans Arabic', sans-serif" font-size="24" font-weight="500" fill="#9A9CB8" text-anchor="middle">المنظومة الذكية لإدارة التدريس والطلاب</text>
</svg>
`;

async function generateAllIcons() {
  console.log('Generating Classy official owl app icons...');

  // 1. Web icons
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), fullIconSvg);

  await sharp(Buffer.from(fullIconSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon.png'));

  await sharp(Buffer.from(fullIconSvg))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));

  await sharp(Buffer.from(fullIconSvg))
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));

  console.log('✓ Generated public web icons (icon.png, icon-192.png, favicon.svg, favicon.ico)');

  // 2. Android launcher mipmaps
  const mipmaps = [
    { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
  ];

  const resDir = path.resolve('android/app/src/main/res');

  if (fs.existsSync(resDir)) {
    for (const m of mipmaps) {
      const targetDir = path.join(resDir, m.dir);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

      // Standard square/squircle icon
      await sharp(Buffer.from(fullIconSvg))
        .resize(m.size, m.size)
        .png()
        .toFile(path.join(targetDir, 'ic_launcher.png'));

      // Round icon
      await sharp(Buffer.from(roundIconSvg))
        .resize(m.size, m.size)
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_round.png'));

      // Adaptive Foreground icon
      await sharp(Buffer.from(adaptiveForegroundSvg))
        .resize(m.fgSize, m.fgSize)
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));
    }
    console.log('✓ Generated all Android mipmap launcher icons');

    // 3. Android Splash screens
    const splashDrawables = [
      'drawable',
      'drawable-port-mdpi',
      'drawable-port-hdpi',
      'drawable-port-xhdpi',
      'drawable-port-xxhdpi',
      'drawable-port-xxxhdpi',
      'drawable-land-mdpi',
      'drawable-land-hdpi',
      'drawable-land-xhdpi',
      'drawable-land-xxhdpi',
      'drawable-land-xxxhdpi',
    ];

    for (const d of splashDrawables) {
      const dDir = path.join(resDir, d);
      if (fs.existsSync(dDir)) {
        await sharp(Buffer.from(splashSvg))
          .resize(d.includes('land') ? 1920 : 1080, d.includes('land') ? 1080 : 1920, {
            fit: 'cover',
          })
          .png()
          .toFile(path.join(dDir, 'splash.png'));
      }
    }
    console.log('✓ Generated Android splash screens');
  }

  console.log('All icons generated successfully!');
}

generateAllIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
