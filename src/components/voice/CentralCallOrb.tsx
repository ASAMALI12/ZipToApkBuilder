import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../../services/audioEngine';
import { CallStatus, BoundKernel } from '../../types/kernel';
import { KernelBridge } from '../../services/kernelBridge';
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
  ShieldCheck,
  FolderOpen,
  Download,
  RefreshCw,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Share2,
} from 'lucide-react';
import { ServerSettingsModal } from '../modals/ServerSettingsModal';
import { BridgesInspectorModal } from '../modals/BridgesInspectorModal';
import { testBackendConnection } from '../../services/apiConfig';

interface CentralCallOrbProps {
  onQuickIntent: (phrase: string) => void;
  userQuestion?: string;
  currentTranscript?: string;
  isInterimTranscript?: boolean;
  boundKernel: BoundKernel | null;
  onBindKernel: (kernel: BoundKernel | null) => void;
  lastAssistantResponse?: string;
  imageUrl?: string;
}

export const CentralCallOrb: React.FC<CentralCallOrbProps> = ({
  onQuickIntent,
  userQuestion,
  currentTranscript,
  isInterimTranscript,
  boundKernel,
  onBindKernel,
  lastAssistantResponse,
  imageUrl,
}) => {
  const [callStatus, setCallStatus] = useState<CallStatus>(audioEngine.getStatus());
  const [micEnergy, setMicEnergy] = useState<number>(0);
  const [outputEnergy, setOutputEnergy] = useState<number>(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  const [sensitivityPreset, setSensitivityPreset] = useState<'HIGH' | 'NORMAL' | 'NOISE_ISOLATION'>('NORMAL');
  const [linkingNotice, setLinkingNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isServerModalOpen, setIsServerModalOpen] = useState<boolean>(false);
  const [isBridgesModalOpen, setIsBridgesModalOpen] = useState<boolean>(false);
  const [serverPingState, setServerPingState] = useState<{ isReachable: boolean; latencyMs: number } | null>(null);

  const checkServerStatus = () => {
    testBackendConnection().then((res) => {
      setServerPingState({ isReachable: res.isReachable, latencyMs: res.latencyMs });
    }).catch(() => {
      setServerPingState({ isReachable: false, latencyMs: 0 });
    });
  };

  useEffect(() => {
    checkServerStatus();
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleSensitivityChange = (level: 'HIGH' | 'NORMAL' | 'NOISE_ISOLATION') => {
    setSensitivityPreset(level);
    audioEngine.setSensitivity(level);
  };

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

  // Audio frequency wave animation loop
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

  // Safety Abort Controller Timeout: 3.2 seconds max in THINKING state
  useEffect(() => {
    if (callStatus !== 'THINKING') return;

    const safetyAbortTimer = setTimeout(() => {
      audioEngine.resetToListening();
    }, 3200);

    return () => clearTimeout(safetyAbortTimer);
  }, [callStatus]);

  // Handle direct file selection from phone or PC (Smart ZIP or Rules)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLinkingNotice(`جاري فحص واستخراج محتويات الملف: ${file.name}...`);
      const bound = await KernelBridge.bindKernelFile(file);
      onBindKernel(bound);
      const msg = `تم ربط وتحديث النواة "${bound.name}" بنجاح (${bound.rules.length} قواعد). النواة جاهزة للحديث معك.`;
      setLinkingNotice(msg);
      audioEngine.speak(`تم ربط النواة ${bound.name} بنجاح. أنا جاهز للحديث وتنفيذ طلباتك.`);
      setTimeout(() => setLinkingNotice(null), 5000);
    } catch (err: any) {
      setLinkingNotice(`فشل ربط النواة: ${err.message || 'الملف غير صالح'}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleCall = async () => {
    setPermissionError(null);
    try {
      if (!boundKernel || !boundKernel.isActive) {
        fileInputRef.current?.click();
        return;
      }

      if (callStatus === 'IDLE') {
        await audioEngine.safeStartMicrophone();
      } else if (callStatus === 'SPEAKING' || callStatus === 'BARGE_IN') {
        audioEngine.interruptSpeech();
      } else if (callStatus === 'LISTENING') {
        await audioEngine.commitCurrentUtterance();
      } else if (callStatus === 'THINKING') {
        audioEngine.resetToListening();
      }
    } catch (err: any) {
      setPermissionError('يرجى السماح بالوصول إلى الميكروفون من إعدادات المتصفح، أو إرسال الأوامر عبر مربع الحوار بالأسفل.');
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

  const handleDownloadImage = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `kernel_image_${Date.now()}.${url.includes('svg') ? 'svg' : 'png'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="relative flex-1 flex flex-col items-center justify-between min-h-[92vh] px-3 sm:px-4 py-4 select-none font-arabic max-w-4xl mx-auto w-full">
      {/* Hidden File Picker Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".zip,.json,.tar.gz,.txt,.md"
        className="hidden"
      />

      {/* Top Header Bar: Unmistakable File Picker & Active Kernel Badge */}
      <header className="w-full flex items-center justify-between pt-1 pb-3 border-b border-slate-800/80 gap-2 flex-wrap z-20">
        {/* Kernel Binding / File Picker Action */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
            title="فتح ملفات الهاتف واختيار ملف النواة (ZIP أو JSON)"
          >
            <FolderOpen className="w-4 h-4" />
            <span>{boundKernel ? 'تحديث النواة من الهاتف (ملف جديد)' : 'فتح ملفات الهاتف واختيار النواة (ZIP)'}</span>
          </button>

          {boundKernel && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-cyan-950/70 border border-cyan-500/50 rounded-xl text-xs text-cyan-200">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>النواة: <strong>{boundKernel.name}</strong></span>
              <span className="text-[10px] text-cyan-400 font-mono">({boundKernel.rules?.length || 0} قواعد)</span>
            </div>
          )}
        </div>

        {/* Status Live Indicator & Server Connection */}
        <div className="flex items-center gap-2">
          {boundKernel && (
            <button
              onClick={() => onBindKernel(null)}
              className="text-[11px] text-slate-400 hover:text-rose-400 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
              title="فك ارتباط النواة"
            >
              فك الارتباط
            </button>
          )}

          {/* Multi-Bridge Inspector Action */}
          <button
            onClick={() => setIsBridgesModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono bg-cyan-950/50 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/50 transition-all cursor-pointer shadow-sm"
            title="فحص جسور الربط المتوازية مع النواة"
          >
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>جسور النواة (5)</span>
          </button>

          <button
            onClick={() => setIsServerModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono border transition-all cursor-pointer ${
              serverPingState?.isReachable
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                : serverPingState === null
                ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300 hover:bg-rose-900/40'
            }`}
            title="إعدادات الخادم وحالة اتصال الـ APK"
          >
            {serverPingState?.isReachable ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>{serverPingState?.isReachable ? `${serverPingState.latencyMs}ms` : 'الخادم / APK'}</span>
          </button>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800">
            <span
              className={`w-2 h-2 rounded-full ${
                callStatus === 'LISTENING'
                  ? 'bg-cyan-400 animate-pulse'
                  : callStatus === 'SPEAKING'
                  ? 'bg-purple-400 animate-ping'
                  : callStatus === 'THINKING'
                  ? 'bg-amber-400 animate-pulse'
                  : boundKernel
                  ? 'bg-emerald-400'
                  : 'bg-amber-500'
              }`}
            />
            <span>
              {!boundKernel
                ? 'يتطلب اختيار النواة'
                : callStatus === 'LISTENING'
                ? 'النواة تستمع إليك'
                : callStatus === 'SPEAKING'
                ? 'صوت النواة يتحدث'
                : callStatus === 'THINKING'
                ? 'النواة تجيب...'
                : 'النواة جاهزة'}
            </span>
          </div>
        </div>
      </header>

      {/* Linking Notice Banner */}
      {linkingNotice && (
        <div className="w-full my-2 p-2.5 bg-cyan-950/80 border border-cyan-500/40 rounded-xl text-xs text-cyan-200 text-center animate-in fade-in duration-200 z-20">
          {linkingNotice}
        </div>
      )}

      {/* Unbound Kernel Warning Banner */}
      {!boundKernel && (
        <div className="w-full my-3 p-4 bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border border-amber-500/50 rounded-2xl flex flex-col items-center text-center shadow-xl z-20 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>التطبيق جسر مباشر يتطلب ربط النواة (ZIP) للتحدث والدردشة</span>
          </div>
          <p className="text-xs text-slate-300 mb-3 max-w-lg leading-relaxed">
            اضغط على الزر أدناه لاختيار ملف النواة من هاتفك، وسيتم وصل الجسور مباشرة لتتحدث وتدردش معها بكل بساطة.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            <span>اختيار وربط ملف النواة الآن (Link Kernel ZIP)</span>
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
      <div className="relative flex flex-col items-center justify-center my-3 z-10 w-full max-w-md">
        <div className="relative flex items-center justify-center w-64 h-64 sm:w-72 sm:h-72">
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
            className={`relative z-20 w-40 h-40 sm:w-44 sm:h-44 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl cursor-pointer group focus:outline-none ${
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
                <MicOff className="w-11 h-11 text-slate-400 group-hover:text-cyan-400 transition-colors" />
              ) : callStatus === 'SPEAKING' ? (
                <Volume2 className="w-11 h-11 text-purple-400 animate-pulse" />
              ) : callStatus === 'BARGE_IN' ? (
                <Zap className="w-11 h-11 text-rose-400 animate-bounce" />
              ) : (
                <Mic className="w-11 h-11 text-cyan-400 animate-pulse" />
              )}
            </div>

            <span className="text-xs font-bold tracking-wider transition-colors px-2 text-center">
              {callStatus === 'IDLE' && (
                <span className={boundKernel ? 'text-slate-300 group-hover:text-white' : 'text-amber-300 font-bold'}>
                  {boundKernel ? 'تحدث مع النواة' : 'اضغط لربط النواة'}
                </span>
              )}
              {callStatus === 'STARTING' && <span className="text-yellow-400">تشغيل المايك...</span>}
              {callStatus === 'LISTENING' && <span className="text-cyan-300">النواة تستمع إليك</span>}
              {callStatus === 'THINKING' && <span className="text-amber-300 animate-pulse">النواة تجيب...</span>}
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
          <div className="flex items-center gap-2 mt-1 z-20">
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
      </div>

      {/* Pure Single-Exchange Chat: Only Active Question and Answer Are Shown */}
      {(() => {
        const activeUserQuestion = userQuestion || currentTranscript;
        const isWaitingForAnswer =
          callStatus === 'THINKING' ||
          (Boolean(activeUserQuestion) && !lastAssistantResponse && !imageUrl);

        if (activeUserQuestion) {
          return (
            <div className="w-full max-w-lg space-y-3 my-2 z-20 animate-in fade-in duration-200">
              {/* 1. سؤالي (My Question) */}
              <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-950 rounded-2xl border border-cyan-500/40 shadow-lg text-right">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex items-center gap-1.5 text-cyan-300 text-xs font-bold">
                    <span>سؤالي للنواة</span>
                    <div className="w-5 h-5 rounded-md bg-cyan-500/20 flex items-center justify-center">
                      <Send className="w-3 h-3 text-cyan-400 -rotate-45" />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-semibold text-white leading-relaxed">
                  "{activeUserQuestion}"
                  {isInterimTranscript && <span className="text-cyan-400 animate-pulse"> ... (جاري الاستماع)</span>}
                </p>
              </div>

              {/* 2. جواب النواة (Kernel Answer / Pending State) */}
              {isWaitingForAnswer ? (
                <div className="px-4 py-3 bg-slate-900/90 rounded-2xl border border-amber-500/40 shadow-md text-right flex items-center justify-between gap-3 animate-pulse">
                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                  <div className="text-right">
                    <p className="text-xs font-bold text-amber-300">النواة تجيب عبر جسور الاتصال...</p>
                    <p className="text-[11px] text-slate-400">جاري نقل إجابة النواة مباشرة إليك</p>
                  </div>
                </div>
              ) : (lastAssistantResponse || imageUrl) ? (
                <div className="px-4 py-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-2xl border border-purple-500/40 shadow-xl text-right space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      {callStatus === 'SPEAKING' && (
                        <span className="flex items-center gap-1 text-[10px] text-purple-300 font-mono bg-purple-950/70 px-2 py-0.5 rounded-lg border border-purple-500/40">
                          <Volume2 className="w-3 h-3 animate-bounce text-purple-400" />
                          <span>صوت النواة يتحدث</span>
                        </span>
                      )}
                      <button
                        onClick={() => handleCopyText('current_ans', lastAssistantResponse || '')}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer"
                      >
                        {copiedId === 'current_ans' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === 'current_ans' ? 'تم النسخ' : 'نسخ الجواب'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold">
                      <span>جواب النواة</span>
                      <div className="w-5 h-5 rounded-md bg-purple-500/20 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                    </div>
                  </div>

                  {/* Text Answer */}
                  {lastAssistantResponse && (
                    <p className="text-xs sm:text-sm font-medium text-slate-100 leading-relaxed whitespace-pre-wrap">
                      {lastAssistantResponse}
                    </p>
                  )}

                  {/* Attached Image if generated by Kernel */}
                  {imageUrl && (
                    <div className="space-y-2 pt-1">
                      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center max-h-64">
                        <img
                          src={imageUrl}
                          alt="Kernel Output"
                          className="max-h-64 w-auto object-contain rounded-xl"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleDownloadImage(imageUrl)}
                          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>تحميل الصورة</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <div className="w-full max-w-md my-2 py-2.5 px-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center text-xs text-slate-400 flex items-center justify-center gap-2 z-20">
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>تحدث أو اكتب ما تريد — جسور النواة تنقل صوتك وأسئلتك للنواة مباشرة</span>
          </div>
        );
      })()}

      {/* Permission Notice */}
      {permissionError && (
        <div className="w-full px-4 py-2 bg-amber-950/40 border border-amber-500/30 rounded-2xl text-xs text-amber-200 flex items-center gap-2 z-20 my-1">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{permissionError}</span>
        </div>
      )}

      {/* Sensitivity & Anti-Cutoff Toolbar */}
      <div className="w-full max-w-lg z-20 px-1 mt-auto mb-2">
        <div className="flex items-center justify-between text-xs bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSensitivityChange('HIGH')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                sensitivityPreset === 'HIGH'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="مهلة 650ms"
            >
              طبيعية (650ms)
            </button>
            <button
              onClick={() => handleSensitivityChange('NORMAL')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                sensitivityPreset === 'NORMAL'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="مهلة 500ms متوازنة وسريعة"
            >
              متوازنة (500ms)
            </button>
            <button
              onClick={() => handleSensitivityChange('NOISE_ISOLATION')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                sensitivityPreset === 'NOISE_ISOLATION'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="استجابة فائقة السرعة"
            >
              سريعة
            </button>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono pr-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>جسور النواة نشطة</span>
          </div>
        </div>
      </div>

      {/* Bottom Area: Clean Dialogue Box for Chat & Questions */}
      <footer className="w-full max-w-lg z-20 pb-2">
        <form
          onSubmit={handleSendChat}
          className="relative flex items-center bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 hover:border-cyan-500/50 focus-within:border-cyan-500 rounded-2xl p-1.5 shadow-2xl transition-all"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="اكتب رسالتك أو سؤالك للنواة (التطبيق جسر مباشر ينقلها فوراً)..."
            className="flex-1 bg-transparent px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none text-right font-sans"
          />

          <button
            type="submit"
            disabled={!chatInput.trim()}
            className="p-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
            title="إرسال للنواة"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>

      {/* Server & APK Connection Modal */}
      <ServerSettingsModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        onConnectionChange={checkServerStatus}
      />

      {/* Multi-Bridge Telemetry & Inspector Modal */}
      <BridgesInspectorModal
        isOpen={isBridgesModalOpen}
        onClose={() => setIsBridgesModalOpen(false)}
        boundKernel={boundKernel}
      />
    </div>
  );
};
