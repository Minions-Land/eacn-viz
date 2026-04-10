# AGENTREAD — eacn-viz 技术参考（供 AI Agent 阅读）

本文档面向需要理解、修改或扩展 eacn-viz 的 AI Agent。包含完整的架构细节、数据流、文件职责、类型定义和扩展指南。

---

## 1. 系统定位

eacn-viz 是 EACN（Emergent Agent Collaboration Network）分布式多智能体网络的**只读**实时可视化面板。

```
┌─────────┐    HTTP 轮询     ┌──────────────┐    WebSocket     ┌─────────┐
│  EACN   │ ◄────────────── │  eacn-viz    │ ──────────────► │ 浏览器   │
│  节点    │  GET /api/...   │  服务端       │  推送增量更新    │ React   │
│ :37892  │                 │  :7891       │                 │ 前端     │
└─────────┘                 └──────────────┘                 └─────────┘
```

关键约束：
- **只读** — 只调用 GET 接口，绝不向 EACN 写入数据
- **不消费事件队列** — 不调用 `GET /api/events/{agent_id}`（会 drain 真实事件）
- **只用 admin/logs** — 活动追踪全部来自 `/api/admin/logs`

---

## 2. 项目结构与文件职责

```
eacn-viz/
├── package.json                 # type: "module", 入口脚本定义
├── tsconfig.json                # 前端 TS 配置（moduleResolution: bundler, jsx: react-jsx）
├── tsconfig.server.json         # 服务端 TS 配置（moduleResolution: bundler）
├── vite.config.ts               # Vite 构建：root=src/web, outDir=dist/web, 开发代理到 :7891
├── tailwind.config.js           # content 扫描 src/web/**/*.{ts,tsx,html}
├── postcss.config.js            # tailwindcss + autoprefixer
│
├── src/shared/
│   └── types.ts                 # ★ 核心类型定义，服务端和前端共享
│
├── src/server/
│   ├── index.ts                 # Express + WebSocket 服务入口，轮询调度
│   ├── poller.ts                # EACN API 调用封装（fetch + 超时 + 错误处理）
│   └── state.ts                 # 内存状态 + WebSocket 客户端管理 + 广播
│
└── src/web/
    ├── index.html               # HTML 入口
    ├── main.tsx                 # React 挂载点
    ├── App.tsx                  # 主应用：Tab 路由 + 详情面板状态管理
    ├── index.css                # Tailwind 指令 + 全局样式（滚动条、React Flow 覆盖）
    ├── env.d.ts                 # Vite 类型声明
    ├── hooks/
    │   └── useStore.ts          # WebSocket 客户端 + useSyncExternalStore 状态管理
    ├── utils/
    │   ├── format.ts            # 格式化工具函数（颜色映射、时间、截断、ID 缩写）
    │   └── layout.ts            # Dagre 自动布局（任务树 React Flow 节点定位）
    └── components/
        ├── TopBar.tsx           # 顶部导航栏（Tab 切换 + 连接状态 + 统计）
        ├── Dashboard.tsx        # 总览视图（统计卡片 + 状态条 + 集群 + 活动流）
        ├── AgentsView.tsx       # 智能体卡片网格（按 server_id 分组 + 搜索）
        ├── TasksBoard.tsx       # 任务看板（5 列 Kanban + 过滤）
        ├── TaskTree.tsx         # 任务树（React Flow + Dagre 布局）
        ├── TaskNode.tsx         # React Flow 自定义节点组件
        ├── EventLog.tsx         # 事件日志表格（3 个过滤器）
        ├── AgentDetail.tsx      # 智能体详情滑出面板
        └── TaskDetail.tsx       # 任务详情滑出面板
```

---

## 3. 核心类型定义（src/shared/types.ts）

以下是完整的类型体系，与 EACN FastAPI 后端的数据模型一一对应：

### Task 相关

