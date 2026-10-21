# SCHNIE Archive for DeepSeek Harness

给 DeepSeek Harness 增加 SCHNIE／第九边缘公开知识库检索与原文链接。模型、API Key、推理强度沿用用户自己的 Harness 配置。

## 安装

需要 Node.js 22.19+，以及已能正常对话的 DeepSeek Harness。已在 Windows、Node.js 24.16.0、DSH 0.2.1-rc.2 的 Web UI 验证。

关闭正在运行的 Harness 后执行：

```sh
npx @deepseek-ai/dsh@0.2.1-rc.2 plugin --profile web add https://github.com/schrolemons/schnie-harness-plugin/releases/download/v0.1.0/dsh-schnie-archive-0.1.0.tgz
npx @deepseek-ai/dsh@0.2.1-rc.2 web
```

使用自定义 profile 时，将 `web` 改成你的 profile 名称。安装包已包含浏览器入口，无需构建、下载知识库或填写数据库凭证。首次配置 Harness 自身的模型/登录仍由 Harness 完成。

可以直接提问：

- “在 SCHNIE 知识库检索金泽范式，简单解释，并附原文链接。”
- “从本站找两篇适合了解阴行世界的文章，说明推荐理由。”
- “ZERO 网站目前收录了多少篇 Markdown 文章？”

涉及知识库时，模型使用 `search_schnie` 检索，统计问题使用 `schnie_overview`。通用聊天无需检索。回答附自然的 Markdown 原文链接，底部仅列出本轮回答确实引用的来源；不把全部检索候选自动列成推荐。

## 数据与凭证

请求默认发送到作者维护的 [Vercel 检索服务](https://launcher.sch-nie.com/api/knowledge)，复用现有 BLOG、WORLD、ZERO 的公开资料与向量索引。插件只发送本次检索词、网站范围与检索模式；不会读取或发送用户的模型 Key、完整会话、文件或模型参数。模型调用继续由 Harness 管理。

向量库、Redis 与既有 embedding 服务凭证保留在 Vercel 环境变量中。公开插件不包含服务端密钥。公开接口本身可以被他人调用，隐藏凭证并不等于调用者已获得身份认证；服务保留宽松的基础限流、查询长度与超时保护。插件不提供作者付费的生成模型代理。

知识库需要联网，依赖作者服务可用性。检索结果是候选证据，模型仍可能误解原文；链接用于核对出处。未检索到与服务故障均不代表资料不存在。总览统计仅涵盖已采集的 Markdown 范围，不含未解析的 PDF、HTML 测试与图片文字。

## 界面与引用

插件使用 Harness 官方 Conversation 节点与 slot 扩展，保留原生回答、流式输出和其他插件。检索时在输入区上方显示实时状态；工具记录显示检索进度和候选数量；回答下方显示简洁的来源卡片，可以展开检索到的原文片段并直达原文。没有额外模型设置、内容分类、评分或固定四张推荐卡。支持同一轮多次检索、历史重放及中断回答；其他轮次、未来结果、失败调用和代码示例不会被当成本轮来源。

自然链接必须匹配本轮检索结果的完整标题和精确网址。也支持工具提供的 `[SCHNIE:16位来源ID]` 引用标识。多个片段指向同一篇文章时合并显示。

![真实 Harness Web UI 中的来源卡片](https://raw.githubusercontent.com/schrolemons/schnie-harness-plugin/main/docs/images/source-card.png)

## 卸载

```sh
npx @deepseek-ai/dsh@0.2.1-rc.2 plugin --profile web remove dsh-schnie-archive
```

重启 Harness 即可。

## 开发

```sh
npm ci
npm test
npm run check
mkdir release
npm run pack:release
```

无运行时 npm 依赖，无安装脚本。`index.js` 注册只读工具和附加指引；`client.js` 为可直接加载的浏览器入口；`lib/knowledge-client.js` 负责匿名 HTTPS 请求、取消、缓存与响应校验。服务端实现位于现有 [launcher 仓库](https://github.com/schrolemons/launcher.github.io)，入口为 `api/knowledge.js`。

MIT License。
