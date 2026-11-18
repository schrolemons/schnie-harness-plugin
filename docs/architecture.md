# 架构

## 服务端：DSH中的输入与流适配

index.js注册external-sse提供方与answer模型。lib/native-adapter.mjs继承DSH的LlmAdapter，直接进入宿主原生会话流程。每次调用读取最新配置，从消息数组中仅提取source.kind=user的最后一条用户文本，跳过时间等宿主注入消息，生成request_id，再通过服务端HTTP发送到指定接口。不发送系统提示词、聊天历史、工具结果或宿主模型凭据。

protocol/info-card-v1.mjs增量解析UTF-8和SSE，核对请求身份、事件序号、字节上限、卡片字段与结束计数。text_delta转换为宿主正文增量；完整结束后，卡片进入本次回答的replayState.response。请求失败、超时或取消时不写入成功卡片，且不自动重试造成重复调用。

## 客户端：DSH中的输出与回放

ui/native-cards.js注册正式会话事件投影和conversation.chat.node槽位。它只读取external-sse/answer的assistant/message事件，校验回答长度与引用元数据，再在对应回答后创建来源节点；不替换原生正文组件。中断事件、重试状态和无效元数据隐藏节点。卡片正文由React按纯文本渲染，链接带noopener/noreferrer。

scripts/build-client.mjs将客户端与协议打包为宿主ModuleLoader可加载的client.js，React由宿主提供。客户端没有访问令牌，也不直接请求问答后端。

## 外部服务

插件只要求info-card-sse/1，不规定检索方式、LLM厂商或存储。examples/sse-server.mjs是无RAG、无模型的协议演示。参考RAG实现可以复用同一协议，但不构成安装依赖。

当前版本是单次问答路由，不实现自动意图判断、附件解析、工具调用或多轮后端记忆。后端可以真正逐token输出；如果后端为先校验结构化结果再分块发送，插件显示的是该分块流，不把它描述为上游模型实时流。
