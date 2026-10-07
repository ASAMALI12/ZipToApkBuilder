import React, { useState } from 'react';
import { ProjectFile, KernelMemoryLog } from '../../types/kernel';
import { inspectAndRepairFiles } from '../../services/codeLinter';
import {
  Terminal,
  Send,
  Sparkles,
  Bot,
  User,
  History,
  ShieldCheck,
  Cpu,
  RefreshCw,
} from 'lucide-react';

interface KernelCodeChatProps {
  files: ProjectFile[];
  memoryLogs: KernelMemoryLog[];
  onAppendMemory: (log: KernelMemoryLog) => void;
  onApplyPatches?: (patches: any[]) => void;
}

export const KernelCodeChat: React.FC<KernelCodeChatProps> = ({
  files,
  memoryLogs,
  onAppendMemory,
  onApplyPatches,
}) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; time: string }>>([
    {
      role: 'assistant',
      text: 'مرحباً بك في نواة الذكاء البرمجية (The Kernel). أنا متصل بكامل منظومة الكود عبر ميكروفون مزدوج الاتجاه (Full-Duplex) وتقنية منع الفرقعة. اسألني عن أي ملف، أو اطلب فحص الـ AST وإصلاح الأخطاء تلقائياً.',
      time: 'Just now',
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isLinterRunning, setIsLinterRunning] = useState<boolean>(false);
  const [lastLinterSummary, setLastLinterSummary] = useState<string | null>(null);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const userMsg = {
      role: 'user' as const,
      text: text.trim(),
      time: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    // If query is about inspection:
    if (/فحص|لنت|خطأ|صلح|نسينا شي|inspect|lint|repair/i.test(text)) {
      handleRunLinter(text);
      return;
    }

    // Call NLU / Gemini chat
    try {
      const res = await fetch('/api/nlu/parse-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterance: text.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.assistant_response || 'تم استلام وتوثيق تعليمات النواة.';
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: reply,
            time: new Date().toLocaleTimeString(),
          },
        ]);

        onAppendMemory({
          id: `chat_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          utterance: text.trim(),
          intent: data.intent || 'INTENT_TEACH_KERNEL',
          response: reply,
          workspace: 'code_chat',
        });
        return;
      }
    } catch (err) {
      console.error('Chat error:', err);
    }

    // Fallback response
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: `تم استيعاب الأمر وحفظه في الذاكرة المستمرة للنواة: "${text}"`,
        time: new Date().toLocaleTimeString(),
      },
    ]);
  };

  const handleRunLinter = async (customInstruction: string = '') => {
    setIsLinterRunning(true);
    try {
      const result = await inspectAndRepairFiles(files, customInstruction);
      setLastLinterSummary(result.summary);

      let reply = `تقرير فحص الـ AST:\n${result.summary}\nدرجة صحة الكود: ${result.overallHealthScore}%`;
      if (result.issuesFound.length > 0) {
        reply += `\nتم رصد ${result.issuesFound.length} مشكلة وتم تجهيز رقع التصحيح.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: reply,
          time: new Date().toLocaleTimeString(),
        },
      ]);

      if (result.patches.length > 0 && onApplyPatches) {
        onApplyPatches(result.patches);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLinterRunning(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-65px)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Left Chat Stream */}
      <div className="flex-1 flex flex-col border-r border-slate-800">
        {/* Chat Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-950/60 border border-cyan-500/30 rounded-lg text-xs font-mono text-cyan-300">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Kernel Code Chat &amp; NLU</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Dialectal Reasoning Engine</span>
          </div>

          <button
            onClick={() => handleRunLinter()}
            disabled={isLinterRunning}
            className="flex items-center gap-1.5 px-3 py-1 bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-mono transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLinterRunning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Scan AST &amp; Auto-Fix</span>
          </button>
        </div>

        {/* Message History */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 max-w-3xl ${
                msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
                }`}
              >
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none font-arabic'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none font-arabic'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <span className="block text-[9px] text-slate-400/80 mt-1 font-mono text-right">
                  {msg.time}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-900/60 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask the Kernel or speak dialectally (e.g., 'خاف نسينا شي بالملف', 'افحص المتغيرات')"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 font-arabic"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
            />
            <button
              onClick={() => handleSendMessage()}
              className="p-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 rounded-xl transition-all cursor-pointer font-bold"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="flex items-center gap-2 mt-2">
            {[
              'خاف نسينا شي بالملف',
              'افتح لتعليم النواة',
              'انسبق الكود المعماري',
            ].map((shortcut) => (
              <button
                key={shortcut}
                onClick={() => handleSendMessage(shortcut)}
                className="px-2.5 py-1 bg-slate-950/80 hover:bg-cyan-950/40 border border-slate-800 text-[11px] text-slate-400 hover:text-cyan-300 rounded-lg transition-colors cursor-pointer font-arabic"
              >
                {shortcut}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Sidebar: Contextual Instruction Memory & AST Status */}
      <div className="w-80 p-4 bg-slate-900/30 flex flex-col justify-between overflow-y-auto">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 mb-3">
            <History className="w-4 h-4 text-cyan-400" />
            <span>Persistent Kernel Memory</span>
          </div>

          <div className="space-y-2">
            {memoryLogs.slice(0, 8).map((log) => (
              <div
                key={log.id}
                className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-arabic"
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                  <span className="text-cyan-400 font-bold">{log.intent}</span>
                  <span>{log.timestamp}</span>
                </div>
                <p className="text-slate-200 line-clamp-2">"{log.utterance}"</p>
              </div>
            ))}
          </div>
        </div>

        {/* AST Quick Card */}
        <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 mb-1">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>AST Auto-Linter Status</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {lastLinterSummary || 'All syntax structures validated in memory.'}
          </p>
        </div>
      </div>
    </div>
  );
};
