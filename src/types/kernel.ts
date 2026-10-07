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
  | 'INTENT_CLOSE_MIC'
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

export interface IntentParameters {
  target?: string;
  raw_utterance: string;
  [key: string]: any;
}

export interface IntentResult {
  intent: IntentEnum | string;
  confidence: number;
  parameters: IntentParameters;
  ui_action: UIAction | string;
  assistant_response: string;
  voice_spoken_text: string;
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
