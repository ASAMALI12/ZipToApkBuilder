import React, { useEffect, useState, useCallback } from 'react';
import {
  WorkspaceType,
  BoundKernel,
  CallStatus,
  KernelDiagnosticReport,
  KernelDeliverable,
} from './types/kernel';
import { audioEngine } from './services/audioEngine';
import { parseUtterance, requestTTSAudio, diagnoseCommandDefect } from './services/intentParser';
import { StorageEngine } from './services/storageEngine';
import { KernelBridge } from './services/kernelBridge';
import { getApiUrl } from './services/apiConfig';

import { CentralCallOrb } from './components/voice/CentralCallOrb';
import { FloatingVoiceOrb } from './components/voice/FloatingVoiceOrb';

import { AppBuilderView } from './components/views/AppBuilderView';
import { ImageGeneratorView } from './components/views/ImageGeneratorView';
import { GameBuilderView } from './components/views/GameBuilderView';
import { MediaStudioView } from './components/views/MediaStudioView';
import { GitHubBridgeView } from './components/views/GitHubBridgeView';
import { SupabaseBridgeView } from './components/views/SupabaseBridgeView';
import { KernelLinkerView } from './components/views/KernelLinkerView';
import { KernelTrainerView } from './components/views/KernelTrainerView';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export default function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceType>('home');
  const [callStatus, setCallStatus] = useState<CallStatus>(audioEngine.getStatus());

  // Transcripts & Assistant Replies
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [isInterim, setIsInterim] = useState<boolean>(false);
  const [lastAssistantResponse, setLastAssistantResponse] = useState<string>('');
  const [activeActionNotice, setActiveActionNotice] = useState<{ name: string; workspace: string } | null>(null);

  // Dynamic Parameters & Diagnostics
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [appType, setAppType] = useState<string>('');
  const [activeDiagnostic, setActiveDiagnostic] = useState<KernelDiagnosticReport | null>(null);

  // Bound Kernel State
  const [boundKernel, setBoundKernel] = useState<BoundKernel | null>(() =>
    StorageEngine.loadBoundKernel()
  );

  const [latestUserQuestion, setLatestUserQuestion] = useState<string>('');
  const [currentDeliverable, setCurrentDeliverable] = useState<KernelDeliverable | null>(null);
  const [isExecutingDeliverable, setIsExecutingDeliverable] = useState<boolean>(false);

  // Apply Intent to Router & Direct Execution Bridge
  const applyIntentRouting = useCallback((
    intent: string,
    responseText?: string,
    spokenText?: string,
    rawUtterance?: string,
    parameters?: any,
    diagnostic?: KernelDiagnosticReport
  ) => {
    if (rawUtterance) {
      setLatestUserQuestion(rawUtterance);
    }

    if (responseText || spokenText) {
      setLastAssistantResponse(responseText || spokenText || '');
    }

    if (diagnostic) {
      setActiveDiagnostic(diagnostic);
    } else if (rawUtterance && intent === 'INTENT_GENERAL_QUERY' && /(?:انشئ|ابني|صمم|احجز|شغل|اطبخ|معادلات|تحكم)/i.test(rawUtterance)) {
      const assessed = diagnoseCommandDefect(rawUtterance, boundKernel);
      setActiveDiagnostic(assessed);
    }

    if (parameters?.prompt) {
      setImagePrompt(parameters.prompt);
    }
    if (parameters?.appType) {
      setAppType(parameters.appType);
    }

    if (intent === 'INTENT_INTERRUPT_SPEECH') {
      audioEngine.interruptSpeech();
      setLastAssistantResponse('أنا صامت ومستمع لأوامرك.');
      return;
    }

    if (intent === 'INTENT_EXECUTE_COMMAND') {
      setLastAssistantResponse('أمرك قيد التنفيذ فوراً، النواة تباشر العمل وتستمر بالاستماع إليك.');
      return;
    }

    if (intent === 'INTENT_CLOSE_MIC') {
      audioEngine.interruptSpeech();
      audioEngine.safeStopMicrophone();
      setLastAssistantResponse('تم إيقاف الميكروفون وحفظ طاقة النواة.');
      return;
    }

    if (intent === 'INTENT_NAVIGATE_BACK') {
      setActiveWorkspace('home');
      setActiveActionNotice(null);
      return;
    }

    // Direct Kernel Bridge Execution for Image Generation (Wipes previous deliverables)
    if (intent === 'INTENT_GENERATE_IMAGE') {
      const promptToGen = parameters?.prompt || (rawUtterance ? rawUtterance.replace(/(?:انشئ|صمم|توليد|ارسم|صورة|سويلي|صور)\s+/gi, '').trim() : '') || 'تصميم رقمي متقن';
      if (rawUtterance) setLatestUserQuestion(rawUtterance);
      setIsExecutingDeliverable(true);
      setCurrentDeliverable(null);
      setLastAssistantResponse('');
      KernelBridge.executeImageGeneration(promptToGen).then((item) => {
        setCurrentDeliverable(item);
        setIsExecutingDeliverable(false);
        setLastAssistantResponse(`تم تصميم وتوليد صورة "${promptToGen}" بنجاح، وهي جاهزة للتحميل.`);
        audioEngine.speak(`تم توليد الصورة عبر النواة، وهي جاهزة للتحميل.`);
      });
      return;
    }

    // Direct Kernel Bridge Execution for Mobile / Web App Building with ZIP Export
    if (intent === 'INTENT_BUILD_APP') {
      const isIos = /(?:ايفون|آيفون|ios|swift)/i.test(rawUtterance || '');
      const platform = isIos ? 'ios' : 'android';
      const appName = parameters?.appType || (rawUtterance ? rawUtterance.replace(/(?:بناء|ابني|طور|برمج|سوي|تطبيق)\s+/gi, '').trim() : '') || 'تطبيق النواة الذكي';
      if (rawUtterance) setLatestUserQuestion(rawUtterance);
      setIsExecutingDeliverable(true);
      setCurrentDeliverable(null);
      setLastAssistantResponse('');
      KernelBridge.executeAppBuild(appName, platform).then((item) => {
        setCurrentDeliverable(item);
        setIsExecutingDeliverable(false);
        setLastAssistantResponse(`تمت برمجة وتجميع تطبيق "${appName}" (${platform === 'android' ? 'أندرويد' : 'آيفون'})، وحزمة الـ ZIP جاهزة للتحميل.`);
        audioEngine.speak(`تمت برمجة وتجميع التطبيق بالكامل، وحزمة الـ ZIP جاهزة للتحميل إلى هاتفك.`);
      });
      return;
    }

    if (intent === 'INTENT_LINK_KERNEL') {
      setActiveActionNotice({ name: 'ربط ملف النواة من الهاتف', workspace: 'kernel_linker' });
      setActiveWorkspace('kernel_linker');
      return;
    }

    if (intent === 'INTENT_TEACH_KERNEL') {
      setActiveActionNotice({ name: 'صفحة تعليم وتدريب النواة', workspace: 'kernel_trainer' });
      setActiveWorkspace('kernel_trainer');
      return;
    }

    // Record only the active single question/response (Wipes previous chats)
    if (responseText || spokenText) {
      if (rawUtterance) setLatestUserQuestion(rawUtterance);
      setIsExecutingDeliverable(false);
      setCurrentDeliverable(null);
      setLastAssistantResponse(responseText || spokenText || '');
    }
  }, [boundKernel, latestUserQuestion]);

  // Autonomous Intent Processing via Voice or Text Chat Box (Unified Single Path)
  const processIntentExecution = useCallback(
    async (utteranceText: string) => {
      const clean = utteranceText.trim();
      if (!clean) return;
      // Immediately wipe previous question and answer
      setLatestUserQuestion(clean);
      setCurrentTranscript(clean);
      setLastAssistantResponse('');
      setCurrentDeliverable(null);
      setActiveDiagnostic(null);
      setIsExecutingDeliverable(true);
      await audioEngine.handleDirectTextUtterance(clean);
    },
    []
  );

  // Audio Engine Lifecycle Listeners
  useEffect(() => {
    const unsubStatus = audioEngine.subscribeStatus((st) => setCallStatus(st));

    const unsubTranscript = (text: string, isFinal: boolean) => {
      setCurrentTranscript(text);
      setIsInterim(!isFinal);
      // When a new speech utterance starts, clear previous answer so previous chat disappears
      if (text.trim() && !isFinal) {
        setLatestUserQuestion(text.trim());
        setLastAssistantResponse('');
        setCurrentDeliverable(null);
        setActiveDiagnostic(null);
      }
    };

    const unsubResult = (res: any) => {
      if (res.transcript) {
        setCurrentTranscript(res.transcript);
        setLatestUserQuestion(res.transcript);
      }
      if (res.assistant_response || res.voice_spoken_text) {
        setLastAssistantResponse(res.assistant_response || res.voice_spoken_text || '');
      }
      if (res.intent) {
        applyIntentRouting(
          res.intent,
          res.assistant_response,
          res.voice_spoken_text,
          res.transcript || res.parameters?.raw_utterance,
          res.parameters,
          res.diagnostic || res.parameters?.diagnostic
        );
      }
    };

    const unsubT = audioEngine.subscribeTranscript(unsubTranscript);
    const unsubR = audioEngine.subscribeResult(unsubResult);

    return () => {
      unsubStatus();
      unsubT();
      unsubR();
    };
  }, [applyIntentRouting]);

  // Sync stored kernel and learned knowledge with server on startup
  useEffect(() => {
    const knowledge = StorageEngine.loadLearnedKnowledge();
    const kernel = StorageEngine.loadBoundKernel();
    if (knowledge || kernel) {
      fetch(getApiUrl('/api/kernel/session-init'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summaryContext: knowledge || (kernel?.instructions ? kernel.instructions.join('\n') : ''),
          rules: kernel?.rules || [],
          instructions: kernel?.instructions || [],
          kernelName: kernel?.name || 'النواة الذاتية',
        }),
      }).catch(() => {});
    }
  }, []);

  const handleBindKernel = (kernel: BoundKernel | null) => {
    setBoundKernel(kernel);
    StorageEngine.saveBoundKernel(kernel);
    if (kernel) {
      const confirmText = `تم ربط النواة "${kernel.name}" بنجاح (${kernel.rules?.length || 0} قواعد نشطة). التطبيق الآن يعمل ويعتمد كلياً على النواة.`;
      setLastAssistantResponse(confirmText);
      audioEngine.speak(`تم ربط النواة ${kernel.name} بنجاح. أنا جاهز للعمل والتحدث من خلال النواة.`);
    } else {
      setLastAssistantResponse('تم فك ربط النواة. يرجى ربط ملف نواة جديد لتفعيل النظام.');
    }
  };

  const deliverables = currentDeliverable ? [currentDeliverable] : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-arabic select-none selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Main Viewport */}
      <main className="flex-1 flex flex-col">
        <ErrorBoundary onReset={() => setActiveWorkspace('home')}>
          {/* Pure Clean Minimalist Voice & Chat Launcher */}
          {activeWorkspace === 'home' && (
            <CentralCallOrb
              onQuickIntent={processIntentExecution}
              userQuestion={latestUserQuestion || currentTranscript}
              currentTranscript={currentTranscript}
              isInterimTranscript={isInterim}
              boundKernel={boundKernel}
              onBindKernel={handleBindKernel}
              lastAssistantResponse={lastAssistantResponse}
              activeActionNotice={activeActionNotice}
              activeDiagnostic={activeDiagnostic}
              onClearDiagnostic={() => setActiveDiagnostic(null)}
              onOpenWorkspace={(ws) => setActiveWorkspace(ws as WorkspaceType)}
              deliverables={deliverables}
              isExecutingDeliverable={isExecutingDeliverable}
            />
          )}

          {/* 1. Kernel Trainer (تعليم النواة) */}
          {activeWorkspace === 'kernel_trainer' && (
            <KernelTrainerView
              boundKernel={boundKernel}
              onUpdateBoundKernel={handleBindKernel}
              onBackToHome={() => setActiveWorkspace('home')}
            />
          )}

          {/* 2. App Builder for Android & iPhone */}
          {activeWorkspace === 'app_builder' && (
            <AppBuilderView
              onBackToHome={() => setActiveWorkspace('home')}
              initialAppType={appType}
            />
          )}

          {/* 3. Image Generator Studio */}
          {activeWorkspace === 'image_generator' && (
            <ImageGeneratorView
              onBackToHome={() => setActiveWorkspace('home')}
              initialPrompt={imagePrompt}
            />
          )}

          {/* 4. Game Builder & Playable Canvas Game */}
          {activeWorkspace === 'game_builder' && (
            <GameBuilderView onBackToHome={() => setActiveWorkspace('home')} />
          )}

          {/* 5. Video & Audio Studio */}
          {activeWorkspace === 'media_studio' && (
            <MediaStudioView onBackToHome={() => setActiveWorkspace('home')} />
          )}

          {/* 6. GitHub Bridge */}
          {activeWorkspace === 'github_bridge' && (
            <GitHubBridgeView onBackToHome={() => setActiveWorkspace('home')} />
          )}

          {/* 7. Supabase Bridge */}
          {activeWorkspace === 'supabase_bridge' && (
            <SupabaseBridgeView onBackToHome={() => setActiveWorkspace('home')} />
          )}

          {/* 8. Kernel File Linker (opens phone/PC file picker) */}
          {activeWorkspace === 'kernel_linker' && (
            <KernelLinkerView
              boundKernel={boundKernel}
              onBindKernel={handleBindKernel}
              onBackToHome={() => setActiveWorkspace('home')}
              autoOpenFilePicker={false}
            />
          )}

          {/* Floating Voice Control when inside active workspace */}
          {activeWorkspace !== 'home' && (
            <FloatingVoiceOrb
              activeWorkspaceName={activeWorkspace}
              onExpandToHome={() => setActiveWorkspace('home')}
            />
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}
