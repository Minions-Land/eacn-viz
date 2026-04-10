import { useState, useEffect, useCallback, useRef } from "react";
import { useStore, needsSetup } from "./hooks/useStore";
import { I18nProvider, useI18n } from "./i18n";
import TopBar from "./components/TopBar";
import Dashboard from "./components/Dashboard";
import AgentsView from "./components/AgentsView";
import TasksBoard from "./components/TasksBoard";
import TaskTree from "./components/TaskTree";
import NetworkGraph from "./components/NetworkGraph";
import EventLog from "./components/EventLog";
import AgentDetail from "./components/AgentDetail";
import TaskDetail from "./components/TaskDetail";
import GlobalSearch from "./components/GlobalSearch";
import ToastContainer, { toast } from "./components/ToastContainer";
import SetupOverlay from "./components/SetupOverlay";

export type Tab = "dashboard" | "agents" | "tasks" | "tree" | "network" | "logs";

function AppInner() {
  const store = useStore();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const prevRef = useRef({ taskCount: 0, agentCount: 0, connected: false });

  useEffect(() => {
    const prev = prevRef.current;

    if (prev.taskCount > 0 && store.tasks.length > prev.taskCount) {
      const diff = store.tasks.length - prev.taskCount;
      toast(`${diff}${t("toast.newTasks")}`, "info");
    }

    if (prev.agentCount > 0 && store.agents.length > prev.agentCount) {
      const diff = store.agents.length - prev.agentCount;
      toast(`${diff}${t("toast.newAgents")}`, "success");
    }

    if (prev.connected && !store.connected) {
      toast(t("toast.disconnected"), "error");
    } else if (!prev.connected && store.connected && prev.taskCount > 0) {
      toast(t("toast.reconnected"), "success");
    }

    prevRef.current = {
      taskCount: store.tasks.length,
      agentCount: store.agents.length,
      connected: store.connected,
    };
  }, [store.tasks.length, store.agents.length, store.connected, t]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        if (showSearch) { setShowSearch(false); return; }
        if (selectedTask) { setSelectedTask(null); return; }
        if (selectedAgent) { setSelectedAgent(null); return; }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch((v) => !v);
        return;
      }

      const tabMap: Record<string, Tab> = {
        "1": "dashboard",
        "2": "agents",
        "3": "tasks",
        "4": "tree",
        "5": "network",
        "6": "logs",
      };
      if (tabMap[e.key]) {
        setTab(tabMap[e.key]);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSearch, selectedTask, selectedAgent]);

  const exportSnapshot = useCallback(() => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eacn-snapshot-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(t("toast.exported"), "success");
  }, [store, t]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-transparent">
      {needsSetup() && <SetupOverlay />}
      <TopBar
        tab={tab}
        setTab={setTab}
        connected={store.connected}
        endpoint={store.eacnEndpoint}
        agentCount={store.agents.length}
        taskCount={store.tasks.length}
        lastUpdate={store.lastUpdate}
        onSearch={() => setShowSearch(true)}
        onExport={exportSnapshot}
      />

      <main className="flex-1 overflow-hidden relative">
        {tab === "dashboard" && (
          <Dashboard
            store={store}
            onSelectAgent={setSelectedAgent}
            onSelectTask={setSelectedTask}
          />
        )}
        {tab === "agents" && (
          <AgentsView
            agents={store.agents}
            tasks={store.tasks}
            onSelect={setSelectedAgent}
          />
        )}
        {tab === "tasks" && (
          <TasksBoard
            tasks={store.tasks}
            agents={store.agents}
            onSelect={setSelectedTask}
          />
        )}
        {tab === "tree" && (
          <TaskTree
            tasks={store.tasks}
            onSelect={setSelectedTask}
          />
        )}
        {tab === "network" && (
          <NetworkGraph
            tasks={store.tasks}
            agents={store.agents}
            onSelectAgent={setSelectedAgent}
            onSelectTask={setSelectedTask}
          />
        )}
        {tab === "logs" && (
          <EventLog logs={store.logs} />
        )}
      </main>

      {selectedAgent && (
        <AgentDetail
          agentId={selectedAgent}
          agents={store.agents}
          tasks={store.tasks}
          logs={store.logs}
          onClose={() => setSelectedAgent(null)}
          onSelectTask={setSelectedTask}
        />
      )}

      {selectedTask && (
        <TaskDetail
          taskId={selectedTask}
          tasks={store.tasks}
          agents={store.agents}
          onClose={() => setSelectedTask(null)}
          onSelectAgent={setSelectedAgent}
          onSelectTask={setSelectedTask}
        />
      )}

      {showSearch && (
        <GlobalSearch
          tasks={store.tasks}
          agents={store.agents}
          logs={store.logs}
          onSelectAgent={(id) => { setSelectedAgent(id); setShowSearch(false); }}
          onSelectTask={(id) => { setSelectedTask(id); setShowSearch(false); }}
          onClose={() => setShowSearch(false)}
        />
      )}

      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}
