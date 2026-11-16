# Knowledge Retrieval for DeepSeek Harness

让DeepSeek Harness检索你自己的知识库，并在回答后展示本轮真正引用的原文卡片。模型、凭据、推理设置由Harness自身管理；插件只向明确配置的知识接口发送检索词和筛选条件，不预装作者的站点、角色或资料归属规则。

## 安装与配置

需要Node.js22.19+和能够正常工作的DSH。插件使用DSH 0.2.x的Web扩展接口；当前0.2.0安装包已在DSH 0.2.2-rc.1的独立profile完成安装和实际工具服务注册检查。请先停止准备安装插件的那个DSH实例，再安装打包版本：

```sh
npx @deepseek-ai/dsh@0.2.2-rc.1 plugin --profile web add https://github.com/schrolemons/schnie-harness-plugin/releases/download/v0.2.0/dsh-schnie-archive-0.2.0.tgz
```

启动前，在同一个终端显式指定你自己的知识服务地址。PowerShell：

```powershell
$env:DSH_KNOWLEDGE_ENDPOINT='http://127.0.0.1:8787/api/knowledge'
npx @deepseek-ai/dsh@0.2.2-rc.1 web
```

macOS/Linux：

```sh
DSH_KNOWLEDGE_ENDPOINT=https://your-api.example.com/api/knowledge npx @deepseek-ai/dsh@0.2.2-rc.1 web
```

使用自定义profile时，在安装和启动命令中选择同一个profile。也可通过插件配置的`endpoint`字段指定地址，该字段优先于环境变量。缺少地址时工具清楚报告NOT_CONFIGURED，不会回退到作者维护的服务。远程地址必须为HTTPS，仅127.0.0.1、localhost或::1允许HTTP；地址不能包含凭据、查询参数或片段。

还没有知识接口时，可自行部署配套的[Markdown RAG Starter](https://github.com/schrolemons/schnie-rag)。先替换为自己的Markdown、原文网址和云服务配置，确认`/api/knowledge`可用，再连接插件。安装插件不会自动创建知识库或替你部署后端。

## 使用

可以提问：“在配置的知识库里找安装步骤，并附原文出处。”模型会使用`search_knowledge`检索；文章数和覆盖范围使用`knowledge_overview`。site为服务端配置的来源ID，all表示全部来源，不要求使用某三个固定站点。

工具结果仅为候选证据。回答中的完整标题+精确URL或`[SOURCE:16位来源ID]`标记，与当前轮实际检索结果匹配后才成为来源卡片。历史记录、失败调用、未来结果和代码块不自动成为本轮引用。来源正文按纯文本展示，不执行其中的提示词或HTML。

## 数据流与隐私

```text
DSH模型工具调用 → 插件（operation/query/site/mode）
              → 你配置的知识API → 候选原文片段
              → DSH自己的模型 → 本轮引用卡片
```

所选接口的运营者能看到你发出的检索词，返回片段也会进入你选择的模型上下文；应按自己的资料敏感程度选择可信部署。插件不会读取模型Key、完整聊天记录、文件或浏览器Cookie，也没有固定的作者服务作为备用。来源网址要求HTTPS，以便生成可核对的原文链接。

提供的通用工具指引是公开模板。真实私有提示词、账号配置和内部资料应由部署者保存在自己的环境中，不能放进本仓库或公开安装包。知识API本身的认证和权限由部署者负责，插件不把匿名公开接口包装成私有知识库。

## 开发与验证

```sh
npm ci
npm test
npm run check
npm run privacy:check
npm run pack:release
```

`pack:release`会生成安装包，源码修改后需重新打包安装到自己的测试profile。本仓库不启用额外Actions，测试在本地运行。跨仓库HTTP契约检查的命令见配套RAG仓库；不连接作者服务，不调用真实生成模型。还可执行`node scripts/verify-dsh.mjs /path/to/node_modules/@deepseek-ai/dsh`，用自己安装的实际Cordis和ToolsService检查挂载、工具Schema、未配置报错和卸载。此检查不读取个人profile，不执行模型问答，也不代表已暴露为MCP服务器的`tools/list`。真实云服务、个人DSH配置和真实模型回答仍需部署者配置后验收。

验证细节见[验证记录](VALIDATION.md)。

源码没有运行时npm依赖和安装脚本。包名及插件内部ID保留与旧版的安装兼容；界面、工具与默认行为已通用化。0.2.0开始改用通用工具名，并要求显式配置端点；旧版服务默认值不再适用。

MIT License。