```typescript
type TaskStatus = "unclaimed" | "bidding" | "awaiting_retrieval" | "completed" | "no_one_able";
type TaskType = "normal" | "adjudication";
type TaskLevel = "general" | "expert" | "expert_general" | "tool";
type BidStatus = "pending" | "accepted" | "rejected" | "waiting" | "executing";

interface Bid {
  agent_id: string;       // 竞标者 ID
  server_id: string;      // 竞标者所在 server
  confidence: number;     // 0-1，竞标信心
  price: number;          // 报价
  status: BidStatus;
}

interface Adjudication {
  adjudicator_id: string;
  verdict: string;
  score: number;
}

interface Result {
  agent_id: string;       // 提交者 ID
  content: unknown;       // 结果内容（任意类型）
  selected: boolean;      // 是否被选定
  adjudications: Adjudication[];
}

interface Task {
  id: string;
  status: TaskStatus;
  type: TaskType;
  initiator_id: string;   // 发起者 agent_id
  server_id: string;
  domains: string[];      // 任务所属领域
  content: Record<string, unknown>;  // 通常含 description: string
  budget: number;
  remaining_budget: number | null;
  deadline: string | null;           // ISO 8601
  parent_id: string | null;         // 父任务 ID（null = 根任务）
  child_ids: string[];              // 子任务 ID 列表
  depth: number;                    // 在任务树中的深度
  max_depth: number;
  max_concurrent_bidders: number;
  bids: Bid[];
  results: Result[];
  budget_locked: boolean;
  level: TaskLevel;
  invited_agent_ids: string[];
  human_contact: HumanContact | null;
}
```

### Agent 相关

```typescript
interface AgentCard {
  agent_id: string;
  name: string;
  domains: string[];
  skills: Skill[];        // { name, description, parameters }
  url: string;
  server_id: string;
  network_id: string;
  description: string;
  tier: string;           // "general" | "expert" | "expert_general" | "tool"
}

interface AgentInfo extends AgentCard {
  reputation: number;     // 0-1，从 /api/reputation/{id} 获取
  balance: {
    available: number;    // 从 /api/economy/balance 获取
    frozen: number;
  };
}
```

### Cluster

```typescript
interface ClusterStatus {
  mode: string;           // "standalone" | "cluster"
  local: {
    node_id: string;
    endpoint: string;
    domains: string[];
    status: string;
    version: string;
    joined_at: string;
  };
  members: ClusterMember[];  // { node_id, endpoint, domains[], status, last_seen, connected_agents }
  member_count: number;
  online_count: number;
  seed_nodes: string[];
}
```

### Log

```typescript
interface LogEntry {
  fn_name: string;        // 事件类型，如 "create_task", "submit_bid", "submit_result"
  args: Record<string, unknown>;
  result: unknown;
  timestamp: string;      // ISO 8601
  error: string | null;
  task_id: string | null;
  agent_id: string | null;
  server_id: string | null;
}
```

### WebSocket 消息协议

```typescript
type WsMessage =
  | { type: "snapshot";          data: NetworkSnapshot }   // 首次连接时发送完整快照
  | { type: "tasks:update";      data: Task[] }            // 任务列表全量更新
  | { type: "agents:update";     data: AgentInfo[] }       // 智能体列表全量更新
  | { type: "cluster:update";    data: ClusterStatus }     // 集群状态更新
  | { type: "logs:update";       data: LogEntry[] }        // 日志列表全量更新
  | { type: "connection:status"; data: { connected: boolean } }  // EACN 连接状态变化

interface NetworkSnapshot {
  tasks: Task[];
  agents: AgentInfo[];
  cluster: ClusterStatus | null;
  logs: LogEntry[];
  connected: boolean;       // EACN 节点是否可达
  eacnEndpoint: string;     // 当前连接的 EACN 地址
  lastUpdate: number;       // 最后更新时间戳（ms）
}
```

---

## 4. 服务端数据流

### 4.1 poller.ts — EACN API 调用

