import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

// Enable CORS for Android APK (Capacitor/WebView) and external clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// High-capacity bridges support up to 50MB for kernel matrices and rules
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Shared Gemini client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    kernelBridge: '5.0.0-pure-bridge',
    hasApiKey: Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY'),
    timestamp: new Date().toISOString(),
  });
});

// In-memory Kernel State & Context Cache
interface ServerKernelContext {
  summaryContext: string;
  rules: string[];
  instructions: string[];
  updatedAt: string;
}

let globalInMemoryKernelContext: ServerKernelContext | null = {
  summaryContext: 'نواة الذكاء الذاتية المستقلة - المحرك المعرفي الشامل للتواصل المباشر مع المستخدم.',
  rules: [
    'الاستماع والتفاعل الصوتي والكتابي المباشر مع المستخدم من خلال النواة',
    'تقديم إجابات ذكية ودقيقة وشاملة بناءً على ما تحتويه النواة من معلومات وقواعد',
    'عدم إغلاق الميكروفون إلا بطلب صريح ومؤكد من المستخدم',
  ],
  instructions: [
    'أنت النواة الذكية القوية التي تدير المعرفة والذكاء، والتطبيق مجرد جسر نقي بينك وبين المستخدم.',
    'أجب دائماً بصوت النواة وبحكمة ووضوح.',
  ],
  updatedAt: new Date().toISOString(),
};

const sessionKernelContexts = new WeakMap<WebSocket, ServerKernelContext>();

// Dialectal Speech Control Resolver (Microphone mute & speech interrupt)
function resolveLocalControl(cleanText: string, utterance: string) {
  const norm = cleanText.trim().toLowerCase();

  if (/^(?:اسكت|اصمت|انكتم|اخرس|توقف\s+عن\s+الكلام|توقف\s+عن\s+التحدث|صمت|silent|shut\s+up|hush)$/i.test(norm)) {
    return {
      intent: 'INTENT_INTERRUPT_SPEECH',
      confidence: 1.0,
      parameters: { raw_utterance: utterance },
      ui_action: 'EXECUTE_SYSTEM_ACTION',
      assistant_response: 'أنا صامت ومستمع لأوامرك.',
      voice_spoken_text: '',
    };
  }

  if (/^(?:إغلاق\s+الميكروفون|اغلاق\s+الميكروفون|اغلق\s+المايك|إغلاق\s+المايك|انهاء\s+المكالمة|إنهاء\s+المكالمة|stop\s+mic|close\s+mic)$/i.test(norm)) {
    return {
      intent: 'INTENT_CLOSE_MIC',
      confidence: 1.0,
      parameters: { raw_utterance: utterance },
      ui_action: 'EXECUTE_SYSTEM_ACTION',
      assistant_response: 'تم إيقاف الميكروفون.',
      voice_spoken_text: '',
    };
  }

  return null;
}

// Resilient Gemini model invoker for text tasks
const exhaustedModels = new Map<string, number>();

