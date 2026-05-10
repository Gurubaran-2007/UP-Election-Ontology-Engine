export interface StatusData {
  database: string;
  ai: string;
}

export interface ConstituencyResult {
  ls_id: string;
  ls_name: string;
  election_id?: string;
  winner?: string;
  party_id?: string;
  vote_share?: number | null;
  margin_pct?: number | null;
  margin_votes?: number | null;
  total_votes?: number | null;
  vidhan_sabha_segments?: { vs_id: string; name: string; reservation?: string }[];
}

export interface DistrictData {
  leader: { name?: string; party?: string; designation?: string; since?: string; note?: string };
  population: { total?: number; rural?: number; urban?: number; density?: string; literacy?: string; sex_ratio?: string; male?: number; female?: number };
  demographics: { label: string; percent: number; color?: string; count?: number }[];
  headlines: string[];
  census?: Record<string, number>;
  source?: string;
  constituencies?: ConstituencyResult[];
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
  | 'booth'
  | 'strategy'
  | 'ai-search'
  | 'social'
  | 'election-watch'
  | 'palette-lab';

// Map drill-down levels
export type MapLevel = 'india' | 'state' | 'district';

export interface MapSelection {
  level: MapLevel;
  stateCode?: string;      // e.g. 'UP'
  stateName?: string;      // e.g. 'Uttar Pradesh'
  districtName?: string;
}

// States that have district-level data
export const CONFIGURED_STATES: Record<string, { code: string; label: string }> = {
  'Uttar Pradesh': { code: 'UP', label: 'Uttar Pradesh' },
};