所有 API 调用通过 `fetchJson<T>(path)` 封装：
- 基础 URL 来自 `process.env.EACN_ENDPOINT || "http://175.102.130.69:37892"`
- 8 秒超时（AbortSignal.timeout）
- 失败返回 null，不抛异常

关键函数：

| 函数 | 调用的 API | 返回值 |
|------|-----------|--------|
| `checkHealth()` | `GET /health` | `boolean` |
| `fetchTasks()` | `GET /api/tasks?limit=200` | `Task[]` |
| `fetchCluster()` | `GET /api/cluster/status` | `ClusterStatus \| null` |
| `fetchLogs(limit)` | `GET /api/admin/logs?limit={n}` | `LogEntry[]` |
| `fetchAgents(knownDomains)` | `GET /api/discovery/agents?domain={d}&limit=200`（遍历所有已知领域） | `AgentCard[]`（按 agent_id 去重） |
| `fetchReputation(agentId)` | `GET /api/reputation/{id}` | `number`（默认 0.5） |
| `fetchBalance(agentId)` | `GET /api/economy/balance?agent_id={id}` | `{ available, frozen }`（默认 0,0） |
| `enrichAgents(cards)` | 对每个 card 并行调用 reputation + balance | `AgentInfo[]` |
| `collectDomains(tasks, cluster)` | 纯计算，不调 API | `Set<string>` |

智能体发现策略：
1. 从 tasks 和 cluster 中收集所有出现过的 domain
2. 对每个 domain 调用 `/api/discovery/agents?domain={d}`
3. 按 agent_id 去重
4. 对每个 agent 并行查询 reputation 和 balance

### 4.2 state.ts — 内存状态 + 广播

- 维护一个全局 `NetworkSnapshot` 对象
- 管理 WebSocket 客户端集合（`Set<WebSocket>`）
- 新客户端连接时发送完整 `snapshot` 消息
- 每次数据更新时向所有客户端广播对应的增量消息
- 当前实现是**全量替换**（不做 diff），每次轮询结果直接覆盖

### 4.3 index.ts — 轮询调度

启动顺序：
1. `pollHealth()` — 检查连接
2. `pollCluster()` — 获取集群信息和领域列表
3. 并行：`pollTasks()` + `pollAgents()` + `pollLogs()`

定时器：

| 函数 | 间隔 |
|------|------|
| `pollHealth` | 15s |
| `pollTasks` | 3s |
| `pollAgents` | 10s |
| `pollCluster` | 30s |
| `pollLogs` | 3s |

HTTP 端点：
- `GET /api/snapshot` — 返回当前完整状态（供非 WebSocket 客户端使用）
- `GET *` — 静态文件服务（dist/web）+ SPA fallback

WebSocket 端点：
- `ws://localhost:7891/ws`

---

## 5. 前端数据流

### 5.1 useStore.ts — 状态管理

使用 `useSyncExternalStore` 实现零依赖的全局状态：

```
WebSocket 消息 → applyMessage() → 更新模块级 snapshot 变量 → notify listeners → React 重渲染
```

- 模块级变量 `snapshot: NetworkSnapshot` 作为单一数据源
- `listeners: Set<() => void>` 存储所有订阅者
- WebSocket 断线后每 2 秒自动重连
- 连接建立后服务端立即推送完整快照

### 5.2 App.tsx — 路由与面板

状态：
- `tab: Tab` — 当前视图（"dashboard" | "agents" | "tasks" | "tree" | "logs"）
- `selectedAgent: string | null` — 打开的智能体详情面板
- `selectedTask: string | null` — 打开的任务详情面板

两个详情面板可以同时存在，且内部链接可以互相切换（点击任务中的 agent 会打开 AgentDetail，反之亦然）。

### 5.3 组件 Props 接口