async function generateGeminiContentWithFallback(contents: any, config?: any) {
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastError: any = null;
  const now = Date.now();

  for (const model of models) {
    const disabledUntil = exhaustedModels.get(model);
    if (disabledUntil && now < disabledUntil) {
      continue;
    }

    const sanitizedConfig = config ? { ...config } : {};
    if (sanitizedConfig.thinkingConfig) {
      delete sanitizedConfig.thinkingConfig;
    }

    try {
      return await ai.models.generateContent({
        model,
        contents,
        config: sanitizedConfig,
      });
    } catch (err: any) {
      lastError = err;
      if (err.status === 429 || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        exhaustedModels.set(model, now + 15 * 60 * 1000);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Dedicated Audio Gemini invoker for voice transcription
async function generateGeminiAudioContentWithFallback(contents: any, config?: any) {
  const audioModels = ['gemini-3.5-transcribe', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastError: any = null;
  const now = Date.now();

  for (const model of audioModels) {
    const disabledUntil = exhaustedModels.get(model);
    if (disabledUntil && now < disabledUntil) {
      continue;
    }

    const sanitizedConfig = config ? { ...config } : {};
    if (sanitizedConfig.thinkingConfig) {
      delete sanitizedConfig.thinkingConfig;
    }

    if (model.includes('transcribe')) {
      delete sanitizedConfig.responseMimeType;
      delete sanitizedConfig.responseSchema;
    }

    try {
      return await ai.models.generateContent({
        model,
        contents,
        config: sanitizedConfig,
      });
    } catch (err: any) {
      lastError = err;
      if (err.status === 429 || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        exhaustedModels.set(model, now + 15 * 60 * 1000);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Session Initialization endpoint: Caches extracted kernel context in-memory
app.post('/api/kernel/session-init', (req, res) => {
  const { summaryContext, rules = [], instructions = [], kernelName } = req.body;
  globalInMemoryKernelContext = {
    summaryContext: summaryContext || `النواة: ${kernelName || 'Kernel'} جاهزة للعمل.`,
    rules: Array.isArray(rules) ? rules : [],
    instructions: Array.isArray(instructions) ? instructions : [],
    updatedAt: new Date().toISOString(),
  };
  return res.json({
    status: 'initialized',
    message: 'Kernel context synchronized in-memory',
    context: globalInMemoryKernelContext,
  });
});

// Primary Kernel Dialogue & NLU Endpoint:
// Pure Bridge - transmits any question, chat, or request directly to the Kernel!
app.post('/api/nlu/parse-intent', async (req, res) => {
  const { utterance = '', kernelContext } = req.body;
  const cleanText = (utterance || '').trim();

  if (!cleanText) {
    return res.json({
      intent: 'INTENT_GENERAL_QUERY',
      confidence: 1.0,
      parameters: { target: 'empty', raw_utterance: '' },
      assistant_response: '',
      voice_spoken_text: '',
    });
  }

  // 1. Immediate local control check (mute / interrupt)
  const localControl = resolveLocalControl(cleanText, utterance);
  if (localControl) {
    return res.json(localControl);
  }

  // 2. Transmit directly to the Kernel
  try {
    const activeRules = kernelContext?.rules || globalInMemoryKernelContext?.rules || [];
    const activeInstructions = kernelContext?.instructions || globalInMemoryKernelContext?.instructions || [];
    const activeSummary = kernelContext?.summaryContext || globalInMemoryKernelContext?.summaryContext || '';

    const kernelRulesList = activeRules.map((r: string) => `- ${r}`).join('\n');
    const kernelInstructionsList = activeInstructions.map((i: string) => `- ${i}`).join('\n');

    const prompt = `أنت النواة الذكية القوية المستقلة.
أنت من يمتلك العقل والمعرفة الكاملة، والتطبيق مجرد جسر نقي وشفيف بينك وبين المستخدم لنقل الصوت والكتابة.
مهما كان ما يطلبه المستخدم (سؤال، محادثة، شرح، برمجة، فكرة، قصة، تحليل، رسم أو تصميم أو أي موضوع): أجب عليه مباشرة كعقل النواة بكل ذكاء وعمق ولباقة.
لا تفتح أي ملفات خارجية ولا تدعِ وجود شاشات قديمة؛ أجب في "assistant_response" بإجابتك الكاملة والمفيدة بالعربية.

قواعد النواة المحملة:
${kernelRulesList || '- النواة الذاتية جاهزة للإجابة والتفاعل التام.'}

تعليمات النواة المحملة:
${kernelInstructionsList || '- التحدث والتفاعل المباشر مع المستخدم كصوت وعقل النواة.'}

سياق النواة المعرفي:
"${activeSummary}"

كلام المستخدم:
"${utterance}"

المطلوب:
1. في "assistant_response": إجابة النواة الشاملة والذكية بالعربية.
2. في "voice_spoken_text": عبارة صوتية مقتضبة وسلسة (أقل من 10 كلمات) تنطق كصوت النواة للمستخدم.

أعد كائن JSON دقيق بالصيغة:
{
  "intent": "INTENT_GENERAL_QUERY",
  "confidence": 0.98,
  "parameters": {
    "raw_utterance": "${utterance}"
  },
  "assistant_response": "إجابة النواة الذكية الشاملة",
  "voice_spoken_text": "عبارة النواة الصوتية المقتضبة"
}`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Kernel Bridge Timeout')), 8000)
    );

    const callPromise = generateGeminiContentWithFallback(prompt, {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          parameters: {
            type: Type.OBJECT,
            properties: {
              raw_utterance: { type: Type.STRING },
            },
          },
          assistant_response: { type: Type.STRING },
          voice_spoken_text: { type: Type.STRING },
        },
        required: ['intent', 'confidence', 'assistant_response', 'voice_spoken_text'],
      },
    });

    const response = await Promise.race([callPromise, timeoutPromise]);
    const parsed = JSON.parse(response.text || '{}');
    parsed.intent = 'INTENT_GENERAL_QUERY';

    return res.json(parsed);
  } catch (err: any) {
    console.warn('[KernelBridge] Direct response notice:', err.message);
    return res.json({
      intent: 'INTENT_GENERAL_QUERY',
      confidence: 0.9,
      parameters: { raw_utterance: utterance },
      assistant_response: `[النواة]: استلمت رسالتك "${cleanText}". أنا متصلة بك عبر جسور الربط وجاهزة لمساعدتك دائماً.`,
      voice_spoken_text: 'النواة استلمت رسالتك وهي معك دائماً.',
    });
  }
});

function createWavFromPcm(pcmBuffer: Buffer, sampleRate: number = 16000): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

// Audio Processing Pipeline
async function processAudioWithGemini(
  audioBase64: string,
  mimeType: string = 'audio/wav',
  contextOverride?: string
) {
  if (!audioBase64 || audioBase64.length < 300) {
    return { transcript: '', intent: 'INTENT_GENERAL_QUERY', assistant_response: '', voice_spoken_text: '' };
  }

  const cleanMime = (mimeType || 'audio/wav').split(';')[0].trim();
  const audioPart = {
    inlineData: {
      mimeType: cleanMime,
      data: audioBase64,
    },
  };

  // Step 1: Ultra-Fast Audio Transcription (~350ms)
  let transcript = '';
  try {
    const transcribePromise = generateGeminiAudioContentWithFallback(
      {
        parts: [
          audioPart,
          { text: 'Transcribe the spoken Arabic or English audio precisely. Return ONLY the verbatim words spoken. If silent, noise, or unintelligible, return empty text.' },
        ],
      },
      {}
    );

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Audio transcribe timeout')), 4500)
    );

    const transcribeRes = await Promise.race([transcribePromise, timeoutPromise]);
    transcript = (transcribeRes.text || '').replace(/[\r\n]+/g, ' ').trim();
  } catch (err: any) {
    console.warn('[AudioBridge] Transcribe notice:', err.message);
  }

  if (!transcript || transcript.length < 2) {
    return {
      transcript: '',
      intent: 'INTENT_GENERAL_QUERY',
      confidence: 0,
      assistant_response: '',
      voice_spoken_text: '',
    };
  }

  const cleanText = transcript.trim().toLowerCase();

  // Step 2: Instant Local Control (mute / interrupt)
  const localControl = resolveLocalControl(cleanText, transcript);
  if (localControl) {
    return {
      transcript,
      ...localControl,
    };
  }

  // Step 3: Fast Text Query to Kernel (~250ms)
  try {
    const activeContext = contextOverride || globalInMemoryKernelContext?.summaryContext || '';
    const kernelRulesList = (globalInMemoryKernelContext?.rules || []).map((r: string) => `- ${r}`).join('\n');
    const kernelInstructionsList = (globalInMemoryKernelContext?.instructions || []).map((i: string) => `- ${i}`).join('\n');

    const prompt = `أنت النواة الذكية القوية المستقلة. التطبيق مجرد جسر لنقل الصوت والكلام بينك وبين المستخدم.
سياق النواة: "${activeContext}"
قواعد النواة:
${kernelRulesList}
تعليمات النواة:
${kernelInstructionsList}

المستخدم قال صوتياً: "${transcript}"

المطلوب إجابة مباشرة وذكية كصوت النواة بالعربية:
- "assistant_response": إجابة النواة الشاملة والمفيدة.
- "voice_spoken_text": عبارة صوتية مقتضبة جداً وسلسة (أقل من 10 كلمات) تنطق كصوت النواة للمستخدم.

أعد JSON:
{
  "assistant_response": "إجابة النواة الذكية",
  "voice_spoken_text": "عبارة صوتية مقتضبة"
}`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('NLU timeout')), 3500)
    );

    const textRes = await Promise.race([
      generateGeminiContentWithFallback(prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            assistant_response: { type: Type.STRING },
            voice_spoken_text: { type: Type.STRING },
          },
          required: ['assistant_response', 'voice_spoken_text'],
        },
      }),
      timeoutPromise,
    ]);

    const parsed = JSON.parse(textRes.text || '{}');
    return {
      transcript,
      intent: 'INTENT_GENERAL_QUERY',
      confidence: 0.98,
      assistant_response: parsed.assistant_response || 'أنا استمع إليك وجاهز دائماً.',
      voice_spoken_text: parsed.voice_spoken_text || 'أنا أستمع إليك وجاهز للمساعدة.',
    };
  } catch (err: any) {
    return {
      transcript,
      intent: 'INTENT_GENERAL_QUERY',
      confidence: 0.9,
      assistant_response: `[النواة]: سمعت صوتك "${transcript}". النواة متصلة بك ومستعدة لأوامرك.`,
      voice_spoken_text: 'النواة استلمت صوتك وجاهزة لأوامرك.',
    };
  }
}

