import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../../services/audioEngine';
import { CallStatus, BoundKernel } from '../../types/kernel';
import {
  Mic,
  MicOff,
  Volume2,
  Zap,
  Sparkles,
  Cpu,
  AlertTriangle,
  Send,
  PhoneOff,
  Square,
  Sliders,
  ShieldCheck,
  HelpCircle,
  BookOpen,
  Wrench,
  X,
} from 'lucide-react';
import { KernelDiagnosticReport } from '../../types/kernel';

interface CentralCallOrbProps {
  onQuickIntent: (phrase: string) => void;
  currentTranscript?: string;
  isInterimTranscript?: boolean;
  boundKernel: BoundKernel | null;
  lastAssistantResponse?: string;
  activeActionNotice?: { name: string; workspace: string } | null;
  activeDiagnostic?: KernelDiagnosticReport | null;
  onClearDiagnostic?: () => void;
  onOpenWorkspace?: (workspace: string) => void;
}

export const CentralCallOrb: React.FC<CentralCallOrbProps> = ({
  onQuickIntent,
  currentTranscript,
  isInterimTranscript,
  boundKernel,
  lastAssistantResponse,
  activeActionNotice,
  activeDiagnostic,
  onClearDiagnostic,
  onOpenWorkspace,
}) => {
  const [callStatus, setCallStatus] = useState<CallStatus>(audioEngine.getStatus());
  const [micEnergy, setMicEnergy] = useState<number>(0);
  const [outputEnergy, setOutputEnergy] = useState<number>(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  const [sensitivityPreset, setSensitivityPreset] = useState<'HIGH' | 'NORMAL' | 'NOISE_ISOLATION'>('HIGH');
  const [showSensitivityModal, setShowSensitivityModal] = useState<boolean>(false);

  const handleSensitivityChange = (level: 'HIGH' | 'NORMAL' | 'NOISE_ISOLATION') => {
    setSensitivityPreset(level);
    audioEngine.setSensitivity(level);
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const unsubStatus = audioEngine.subscribeStatus((st) => setCallStatus(st));
    const unsubEnergy = audioEngine.subscribeEnergy((mic, out) => {
      setMicEnergy(mic);
      setOutputEnergy(out);
    });
    const unsubError = audioEngine.subscribeError((err) => setPermissionError(err));

    return () => {
      unsubStatus();
      unsubEnergy();
      unsubError();
    };
  }, []);

  // Frequency wave animation loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderWave = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const isSpeaking = callStatus === 'SPEAKING';
      const isListening = callStatus === 'LISTENING';
      const isBargeIn = callStatus === 'BARGE_IN';

      const activeEnergy = isSpeaking ? outputEnergy : micEnergy;
      const bars = 48;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = 100;

      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2;
        const wave = Math.sin(Date.now() * 0.005 + i * 0.4) * 0.5 + 0.5;
        const barHeight = Math.max(3, wave * (activeEnergy * 60 + (isListening ? 16 : 4)));

        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + barHeight);
        const y2 = centerY + Math.sin(angle) * (radius + barHeight);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';

        if (isBargeIn) {
          ctx.strokeStyle = '#f43f5e';
        } else if (isSpeaking) {
          ctx.strokeStyle = '#a855f7';
        } else if (isListening) {
          ctx.strokeStyle = activeEnergy > 0.05 ? '#06b6d4' : '#0891b2';
        } else {
          ctx.strokeStyle = '#1e293b';
        }

        ctx.stroke();
      }

      animId = requestAnimationFrame(renderWave);
    };

    animId = requestAnimationFrame(renderWave);
    return () => cancelAnimationFrame(animId);
  }, [callStatus, micEnergy, outputEnergy]);

  // Safety Abort Controller Timeout: 5 seconds in THINKING state
  useEffect(() => {
    if (callStatus !== 'THINKING') return;

    const safetyAbortTimer = setTimeout(() => {
      console.warn('[CentralCallOrb] 5s Safety Abort Timeout reached in THINKING state. Resetting to LISTENING.');
      audioEngine.resetToListening();
    }, 5000);

    return () => clearTimeout(safetyAbortTimer);
  }, [callStatus]);

  const handleToggleCall = async () => {
    setPermissionError(null);
    try {
      if (!boundKernel || !boundKernel.isActive) {
        if (onOpenWorkspace) {
          onOpenWorkspace('kernel_linker');
          return;
        }
      }

      if (callStatus === 'IDLE') {
        await audioEngine.safeStartMicrophone();
      } else if (callStatus === 'SPEAKING' || callStatus === 'BARGE_IN') {
        // Instant Barge-In Interruption on user click/tap
        audioEngine.interruptSpeech();
      } else if (callStatus === 'LISTENING') {
        await audioEngine.commitCurrentUtterance();
      } else if (callStatus === 'THINKING') {
        audioEngine.resetToListening();
      }
    } catch (err: any) {
      console.warn('[CentralCallOrb] Call toggle status:', err?.name || err?.message || 'Permission denied');
      setPermissionError('يرجى السماح بالوصول إلى الميكروفون من إعدادات المتصفح، أو الكتابة في مربع الحوار بالأسفل.');
    }
  };

  const handleEndCall = () => {
    audioEngine.safeStopMicrophone();
  };

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    onQuickIntent(text);
    setChatInput('');
  };

  return (
    <div className="relative flex-1 flex flex-col items-center justify-between min-h-[90vh] px-4 py-5 select-none font-arabic">
      {/* Top Subtle Status Badge */}
      <div className="w-full max-w-md flex items-center justify-between pt-1 z-20">
        {boundKernel ? (
          <button
            onClick={() => onOpenWorkspace && onOpenWorkspace('kernel_linker')}
            className="flex items-center gap-2 px-3 py-1 bg-cyan-950/70 border border-cyan-500/50 rounded-full text-xs text-cyan-200 hover:border-cyan-400 transition-colors cursor-pointer"
            title="النواة مرتبطة ونشطة - اضغط لإدارة النواة"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>النواة: <strong>{boundKernel.name}</strong></span>
            <span className="text-[10px] text-cyan-400 font-mono">({boundKernel.rules?.length || 0} قواعد)</span>
          </button>
        ) : (
          <button
            onClick={() => onOpenWorkspace && onOpenWorkspace('kernel_linker')}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/40 hover:bg-amber-500/20 rounded-full text-xs text-amber-300 transition-colors cursor-pointer animate-pulse"
            title="اضغط لربط ملف النواة لتفعيل التطبيق"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>النواة غير مرتبطة ⚠️ (اضغط للربط)</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
          <span className={`w-2 h-2 rounded-full ${
            callStatus === 'LISTENING' ? 'bg-cyan-400 animate-pulse' :
            callStatus === 'SPEAKING' ? 'bg-purple-400 animate-ping' :
            callStatus === 'THINKING' ? 'bg-amber-400' : 'bg-slate-600'
          }`} />
          <span>
            {!boundKernel
              ? 'يتطلب ربط النواة'
              : callStatus === 'LISTENING'
              ? 'صوت النواة يستمع'
              : callStatus === 'SPEAKING'
              ? 'صوت النواة يتحدث'
              : 'النواة جاهزة'}
          </span>
        </div>
      </div>

      {/* Unbound Kernel Warning & Direct Link Banner */}
      {!boundKernel && (
        <div className="w-full max-w-md my-2 p-3 bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 border border-amber-500/40 rounded-2xl flex flex-col items-center text-center shadow-lg z-20 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-xs mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>التطبيق لا يعمل إلا من خلال ربط النواة</span>
          </div>
          <p className="text-[11px] text-slate-300 mb-2">
            يرجى ربط ملف النواة (ZIP أو JSON) لتفعيل الفهم والذكاء والتحدث الصوتي من خلال النواة.
          </p>
          <button
            onClick={() => onOpenWorkspace && onOpenWorkspace('kernel_linker')}
            className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
          >
            ربط ملف النواة الآن (Link Kernel)
          </button>
        </div>
      )}

      {/* Center Ambient Glow */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          callStatus === 'LISTENING'
            ? 'bg-cyan-500/15 scale-125'
            : callStatus === 'SPEAKING'
            ? 'bg-purple-500/20 scale-125'
            : callStatus === 'BARGE_IN'
            ? 'bg-rose-500/25 scale-125'
            : 'bg-slate-800/10 scale-90'
        }`}
      />

      {/* Main Central Voice Call Button (Hero Element) */}
      <div className="relative flex flex-col items-center justify-center my-auto z-10 w-full max-w-md">
        <div className="relative flex items-center justify-center w-72 h-72">
          {/* Audio Canvas Rings */}
          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            className="absolute inset-0 pointer-events-none z-10"
          />

          {/* Central Call Button */}
          <button
            onClick={handleToggleCall}
            className={`relative z-20 w-44 h-44 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl cursor-pointer group focus:outline-none ${
              callStatus === 'LISTENING'
                ? 'bg-gradient-to-b from-cyan-950 via-slate-900 to-slate-950 border-2 border-cyan-400 shadow-cyan-500/40 scale-105'
                : callStatus === 'SPEAKING'
                ? 'bg-gradient-to-b from-purple-950 via-slate-900 to-slate-950 border-2 border-purple-400 shadow-purple-500/40 scale-105'
                : callStatus === 'BARGE_IN'
                ? 'bg-gradient-to-b from-rose-950 via-slate-900 to-slate-950 border-2 border-rose-400 shadow-rose-500/50 scale-110'
                : 'bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 hover:border-cyan-500/60 shadow-slate-950 hover:scale-102'
            }`}
            title="بدء التحدث بالمايكروفون مع النواة"
          >
            <div className="relative mb-2">
              {callStatus === 'IDLE' ? (
                <MicOff className="w-12 h-12 text-slate-400 group-hover:text-cyan-400 transition-colors" />
              ) : callStatus === 'SPEAKING' ? (
                <Volume2 className="w-12 h-12 text-purple-400 animate-pulse" />
              ) : callStatus === 'BARGE_IN' ? (
                <Zap className="w-12 h-12 text-rose-400 animate-bounce" />
              ) : (
                <Mic className="w-12 h-12 text-cyan-400 animate-pulse" />
              )}
            </div>

            <span className="text-xs font-bold tracking-wider transition-colors">
              {callStatus === 'IDLE' && (
                <span className={boundKernel ? "text-slate-300 group-hover:text-white" : "text-amber-300 font-bold"}>
                  {boundKernel ? "تحدث عبر النواة" : "اضغط لربط النواة"}
                </span>
              )}
              {callStatus === 'STARTING' && <span className="text-yellow-400">تشغيل المايك...</span>}
              {callStatus === 'LISTENING' && <span className="text-cyan-300">النواة تستمع إليك</span>}
              {callStatus === 'THINKING' && <span className="text-amber-300 animate-pulse">النواة تعالج الأمر...</span>}
              {callStatus === 'SPEAKING' && <span className="text-purple-300">صوت النواة يتحدث...</span>}
              {callStatus === 'BARGE_IN' && <span className="text-rose-400">مقاطعة الصوت!</span>}
              {callStatus === 'STOPPING' && <span className="text-yellow-400">إيقاف المايك...</span>}
            </span>

            {/* Live Audio Energy Indicator */}
            {callStatus === 'LISTENING' && (
              <span className="text-[10px] text-cyan-400 font-mono mt-1">
                {micEnergy > 0.04 ? `التقاط الصوت: ${Math.round(micEnergy * 100)}%` : 'تحدث الآن...'}
              </span>
            )}
          </button>
        </div>

        {/* Voice Control Buttons when call is active */}
        {callStatus !== 'IDLE' && (
          <div className="flex items-center gap-2 mt-2 z-20">
            {callStatus === 'SPEAKING' && (
              <button
                onClick={() => audioEngine.interruptSpeech()}
                className="px-4 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-rose-600/40 active:scale-95 animate-pulse"
                title="مقاطعة الصوت فوراً"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>مقاطعة الصوت (اسكت)</span>
              </button>
            )}

            <button
              onClick={handleEndCall}
              className="px-3.5 py-1.5 rounded-full bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95"
              title="إنهاء المكالمة"
            >
              <PhoneOff className="w-3 h-3 text-rose-400" />
              <span>إيقاف المايك</span>
            </button>
          </div>
        )}

        {/* Live Conversation Stream (User Utterance + Kernel Voice Reply) */}
        <div className="w-full space-y-2.5 my-3">
          {/* User Utterance Box */}
          {currentTranscript && (
            <div className="min-h-[42px] px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-md flex items-center gap-2 text-right animate-in fade-in duration-200">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
              <p className="text-xs font-bold text-slate-100 leading-relaxed flex-1">
                "{currentTranscript}"
                {isInterimTranscript && <span className="text-cyan-400"> ...</span>}
              </p>
            </div>
          )}

          {/* Assistant Voice Response Card */}
          {lastAssistantResponse && (
            <div className={`px-4 py-3 rounded-2xl border transition-all flex items-start gap-2.5 text-right ${
              callStatus === 'SPEAKING'
                ? 'bg-purple-950/60 border-purple-500/50 shadow-purple-500/20 shadow-lg animate-pulse'
                : 'bg-slate-900/80 border-slate-800 text-slate-200 shadow-lg'
            }`}>
              <div className="p-1 rounded-lg bg-purple-500/20 text-purple-400 shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-purple-300 font-bold">
                    {callStatus === 'SPEAKING' ? 'النواة تتحدث...' : 'رد النواة:'}
                  </span>
                  {callStatus === 'SPEAKING' && (
                    <span className="flex items-center gap-1 text-[10px] text-purple-400 font-mono">
                      <Volume2 className="w-3 h-3 animate-bounce" />
                      <span>صوت نشط</span>
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-100 leading-relaxed">
                  {lastAssistantResponse}
                </p>
              </div>
            </div>
          )}

          {/* Diagnostic Breakdown Card (Shows when command cannot be executed) */}
          {activeDiagnostic && activeDiagnostic.hasDefect && (
            <div className="p-4 rounded-2xl border transition-all text-right shadow-2xl animate-in fade-in zoom-in-95 duration-200 bg-slate-900/95 border-amber-500/50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                    activeDiagnostic.origin === 'KERNEL'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {activeDiagnostic.origin === 'KERNEL' ? '🧠 الخلل في النواة (Kernel)' : '⚙️ الخلل في المحرك (Engine)'}
                  </span>
                  <span className="text-xs font-bold text-white">{activeDiagnostic.title}</span>
                </div>
                {onClearDiagnostic && (
                  <button
                    onClick={onClearDiagnostic}
                    className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                    title="إغلاق التقرير"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {activeDiagnostic.commandRequested && (
                <p className="text-[11px] text-slate-400 mb-2">
                  الأمر المطلوب: <span className="text-cyan-300 font-mono">"{activeDiagnostic.commandRequested}"</span>
                </p>
              )}

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[11px] font-bold text-amber-400 mb-0.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>سبب الخلل وعدم القدرة على التنفيذ:</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed text-[11px]">
                    {activeDiagnostic.cause}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30">
                  <div className="text-[11px] font-bold text-cyan-300 mb-0.5 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                    <span>الحل والإجراء المطلوب:</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed text-[11px]">
                    {activeDiagnostic.suggestedAction}
                  </p>
                </div>
              </div>

              {/* Action Buttons for Diagnostic */}
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800/80">
                {activeDiagnostic.defectType === 'KERNEL_KNOWLEDGE_MISSING' && onOpenWorkspace && (
                  <button
                    onClick={() => onOpenWorkspace('kernel_trainer')}
                    className="flex-1 py-2 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>تعليم وتدريب النواة الآن (Teach Kernel)</span>
                  </button>
                )}

                {activeDiagnostic.defectType === 'KERNEL_LIBRARY_REQUIRED' && onOpenWorkspace && (
                  <button
                    onClick={() => onOpenWorkspace('kernel_trainer')}
                    className="flex-1 py-2 px-3 bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>إرفاق مكتبة للنواة (Attach Library)</span>
                  </button>
                )}

                {activeDiagnostic.origin === 'ENGINE' && (
                  <div className="text-[10px] text-slate-400 font-mono w-full text-center">
                    قيود البيئة التشغيلية للمحرك (Engine Sandbox Boundary)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active Workspace / Action Notice Banner */}
          {activeActionNotice && onOpenWorkspace && (
            <div className="px-3.5 py-2.5 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-between shadow-lg animate-in fade-in duration-300">
              <span className="text-xs text-cyan-200">
                جاهز: <strong>{activeActionNotice.name}</strong>
              </span>
              <button
                onClick={() => onOpenWorkspace(activeActionNotice.workspace)}
                className="px-3 py-1.5 text-xs rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors cursor-pointer shadow-sm"
              >
                فتح الشاشة الآن
              </button>
            </div>
          )}

          {/* Permission Notice */}
          {permissionError && (
            <div className="px-4 py-2 bg-amber-950/40 border border-amber-500/30 rounded-2xl text-xs text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{permissionError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Sensitivity & Anti-Cutoff Toolbar */}
      <div className="w-full max-w-lg z-20 px-1 mb-2">
        <div className="flex items-center justify-between text-xs bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSensitivityChange('HIGH')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                sensitivityPreset === 'HIGH'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="مهلة 1100ms - تمنع انقطاع الصوت تماماً أثناء التحدث والتردد"
            >
              حساسية فائقة (مانع التقطيع)
            </button>
            <button
              onClick={() => handleSensitivityChange('NORMAL')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                sensitivityPreset === 'NORMAL'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="مهلة 850ms - متوازنة وطبيعية"
            >
              متوازنة (850ms)
            </button>
            <button
              onClick={() => handleSensitivityChange('NOISE_ISOLATION')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                sensitivityPreset === 'NOISE_ISOLATION'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="مهلة 600ms - استجابة سريعة"
            >
              سريعة
            </button>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono pr-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>مانع التقطيع نشط</span>
          </div>
        </div>
      </div>

      {/* Bottom Area: Clean Dialogue Box for Chat & Commands */}
      <div className="w-full max-w-lg z-20 pb-2">
        <form
          onSubmit={handleSendChat}
          className="relative flex items-center bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 hover:border-cyan-500/50 focus-within:border-cyan-500 rounded-2xl p-1.5 shadow-2xl transition-all"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="اكتب أمرك أو سؤالك هنا (مثلاً: لنعلم النواة، افتح صفحة بناء التطبيقات)..."
            className="flex-1 bg-transparent px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none text-right font-sans"
          />

          <button
            type="submit"
            disabled={!chatInput.trim()}
            className="p-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
            title="إرسال الأمر للنواة"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
