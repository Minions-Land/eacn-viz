import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { NetworkSnapshot, WsMessage } from "@shared/types";
import * as poller from "./directPoller";

const STORAGE_KEY = "eacn-viz-endpoint";
const DEFAULT_ENDPOINT = "http://175.102.130.69:37892";

// --- Detect mode ---

function isStaticDeployment(): boolean {
  const host = location.hostname;
  if (host.endsWith(".github.io")) return true;
  if (host.endsWith(".pages.dev")) return true;
  if (host.endsWith(".netlify.app")) return true;
  if (host.endsWith(".vercel.app")) return true;
  if (location.pathname.includes("/eacn-viz")) return true;
  return false;
}

export function needsSetup(): boolean {
  return isStaticDeployment() && !getSavedEndpoint();
}

// --- Endpoint management ---

export function getSavedEndpoint(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  } catch { /* ignore */ }
  // On static deployments (HTTPS), the HTTP default won't work — return empty.
  return isStaticDeployment() ? "" : DEFAULT_ENDPOINT;
}

export function saveEndpoint(ep: string) {
  try { localStorage.setItem(STORAGE_KEY, ep); } catch { /* ignore */ }
}

export function reconnectWithEndpoint(endpoint: string) {
  saveEndpoint(endpoint);
  location.reload();
}

// --- Snapshot state ---

const empty: NetworkSnapshot = {
  tasks: [], agents: [], cluster: null, logs: [],
  connected: false, eacnEndpoint: "", lastUpdate: 0,
};

let snapshot: NetworkSnapshot = { ...empty };
const listeners = new Set<() => void>();

function notify() { listeners.forEach((l) => l()); }

function applyMessage(msg: WsMessage) {
  switch (msg.type) {
    case "snapshot": snapshot = { ...msg.data }; break;
    case "tasks:update": {
      const prev = snapshot.tasks;
      const next = msg.data;
      if (prev.length === next.length && prev.every((t, i) => t.id === next[i].id && t.status === next[i].status && t.bids.length === next[i].bids.length && t.results.length === next[i].results.length)) return;
      snapshot = { ...snapshot, tasks: next, lastUpdate: Date.now() };
      break;
    }
    case "agents:update": {
      const prev = snapshot.agents;
      const next = msg.data;
      if (prev.length === next.length && prev.every((a, i) => a.agent_id === next[i].agent_id && a.reputation === next[i].reputation)) return;
      snapshot = { ...snapshot, agents: next, lastUpdate: Date.now() };
      break;
    }
    case "cluster:update": snapshot = { ...snapshot, cluster: msg.data, lastUpdate: Date.now() }; break;
    case "logs:update": {
      const prev = snapshot.logs;
      const next = msg.data;
      if (prev.length === next.length && prev.length > 0 && prev[0].timestamp === next[0].timestamp) return;
      snapshot = { ...snapshot, logs: next, lastUpdate: Date.now() };
      break;
    }
    case "connection:status": snapshot = { ...snapshot, connected: msg.data.connected }; break;
  }
  notify();
}

// --- Direct polling mode ---

function startDirectPolling(): () => void {
  let cancelled = false;
  let domains = new Set<string>();
  const endpoint = getSavedEndpoint();

  if (!endpoint) {
    snapshot = { ...snapshot, eacnEndpoint: "", connected: false };
    notify();
    return () => {};
  }

  snapshot = { ...snapshot, eacnEndpoint: endpoint };
  notify();

  async function pollTasks() {
    if (cancelled) return;
    const tasks = await poller.fetchTasks(endpoint);
    if (cancelled) return;
    if (tasks.length > 0 || snapshot.tasks.length > 0) {
      snapshot = { ...snapshot, tasks, lastUpdate: Date.now() };
      domains = poller.collectDomains(tasks, snapshot.cluster);
      notify();
    }
  }

  async function pollLogs() {
    if (cancelled) return;
    const logs = await poller.fetchLogs(endpoint);
    if (cancelled) return;
    if (logs.length > 0 || snapshot.logs.length > 0) {
      snapshot = { ...snapshot, logs, lastUpdate: Date.now() };
      notify();
    }
  }

  async function pollAgents() {
    if (cancelled) return;
    const cards = await poller.fetchAgents(endpoint, domains);
    if (cancelled) return;
    const agents = await poller.enrichAgents(endpoint, cards);
    if (cancelled) return;
    snapshot = { ...snapshot, agents, lastUpdate: Date.now() };
    notify();
  }

  async function pollCluster() {
    if (cancelled) return;
    const cluster = await poller.fetchCluster(endpoint);
    if (cancelled) return;
    if (cluster) {
      snapshot = { ...snapshot, cluster, lastUpdate: Date.now() };
      domains = poller.collectDomains(snapshot.tasks, cluster);
      notify();
    }
  }

  async function pollHealth() {
    if (cancelled) return;
    const ok = await poller.checkHealth(endpoint);
    if (cancelled) return;
    snapshot = { ...snapshot, connected: ok, eacnEndpoint: endpoint };
    notify();
  }

  pollHealth().then(() => {
    pollTasks();
    pollLogs();
    pollCluster().then(() => pollAgents());
  });

  const intervals = [
    setInterval(pollTasks, 3000),
    setInterval(pollLogs, 3000),
    setInterval(pollAgents, 10000),
    setInterval(pollHealth, 15000),
    setInterval(pollCluster, 30000),
  ];

  return () => {
    cancelled = true;
    intervals.forEach(clearInterval);
  };
}

// --- WebSocket mode ---

function startWebSocket(): () => void {
  let cancelled = false;
  let reconnectTimer: ReturnType<typeof setTimeout>;
  let ws: WebSocket | null = null;

  function connect() {
    if (cancelled) return;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}/ws`);
    ws.onmessage = (e) => {
      try { applyMessage(JSON.parse(e.data)); } catch { /* ignore */ }
    };
    ws.onclose = () => {
      if (!cancelled) reconnectTimer = setTimeout(connect, 2000);
    };
    ws.onerror = () => { ws?.close(); };
  }
  connect();

  return () => {
    cancelled = true;
    clearTimeout(reconnectTimer);
    ws?.close();
  };
}

// --- Hook ---

export function useStore(): NetworkSnapshot {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isStaticDeployment()) {
      cleanupRef.current = startDirectPolling();
    } else {
      cleanupRef.current = startWebSocket();
    }
    return () => { cleanupRef.current?.(); };
  }, []);

  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  return useSyncExternalStore(subscribe, () => snapshot);
}
