export type AiProvider = 'openrouter' | 'sakana';

export interface AiModel {
  id: string;
  label: string;
  provider: AiProvider;
  tier: 'best' | 'fast' | 'cheap';
  description: string;
}

export const AI_PROVIDER_CONFIG: Record<
  AiProvider,
  { baseUrl: string; apiKeyEnv: 'OPENROUTER_API_KEY' | 'SAKANA_API_KEY' }
> = {
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
  },
  sakana: {
    baseUrl: 'https://api.sakana.ai/v1',
    apiKeyEnv: 'SAKANA_API_KEY',
  },
};

export const AI_MODELS: AiModel[] = [
  {
    id: 'google/gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    provider: 'openrouter',
    tier: 'fast',
    description: 'Best value — fast, low-cost, strong at layout design and tool calls',
  },
  {
    id: 'fugu',
    label: 'Fugu',
    provider: 'sakana',
    tier: 'best',
    description: 'Sakana AI — strong reasoning for complex layout design and tool use',
  },
];

export const DEFAULT_AI_MODEL = AI_MODELS[0].id;

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  openrouter: 'OpenRouter',
  sakana: 'Sakana AI',
};

export const PROVIDER_ORDER: AiProvider[] = ['openrouter', 'sakana'];

export function getAiModel(modelId: string): AiModel | undefined {
  return AI_MODELS.find((m) => m.id === modelId);
}

/** Ensure persisted or client-provided model IDs map to a known model. */
export function resolveAiModel(model?: string | null): string {
  const candidate = model?.trim();
  if (candidate && AI_MODELS.some((m) => m.id === candidate)) {
    return candidate;
  }
  return DEFAULT_AI_MODEL;
}

export function resolveAiProvider(modelId: string): AiProvider {
  return getAiModel(resolveAiModel(modelId))?.provider ?? 'openrouter';
}

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