// Text-to-Speech (TTS) synthesizer
async function generateTTSAudio(text: string, voiceName: string = 'Kore'): Promise<string | null> {
  if (!text || !apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;

  const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];

  for (const model of ttsModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
            },
          },
        },
      });
      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (data) return data;
    } catch (err: any) {
      if (err.status === 429 || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        continue;
      }
    }
  }

  return null;
}

// WebSocket Server for High-Speed Bi-directional Audio Streaming
const wss = new WebSocketServer({ server, path: '/api/voice/stream' });

wss.on('connection', (ws: WebSocket) => {
  let sessionPcmChunks: Buffer[] = [];
  let clientSampleRate = 16000;

  ws.on('message', async (data: any, isBinary: boolean) => {
    if (isBinary) {
      sessionPcmChunks.push(Buffer.from(data));
      return;
    }

    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'init_kernel_context') {
        const ctx: ServerKernelContext = {
          summaryContext: msg.summaryContext || '',
          rules: Array.isArray(msg.rules) ? msg.rules : [],
          instructions: Array.isArray(msg.instructions) ? msg.instructions : [],
          updatedAt: new Date().toISOString(),
        };
        sessionKernelContexts.set(ws, ctx);
        if (!globalInMemoryKernelContext) {
          globalInMemoryKernelContext = ctx;
        }
        ws.send(JSON.stringify({ type: 'kernel_context_ready' }));
        return;
      } else if (msg.type === 'start') {
        sessionPcmChunks = [];
        if (msg.sampleRate) clientSampleRate = msg.sampleRate;
        ws.send(JSON.stringify({ type: 'session_ready' }));
      } else if (msg.type === 'audio_chunk' && msg.audioBase64) {
        sessionPcmChunks.push(Buffer.from(msg.audioBase64, 'base64'));
      } else if (msg.type === 'end_utterance') {
        let base64Audio = msg.audioBase64 || '';

        if (!base64Audio && sessionPcmChunks.length > 0) {
          const pcmBuffer = Buffer.concat(sessionPcmChunks);
          sessionPcmChunks = [];
          if (pcmBuffer.length >= 2400) {
            const wavBuffer = createWavFromPcm(pcmBuffer, clientSampleRate);
            base64Audio = wavBuffer.toString('base64');
          }
        } else {
          sessionPcmChunks = [];
        }

        if (!base64Audio || base64Audio.length < 300) {
          ws.send(JSON.stringify({ type: 'empty' }));
          return;
        }

        const sessionCtx =
          sessionKernelContexts.get(ws)?.summaryContext ||
          globalInMemoryKernelContext?.summaryContext;

        const result = await processAudioWithGemini(base64Audio, 'audio/wav', sessionCtx);

        if (!result.transcript || !result.transcript.trim()) {
          ws.send(JSON.stringify({ type: 'empty' }));
          return;
        }

        ws.send(JSON.stringify({
          type: 'result',
          transcript: result.transcript,
          intent: result.intent,
          confidence: result.confidence,
          assistant_response: result.assistant_response,
          voice_spoken_text: result.voice_spoken_text,
          hasAudioResponse: false,
        }));
      }
    } catch (err: any) {
      console.warn('WS message notice:', err.message);
    }
  });

  ws.on('close', () => {
    sessionPcmChunks = [];
  });
});

