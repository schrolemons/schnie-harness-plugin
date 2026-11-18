# 检索增强与来源卡片：DSH原生会话插件

在DSH原生输入框提问，插件先向配置的接口取回检索证据，再让当前会话选中的模型结合原问题、证据和输出格式说明生成答案，最后显示正文与可跳转来源卡片。

0.4.0默认沿用DSH的提供方、模型、凭据与思考设置。无需在检索后端再填写LLM配置，也不需要选择插件专用模型。插件只向检索接口发送最新用户问题和请求编号；DSH系统提示词、历史对话、模型Key不上传到检索后端。证据随后进入DSH本来的会话模型。

## 默认链路：当前会话模型

```text
DSH原生输入框
 → 插件调用POST /api/retrieve
 → 后端返回来源片段与元数据总览（不调用LLM）
 → 插件通过agent/pre-step把证据和格式说明加入会话
 → 当前会话选中的DSH模型生成answer/info_card
 → 插件校验JSON、来源白名单和引用顺序
 → DSH原生正文 + 插件引用卡片
```

模型调用只发生在DSH。插件不修改思考模式；保留宿主提供的思考展示和用量统计，最终答案只采用正文，不将reasoning内容冒充回答。结构化JSON完整校验后才交付正文，因此不将答案展示描述为逐token输出。

引用映射以插件自己的会话记录保存，并与轮次、步骤、实际模型及完整正文绑定。刷新后重新校验和展示。规范化后的正文不复用原始JSON对应的提供方回放元数据，避免缓存与正文不一致。

## 安装与配置

需要Node.js22.19+、DSH0.2.1-rc.2至0.2.x。先在独立DSH_HOME中安装和验收，避免已有profile热加载连带影响其他服务。

```sh
npm ci
npm test
npm run pack:release
```

```powershell
$env:DSH_HOME = Join-Path $env:USERPROFILE '.dsh-rag-demo'
npx @deepseek-ai/dsh@0.2.2-rc.1 plugin --profile web add /absolute/path/to/dsh-schnie-archive-0.4.0.tgz
npx @deepseek-ai/dsh@0.2.2-rc.1 --profile web --host 127.0.0.1 --port 3218
```

也可使用已安装DSH自带CLI。安装与启动使用同一个DSH_HOME和profile。当前宿主对自定义插件表单的展示有差异，已验证的通用配置方式是在profiles/<profile>/cordis.patch.yml中合并已有条目的config：

```yaml
- id: schnie-archive
  config:
    mode: session-model
    endpoint: https://your-service.example.com/api/retrieve
    accessToken: your-own-retrieval-access-token
    timeoutMs: 25000
```

不要重复插入同一个id。endpoint支持HTTPS或回环HTTP；访问令牌仅由DSH服务端使用，并在宿主配置投影中脱敏。也可通过DSH_SSE_ENDPOINT和DSH_SSE_ACCESS_TOKEN提供地址与令牌，profile非空设置优先。接口为空时插件不接管普通会话。

保留原有DSH模型选择即可。当前默认模式面向文档问答：通过DSH官方智能体级限制关闭该问答模式的能力工具，请求模型输出固定JSON，不执行本次模型提出的工具调用；普通工具任务应使用未启用该问答接入的会话配置。检索失败或模型格式无效时明确报错，不将无依据答案标为成功引用。

## 可替换的接口

默认模式只要求info-card-evidence/1，后端可以用向量、全文搜索、数据库或其他方法提供证据，不强制依赖RAG、Redis或Upstash。参见[协议](docs/protocol.md)。

如果后端已经完成模型生成，可显式使用兼容模式mode: external-sse，并把endpoint指向完整info-card-sse/1接口；再在DSH中选择“外部问答（SSE）”。这一模式不额外调用DSH模型。非RAG协议示例npm run demo:sse仅适用于该兼容模式。0.3.0的外部流配置升级后请显式保留external-sse；新配置默认使用当前会话模型。

## 边界与验证

只采用本轮白名单来源，按used与连续order展示。used是模型的引用声明，不保证语义正确。卡片摘要按纯文本显示，网址只允许HTTPS或回环HTTP，无URL内凭据；不执行HTML。

输入最多8000字符，检索响应最多1MiB、10条来源、60000字符片段，单条片段最多6000字符。完整答案最多64000个Unicode码点。模型Key不进入插件客户端或检索后端；DSH按宿主机制保存会话、证据和引用记录。

本地检查：npm test、npm run build:client、npm run check、npm run privacy:check。见[架构](docs/architecture.md)与[验证记录](VALIDATION.md)。仓库不添加自动Actions。
