import { PDFDocument, PDFPage, PDFOperator, PDFOperatorNames, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import bidiFactory from 'bidi-js';
import type { AttendanceStatus } from '../types';
import { roundMoney } from './storage';
import {
  REPORT_MIME_TYPES,
  type AttendanceExportDataset,
  type AttendanceExportRow,
} from './reportExport';

const bidi = bidiFactory();

// Standard ISO A4 Portrait in PDF points (72 DPI coordinate space — infinite vector resolution)
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 26;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const FOOTER_RESERVE = 40;

// Cubic Bezier constant for exact circular arc approximation
const KAPPA = 0.552284749831;

const RTL_MIRROR_CHARS: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
  '«': '»',
  '»': '«',
  '‹': '›',
  '›': '‹',
};

const SYMBOL_FALLBACKS: Record<string, string> = {
  '✓': '',
  '✔': '',
  '✅': '',
  '☑': '',
  '✗': '',
  '✘': '',
  '❌': '',
  '\u00A0': ' ',
  '\t': ' ',
};

interface CairoFontBytesSet {
  regular: Uint8Array;
  semiBold: Uint8Array;
  bold: Uint8Array;
}

interface EmbeddedCairoFonts {
  regular: PDFFont;
  semiBold: PDFFont;
  bold: PDFFont;
}

interface ShapedGlyphItem {
  subsetGid: number;
  xAdvance: number;
  xOffset: number;
  yOffset: number;
}

interface ShapedLineLayout {
  glyphs: ShapedGlyphItem[];
  totalWidth: number;
}

interface FontKitGlyph {
  id: number;
  codePoints: number[];
  advanceWidth: number;
  isMark?: boolean;
}

interface FontKitPosition {
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
}

interface FontKitFont {
  unitsPerEm: number;
  hasGlyphForCodePoint(cp: number): boolean;
  layout(
    str: string,
    userFeatures?: unknown,
    script?: string,
    language?: string,
    direction?: 'ltr' | 'rtl'
  ): {
    glyphs: FontKitGlyph[];
    positions: FontKitPosition[];
  };
}

interface PdfLibCustomEmbedder {
  font: FontKitFont;
  fontFeatures?: unknown;
  subset: {
    includeGlyph(glyph: FontKitGlyph): number;
  };
  glyphs: FontKitGlyph[];
  glyphIdMap: Map<number, number>;
  glyphCache: {
    invalidate(): void;
  };
}

let cachedFontBytesPromise: Promise<CairoFontBytesSet> | null = null;

function isValidTrueTypeSfnt(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  // 0x00010000 (TrueType) or 'OTTO' (0x4F54544F)
  const b0 = bytes[0];
  const b1 = bytes[1];
  const b2 = bytes[2];
  const b3 = bytes[3];
  return (
    (b0 === 0x00 && b1 === 0x01 && b2 === 0x00 && b3 === 0x00) ||
    (b0 === 0x4f && b1 === 0x54 && b2 === 0x54 && b3 === 0x4f)
  );
}

async function loadSingleCairoFont(fileName: string): Promise<Uint8Array> {
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    const baseHref =
      (typeof document !== 'undefined' && document.baseURI) || window.location.href;
    const envBase =
      typeof import.meta !== 'undefined' && (import.meta as any).env?.BASE_URL
        ? String((import.meta as any).env.BASE_URL)
        : '/';
    const cleanBase = envBase.endsWith('/') ? envBase : `${envBase}/`;

    const candidateUrls = [
      new URL(`${cleanBase.replace(/^\//, '')}fonts/cairo/${fileName}`, baseHref).toString(),
      `${cleanBase}fonts/cairo/${fileName}`,
      `/fonts/cairo/${fileName}`,
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        if (isValidTrueTypeSfnt(bytes)) {
          return bytes;
        }
      } catch {
        // Try next candidate URL
      }
    }
    throw new Error(`Unable to load embedded report font asset: ${fileName}`);
  }

  // Node.js / CLI runtime fallback
  const fsModuleId = 'node:fs/promises';
  const fsMod = (await import(/* @vite-ignore */ fsModuleId)) as typeof import('node:fs/promises');
  const fileUrl = new URL(`../../public/fonts/cairo/${fileName}`, import.meta.url);
  const nodeBuf = await fsMod.readFile(fileUrl);
  const bytes = new Uint8Array(nodeBuf.buffer, nodeBuf.byteOffset, nodeBuf.byteLength);
  if (!isValidTrueTypeSfnt(bytes)) {
    throw new Error(`Invalid TrueType SFNT header in font asset: ${fileName}`);
  }
  return bytes;
}

function loadCairoFontBytesSet(): Promise<CairoFontBytesSet> {
  if (!cachedFontBytesPromise) {
    cachedFontBytesPromise = Promise.all([
      loadSingleCairoFont('Cairo-Regular.ttf'),
      loadSingleCairoFont('Cairo-SemiBold.ttf'),
      loadSingleCairoFont('Cairo-Bold.ttf'),
    ])
      .then(([regular, semiBold, bold]) => ({ regular, semiBold, bold }))
      .catch((err) => {
        cachedFontBytesPromise = null;
        throw err;
      });
  }
  return cachedFontBytesPromise;
}

function hexToRgbNormalized(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? `${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`
      : clean;
  const num = parseInt(full, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return [r, g, b];
}

function fmtNum(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, '') || '0' : '0';
}

function getEmbedder(pdfFont: PDFFont): PdfLibCustomEmbedder {
  return (pdfFont as unknown as { embedder: PdfLibCustomEmbedder }).embedder;
}

/**
 * Sanitizes text so unsupported control characters or pictographs never render `.notdef` boxes,
 * while preserving full Arabic letters, diacritics, punctuation, numbers, and Latin characters.
 */
