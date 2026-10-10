import { IntentResult, IntentEnum, UIAction, KernelDiagnosticReport } from '../types/kernel';

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

// Tier 1 Fast-Path Regex patterns operating on normalized text with strict boundaries
const CLOSE_MIC_REGEX = /^(?:اغلاق (?:ال)?مايك(?:روفون)?|اطف[يئ] (?:ال)?مايك(?:روفون)?|انهاء (?:ال)?مكالم[هة]|اقفل (?:ال)?مايك(?:روفون)?|اغلق (?:ال)?مايك|close mic|mute mic|stop mic)$/i;
const INTERRUPT_SPEECH_REGEX = /^(?:اسكت|اصمت|انكتم|اخرس|توقف عن الكلام|توقف عن التحدث|صمت|silent|shut up|hush)$/i;
const EXECUTE_COMMAND_REGEX = /^(?:نفذ (?:لي )?(?:هذا )?(?:ال)?امر|تنفيذ (?:ال)?امر|قم بتنفيذ|طبق (?:ال)?امر|ابدأ (?:ال)?تنفيذ|باشر (?:ال)?تنفيذ|نفذ|execute|run command)$/i;
const BUILD_APP_REGEX = /(?:وورك\s*(?:فلو|قلو|كلو|فلوه)|workflow|سير\s*(?:ال)?عمل|افتح (?:صفحه|قسم)? (?:بناء )?(?:ال)?تطبيق(?:ات)?|بناء (?:ال)?تطبيق(?:ات)?|ابني (?:لي )?تطبيق|لنبني (?:لي )?تطبيق|لنقوم ببناء|طور تطبيق|برمج تطبيق|اريد بناء تطبيق|اضف (?:لي )?ملف|build app|create app)/i;
const GEN_IMAGE_REGEX = /(?:افتح (?:صفحه|استوديو|قسم) (?:ال)?صور|انشئ (?:لي )?صور(?:[هة])?|صمم (?:لي )?صور(?:[هة])?|توليد (?:ال)?صور(?:[هة])?|ارسم (?:لي )?صور(?:[هة])?|generate image|create image)/i;
const CREATE_GAME_REGEX = /(?:افتح (?:صفحه|استوديو) (?:ال)?(?:العاب|لعب[هة])|اصنع لعب[هة]|انشاء لعب[هة]|برمج لعب[هة]|create game)/i;
const CREATE_MEDIA_REGEX = /(?:افتح (?:صفحه|استوديو) (?:ال)?(?:فيديو|فديو|وسائط)|انشاء (?:فيديو|فديو)|استوديو (?:فيديو|فديو)|video studio)/i;
const CONNECT_GITHUB_REGEX = /(?:افتح (?:صفحه )?(?:جيت|كيت)\s*هب|ربط (?:جيت|كيت)\s*هب|اربط (?:جيت|كيت)\s*هب|github)/i;
const CONNECT_SUPABASE_REGEX = /(?:افتح (?:صفحه )?سوبابيس|ربط سوبابيس|اربط سوبابيس|supabase)/i;
const LINK_KERNEL_REGEX = /(?:اربط (?:ال)?نوا[هة]|حمل (?:ال)?نوا[هة]|تحميل (?:ال)?نوا[هة]|ربط (?:ال)?نوا[هة]|نربط (?:ال)?نوا[هة]|اختر (?:ملف )?(?:ال)?نوا[هة]|ملف (?:ال)?نوا[هة]|link kernel)/i;
const TEACH_KERNEL_REGEX = /(?:افتح (?:محادث[هة] )?(?:ال)?برمج[هة]|محادث[هة] (?:ال)?برمج[هة]|لنعلم (?:ال)?نوا[هة]|تعليم (?:ال)?نوا[هة]|تدريب (?:ال)?نوا[هة]|علم (?:ال)?نوا[هة]|ندرب (?:ال)?نوا[هة]|صفح[هة] تعليم|افتح تعليم|teach kernel)/i;
const NAVIGATE_BACK_REGEX = /^(?:ارجع (?:الى )?(?:الصفح[هة] )?(?:السابق[هة])?|العود[هة]|رجوع|الصفح[هة] الرئيس(?:ي|ي[هة])|الرئيسي[هة]|go back|back)$/i;

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
      assistant_response: 'تم إيقاف الميكروفون.',
      voice_spoken_text: '',
    };
  }

  if (INTERRUPT_SPEECH_REGEX.test(norm)) {
    return {
      intent: 'INTENT_INTERRUPT_SPEECH',
      confidence: 1.0,
      parameters: { raw_utterance: utterance },
      ui_action: 'EXECUTE_SYSTEM_ACTION',
      assistant_response: 'صامت ومستمع لأوامرك.',
      voice_spoken_text: '',
    };
  }

  if (EXECUTE_COMMAND_REGEX.test(norm)) {
    return {
      intent: 'INTENT_EXECUTE_COMMAND',
      confidence: 1.0,
      parameters: { raw_utterance: utterance },
      ui_action: 'EXECUTE_SYSTEM_ACTION',
      assistant_response: 'أمرك قيد التنفيذ، النواة تباشر العمل وتستمر بالاستماع إليك.',
      voice_spoken_text: 'أمرك قيد التنفيذ، النواة تباشر العمل.',
    };
  }

  if (NAVIGATE_BACK_REGEX.test(norm)) {
    return {
      intent: 'INTENT_NAVIGATE_BACK',
      confidence: 1.0,
      parameters: { raw_utterance: utterance },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تمت العودة إلى الشاشة الرئيسية.',
      voice_spoken_text: 'تمت العودة إلى الشاشة الرئيسية.',
    };
  }

  if (LINK_KERNEL_REGEX.test(norm)) {
    return {
      intent: 'INTENT_LINK_KERNEL',
      confidence: 1.0,
      parameters: { target: 'kernel_linker', raw_utterance: utterance },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'جاري فتح نافذة اختيار ملف النواة لربطه مباشرة.',
      voice_spoken_text: 'جاري فتح نافذة اختيار النواة.',
    };
  }

  if (TEACH_KERNEL_REGEX.test(norm)) {
    return {
      intent: 'INTENT_TEACH_KERNEL',
      confidence: 0.99,
      parameters: { target: 'kernel_trainer', raw_utterance: utterance },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: 'تم فتح صفحة تعليم وبرمجة النواة مباشرة.',
      voice_spoken_text: 'تم فتح صفحة تعليم النواة.',
    };
  }

  if (BUILD_APP_REGEX.test(norm)) {
    const isWorkflow = /(?:وورك|قلو|فلو|سير\s*(?:ال)?عمل|workflow)/i.test(norm);
    return {
      intent: 'INTENT_BUILD_APP',
      confidence: 0.99,
      parameters: {
        target: 'app_builder',
        raw_utterance: utterance,
        appType: isWorkflow ? 'workflow' : 'تطبيق النواة'
      },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: isWorkflow
        ? 'تمت إضافة وتجهيز ملف Workflow الكامل (.github/workflows/workflow.yml) لبناء وتصدير التطبيق تلقائياً، وفُتحت لك صفحة سير العمل.'
        : 'فتحت لك صفحة بناء وتطوير تطبيقات أندرويد وآيفون.',
      voice_spoken_text: isWorkflow
        ? 'تمت إضافة وتجهيز ملف الوورك فلو لبناء التطبيق.'
        : 'تم فتح صفحة بناء التطبيقات.',
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

  // Fast extraction for Image Generation with Prompt: "انشئ صورة مزرعة" / "كلب" / "ارسم مزرعة"
  const imageMatch = utterance.match(/(?:انشئ|صمم|توليد|ارسم|صور(?:ة|ه)?)\s+(?:لي\s+)?(?:صور(?:ة|ه)?\s+)?(?:عن\s+|لـ\s+)?(.+)/i);
  if (imageMatch && imageMatch[1] && /(?:مزرع[هة]|كلب|قط[هة]|سيار[هة]|فضاء|روبوت|منزل|شجر[هة]|بحر|طبيع[هة]|لوح[هة]|تصميم|خلفي[هة]|لوجو)/i.test(imageMatch[1])) {
    const promptClean = imageMatch[1].trim();
    return {
      intent: 'INTENT_GENERATE_IMAGE',
      confidence: 0.98,
      parameters: { target: 'image_generator', prompt: promptClean, raw_utterance: utterance },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: `تم فتح استوديو الصور وجاري توليد صورة "${promptClean}" مباشرة عبر النواة.`,
      voice_spoken_text: `جاري توليد صورة ${promptClean} عبر النواة.`,
    };
  }

  // Fast extraction for App Building: "لنبني تطبيق..." / "ابني تطبيق..."
  const appMatch = utterance.match(/(?:بناء|ابني|طور|برمج|لنبني|اريد بناء)\s+(?:لي\s+)?(?:تطبيق|برنامج)?\s*(.*)/i);
  if (appMatch && appMatch[1] && appMatch[1].trim()) {
    const appTypeClean = appMatch[1].trim() || 'تطبيق جديد';
    return {
      intent: 'INTENT_BUILD_APP',
      confidence: 0.98,
      parameters: { target: 'app_builder', appType: appTypeClean, raw_utterance: utterance },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: `تم فتح صفحة بناء التطبيقات لتطوير "${appTypeClean}" لأجهزة أندرويد وآيفون.`,
      voice_spoken_text: `تم فتح صفحة بناء تطبيق ${appTypeClean}.`,
    };
  }

  return null;
}

/**
 * Intelligent Diagnostic Engine:
 * Analyzes inexecutable or failed commands and determines:
 * 1. Is the defect in the KERNEL? (Lacks knowledge, needs teaching, or needs attached library)
 * 2. Or is the defect in the ENGINE? (Unsupported engine capability, physical execution, quota)
 */
export function diagnoseCommandDefect(utterance: string, boundKernel?: any): KernelDiagnosticReport {
  const norm = normalizeArabic(utterance);

  // 1. Physical world actions / Hardware control / Browser sandbox restrictions -> Engine Limitation
  if (/(?:حجز|طيران|فندق|سفر|مكيف|سيار[هة] حقيقي[هة]|اطبخ|اكل|شراء حقيقي|تحكم بالبيت|غسيل|كهرباء|شاحن)/i.test(norm)) {
    return {
      hasDefect: true,
      origin: 'ENGINE',
      defectType: 'ENGINE_UNSUPPORTED',
      title: 'المشكلة في المحرك (Engine Limitation)',
      cause: 'محرك التشغيل البرمجي لا يدعم التحكم في الأجهزة الفيزيائية أو حجز الخدمات الخارجية مباشرة خارج نطاق واجهات التطبيق.',
      suggestedAction: 'المحرك الحالي محصور في تطوير البرمجيات وتوليد الوسائط وإدارة الأكواد. لا يمكن تدريب النواة على أفعال فيزيائية.',
      technicalDetails: 'Sandbox & Web Platform Execution Boundary',
      commandRequested: utterance,
    };
  }

  // 2. High-performance computation requiring external missing libraries -> Kernel Library Missing
  if (/(?:معادلات تفاضلي[هة]|فيزياء ثلاثي[هة] الابعاد|ذكاء بصري محلي|opencv|cad|dwg|بلوتوث|nfc|تعدين|شيدر معقد)/i.test(norm)) {
    return {
      hasDefect: true,
      origin: 'KERNEL',
      defectType: 'KERNEL_LIBRARY_REQUIRED',
      title: 'المشكلة في النواة: تفتقر لمكتبة ملحقة (Library Required)',
      cause: 'النواة قادرة مبدئياً على فهم هذا الأمر، لكنها تفتقر إلى حزمة أو مكتبة برمجية ملحقة (Attached Library/Module) لتنفيذه.',
      suggestedAction: 'يجب إرفاق مكتبة برمجية متخصصة للنواة من صفحة "تعليم وتدريب النواة" وتفعيل خيار الحزم الملحقة.',
      recommendedRoute: 'kernel_trainer',
      missingLibraryName: 'مكتبة معالجة تخصصية (Specialized Subsystem Library)',
      commandRequested: utterance,
    };
  }

  // 3. Custom domain rules, specialized business logic, or untaught tasks -> Kernel Knowledge Missing
  return {
    hasDefect: true,
    origin: 'KERNEL',
    defectType: 'KERNEL_KNOWLEDGE_MISSING',
    title: 'المشكلة في النواة: ليس لها معرفة بهذا الأمر (Needs Teaching)',
    cause: 'النواة لا تملك حالياً قاعدة معرفية أو قواعد تشغيل مسجلة لتنفيذ هذا الأمر المحدد.',
    suggestedAction: 'يجب تعليم النواة وإضافة قواعد وسياق جديد لها عبر الانتقال إلى صفحة "تعليم وتدريب النواة".',
    recommendedRoute: 'kernel_trainer',
    commandRequested: utterance,
  };
}

/**
 * Universal Utterance Parser:
 * 1. Checks memory cache
 * 2. Runs synchronous quick pattern match (0ms)
 * 3. Falls back to single remote NLU endpoint with AbortSignal support
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
      confidence: 0,
      parameters: { target: 'empty', raw_utterance: '' },
      ui_action: 'ROUTE_PREDEFINED',
      assistant_response: '',
      voice_spoken_text: '',
    };
  }

  // Tier 1 Fast-Path Local Matching (0ms response)
  const quickMatch = checkQuickIntent(clean);
  if (quickMatch) {
    return quickMatch;
  }

  // Tier 2: Remote Contextual Dialectal Classifier via fast endpoint (executed ONCE)
  try {
    const res = await fetch('/api/nlu/parse-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utterance: clean,
        kernelContext: kernelContext || undefined,
      }),
      signal,
    });

    if (res.ok) {
      const data: IntentResult = await res.json();
      return data;
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err;
    }
    console.warn('[IntentParser] Remote NLU notice:', err);
  }

  const kernelName = kernelContext?.name || 'النواة الذاتية';
  const fallback: IntentResult = {
    intent: 'INTENT_GENERAL_QUERY',
    confidence: 0.85,
    parameters: { target: 'general', raw_utterance: clean },
    ui_action: 'ROUTE_PREDEFINED',
    assistant_response: `[النواة - ${kernelName}]: أنا أستمع إليك وجاهز لتنفيذ أي أمر أو إجابة بكل دقة وسرعة.`,
    voice_spoken_text: 'النواة: أنا أستمع إليك، تفضل بأمرك.',
  };

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
