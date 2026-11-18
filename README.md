# 外部问答与来源卡片：DSH原生会话插件

在DeepSeek Harness原生会话中输入问题，由插件请求外部SSE服务，把正文流与引用卡片显示在同一条回答中。插件负责DSH接入、输入转交、流式适配与卡片渲染，不负责检索、嵌入或调用DSH自己的模型。

后端可以是RAG、普通模型接口、数据库服务或固定规则程序，只需实现[info-card-sse/1协议](docs/protocol.md)。本仓库的非RAG示例可独立运行；没有强制配套后端，也不依赖Redis、Upstash或作者的网站。

## 工作方式

```text
DSH原生输入框（选中“外部问答（SSE）”）
  → 服务端适配器：提取最新一条用户文本
  → 配置的POST接口：message + request_id
  → 外部服务：meta / text_delta / info_card / done
  → 适配器：校验协议、转换为DSH正文流
  → DSH保存回答及引用元数据
  → 客户端扩展：在该回答下展示可跳转的来源卡片
```

这是模型路由选择，不是自动语义分类。选择其他模型时仍由其他模型回答；选择外部问答后，DSH不会再调用第二个模型重写外部答案。历史压缩辅助调用会明确拒绝，不会转成外部问答。当前版本只传最新问题，历史对话、附件、系统提示词与DSH模型密钥不上传，因此后端应按单次问答处理。来源卡片只在完整流通过校验后显示，失败回答可能保留部分正文，但不会被标记为成功引用。

## 本地开发与协议演示

需要Node.js22.19+。目标宿主为DSH0.2.1-rc.2至0.2.x，使用正式LLM适配器与会话扩展接口。

```sh
npm ci
npm test
npm run build:client
npm run check
npm run privacy:check
npm run pack:release
npm run demo:sse
```

演示服务监听`http://127.0.0.1:8788/api/chat`，访问令牌为`example-only-token`。这是明确标注的固定答案服务，不检索、不调用LLM，用于证明插件可以脱离RAG使用。仅绑定回环地址；不要将演示令牌作为公开服务的凭据。

## 安装与设置

先打包，将生成的tgz安装到独立DSH环境。以下PowerShell示例使用新的DSH_HOME，避免已有profile的热加载连带影响其他插件或服务：

```powershell
$env:DSH_HOME = Join-Path $env:USERPROFILE '.dsh-sse-demo'
npx @deepseek-ai/dsh@0.2.2-rc.1 plugin --profile web add /absolute/path/to/dsh-schnie-archive-0.3.0.tgz
npx @deepseek-ai/dsh@0.2.2-rc.1 --profile web --host 127.0.0.1 --port 3218
```

也可使用已安装DSH自带的CLI，安装与启动必须使用同一个DSH_HOME和profile。不要在承担其他服务的profile中为验收而安装或重启。

在当前profile的cordis.patch.yml中，为schnie-archive条目填写配置；也可通过启动环境变量提供地址与令牌。宿主版本对自定义插件表单的展示有所差异，本次验证不依赖详情页表单：

| 字段 | 含义 |
| --- | --- |
| endpoint | 支持协议的完整POST地址；HTTPS或回环HTTP |
| accessToken | 可选Bearer令牌，仅由DSH服务端使用 |
| timeoutMs | 完整请求超时，默认60000毫秒 |

profile中的非空设置优先，也可通过`DSH_SSE_ENDPOINT`、`DSH_SSE_ACCESS_TOKEN`提供配置。例如已有条目时合并以下config（不要重复插入同一个id）：

```yaml
- id: schnie-archive
  config:
    endpoint: http://127.0.0.1:8788/api/chat
    accessToken: example-only-token
    timeoutMs: 60000
```

字段由宿主volatile配置机制读取，访问令牌在配置投影中脱敏。DSH标题辅助调用在本地返回“外部问答”，不向外部服务发送额外请求。设置后，在原生会话的模型选择器中选择“外部问答（SSE）/answer”，输入问题即可。没有接口地址时明确报错，不连接作者的服务。

## 输出与安全边界

正文通过DSH原生消息显示，卡片按`used=true`与连续`order`展示；支持跳转与展开纯文本摘要。元数据随回答持久化，重新打开会话时重新校验。`used`是后端声明，插件不能证明引用在语义上正确。

仅接受有界、顺序完整、同一请求身份的协议流；最多1MiB响应、64000个正文码点、10张卡片。链接只允许HTTPS或回环HTTP，无URL内凭据；不执行卡片HTML。接口由部署者配置，普通会话不能指定目标地址。DSH本身仍会按宿主机制保存输入、正文和引用元数据。

0.3.0已替换旧版`search_knowledge/knowledge_overview`方案，不再访问`/api/knowledge`。旧配置中的`cacheMs`不再使用；请改为外部问答接口与访问令牌。包名保留仅为升级兼容。

更多内容见[架构](docs/architecture.md)、[协议](docs/protocol.md)、[验证边界](VALIDATION.md)。本项目不添加自动Actions。
