export interface StatusData {
  database: string;
  ai: string;
}

export interface DistrictData {
  leader: { name?: string; party?: string; designation?: string; since?: string; note?: string };
  population: { total?: number; rural?: number; urban?: number; density?: string; literacy?: string; sex_ratio?: string; male?: number; female?: number };
  demographics: { label: string; percent: number; color?: string; count?: number }[];
  headlines: string[];
  census?: Record<string, number>;
  source?: string;
}

export interface StrategyResult {
  ai_prediction: string;
  metrics: { positive: number; negative: number; overall: number };
  support: { group: string; reason: string }[];
  resistance: { group: string; reason: string }[];
  demography: string;
  summary: string;
  roadmap: string[];
  graph_data: { nodes: GraphNode[]; links: GraphLink[] };
  db_context?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: number;
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  label?: string;
}

export interface NewsItem {
  title: string;
  description?: string;
  link: string;
  pubDate?: string;
  image_url?: string;
  source_id?: string;
}

export type TabId =
  | 'home'
  | 'map'
  | 'dashboard'
  | 'booth'
  | 'strategy'
  | 'ai-search'
  | 'social'
  | 'election-watch'
  | 'palette-lab';
