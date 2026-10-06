import React from 'react';
import { Check, Sparkles, X, ShieldAlert } from 'lucide-react';
import { AchievementFrame } from '../types';
import { StudentAvatar, ACHIEVEMENT_FRAME_INFO, FrameInfoItem } from './StudentAvatar';
import { useTranslation } from '../utils/i18n';

interface AchievementFrameSelectorProps {
  selectedFrame: AchievementFrame;
  onSelectFrame: (frame: AchievementFrame) => void;
  studentName?: string;
  profilePhoto?: string | null;
  avatarColor?: string;
  className?: string;
}

// Ordered list of unique selectable achievement frames
const SELECTABLE_FRAMES: AchievementFrame[] = [
  'none',
  'bronze_star',
  'silver_scholar',
  'gold_champion',
  'platinum',
  'emerald_honor',
  'diamond_elite',
  'crown',
  'champion',
];

export const AchievementFrameSelector: React.FC<AchievementFrameSelectorProps> = ({
  selectedFrame,
  onSelectFrame,
  studentName,
  profilePhoto,
  avatarColor = '#6B1E2B',
  className = '',
}) => {
  const { language } = useTranslation();
  const isEn = language.startsWith('en');
  const langKey = language === 'en-GB' || language === 'en-US' ? language : 'ar';
  const effectiveStudentName = studentName || (isEn ? 'Student' : 'الطالب');

  const currentFrameKey = selectedFrame || 'none';
  const activeFrameInfo: FrameInfoItem =
    ACHIEVEMENT_FRAME_INFO[currentFrameKey] || ACHIEVEMENT_FRAME_INFO.none;

  const isNoFrame = currentFrameKey === 'none' || currentFrameKey === 'default';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Live Preview Card */}
      <div
        className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row items-center gap-4 ${
          isNoFrame
            ? 'bg-[#FAF7F2] border-[#EADBC7]'
            : 'bg-gradient-to-br from-[#EADBC7]/60 via-[#FAF7F2] to-[#F8F2EA] border-[#B68A4C]/50 shadow-md'
        }`}
      >
        {/* Large Live Avatar Preview */}
        <div className="shrink-0 flex items-center justify-center p-2">
          <StudentAvatar
            name={effectiveStudentName}
            avatarColor={avatarColor}
            profilePhoto={profilePhoto}
            achievementFrame={currentFrameKey}
            size="2xl"
            showFrame={true}
          />
        </div>

        {/* Info & Current Tier Details */}
        <div className="flex-1 text-center sm:text-start space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide ${
                isNoFrame
                  ? 'bg-[#EADBC7] text-[#69493C]'
                  : 'bg-[#6B1E2B]/12 text-[#6B1E2B] border border-[#6B1E2B]/30'
              }`}
            >
              {activeFrameInfo.tierLabel[langKey]}
            </span>
            <h4 className="text-base font-black text-[#2F2F2F] truncate">
              {activeFrameInfo.name[langKey]}
            </h4>
          </div>

          <p className="text-xs text-[#69493C] line-clamp-2 leading-relaxed">
            {activeFrameInfo.desc[langKey]}
          </p>

          {!isNoFrame && (
            <button
              type="button"
              onClick={() => onSelectFrame('none')}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#69493C] hover:text-[#6B1E2B] transition-colors mt-1 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>{isEn ? 'Remove frame (Reset to default)' : 'إزالة الإطار (العودة للافتراضي)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Frame Selection Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[340px] overflow-y-auto p-1 rounded-2xl border border-[#EADBC7] bg-[#FAF7F2]">
        {SELECTABLE_FRAMES.map((frameId) => {
          const info = ACHIEVEMENT_FRAME_INFO[frameId] || ACHIEVEMENT_FRAME_INFO.none;
          const isSelected =
            currentFrameKey === frameId ||
            (frameId === 'bronze_star' && currentFrameKey === 'star') ||
            (frameId === 'silver_scholar' && currentFrameKey === 'silver') ||
            (frameId === 'gold_champion' && currentFrameKey === 'gold') ||
            (frameId === 'none' && currentFrameKey === 'default');

          return (
            <button
              key={frameId}
              type="button"
              onClick={() => onSelectFrame(frameId)}
              className={`relative p-3 rounded-2xl border text-start transition-all flex flex-col items-center justify-between gap-2.5 group cursor-pointer ${
                isSelected
                  ? 'bg-[#F8F2EA] border-[#6B1E2B] ring-2 ring-[#6B1E2B]/20 shadow-md scale-[1.02]'
                  : 'bg-[#FAF7F2] border-[#EADBC7] hover:border-[#B68A4C] hover:bg-[#F8F2EA] hover:shadow-xs'
              }`}
            >
              {/* Selected Checkmark Badge */}
              {isSelected && (
                <div className="absolute top-2 end-2 w-5 h-5 rounded-full bg-[#6B1E2B] text-[#FAF7F2] flex items-center justify-center shadow-xs">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}

              {/* Avatar Live Thumbnail */}
              <div className="pt-1 pb-0.5 flex items-center justify-center">
                <StudentAvatar
                  name={effectiveStudentName}
                  avatarColor={avatarColor}
                  profilePhoto={profilePhoto}
                  achievementFrame={frameId}
                  size="lg"
                  showFrame={true}
                />
              </div>

              {/* Card Meta & Labels */}
              <div className="w-full text-center space-y-0.5">
                <span className="text-[10px] font-extrabold text-[#69493C] block uppercase tracking-wider">
                  {info.tierLabel[langKey]}
                </span>
                <p className="text-xs font-bold text-[#2F2F2F] truncate w-full group-hover:text-[#6B1E2B] transition-colors">
                  {info.name[langKey]}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
