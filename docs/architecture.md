# 架构

默认session-model模式使用DSH正式agent/pre-step和llm/stream钩子。输入通过source.kind=user识别，跳过时间等宿主注入消息。evidence-client向配置接口发送message/request_id及可选Bearer访问令牌，接收并校验info-card-evidence/1。

检索证据、元数据总览和公开通用的输出格式说明作为本次pre-step消息进入DSH正常日志与模型请求。插件不改写已冻结的LLM请求，不重新选择提供方或模型，不读取或转发DSH模型密钥，也不设置思考模式。

llm/stream包装next()的原始模型流，沿用宿主自己的模型适配器。思考块和用量保留；正文JSON缓存后经来源白名单与引用顺序校验，再转换成普通正文。错误、截断、工具调用及无效JSON不能生成成功卡片。

引用通过宿主导出的appendPluginRecord保存为plugin:dsh-schnie-archive/citations，属于插件自己的可忽略记录。其内容与实际提供方、模型、轮次、步骤和完整答案绑定，不修改提供方的原始回放结构。客户端以正式会话投影与conversation.chat.node槽位显示来源；原生正文组件保持使用。

兼容external-sse模式保留0.3.0的完整外部答案流适配器，仅在显式配置时注册外部模型路由。默认模式不注册替代模型。两个模式共用来源卡片校验与渲染。

RAG参考后端提供/api/retrieve供DSH模式使用，无需LLM配置；其独立/api/chat与CLI仍可自行调用部署者配置的模型。两仓库只共享协议文件，不存在运行时仓库依赖。

知识问答启用时，在agent/created与进入running状态时通过agent.ctx.tools.restrict({allow:[]})限制该智能体的能力工具，早于宿主工具集装配。接口关闭、智能体销毁及插件卸载时释放限制；不改写宿主冻结请求。无效JSON、空正文、工具调用结束均不得显示为成功答案。
