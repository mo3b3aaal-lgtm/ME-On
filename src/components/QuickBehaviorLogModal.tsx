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
  const { t, isRTL } = useTranslation();
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

    const tagName = isCustomMode ? customTagName.trim() : (selectedTag?.name || 'ملاحظة سلوكية');
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
        className="fixed inset-0 bg-[#17163D]/65 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#F6F7FC] border border-[#E8E7FF] rounded-t-[28px] sm:rounded-[28px] max-w-xl w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl relative">
          
          {/* Signature Classy Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] text-white flex items-center justify-between shrink-0 relative overflow-hidden">
            <div className="flex items-center gap-3 relative z-10 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Zap className="w-5 h-5 text-[#55C7E8]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2 truncate">
                  <span>تسجيل سلوك وتفاعل سريع</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/20">
                    Quick Log
                  </span>
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold text-[#E8E7FF]">{student.name}</span>
                  {student.gradeLevel && (
                    <>
                      <span className="text-[#E8E7FF]/50">•</span>
                      <span className="text-[11px] text-[#E8E7FF]/80 font-medium">{student.gradeLevel}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer relative z-10 active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto android-scrollbar p-4 sm:p-5 space-y-4 text-xs text-[#191A2E]">
            
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
                  <h4 className="text-xs font-black text-[#17163D] leading-tight truncate">{student.name}</h4>
                  <p className="text-[10px] text-[#74778F] mt-0.5">رصد فوري لتقييم الحصة والأداء</p>
                </div>
              </div>

              {/* Quick Points Display Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E8E7FF]/50 border border-[#D8D5FB] shrink-0">
                <Award className="w-3.5 h-3.5 text-[#7657F6]" />
                <span className="text-xs font-black text-[#17163D]">
                  {points > 0 ? `+${points}` : points} نقطة
                </span>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-[#17163D]">اختر نوع التقييم / الوسم:</label>
                <button
                  type="button"
                  onClick={handleEnableCustomTag}
                  className={`text-[11px] font-black px-2.5 py-1 rounded-xl border transition-all flex items-center gap-1 cursor-pointer ${
                    isCustomMode
                      ? 'bg-[#7657F6] text-white border-[#7657F6] shadow-xs'
                      : 'bg-white text-[#7657F6] border-[#D8D5FB] hover:bg-[#E8E7FF]/40'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>وسم مخصص</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                    activeCategory === 'all'
                      ? 'bg-[#17163D] text-white shadow-xs'
                      : 'bg-white text-[#74778F] border border-[#E8E7FF] hover:bg-[#F6F7FC]'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('positive')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === 'positive'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  <span>🌟</span>
                  <span>تميز وتفاعل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('needs_improvement')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === 'needs_improvement'
                      ? 'bg-[#FF647C] text-white shadow-xs'
                      : 'bg-white text-[#FF647C] border border-[#FECDD3] hover:bg-[#FFF1F3]'
                  }`}
                >
                  <span>⚠️</span>
                  <span>يحتاج تحسين</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('neutral')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === 'neutral'
                      ? 'bg-[#403B9C] text-white shadow-xs'
                      : 'bg-white text-[#403B9C] border border-[#E8E7FF] hover:bg-[#E8E7FF]/40'
                  }`}
                >
                  <span>📝</span>
                  <span>ملاحظات عامة</span>
                </button>
              </div>
            </div>

            {/* Custom Mode Tag Input */}
            {isCustomMode && (
              <div className="classy-card p-3.5 space-y-2.5 bg-[#E8E7FF]/30 border-[#D8D5FB] animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#17163D] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#7657F6]" />
                    كتابة وسم مخصص
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCategory('positive')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${
                        category === 'positive'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      إيجابي
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory('needs_improvement')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${
                        category === 'needs_improvement'
                          ? 'bg-[#FF647C] text-white'
                          : 'bg-white text-[#FF647C] border border-[#FECDD3]'
                      }`}
                    >
                      يحتاج تحسين
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory('neutral')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${
                        category === 'neutral'
                          ? 'bg-[#17163D] text-white'
                          : 'bg-white text-[#191A2E] border border-[#E8E7FF]'
                      }`}
                    >
                      عام
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={customTagName}
                  onChange={(e) => setCustomTagName(e.target.value)}
                  placeholder="مثال: تميز في حفظ جدول الضرب، حل مسألة صعبة..."
                  className="classy-input font-bold"
                  autoFocus
                />
              </div>
            )}

            {/* Predefined Tags Grid */}
            <div className="grid grid-cols-2 gap-2">
              {filteredTags.map((tag) => {
                const isSelected = !isCustomMode && selectedTag?.id === tag.id;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleSelectPredefinedTag(tag)}
                    className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer text-xs ${
                      isSelected
                        ? 'border-[#7657F6] bg-[#E8E7FF]/40 ring-2 ring-[#7657F6]/25 shadow-xs'
                        : 'border-[#E8E7FF] bg-white hover:border-[#D8D5FB] hover:bg-[#F6F7FC]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="text-lg leading-none">{tag.emoji}</span>
                      {isSelected ? (
                        <span className="p-1 rounded-full bg-[#7657F6] text-white">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                            (tag.points ?? 0) > 0
                              ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]'
                              : (tag.points ?? 0) < 0
                              ? 'bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]'
                              : 'bg-[#F6F7FC] text-[#74778F] border border-[#E8E7FF]'
                          }`}
                        >
                          {(tag.points ?? 0) > 0 ? `+${tag.points}` : tag.points}
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-[#17163D] text-xs leading-tight line-clamp-1">{tag.name}</h4>
                      {tag.nameEn && (
                        <p className="text-[10px] text-[#74778F] mt-0.5 line-clamp-1 font-medium">{tag.nameEn}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Timestamp & Timing Controls */}
            <div className="classy-card p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-[#17163D]">
                  <Clock className="w-3.5 h-3.5 text-[#7657F6]" />
                  <span>توقيت التسجيل (Timestamp):</span>
                </div>

                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsCustomTimestamp(false)}
                    className={`px-2.5 py-1 rounded-xl font-black transition-all cursor-pointer text-[11px] ${
                      !isCustomTimestamp
                        ? 'bg-[#17163D] text-white shadow-xs'
                        : 'bg-[#F6F7FC] text-[#74778F] hover:bg-[#E8E7FF]'
                    }`}
                  >
                    الآن (تلقائي)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomTimestamp(true)}
                    className={`px-2.5 py-1 rounded-xl font-black transition-all cursor-pointer text-[11px] ${
                      isCustomTimestamp
                        ? 'bg-[#17163D] text-white shadow-xs'
                        : 'bg-[#F6F7FC] text-[#74778F] hover:bg-[#E8E7FF]'
                    }`}
                  >
                    تحديد وقت سابق
                  </button>
                </div>
              </div>

              {isCustomTimestamp ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-[#74778F] mb-1 block">التاريخ:</label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="classy-input font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#74778F] mb-1 block">الوقت:</label>
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="classy-input font-bold"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl flex items-center justify-between text-[11px] text-[#74778F]">
                  <span>سيتم حفظ التقييم بتوقيت اللحظة الحالية بدقة.</span>
                  <span className="font-black text-[#17163D]">
                    {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                </div>
              )}
            </div>

            {/* Optional Group Association & Points Setting */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Group selection */}
              {studentGroups.length > 0 && (
                <div className="classy-card p-3 space-y-1.5">
                  <label className="text-xs font-black text-[#17163D] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#7657F6]" />
                    <span>المجموعة / الحصة المرتبطة:</span>
                  </label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="classy-select"
                  >
                    <option value="">عام (بدون مجموعة محددة)</option>
                    {studentGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.type === 'private' ? 'درس خاص' : 'مجموعة'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Points Adjustment */}
              <div className="classy-card p-3 space-y-1.5">
                <label className="text-xs font-black text-[#17163D] flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#7657F6]" />
                  <span>النقاط / التأثير:</span>
                </label>
                <div className="flex items-center gap-1">
                  {[-10, -5, 0, 5, 10, 15].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPoints(val)}
                      className={`flex-1 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        points === val
                          ? 'bg-[#7657F6] text-white shadow-xs ring-1 ring-[#7657F6]'
                          : 'bg-[#F6F7FC] text-[#74778F] border border-[#E8E7FF] hover:bg-[#E8E7FF]'
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
              <label className="text-xs font-black text-[#17163D] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#7657F6]" />
                <span>ملاحظة أو تفاصيل إضافية (اختياري):</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="أضف أي تفاصيل سريعة تخص هذا التقييم، تفاعل الطالب، أو سبب التنبيه..."
                rows={2}
                className="classy-textarea"
              />
            </div>

          </form>

          {/* Footer Actions */}
          <div className="p-4 bg-white border-t border-[#E8E7FF] flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isSavedSuccess}
              className="flex-1 py-3 rounded-2xl border border-[#E8E7FF] bg-white text-[#74778F] font-black text-xs hover:bg-[#F6F7FC] transition-all disabled:opacity-50 cursor-pointer"
            >
              {t('cancel')}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isSavedSuccess || (isCustomMode && !customTagName.trim())}
              className={`flex-1 py-3 rounded-2xl text-white font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isSavedSuccess
                  ? 'bg-emerald-600 ring-2 ring-emerald-500/50'
                  : 'bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] shadow-[#7657F6]/30 hover:brightness-105 active:scale-95'
              }`}
            >
              {isSavedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تم حفظ التقييم بنجاح!</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-[#55C7E8]" />
                  <span>حفظ تقييم السلوك</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
};
