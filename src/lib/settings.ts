export type ScoringWeights = {
  relevance: number;
  views: number;
  engagement: number;
  consistency: number;
  recency: number;
  audience: number;
};

export const DEFAULT_WEIGHTS: ScoringWeights = {
  relevance: 30,
  views: 20,
  engagement: 20,
  consistency: 15,
  recency: 10,
  audience: 5,
};

export type ProviderFlags = {
  mtproto: boolean;
  directory: boolean;
  demo: boolean;
};

export const DEFAULT_PROVIDERS: ProviderFlags = {
  mtproto: true,
  directory: true,
  demo: true,
};
