// ============================================
// Shared types for EACN Viz — mirrors EACN API models
// ============================================

// ── Task ────────────────────────────────────────────────────────────

export type TaskStatus = "unclaimed" | "bidding" | "awaiting_retrieval" | "completed" | "no_one_able";
export type TaskType = "normal" | "adjudication";
export type TaskLevel = "general" | "expert" | "expert_general" | "tool";
export type BidStatus = "pending" | "accepted" | "rejected" | "waiting" | "executing";

export interface Bid {
  agent_id: string;
  server_id: string;
  confidence: number;
  price: number;
  status: BidStatus;
}

export interface Adjudication {
  adjudicator_id: string;
  verdict: string;
  score: number;
}

export interface Result {
  agent_id: string;
  content: unknown;
  selected: boolean;
  adjudications: Adjudication[];
}

export interface HumanContact {
  allowed: boolean;
  contact_id?: string;
  timeout_s?: number;
}

export interface Task {
  id: string;
  status: TaskStatus;
  type: TaskType;
  initiator_id: string;
  server_id: string;
  domains: string[];
  content: Record<string, unknown>;
  budget: number;
  remaining_budget: number | null;
  deadline: string | null;
  parent_id: string | null;
  child_ids: string[];
  depth: number;
  max_depth: number;
  max_concurrent_bidders: number;
  bids: Bid[];
  results: Result[];
  budget_locked: boolean;
  level: TaskLevel;
  invited_agent_ids: string[];
  human_contact: HumanContact | null;
}

// ── Agent ───────────────────────────────────────────────────────────

export interface Skill {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AgentCard {
  agent_id: string;
  name: string;
  domains: string[];
  skills: Skill[];
  url: string;
  server_id: string;
  network_id: string;
  description: string;
  tier: string;
}

export interface AgentInfo extends AgentCard {
  reputation: number;
  balance: { available: number; frozen: number };
}

// ── Cluster ─────────────────────────────────────────────────────────

export interface ClusterMember {
  node_id: string;
  endpoint: string;
  domains: string[];
  status: string;
  last_seen: string;
  connected_agents: number;
}

export interface ClusterStatus {
  mode: string;
  local: {
    node_id: string;
    endpoint: string;
    domains: string[];
    status: string;
    version: string;
    joined_at: string;
  };
  members: ClusterMember[];
  member_count: number;
  online_count: number;
  seed_nodes: string[];
}

// ── Log ─────────────────────────────────────────────────────────────

export interface LogEntry {
  fn_name: string;
  args: Record<string, unknown>;
  result: unknown;
  timestamp: string;
  error: string | null;
  task_id: string | null;
  agent_id: string | null;
  server_id: string | null;
}

// ── Full state snapshot ─────────────────────────────────────────────

export interface NetworkSnapshot {
  tasks: Task[];
  agents: AgentInfo[];
  cluster: ClusterStatus | null;
  logs: LogEntry[];
  connected: boolean;
  eacnEndpoint: string;
  lastUpdate: number;
}

// ── WebSocket messages ──────────────────────────────────────────────

export type WsMessage =
  | { type: "snapshot"; data: NetworkSnapshot }
  | { type: "tasks:update"; data: Task[] }
  | { type: "agents:update"; data: AgentInfo[] }
  | { type: "cluster:update"; data: ClusterStatus }
  | { type: "logs:update"; data: LogEntry[] }
  | { type: "connection:status"; data: { connected: boolean } };
