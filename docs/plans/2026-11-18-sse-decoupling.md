# DSH原生会话SSE适配与参考RAG后端解耦计划

目标：两个仓库只通过info-card-sse/1协议协作，各自可以被其他实现替代。RAG仓库不交付聊天UI；插件不执行检索、不调用DSH模型、不依赖Redis或向量库。

1. 建立protocol/info-card-v1.mjs、JSON示例和协议文档。两仓库保留同版本副本，通过交叉测试核对哈希与兼容性，不建立运行时仓库依赖。
2. RAG使用services/cloudflare-turnstile、services/redis、services/vercel三个明确标注的模拟/执行边界；保留真实Upstash Vector适配、文档分块、元数据总览与安全增量同步。
3. Vercel处理链接收标准message/request_id请求，检索并组装证据，要求LLM生成answer/info_card JSON，校验来源白名单及引用顺序后输出SSE。模拟层不宣称具备云隔离、人机识别或分布式原子性。
4. 按用户最新选择接入DSH原生会话：注册external-sse模型适配路由。选中该路由后，原生输入框的问题交给配置的外部服务，避免DSH再生成一次回答；不声称实现自动语义分类。
5. 适配器解析有界SSE并转换为DSH原生正文流；完成校验的info_card存入该回答的提供方元数据。客户端通过正式会话事件和slot展示有序卡片，支持会话回放，不制作独立聊天面板。
6. 以不含RAG的独立SSE示例、真实HTTP和DSH独立实例验证替换性；真实Upstash接入须用户自行配置，缺少凭据时明确报配置错误。

验收：本地回归、跨仓库HTTP契约、浏览器可用性、无UI的后端输出、发布文件隐私检查。保持QQ相关配置和进程不变，不新增Actions。

协议：meta→status（可选）→text_delta→info_card→done；error终止。info_card包含id/title/url/excerpt/used/order。used仅为提供方的引用声明，不保证语义正确；插件仅展示used=true并按order排序的卡片。

后续确认：默认接入改为当前DSH会话模型。以agent/pre-step写入检索证据、llm/stream处理该次原始模型输出；不改写冻结请求，不强制思考设置。RAG增加无需LLM的/api/retrieve。引用独立保存在插件记录，external-sse仅作显式兼容模式。真实验收使用独立Vector分区和独立DSH，原网站和QQ不改动。
