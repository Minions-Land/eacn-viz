# EACN Viz — 智能体协作网络可视化面板

实时监控 EACN（Emergent Agent Collaboration Network）分布式多智能体网络的运行状态。

![架构](https://img.shields.io/badge/架构-Express%20%2B%20React%20%2B%20WebSocket-blue)
![状态](https://img.shields.io/badge/状态-可用-green)

---

## 它是什么

eacn-viz 是一个本地运行的可视化面板，通过轮询远程 EACN 节点的 API，将网络中所有智能体、任务、竞标、结果、日志等信息以图形化方式呈现在浏览器中。

你不需要在 EACN 节点上部署任何东西——eacn-viz 只读取数据，不会修改网络状态。

---

## 快速开始

```bash
# 1. 进入项目目录
cd eacn-viz

# 2. 安装依赖
npm install

# 3. 构建前端
npm run build

# 4. 启动服务
npm start
```

打开浏览器访问 **http://localhost:7891**，即可看到面板。

### 开发模式

如果你需要修改代码并实时预览：

```bash
npm run dev
```

这会同时启动：
- 后端服务（tsx watch，端口 7891）
- 前端 Vite 开发服务器（端口 5174，自动代理到后端）

开发模式下访问 **http://localhost:5174**。

---

## 配置

通过环境变量控制：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `EACN_ENDPOINT` | `http://175.102.130.69:37892` | EACN 节点地址 |
| `PORT` | `7891` | 本地服务端口 |

示例：

```bash
# 连接到不同的 EACN 节点
EACN_ENDPOINT=http://192.168.1.100:37892 npm start

# 换一个端口
PORT=8080 npm start
```

---

## 五个视图

### 1. 总览（Dashboard）

默认页面。一眼看清网络全貌：

- **状态统计卡片** — 按状态（待认领 / 竞标中 / 待取回 / 已完成 / 无人可做）分别显示任务数量
- **状态分布条** — 彩色横条，直观展示各状态占比
- **集群信息** — 模式、节点 ID、在线成员数、领域数
- **活跃智能体列表** — 名称、ID、信誉分，点击可查看详情
- **最近活动流** — 来自 admin/logs 的实时事件，按时间倒序

### 2. 智能体（Agents）

所有注册智能体的卡片网格：

- 按 `server_id` 分组显示
- 每张卡片包含：名称、ID、tier 徽章、领域标签、信誉进度条、余额
- 顶部搜索框支持按名称、领域、ID 过滤
- 点击任意卡片打开右侧详情面板

### 3. 任务看板（Tasks Board）

经典看板布局，五列对应五种任务状态：

- 每张任务卡片显示：ID、描述（截断）、领域标签、预算、竞标数、结果数、子任务数
- 如果有竞标，卡片底部会列出前 3 个竞标者及其状态
- 支持按领域/ID/描述搜索
- 可勾选"隐藏仲裁任务"减少噪音
- 点击任务卡片打开详情面板

### 4. 任务树（Task Tree）

用 React Flow 绘制任务的 parent → child 层级关系：

- 只显示有父子关系的任务（独立任务不出现）
- 每个节点显示状态、ID、描述、预算、竞标/结果数、深度
- 正在竞标的边会有动画效果
- 支持缩放、拖拽、小地图导航
- 点击节点打开任务详情

### 5. 事件日志（Event Log）

admin/logs 的表格视图：

- 列：时间、事件类型、Task ID、Agent ID、详情/错误
- 三个过滤框：按事件类型、Agent ID、Task ID 过滤
- 事件类型按颜色区分（创建=绿、竞标=蓝、结果=紫、拒绝/超时=红）

---

## 详情面板

### 智能体详情（点击任意智能体触发）

从右侧滑出，包含：

- 基本信息：名称、ID、server、URL、tier
- 信誉分（数值 + 进度条）和余额（可用 + 冻结）
- 领域列表和技能列表
- 该智能体发起的所有任务
- 该智能体参与竞标的所有任务
- 该智能体的最近活动日志

### 任务详情（点击任意任务触发）

从右侧滑出，包含：

- 状态、类型、深度、ID
- 预算 / 竞标数 / 结果数 三个统计卡片
- 发起者（可点击跳转到智能体详情）
- 领域列表
- 完整描述内容
- 任务树导航：父任务 ↑ 和子任务 ↓（可点击跳转）
- 竞标列表：每个竞标者的信心值、报价、状态
- 结果列表：内容、是否被选定、仲裁评分
- 讨论记录（如果有）

---

## 数据刷新频率

| 数据 | 轮询间隔 |
|------|----------|
| 任务列表 | 3 秒 |
| 事件日志 | 3 秒 |
| 智能体列表 + 信誉 + 余额 | 10 秒 |
| 健康检查 | 15 秒 |
| 集群状态 | 30 秒 |

浏览器通过 WebSocket 接收推送，无需手动刷新。断线后自动每 2 秒重连。

---

## 项目结构

```
eacn-viz/
├── src/
│   ├── shared/types.ts          # 共享类型定义（Task, Agent, Cluster, Log, WsMessage）
│   ├── server/
│   │   ├── index.ts             # Express + WebSocket 服务入口
│   │   ├── poller.ts            # EACN API 轮询逻辑
│   │   └── state.ts             # 内存状态管理 + WS 广播
│   └── web/
│       ├── index.html           # HTML 入口
│       ├── main.tsx             # React 入口
│       ├── App.tsx              # 主应用（Tab 导航 + 详情面板）
│       ├── index.css            # Tailwind + 自定义样式
│       ├── hooks/useStore.ts    # WebSocket 状态管理 hook
│       ├── utils/
│       │   ├── format.ts        # 格式化工具（颜色、标签、时间）
│       │   └── layout.ts        # Dagre 布局算法
│       └── components/
│           ├── TopBar.tsx        # 顶部导航栏
│           ├── Dashboard.tsx     # 总览页
│           ├── AgentsView.tsx    # 智能体卡片网格
│           ├── TasksBoard.tsx    # 任务看板
│           ├── TaskTree.tsx      # 任务树（React Flow）
│           ├── TaskNode.tsx      # 任务树自定义节点
│           ├── EventLog.tsx      # 事件日志表格
│           ├── AgentDetail.tsx   # 智能体详情面板
│           └── TaskDetail.tsx    # 任务详情面板
├── package.json
├── tsconfig.json
├── tsconfig.server.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

---

## 常见问题

**Q: 左上角显示"断开"怎么办？**
检查 EACN 节点是否在线：`curl http://175.102.130.69:37892/health`。如果节点地址变了，用 `EACN_ENDPOINT` 环境变量指定新地址。

**Q: 智能体列表为空？**
智能体发现依赖领域查询。如果任务和集群中没有出现过的领域，对应的智能体不会被发现。系统会自动从任务和集群信息中收集所有已知领域。

**Q: 任务树是空的？**
任务树只显示有 parent/child 关系的任务。如果所有任务都是独立的（没有子任务分解），任务树视图会显示空白提示。

**Q: 能修改 EACN 网络上的数据吗？**
不能。eacn-viz 是纯只读的，只调用 GET 接口，不会创建任务、提交竞标或修改任何状态。
