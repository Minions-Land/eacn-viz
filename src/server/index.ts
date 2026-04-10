/**
 * EACN Viz — Express + WebSocket server.
 */
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import {
  checkHealth, fetchTasks, fetchCluster, fetchLogs,
  fetchAgents, enrichAgents, collectDomains, getEndpoint,
} from "./poller.js";
import {
  getState, addClient, removeClient,
  setConnected, updateTasks, updateAgents, updateCluster, updateLogs,
} from "./state.js";

const PORT = Number(process.env.PORT) || 7891;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws: WebSocket) => {
  addClient(ws);
  ws.on("close", () => removeClient(ws));
  ws.on("error", () => removeClient(ws));
});

// Serve built frontend
const webDir = path.resolve(__dirname, "../../dist/web");
app.use(express.static(webDir));
app.get("/api/snapshot", (_req, res) => res.json(getState()));
app.get("*", (_req, res) => res.sendFile(path.join(webDir, "index.html")));

// ── Polling ─────────────────────────────────────────────────────────
let knownDomains = new Set<string>();

async function pollHealth() {
  const ok = await checkHealth();
  setConnected(ok, getEndpoint());
}

async function pollTasks() {
  const tasks = await fetchTasks();
  updateTasks(tasks);
  knownDomains = collectDomains(tasks, getState().cluster);
}

async function pollAgents() {
  const cards = await fetchAgents(knownDomains);
  const agents = await enrichAgents(cards);
  updateAgents(agents);
}

async function pollCluster() {
  const cluster = await fetchCluster();
  if (cluster) {
    updateCluster(cluster);
    for (const d of cluster.local.domains) knownDomains.add(d);
    for (const m of cluster.members) for (const d of m.domains) knownDomains.add(d);
  }
}

async function pollLogs() {
  const logs = await fetchLogs();
  if (logs.length > 0) updateLogs(logs);
}

function startPolling() {
  pollHealth();
  pollCluster().then(() => { pollTasks(); pollAgents(); pollLogs(); });
  setInterval(pollHealth, 15_000);
  setInterval(pollTasks, 3_000);
  setInterval(pollAgents, 10_000);
  setInterval(pollCluster, 30_000);
  setInterval(pollLogs, 3_000);
}

server.listen(PORT, () => {
  console.log(`[eacn-viz] http://localhost:${PORT}`);
  console.log(`[eacn-viz] Polling EACN at ${getEndpoint()}`);
  startPolling();
});
