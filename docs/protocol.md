# info-card-sse/1

本协议只约定输入和输出，与DSH、RAG和模型厂商无关。

## 请求

POST至部署者配置的接口，Content-Type为application/json，可选Authorization: Bearer <token>。

```json
{"message":"如何安装？","request_id":"example-request-1"}
```

message为1至8000字符的文本；request_id为1至128位字母、数字或._:-，首位为字母或数字。响应必须原样使用请求编号。

## 响应

Content-Type: text/event-stream; charset=utf-8。每帧event声明类型，id对应seq，data为单个JSON对象；seq从0连续递增，所有事件的request_id相同。不得混用OpenAI的[DONE]或其他原始流格式。

```text
id: 0
event: meta
data: {"request_id":"example-request-1","seq":0,"protocol":"info-card-sse","version":1}

id: 1
event: text_delta
data: {"request_id":"example-request-1","seq":1,"text":"先安装依赖。[1]"}

id: 2
event: info_card
data: {"request_id":"example-request-1","seq":2,"info_card":[{"id":"doc-1","title":"安装文档","url":"https://docs.example.com/setup","excerpt":"先安装依赖。","used":true,"order":1}]}

id: 3
event: done
data: {"request_id":"example-request-1","seq":3,"text_length":9,"card_count":1}

```

上面正文的text_length应按实际Unicode码点计算（JavaScript中为[...text].length）；实现应动态计算，不能照抄常量。

顺序：恰好一个meta；零个或多个status、text_delta；恰好一个info_card；最后done。卡片之后不得再发送正文。status包含stage字符串；错误使用error事件的code/message并结束，不再发送done。无来源也要发送info_card:[]。未知字段或类型拒绝处理。

| 卡片字段 | 约束 |
| --- | --- |
| id | 本轮唯一来源ID，1至128字符，字符集同request_id |
| title | 非空纯文本，最长160字符 |
| url | 最长2048字符，HTTPS或回环HTTP，无凭据、空白或控制字符 |
| excerpt | 可选纯文本摘要，最长1200字符 |
| used | 后端声明是否实际引用，不是语义正确性的保证 |
| order | used=true时按正文首次引用从1连续编号；未采用时为null |

仅展示used=true卡片，按order排序。正文可使用[1]等编号指向卡片。done.text_length是所有text_delta拼接后的Unicode码点数，card_count仅计used=true。最多10张卡片、64000个正文码点、1MiB响应；单个正文增量最长8192个UTF-16单元。流截断、重复卡片、编号跳跃、危险网址或计数不一致均不采纳卡片。

RAG参考后端额外校验正文引用编号与模型采用声明一致，且卡片标题、网址来自本轮证据白名单。通用协议接收方只能校验数据结构，不能证明模型确实阅读或正确理解了来源。

## 当前会话模型接入：info-card-evidence/1

POST /api/retrieve仍使用message/request_id和可选Bearer令牌；不发送提供方、模型、模型Key、历史或系统提示词。响应为application/json：

```json
{"protocol":"info-card-evidence","version":1,"request_id":"example-request-1","sources":[{"id":"doc-1","title":"安装文档","url":"https://docs.example.com/setup","text":"先安装依赖。"}],"overview":"已生成的元数据总览"}
```

检索后端不调用LLM。DSH插件把问题与证据交给当前会话模型，并要求正文输出：

```json
{"answer":"先安装依赖。[1]","info_card":[{"id":"doc-1","used":true,"order":1}]}
```

模型不得填写标题、网址或摘要。插件从本次证据白名单补齐卡片，再校验正文引用和采用顺序。思考模式由DSH维持；模型思考内容不作为上述answer解析。

证据响应最多1MiB、10条来源，总片段最多60000字符、每条最多6000字符；总览最多512KiB。格式错误、请求身份不符或危险网址会在进入模型前拒绝。该路径不要求把DSH模型密钥配置到RAG后端。
