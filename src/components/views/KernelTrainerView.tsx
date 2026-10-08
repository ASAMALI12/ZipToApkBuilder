import React, { useState, useEffect } from 'react';
import { BoundKernel } from '../../types/kernel';
import { StorageEngine } from '../../services/storageEngine';
import {
  GraduationCap,
  Save,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  BookOpen,
  Trash2,
} from 'lucide-react';

interface KernelTrainerViewProps {
  boundKernel: BoundKernel | null;
  onUpdateBoundKernel: (kernel: BoundKernel) => void;
  onBackToHome: () => void;
}

export const KernelTrainerView: React.FC<KernelTrainerViewProps> = ({
  boundKernel,
  onUpdateBoundKernel,
  onBackToHome,
}) => {
  const [knowledgeText, setKnowledgeText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const existing = StorageEngine.loadLearnedKnowledge();
    if (existing) {
      setKnowledgeText(existing);
    } else if (boundKernel?.rules && boundKernel.rules.length > 0) {
      setKnowledgeText(boundKernel.rules.join('\n'));
    }
  }, [boundKernel]);

  const handleSaveKnowledge = async () => {
    if (!knowledgeText.trim()) return;
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      await StorageEngine.saveLearnedKnowledge(knowledgeText.trim());

      const lines = knowledgeText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const updatedKernel: BoundKernel = {
        name: boundKernel?.name || 'النواة الذاتية',
        fileName: boundKernel?.fileName || 'learned_kernel.json',
        fileSize: boundKernel?.fileSize || knowledgeText.length,
        bindTimestamp: new Date().toISOString(),
        version: boundKernel?.version || '3.5.0-learned',
        rules: lines.slice(0, 15),
        instructions: lines,
        rawContent: knowledgeText,
        isActive: true,
      };

      onUpdateBoundKernel(updatedKernel);

      // Immediately sync with server session memory
      try {
        await fetch('/api/kernel/session-init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summaryContext: knowledgeText.trim(),
            rules: lines.slice(0, 20),
            instructions: lines,
            kernelName: updatedKernel.name,
          }),
        });
      } catch {}

      setSavedSuccess(true);
    } catch (err) {
      console.warn('[KernelTrainer] Save notice:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setKnowledgeText('');
    setSavedSuccess(false);
    await StorageEngine.saveLearnedKnowledge('');
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 pb-20 bg-slate-950 text-slate-100 min-h-[85vh] font-arabic max-w-3xl mx-auto w-full select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800 shadow-sm"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للدردشة والمكالمة</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
          <GraduationCap className="w-4 h-4 text-cyan-400" />
          <span className="font-bold">تعليم وتدريب عقل النواة</span>
        </div>
      </div>

      {/* Main Training Card */}
      <div className="flex-1 flex flex-col bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>مربع لصق التعليم والمعرفة للنواة:</span>
          </label>
          {knowledgeText && (
            <button
              onClick={handleClear}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
              title="مسح النص"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح</span>
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          الصق هنا أي تعليمات أو معلومات أو قواعد تريد للنواة أن تفهمها وتحفظها. بعد الحفظ، ارجع للدردشة واسألها لتتأكد أنها تعلمت!
        </p>

        {/* Big Paste Area */}
        <textarea
          value={knowledgeText}
          onChange={(e) => {
            setKnowledgeText(e.target.value);
            setSavedSuccess(false);
          }}
          rows={10}
          placeholder="الصق هنا التعليمات والمعلومات التي تريد للنواة أن تتعلمها...
مثال:
- اسم مشروعي هو النواة الذكية المستقلة.
- تفضيل الرد باللغة العربية البسيطة والمباشرة.
- أي معلومة خاصة بك تود أن تجيبك عنها النواة بدقة."
          className="w-full flex-1 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 resize-none leading-relaxed font-sans shadow-inner"
        />

        {/* Save Button */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSaveKnowledge}
            disabled={isSaving || !knowledgeText.trim()}
            className="flex-1 py-3.5 bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-2xl shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'جاري الحفظ في عقل النواة...' : 'حفظ في ذاكرة النواة'}</span>
          </button>
        </div>

        {/* Success Banner & Direct Return to Chat */}
        {savedSuccess && (
          <div className="p-4 bg-emerald-950/50 border border-emerald-500/40 rounded-2xl text-xs space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-emerald-300 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>تم حفظ التعليم بنجاح في عقل النواة!</span>
            </div>
            <p className="text-[11px] text-emerald-200/80 leading-relaxed">
              استوعبت النواة المعلومات وحفظتها في الذاكرة الحية. يمكنك الآن العودة فوراً للدردشة وسؤالها للتأكد مما تعلمته.
            </p>
            <button
              onClick={onBackToHome}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>العودة للدردشة الآن وسؤال النواة للاختبار</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
