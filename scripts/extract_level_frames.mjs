import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC_IMAGE = 'public/assets/aistudio/Screenshot_2026-10-27-14-42-30-259_com.android.chrome_fab7fde7.jpg';
const OUT_DIR = 'public/assets/frames';

// Exact 10 frames from the uploaded Golden Level Up Frames artwork,
// ordered from Level 1 -> Level 10 (Level Max) by ascending visual progression.
const FRAME_SPECS = [
  { level: 1, file: 'level-1.png', row: 1, col: 0, x0: 20, x1: 196, y0: 310, y1: 520, outSize: 280 },
  { level: 2, file: 'level-2.png', row: 1, col: 1, x0: 196, x1: 375, y0: 310, y1: 520, outSize: 280 },
  { level: 3, file: 'level-3.png', row: 0, col: 0, x0: 20, x1: 196, y0: 65, y1: 270, outSize: 280 },
  { level: 4, file: 'level-4.png', row: 0, col: 1, x0: 196, x1: 375, y0: 65, y1: 270, outSize: 280 },
  { level: 5, file: 'level-5.png', row: 1, col: 2, x0: 375, x1: 577, y0: 300, y1: 530, outSize: 300 },
  { level: 6, file: 'level-6.png', row: 0, col: 2, x0: 375, x1: 577, y0: 55, y1: 280, outSize: 300 },
  { level: 7, file: 'level-7.png', row: 1, col: 3, x0: 577, x1: 808, y0: 300, y1: 530, outSize: 320 },
  { level: 8, file: 'level-8.png', row: 0, col: 3, x0: 577, x1: 808, y0: 45, y1: 288, outSize: 320 },
  { level: 9, file: 'level-9.png', row: 1, col: 4, x0: 808, x1: 1130, y0: 294, y1: 535, outSize: 340 },
  { level: 10, file: 'level-10.png', row: 0, col: 4, x0: 808, x1: 1135, y0: 20, y1: 290, outSize: 384 },
];

