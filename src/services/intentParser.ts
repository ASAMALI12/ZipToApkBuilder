import { IntentResult, IntentEnum, UIAction } from '../types/kernel';

// Tier 1 Fast-Path Regex patterns
const CLOSE_MIC_REGEX = /^(إغلاق الميكروفون|اسكت|اغلق المايك|انكتم|stop mic|close mic|mute mic|shut up)$/i;
const BUILD_APP_REGEX = /(اندرويد|ايفون|ابني تطبيق|بناء تطبيق|تعال نبني|سويلي تطبيق|build app|make app|android|iphone)/i;
const GEN_IMAGE_REGEX = /(اريد انشاء صوره|انشاء صوره|سويلي صوره|اريد صناعة صورة|صمم صوره|ارسم|generate image|create picture)/i;
const CREATE_GAME_REGEX = /(اريد انشاء لعبه|انشاء لعبه|سوي لعبه|اصنع لعبه|بناء لعبه|العاب|make game|create game)/i;
const CREATE_MEDIA_REGEX = /(افتح صفحه انشاء فديو اوصوت|انشاء فديو|انشاء صوت|اصنع فديو|اصنع صوت|فيديو وصوت|video|audio)/i;
const CONNECT_GITHUB_REGEX = /(اربط بالكيت هب|اربط بجيت هب|ربط جيت هب|جيت هب|github)/i;
const CONNECT_SUPABASE_REGEX = /(اربط بالسوبابيس|اربط بسوبابيس|ربط سوبابيس|سوبابيس|supabase)/i;
const LINK_KERNEL_REGEX = /(دعنا نربط النوات|دعنا نربط النواة|اربط النواة|اربط النوات|ربط النواة|اختر النواة|ملف النواة|link kernel)/i;
const TEACH_KERNEL_REGEX = /(لنبدا تعليم النوات|لنبدا تعليم النواة|تعليم النواة|علم النواة|تدريب النواة|دردشة النواة|teach kernel)/i;

export async function parseUtterance(utterance: string): Promise<IntentResult> {
  const clean = utterance.trim();

  // Tier 1 Fast-Path Local Matching (Immediate sub-millisecond response)
  if (CLOSE_MIC_REGEX.test(clean)) {
    return {
      intent: 'INTENT_CLOSE_MIC',
      confidence: 1.0,
      parameters: { raw_utterance: clean },
      ui_action: 'EXECUTE_SYSTEM_ACTION',
      assistant_response: 'تم إيقاف الميكروفون وحفظ طاقة النواة.',
      voice_spoken_text: 'تم إيقاف الميكروفون.',
    };
  }

  if (BUILD_APP_REGEX.test(clean)) {
    return {
      intent: 'INTENT_BUILD_APP',
      confidence: 0.98,
      parameters: { target: 'app_builder', raw_utterance: clean },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'فتحت لك صفحة بناء وتطوير تطبيقات أندرويد وآيفون.',
      voice_spoken_text: 'تم فتح صفحة بناء التطبيقات.',
    };
  }

  if (GEN_IMAGE_REGEX.test(clean)) {
    return {
      intent: 'INTENT_GENERATE_IMAGE',
      confidence: 0.98,
      parameters: { target: 'image_generator', raw_utterance: clean },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تم فتح استوديو توليد وتصميم الصور الذكية.',
      voice_spoken_text: 'تم فتح صفحة توليد الصور.',
    };
  }

  if (CREATE_GAME_REGEX.test(clean)) {
    return {
      intent: 'INTENT_CREATE_GAME',
      confidence: 0.98,
      parameters: { target: 'game_builder', raw_utterance: clean },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تم فتح استوديو بناء وبرمجة الألعاب التفاعلية.',
      voice_spoken_text: 'تم فتح صفحة إنشاء الألعاب.',
    };
  }

  if (CREATE_MEDIA_REGEX.test(clean)) {
    return {
      intent: 'INTENT_CREATE_MEDIA',
      confidence: 0.98,
      parameters: { target: 'media_studio', raw_utterance: clean },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تم فتح استوديو إنتاج وتوليد الفيديو والأصوات.',
      voice_spoken_text: 'تم فتح صفحة الفيديو والصوت.',
    };
  }

  if (CONNECT_GITHUB_REGEX.test(clean)) {
    return {
      intent: 'INTENT_CONNECT_GITHUB',
      confidence: 0.98,
      parameters: { target: 'github_bridge', raw_utterance: clean },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تم فتح واجهة الربط مع منصة جيت هب (GitHub).',
      voice_spoken_text: 'تم فتح صفحة جيت هب.',
    };
  }

  if (CONNECT_SUPABASE_REGEX.test(clean)) {
    return {
      intent: 'INTENT_CONNECT_SUPABASE',
      confidence: 0.98,
      parameters: { target: 'supabase_bridge', raw_utterance: clean },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تم فتح واجهة الربط مع سوبابيس وقواعد البيانات.',
      voice_spoken_text: 'تم فتح صفحة سوبابيس.',
    };
  }

  if (LINK_KERNEL_REGEX.test(clean)) {
    return {
      intent: 'INTENT_LINK_KERNEL',
      confidence: 0.98,
      parameters: { target: 'kernel_linker', raw_utterance: clean },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'جاري فتح ملفات الهاتف لاختيار النواة وربطها بالمحرك مباشرة.',
      voice_spoken_text: 'جاري فتح ملفات لاختيار النواة.',
    };
  }

  if (TEACH_KERNEL_REGEX.test(clean)) {
    return {
      intent: 'INTENT_TEACH_KERNEL',
      confidence: 0.98,
      parameters: { target: 'kernel_trainer', raw_utterance: clean },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تم فتح صفحة تعليم النواة من خلال المايكروفون أو الدردشة.',
      voice_spoken_text: 'تم فتح صفحة تعليم النواة.',
    };
  }

  // Tier 2: Call Server Contextual Dialectal Classifier
  try {
    const res = await fetch('/api/nlu/parse-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utterance: clean }),
    });

    if (res.ok) {
      const data: IntentResult = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('[IntentParser] Remote NLU notice:', err);
  }

  return {
    intent: 'INTENT_GENERAL_QUERY',
    confidence: 0.85,
    parameters: { target: 'general', raw_utterance: clean },
    ui_action: 'ROUTE_PREDEFINED',
    assistant_response: `أدركت النواة طلبك: "${clean}". تفضل بإعطاء أمر لبناء تطبيق أو صورة أو لعبة أو ربط النواة.`,
    voice_spoken_text: 'أنا أستمع إليك، تفضل بأمرك.',
  };
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