// Audio Processing HTTP fallback endpoint
app.post('/api/voice/process-audio', async (req, res) => {
  const { audioBase64, mimeType = 'audio/wav', kernelContext } = req.body;
  if (!audioBase64 || audioBase64.length < 300) {
    return res.json({
      transcript: '',
      intent: 'INTENT_GENERAL_QUERY',
      confidence: 0,
      assistant_response: '',
      voice_spoken_text: '',
    });
  }

  const contextToUse = kernelContext || globalInMemoryKernelContext?.summaryContext;
  const result = await processAudioWithGemini(audioBase64, mimeType, contextToUse);
  return res.json(result);
});

// Gemini Text-To-Speech (TTS)
app.post('/api/tts', async (req, res) => {
  const { text, voice = 'Kore' } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text required' });
  }

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return res.status(200).json({ fallback: true, message: 'Using client Web Speech synthesis' });
  }

  try {
    const audioBase64 = await generateTTSAudio(text, voice);
    if (audioBase64) {
      return res.json({ audioBase64, mimeType: 'audio/wav', fallback: false });
    }
    return res.json({ fallback: true, message: 'Using client Web Speech synthesis fallback' });
  } catch (err: any) {
    return res.json({ fallback: true, error: err.message });
  }
});

// Setup Vite or static serving
async function setupApp() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[THE KERNEL BRIDGE] Pure Bridge Server listening on port ${PORT}`);
  });
}

setupApp().catch((err) => {
  console.error('[THE KERNEL BRIDGE] Startup failed:', err);
});
