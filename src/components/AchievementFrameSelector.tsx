import React, { useState, useRef, useEffect } from 'react';
import { AppIcon } from './ui/AppIcon';
import { AchievementFrame } from '../types';
import { StudentAvatar, ACHIEVEMENT_FRAME_INFO, FrameInfoItem } from './StudentAvatar';
import { useTranslation } from '../utils/i18n';
import {
  getStudentProgression,
  normalizeManualOrLegacyFrame,
} from '../utils/studentProgression';

interface AchievementFrameSelectorProps {
  selectedFrame?: AchievementFrame;
  onSelectFrame: (frame: AchievementFrame) => void;
  studentId?: string;
  studentName?: string;
  profilePhoto?: string | null;
  avatarColor?: string;
  className?: string;
}

// Automatic Level & Behavior Progression + 10 Custom Uploaded Frames (Level 1 -> Level MAX)
const SELECTABLE_FRAMES: AchievementFrame[] = [
  'auto',
  'level_1',
  'level_2',
  'level_3',
  'level_4',
  'level_5',
  'level_6',
  'level_7',
  'level_8',
  'level_9',
  'level_10',
];

export function isFrameActive(
  frameId: AchievementFrame,
  current: AchievementFrame | string | undefined
): boolean {
  const raw = current || 'auto';
  if (
    frameId === 'auto' &&
    (raw === 'auto' || raw === 'none' || raw === 'default')
  ) {
    return true;
  }
  const normalizedCurrent = normalizeManualOrLegacyFrame(raw);
  if (normalizedCurrent && frameId === normalizedCurrent) {
    return true;
  }
  return frameId === raw;
}

export const AchievementFrameSelector: React.FC<AchievementFrameSelectorProps> = ({
  selectedFrame = 'auto',
  onSelectFrame,
  studentId,
  studentName,
  profilePhoto,
  avatarColor = '#17375E',
  className = '',
}) => {
  const { language } = useTranslation();
  const isEn = language.startsWith('en');
  const langKey = language === 'en-GB' || language === 'en-US' ? language : 'ar';
  const effectiveStudentName = studentName || (isEn ? 'Student' : 'طالب');

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAutoSelected =
    !selectedFrame ||
    selectedFrame === 'auto' ||
    selectedFrame === 'none' ||
    selectedFrame === 'default';

  const normalizedManualKey = !isAutoSelected
    ? normalizeManualOrLegacyFrame(selectedFrame)
    : null;

  const currentFrameKey: AchievementFrame = isAutoSelected
    ? 'auto'
    : normalizedManualKey || 'auto';

  const activeFrameInfo: FrameInfoItem =
    ACHIEVEMENT_FRAME_INFO[currentFrameKey] || ACHIEVEMENT_FRAME_INFO.auto;

  const liveProgression = getStudentProgression(studentId || 'temp');
  const autoPreviewLabel = isEn
    ? `${liveProgression.frameDef.shortLabelEn} · ${liveProgression.totalXp} XP`
    : `${liveProgression.frameDef.shortLabelAr} · ${liveProgression.totalXp} نقطة`;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (frameId: AchievementFrame) => {
    onSelectFrame(frameId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative space-y-1.5 ${className}`}>
      {/* Field Label Header */}
      <div className="flex items-center justify-between gap-2">
        <label className="font-bold text-navy text-xs sm:text-sm flex items-center gap-1.5">
          <AppIcon name="award" size={14} className="text-navy" />
          <span>{isEn ? 'Level & Avatar Frame' : 'إطار المستوى والتميز'}</span>
        </label>
        <span className="text-[11px] font-semibold text-slate tabular-nums">
          {isAutoSelected ? autoPreviewLabel : activeFrameInfo.tierLabel[langKey]}
        </span>
      </div>

      {/* Compact Selector Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-start transition-all cursor-pointer shadow-2xs ${
          isOpen
            ? 'bg-mint-soft/30 border-navy ring-2 ring-navy/20'
            : 'bg-gradient-to-r from-mint-soft/40 via-white to-white border-navy/30 hover:border-navy shadow-xs'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-11 h-11 flex items-center justify-center">
            <StudentAvatar
              student={{
                id: studentId || 'temp',
                name: effectiveStudentName,
                avatarColor,
                profilePhoto,
                avatarFrameMode: isAutoSelected ? 'auto' : 'manual',
                achievementFrame: currentFrameKey,
              }}
              achievementFrame={currentFrameKey}
              size="sm"
              showFrame={true}
            />
          </div>

          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-navy truncate">
              {activeFrameInfo.name[langKey]}
            </p>
            <p className="text-[11px] text-slate truncate">
              {activeFrameInfo.desc[langKey]}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1 text-slate">
          <AppIcon
            name="chevron-down"
            size={16}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-navy' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          role="listbox"
          aria-label={isEn ? 'Select Student Level Frame' : 'اختر إطار مستوى الطالب'}
          className="absolute z-50 start-0 end-0 mt-1.5 p-1.5 rounded-2xl bg-page border border-line shadow-2xl space-y-1 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 py-1.5 border-b border-line flex items-center justify-between text-[11px] font-bold text-slate">
            <span>{isEn ? 'Level 1 to Level MAX Progression' : 'تدرج المستويات (من المستوى 1 حتى MAX)'}</span>
            <span className="text-[10px] text-slate/80 tabular-nums">
              {isEn ? '10 Levels' : '10 مستويات'}
            </span>
          </div>

          {SELECTABLE_FRAMES.map((frameId) => {
            const info = ACHIEVEMENT_FRAME_INFO[frameId] || ACHIEVEMENT_FRAME_INFO.auto;
            const isSelected = isFrameActive(frameId, currentFrameKey);
            const isOptionAuto = frameId === 'auto';

            return (
              <button
                key={frameId}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(frameId)}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border text-start transition-all cursor-pointer frame-dropdown-option ${
                  isSelected
                    ? 'bg-mint-soft border-navy ring-1 ring-navy/30 shadow-xs frame-dropdown-option-active'
                    : 'bg-page border-transparent hover:border-line hover:bg-mint-soft/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 w-12 h-11 flex items-center justify-center">
                    <StudentAvatar
                      student={{
                        id: studentId || 'temp',
                        name: effectiveStudentName,
                        avatarColor,
                        profilePhoto,
                        avatarFrameMode: isOptionAuto ? 'auto' : 'manual',
                        achievementFrame: frameId,
                      }}
                      achievementFrame={frameId}
                      size="sm"
                      showFrame={true}
                    />
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs sm:text-sm font-black text-navy truncate">
                        {info.name[langKey]}
                      </span>
                      <span aria-hidden="true" className="text-slate/50 text-xs shrink-0">
                        ·
                      </span>
                      <span className="text-[11px] font-semibold text-slate shrink-0 tabular-nums">
                        {isOptionAuto ? autoPreviewLabel : info.tierLabel[langKey]}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate line-clamp-1 leading-snug">
                      {info.desc[langKey]}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center justify-center">
                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-navy text-white flex items-center justify-center shadow-xs">
                      <AppIcon name="check" size={13} weight="bold" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-line" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
