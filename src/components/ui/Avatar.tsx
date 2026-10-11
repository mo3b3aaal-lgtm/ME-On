import React, { useState } from 'react';
import { getAppLanguage } from '../../utils/i18n';

export type AvatarSize = 36 | 48 | 56 | 64 | 'sm' | 'md' | 'lg';

export interface AvatarProps {
  /** Circle diameter: 36, 48, 56, or 64 (or 'sm' | 'md' | 'lg') */
  size?: AvatarSize;
  /** Person or student name to compute initials */
  name?: string;
  /** Optional explicit initials override */
  initials?: string;
  /** Image URL or base64 data URI */
  src?: string | null;
  /** Alias for student profilePhoto */
  profilePhoto?: string | null;
  /** Optional student object if passed directly */
  student?: {
    name?: string;
    profilePhoto?: string | null;
  } | null;
  alt?: string;
  className?: string;
}

const SIZE_MAP: Record<string, { px: number; textClass: string }> = {
  '36': { px: 36, textClass: 'text-[13px]' },
  sm: { px: 36, textClass: 'text-[13px]' },
  '48': { px: 48, textClass: 'text-[16px]' },
  md: { px: 48, textClass: 'text-[16px]' },
  '56': { px: 56, textClass: 'text-[18px]' },
  '64': { px: 64, textClass: 'text-[20px]' },
  lg: { px: 64, textClass: 'text-[20px]' },
};

export function getInitials(name?: string, fallback = 'S'): string {
  if (!name || !name.trim()) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

/**
 * Avatar: circle (36/48/64px), white bg, navy initials 600, 2px white border, soft shadow;
 * supports an image if the app already stores one.
 */
export const Avatar: React.FC<AvatarProps> = ({
  size = 48,
  name,
  initials,
  src,
  profilePhoto,
  student,
  alt,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const isEn = getAppLanguage().startsWith('en');

  const resolvedName = student?.name || name || '';
  const resolvedPhoto =
    src ??
    (student?.profilePhoto !== undefined ? student?.profilePhoto : profilePhoto) ??
    null;

  const hasValidPhoto =
    !imgError &&
    Boolean(
      resolvedPhoto &&
        typeof resolvedPhoto === 'string' &&
        resolvedPhoto.trim().length > 10 &&
        (resolvedPhoto.startsWith('data:image') ||
          resolvedPhoto.startsWith('http') ||
          resolvedPhoto.startsWith('blob:') ||
          resolvedPhoto.startsWith('/'))
    );

  const sizeEntry = SIZE_MAP[String(size)] || SIZE_MAP['48'];
  const displayInitials =
    initials || getInitials(resolvedName, isEn ? 'S' : 'ط');

  return (
    <div
      style={{ width: sizeEntry.px, height: sizeEntry.px }}
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full bg-page text-navy font-semibold border-2 border-page shadow-white overflow-hidden select-none ${sizeEntry.textClass} ${className}`.trim()}
      title={resolvedName || undefined}
    >
      {hasValidPhoto ? (
        <img
          src={resolvedPhoto!}
          alt={alt || resolvedName || 'Avatar'}
          className="w-full h-full object-cover rounded-full pointer-events-none"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="leading-none">{displayInitials}</span>
      )}
    </div>
  );
};

export default Avatar;
