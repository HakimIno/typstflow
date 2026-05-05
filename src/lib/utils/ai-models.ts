export interface AiModel {
  id: string;
  label: string;
  provider: string;
  tier: 'best' | 'fast' | 'cheap';
  description: string;
}

export const AI_MODELS: AiModel[] = [
  // OpenAI
  {
    id: 'openai/gpt-5',
    label: 'GPT-5',
    provider: 'OpenAI',
    tier: 'best',
    description: 'Top-tier general reasoning and agent capabilities',
  },
  {
    id: 'openai/gpt-5-mini',
    label: 'GPT-5 Mini',
    provider: 'OpenAI',
    tier: 'fast',
    description: 'Fast lightweight reasoning',
  },
  {
    id: 'openai/o3-pro',
    label: 'o3 Pro',
    provider: 'OpenAI',
    tier: 'best',
    description: 'Advanced deep reasoning for complex tasks',
  },

  // Google
  {
    id: 'google/gemini-3.1-pro',
    label: 'Gemini 3.1 Pro',
    provider: 'Google',
    tier: 'best',
    description: 'Strong multimodal reasoning and long-context processing',
  },
  {
    id: 'google/gemini-3.1-flash',
    label: 'Gemini 3.1 Flash',
    provider: 'Google',
    tier: 'fast',
    description: 'Ultra-fast inference with good reasoning',
  },

  // Anthropic
  {
    id: 'anthropic/claude-opus-4.6',
    label: 'Claude Opus 4.6',
    provider: 'Anthropic',
    tier: 'best',
    description: 'Excellent coding and deep analysis',
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    tier: 'fast',
    description: 'Balanced speed and reasoning',
  },
  // DeepSeek
  {
    id: 'deepseek/deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    provider: 'DeepSeek',
    tier: 'fast',
    description: 'Cost-efficient high-performance reasoning',
  },
  {
    id: 'alibaba/qwen-3.6',
    label: 'Qwen 3.6',
    provider: 'Alibaba',
    tier: 'fast',
    description: 'Strong multilingual reasoning',
  },
  {
    id: 'mistral/mistral-large-3',
    label: 'Mistral Large 3',
    provider: 'Mistral',
    tier: 'best',
    description: 'Enterprise-grade European LLM',
  },
  {
    id: 'z-ai/glm-5.1',
    label: 'GLM-5.1',
    provider: 'Z-ai',
    tier: 'best',
    description: 'Best for design task',
  },
  {
    id: 'z-ai/glm-5-turbo',
    label: 'GLM-5v Turbo',
    provider: 'Z-ai',
    tier: 'fast',
    description: 'Fast for design task',
  },

];

export const DEFAULT_AI_MODEL = 'google/gemini-3-pro-preview';

export const TIER_LABELS: Record<AiModel['tier'], string> = {
  best: 'Best',
  fast: 'Fast',
  cheap: 'Cheap',
};

export const TIER_COLORS: Record<AiModel['tier'], string> = {
  best: '#8B5CF6',
  fast: '#10B981',
  cheap: '#F59E0B',
};
