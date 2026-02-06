# Claude Web

Claude Code CLI 的可视化 Web UI。读取 Claude Code 本地会话数据，提供 ChatGPT 风格的网页界面进行对话。

## 功能

- **会话同步** - 直接读取 Claude Code CLI 的本地 JSONL 会话文件，网页和 CLI 共享同一份数据
- **会话管理** - 左侧边栏展示会话列表，支持新建、切换、删除
- **流式输出** - 类似 ChatGPT 的逐字流式显示
- **Markdown 渲染** - 支持代码高亮、表格、链接等完整 Markdown 语法
- **代码块** - 语法高亮 + 一键复制按钮
- **实时监听** - CLI 中产生的新会话/消息，网页自动刷新显示
- **停止生成** - 随时中断 AI 回复
- **Workspace 感知** - 自动识别项目根目录，加载对应项目的会话
- **Fallback 模式** - 检测不到 Claude Code 存储时自动切换为独立模式，UI 会明确标注

## 前提条件

- **Node.js** >= 18
- **Claude Code CLI** 已安装并可在终端中使用 `claude` 命令
- 已通过 Claude Code 完成认证（能正常使用 `claude` 命令对话）

## 安装

### 方式一：全局安装（推荐）

```bash
git clone https://github.com/cacdcaecawae/claude-ui.git
cd claude-ui
npm install
npm link
```

安装完成后，`claude-web` 命令会注册到系统 PATH，在任意目录可直接使用。

### 方式二：不全局安装

```bash
git clone https://github.com/cacdcaecawae/claude-ui.git
cd claude-ui
npm install
```

每次使用需指定完整路径：

```bash
node /path/to/claude-ui/bin/claude-web.mjs
```

## 使用

### 启动

在你的**项目目录**下执行：

```bash
cd ~/your-project
claude-web
```

它会：
1. 自动识别当前目录为 workspace（优先找 `.claude/` > `.git/` > `package.json`）
2. 启动本地服务 `http://localhost:3000`
3. 自动打开浏览器

### 指定端口

```bash
claude-web --port 8080
```

### 停止

终端按 `Ctrl + C`。

## 界面说明

```
┌─────────────────┬────────────────────────────────┐
│  Claude Web      │  会话标题                      │
│  [Native] ●      │                                │
│                  │  ┌──────────────────────────┐  │
│  + New Chat      │  │ User: 你好                │  │
│                  │  │                          │  │
│  会话 1          │  │ Assistant: 你好！有什么...  │  │
│  会话 2  ←活跃   │  │                          │  │
│  会话 3          │  └──────────────────────────┘  │
│                  │                                │
│                  │  ┌──────────────────────┬────┐ │
│                  │  │ 输入消息...           │ ➤  │ │
│                  │  └──────────────────────┴────┘ │
└─────────────────┴────────────────────────────────┘
```

- **左上角状态** - 绿色 `Native` 表示直接读取 Claude Code 会话；黄色 `Fallback` 表示独立模式
- **Enter** 发送消息，**Shift+Enter** 换行
- 生成中时发送按钮变为 **Stop** 按钮

## 同步机制

### Native 模式（默认）

Web UI 直接读取 `~/.claude/projects/` 下的 JSONL 会话文件：

- **CLI → 网页**：CLI 写入的消息通过文件监听（chokidar）实时推送到网页
- **网页 → CLI**：网页发送消息时调用 `claude --resume <session-id>` 写入同一个 JSONL 文件，CLI 可用 `claude --resume` 继续

### Fallback 模式

当检测不到 Claude Code 本地存储时自动启用：
- 会话保存在 `claude-ui/data/sessions/` 目录下
- 仍然通过 `claude` CLI 发送消息
- UI 顶部会显示黄色 `Fallback` 标记

## 项目结构

```
claude-ui/
├── bin/claude-web.mjs              # CLI 入口
├── package.json
├── src/
│   ├── app/
│   │   ├── layout.tsx / page.tsx   # 页面
│   │   └── api/                    # API 路由
│   │       ├── sessions/           # 会话 CRUD
│   │       ├── sync-status/        # 同步状态
│   │       └── watch/              # SSE 文件监听
│   ├── lib/
│   │   ├── adapter/                # 存储适配层
│   │   │   ├── detect.ts           # 探测 Claude 存储
│   │   │   ├── native.ts           # 原生 JSONL 适配器
│   │   │   └── fallback.ts         # Fallback JSON 适配器
│   │   ├── claude-process.ts       # CLI 进程管理
│   │   └── workspace.ts            # Workspace 探测
│   ├── components/                 # React 组件
│   └── hooks/                      # 自定义 Hooks
└── data/                           # Fallback 存储目录
```

## 技术栈

- **前端** - Next.js 15 + React 19 + TypeScript + Tailwind CSS 4
- **后端** - Next.js API Routes
- **流式传输** - Server-Sent Events (SSE)
- **CLI 通信** - child_process.spawn
- **Markdown** - react-markdown + remark-gfm + rehype-highlight
- **代码高亮** - highlight.js
- **文件监听** - chokidar

## 卸载

### 移除全局命令

```bash
cd /path/to/claude-ui
npm unlink
```

### 完全删除

```bash
npm unlink -g claude-web   # 移除全局命令
rm -rf /path/to/claude-ui  # 删除项目目录
```

## 安全说明

- 仅监听 `localhost`，不对外暴露
- 所有 API 路由包含路径遍历防护
- `claude` 进程始终以当前 workspace 为工作目录
- 不会主动修改 Claude Code 的原生存储文件（消息通过 CLI 写入）

## License

MIT
