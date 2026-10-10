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

  const [activeTab, setActiveTab] = useState<'knowledge' | 'libraries'>('knowledge');
  const [attachedLibs, setAttachedLibs] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('kernel_attached_libraries');
      return saved ? JSON.parse(saved) : { threejs: true, arabLex: true };
    } catch {
      return { threejs: true, arabLex: true };
    }
  });

  const availableLibraries = [
    {
      id: 'threejs',
      name: 'Three.js 3D Engine',
      category: 'رسوم ثلاثية الأبعاد',
      desc: 'مكتبة بناء ونمذجة الأشكال والرسومات ثلاثية الأبعاد (3D WebGL).',
      rule: 'تمتلك النواة مكتبة Three.js لدعم بناء ونمذجة المجسمات ثلاثية الأبعاد.',
    },
    {
      id: 'vision',
      name: 'Vision & Image Filters DSP',
      category: 'معالجة الصور',
      desc: 'مكتبة معالجة الفلاتر البصرية، التعرف على الأنماط، ومصفوفات البكسل.',
      rule: 'تمتلك النواة مكتبة فلاتر الرؤية البصرية ومعالجة الصور المتقدمة.',
    },
    {
      id: 'math',
      name: 'Symbolic Math & Physics Kernel',
      category: 'معادلات وفيزياء',
      desc: 'مكتبة حل المعادلات التفاضلية والمحاكاة الفيزيائية الرمزية.',
      rule: 'تمتلك النواة مكتبة المحاكاة والفيزياء الرمزية وحل المعادلات الرياضية.',
    },
    {
      id: 'arabLex',
      name: 'Arabic Dialect Neural Lexicon',
      category: 'معالجة اللغة الطبيعية',
      desc: 'المعجم العصبي الموسع للهجات العربية الفصحى والعامية.',
      rule: 'النواة مجهزة بمعجم عصبي موسع لفهم كافة اللهجات العربية الفصحى والعامية بدقة متناهية.',
    },
  ];

  const toggleLibrary = (libId: string, libRule: string) => {
    const updated = { ...attachedLibs, [libId]: !attachedLibs[libId] };
    setAttachedLibs(updated);
    try {
      localStorage.setItem('kernel_attached_libraries', JSON.stringify(updated));
    } catch {}

    // Automatically append or remove rule from knowledge
    let newKnowledge = knowledgeText;
    if (updated[libId]) {
      if (!newKnowledge.includes(libRule)) {
        newKnowledge = (newKnowledge ? newKnowledge + '\n' : '') + libRule;
      }
    } else {
      newKnowledge = newKnowledge.replace(libRule, '').replace(/\n\s*\n/g, '\n').trim();
    }
    setKnowledgeText(newKnowledge);
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
          <span className="font-bold">تعليم وتدريب عقل النواة وإرفاق المكتبات</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 mb-4 bg-slate-900/80 p-1 rounded-2xl border border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('knowledge')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'knowledge' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          تعليم وقواعد النواة (Knowledge Rules)
        </button>
        <button
          onClick={() => setActiveTab('libraries')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'libraries' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>المكتبات الملحقة بالنواة (Attached Libraries)</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950 text-cyan-300 font-mono">
            {Object.values(attachedLibs).filter(Boolean).length}
          </span>
        </button>
      </div>

      {activeTab === 'libraries' ? (
        /* Attached Libraries Tab */
        <div className="flex-1 flex flex-col bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span>إرفاق المكتبات والأدوات لعقل النواة</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              عندما تعجز النواة عن تنفيذ أمر بسبب نقص حزمة برمجية، يمكنك تفعيل وإرفاق المكتبة المناسبة هنا لتمكين النواة من دعمها فوراً.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {availableLibraries.map((lib) => {
              const isAttached = Boolean(attachedLibs[lib.id]);
              return (
                <div
                  key={lib.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isAttached
                      ? 'bg-cyan-950/40 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-950/70 border-slate-800/80 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white font-mono">{lib.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300">
                      {lib.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    {lib.desc}
                  </p>
                  <button
                    onClick={() => toggleLibrary(lib.id, lib.rule)}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isAttached
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {isAttached ? '✓ المكتبة مرفقة بالنواة' : '+ إرفاق المكتبة للنواة'}
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleSaveKnowledge}
            disabled={isSaving}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-slate-950 font-bold text-xs rounded-2xl shadow-xl transition-all cursor-pointer mt-4"
          >
            تثبيت المكتبات المرفقة في عقل النواة
          </button>
        </div>
      ) : (
        /* Main Training Knowledge Card */
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
      )}
    </div>
  );
};
