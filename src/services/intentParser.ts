import { IntentResult } from '../types/kernel';

/**
 * High-Speed Arabic Text Normalizer:
 * Strips tashkeel (diacritics), unifies alef, teh marbuta, ya, and removes punctuation.
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\u0640/g, '')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()؟?،!«»"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Local immediate controls (only microphone and speech controls are handled locally in 0ms)
const CLOSE_MIC_REGEX = /^(?:اغلاق (?:ال)?مايك(?:روفون)?|اطف[يئ] (?:ال)?مايك(?:روفون)?|انهاء (?:ال)?مكالم[هة]|اقفل (?:ال)?مايك(?:روفون)?|اغلق (?:ال)?مايك|close mic|mute mic|stop mic)$/i;
const INTERRUPT_SPEECH_REGEX = /^(?:اسكت|اصمت|انكتم|اخرس|توقف عن الكلام|توقف عن التحدث|صمت|silent|shut up|hush)$/i;

/**
 * Synchronous local control check: Only for interrupting speech or turning off microphone.
 * All other questions, commands, chats, images, and conversations flow 100% to the Kernel.
 */
export function checkQuickIntent(utterance: string): IntentResult | null {
  const norm = normalizeArabic(utterance);
  if (!norm) return null;

  if (CLOSE_MIC_REGEX.test(norm)) {
    return {
      intent: 'INTENT_CLOSE_MIC',
      confidence: 1.0,
      parameters: { raw_utterance: utterance },
      assistant_response: 'تم إيقاف الميكروفون وحفظ طاقة النواة.',
      voice_spoken_text: '',
    };
  }

  if (INTERRUPT_SPEECH_REGEX.test(norm)) {
    return {
      intent: 'INTENT_INTERRUPT_SPEECH',
      confidence: 1.0,
      parameters: { raw_utterance: utterance },
      assistant_response: 'أنا صامت ومستمع للنواة ولك.',
      voice_spoken_text: '',
    };
  }

  // All other utterances flow directly to the Kernel!
  return null;
}

/**
 * Primary Bridge Entry Point:
 * Transparently sends the user query directly to the Kernel through the multi-bridge pipeline.
 */
export async function parseUtterance(
  utterance: string,
  signal?: AbortSignal,
  kernelContext?: any
): Promise<IntentResult> {
  const clean = utterance.trim();
  if (!clean) {
    return {
      intent: 'INTENT_GENERAL_QUERY',
      confidence: 1.0,
      parameters: { target: 'empty', raw_utterance: '' },
      assistant_response: '',
      voice_spoken_text: '',
    };
  }

  // Immediate local speech control check
  const quick = checkQuickIntent(clean);
  if (quick) return quick;

  // Pass directly through the high-capacity Multi-Bridge Pipeline to the Kernel
  const { MultiKernelBridgePipeline } = await import('./multiBridgePipeline');
  return await MultiKernelBridgePipeline.queryKernel(clean, kernelContext || null, signal);
}

/**
 * Request natural voice speech from TTS
 */
export async function requestTTSAudio(text: string): Promise<string | null> {
  try {
    const { getApiUrl } = await import('./apiConfig');
    const res = await fetch(getApiUrl('/api/tts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.audioBase64) return data.audioBase64;
    }
  } catch (err) {
    console.warn('[TTS] TTS notice:', err);
  }
  return null;
}
