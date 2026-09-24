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
      // Default tag: 'مشاركة وتفاعل ممتاز' (Excellent participation)
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
        className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir="rtl"
      >
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-t-3xl sm:rounded-[28px] max-w-xl w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl relative">
          
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-slate-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 shadow-2xs">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-[#0F172A] flex items-center gap-1.5">
                  <span>تسجيل سلوك وتفاعل سريع</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    Quick Log
                  </span>
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold text-slate-700">{student.name}</span>
                  {student.gradeLevel && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-[11px] text-slate-500 font-medium">{student.gradeLevel}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:text-[#0F172A] hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4">
            
            {/* Student Pill Bar */}
            <div className="p-2.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <StudentAvatar
                  student={student}
                  size="sm"
                  showAchievementFrame={true}
                  className="shrink-0"
                />
                <div>
                  <h4 className="text-xs font-black text-[#0F172A] leading-tight">{student.name}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">رصد فوري لتقييم الحصة والسلوك</p>
                </div>
              </div>

              {/* Quick Points Display Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px] font-black text-slate-700">
                  {points > 0 ? `+${points}` : points} نقطة
                </span>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700">اختر نوع التقييم / الوسم:</label>
                <button
                  type="button"
                  onClick={handleEnableCustomTag}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                    isCustomMode
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>وسم مخصص</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 android-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeCategory === 'all'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('positive')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                    activeCategory === 'positive'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  <span>🌟</span>
                  <span>تميز وتفاعل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('needs_improvement')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                    activeCategory === 'needs_improvement'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  <span>⚠️</span>
                  <span>يحتاج تحسين</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('neutral')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                    activeCategory === 'neutral'
                      ? 'bg-slate-700 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>📝</span>
                  <span>ملاحظات عامة</span>
                </button>
              </div>
            </div>

            {/* Custom Mode Tag Input */}
            {isCustomMode && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    كتابة وسم مخصص
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCategory('positive')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
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
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                        category === 'needs_improvement'
                          ? 'bg-rose-600 text-white'
                          : 'bg-white text-rose-700 border border-rose-200'
                      }`}
                    >
                      يحتاج تحسين
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory('neutral')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                        category === 'neutral'
                          ? 'bg-slate-700 text-white'
                          : 'bg-white text-slate-700 border border-slate-200'
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
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-indigo-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
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
                    className={`p-2.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-1.5 cursor-pointer text-xs ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/90 ring-2 ring-indigo-500/40 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="text-base leading-none">{tag.emoji}</span>
                      {isSelected ? (
                        <span className="p-0.5 rounded-full bg-indigo-600 text-white">
                          <Check className="w-3 h-3" />
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                            (tag.points ?? 0) > 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : (tag.points ?? 0) < 0
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {(tag.points ?? 0) > 0 ? `+${tag.points}` : tag.points}
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-[11px] leading-tight line-clamp-1">{tag.name}</h4>
                      {tag.nameEn && (
                        <p className="text-[9px] text-slate-600 mt-0.5 line-clamp-1">{tag.nameEn}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Timestamp & Timing Controls */}
            <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>توقيت التسجيل (Timestamp):</span>
                </div>

                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsCustomTimestamp(false)}
                    className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                      !isCustomTimestamp
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    الآن (تلقائي)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomTimestamp(true)}
                    className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                      isCustomTimestamp
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    تحديد وقت سابق
                  </button>
                </div>
              </div>

              {isCustomTimestamp ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">التاريخ:</label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">الوقت:</label>
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-[11px] text-slate-600">
                  <span>سيتم حفظ التقييم بتوقيت اللحظة الحالية بدقة.</span>
                  <span className="font-bold text-indigo-700">
                    {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                </div>
              )}
            </div>

            {/* Optional Group Association & Points Setting */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Group selection */}
              {studentGroups.length > 0 && (
                <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-1.5">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>المجموعة / الحصة المرتبطة:</span>
                  </label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 cursor-pointer"
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
              <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-1.5">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>النقاط / التأثير:</span>
                </label>
                <div className="flex items-center gap-1.5">
                  {[-10, -5, 0, 5, 10, 15].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPoints(val)}
                      className={`flex-1 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        points === val
                          ? 'bg-indigo-600 text-white shadow-2xs ring-1 ring-indigo-500'
                          : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {val > 0 ? `+${val}` : val}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Note & Comments */}
            <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-1.5">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>ملاحظة أو تفاصيل إضافية (اختياري):</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="أضف أي تفاصيل سريعة تخص هذا التقييم، تفاعل الطالب، أو سبب التنبيه..."
                rows={2}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 resize-none font-medium"
              />
            </div>

          </form>

          {/* Footer Actions */}
          <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isSavedSuccess}
              className="flex-1 py-3 rounded-2xl border border-slate-200 bg-white text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-50 cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isSavedSuccess || (isCustomMode && !customTagName.trim())}
              className={`flex-1 py-3 rounded-2xl text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isSavedSuccess
                  ? 'bg-emerald-700 scale-[0.99] ring-2 ring-emerald-500/50'
                  : 'btn-primary'
              }`}
            >
              {isSavedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 animate-bounce" />
                  <span>تم حفظ التقييم بنجاح!</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
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
