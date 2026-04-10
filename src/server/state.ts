/**
 * In-memory state manager — holds latest snapshot, detects changes, broadcasts via WS.
 */
import type { WebSocket } from "ws";
import type { NetworkSnapshot, Task, AgentInfo, ClusterStatus, LogEntry, WsMessage } from "../shared/types.js";

const clients = new Set<WebSocket>();

let state: NetworkSnapshot = {
  tasks: [],
  agents: [],
  cluster: null,
  logs: [],
  connected: false,
  eacnEndpoint: "",
  lastUpdate: 0,
};

// Track fingerprints to skip no-op broadcasts
let taskFingerprint = "";
let agentFingerprint = "";
let logFingerprint = "";

function tasksFingerprint(tasks: Task[]): string {
  if (tasks.length === 0) return "0";
  // Fast fingerprint: count + status summary + first/last IDs
  let s = `${tasks.length}`;
  for (const t of tasks) {
    s += `:${t.id.slice(-6)}${t.status[0]}${t.bids.length}${t.results.length}`;
  }
  return s;
}

function agentsFingerprint(agents: AgentInfo[]): string {
  if (agents.length === 0) return "0";
  let s = `${agents.length}`;
  for (const a of agents) {
    s += `:${a.agent_id.slice(-6)}${a.reputation.toFixed(3)}`;
  }
  return s;
}

function logsFingerprint(logs: LogEntry[]): string {
  if (logs.length === 0) return "0";
  return `${logs.length}:${logs[0]?.timestamp ?? 0}`;
}

export function getState(): NetworkSnapshot {
  return state;
}

export function addClient(ws: WebSocket): void {
  clients.add(ws);
  send(ws, { type: "snapshot", data: state });
}

export function removeClient(ws: WebSocket): void {
  clients.delete(ws);
}

function broadcast(msg: WsMessage): void {
  if (clients.size === 0) return;
  const raw = JSON.stringify(msg);
  for (const ws of clients) {
    try { ws.send(raw); } catch { /* ignore dead sockets */ }
  }
}

function send(ws: WebSocket, msg: WsMessage): void {
  try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
}

export function setConnected(connected: boolean, endpoint: string): void {
  state.connected = connected;
  state.eacnEndpoint = endpoint;
  broadcast({ type: "connection:status", data: { connected } });
}

export function updateTasks(tasks: Task[]): void {
  const fp = tasksFingerprint(tasks);
  if (fp === taskFingerprint) return; // No change
  taskFingerprint = fp;
  state.tasks = tasks;
  state.lastUpdate = Date.now();
  broadcast({ type: "tasks:update", data: tasks });
}

export function updateAgents(agents: AgentInfo[]): void {
  const fp = agentsFingerprint(agents);
  if (fp === agentFingerprint) return;
  agentFingerprint = fp;
  state.agents = agents;
  state.lastUpdate = Date.now();
  broadcast({ type: "agents:update", data: agents });
}

export function updateCluster(cluster: ClusterStatus): void {
  state.cluster = cluster;
  state.lastUpdate = Date.now();
  broadcast({ type: "cluster:update", data: cluster });
}

export function updateLogs(logs: LogEntry[]): void {
  const fp = logsFingerprint(logs);
  if (fp === logFingerprint) return;
  logFingerprint = fp;
  state.logs = logs;
  state.lastUpdate = Date.now();
  broadcast({ type: "logs:update", data: logs });
}
