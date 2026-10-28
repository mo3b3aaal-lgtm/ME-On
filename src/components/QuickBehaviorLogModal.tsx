import React, { useState, useEffect, useRef } from 'react';
import { Student, Group, BehaviorCategory, StudentBehaviorLog, PredefinedBehaviorTag } from '../types';
import { PREDEFINED_BEHAVIOR_TAGS } from '../utils/behavior';
import { db } from '../utils/storage';
import { StudentAvatar } from './StudentAvatar';
import { getStudentProgression, previewBehaviorPointsImpact } from '../utils/studentProgression';
import { useTranslation } from '../utils/i18n';
import { toLocalISODate } from '../utils/localDate';
import { SegmentedControl } from './ui/SegmentedControl';
import { BottomSheet } from './ui/BottomSheet';
import { AppIcon } from './ui/AppIcon';

interface QuickBehaviorLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  availableGroups?: Group[];
  onSuccess?: (log: StudentBehaviorLog) => void;
}

export const QuickBehaviorLogModal: React.FC<QuickBehaviorLogModalProps> = ({
  isOpen,
  onClose,
  student,
  availableGroups = [],
  onSuccess,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  // Filter state for predefined tags
  const [activeCategory, setActiveCategory] = useState<'all' | BehaviorCategory>('all');
  
  // Selected tag and form fields
  const [selectedTag, setSelectedTag] = useState<PredefinedBehaviorTag | null>(null);
  const [customTagName, setCustomTagName] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [category, setCategory] = useState<BehaviorCategory>('positive');
  const [points, setPoints] = useState<number>(10);
  const [note, setNote] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Timestamp mode: 'now' or 'custom'
  const [isCustomTimestamp, setIsCustomTimestamp] = useState<boolean>(false);
  const [customDate, setCustomDate] = useState<string>('');
  const [customTime, setCustomTime] = useState<string>('');

  // Save animation state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState<boolean>(false);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Student's enrollments to resolve groups
  const studentEnrollments = student ? db.getStudentEnrollments(student.id) : [];
  const enrolledGroupIds = new Set(studentEnrollments.map((e) => e.groupId));
  const studentGroups = (availableGroups.length > 0 ? availableGroups : db.getGroups()).filter((g) =>
    enrolledGroupIds.has(g.id)
  );

  useEffect(() => {
    if (submitTimerRef.current !== null) {
      clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }
    if (isOpen && student) {
      const defaultTag = PREDEFINED_BEHAVIOR_TAGS.find((t) => t.id === 'excellent_participation') || PREDEFINED_BEHAVIOR_TAGS[0];
      setSelectedTag(defaultTag);
      setIsCustomMode(false);
      setCustomTagName('');
      setCategory(defaultTag ? defaultTag.category : 'positive');
      setPoints(defaultTag ? (defaultTag.points ?? 10) : 10);
      setNote('');
      setSelectedGroupId(studentGroups.length > 0 ? studentGroups[0].id : '');

      const now = new Date();
      setCustomDate(toLocalISODate(now));
      setCustomTime(now.toTimeString().slice(0, 5));
      setIsCustomTimestamp(false);
      setIsSubmitting(false);
      setIsSavedSuccess(false);
    }
    return () => {
      if (submitTimerRef.current !== null) {
        clearTimeout(submitTimerRef.current);
        submitTimerRef.current = null;
      }
    };
  }, [isOpen, student?.id]);

  if (!isOpen || !student) return null;

  const handleSelectPredefinedTag = (tag: PredefinedBehaviorTag) => {
    setSelectedTag(tag);
    setIsCustomMode(false);
    setCategory(tag.category);
    setPoints(tag.points ?? 0);
  };

  const handleEnableCustomTag = () => {
    setIsCustomMode(true);
    setSelectedTag(null);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || isSavedSuccess) return;

    const tagName = isCustomMode ? customTagName.trim() : (isEn ? (selectedTag?.nameEn || selectedTag?.name || 'Behavior Note') : (selectedTag?.name || 'ملاحظة سلوكية'));
    if (!tagName) return;

    setIsSubmitting(true);

    let finalTimestamp = new Date().toISOString();
    if (isCustomTimestamp && customDate && customTime) {
      try {
        const combined = new Date(`${customDate}T${customTime}:00`);
        if (!isNaN(combined.getTime())) {
          finalTimestamp = combined.toISOString();
        }
      } catch {
        finalTimestamp = new Date().toISOString();
      }
    }

    const selectedGroup = studentGroups.find((g) => g.id === selectedGroupId);

    const newLog: StudentBehaviorLog = {
      id: `bhv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      studentId: student.id,
      studentName: student.name,
      groupId: selectedGroupId || undefined,
      groupName: selectedGroup?.name,
      tag: tagName,
      tagEn: selectedTag?.nameEn,
      category: isCustomMode ? category : (selectedTag?.category || category),
      emoji: isCustomMode ? (category === 'positive' ? '🌟' : category === 'needs_improvement' ? '⚠️' : '📝') : selectedTag?.emoji,
      points: Number(points) || 0,
      note: note.trim() || undefined,
      timestamp: finalTimestamp,
      createdAt: new Date().toISOString(),
    };

    db.saveBehaviorLog(newLog);

    setIsSavedSuccess(true);
    if (submitTimerRef.current !== null) {
      clearTimeout(submitTimerRef.current);
    }
    submitTimerRef.current = setTimeout(() => {
      submitTimerRef.current = null;
      setIsSubmitting(false);
      if (onSuccess) {
        onSuccess(newLog);
      }
      onClose();
    }, 650);
  };

  const filteredTags = PREDEFINED_BEHAVIOR_TAGS.filter((t) => {
    if (activeCategory === 'all') return true;
    return t.category === activeCategory;
  });

  const progression = getStudentProgression(student);
  const impact = previewBehaviorPointsImpact(student, points);

  return (
    <BottomSheet
      id="quick-behavior-log-modal"
      isOpen={isOpen}
      onClose={onClose}
      title={isEn ? 'Record Behavior & Assessment' : 'تسجيل سلوك وتفاعل سريع'}
      subtitle={`${student.name} · ${isEn ? progression.frameDef.shortLabelEn : progression.frameDef.shortLabelAr}${student.gradeLevel ? ` · ${student.gradeLevel}` : ''}`}
      headerLeading={
        <StudentAvatar
          student={student}
          size="sm"
          showFrame={true}
          className="shrink-0"
        />
      }
      headerTrailing={
        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-mint-soft text-navy border border-line">
          {points > 0 ? `+${points}` : points} {t('points')}
        </span>
      }
      bodyClassName="p-4"
      footer={
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isSavedSuccess}
            className="btn-soft flex-1"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting || isSavedSuccess || (isCustomMode && !customTagName.trim())}
            className="btn-orange flex-1"
          >
            {isSavedSuccess ? (
              <>
                <AppIcon name="checkCircle" size={16} weight="bold" />
                <span>{isEn ? 'Rating Saved!' : 'تم حفظ التقييم بنجاح!'}</span>
              </>
            ) : (
              <>
                <AppIcon name="zap" size={16} weight="bold" />
                <span>{isEn ? 'Save Behavior Rating' : 'حفظ تقييم السلوك'}</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-navy">
        {/* Student Bar with Live XP & Level Up Preview */}
        <div className="p-3 rounded-2xl bg-page border border-line flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <StudentAvatar
              student={student}
              size="md"
              showFrame={true}
              className="shrink-0"
            />
            <div className="min-w-0 text-start space-y-0.5">
              <h4 className="text-xs font-black text-navy leading-tight truncate">{student.name}</h4>
              <p className="text-[11px] text-slate tabular-nums truncate">
                {isEn ? progression.frameDef.shortLabelEn : progression.frameDef.shortLabelAr}
                {' · '}
                {progression.totalXp} {isEn ? 'XP' : 'نقطة'}
                {impact.xpDelta !== 0 && (
                  <span className="font-semibold text-navy">
                    {' → '}
                    {impact.projectedXp} {isEn ? 'XP' : 'نقطة'}
                  </span>
                )}
              </p>
              {impact.leveledUp && (
                <p className="text-[11px] font-bold text-teal">
                  {isEn
                    ? `Level Up to ${impact.projectedFrameDef.shortLabelEn}!`
                    : `ترقية إلى ${impact.projectedFrameDef.shortLabelAr}!`}
                </p>
              )}
            </div>
          </div>

          <div className="text-end shrink-0 tabular-nums">
            <span className="text-sm font-black text-navy block">
              {points > 0 ? `+${points}` : points} {t('points')}
            </span>
            <span className="text-[10px] text-slate block">
              {impact.xpDelta > 0 ? `+${impact.xpDelta}` : impact.xpDelta} XP
            </span>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="space-y-2 text-start">
          <div className="flex items-center justify-between">
            <label className="field-label mb-0">{isEn ? 'Select Assessment / Tag:' : 'اختر نوع التقييم / الوسم:'}</label>
            <button
              type="button"
              onClick={handleEnableCustomTag}
              className={`chip ${isCustomMode ? 'chip-active' : ''}`}
            >
              <AppIcon name="plus" size={12} weight="bold" />
              <span>{isEn ? 'Custom Tag' : 'وسم مخصص'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`chip ${activeCategory === 'all' ? 'chip-active' : ''}`}
            >
              {isEn ? 'All' : 'الكل'}
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('positive')}
              className={`chip ${activeCategory === 'positive' ? 'chip-active' : ''}`}
            >
              <span>🌟</span>
              <span>{isEn ? 'Positive' : 'تميز وتفاعل'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('needs_improvement')}
              className={`chip ${activeCategory === 'needs_improvement' ? 'chip-active' : ''}`}
            >
              <span>⚠️</span>
              <span>{isEn ? 'Needs Work' : 'يحتاج تحسين'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('neutral')}
              className={`chip ${activeCategory === 'neutral' ? 'chip-active' : ''}`}
            >
              <span>📝</span>
              <span>{isEn ? 'General' : 'عام'}</span>
            </button>
          </div>
        </div>

        {/* Custom Mode Tag Input */}
        {isCustomMode && (
          <div className="p-3.5 rounded-2xl bg-mint-soft/40 border border-line space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-navy flex items-center gap-1.5">
                <AppIcon name="sparkles" size={14} weight="fill" className="text-navy" />
                {isEn ? 'Write Custom Tag' : 'كتابة وسم مخصص'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCategory('positive')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${
                    category === 'positive'
                      ? 'bg-navy text-white'
                      : 'bg-page text-navy border border-line'
                  }`}
                >
                  {isEn ? 'Positive' : 'إيجابي'}
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('needs_improvement')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${
                    category === 'needs_improvement'
                      ? 'bg-navy text-white'
                      : 'bg-page text-navy border border-line'
                  }`}
                >
                  {isEn ? 'Needs Attention' : 'يحتاج تحسين'}
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('neutral')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${
                    category === 'neutral'
                      ? 'bg-navy text-white'
                      : 'bg-page text-navy border border-line'
                  }`}
                >
                  {isEn ? 'General' : 'عام'}
                </button>
              </div>
            </div>

            <input
              type="text"
              value={customTagName}
              onChange={(e) => setCustomTagName(e.target.value)}
              placeholder={isEn ? 'e.g. Mastered topic, solved complex problem...' : 'مثال: تميز في حفظ جدول الضرب، حل مسألة صعبة...'}
              className="classy-input font-bold"
              autoFocus
            />
          </div>
        )}

        {/* Predefined Tags Grid */}
        <div className="grid grid-cols-2 gap-2">
          {filteredTags.map((tag) => {
            const isSelected = !isCustomMode && selectedTag?.id === tag.id;
            const displayTitle = isEn ? (tag.nameEn || tag.name) : tag.name;
            const displaySubtitle = isEn ? tag.name : tag.nameEn;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleSelectPredefinedTag(tag)}
                className={`p-3 rounded-2xl border ${isRTL ? 'text-right' : 'text-left'} transition-all flex flex-col justify-between gap-2 cursor-pointer text-xs ${
                  isSelected
                    ? 'border-navy bg-mint text-navy font-bold shadow-2xs'
                    : 'border-line bg-page hover:bg-mint-soft text-navy'
                }`}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="text-lg leading-none">{tag.emoji}</span>
                  {isSelected ? (
                    <span className="w-5 h-5 rounded-full bg-navy text-white flex items-center justify-center">
                      <AppIcon name="check" size={12} weight="bold" />
                    </span>
                  ) : (
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                        (tag.points ?? 0) > 0
                          ? 'bg-mint-soft text-navy border border-line'
                          : (tag.points ?? 0) < 0
                          ? 'bg-coral-soft text-coral border border-coral/30'
                          : 'bg-page text-slate border border-line'
                      }`}
                    >
                      {(tag.points ?? 0) > 0 ? `+${tag.points}` : tag.points}
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-black text-navy text-xs leading-tight line-clamp-1">{displayTitle}</h4>
                  {displaySubtitle && (
                    <p className="text-[10px] text-slate mt-0.5 line-clamp-1 font-medium">{displaySubtitle}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Timestamp & Timing Controls */}
        <div className="p-3.5 rounded-2xl bg-page border border-line space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-black text-navy">
              <AppIcon name="clock" size={14} className="text-navy" />
              <span>{isEn ? 'Timestamp:' : 'توقيت التسجيل:'}</span>
            </div>

            <SegmentedControl<'now' | 'custom'>
              value={isCustomTimestamp ? 'custom' : 'now'}
              onChange={(val) => setIsCustomTimestamp(val === 'custom')}
              options={[
                { value: 'now', label: isEn ? 'Now (Auto)' : 'الآن (تلقائي)' },
                { value: 'custom', label: isEn ? 'Custom Date/Time' : 'تحديد وقت سابق' },
              ]}
              className="w-56"
            />
          </div>

          {isCustomTimestamp ? (
            <div className="grid grid-cols-2 gap-2 pt-1 text-start">
              <div>
                <label className="field-label">{isEn ? 'Date:' : 'التاريخ:'}</label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="classy-input"
                />
              </div>
              <div>
                <label className="field-label">{isEn ? 'Time:' : 'الوقت:'}</label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="classy-input"
                />
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-mint-soft rounded-xl flex items-center justify-between text-[11px] text-slate">
              <span>{isEn ? 'Recorded at current time.' : 'سيتم حفظ التقييم بتوقيت اللحظة الحالية بدقة.'}</span>
              <span className="font-black text-navy">
                {new Date().toLocaleTimeString(isEn ? 'en-US' : 'ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
            </div>
          )}
        </div>

        {/* Optional Group Association & Points Setting */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-start">
          {studentGroups.length > 0 && (
            <div className="p-3 rounded-2xl bg-page border border-line space-y-1.5">
              <label className="field-label flex items-center gap-1.5">
                <AppIcon name="book" size={14} className="text-navy" />
                <span>{isEn ? 'Linked Class / Group:' : 'المجموعة / الحصة المرتبطة:'}</span>
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="classy-select"
              >
                <option value="">{isEn ? 'General (No specific group)' : 'عام (بدون مجموعة محددة)'}</option>
                {studentGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.type === 'private' ? (isEn ? 'Private Lesson' : 'درس خاص') : (isEn ? 'Group' : 'مجموعة')})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="p-3 rounded-2xl bg-page border border-line space-y-1.5">
            <label className="field-label flex items-center gap-1.5">
              <AppIcon name="award" size={14} className="text-navy" />
              <span>{isEn ? 'Points Impact:' : 'النقاط / التأثير:'}</span>
            </label>
            <div className="flex items-center gap-1 flex-wrap">
              {[-10, -5, 0, 5, 10, 15].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPoints(val)}
                  className={`chip flex-1 px-2 ${points === val ? 'chip-active' : ''}`}
                >
                  {val > 0 ? `+${val}` : val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="p-3 rounded-2xl bg-page border border-line space-y-1.5 text-start">
          <label className="field-label flex items-center gap-1.5">
            <AppIcon name="edit" size={14} className="text-navy" />
            <span>{isEn ? 'Additional Note (Optional):' : 'ملاحظة أو تفاصيل إضافية (اختياري):'}</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isEn ? 'Add quick feedback notes or follow-up reason...' : 'أضف أي تفاصيل سريعة تخص هذا التقييم، تفاعل الطالب، أو سبب التنبيه...'}
            rows={2}
            className="classy-textarea"
          />
        </div>
      </form>
    </BottomSheet>
  );
};
