export interface AiModel {
  id: string;
  label: string;
  provider: string;
  tier: 'best' | 'fast' | 'cheap';
  description: string;
}

export const AI_MODELS: AiModel[] = [
  {
    id: 'google/gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    provider: 'Google',
    tier: 'fast',
    description: 'Best value — fast, low-cost, strong at layout design and tool calls',
  },
];

export const DEFAULT_AI_MODEL = AI_MODELS[0].id;

/** Ensure persisted or client-provided model IDs are valid on OpenRouter. */
export function resolveAiModel(model?: string | null): string {
  const candidate = model?.trim();
  if (candidate && AI_MODELS.some((m) => m.id === candidate)) {
    return candidate;
  }
  return DEFAULT_AI_MODEL;
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
