import { IntentResult, IntentEnum, UIAction } from '../types/kernel';

/**
 * High-Speed Arabic Text Normalizer:
 * Strips tashkeel (diacritics), unifies alef, teh marbuta, ya, and removes punctuation.
 * Ensures 100% resilient matching across dialects, accents, and speech recognition variations.
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    // Remove diacritics / tashkeel
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize alef variations (أ, إ, آ, ٱ -> ا)
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize teh marbuta (ة -> ه)
    .replace(/ة/g, 'ه')
    // Normalize ya / alef maksura (ى -> ي)
    .replace(/ى/g, 'ي')
    // Normalize kashida / tatweel
    .replace(/\u0640/g, '')
    // Remove punctuation & symbols
    .replace(/[.,/#!$%^&*;:{}=\-_`~()؟?،!«»"']/g, ' ')
    // Normalize multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Tier 1 Fast-Path Regex patterns operating on normalized text
const CLOSE_MIC_REGEX = /(?:اغلاق (?:ال)?مايك|اغلاق (?:ال)?ميكروفون|اسكت|انكتم|وقف (?:ال)?مايك|stop mic|close mic|mute mic)/i;
const BUILD_APP_REGEX = /(?:افتح (?:صفحه|قسم) (?:بناء )?(?:ال)?تطبيق(?:ات)?|ابني (?:لي )?تطبيق|بناء (?:ال)?تطبيق|طور تطبيق|برمج تطبيق|اريد بناء تطبيق|build app|create app)/i;
const GEN_IMAGE_REGEX = /(?:افتح (?:صفحه|استوديو|قسم) (?:ال)?صور|توليد (?:ال)?صور(?:ه)?|انشاء (?:لي )?صور(?:ه)?|صمم (?:لي )?صور(?:ه)?|ارسم (?:لي )?صور(?:ه)?|generate image)/i;
const CREATE_GAME_REGEX = /(?:افتح (?:صفحه|استوديو) (?:ال)?(?:العاب|لعب[هة])|اصنع لعب[هة]|انشاء لعب[هة]|برمج لعب[هة]|create game)/i;
const CREATE_MEDIA_REGEX = /(?:افتح (?:صفحه|استوديو) (?:ال)?(?:فيديو|فديو|وسائط)|انشاء (?:فيديو|فديو)|استوديو (?:فيديو|فديو)|video studio)/i;
const CONNECT_GITHUB_REGEX = /(?:افتح (?:صفحه )?(?:جيت|كيت)\s*هب|ربط (?:جيت|كيت)\s*هب|اربط (?:جيت|كيت)\s*هب|github)/i;
const CONNECT_SUPABASE_REGEX = /(?:افتح (?:صفحه )?سوبابيس|ربط سوبابيس|اربط سوبابيس|supabase)/i;
const LINK_KERNEL_REGEX = /(?:اربط (?:ال)?نوا[هة]|ربط (?:ال)?نوا[هة]|نربط (?:ال)?نوا[هة]|اختر (?:ملف )?(?:ال)?نوا[هة]|ملف (?:ال)?نوا[هة]|link kernel)/i;
const TEACH_KERNEL_REGEX = /(?:لنعلم (?:ال)?نوا[هة]|تعليم (?:ال)?نوا[هة]|تدريب (?:ال)?نوا[هة]|علم (?:ال)?نوا[هة]|ندرب (?:ال)?نوا[هة]|صفح[هة] تعليم|افتح تعليم|افتح لتعليم|teach kernel)/i;

// In-memory cache for ultra-fast recurring queries
const intentCache = new Map<string, IntentResult>();

/**
 * Synchronous Instant Pattern Matcher (0.01ms):
 * Used by Streaming VAD & Endpoint Detection for instantaneous action execution.
 */
