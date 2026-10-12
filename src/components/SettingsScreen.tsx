import React, { useState } from "react";
import { AppIcon } from "./ui/AppIcon";
import { BottomSheet } from "./ui/BottomSheet";
import { db, findDuplicateSessions, DuplicateGroup } from "../utils/storage";

interface SettingsScreenProps {
  onRefresh: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onRefresh }) => {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [cleanupSummary, setCleanupSummary] = useState<{ removed: number; kept: number } | null>(null);

  const handleScan = () => {
    setIsScanning(true);
    setCleanupSummary(null);
    try {
      const results = findDuplicateSessions();
      setDuplicateGroups(results);
      setIsModalOpen(true);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSessionRemoval = (groupIndex: number, sessionIndex: number) => {
    setDuplicateGroups(prev => {
      const cloned = [...prev];
      const targetGroup = { ...cloned[groupIndex] };
      const targetSessions = [...targetGroup.sessions];
      targetSessions[sessionIndex] = {
        ...targetSessions[sessionIndex],
        selectedForRemoval: !targetSessions[sessionIndex].selectedForRemoval,
      };
      targetGroup.sessions = targetSessions;
      cloned[groupIndex] = targetGroup;
      return cloned;
    });
  };

  const totalSelectedForRemoval = duplicateGroups.reduce((acc, g) => {
    return acc + g.sessions.filter(s => s.selectedForRemoval).length;
  }, 0);

  const handleDownloadBackup = () => {
    const toRemoveSessions: any[] = [];
    const toRemoveAttendance: any[] = [];
    const allAtt = db.getAttendance();

    duplicateGroups.forEach(g => {
      g.sessions.forEach(s => {
        if (s.selectedForRemoval) {
          toRemoveSessions.push(s.session);
          const att = allAtt.filter(a => a.sessionId === s.session.id);
          toRemoveAttendance.push(...att);
        }
      });
    });

    const backupData = {
      timestamp: new Date().toISOString(),
      removedCount: toRemoveSessions.length,
      sessions: toRemoveSessions,
      attendance: toRemoveAttendance,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_duplicate_sessions_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApplyCleanup = () => {
    let removedCount = 0;
    let keptCount = 0;

    duplicateGroups.forEach(g => {
      g.sessions.forEach(s => {
        if (s.selectedForRemoval) {
          db.deleteSession(s.session.id);
          removedCount++;
        } else {
          keptCount++;
        }
      });
    });

    setCleanupSummary({ removed: removedCount, kept: keptCount });
    setIsModalOpen(false);
    onRefresh();
  };

  return (
    <div className="space-y-6 text-right p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <h1 className="text-xl font-black text-[#0F2A4A]">الإعدادات وإدارة البيانات</h1>
        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
          <AppIcon name="settings" size={20} />
        </div>
      </div>

      {/* Data Health Section */}
      <div className="classy-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <AppIcon name="shield" size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">صحة البيانات (Data Health)</h2>
            <p className="text-xs text-slate-500">فحص وتطهير التكرارات وضمان دقة مواعيد الحصص</p>
          </div>
        </div>

        {cleanupSummary && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center justify-between">
            <span>تم بنجاح: تم حذف {cleanupSummary.removed} نسخة مكررة، والاحتفاظ بـ {cleanupSummary.kept} حصة أساسية.</span>
            <AppIcon name="checkCircle" size={16} />
          </div>
        )}

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800">أداة فحص المواعيد المكررة</h3>
              <p className="text-[11px] text-slate-500">
                تقوم بفحص الجداول والبحث عن الحصص المكررة لنفس الطالب والتاريخ والوقت، واقتراح حذف النسخ الفارغة بأمان.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleScan}
            disabled={isScanning}
            className="w-full py-3 bg-[#0F2A4A] text-white font-bold rounded-xl text-xs hover:bg-[#17375E] transition-all flex items-center justify-center gap-2 shadow-xs"
          >
            <AppIcon name="refresh" size={16} />
            <span>فحص المواعيد المكررة (Find duplicate appointments)</span>
          </button>
        </div>
      </div>

      {/* Duplicate modal */}
      <BottomSheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="نتائج فحص المواعيد المكررة"
        size="full"
      >
        <div className="space-y-4 text-right">
          {duplicateGroups.length === 0 ? (
            <div className="p-8 text-center space-y-2 text-slate-500">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <AppIcon name="checkCircle" size={24} />
              </div>
              <p className="text-sm font-bold text-slate-800">سجل المواعيد نظيف تماماً!</p>
              <p className="text-xs text-slate-500">لم يتم العثور على أي مواعيد أو حصص مكررة في نفس الفترة الزمنية.</p>
            </div>
          ) : (
            <>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                تم العثور على <strong>{duplicateGroups.length}</strong> مجموعة تحتوي على تكرارات. تم تحديد النسخ الفارغة التي لا تحتوي على حضور للحذف تلقائياً. الحصص المسجل بها حضور تم استثناؤها وتحذيرك بشأنها.
              </div>

              <div className="space-y-4 max-h-[55vh] overflow-y-auto">
                {duplicateGroups.map((group, gIdx) => (
                  <div key={group.slotKey} className="classy-card p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <div>
                        <span className="font-bold text-sm text-[#0F2A4A] block">{group.studentName}</span>
                        <span className="text-[11px] text-slate-500">{group.groupName} • {group.date} • {group.startTime}</span>
                      </div>
                      <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold border border-rose-100">
                        {group.sessions.length} نسخ
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.sessions.map((item, sIdx) => (
                        <div
                          key={item.session.id}
                          className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                            item.selectedForRemoval 
                              ? "bg-rose-50/60 border-rose-200" 
                              : "bg-slate-50 border-slate-100"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">
                                {sIdx === 0 ? "النسخة الأساسية (Kept)" : `نسخة مكررة (${sIdx + 1})`}
                              </span>
                              {item.hasAttendance ? (
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                                  <AppIcon name="alert" size={12} />
                                  <span>يوجد حضور مسجل!</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px]">
                                  بدون حضور
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              معرف الحصة: {item.session.id.slice(0, 18)}... | وحدات: {item.sessionUnits} | مدة: {item.hours} ساعة
                            </div>
                          </div>

                          <label className="flex items-center gap-2 cursor-pointer font-bold">
                            <span className="text-[11px] text-slate-600">
                              {item.selectedForRemoval ? "محددة للحذف" : "إبقاء"}
                            </span>
                            <input
                              type="checkbox"
                              checked={item.selectedForRemoval}
                              onChange={() => toggleSessionRemoval(gIdx, sIdx)}
                              className="w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-rose-500"
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="w-full py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  <AppIcon name="download" size={16} />
                  <span>تحميل نسخة احتياطية (Download backup JSON)</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyCleanup}
                  disabled={totalSelectedForRemoval === 0}
                  className="w-full py-3.5 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  <AppIcon name="trash" size={16} />
                  <span>حذف {totalSelectedForRemoval} نسخة مكررة (Remove {totalSelectedForRemoval} copies)</span>
                </button>
              </div>
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  );
};
