export type CallStatus =
  | 'IDLE'
  | 'STARTING'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'BARGE_IN'
  | 'STOPPING';

export type IntentEnum =
  | 'INTENT_BUILD_APP'
  | 'INTENT_GENERATE_IMAGE'
  | 'INTENT_CREATE_GAME'
  | 'INTENT_CREATE_MEDIA'
  | 'INTENT_CONNECT_GITHUB'
  | 'INTENT_CONNECT_SUPABASE'
  | 'INTENT_LINK_KERNEL'
  | 'INTENT_TEACH_KERNEL'
  | 'INTENT_NAVIGATE_BACK'
  | 'INTENT_CLOSE_MIC'
  | 'INTENT_INTERRUPT_SPEECH'
  | 'INTENT_EXECUTE_COMMAND'
  | 'INTENT_UNKNOWN_DYNAMIC'
  | 'INTENT_GENERAL_QUERY';

export type UIAction = 'ROUTE_PREDEFINED' | 'GENERATE_DYNAMIC_UI' | 'EXECUTE_SYSTEM_ACTION';

export type WorkspaceType =
  | 'home'
  | 'app_builder'
  | 'image_generator'
  | 'game_builder'
  | 'media_studio'
  | 'github_bridge'
  | 'supabase_bridge'
  | 'kernel_linker'
  | 'kernel_trainer'
  | 'code_chat'
  | 'file_explorer'
  | 'generative_ui'
  | 'media_generator';

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

export type DiagnosticFaultOrigin = 'KERNEL' | 'ENGINE' | 'PERMISSION' | 'NETWORK' | 'NONE';

export type DiagnosticDefectType =
  | 'KERNEL_KNOWLEDGE_MISSING' // النواة ليس لها معرفة بهذا الأمر - يلزم تعليمها
  | 'KERNEL_LIBRARY_REQUIRED'  // النواة تفتقر إلى مكتبة مساعدة - يلزم إرفاق مكتبة
  | 'ENGINE_UNSUPPORTED'       // المحرك لا يدعم هذا الإجراء تقنياً
  | 'ENGINE_QUOTA_LIMIT'       // استنفاد حصة المحرك في الذكاء الاصطناعي
  | 'ENGINE_PERMISSION'        // نقص في صلاحيات النظام أو الميكروفون
  | 'NONE';

export interface KernelDiagnosticReport {
  hasDefect: boolean;
  origin: DiagnosticFaultOrigin; // 'KERNEL' (النواة) أو 'ENGINE' (المحرك)
  defectType: DiagnosticDefectType;
  title: string;              // عنوان التشخيص
  cause: string;              // سبب الخلل بالتفصيل
  suggestedAction: string;    // الإجراء والحل المقترح (تعليم النواة / إرفاق مكتبة / قيود المحرك)
  recommendedRoute?: WorkspaceType; // صفحة التوجيه المقترحة (مثل kernel_trainer أو app_builder)
  missingLibraryName?: string;
  commandRequested?: string;
  technicalDetails?: string;
}

export interface KernelAttachedLibrary {
  id: string;
  name: string;
  category: 'graphics' | 'audio' | 'data' | 'ai' | 'computation';
  version: string;
  isAttached: boolean;
  description: string;
}

export interface IntentParameters {
  target?: string;
  raw_utterance: string;
  prompt?: string;
  appType?: string;
  diagnostic?: KernelDiagnosticReport;
  [key: string]: any;
}

export interface IntentResult {
  intent: IntentEnum | string;
  confidence: number;
  parameters: IntentParameters;
  ui_action: UIAction | string;
  assistant_response: string;
  voice_spoken_text: string;
  diagnostic?: KernelDiagnosticReport;
  dynamic_schema?: DynamicUISchema;
  hasAudioResponse?: boolean;
}

export interface DynamicUIComponent {
  type:
    | 'code_editor'
    | 'terminal_preview'
    | 'voice_status_indicator'
    | 'metrics_gauge'
    | 'action_bar'
    | 'data_table'
    | 'key_value_stats';
  id?: string;
  title?: string;
  language?: string;
  initialCode?: string;
  defaultOutput?: string;
  status?: string;
  label?: string;
  metric?: string;
  value?: string | number;
  columns?: string[];
  rows?: string[][];
  items?: Array<{ key: string; value: string }>;
  actions?: Array<{ id: string; label: string; variant?: 'primary' | 'secondary' | 'danger' }>;
}

export interface DynamicUISchema {
  workspaceTitle: string;
  layout: 'split_view' | 'grid_3_col' | 'single_hero';
  description?: string;
  components: DynamicUIComponent[];
}

export interface AudioEngineMetrics {
  bargeInCount: number;
  lastBargeInLatencyMs: number;
  micEnergy: number; // 0 to 1
  outputEnergy: number; // 0 to 1
  sampleRate: number;
  dspConfig: {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
    channelCount: number;
  };
  gainRamping: {
    active: boolean;
    currentGain: number;
    lastRampType: 'RAMP_IN' | 'RAMP_OUT' | 'STEADY';
  };
}

export interface ProjectFile {
  name: string;
  path: string;
  content: string;
  size?: number;
  isBinary?: boolean;
}

export interface ASTIssue {
  file: string;
  line?: number;
  severity: 'error' | 'warning' | 'info';
  description: string;
  fixSuggestion: string;
}

export interface ASTPatch {
  file: string;
  originalSnippet: string;
  patchedSnippet: string;
  explanation: string;
}

export interface CodeInspectionResult {
  summary: string;
  issuesFound: ASTIssue[];
  patches: ASTPatch[];
  overallHealthScore: number;
}

export interface GitHubConfig {
  pat: string;
  username?: string;
  repoName?: string;
  isConnected: boolean;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
  buckets: {
    kernelBackups: string;
    projectFiles: string;
  };
  tables: {
    projects: string;
    kernelMemory: string;
  };
}

export interface KernelMemoryLog {
  id: string;
  timestamp: string;
  utterance: string;
  intent: IntentEnum | string;
  response: string;
  workspace: WorkspaceType | string;
}
