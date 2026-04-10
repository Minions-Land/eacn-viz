/**
 * EACN API Poller — periodically fetches data from the remote EACN network node.
 */
import type { Task, AgentCard, AgentInfo, ClusterStatus, LogEntry } from "../shared/types.js";

const EACN_ENDPOINT = process.env.EACN_ENDPOINT || "http://175.102.130.69:37892";

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${EACN_ENDPOINT}${path}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function checkHealth(): Promise<boolean> {
  const r = await fetchJson<{ status: string }>("/health");
  return r?.status === "ok";
}

export async function fetchTasks(): Promise<Task[]> {
  return (await fetchJson<Task[]>("/api/tasks?limit=200")) ?? [];
}

export async function fetchCluster(): Promise<ClusterStatus | null> {
  return fetchJson<ClusterStatus>("/api/cluster/status");
}

export async function fetchLogs(limit = 100): Promise<LogEntry[]> {
  return (await fetchJson<LogEntry[]>(`/api/admin/logs?limit=${limit}`)) ?? [];
}

/** Discover all agents by querying known domains from cluster + tasks. */
export async function fetchAgents(knownDomains: Set<string>): Promise<AgentCard[]> {
  const seen = new Map<string, AgentCard>();
  const domainList = knownDomains.size > 0 ? [...knownDomains] : ["coding"];
  for (const domain of domainList) {
    const agents = await fetchJson<AgentCard[]>(
      `/api/discovery/agents?domain=${encodeURIComponent(domain)}&limit=200`
    );
    if (agents) {
      for (const a of agents) seen.set(a.agent_id, a);
    }
  }
  return [...seen.values()];
}

export async function fetchReputation(agentId: string): Promise<number> {
  const r = await fetchJson<{ score: number }>(`/api/reputation/${encodeURIComponent(agentId)}`);
  return r?.score ?? 0.5;
}

export async function fetchBalance(agentId: string): Promise<{ available: number; frozen: number }> {
  const r = await fetchJson<{ available: number; frozen: number }>(
    `/api/economy/balance?agent_id=${encodeURIComponent(agentId)}`
  );
  return r ?? { available: 0, frozen: 0 };
}

/** Enrich agent cards with reputation + balance. */
export async function enrichAgents(cards: AgentCard[]): Promise<AgentInfo[]> {
  const results: AgentInfo[] = [];
  for (const card of cards) {
    const [reputation, balance] = await Promise.all([
      fetchReputation(card.agent_id),
      fetchBalance(card.agent_id),
    ]);
    results.push({ ...card, reputation, balance });
  }
  return results;
}

/** Collect all unique domains from tasks + cluster. */
export function collectDomains(tasks: Task[], cluster: ClusterStatus | null): Set<string> {
  const domains = new Set<string>();
  for (const t of tasks) {
    for (const d of t.domains) domains.add(d);
  }
  if (cluster) {
    for (const d of cluster.local.domains) domains.add(d);
    for (const m of cluster.members) {
      for (const d of m.domains) domains.add(d);
    }
  }
  return domains;
}

export function getEndpoint(): string {
  return EACN_ENDPOINT;
}
