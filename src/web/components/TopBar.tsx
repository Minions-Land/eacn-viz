import { useState } from "react";
import type { Tab } from "../App";
import { useI18n } from "../i18n";
import { getSavedEndpoint, reconnectWithEndpoint } from "../hooks/useStore";

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
  connected: boolean;
  endpoint: string;
  agentCount: number;
  taskCount: number;
  lastUpdate: number;
  onSearch: () => void;
  onExport: () => void;
}

const TAB_KEYS: { key: Tab; labelKey: "tab.dashboard" | "tab.agents" | "tab.tasks" | "tab.tree" | "tab.network" | "tab.logs"; shortcut: string }[] = [
  { key: "dashboard", labelKey: "tab.dashboard", shortcut: "1" },
  { key: "agents", labelKey: "tab.agents", shortcut: "2" },
  { key: "tasks", labelKey: "tab.tasks", shortcut: "3" },
  { key: "tree", labelKey: "tab.tree", shortcut: "4" },
  { key: "network", labelKey: "tab.network", shortcut: "5" },
  { key: "logs", labelKey: "tab.logs", shortcut: "6" },
];

export default function TopBar({
  tab, setTab, connected, endpoint, agentCount, taskCount, lastUpdate, onSearch, onExport,
}: Props) {
  const { t, locale, toggleLocale } = useI18n();
  const [showEndpointEdit, setShowEndpointEdit] = useState(false);
  const [editEndpoint, setEditEndpoint] = useState(getSavedEndpoint);

  function formatLastUpdate(ts: number): string {
    if (!ts) return "—";
    const diff = Date.now() - ts;
    if (diff < 1000) return t("topbar.justNow");
    if (diff < 60_000) return `${Math.floor(diff / 1000)}${t("topbar.secsAgo")}`;
    return `${Math.floor(diff / 60_000)}${t("topbar.minsAgo")}`;
  }

  return (
    <header className="shrink-0 sticky top-0 z-20 backdrop-blur-[18px] bg-[rgba(249,244,234,0.76)] border-b border-[rgba(23,23,23,0.08)]">
      <div className="flex items-center gap-3 px-5 py-3">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl grid place-items-center border border-[rgba(23,23,23,0.08)]" style={{
            background: "linear-gradient(145deg, rgba(15,118,110,0.18), rgba(23,64,102,0.16)), #fff9ef",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
          }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-teal-600">
              <path d="M5 8.5 12 4l7 4.5v7L12 20l-7-4.5v-7Z" stroke="currentColor" strokeWidth="1.7"/>
              <path d="M5 8.5 12 13l7-4.5M12 13v7" stroke="currentColor" strokeWidth="1.7"/>
            </svg>
          </div>
          <div>
            <div className="font-mono text-[10px] text-[#0f766e] tracking-[0.12em] uppercase leading-none">Science OS</div>
            <div className="text-sm font-bold text-[#171717] tracking-tight">EACN Viz</div>
          </div>
        </div>

        {/* Tab nav */}
        <nav className="flex gap-1 ml-4">
          {TAB_KEYS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              title={`${t(item.labelKey)} (${item.shortcut})`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                tab === item.key
                  ? "bg-gradient-to-r from-teal-600 to-[#174066] text-white shadow-md shadow-teal-600/20"
                  : "text-[#5f5a52] hover:text-[#171717] hover:bg-[rgba(23,23,23,0.06)]"
              }`}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Language toggle */}
        <button
          onClick={toggleLocale}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-[rgba(23,23,23,0.1)] bg-[rgba(255,252,246,0.84)] text-[#5f5a52] hover:text-[#171717] hover:border-[rgba(23,23,23,0.2)] transition-colors shadow-sm"
          title={locale === "en" ? "Switch to Chinese" : "切换为英文"}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10A15 15 0 0 1 12 2z" />
          </svg>
          <span>{locale === "en" ? "中文" : "EN"}</span>
        </button>

        {/* Search button */}
        <button
          onClick={onSearch}
          className="flex items-center gap-2 px-3 py-1.5 bg-[rgba(255,252,246,0.84)] border border-[rgba(23,23,23,0.1)] rounded-full text-xs text-[#5f5a52] hover:text-[#171717] hover:border-[rgba(23,23,23,0.2)] transition-colors shadow-sm"
          title={t("topbar.searchTitle")}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="hidden sm:inline">{t("topbar.search")}</span>
          <kbd className="text-[9px] text-[#5f5a52]/60 bg-[rgba(23,23,23,0.05)] px-1.5 py-0.5 rounded-md border border-[rgba(23,23,23,0.08)] ml-0.5 font-mono">
            ⌘K
          </kbd>
        </button>

        {/* Export button */}
        <button
          onClick={onExport}
          className="px-2 py-1.5 text-xs text-[#5f5a52] hover:text-[#171717] hover:bg-[rgba(23,23,23,0.06)] rounded-full transition-colors"
          title={t("topbar.exportTitle")}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-[#5f5a52] shrink-0 font-mono">
          <span className="pill">{agentCount} {t("topbar.agents")}</span>
          <span className="pill">{taskCount} {t("topbar.tasks")}</span>
          <span className="text-[#5f5a52]/50" title={t("topbar.lastUpdate")}>
            ↻ {formatLastUpdate(lastUpdate)}
          </span>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 shrink-0 relative">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? "bg-teal-600 animate-pulse-slow" : "bg-red-400"
            }`}
            style={connected ? { boxShadow: "0 0 0 4px rgba(15,118,110,0.12)" } : undefined}
          />
          <span className="text-xs text-[#5f5a52]">
            {connected ? t("topbar.connected") : t("topbar.disconnected")}
          </span>
          <button
            onClick={() => setShowEndpointEdit(!showEndpointEdit)}
            className="text-[10px] text-[#5f5a52]/50 max-w-[140px] truncate hidden lg:inline font-mono hover:text-teal-600 transition-colors cursor-pointer"
            title={locale === "en" ? "Click to change endpoint" : "点击更换节点地址"}
          >
            {endpoint || getSavedEndpoint()}
          </button>

          {/* Endpoint edit popover */}
          {showEndpointEdit && (
            <div className="absolute top-full right-0 mt-2 p-3 bg-[#fbf8f2] border border-[rgba(23,23,23,0.1)] rounded-2xl shadow-xl z-50 w-80"
              style={{ boxShadow: "0 20px 60px rgba(32,24,12,0.12)" }}
            >
              <div className="text-xs text-[#5f5a52] mb-2 font-medium">
                {locale === "en" ? "EACN Endpoint" : "EACN 节点地址"}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editEndpoint}
                  onChange={(e) => setEditEndpoint(e.target.value)}
                  placeholder="http://host:port"
                  className="eacn-input flex-1 text-xs !rounded-xl"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      reconnectWithEndpoint(editEndpoint.trim());
                    }
                  }}
                />
                <button
                  onClick={() => reconnectWithEndpoint(editEndpoint.trim())}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-teal-600 to-[#174066] hover:shadow-md transition-shadow"
                >
                  {locale === "en" ? "Connect" : "连接"}
                </button>
              </div>
              <div className="text-[10px] text-[#5f5a52]/50 mt-1.5 font-mono">
                {locale === "en" ? "Page will reload to apply" : "页面将重新加载以应用更改"}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
