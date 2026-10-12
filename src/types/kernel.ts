export type CallStatus =
  | 'IDLE'
  | 'STARTING'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'BARGE_IN'
  | 'STOPPING';

export interface BoundKernel {
  fileName: string;
  fileSize: number;
  bindTimestamp: string;
  name: string;
  version: string;
  instructions: string[];
  rules: string[];
  rawContent?: string;
  isActive: boolean;
}

export interface IntentResult {
  intent: string;
  confidence: number;
  parameters: Record<string, any>;
  ui_action?: string;
  assistant_response: string;
  voice_spoken_text: string;
  imageUrl?: string;
}

export interface AudioEngineMetrics {
  sampleRate: number;
  bufferSize: number;
  vadState: 'SPEECH' | 'SILENCE';
  bargeInLatencyMs: number;
  roundtripLatencyMs: number;
  activeVoiceProfile: string;
}

export interface ProjectFile {
  name: string;
  path: string;
  content: string;
  size?: number;
  isBinary?: boolean;
}

export interface KernelMemoryLog {
  id: string;
  timestamp: string;
  category: 'INSTRUCTION' | 'RULE' | 'OBSERVATION' | 'LEARNED_BEHAVIOR';
  content: string;
  importance: number;
}
