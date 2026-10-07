import React, { useState } from 'react';
import { BoundKernel } from '../../types/kernel';
import { StorageEngine } from '../../services/storageEngine';
import {
  GraduationCap,
  Mic,
  Send,
  ArrowRight,
  Shield,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  BookOpen,
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
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; time: string }>>([
    {
      role: 'assistant',
      text: boundKernel
        ? `أهلاً بك! النواة "${boundKernel.name}" جاهزة للتعليم والتدريب. تحدث بالمايكروفون أو اكتب قواعد وتوجيهات جديدة لتعليمها وتطبيقها فورياً.`
        : 'أهلاً بك! النواة جاهزة للتعليم. يمكنك إعطاؤها قواعد وتوجيهات عبر المايكروفون أو الدردشة وسيتم حفظها مباشرة في ذاكرة النواة.',
      time: 'الآن',
    },
  ]);

  const [trainedRules, setTrainedRules] = useState<string[]>(
    boundKernel?.rules || [
      'تفضيل لغة كوتلن وسويفت لتطبيقات الهاتف',
      'تفعيل منع الضوضاء وعزل الأصوات الخارجية',
      'الاستجابة السريعة باللغة العربية البسيطة',
    ]
  );

  const handleTeachRule = (ruleText: string) => {
    if (!ruleText.trim()) return;

    const userMsg = {
      role: 'user' as const,
      text: ruleText.trim(),
      time: new Date().toLocaleTimeString('ar-SA'),
    };

    const newRule = ruleText.trim();
    const updatedRules = [newRule, ...trainedRules];
    setTrainedRules(updatedRules);

    // Save to BoundKernel
    if (boundKernel) {
      const updatedKernel: BoundKernel = {
        ...boundKernel,
        rules: updatedRules,
      };
      onUpdateBoundKernel(updatedKernel);
      StorageEngine.saveBoundKernel(updatedKernel);
    }

    const aiMsg = {
      role: 'assistant' as const,
      text: `تم استيعاب وحفظ هذه القاعدة في ذاكرة النواة بنجاح: "${newRule}"`,
      time: new Date().toLocaleTimeString('ar-SA'),
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInputText('');
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-slate-950 text-slate-100 min-h-[85vh] font-arabic max-w-4xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للشاشة الرئيسية</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
          <GraduationCap className="w-4 h-4 text-cyan-400" />
          <span>تعليم وتدريب النواة</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
        {/* Left: Chat & Voice Training */}
        <div className="md:col-span-2 flex flex-col bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              جلسة تدريب النواة
            </span>
            <span className="text-slate-400 font-mono text-[11px]">صوت + دردشة</span>
          </div>

          {/* Conversation */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[460px]">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2.5 ${
                  m.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs ${
                    m.role === 'user' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-cyan-400'
                  }`}
                >
                  {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div
                  className={`p-3 rounded-2xl text-xs max-w-[80%] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-cyan-500 text-slate-950 rounded-tr-none font-medium'
                      : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none'
                  }`}
                >
                  <p>{m.text}</p>
                  <span className="block text-[9px] text-slate-400/80 mt-1 font-mono text-left">
                    {m.time}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="اكتب تعليمة أو قاعدة جديدة لتعليم النواة..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTeachRule(inputText);
              }}
            />
            <button
              onClick={() => handleTeachRule(inputText)}
              className="p-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Trained Rules List */}
        <div className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-3xl p-4 overflow-hidden">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 mb-3 pb-2 border-b border-slate-800">
            <BookOpen className="w-4 h-4" />
            <span>القواعد المحفوظة بالنواة ({trainedRules.length})</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {trainedRules.map((rule, i) => (
              <div
                key={i}
                className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{rule}</span>
              </div>
            ))}
          </div>

          {/* Quick Prompts to teach */}
          <div className="mt-3 pt-3 border-t border-slate-800">
            <span className="text-[10px] text-slate-400 block mb-1.5 font-mono">أمثلة لتعليمها:</span>
            <div className="space-y-1">
              {[
                'عند بناء تطبيق، أنشئ أزرار لمس كبيرة',
                'في الألعاب، اجعل التحكم باللمس والأسهم',
                'أجبني دائماً بأسلوب مهذب ومختصر',
              ].map((ex, i) => (
                <button
                  key={i}
                  onClick={() => handleTeachRule(ex)}
                  className="w-full text-right p-1.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-800 text-[11px] text-slate-400 hover:text-cyan-300 rounded-lg transition-colors cursor-pointer"
                >
                  + {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
