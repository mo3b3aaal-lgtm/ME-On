import React from 'react';
import { AchievementFrame } from '../types';
import {
  getLevelDefinitionByFrame,
  LEVEL_FRAME_DEFINITIONS,
  normalizeManualOrLegacyFrame,
} from '../utils/studentProgression';

interface FrameSVGProps {
  frame: AchievementFrame;
  altText?: string;
  className?: string;
}

/**
 * Renders the exact custom uploaded Golden Level Up Frame asset (Level 1 -> Level Max)
 * extracted directly from the user's supplied artwork.
 */
export const AchievementFrameSVG: React.FC<FrameSVGProps> = React.memo(
  ({ frame, altText, className = '' }) => {
    if (!frame || frame === 'none' || frame === 'default') {
      return null;
    }

    const def =
      frame === 'auto'
        ? LEVEL_FRAME_DEFINITIONS[1]
        : normalizeManualOrLegacyFrame(frame)
        ? getLevelDefinitionByFrame(frame)
        : LEVEL_FRAME_DEFINITIONS[1];

    return (
      <img
        src={def.assetSrc}
        alt={altText || def.titleEn}
        referrerPolicy="no-referrer"
        draggable={false}
        className={`w-full h-full object-contain pointer-events-none select-none drop-shadow-sm ${className}`}
      />
    );
  }
);
