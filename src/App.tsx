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

  // Transcripts
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [isInterim, setIsInterim] = useState<boolean>(false);

  // Bound Kernel State
  const [boundKernel, setBoundKernel] = useState<BoundKernel | null>(() =>
    StorageEngine.loadBoundKernel()
  );

  // Apply Intent to Router
  const applyIntentRouting = useCallback((intent: string) => {
    if (intent === 'INTENT_CLOSE_MIC') {
      audioEngine.safeStopMicrophone();
      return;
    }
    if (intent === 'INTENT_BUILD_APP') {
      setActiveWorkspace('app_builder');
    } else if (intent === 'INTENT_GENERATE_IMAGE') {
      setActiveWorkspace('image_generator');
    } else if (intent === 'INTENT_CREATE_GAME') {
      setActiveWorkspace('game_builder');
    } else if (intent === 'INTENT_CREATE_MEDIA') {
      setActiveWorkspace('media_studio');
    } else if (intent === 'INTENT_CONNECT_GITHUB') {
      setActiveWorkspace('github_bridge');
    } else if (intent === 'INTENT_CONNECT_SUPABASE') {
      setActiveWorkspace('supabase_bridge');
    } else if (intent === 'INTENT_LINK_KERNEL') {
      setActiveWorkspace('kernel_linker');
    } else if (intent === 'INTENT_TEACH_KERNEL') {
      setActiveWorkspace('kernel_trainer');
    }
  }, []);

  // Manual / Quick-Chip Intent Processing & Router
  const processIntentExecution = useCallback(
    async (utteranceText: string) => {
      if (!utteranceText.trim()) return;

      const parsed = await parseUtterance(utteranceText);
      applyIntentRouting(parsed.intent);

      // Audio Response via TTS for manual chip triggers
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

  // Audio Engine Lifecycle
  useEffect(() => {
    const unsubStatus = audioEngine.subscribeStatus((st) => setCallStatus(st));

    const unsubTranscript = (text: string, isFinal: boolean) => {
      setCurrentTranscript(text);
      setIsInterim(!isFinal);
    };

    const unsubResult = (res: any) => {
      if (res.intent) {
        applyIntentRouting(res.intent);
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

  const handleBindKernel = (kernel: BoundKernel | null) => {
    setBoundKernel(kernel);
    StorageEngine.saveBoundKernel(kernel);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-arabic select-none selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Main Viewport */}
      <main className="flex-1 flex flex-col">
        {/* 1. Ultra-clean Minimalist Launcher (Empty canvas with Voice Call Button only) */}
        {activeWorkspace === 'home' && (
          <CentralCallOrb
            onQuickIntent={(phrase) => {
              setCurrentTranscript(phrase);
              processIntentExecution(phrase);
            }}
            currentTranscript={currentTranscript}
            isInterimTranscript={isInterim}
            boundKernel={boundKernel}
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

        {/* 9. Kernel Trainer (Voice & Chat training) */}
        {activeWorkspace === 'kernel_trainer' && (
          <KernelTrainerView
            boundKernel={boundKernel}
            onUpdateBoundKernel={handleBindKernel}
            onBackToHome={() => setActiveWorkspace('home')}
          />
        )}
      </main>

      {/* Persistent Floating Voice Widget (Shown when navigating other pages) */}
      {activeWorkspace !== 'home' && (
        <FloatingVoiceOrb
          onExpandToHome={() => setActiveWorkspace('home')}
          activeWorkspaceName={activeWorkspace}
        />
      )}
    </div>
  );
}