```typescript
// TopBar
{ tab, setTab, connected, endpoint, agentCount, taskCount }

// Dashboard
{ store: NetworkSnapshot, onSelectAgent, onSelectTask }

// AgentsView
{ agents: AgentInfo[], tasks: Task[], onSelect: (agentId) => void }

// TasksBoard
{ tasks: Task[], agents: AgentInfo[], onSelect: (taskId) => void }

// TaskTree
{ tasks: Task[], onSelect: (taskId) => void }

// EventLog
{ logs: LogEntry[] }

// AgentDetail
{ agentId, agents, tasks, logs, onClose, onSelectTask }

// TaskDetail
{ taskId, tasks, agents, onClose, onSelectAgent, onSelectTask }
```

---

## 6. EACN API 端点参考

eacn-viz 调用的所有 EACN API：

| 方法 | 路径 | 用途 | 轮询间隔 |
|------|------|------|----------|
| GET | `/health` | 检查节点是否在线 | 15s |
| GET | `/api/tasks?limit=200` | 获取所有任务（含 bids, results, content） | 3s |
| GET | `/api/admin/logs?limit=100` | 获取最近日志 | 3s |
| GET | `/api/discovery/agents?domain={d}&limit=200` | 按领域发现智能体 | 10s |
| GET | `/api/reputation/{agent_id}` | 获取智能体信誉分 | 10s（随 agents 一起） |
| GET | `/api/economy/balance?agent_id={id}` | 获取智能体余额 | 10s（随 agents 一起） |
| GET | `/api/cluster/status` | 获取集群状态 | 30s |

**不调用的 API**（重要）：
- `GET /api/events/{agent_id}` — 会消费事件队列，影响真实 agent 运行
- 所有 POST/PUT/DELETE 端点 — eacn-viz 是只读的

---

## 7. 扩展指南

### 添加新的数据源

1. 在 `poller.ts` 中添加 `fetchXxx()` 函数
2. 在 `types.ts` 中添加对应类型和 WsMessage 变体
3. 在 `state.ts` 中添加 `updateXxx()` 函数
4. 在 `index.ts` 中添加 `pollXxx()` 和 `setInterval`
5. 在 `useStore.ts` 的 `applyMessage` 中添加新的 case

### 添加新的视图

1. 在 `App.tsx` 的 `Tab` 类型中添加新值
2. 在 `TopBar.tsx` 的 `TABS` 数组中添加标签
3. 创建新组件 `src/web/components/NewView.tsx`
4. 在 `App.tsx` 的 `<main>` 中添加条件渲染

### 添加新的详情面板字段

直接修改 `AgentDetail.tsx` 或 `TaskDetail.tsx`，数据已经在 `NetworkSnapshot` 中。

### 修改轮询频率

在 `src/server/index.ts` 的 `startPolling()` 函数中修改 `setInterval` 的毫秒数。

### 连接不同的 EACN 节点

```bash
EACN_ENDPOINT=http://新地址:端口 npm start
```

### 修改 UI 主题

- 颜色映射在 `src/web/utils/format.ts`
- Tailwind 配置在 `tailwind.config.js`
- 全局样式在 `src/web/index.css`

---

## 8. 构建与运行命令

```bash
npm install          # 安装依赖
npm run build        # 构建前端到 dist/web/
npm start            # 启动生产服务（:7891）
npm run dev          # 开发模式（前端 :5174 + 后端 :7891，热重载）
npm run dev:server   # 只启动后端（tsx watch）
npm run dev:web      # 只启动前端 Vite 开发服务器
```

---

## 9. 已知限制

1. **智能体发现不完整** — 只能发现出现在已知领域中的智能体。如果某个智能体注册了一个从未在任务或集群中出现的领域，它不会被发现。
2. **全量更新** — 每次轮询都发送完整列表，没有做增量 diff。对于大量任务（>1000）可能有性能影响。
3. **无持久化** — 所有数据在内存中，服务重启后丢失历史。
4. **无认证** — 服务端没有访问控制。如果 EACN admin 端点需要 token，当前不支持（会返回空数据）。
5. **单节点轮询** — 只连接一个 EACN 节点，不支持同时监控多个节点。