function sanitizeForFont(raw: string, fkFont: FontKitFont): string {
  if (!raw) return '';
  const singleLine = raw.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!singleLine) return '';

  let out = '';
  for (const ch of singleLine) {
    const mapped = SYMBOL_FALLBACKS[ch] ?? ch;
    for (const subCh of mapped) {
      const cp = subCh.codePointAt(0);
      if (cp === undefined || cp < 0x20) continue;
      // Preserve BiDi directional marks temporarily if present
      if (cp === 0x200e || cp === 0x200f) {
        out += subCh;
        continue;
      }
      if (fkFont.hasGlyphForCodePoint(cp)) {
        out += subCh;
      }
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Protects structured LTR tokens (ISO dates YYYY-MM-DD, slash dates, and HH:MM clock times)
 * with Left-to-Right Marks so UAX #9 Rule W2 never inverts date segments after Arabic words.
 */
function protectLtrTokensForBidi(text: string): string {
  return text
    .replace(/(\b\d{4}-\d{2}-\d{2}\b)/g, '\u200E$1\u200E')
    .replace(/(\b\d{1,2}\/\d{1,2}\/\d{2,4}\b)/g, '\u200E$1\u200E')
    .replace(/(\b\d{1,2}:\d{2}\b)/g, '\u200E$1\u200E');
}

/**
 * Shapes a single logical line using Unicode UAX #9 BiDi (`bidi-js`) + OpenType Arabic shaping
 * (`@pdf-lib/fontkit` GSUB + GPOS), returning visual left-to-right positioned glyph IDs.
 */
function layoutBidiLine(
  pdfFont: PDFFont,
  rawText: string,
  fontSize: number,
  baseDir: 'rtl' | 'ltr'
): ShapedLineLayout {
  const embedder = getEmbedder(pdfFont);
  const fkFont = embedder.font;
  const sanitized = sanitizeForFont(rawText, fkFont);
  if (!sanitized) {
    return { glyphs: [], totalWidth: 0 };
  }

  const hasArabic = /[\u0600-\u06FF]/.test(sanitized);
  const hasLatinLetters = /[A-Za-z]/.test(sanitized);
  const effectiveDir: 'rtl' | 'ltr' =
    baseDir === 'ltr' && hasArabic && !hasLatinLetters ? 'rtl' : baseDir;

  const text = effectiveDir === 'rtl' ? protectLtrTokensForBidi(sanitized) : sanitized;
  const emb = bidi.getEmbeddingLevels(text, effectiveDir);
  const n = text.length;
  const visualOrder = Array.from({ length: n }, (_, i) => i);

  for (const [segStart, segEnd] of bidi.getReorderSegments(text, emb)) {
    let l = segStart;
    let r = segEnd;
    while (l < r) {
      const tmp = visualOrder[l];
      visualOrder[l] = visualOrder[r];
      visualOrder[r] = tmp;
      l++;
      r--;
    }
  }

  // Group contiguous visual characters originating from the same contiguous logical BiDi level run
  const directionalRuns: { sub: string; isRtl: boolean }[] = [];
  let i = 0;
  while (i < n) {
    const firstOrig = visualOrder[i];
    const lvl = emb.levels[firstOrig];
    const isRtl = (lvl & 1) === 1;
    let j = i + 1;
    while (
      j < n &&
      emb.levels[visualOrder[j]] === lvl &&
      visualOrder[j] === (isRtl ? visualOrder[j - 1] - 1 : visualOrder[j - 1] + 1)
    ) {
      j++;
    }

    const origStart = isRtl ? visualOrder[j - 1] : visualOrder[i];
    const origEnd = isRtl ? visualOrder[i] : visualOrder[j - 1];

    let sub = '';
    for (let k = origStart; k <= origEnd; k++) {
      const ch = text[k];
      if (ch === '\u200E' || ch === '\u200F') continue;
      sub += isRtl ? RTL_MIRROR_CHARS[ch] ?? ch : ch;
    }

    if (sub.length > 0) {
      directionalRuns.push({ sub, isRtl });
    }
    i = j;
  }

  const scale = fontSize / fkFont.unitsPerEm;
  const glyphs: ShapedGlyphItem[] = [];
  let totalWidth = 0;

  for (const run of directionalRuns) {
    const shaped = fkFont.layout(
      run.sub,
      embedder.fontFeatures,
      undefined,
      undefined,
      run.isRtl ? 'rtl' : 'ltr'
    );

    for (let gIdx = 0; gIdx < shaped.glyphs.length; gIdx++) {
      const glyph = shaped.glyphs[gIdx];
      const pos = shaped.positions[gIdx];
      const subsetGid = embedder.subset.includeGlyph(glyph);
      embedder.glyphs[subsetGid - 1] = glyph;
      embedder.glyphIdMap.set(glyph.id, subsetGid);

      glyphs.push({
        subsetGid,
        xAdvance: pos.xAdvance * scale,
        xOffset: pos.xOffset * scale,
        yOffset: pos.yOffset * scale,
      });
      totalWidth += pos.xAdvance * scale;
    }
  }

  embedder.glyphCache.invalidate();
  return { glyphs, totalWidth };
}

function measureTextWidth(
  pdfFont: PDFFont,
  text: string,
  fontSize: number,
  baseDir: 'rtl' | 'ltr'
): number {
  const embedder = getEmbedder(pdfFont);
  const fkFont = embedder.font;
  const sanitized = sanitizeForFont(text, fkFont);
  if (!sanitized) return 0;

  // Measure via OpenType layout without mutating subset tables unnecessarily
  const scale = fontSize / fkFont.unitsPerEm;
  const shaped = fkFont.layout(
    sanitized,
    embedder.fontFeatures,
    undefined,
    undefined,
    baseDir
  );
  let width = 0;
  for (let i = 0; i < shaped.positions.length; i++) {
    width += shaped.positions[i].xAdvance * scale;
  }
  return width;
}

function fitLineWithEllipsis(
  pdfFont: PDFFont,
  text: string,
  fontSize: number,
  maxWidth: number,
  baseDir: 'rtl' | 'ltr'
): string {
  const fkFont = getEmbedder(pdfFont).font;
  const clean = sanitizeForFont(text, fkFont);
  if (!clean) return '';
  if (measureTextWidth(pdfFont, clean, fontSize, baseDir) <= maxWidth) {
    return clean;
  }

  const chars = Array.from(clean);
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${chars.slice(0, mid).join('').trimEnd()}…`;
    if (measureTextWidth(pdfFont, candidate, fontSize, baseDir) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return `${chars.slice(0, Math.max(1, low)).join('').trimEnd()}…`;
}

/**
 * Wraps logical text into clean multi-line strings fitting `maxWidth`, preserving Arabic words
 * and falling back to safe character-cluster breaking or ellipsis on the final allowed line.
 */
function wrapTextToLines(
  pdfFont: PDFFont,
  rawText: string,
  fontSize: number,
  maxWidth: number,
  baseDir: 'rtl' | 'ltr',
  maxLines = 4
): string[] {
  const fkFont = getEmbedder(pdfFont).font;
  const clean = sanitizeForFont(rawText, fkFont);
  if (!clean) return [];

  if (maxLines <= 1) {
    return [fitLineWithEllipsis(pdfFont, clean, fontSize, maxWidth, baseDir)];
  }

  if (measureTextWidth(pdfFont, clean, fontSize, baseDir) <= maxWidth) {
    return [clean];
  }

  const words = clean.split(' ').filter(Boolean);
  const rawLines: string[] = [];
  let current = '';

  const pushOversizedWord = (word: string) => {
    const chars = Array.from(word);
    let chunk = '';
    for (const ch of chars) {
      const next = chunk + ch;
      if (chunk && measureTextWidth(pdfFont, next, fontSize, baseDir) > maxWidth) {
        rawLines.push(chunk);
        chunk = ch;
      } else {
        chunk = next;
      }
    }
    if (chunk) {
      current = chunk;
    }
  };

  for (const word of words) {
    if (!current) {
      if (measureTextWidth(pdfFont, word, fontSize, baseDir) <= maxWidth) {
        current = word;
      } else {
        pushOversizedWord(word);
      }
      continue;
    }

    const candidate = `${current} ${word}`;
    if (measureTextWidth(pdfFont, candidate, fontSize, baseDir) <= maxWidth) {
      current = candidate;
    } else {
      rawLines.push(current);
      current = '';
      if (measureTextWidth(pdfFont, word, fontSize, baseDir) <= maxWidth) {
        current = word;
      } else {
        pushOversizedWord(word);
      }
    }
  }

  if (current) {
    rawLines.push(current);
  }

  if (rawLines.length <= maxLines) {
    return rawLines;
  }

  const kept = rawLines.slice(0, maxLines - 1);
  const remainder = rawLines.slice(maxLines - 1).join(' ');
  kept.push(fitLineWithEllipsis(pdfFont, remainder, fontSize, maxWidth, baseDir));
  return kept;
}

class VectorPageCanvas {
  readonly page: PDFPage;
  private readonly ops: string[] = [];
  private readonly fontKeyByFont = new Map<PDFFont, string>();
  private readonly isRTL: boolean;
  private readonly baseDir: 'rtl' | 'ltr';

  constructor(doc: PDFDocument, fonts: EmbeddedCairoFonts, isRTL: boolean) {
    this.page = doc.addPage([PAGE_W, PAGE_H]);
    this.isRTL = isRTL;
    this.baseDir = isRTL ? 'rtl' : 'ltr';

    for (const f of [fonts.regular, fonts.semiBold, fonts.bold]) {
      this.page.setFont(f);
      const dictName = this.page.node.newFontDictionary(f.name, f.ref);
      // PDFName.asString() starts with '/'
      this.fontKeyByFont.set(f, dictName.asString().slice(1));
    }

    // Crisp pure white vector page background
    this.drawRectTopDown(0, 0, PAGE_W, PAGE_H, '#FFFFFF');
  }

  drawRectTopDown(
    x: number,
    topY: number,
    w: number,
    h: number,
    fillHex?: string,
    strokeHex?: string,
    lineWidth = 0.6
  ): void {
    const y = PAGE_H - topY - h;
    this.ops.push('q');
    if (fillHex) {
      const [r, g, b] = hexToRgbNormalized(fillHex);
      this.ops.push(`${fmtNum(r)} ${fmtNum(g)} ${fmtNum(b)} rg`);
    }
    if (strokeHex) {
      const [r, g, b] = hexToRgbNormalized(strokeHex);
      this.ops.push(`${fmtNum(r)} ${fmtNum(g)} ${fmtNum(b)} RG`);
      this.ops.push(`${fmtNum(lineWidth)} w`);
    }
    this.ops.push(`${fmtNum(x)} ${fmtNum(y)} ${fmtNum(w)} ${fmtNum(h)} re`);
    if (fillHex && strokeHex) {
      this.ops.push('B');
    } else if (fillHex) {
      this.ops.push('f');
    } else if (strokeHex) {
      this.ops.push('S');
    }
    this.ops.push('Q');
  }

  drawRoundedRectTopDown(
    x: number,
    topY: number,
    w: number,
    h: number,
    radius: number,
    fillHex?: string,
    strokeHex?: string,
    lineWidth = 0.65
  ): void {
    const r = Math.max(0, Math.min(radius, w / 2, h / 2));
    if (r === 0) {
      this.drawRectTopDown(x, topY, w, h, fillHex, strokeHex, lineWidth);
      return;
    }

    const y = PAGE_H - topY - h;
    const k = r * KAPPA;

    this.ops.push('q');
    if (fillHex) {
      const [cr, cg, cb] = hexToRgbNormalized(fillHex);
      this.ops.push(`${fmtNum(cr)} ${fmtNum(cg)} ${fmtNum(cb)} rg`);
    }
    if (strokeHex) {
      const [sr, sg, sb] = hexToRgbNormalized(strokeHex);
      this.ops.push(`${fmtNum(sr)} ${fmtNum(sg)} ${fmtNum(sb)} RG`);
      this.ops.push(`${fmtNum(lineWidth)} w`);
    }

    // Bottom edge left-to-right, then counter-clockwise with cubic Bezier corners
    this.ops.push(`${fmtNum(x + r)} ${fmtNum(y)} m`);
    this.ops.push(`${fmtNum(x + w - r)} ${fmtNum(y)} l`);
    this.ops.push(
      `${fmtNum(x + w - r + k)} ${fmtNum(y)} ${fmtNum(x + w)} ${fmtNum(y + r - k)} ${fmtNum(x + w)} ${fmtNum(y + r)} c`
    );
    this.ops.push(`${fmtNum(x + w)} ${fmtNum(y + h - r)} l`);
    this.ops.push(
      `${fmtNum(x + w)} ${fmtNum(y + h - r + k)} ${fmtNum(x + w - r + k)} ${fmtNum(y + h)} ${fmtNum(x + w - r)} ${fmtNum(y + h)} c`
    );
    this.ops.push(`${fmtNum(x + r)} ${fmtNum(y + h)} l`);
    this.ops.push(
      `${fmtNum(x + r - k)} ${fmtNum(y + h)} ${fmtNum(x)} ${fmtNum(y + h - r + k)} ${fmtNum(x)} ${fmtNum(y + h - r)} c`
    );
    this.ops.push(`${fmtNum(x)} ${fmtNum(y + r)} l`);
    this.ops.push(
      `${fmtNum(x)} ${fmtNum(y + r - k)} ${fmtNum(x + r - k)} ${fmtNum(y)} ${fmtNum(x + r)} ${fmtNum(y)} c`
    );
    this.ops.push('h');

    if (fillHex && strokeHex) {
      this.ops.push('B');
    } else if (fillHex) {
      this.ops.push('f');
    } else if (strokeHex) {
      this.ops.push('S');
    }
    this.ops.push('Q');
  }

  drawLineTopDown(
    x1: number,
    topY1: number,
    x2: number,
    topY2: number,
    strokeHex: string,
    lineWidth = 0.55
  ): void {
    const y1 = PAGE_H - topY1;
    const y2 = PAGE_H - topY2;
    const [r, g, b] = hexToRgbNormalized(strokeHex);
    this.ops.push('q');
    this.ops.push(`${fmtNum(r)} ${fmtNum(g)} ${fmtNum(b)} RG`);
    this.ops.push(`${fmtNum(lineWidth)} w`);
    this.ops.push(`${fmtNum(x1)} ${fmtNum(y1)} m ${fmtNum(x2)} ${fmtNum(y2)} l S`);
    this.ops.push('Q');
  }

  drawAlignedSingleLine(params: {
    text: string;
    font: PDFFont;
    fontSize: number;
    colorHex: string;
    boxX: number;
    boxW: number;
    centerY: number;
    align?: 'start' | 'end' | 'center';
    paddingX?: number;
    preFitted?: boolean;
  }): void {
    const {
      text,
      font,
      fontSize,
      colorHex,
      boxX,
      boxW,
      centerY,
      align = 'start',
      paddingX = 6,
      preFitted = false,
    } = params;

    const maxW = Math.max(10, boxW - paddingX * 2);
    const displayStr = preFitted
      ? text
      : fitLineWithEllipsis(font, text, fontSize, maxW, this.baseDir);
    if (!displayStr) return;

    const laid = layoutBidiLine(font, displayStr, fontSize, this.baseDir);
    if (laid.glyphs.length === 0) return;

    let startX: number;
    if (align === 'center') {
      startX = boxX + (boxW - laid.totalWidth) / 2;
    } else {
      const isRight =
        (this.isRTL && align === 'start') || (!this.isRTL && align === 'end');
      startX = isRight
        ? boxX + boxW - paddingX - laid.totalWidth
        : boxX + paddingX;
    }

    // Optical baseline placement for Cairo Arabic + Latin metrics
    const pdfBaselineY = PAGE_H - centerY - fontSize * 0.26;
    const fontKey = this.fontKeyByFont.get(font);
    if (!fontKey) return;

    const [r, g, b] = hexToRgbNormalized(colorHex);
    this.ops.push('q');
    this.ops.push('BT');
    this.ops.push(`/${fontKey} ${fmtNum(fontSize)} Tf`);
    this.ops.push(`${fmtNum(r)} ${fmtNum(g)} ${fmtNum(b)} rg`);

    let curX = startX;
    for (const gItem of laid.glyphs) {
      const hex = gItem.subsetGid.toString(16).padStart(4, '0').toUpperCase();
      const drawX = curX + gItem.xOffset;
      if (Math.abs(gItem.yOffset) > 0.001) {
        this.ops.push(`${fmtNum(gItem.yOffset)} Ts`);
        this.ops.push(`1 0 0 1 ${fmtNum(drawX)} ${fmtNum(pdfBaselineY)} Tm <${hex}> Tj`);
        this.ops.push('0 Ts');
      } else {
        this.ops.push(`1 0 0 1 ${fmtNum(drawX)} ${fmtNum(pdfBaselineY)} Tm <${hex}> Tj`);
      }
      curX += gItem.xAdvance;
    }

    this.ops.push('ET');
    this.ops.push('Q');
  }

  flush(): void {
    if (this.ops.length > 0) {
      this.page.pushOperators(
        PDFOperator.of(this.ops.join('\n') as unknown as PDFOperatorNames)
      );
      this.ops.length = 0;
    }
  }
}

function getAttendanceStatusHex(status: AttendanceStatus | 'unrecorded'): string {
  switch (status) {
    case 'present':
      return '#2E8B83';
    case 'late':
      return '#D97706';
    case 'absent_charged':
    case 'absent':
      return '#D64545';
    case 'absent_free':
    case 'excused':
      return '#2F4E78';
    default:
      return '#526377';
  }
}

interface PreparedCellBlock {
  lines: {
    text: string;
    font: PDFFont;
    fontSize: number;
    lineHeight: number;
    colorHex: string;
    gapBefore: number;
  }[];
  totalHeight: number;
}

function buildPreparedBlock(
  groups: {
    lines: string[];
    font: PDFFont;
    fontSize: number;
    lineHeight: number;
    colorHex: string;
  }[],
  groupGap = 2
): PreparedCellBlock {
  const flat: PreparedCellBlock['lines'] = [];
  let totalHeight = 0;
  let nonEmptyGroupCount = 0;

  for (const grp of groups) {
    if (grp.lines.length === 0) continue;
    const extraGap = nonEmptyGroupCount > 0 ? groupGap : 0;
    totalHeight += extraGap;
    nonEmptyGroupCount++;
    grp.lines.forEach((ln, idx) => {
      flat.push({
        text: ln,
        font: grp.font,
        fontSize: grp.fontSize,
        lineHeight: grp.lineHeight,
        colorHex: grp.colorHex,
        gapBefore: idx === 0 ? extraGap : 0,
      });
      totalHeight += grp.lineHeight;
    });
  }

  return { lines: flat, totalHeight };
}

export async function renderVectorAttendanceReportPDF(
  dataset: AttendanceExportDataset
): Promise<Blob> {
  const fontBytes = await loadCairoFontBytesSet();

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle(`${dataset.reportTitle} — ${dataset.targetTitle}`);
  pdfDoc.setCreator('Classy');
  pdfDoc.setProducer('Classy Vector Report Engine');

  const fonts: EmbeddedCairoFonts = {
    regular: await pdfDoc.embedFont(fontBytes.regular, { subset: true }),
    semiBold: await pdfDoc.embedFont(fontBytes.semiBold, { subset: true }),
    bold: await pdfDoc.embedFont(fontBytes.bold, { subset: true }),
  };

  const isRTL = !dataset.isEn;
  const baseDir: 'rtl' | 'ltr' = isRTL ? 'rtl' : 'ltr';
  const pages: VectorPageCanvas[] = [];

  const createPage = (): VectorPageCanvas => {
    const p = new VectorPageCanvas(pdfDoc, fonts, isRTL);
    pages.push(p);
    return p;
  };

  // Column proportions matching Classy's report table structure
  const colDefs = [
    {
      key: 'date',
      ratio: 0.155,
      label: dataset.isEn ? 'Date & Time' : 'التاريخ والوقت',
      align: 'start' as const,
    },
    {
      key: 'subject',
      ratio: 0.215,
      label:
        dataset.scope === 'student'
          ? dataset.isEn
            ? 'Subject / Service'
            : 'المادة / الخدمة'
          : dataset.isEn
          ? 'Student / Service'
          : 'الطالب / الخدمة',
      align: 'start' as const,
    },
    {
      key: 'topic',
      ratio: 0.185,
      label: dataset.isEn ? 'Topic & Qty' : 'الحصة والكمية',
      align: 'start' as const,
    },
    {
      key: 'attendance',
      ratio: 0.135,
      label: dataset.isEn ? 'Attendance' : 'حالة الحضور',
      align: 'start' as const,
    },
    {
      key: 'evaluation',
      ratio: 0.155,
      label: dataset.isEn ? 'HW & Behavior' : 'الواجب والسلوك',
      align: 'start' as const,
    },
    {
      key: 'notes',
      ratio: 0.155,
      label: dataset.isEn ? 'Notes' : 'ملاحظات',
      align: 'start' as const,
    },
  ];

  const columnBoxes = (() => {
    const boxes: {
      x: number;
      w: number;
      label: string;
      key: string;
      align: 'start' | 'end' | 'center';
    }[] = [];
    let cursor = isRTL ? MARGIN_X + CONTENT_W : MARGIN_X;
    for (let i = 0; i < colDefs.length; i++) {
      const col = colDefs[i];
      const w =
        i === colDefs.length - 1
          ? isRTL
            ? cursor - MARGIN_X
            : MARGIN_X + CONTENT_W - cursor
          : CONTENT_W * col.ratio;
      const x = isRTL ? cursor - w : cursor;
      boxes.push({ x, w, label: col.label, key: col.key, align: col.align });
      cursor = isRTL ? cursor - w : cursor + w;
    }
    return boxes;
  })();

  const drawTableHeader = (page: VectorPageCanvas, topY: number): number => {
    const headerH = 24;
    page.drawRoundedRectTopDown(MARGIN_X, topY, CONTENT_W, headerH, 6, '#17375E');
    for (const box of columnBoxes) {
      page.drawAlignedSingleLine({
        text: box.label,
        font: fonts.bold,
        fontSize: 8.2,
        colorHex: '#FFFFFF',
        boxX: box.x,
        boxW: box.w,
        centerY: topY + headerH / 2,
        align: box.align,
        paddingX: 5.5,
      });
    }
    return topY + headerH + 3;
  };

  const drawContinuationBanner = (page: VectorPageCanvas): number => {
    const topY = 24;
    page.drawAlignedSingleLine({
      text: `${dataset.reportTitle} — ${dataset.targetTitle}`,
      font: fonts.bold,
      fontSize: 9.2,
      colorHex: '#17375E',
      boxX: isRTL ? MARGIN_X + CONTENT_W * 0.23 : MARGIN_X,
      boxW: CONTENT_W * 0.77,
      centerY: topY + 7,
      align: 'start',
      paddingX: 0,
    });

    page.drawAlignedSingleLine({
      text: dataset.periodLabel,
      font: fonts.semiBold,
      fontSize: 8,
      colorHex: '#4A5B6E',
      boxX: isRTL ? MARGIN_X : MARGIN_X + CONTENT_W * 0.77,
      boxW: CONTENT_W * 0.23,
      centerY: topY + 7,
      align: 'end',
      paddingX: 0,
    });

    page.drawLineTopDown(
      MARGIN_X,
      topY + 18,
      MARGIN_X + CONTENT_W,
      topY + 18,
      '#DCE7E8',
      0.7
    );

    return drawTableHeader(page, topY + 25);
  };

  // --- PAGE 1 ---
  let page = createPage();
  let cursorY = 25;

  // 1. Hero Header Card (Harbor Mint Navy)
  const heroMainW = CONTENT_W * 0.635;
  const heroMainX = isRTL
    ? MARGIN_X + CONTENT_W - heroMainW - 19
    : MARGIN_X + 19;
  const heroSideW = CONTENT_W - heroMainW - 29;
  const heroSideX = isRTL
    ? MARGIN_X + 10
    : MARGIN_X + CONTENT_W - heroSideW - 10;

  const targetTitleLines = wrapTextToLines(
    fonts.bold,
    dataset.targetTitle,
    14.5,
    heroMainW - 8,
    baseDir,
    2
  );
  const bottomMetaLine = dataset.parentLine || dataset.teacherLine;
  const extraTitleH = targetTitleLines.length > 1 ? 15 : 0;
  const heroH = (bottomMetaLine ? 92 : 80) + extraTitleH;

  page.drawRoundedRectTopDown(MARGIN_X, cursorY, CONTENT_W, heroH, 12, '#17375E');

  // Warm orange vertical accent bar inside hero
  const accentW = 4;
  const accentX = isRTL ? MARGIN_X + CONTENT_W - 13 : MARGIN_X + 9;
  page.drawRoundedRectTopDown(
    accentX,
    cursorY + 13,
    accentW,
    heroH - 26,
    2,
    '#F5A04A'
  );

  let heroTextY = cursorY + 18;
  page.drawAlignedSingleLine({
    text: dataset.reportTitle,
    font: fonts.semiBold,
    fontSize: 8.5,
    colorHex: '#B9DAD6',
    boxX: heroMainX,
    boxW: heroMainW,
    centerY: heroTextY,
    align: 'start',
    paddingX: 2,
  });

  heroTextY += 18;
  for (const titleLn of targetTitleLines) {
    page.drawAlignedSingleLine({
      text: titleLn,
      font: fonts.bold,
      fontSize: 14.5,
      colorHex: '#FFFFFF',
      boxX: heroMainX,
      boxW: heroMainW,
      centerY: heroTextY,
      align: 'start',
      paddingX: 2,
      preFitted: true,
    });
    heroTextY += 16;
  }

  if (dataset.targetSubtitle) {
    heroTextY += 2;
    page.drawAlignedSingleLine({
      text: dataset.targetSubtitle,
      font: fonts.regular,
      fontSize: 8.2,
      colorHex: '#DCEDEB',
      boxX: heroMainX,
      boxW: heroMainW,
      centerY: heroTextY,
      align: 'start',
      paddingX: 2,
    });
    heroTextY += 15;
  } else {
    heroTextY += 4;
  }

  if (bottomMetaLine) {
    page.drawAlignedSingleLine({
      text: bottomMetaLine,
      font: fonts.semiBold,
      fontSize: 8,
      colorHex: '#F5A04A',
      boxX: heroMainX,
      boxW: heroMainW,
      centerY: Math.min(heroTextY, cursorY + heroH - 13),
      align: 'start',
      paddingX: 2,
    });
  }

  // Hero Side Metadata Box (#0F2A4A)
  page.drawRoundedRectTopDown(
    heroSideX,
    cursorY + 11,
    heroSideW,
    heroH - 22,
    8,
    '#0F2A4A'
  );

  page.drawAlignedSingleLine({
    text: dataset.isEn ? 'Reporting Period' : 'الفترة الزمنية',
    font: fonts.semiBold,
    fontSize: 7.4,
    colorHex: '#B9DAD6',
    boxX: heroSideX,
    boxW: heroSideW,
    centerY: cursorY + 24,
    align: 'start',
    paddingX: 9,
  });

  page.drawAlignedSingleLine({
    text: dataset.periodLabel,
    font: fonts.bold,
    fontSize: 9.2,
    colorHex: '#FFFFFF',
    boxX: heroSideX,
    boxW: heroSideW,
    centerY: cursorY + 39,
    align: 'start',
    paddingX: 9,
  });

  page.drawAlignedSingleLine({
    text: dataset.isEn
      ? `Issued: ${dataset.exportedAtDate}`
      : `تاريخ الإصدار: ${dataset.exportedAtDate}`,
    font: fonts.regular,
    fontSize: 7.4,
    colorHex: '#A7BACB',
    boxX: heroSideX,
    boxW: heroSideW,
    centerY: cursorY + 55,
    align: 'start',
    paddingX: 9,
  });

  if (dataset.teacherLine && dataset.parentLine) {
    page.drawAlignedSingleLine({
      text: dataset.teacherLine,
      font: fonts.regular,
      fontSize: 7.2,
      colorHex: '#DCEDEB',
      boxX: heroSideX,
      boxW: heroSideW,
      centerY: cursorY + 70,
      align: 'start',
      paddingX: 9,
    });
  }

  cursorY += heroH + 11;

  // 2. Summary KPI Grid (4 Crisp Vector Tiles)
  const tileGap = 8;
  const tileW = (CONTENT_W - tileGap * 3) / 4;
  const tileH = 54;
  const { summary } = dataset;

  const kpiTiles = [
    {
      label: dataset.isEn ? 'Attendance Rate' : 'نسبة الالتزام بالحضور',
      value: `${summary.commitmentRate}%`,
      sub: dataset.isEn
        ? `${roundMoney(summary.presentCount + summary.lateCount, 2)} attended`
        : `${roundMoney(summary.presentCount + summary.lateCount, 2)} حضور فعلي`,
      accent:
        summary.commitmentRate >= 80
          ? '#2E8B83'
          : summary.commitmentRate >= 60
          ? '#D97706'
          : '#D64545',
    },
    {
      label: dataset.isEn ? 'Completed Lessons' : 'الحصص المنفذة',
      value: String(summary.completedSessions),
      sub: dataset.isEn
        ? `of ${summary.totalSessions} total sessions`
        : `من إجمالي ${summary.totalSessions} حصة`,
      accent: '#17375E',
    },
    {
      label: dataset.isEn ? 'Present & Late' : 'الحضور والتأخير',
      value: `${summary.presentCount}`,
      sub: dataset.isEn
        ? `${summary.lateCount} late`
        : `${summary.lateCount} مرات تأخير`,
      accent: '#2E8B83',
    },
    {
      label: dataset.isEn ? 'Absences' : 'الغياب المسجل',
      value: `${roundMoney(summary.absentChargedCount + summary.absentExcusedCount, 2)}`,
      sub: dataset.isEn
        ? `${summary.absentChargedCount} charged · ${summary.absentExcusedCount} excused`
        : `${summary.absentChargedCount} محسوب · ${summary.absentExcusedCount} معفى`,
      accent: summary.absentChargedCount > 0 ? '#D64545' : '#4A5B6E',
    },
  ];

  kpiTiles.forEach((tile, idx) => {
    const visualIndex = isRTL ? 3 - idx : idx;
    const tx = MARGIN_X + visualIndex * (tileW + tileGap);
    page.drawRoundedRectTopDown(
      tx,
      cursorY,
      tileW,
      tileH,
      8,
      '#F1F7F7',
      '#DCE7E8',
      0.7
    );

    page.drawAlignedSingleLine({
      text: tile.label,
      font: fonts.semiBold,
      fontSize: 7.6,
      colorHex: '#4A5B6E',
      boxX: tx,
      boxW: tileW,
      centerY: cursorY + 12.5,
      align: 'start',
      paddingX: 8,
    });

    page.drawAlignedSingleLine({
      text: tile.value,
      font: fonts.bold,
      fontSize: 14,
      colorHex: tile.accent,
      boxX: tx,
      boxW: tileW,
      centerY: cursorY + 29,
      align: 'start',
      paddingX: 8,
    });

    page.drawAlignedSingleLine({
      text: tile.sub,
      font: fonts.regular,
      fontSize: 7.1,
      colorHex: '#526377',
      boxX: tx,
      boxW: tileW,
      centerY: cursorY + 44,
      align: 'start',
      paddingX: 8,
    });
  });

  cursorY += tileH + 9;

  // 3. Optional Financial Summary Strip
  if (dataset.includeFinancials && dataset.financials) {
    const fin = dataset.financials;
    const finH = 32;
    page.drawRoundedRectTopDown(
      MARGIN_X,
      cursorY,
      CONTENT_W,
      finH,
      7,
      '#DCEDEB',
      '#B9DAD6',
      0.7
    );

    const thirdW = CONTENT_W / 3;
    const finItems = [
      {
        label: dataset.isEn ? 'Total Required' : 'إجمالي المستحق',
        val: `${fin.totalDue} ${fin.currency}`,
        color: '#17375E',
      },
      {
        label: dataset.isEn ? 'Total Paid' : 'إجمالي المسدد',
        val: `${fin.totalPaid} ${fin.currency}`,
        color: '#2E8B83',
      },
      {
        label: dataset.isEn ? 'Remaining Balance' : 'الرصيد المتبقي',
        val: `${fin.remaining} ${fin.currency}`,
        color: fin.remaining > 0 ? '#D64545' : '#2E8B83',
      },
    ];

    // Subtle crisp vertical dividers between financial summary columns
    for (let d = 1; d <= 2; d++) {
      const divX = MARGIN_X + d * thirdW;
      page.drawLineTopDown(
        divX,
        cursorY + 6,
        divX,
        cursorY + finH - 6,
        '#B9DAD6',
        0.55
      );
    }

    finItems.forEach((item, idx) => {
      const vIdx = isRTL ? 2 - idx : idx;
      const fx = MARGIN_X + vIdx * thirdW;
      const labelText = `${item.label}:`;
      const pad = 9;
      const labelW = measureTextWidth(fonts.semiBold, labelText, 7.8, baseDir);
      const availForVal = Math.max(40, thirdW - pad * 2 - labelW - 6);

      page.drawAlignedSingleLine({
        text: labelText,
        font: fonts.semiBold,
        fontSize: 7.8,
        colorHex: '#33485E',
        boxX: fx,
        boxW: thirdW,
        centerY: cursorY + finH / 2,
        align: 'start',
        paddingX: pad,
      });

      const valBoxX = isRTL ? fx + pad : fx + thirdW - pad - availForVal;
      page.drawAlignedSingleLine({
        text: item.val,
        font: fonts.bold,
        fontSize: 9,
        colorHex: item.color,
        boxX: valBoxX,
        boxW: availForVal,
        centerY: cursorY + finH / 2,
        align: 'end',
        paddingX: 0,
      });
    });

    cursorY += finH + 10;
  }

  // 4. Table Header & Multi-Page Session Rows (with clean word-wrapping & intact row pagination)
  cursorY = drawTableHeader(page, cursorY);

  if (dataset.rows.length === 0) {
    const emptyH = 68;
    page.drawRoundedRectTopDown(
      MARGIN_X,
      cursorY + 6,
      CONTENT_W,
      emptyH,
      8,
      '#F8FAFC',
      '#DCE7E8',
      0.65
    );
    page.drawAlignedSingleLine({
      text: dataset.isEn
        ? 'No sessions or attendance records found for the selected period.'
        : 'لا توجد حصص أو سجلات حضور مسجلة خلال الفترة المحددة.',
      font: fonts.semiBold,
      fontSize: 9,
      colorHex: '#4A5B6E',
      boxX: MARGIN_X,
      boxW: CONTENT_W,
      centerY: cursorY + 6 + emptyH / 2,
      align: 'center',
      paddingX: 14,
    });
  } else {
    const cellPadX = 5.5;
    const cellPadY = 5.5;
    const minRowH = 31;

    const prepareRowCells = (
      row: AttendanceExportRow
    ): { blocks: Record<string, PreparedCellBlock>; rowH: number } => {
      const blocks: Record<string, PreparedCellBlock> = {};
      let maxContentH = 0;

      for (const box of columnBoxes) {
        const innerW = Math.max(18, box.w - cellPadX * 2);
        let block: PreparedCellBlock;

        if (box.key === 'date') {
          const dateLines = wrapTextToLines(
            fonts.bold,
            row.date,
            8,
            innerW,
            baseDir,
            1
          );
          const timeLines = wrapTextToLines(
            fonts.regular,
            `${row.dayLabel} · ${row.startTime}`,
            7.3,
            innerW,
            baseDir,
            2
          );
          block = buildPreparedBlock([
            {
              lines: dateLines,
              font: fonts.bold,
              fontSize: 8,
              lineHeight: 10.5,
              colorHex: '#17375E',
            },
            {
              lines: timeLines,
              font: fonts.regular,
              fontSize: 7.3,
              lineHeight: 9.8,
              colorHex: '#526377',
            },
          ]);
        } else if (box.key === 'subject') {
          const primaryLabel =
            dataset.scope === 'student' ? row.serviceName : row.studentName;
          const secondaryLabel =
            dataset.scope === 'student'
              ? row.lessonTypeLabel
              : `${row.serviceName} · ${row.lessonTypeLabel}`;
          const priLines = wrapTextToLines(
            fonts.bold,
            primaryLabel,
            8.1,
            innerW,
            baseDir,
            3
          );
          const secLines = wrapTextToLines(
            fonts.regular,
            secondaryLabel,
            7.3,
            innerW,
            baseDir,
            2
          );
          block = buildPreparedBlock([
            {
              lines: priLines,
              font: fonts.bold,
              fontSize: 8.1,
              lineHeight: 10.8,
              colorHex: '#17375E',
            },
            {
              lines: secLines,
              font: fonts.regular,
              fontSize: 7.3,
              lineHeight: 9.8,
              colorHex: '#526377',
            },
          ]);
        } else if (box.key === 'topic') {
          const topicLines = wrapTextToLines(
            fonts.semiBold,
            row.sessionTitle,
            8,
            innerW,
            baseDir,
            3
          );
          const qtyLines = wrapTextToLines(
            fonts.regular,
            `${row.quantityLabel} · ${row.sessionStatusLabel}`,
            7.3,
            innerW,
            baseDir,
            2
          );
          block = buildPreparedBlock([
            {
              lines: topicLines,
              font: fonts.semiBold,
              fontSize: 8,
              lineHeight: 10.6,
              colorHex: '#17375E',
            },
            {
              lines: qtyLines,
              font: fonts.regular,
              fontSize: 7.3,
              lineHeight: 9.8,
              colorHex: '#4A5B6E',
            },
          ]);
        } else if (box.key === 'attendance') {
          const attLines = wrapTextToLines(
            fonts.bold,
            row.attendanceStatusLabel,
            8,
            innerW,
            baseDir,
            2
          );
          block = buildPreparedBlock([
            {
              lines: attLines,
              font: fonts.bold,
              fontSize: 8,
              lineHeight: 10.8,
              colorHex: getAttendanceStatusHex(row.attendanceStatus),
            },
          ]);
        } else if (box.key === 'evaluation') {
          const hwPrefix = dataset.isEn ? 'HW:' : 'واجب:';
          const behPrefix = dataset.isEn ? 'Beh:' : 'سلوك:';
          const behText =
            row.quizScoreLabel !== '—'
              ? `${behPrefix} ${row.behaviorLabel} · ${row.quizScoreLabel}`
              : `${behPrefix} ${row.behaviorLabel}`;
          const hwLines = wrapTextToLines(
            fonts.semiBold,
            `${hwPrefix} ${row.homeworkLabel}`,
            7.6,
            innerW,
            baseDir,
            2
          );
          const behLines = wrapTextToLines(
            fonts.regular,
            behText,
            7.3,
            innerW,
            baseDir,
            2
          );
          block = buildPreparedBlock([
            {
              lines: hwLines,
              font: fonts.semiBold,
              fontSize: 7.6,
              lineHeight: 10.2,
              colorHex: '#17375E',
            },
            {
              lines: behLines,
              font: fonts.regular,
              fontSize: 7.3,
              lineHeight: 9.8,
              colorHex: '#4A5B6E',
            },
          ]);
        } else {
          const noteLines = wrapTextToLines(
            fonts.regular,
            row.notes || '—',
            7.6,
            innerW,
            baseDir,
            5
          );
          block = buildPreparedBlock([
            {
              lines: noteLines,
              font: fonts.regular,
              fontSize: 7.6,
              lineHeight: 10.4,
              colorHex: '#33485E',
            },
          ]);
        }

        blocks[box.key] = block;
        if (block.totalHeight > maxContentH) {
          maxContentH = block.totalHeight;
        }
      }

      const rowH = Math.max(minRowH, Math.ceil(maxContentH + cellPadY * 2));
      return { blocks, rowH };
    };

    for (let i = 0; i < dataset.rows.length; i++) {
      const row = dataset.rows[i];
      const { blocks, rowH } = prepareRowCells(row);

      // Keep rows 100% intact across page breaks
      if (cursorY + rowH > PAGE_H - FOOTER_RESERVE) {
        page = createPage();
        cursorY = drawContinuationBanner(page);
      }

      if (i % 2 === 1) {
        page.drawRectTopDown(MARGIN_X, cursorY, CONTENT_W, rowH, '#F8FBFB');
      }

      // Subtle vertical column hairlines for clean visual separation at any zoom
      for (let cIdx = 0; cIdx < columnBoxes.length - 1; cIdx++) {
        const cb = columnBoxes[cIdx];
        const dividerX = isRTL ? cb.x : cb.x + cb.w;
        page.drawLineTopDown(
          dividerX,
          cursorY + 3,
          dividerX,
          cursorY + rowH - 3,
          '#E9F1F2',
          0.4
        );
      }

      // Crisp horizontal bottom border for each row
      page.drawLineTopDown(
        MARGIN_X,
        cursorY + rowH,
        MARGIN_X + CONTENT_W,
        cursorY + rowH,
        '#DCE7E8',
        0.55
      );

      for (const box of columnBoxes) {
        const block = blocks[box.key];
        if (!block || block.lines.length === 0) continue;

        let lineTop = cursorY + (rowH - block.totalHeight) / 2;
        for (const ln of block.lines) {
          lineTop += ln.gapBefore;
          const lineCenterY = lineTop + ln.lineHeight / 2;
          page.drawAlignedSingleLine({
            text: ln.text,
            font: ln.font,
            fontSize: ln.fontSize,
            colorHex: ln.colorHex,
            boxX: box.x,
            boxW: box.w,
            centerY: lineCenterY,
            align: box.align,
            paddingX: cellPadX,
            preFitted: true,
          });
          lineTop += ln.lineHeight;
        }
      }

      cursorY += rowH;
    }
  }

  // Stamp crisp vector footers on all pages and flush operators
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    const footerLineY = PAGE_H - 28;
    p.drawLineTopDown(
      MARGIN_X,
      footerLineY,
      MARGIN_X + CONTENT_W,
      footerLineY,
      '#DCE7E8',
      0.6
    );

    p.drawAlignedSingleLine({
      text: dataset.isEn
        ? 'Classy — Official Session & Attendance Statement'
        : 'Classy — بيان رسمي لمتابعة الحصص والحضور',
      font: fonts.regular,
      fontSize: 7.6,
      colorHex: '#64748B',
      boxX: isRTL ? MARGIN_X + CONTENT_W * 0.35 : MARGIN_X,
      boxW: CONTENT_W * 0.65,
      centerY: PAGE_H - 16,
      align: 'start',
      paddingX: 0,
    });

    p.drawAlignedSingleLine({
      text: dataset.isEn
        ? `Page ${idx + 1} of ${totalPages}`
        : `صفحة ${idx + 1} من ${totalPages}`,
      font: fonts.semiBold,
      fontSize: 7.6,
      colorHex: '#4A5B6E',
      boxX: isRTL ? MARGIN_X : MARGIN_X + CONTENT_W * 0.65,
      boxW: CONTENT_W * 0.35,
      centerY: PAGE_H - 16,
      align: 'end',
      paddingX: 0,
    });

    p.flush();
  });

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  const safeBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(safeBuffer).set(pdfBytes);
  return new Blob([safeBuffer], { type: REPORT_MIME_TYPES.pdf });
}