const BG_COLS = [15, 196, 375, 577, 808, 1135];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { data, info } = await sharp(SRC_IMAGE)
    .extract({ left: 64, top: 1214, width: 1151, height: 572 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width;
  const H = info.height;
  const C = info.channels;

  // Smoothly sample background at pure vertical anchor columns (averaged over 5px vertically)
  const bgAnchors = new Float32Array(H * BG_COLS.length * 3);
  for (let y = 0; y < H; y++) {
    for (let k = 0; k < BG_COLS.length; k++) {
      const ax = BG_COLS[k];
      let sr = 0, sg = 0, sb = 0, cnt = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const sy = clamp(y + dy, 0, H - 1);
        for (let dx = -1; dx <= 1; dx++) {
          const sx = clamp(ax + dx, 0, W - 1);
          const idx = (sy * W + sx) * C;
          sr += data[idx];
          sg += data[idx + 1];
          sb += data[idx + 2];
          cnt++;
        }
      }
      const outIdx = (y * BG_COLS.length + k) * 3;
      bgAnchors[outIdx] = sr / cnt;
      bgAnchors[outIdx + 1] = sg / cnt;
      bgAnchors[outIdx + 2] = sb / cnt;
    }
  }

  function getBg(x, y) {
    const cy = clamp(Math.round(y), 0, H - 1);
    if (x <= BG_COLS[0]) {
      const o = (cy * BG_COLS.length + 0) * 3;
      return [bgAnchors[o], bgAnchors[o + 1], bgAnchors[o + 2]];
    }
    if (x >= BG_COLS[BG_COLS.length - 1]) {
      const o = (cy * BG_COLS.length + (BG_COLS.length - 1)) * 3;
      return [bgAnchors[o], bgAnchors[o + 1], bgAnchors[o + 2]];
    }
    let seg = 0;
    while (seg < BG_COLS.length - 2 && x > BG_COLS[seg + 1]) seg++;
    const xA = BG_COLS[seg];
    const xB = BG_COLS[seg + 1];
    const t = (x - xA) / (xB - xA);
    const oA = (cy * BG_COLS.length + seg) * 3;
    const oB = (cy * BG_COLS.length + seg + 1) * 3;
    return [
      bgAnchors[oA] * (1 - t) + bgAnchors[oB] * t,
      bgAnchors[oA + 1] * (1 - t) + bgAnchors[oB + 1] * t,
      bgAnchors[oA + 2] * (1 - t) + bgAnchors[oB + 2] * t,
    ];
  }

  function colorDist(x, y) {
    const idx = (y * W + x) * C;
    const [br, bg, bb] = getBg(x, y);
    return Math.hypot(data[idx] - br, data[idx + 1] - bg, data[idx + 2] - bb);
  }

  const report = [];
  const previewComposites = [];

  for (const spec of FRAME_SPECS) {
    const { x0, x1, y0, y1 } = spec;
    const pw = x1 - x0 + 1;
    const ph = y1 - y0 + 1;

    function isCoreArtwork(gx, gy) {
      const idx = (gy * W + gx) * C;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const d = colorDist(gx, gy);
      if (d <= 28) return false;
      // True frame pixels are warm gold/amber, purple/amethyst, or bright sapphire/icy-blue wings
      if (r > b + 22 && r > 96) return true; // gold & amber body
      if (b > 118 && (r > 72 || g > 95)) return true; // amethyst leaves/gems or icy wings/sapphires
      if (r > 125 || g > 115 || b > 140) return true; // bright highlights
      return false;
    }

    // Build initial core mask
    const coreMask = new Uint8Array(pw * ph);
    for (let ly = 0; ly < ph; ly++) {
      for (let lx = 0; lx < pw; lx++) {
        if (isCoreArtwork(x0 + lx, y0 + ly)) {
          coreMask[ly * pw + lx] = 1;
        }
      }
    }

    // Preliminary center X from coreMask to prune asymmetric lens-flare/watermark smudges
    let sumCoreX = 0, cntCore = 0;
    for (let ly = 0; ly < ph; ly++) {
      for (let lx = 0; lx < pw; lx++) {
        if (coreMask[ly * pw + lx]) {
          sumCoreX += lx;
          cntCore++;
        }
      }
    }
    const approxLocalCx = cntCore > 0 ? sumCoreX / cntCore : pw / 2;

    // Remove isolated specks AND asymmetric exterior flare smudges (all 10 frames have symmetric silhouettes)
    const cleanCore = new Uint8Array(pw * ph);
    for (let ly = 1; ly < ph - 1; ly++) {
      for (let lx = 1; lx < pw - 1; lx++) {
        if (!coreMask[ly * pw + lx]) continue;
        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (coreMask[(ly + dy) * pw + (lx + dx)]) neighbors++;
          }
        }
        if (neighbors < 2) continue;

        // Check 3px-tolerant horizontal mirror presence in coreMask
        const mx = Math.round(2 * approxLocalCx - lx);
        let hasMirror = false;
        for (let dy = -3; dy <= 3 && !hasMirror; dy++) {
          for (let dx = -3; dx <= 3 && !hasMirror; dx++) {
            const tx = mx + dx, ty = ly + dy;
            if (tx >= 0 && tx < pw && ty >= 0 && ty < ph && coreMask[ty * pw + tx]) {
              hasMirror = true;
            }
          }
        }
        if (hasMirror) cleanCore[ly * pw + lx] = 1;
      }
    }

    // Allow up to 1.5px around cleanCore for the crisp painted dark outline
    const fgAllowed = new Uint8Array(pw * ph);
    for (let ly = 0; ly < ph; ly++) {
      for (let lx = 0; lx < pw; lx++) {
        if (cleanCore[ly * pw + lx]) {
          fgAllowed[ly * pw + lx] = 2; // solid core
          continue;
        }
        let nearCore = false;
        for (let dy = -2; dy <= 2 && !nearCore; dy++) {
          for (let dx = -2; dx <= 2 && !nearCore; dx++) {
            if (dx * dx + dy * dy > 2) continue;
            const nx = lx + dx, ny = ly + dy;
            if (nx >= 0 && nx < pw && ny >= 0 && ny < ph && cleanCore[ny * pw + nx]) {
              nearCore = true;
            }
          }
        }
        if (nearCore) fgAllowed[ly * pw + lx] = 1; // outline band
      }
    }

    // 1. Find foreground bounding box inside patch using fgAllowed
    let bx0 = x1, bx1 = x0, by0 = y1, by1 = y0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (fgAllowed[(y - y0) * pw + (x - x0)] && colorDist(x, y) > 20) {
          if (x < bx0) bx0 = x;
          if (x > bx1) bx1 = x;
          if (y < by0) by0 = y;
          if (y > by1) by1 = y;
        }
      }
    }

    // 2. Refine inner circular hole center & radius across 36 angular rays!
    let cx = (bx0 + bx1) / 2;
    let cy = (by0 + by1) / 2;
    for (let iter = 0; iter < 5; iter++) {
      const rayHits = [];
      for (let a = 0; a < 36; a++) {
        const theta = (a * Math.PI * 2) / 36;
        const dx = Math.cos(theta);
        const dy = Math.sin(theta);
        let r = 10;
        while (r < 80) {
          const rx = Math.round(cx + dx * r);
          const ry = Math.round(cy + dy * r);
          if (colorDist(rx, ry) > 28) break;
          r += 0.5;
        }
        rayHits.push({ x: cx + dx * r, y: cy + dy * r, r });
      }
      let sumX = 0, sumY = 0;
      for (const hit of rayHits) {
        sumX += hit.x;
        sumY += hit.y;
      }
      cx = sumX / rayHits.length;
      cy = sumY / rayHits.length;
    }

    let sumR = 0;
    for (let a = 0; a < 72; a++) {
      const theta = (a * Math.PI * 2) / 72;
      const dx = Math.cos(theta);
      const dy = Math.sin(theta);
      let r = 10;
      while (r < 80) {
        const rx = Math.round(cx + dx * r);
        const ry = Math.round(cy + dy * r);
        if (colorDist(rx, ry) > 28) break;
        r += 0.25;
      }
      sumR += r;
    }
    const holeR = sumR / 72;

    // 3. Flood-fill exterior background + inner hole background (8-connected)
    const bgMask = new Uint8Array(pw * ph); // 0 = fg, 1 = bg
    const queue = [];

    const trySeed = (lx, ly) => {
      if (lx < 0 || lx >= pw || ly < 0 || ly >= ph) return;
      const pIdx = ly * pw + lx;
      if (bgMask[pIdx]) return;
      // Anything outside fgAllowed OR very close to local BG is background
      if (!fgAllowed[pIdx] || colorDist(x0 + lx, y0 + ly) <= 20) {
        bgMask[pIdx] = 1;
        queue.push([lx, ly]);
      }
    };

    for (let lx = 0; lx < pw; lx++) {
      trySeed(lx, 0);
      trySeed(lx, ph - 1);
    }
    for (let ly = 0; ly < ph; ly++) {
      trySeed(0, ly);
      trySeed(pw - 1, ly);
    }
    const hcx = Math.round(cx - x0);
    const hcy = Math.round(cy - y0);
    for (let dy = -12; dy <= 12; dy++) {
      for (let dx = -12; dx <= 12; dx++) {
        trySeed(hcx + dx, hcy + dy);
      }
    }

    let head = 0;
    while (head < queue.length) {
      const [ux, uy] = queue[head++];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          trySeed(ux + dx, uy + dy);
        }
      }
    }

    // 4. Compute boundary band for smooth anti-aliased edge unmixing
    const nearBg = new Uint8Array(pw * ph);
    for (let ly = 0; ly < ph; ly++) {
      for (let lx = 0; lx < pw; lx++) {
        const pIdx = ly * pw + lx;
        if (bgMask[pIdx]) {
          nearBg[pIdx] = 1;
          continue;
        }
        let touchesBg = false;
        for (let dy = -2; dy <= 2 && !touchesBg; dy++) {
          for (let dx = -2; dx <= 2 && !touchesBg; dx++) {
            const nx = lx + dx, ny = ly + dy;
            if (nx >= 0 && nx < pw && ny >= 0 && ny < ph && bgMask[ny * pw + nx]) {
              touchesBg = true;
            }
          }
        }
        if (touchesBg) nearBg[pIdx] = 2;
      }
    }

    // 5. Build centered square canvas around (cx, cy) with tight symmetrical padding
    const maxSpanX = Math.max(cx - bx0, bx1 - cx);
    const maxSpanY = Math.max(cy - by0, by1 - cy);
    const maxOuterR = Math.max(maxSpanX, maxSpanY);
    const cropHalf = Math.ceil(maxOuterR + 4);
    const cropDim = cropHalf * 2;

    const rgbaCrop = Buffer.alloc(cropDim * cropDim * 4, 0);
    const icx = Math.round(cx);
    const icy = Math.round(cy);

    for (let oy = 0; oy < cropDim; oy++) {
      const gy = icy - cropHalf + oy;
      const ly = gy - y0;
      for (let ox = 0; ox < cropDim; ox++) {
        const gx = icx - cropHalf + ox;
        const lx = gx - x0;
        if (lx < 0 || lx >= pw || ly < 0 || ly >= ph) continue;

        const pIdx = ly * pw + lx;
        const dstIdx = (oy * cropDim + ox) * 4;

        const rFromHole = Math.hypot(gx - cx, gy - cy);
        if (rFromHole < holeR - 1.8) {
          continue;
        }

        if (bgMask[pIdx] || !fgAllowed[pIdx]) {
          continue;
        }

        const srcIdx = (gy * W + gx) * C;
        let r = data[srcIdx];
        let g = data[srcIdx + 1];
        let b = data[srcIdx + 2];
        let alpha = 1.0;

        if (nearBg[pIdx] === 2 || fgAllowed[pIdx] === 1 || rFromHole < holeR + 1.8) {
          const [br, bgc, bb] = getBg(gx, gy);
          const dist = Math.hypot(r - br, g - bgc, b - bb);
          const minRamp = fgAllowed[pIdx] === 1 ? 18 : 12;
          const edgeAlpha = clamp((dist - minRamp) / 52, 0, 1);
          const holeAlpha = rFromHole < holeR + 1.5 ? clamp((rFromHole - (holeR - 1.4)) / 2.6, 0, 1) : 1.0;
          alpha = Math.min(edgeAlpha, holeAlpha);

          if (alpha <= 0.02) continue;

          if (alpha < 0.98) {
            const invA = Math.max(alpha, 0.22);
            r = clamp(Math.round((r - (1 - alpha) * br) / invA), 0, 255);
            g = clamp(Math.round((g - (1 - alpha) * bgc) / invA), 0, 255);
            b = clamp(Math.round((b - (1 - alpha) * bb) / invA), 0, 255);
          }
        }

        rgbaCrop[dstIdx] = r;
        rgbaCrop[dstIdx + 1] = g;
        rgbaCrop[dstIdx + 2] = b;
        rgbaCrop[dstIdx + 3] = Math.round(alpha * 255);
      }
    }

    // Resize smoothly with Lanczos3 to spec.outSize x spec.outSize PNG
    const outPath = path.join(OUT_DIR, spec.file);
    await sharp(rgbaCrop, { raw: { width: cropDim, height: cropDim, channels: 4 } })
      .resize(spec.outSize, spec.outSize, { kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 9 })
      .toFile(outPath);

    const holeRatio = Number(((holeR * 2) / cropDim).toFixed(4));
    const aspectSpanRatio = Number((maxSpanX / maxSpanY).toFixed(3));
    report.push({
      level: spec.level,
      file: `/assets/frames/${spec.file}`,
      cropDim,
      outSize: spec.outSize,
      holeR: Number(holeR.toFixed(2)),
      holeDiameterRatio: holeRatio, // inner hole diameter as fraction of PNG width
      outerToHoleRatio: Number((cropHalf / holeR).toFixed(3)),
      aspectSpanRatio,
    });

    previewComposites.push({ level: spec.level, outPath, holeRatio });
  }

  console.log('EXTRACTION_REPORT:', JSON.stringify(report, null, 2));

  if (!process.argv.includes('--preview')) {
    return;
  }

  // Optional verification contact sheet (--preview):
  // Top half on light Harbor Mint (#F1F7F7), bottom half on dark Harbor Navy (#0B1829),
  // each with a circular #17375E student avatar inside to verify alignment & zero halo!
  const cellW = 180;
  const cellH = 180;
  const sheetW = cellW * 5;
  const sheetH = cellH * 4;

  const baseSvg = `
    <svg width="${sheetW}" height="${sheetH}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${sheetW}" height="${cellH * 2}" fill="#F1F7F7"/>
      <rect x="0" y="${cellH * 2}" width="${sheetW}" height="${cellH * 2}" fill="#0B1829"/>
      ${previewComposites.map((item, idx) => {
        const col = idx % 5;
        const rowLight = Math.floor(idx / 5);
        const rowDark = rowLight + 2;
        const avatarR = 34;
        const cxL = col * cellW + cellW / 2;
        const cyL = rowLight * cellH + cellH / 2;
        const cxD = col * cellW + cellW / 2;
        const cyD = rowDark * cellH + cellH / 2;
        return `
          <circle cx="${cxL}" cy="${cyL}" r="${avatarR}" fill="#17375E"/>
          <text x="${cxL}" y="${cyL + 7}" font-family="sans-serif" font-size="22" font-weight="bold" fill="#FFFFFF" text-anchor="middle">ط</text>
          <text x="${cxL}" y="${cyL + 78}" font-family="sans-serif" font-size="13" font-weight="bold" fill="#17375E" text-anchor="middle">Lv.${item.level}</text>
          <circle cx="${cxD}" cy="${cyD}" r="${avatarR}" fill="#17375E"/>
          <text x="${cxD}" y="${cyD + 7}" font-family="sans-serif" font-size="22" font-weight="bold" fill="#FFFFFF" text-anchor="middle">ط</text>
          <text x="${cxD}" y="${cyD + 78}" font-family="sans-serif" font-size="13" font-weight="bold" fill="#EEF7F6" text-anchor="middle">Lv.${item.level}</text>
        `;
      }).join('')}
    </svg>
  `;

  const overlays = [];
  for (let idx = 0; idx < previewComposites.length; idx++) {
    const item = previewComposites[idx];
    const col = idx % 5;
    const rowLight = Math.floor(idx / 5);
    const rowDark = rowLight + 2;
    const avatarDiameter = 68;
    const framePx = Math.round((avatarDiameter * 0.965) / item.holeRatio);
    const resizedBuf = await sharp(item.outPath).resize(framePx, framePx).png().toBuffer();

    const cxL = col * cellW + cellW / 2;
    const cyL = rowLight * cellH + cellH / 2;
    const cxD = col * cellW + cellW / 2;
    const cyD = rowDark * cellH + cellH / 2;

    overlays.push({
      input: resizedBuf,
      left: Math.round(cxL - framePx / 2),
      top: Math.round(cyL - framePx / 2),
    });
    overlays.push({
      input: resizedBuf,
      left: Math.round(cxD - framePx / 2),
      top: Math.round(cyD - framePx / 2),
    });
  }

  await sharp(Buffer.from(baseSvg))
    .composite(overlays)
    .png()
    .toFile('/tmp/frames_preview.png');

  console.log('Saved /tmp/frames_preview.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
