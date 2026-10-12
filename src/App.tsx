import React, { useEffect, useState, useCallback } from 'react';
import { BoundKernel, CallStatus } from './types/kernel';
import { audioEngine } from './services/audioEngine';
import { StorageEngine } from './services/storageEngine';
import { getApiUrl } from './services/apiConfig';
import { CentralCallOrb } from './components/voice/CentralCallOrb';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export default function App() {
  const [callStatus, setCallStatus] = useState<CallStatus>(audioEngine.getStatus());

  // Transcripts & Assistant Replies
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [isInterim, setIsInterim] = useState<boolean>(false);
  const [lastAssistantResponse, setLastAssistantResponse] = useState<string>('');
  const [latestUserQuestion, setLatestUserQuestion] = useState<string>('');

  // Bound Kernel State
  const [boundKernel, setBoundKernel] = useState<BoundKernel | null>(() =>
    StorageEngine.loadBoundKernel()
  );

  // Direct Unified Intent Handling: purely updates dialogue between User and Kernel
  const applyIntentRouting = useCallback((
    intent: string,
    responseText?: string,
    spokenText?: string,
    rawUtterance?: string
  ) => {
    if (rawUtterance) {
      setLatestUserQuestion(rawUtterance);
    }

    if (responseText || spokenText) {
      setLastAssistantResponse(responseText || spokenText || '');
    }

    if (intent === 'INTENT_INTERRUPT_SPEECH') {
      audioEngine.interruptSpeech();
      setLastAssistantResponse('أنا صامت ومستمع لأوامرك.');
      return;
    }

    if (intent === 'INTENT_CLOSE_MIC') {
      audioEngine.interruptSpeech();
      audioEngine.safeStopMicrophone();
      setLastAssistantResponse('تم إيقاف الميكروفون وحفظ طاقة النواة.');
      return;
    }
  }, []);

  // Chat Submission: sends text through unified Multi-Bridge Pipeline to Kernel
  const processIntentExecution = useCallback(
    async (utteranceText: string) => {
      const clean = utteranceText.trim();
      if (!clean) return;

      setLatestUserQuestion(clean);
      setCurrentTranscript(clean);
      setLastAssistantResponse('');

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
      if (text.trim() && !isFinal) {
        setLatestUserQuestion(text.trim());
        setLastAssistantResponse('');
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
          res.transcript || res.parameters?.raw_utterance
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

  // Sync stored kernel with server session memory on startup
  useEffect(() => {
    const kernel = StorageEngine.loadBoundKernel();
    if (kernel) {
      fetch(getApiUrl('/api/kernel/session-init'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summaryContext: kernel.rawContent || (kernel.instructions ? kernel.instructions.join('\n') : ''),
          rules: kernel.rules || [],
          instructions: kernel.instructions || [],
          kernelName: kernel.name || 'النواة الذاتية',
        }),
      }).catch(() => {});
    }
  }, []);

  const handleBindKernel = (kernel: BoundKernel | null) => {
    setBoundKernel(kernel);
    StorageEngine.saveBoundKernel(kernel);
    if (kernel) {
      const confirmText = `تم ربط النواة "${kernel.name}" بنجاح (${kernel.rules?.length || 0} قواعد). التطبيق الآن جسر مفتوح مع النواة.`;
      setLastAssistantResponse(confirmText);
      audioEngine.speak(`تم ربط النواة ${kernel.name} بنجاح. أنا جاهز للحديث معك.`);
    } else {
      setLastAssistantResponse('تم فك ربط النواة. يرجى اختيار ملف نواة لتفعيل الاتصال.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-arabic select-none selection:bg-cyan-500/30 selection:text-cyan-200">
      <main className="flex-1 flex flex-col">
        <ErrorBoundary onReset={() => window.location.reload()}>
          <CentralCallOrb
            onQuickIntent={processIntentExecution}
            userQuestion={latestUserQuestion || currentTranscript}
            currentTranscript={currentTranscript}
            isInterimTranscript={isInterim}
            boundKernel={boundKernel}
            onBindKernel={handleBindKernel}
            lastAssistantResponse={lastAssistantResponse}
          />
        </ErrorBoundary>
      </main>
    </div>
  );
}
