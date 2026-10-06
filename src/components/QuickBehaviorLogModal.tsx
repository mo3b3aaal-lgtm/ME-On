import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  Award,
  AlertTriangle,
  FileText,
  Plus,
  Bookmark,
  Check,
  Zap,
} from 'lucide-react';
import { Student, Group, BehaviorCategory, StudentBehaviorLog, PredefinedBehaviorTag } from '../types';
import { PREDEFINED_BEHAVIOR_TAGS } from '../utils/behavior';
import { db } from '../utils/storage';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { StudentAvatar } from './StudentAvatar';
import { useTranslation } from '../utils/i18n';

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
  const modalLayer = useModalLayer('quick-behavior-log-modal', isOpen, onClose);

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

  // Student's enrollments to resolve groups
  const studentEnrollments = student ? db.getStudentEnrollments(student.id) : [];
  const enrolledGroupIds = new Set(studentEnrollments.map((e) => e.groupId));
  const studentGroups = (availableGroups.length > 0 ? availableGroups : db.getGroups()).filter((g) =>
    enrolledGroupIds.has(g.id)
  );

  useEffect(() => {
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
      setCustomDate(now.toISOString().split('T')[0]);
      setCustomTime(now.toTimeString().slice(0, 5));
      setIsCustomTimestamp(false);
      setIsSubmitting(false);
      setIsSavedSuccess(false);
    }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    setTimeout(() => {
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

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#6B1E2B]/65 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#F8F2EA] border border-[#EADBC7] rounded-t-[28px] sm:rounded-[28px] max-w-xl w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl relative">
          
          {/* Signature Classy Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-[#6B1E2B] via-[#5C4033] to-[#69493C] text-[#FAF7F2] flex items-center justify-between shrink-0 relative overflow-hidden">
            <div className="flex items-center gap-3 relative z-10 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2]/15 backdrop-blur-md border border-[#EADBC7]/25 text-[#FAF7F2] flex items-center justify-center shrink-0 shadow-sm">
                <Zap className="w-5 h-5 text-[#B68A4C]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black text-[#FAF7F2] tracking-tight flex items-center gap-2 truncate">
                  <span>{isEn ? 'Record Behavior & Participation' : 'تسجيل سلوك وتفاعل سريع'}</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#FAF7F2]/20 text-[#FAF7F2] border border-[#EADBC7]/25">
                    Quick Log
                  </span>
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold text-[#EADBC7]">{student.name}</span>
                  {student.gradeLevel && (
                    <>
                      <span className="text-[#EADBC7]/50">•</span>
                      <span className="text-[11px] text-[#EADBC7]/80 font-medium">{student.gradeLevel}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-2xl bg-[#FAF7F2]/10 hover:bg-[#FAF7F2]/20 text-[#FAF7F2] border border-[#EADBC7]/20 transition-all cursor-pointer relative z-10 active:scale-95"
              title={t('close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto android-scrollbar p-4 sm:p-5 space-y-4 text-xs text-[#2F2F2F]">
            
            {/* Student Pill Bar */}
            <div className="classy-card p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <StudentAvatar
                  student={student}
                  size="sm"
                  showFrame={true}
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-[#2F2F2F] leading-tight truncate">{student.name}</h4>
                  <p className="text-[10px] text-[#69493C] mt-0.5">{isEn ? 'Quick feedback and class evaluation' : 'رصد فوري لتقييم الحصة والأداء'}</p>
                </div>
              </div>

              {/* Quick Points Display Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#EADBC7]/50 border border-[#B6A89C] shrink-0">
                <Award className="w-3.5 h-3.5 text-[#6B1E2B]" />
                <span className="text-xs font-black text-[#2F2F2F]">
                  {points > 0 ? `+${points}` : points} {t('points')}
                </span>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-[#2F2F2F]">{isEn ? 'Select Assessment / Tag:' : 'اختر نوع التقييم / الوسم:'}</label>
                <button
                  type="button"
                  onClick={handleEnableCustomTag}
                  className={`text-[11px] font-black px-2.5 py-1 rounded-xl border transition-all flex items-center gap-1 cursor-pointer ${
                    isCustomMode
                      ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B] shadow-xs'
                      : 'bg-[#FAF7F2] text-[#6B1E2B] border-[#B6A89C] hover:bg-[#EADBC7]/40'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>{isEn ? 'Custom Tag' : 'وسم مخصص'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                    activeCategory === 'all'
                      ? 'bg-[#6B1E2B] text-[#FAF7F2] shadow-xs'
                      : 'bg-[#FAF7F2] text-[#69493C] border border-[#EADBC7] hover:bg-[#F8F2EA]'
                  }`}
                >
                  {isEn ? 'All' : 'الكل'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('positive')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === 'positive'
                      ? 'bg-[#5C4033] text-[#FAF7F2] shadow-xs'
                      : 'bg-[#FAF7F2] text-[#5C4033] border border-[#B68A4C]/50 hover:bg-[#EADBC7]/65'
                  }`}
                >
                  <span>🌟</span>
                  <span>{isEn ? 'Positive' : 'تميز وتفاعل'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('needs_improvement')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === 'needs_improvement'
                      ? 'bg-[#B56B45] text-[#FAF7F2] shadow-xs'
                      : 'bg-[#FAF7F2] text-[#B56B45] border border-[#B6A89C] hover:bg-[#F8F2EA]'
                  }`}
                >
                  <span>⚠️</span>
                  <span>{isEn ? 'Needs Work' : 'يحتاج تحسين'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('neutral')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === 'neutral'
                      ? 'bg-[#5C4033] text-[#FAF7F2] shadow-xs'
                      : 'bg-[#FAF7F2] text-[#5C4033] border border-[#EADBC7] hover:bg-[#EADBC7]/40'
                  }`}
                >
                  <span>📝</span>
                  <span>{isEn ? 'General Notes' : 'ملاحظات عامة'}</span>
                </button>
              </div>
            </div>

            {/* Custom Mode Tag Input */}
            {isCustomMode && (
              <div className="classy-card p-3.5 space-y-2.5 bg-[#EADBC7]/30 border-[#B6A89C] animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#2F2F2F] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#6B1E2B]" />
                    {isEn ? 'Write Custom Tag' : 'كتابة وسم مخصص'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCategory('positive')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${
                        category === 'positive'
                          ? 'bg-[#5C4033] text-[#FAF7F2]'
                          : 'bg-[#FAF7F2] text-[#5C4033] border border-[#B68A4C]/50'
                      }`}
                    >
                      {isEn ? 'Positive' : 'إيجابي'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory('needs_improvement')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${
                        category === 'needs_improvement'
                          ? 'bg-[#B56B45] text-[#FAF7F2]'
                          : 'bg-[#FAF7F2] text-[#5C4033] border border-[#B6A89C]'
                      }`}
                    >
                      {isEn ? 'Needs Attention' : 'يحتاج تحسين'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory('neutral')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${
                        category === 'neutral'
                          ? 'bg-[#6B1E2B] text-[#FAF7F2]'
                          : 'bg-[#FAF7F2] text-[#2F2F2F] border border-[#EADBC7]'
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
                  placeholder={isEn ? 'e.g. Mastered times table, solved complex problem...' : 'مثال: تميز في حفظ جدول الضرب، حل مسألة صعبة...'}
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
                        ? 'border-[#6B1E2B] bg-[#EADBC7]/40 ring-2 ring-[#6B1E2B]/25 shadow-xs'
                        : 'border-[#EADBC7] bg-[#FAF7F2] hover:border-[#B6A89C] hover:bg-[#F8F2EA]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="text-lg leading-none">{tag.emoji}</span>
                      {isSelected ? (
                        <span className="p-1 rounded-full bg-[#6B1E2B] text-[#FAF7F2]">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                            (tag.points ?? 0) > 0
                              ? 'bg-[#F8F2EA] text-[#5C4033] border border-[#B68A4C]'
                              : (tag.points ?? 0) < 0
                              ? 'bg-[#F8F2EA] text-[#B56B45] border border-[#B6A89C]'
                              : 'bg-[#F8F2EA] text-[#69493C] border border-[#EADBC7]'
                          }`}
                        >
                          {(tag.points ?? 0) > 0 ? `+${tag.points}` : tag.points}
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-[#2F2F2F] text-xs leading-tight line-clamp-1">{displayTitle}</h4>
                      {displaySubtitle && (
                        <p className="text-[10px] text-[#69493C] mt-0.5 line-clamp-1 font-medium">{displaySubtitle}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Timestamp & Timing Controls */}
            <div className="classy-card p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-[#2F2F2F]">
                  <Clock className="w-3.5 h-3.5 text-[#6B1E2B]" />
                  <span>{isEn ? 'Timestamp:' : 'توقيت التسجيل (Timestamp):'}</span>
                </div>

                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsCustomTimestamp(false)}
                    className={`px-2.5 py-1 rounded-xl font-black transition-all cursor-pointer text-[11px] ${
                      !isCustomTimestamp
                        ? 'bg-[#6B1E2B] text-[#FAF7F2] shadow-xs'
                        : 'bg-[#F8F2EA] text-[#69493C] hover:bg-[#EADBC7]'
                    }`}
                  >
                    {isEn ? 'Now (Auto)' : 'الآن (تلقائي)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomTimestamp(true)}
                    className={`px-2.5 py-1 rounded-xl font-black transition-all cursor-pointer text-[11px] ${
                      isCustomTimestamp
                        ? 'bg-[#6B1E2B] text-[#FAF7F2] shadow-xs'
                        : 'bg-[#F8F2EA] text-[#69493C] hover:bg-[#EADBC7]'
                    }`}
                  >
                    {isEn ? 'Custom Date/Time' : 'تحديد وقت سابق'}
                  </button>
                </div>
              </div>

              {isCustomTimestamp ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-[#69493C] mb-1 block">{isEn ? 'Date:' : 'التاريخ:'}</label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="classy-input font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#69493C] mb-1 block">{isEn ? 'Time:' : 'الوقت:'}</label>
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="classy-input font-bold"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-[#F8F2EA] border border-[#EADBC7] rounded-xl flex items-center justify-between text-[11px] text-[#69493C]">
                  <span>{isEn ? 'Evaluation will be recorded at current time.' : 'سيتم حفظ التقييم بتوقيت اللحظة الحالية بدقة.'}</span>
                  <span className="font-black text-[#2F2F2F]">
                    {new Date().toLocaleTimeString(isEn ? 'en-US' : 'ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                </div>
              )}
            </div>

            {/* Optional Group Association & Points Setting */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Group selection */}
              {studentGroups.length > 0 && (
                <div className="classy-card p-3 space-y-1.5">
                  <label className="text-xs font-black text-[#2F2F2F] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#6B1E2B]" />
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

              {/* Points Adjustment */}
              <div className="classy-card p-3 space-y-1.5">
                <label className="text-xs font-black text-[#2F2F2F] flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#6B1E2B]" />
                  <span>{isEn ? 'Points Impact:' : 'النقاط / التأثير:'}</span>
                </label>
                <div className="flex items-center gap-1">
                  {[-10, -5, 0, 5, 10, 15].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPoints(val)}
                      className={`flex-1 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        points === val
                          ? 'bg-[#6B1E2B] text-[#FAF7F2] shadow-xs ring-1 ring-[#6B1E2B]'
                          : 'bg-[#F8F2EA] text-[#69493C] border border-[#EADBC7] hover:bg-[#EADBC7]'
                      }`}
                    >
                      {val > 0 ? `+${val}` : val}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Note & Comments */}
            <div className="classy-card p-3 space-y-1.5">
              <label className="text-xs font-black text-[#2F2F2F] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#6B1E2B]" />
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

          {/* Footer Actions */}
          <div className="p-4 bg-[#FAF7F2] border-t border-[#EADBC7] flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isSavedSuccess}
              className="flex-1 py-3 rounded-2xl border border-[#EADBC7] bg-[#FAF7F2] text-[#69493C] font-black text-xs hover:bg-[#F8F2EA] transition-all disabled:opacity-50 cursor-pointer"
            >
              {t('cancel')}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isSavedSuccess || (isCustomMode && !customTagName.trim())}
              className={`flex-1 py-3 rounded-2xl text-[#FAF7F2] font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isSavedSuccess
                  ? 'bg-[#5C4033] ring-2 ring-[#B68A4C]/50'
                  : 'bg-gradient-to-r from-[#6B1E2B] via-[#5C4033] to-[#69493C] shadow-[#6B1E2B]/30 hover:brightness-105 active:scale-95'
              }`}
            >
              {isSavedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEn ? 'Rating Saved Successfully!' : 'تم حفظ التقييم بنجاح!'}</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-[#B68A4C]" />
                  <span>{isEn ? 'Save Behavior Rating' : 'حفظ تقييم السلوك'}</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
};