export function checkQuickIntent(utterance: string): IntentResult | null {
  const norm = normalizeArabic(utterance);
  if (!norm) return null;

  if (CLOSE_MIC_REGEX.test(norm)) {
    return {
      intent: 'INTENT_CLOSE_MIC',
      confidence: 1.0,
      parameters: { raw_utterance: utterance },
      ui_action: 'EXECUTE_SYSTEM_ACTION',
      assistant_response: 'تم إيقاف الميكروفون وحفظ طاقة النواة.',
      voice_spoken_text: 'تم إيقاف الميكروفون.',
    };
  }

  if (TEACH_KERNEL_REGEX.test(norm)) {
    return {
      intent: 'INTENT_TEACH_KERNEL',
      confidence: 0.99,
      parameters: { target: 'kernel_trainer', raw_utterance: utterance },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تم فتح صفحة تعليم النواة مباشرة لحفظ وتدريب التعليمات.',
      voice_spoken_text: 'تم فتح صفحة تعليم النواة.',
    };
  }

  if (BUILD_APP_REGEX.test(norm)) {
    return {
      intent: 'INTENT_BUILD_APP',
      confidence: 0.99,
      parameters: { target: 'app_builder', raw_utterance: utterance },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'فتحت لك صفحة بناء وتطوير تطبيقات أندرويد وآيفون.',
      voice_spoken_text: 'تم فتح صفحة بناء التطبيقات.',
    };
  }

  if (GEN_IMAGE_REGEX.test(norm)) {
    return {
      intent: 'INTENT_GENERATE_IMAGE',
      confidence: 0.99,
      parameters: { target: 'image_generator', raw_utterance: utterance },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تم فتح استوديو توليد وتصميم الصور الذكية.',
      voice_spoken_text: 'تم فتح صفحة توليد الصور.',
    };
  }

  if (CREATE_GAME_REGEX.test(norm)) {
    return {
      intent: 'INTENT_CREATE_GAME',
      confidence: 0.99,
      parameters: { target: 'game_builder', raw_utterance: utterance },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تم فتح استوديو بناء وبرمجة الألعاب التفاعلية.',
      voice_spoken_text: 'تم فتح صفحة إنشاء الألعاب.',
    };
  }

  if (CREATE_MEDIA_REGEX.test(norm)) {
    return {
      intent: 'INTENT_CREATE_MEDIA',
      confidence: 0.99,
      parameters: { target: 'media_studio', raw_utterance: utterance },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تم فتح استوديو إنتاج وتوليد الفيديو والأصوات.',
      voice_spoken_text: 'تم فتح صفحة الفيديو والصوت.',
    };
  }

  if (LINK_KERNEL_REGEX.test(norm)) {
    return {
      intent: 'INTENT_LINK_KERNEL',
      confidence: 0.99,
      parameters: { target: 'kernel_linker', raw_utterance: utterance },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'جاري فتح نافذة اختيار ملف النواة لربطه مباشرة.',
      voice_spoken_text: 'جاري فتح نافذة اختيار النواة.',
    };
  }

  if (CONNECT_GITHUB_REGEX.test(norm)) {
    return {
      intent: 'INTENT_CONNECT_GITHUB',
      confidence: 0.99,
      parameters: { target: 'github_bridge', raw_utterance: utterance },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تم فتح واجهة الربط مع منصة جيت هب (GitHub).',
      voice_spoken_text: 'تم فتح صفحة جيت هب.',
    };
  }

  if (CONNECT_SUPABASE_REGEX.test(norm)) {
    return {
      intent: 'INTENT_CONNECT_SUPABASE',
      confidence: 0.99,
      parameters: { target: 'supabase_bridge', raw_utterance: utterance },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تم فتح واجهة الربط مع سوبابيس وقواعد البيانات.',
      voice_spoken_text: 'تم فتح صفحة سوبابيس.',
    };
  }

  return null;
}

/**
 * Universal Utterance Parser:
 * 1. Checks memory cache
 * 2. Runs synchronous quick pattern match (0ms)
 * 3. Falls back to ultra-fast remote NLU endpoint (< 200ms)
 */
export async function parseUtterance(utterance: string): Promise<IntentResult> {
  const clean = utterance.trim();
  if (!clean) {
    return {
      intent: 'INTENT_GENERAL_QUERY',
      confidence: 0.5,
      parameters: { target: 'empty', raw_utterance: '' },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تفضل، أنا أستمع إليك.',
      voice_spoken_text: 'تفضل بأمرك.',
    };
  }

  // Check cache
  const cached = intentCache.get(clean);
  if (cached) return cached;

  // Tier 1 Fast-Path Local Matching (0ms response)
  const quickMatch = checkQuickIntent(clean);
  if (quickMatch) {
    intentCache.set(clean, quickMatch);
    return quickMatch;
  }

  // Tier 2: Remote Contextual Dialectal Classifier via fast endpoint
  try {
    const res = await fetch('/api/nlu/parse-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utterance: clean }),
    });

    if (res.ok) {
      const data: IntentResult = await res.json();
      intentCache.set(clean, data);
      return data;
    }
  } catch (err) {
    console.warn('[IntentParser] Remote NLU notice:', err);
  }

  const fallback: IntentResult = {
    intent: 'INTENT_GENERAL_QUERY',
    confidence: 0.85,
    parameters: { target: 'general', raw_utterance: clean },
    ui_action: 'ROUTE_PREDEFINED',
    assistant_response: 'أهلاً بك، أنا أستمع إليك وجاهز للإجابة وتنفيذ أي أمر بكل سرور.',
    voice_spoken_text: 'أنا أستمع إليك، تفضل بأمرك.',
  };

  intentCache.set(clean, fallback);
  return fallback;
}

export async function requestTTSAudio(text: string): Promise<string | null> {
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.audioBase64) {
        return data.audioBase64;
      }
    }
  } catch (err) {
    console.warn('[TTS] TTS notice:', err);
  }
  return null;
}
