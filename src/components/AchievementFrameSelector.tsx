import React, { useState, useRef, useEffect } from 'react';
import { AppIcon } from './ui/AppIcon';
import { AchievementFrame } from '../types';
import { StudentAvatar, ACHIEVEMENT_FRAME_INFO, FrameInfoItem } from './StudentAvatar';
import { useTranslation } from '../utils/i18n';

interface AchievementFrameSelectorProps {
  selectedFrame?: AchievementFrame;
  onSelectFrame: (frame: AchievementFrame) => void;
  studentName?: string;
  profilePhoto?: string | null;
  avatarColor?: string;
  className?: string;
}

// 8 Distinct Premium Gaming Frame Tiers + Default No-Frame
const SELECTABLE_FRAMES: AchievementFrame[] = [
  'none',
  'silver',
  'gold',
  'platinum',
  'vip',
  'story',
  'challenge',
  'nature',
  'cosmic',
];

const TIER_PILL_MAP: Record<string, string> = {
  silver: 'frame-tier-pill-silver',
  gold: 'frame-tier-pill-gold',
  platinum: 'frame-tier-pill-platinum',
  vip: 'frame-tier-pill-vip',
  story: 'frame-tier-pill-story',
  challenge: 'frame-tier-pill-challenge',
  nature: 'frame-tier-pill-nature',
  cosmic: 'frame-tier-pill-cosmic',
};

// Helper to determine if a frame ID matches the active selection (including legacy aliases)
export function isFrameActive(frameId: AchievementFrame, current: AchievementFrame | string | undefined): boolean {
  const normCurrent = current || 'none';
  if (frameId === normCurrent) return true;
  if ((frameId === 'none' || frameId === 'default') && (normCurrent === 'none' || normCurrent === 'default')) return true;
  if (frameId === 'silver' && normCurrent === 'silver_scholar') return true;
  if (frameId === 'gold' && normCurrent === 'gold_champion') return true;
  if (frameId === 'vip' && (normCurrent === 'crown' || normCurrent === 'champion')) return true;
  if (frameId === 'story' && normCurrent === 'diamond_elite') return true;
  if (frameId === 'challenge' && normCurrent === 'bronze_star') return true;
  if (frameId === 'nature' && normCurrent === 'emerald_honor') return true;
  if (frameId === 'cosmic' && normCurrent === 'star') return true;
  return false;
}

export const AchievementFrameSelector: React.FC<AchievementFrameSelectorProps> = ({
  selectedFrame = 'none',
  onSelectFrame,
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

  const currentFrameKey: AchievementFrame = (selectedFrame || 'none') as AchievementFrame;
  const activeFrameInfo: FrameInfoItem =
    ACHIEVEMENT_FRAME_INFO[currentFrameKey] || ACHIEVEMENT_FRAME_INFO.none;

  const isNoFrame = currentFrameKey === 'none' || currentFrameKey === 'default';

  // Handle outside click & Escape key to close popover
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
      <div className="flex items-center justify-between">
        <label className="font-bold text-navy text-xs sm:text-sm flex items-center gap-1.5">
          <AppIcon name="award" size={14} className="text-navy" />
          <span>{isEn ? 'Student Frame' : 'إطار الطالب'}</span>
        </label>
        {!isNoFrame && (
          <span className={`frame-tier-pill ${TIER_PILL_MAP[currentFrameKey] || 'bg-navy/10 text-navy'}`}>
            {activeFrameInfo.tierLabel[langKey]}
          </span>
        )}
      </div>

      {/* Compact Selector Field Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-start transition-all cursor-pointer shadow-2xs ${
          isOpen
            ? 'bg-mint-soft/30 border-navy ring-2 ring-navy/20'
            : isNoFrame
            ? 'bg-white border-line hover:border-navy hover:bg-mint-soft/10'
            : 'bg-gradient-to-r from-mint-soft/40 via-white to-white border-navy/40 hover:border-navy shadow-xs'
        }`}
      >
        {/* Left/Start: Frame Icon Preview + Name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center">
            <StudentAvatar
              name={effectiveStudentName}
              avatarColor={avatarColor}
              profilePhoto={profilePhoto}
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
              {isNoFrame
                ? (isEn ? 'Standard appearance without extra frame' : 'المظهر الافتراضي بدون إطار إضافي')
                : activeFrameInfo.desc[langKey]}
            </p>
          </div>
        </div>

        {/* Right/End: Caret Arrow */}
        <div className="shrink-0 flex items-center gap-1 text-slate">
          <AppIcon
            name="chevron-down"
            size={16}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-navy' : ''}`}
          />
        </div>
      </button>

      {/* Polished Dropdown Popover */}
      {isOpen && (
        <div
          role="listbox"
          aria-label={isEn ? 'Select Student Frame' : 'اختر إطار الطالب'}
          className="absolute z-50 start-0 end-0 mt-1.5 p-1.5 rounded-2xl bg-white border border-line shadow-2xl space-y-1 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header Note */}
          <div className="px-3 py-1.5 border-b border-line flex items-center justify-between text-[11px] font-bold text-slate">
            <span>{isEn ? 'Available Achievement Frames' : 'مجموعة إطارات التميز المتاحة'}</span>
            <span className="text-[10px] text-slate/70">
              {SELECTABLE_FRAMES.length - 1} {isEn ? 'exclusive tiers' : 'إطارات حصرية'}
            </span>
          </div>

          {/* List of Frame Options */}
          {SELECTABLE_FRAMES.map((frameId) => {
            const info = ACHIEVEMENT_FRAME_INFO[frameId] || ACHIEVEMENT_FRAME_INFO.none;
            const isSelected = isFrameActive(frameId, currentFrameKey);
            const isOptionNone = frameId === 'none';

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
                    : 'bg-white border-transparent hover:border-line hover:bg-mint-soft/30'
                }`}
              >
                {/* Frame Mini Preview + Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 w-10 h-10 flex items-center justify-center">
                    <StudentAvatar
                      name={effectiveStudentName}
                      avatarColor={avatarColor}
                      profilePhoto={profilePhoto}
                      achievementFrame={frameId}
                      size="md"
                      showFrame={true}
                    />
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black text-navy truncate">
                        {info.name[langKey]}
                      </span>
                      {!isOptionNone && (
                        <span className={`frame-tier-pill ${TIER_PILL_MAP[frameId] || 'bg-navy/10 text-navy'}`}>
                          {info.tierLabel[langKey]}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate line-clamp-1 leading-snug">
                      {info.desc[langKey]}
                    </p>
                  </div>
                </div>

                {/* Selection Checkmark */}
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
