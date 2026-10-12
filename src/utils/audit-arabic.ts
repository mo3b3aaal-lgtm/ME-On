import fs from 'fs';
import path from 'path';

function scan(dir: string) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') {
        scan(full);
      }
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      if (f === 'translations.ts' || f === 'audit-arabic.ts') continue;
      const content = fs.readFileSync(full, 'utf-8');
      const lines = content.split('\n');
      const arabicLines: { line: number; text: string }[] = [];
      lines.forEach((l, idx) => {
        // Exclude comments
        const trimmed = l.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
        // Check if line contains Arabic
        if (/[\u0600-\u06FF]/.test(l)) {
          // Check if it is guarded by isEn / isRTL / language check
          if (!l.includes('isEn') && !l.includes('isRTL') && !l.includes('language') && !l.includes('getAppLanguage') && !l.includes('ARABIC_') && !l.includes('MONTH_NAMES_') && !l.includes('CALENDAR_WEEKDAY_')) {
            arabicLines.push({ line: idx + 1, text: l.trim().substring(0, 100) });
          }
        }
      });
      if (arabicLines.length > 0) {
        console.log(`\n${full}: ${arabicLines.length} UNGUARDED arabic lines`);
        arabicLines.slice(0, 5).forEach((al) => {
          console.log(`  [L${al.line}] ${al.text}`);
        });
      }
    }
  }
}

scan('src');
