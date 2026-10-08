import React, { useEffect, useState, useCallback } from 'react';
import {
  WorkspaceType,
  BoundKernel,
  CallStatus,
} from './types/kernel';
import { audioEngine } from './services/audioEngine';
import { parseUtterance, requestTTSAudio } from './services/intentParser';
import { StorageEngine } from './services/storageEngine';

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

export default function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceType>('home');
  const [callStatus, setCallStatus] = useState<CallStatus>(audioEngine.getStatus());

  // Transcripts & Assistant Replies
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [isInterim, setIsInterim] = useState<boolean>(false);
  const [lastAssistantResponse, setLastAssistantResponse] = useState<string>('');
  const [activeActionNotice, setActiveActionNotice] = useState<{ name: string; workspace: string } | null>(null);

  // Bound Kernel State
  const [boundKernel, setBoundKernel] = useState<BoundKernel | null>(() =>
    StorageEngine.loadBoundKernel()
  );

  // Apply Intent to Router
  const applyIntentRouting = useCallback((intent: string, responseText?: string, spokenText?: string) => {
    if (responseText || spokenText) {
      setLastAssistantResponse(responseText || spokenText || '');
    }

    if (intent === 'INTENT_CLOSE_MIC') {
      audioEngine.safeStopMicrophone();
      setLastAssistantResponse('تم إيقاف الميكروفون وحفظ طاقة النواة.');
      return;
    }

    if (intent === 'INTENT_TEACH_KERNEL') {
      setActiveActionNotice({ name: 'صفحة تعليم وتدريب النواة', workspace: 'kernel_trainer' });
      setActiveWorkspace('kernel_trainer');
    } else if (intent === 'INTENT_BUILD_APP') {
      setActiveActionNotice({ name: 'صفحة بناء وتطوير التطبيقات', workspace: 'app_builder' });
      setActiveWorkspace('app_builder');
    } else if (intent === 'INTENT_GENERATE_IMAGE') {
      setActiveActionNotice({ name: 'استوديو توليد وتصميم الصور', workspace: 'image_generator' });
      setActiveWorkspace('image_generator');
    } else if (intent === 'INTENT_CREATE_GAME') {
      setActiveActionNotice({ name: 'استوديو صناعة وبرمجة الألعاب', workspace: 'game_builder' });
      setActiveWorkspace('game_builder');
    } else if (intent === 'INTENT_CREATE_MEDIA') {
      setActiveActionNotice({ name: 'استوديو إنتاج الفيديو والصوت', workspace: 'media_studio' });
      setActiveWorkspace('media_studio');
    } else if (intent === 'INTENT_CONNECT_GITHUB') {
      setActiveActionNotice({ name: 'ربط منصة جيت هب', workspace: 'github_bridge' });
      setActiveWorkspace('github_bridge');
    } else if (intent === 'INTENT_CONNECT_SUPABASE') {
      setActiveActionNotice({ name: 'ربط قواعد بيانات سوبابيس', workspace: 'supabase_bridge' });
      setActiveWorkspace('supabase_bridge');
    } else if (intent === 'INTENT_LINK_KERNEL') {
      setActiveActionNotice({ name: 'ربط ملف النواة من الهاتف', workspace: 'kernel_linker' });
      setActiveWorkspace('kernel_linker');
    } else {
      // General Query / Knowledge test / Chat: stay on home and converse!
      setActiveActionNotice(null);
    }
  }, []);

  // Autonomous Intent Processing via Voice or Text Chat Box
  const processIntentExecution = useCallback(
    async (utteranceText: string) => {
      if (!utteranceText.trim()) return;

      setCurrentTranscript(utteranceText.trim());
      const parsed = await parseUtterance(utteranceText);
      applyIntentRouting(parsed.intent, parsed.assistant_response, parsed.voice_spoken_text);

      // Voice TTS feedback
      if (parsed.voice_spoken_text) {
        const base64Wav = await requestTTSAudio(parsed.voice_spoken_text);
        if (base64Wav) {
          await audioEngine.playTTSAudioBase64(base64Wav);
        } else {
          await audioEngine.playFallbackSpeech(parsed.voice_spoken_text);
        }
      }
    },
    [applyIntentRouting]
  );

  // Audio Engine Lifecycle Listeners
  useEffect(() => {
    const unsubStatus = audioEngine.subscribeStatus((st) => setCallStatus(st));

    const unsubTranscript = (text: string, isFinal: boolean) => {
      setCurrentTranscript(text);
      setIsInterim(!isFinal);
    };

    const unsubResult = (res: any) => {
      if (res.transcript) {
        setCurrentTranscript(res.transcript);
      }
      if (res.assistant_response || res.voice_spoken_text) {
        setLastAssistantResponse(res.assistant_response || res.voice_spoken_text || '');
      }
      if (res.intent) {
        applyIntentRouting(res.intent, res.assistant_response, res.voice_spoken_text);
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
      fetch('/api/kernel/session-init', {
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
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-arabic select-none selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Main Viewport */}
      <main className="flex-1 flex flex-col">
        {/* Pure Clean Minimalist Voice & Chat Launcher */}
        {activeWorkspace === 'home' && (
          <CentralCallOrb
            onQuickIntent={processIntentExecution}
            currentTranscript={currentTranscript}
            isInterimTranscript={isInterim}
            boundKernel={boundKernel}
            lastAssistantResponse={lastAssistantResponse}
            activeActionNotice={activeActionNotice}
            onOpenWorkspace={(ws) => setActiveWorkspace(ws as WorkspaceType)}
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
          <AppBuilderView onBackToHome={() => setActiveWorkspace('home')} />
        )}

        {/* 3. Image Generator Studio */}
        {activeWorkspace === 'image_generator' && (
          <ImageGeneratorView onBackToHome={() => setActiveWorkspace('home')} />
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
            autoOpenFilePicker={true}
          />
        )}
      </main>
    </div>
  );
}
