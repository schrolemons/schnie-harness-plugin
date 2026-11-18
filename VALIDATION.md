# 验证记录：0.3.0

本地21项测试通过，包含协议解析、真实Cordis/LlmRuntime挂载与卸载、回环HTTP、正文转换和会话卡片投影。测试验证只读取source.kind=user的当前问题，跳过宿主时间消息；session-title辅助调用本地完成，不发送到外部接口。

在独立DSH0.2.1-rc.2环境实际安装了打包产物，使用原生输入框和“外部问答（SSE）”路由完成两条验收链：

- 无RAG示例服务：用户文本→SSE正文→来源跳转卡片→展开纯文本摘要。
- RAG参考仓库的Vercel处理函数：原生问题→真实回环HTTP→模拟基础设施/显式Vector与LLM替身→结构化校验→正文与卡片。刷新会话后，引用元数据仍可恢复。

这些检查证明插件与参考处理链可以对接，不证明真实Upstash云索引、真实LLM效果、Cloudflare人机识别或Redis分布式状态已验收。独立实例的自定义插件详情页未展示配置字段；profile配置和宿主脱敏配置接口已验证，文档据此说明配置路径。

验收仅更新独立DSH环境，未安装到运行QQ服务的profile。当前包不依赖QQ服务、检索工具或作者知识库。未新增Actions。

本地检查入口：npm test、npm run build:client、npm run check、npm run privacy:check、npm run pack:release。
