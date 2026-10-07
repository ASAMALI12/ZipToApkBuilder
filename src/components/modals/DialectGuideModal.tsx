import React from 'react';
import { X, Mic, Zap, Shield, Sparkles, Terminal, Volume2, Globe } from 'lucide-react';

interface DialectGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUtterance?: (utterance: string) => void;
}

export const DialectGuideModal: React.FC<DialectGuideModalProps> = ({
  isOpen,
  onClose,
  onSelectUtterance,
}) => {
  if (!isOpen) return null;

  const intents = [
    {
      intent: 'INTENT_BUILD_APP',
      title: 'بناء التطبيقات (App Builder Canvas)',
      examples: [
        'أريد بناء تطبيق',
        'تعال نبني برنامج',
        'دعنا نبني تطبيق',
        'سويلي واجهة رياكت',
        'Build a todo app',
      ],
      action: 'Opens interactive code sandbox & live canvas',
    },
    {
      intent: 'INTENT_GENERATE_IMAGE',
      title: 'توليد الصور والوسائط (Media Studio)',
      examples: [
        'أريد صناعة صورة',
        'ارسم لي شاشة سايبربانك',
        'سوي تصاميم للواجهة',
        'سويلي لوجو حديث',
        'Generate holographic core image',
      ],
      action: 'Opens Gemini-powered media generation studio',
    },
    {
      intent: 'INTENT_GENERATE_VIDEO',
      title: 'توليد الفيديو (Video Studio)',
      examples: [
        'أريد صناعة مقطع فيديو',
        'اصنع فيديو سينمائي',
        'سوي فيديو لشاشة الكود',
        'Generate futuristic clip',
      ],
      action: 'Routes to AI video studio pipeline',
    },
    {
      intent: 'INTENT_TEACH_KERNEL',
      title: 'تعليم النواة وفحص الكود (Kernel Code Chat)',
      examples: [
        'افتح لتعليم النواة',
        'انسبق الكود المعماري',
        'افتح الدردشة',
        'خاف نسينا شي بالملف',
        'Inspect this codebase',
      ],
      action: 'Opens dialectal chat & AST auto-linter',
    },
    {
      intent: 'INTENT_IMPORT_EXPORT',
      title: 'استيراد/تصدير الحزم (ZIP Engine)',
      examples: [
        'افتح لتصدير/استيراد النواة',
        'ارفع ملف الـ zip',
        'استورد حزمة المشروع',
        'Export kernel archive',
      ],
      action: 'Triggers native file picker & in-memory zip unpack',
    },
    {
      intent: 'INTENT_CLOSE_MIC',
      title: 'إغلاق الميكروفون الفوري (Safe Stop)',
      examples: [
        'إغلاق الميكروفون',
        'اسكت',
        'اغلق المايك',
        'انكتم',
        'Close mic',
      ],
      action: '30ms exponential gain ramp-out & track termination',
    },
    {
      intent: 'INTENT_UNKNOWN_DYNAMIC',
      title: 'واجهات صفرية مخصصة (Zero-Shot Generative UI)',
      examples: [
        'افتح شاشة لإدارة قواعد البيانات',
        'ابني برنامج وندوز مع C#',
        'سوي لوحة تحكم سيرفرات كلاود',
        'Create Kubernetes telemetry mesh',
      ],
      action: 'Generates dynamic JSON UI and mounts interactive widgets',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Globe className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-arabic">
                دليل الأوامر واللهجات والنواة الصوتية
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Dialectal Intent Registry &amp; Full-Duplex Specifications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audio Engine Architecture Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 font-bold mb-1">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Full-Duplex Barge-In</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              يقاطع صوت الذكاء فوراً عند كلام المستخدم في أقل من 150ms، مع خفض تدريجي 20ms لتفريغ الصوت.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold mb-1">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Anti-Pop Gain Ramping</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              تدرج أسي (Exponential 30ms) لمنع طقطقة الميكروفون الميكانيكية عند الفتح أو الإغلاق.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-mono text-purple-400 font-bold mb-1">
              <Volume2 className="w-4 h-4 text-purple-400" />
              <span>Hardware DSP Filters</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              إلغاء صدى AEC مدمج، كتم الضوضاء Spectral NS، وتحكم تلقائي بالمكاسب AGC بمعدل 24kHz.
            </p>
          </div>
        </div>

        {/* Intent Registry List */}
        <div className="space-y-3">
          <span className="text-xs font-mono text-slate-400 block font-bold">
            Standard Predefined Intent Registry (النوايا المدعومة):
          </span>

          {intents.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800/90 hover:border-cyan-500/30 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-cyan-300 font-arabic">
                  {item.title}
                </span>
                <span className="text-[10px] font-mono text-slate-500 px-2 py-0.5 bg-slate-900 rounded">
                  {item.intent}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {item.examples.map((ex, exIdx) => (
                  <button
                    key={exIdx}
                    onClick={() => {
                      if (onSelectUtterance) {
                        onSelectUtterance(ex);
                        onClose();
                      }
                    }}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/40 text-xs text-slate-300 hover:text-cyan-200 rounded-lg transition-colors cursor-pointer font-arabic"
                  >
                    "{ex}"
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-slate-500 font-mono">{item.action}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs rounded-xl transition-colors cursor-pointer"
          >
            إغلاق الدليل
          </button>
        </div>
      </div>
    </div>
  );
};
