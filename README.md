# Translator for VS Code

翻译 VS Code 中的选中文本和语言扩展提供的 Hover 文档，在右侧结果面板查看原文和译文。

支持 OpenAI、DeepSeek、Z.AI、OpenAI-compatible 等 LLM 服务，以及 Google、DeepL 和百度。LLM 服务通过 `@earendil-works/pi-ai` 接入。

## 功能

- 翻译选中文本或 Hover 文档，保持编辑器焦点。
- 在同一个面板中保留翻译卡片，支持多个请求独立更新和失败重试。
- 翻译并替换选中文本，支持撤销。
- 自动缓存翻译结果，减少重复 API 调用。
- 通过状态栏切换翻译服务，通过命令面板切换服务和目标语言。

## 要求

- VS Code >= 1.120.0。
- 根据所选服务配置凭据：LLM 服务需要 API Key 和模型 ID，DeepL 需要 API Key，百度需要 APP ID 和 Secret。Google API Key 可选，留空时使用非官方免费接口。

## 使用方式

### 翻译选中文本

1. 在编辑器中选中文本。
2. 按 `Cmd+Alt+T`（macOS）或 `Ctrl+Alt+T`（Windows / Linux），在右侧结果面板查看原文和译文。

需要直接替换原文时，按 `Cmd+Alt+R`（macOS）或 `Ctrl+Alt+R`（Windows / Linux）。如果文档在翻译期间发生变化，扩展不会执行替换。

点击状态栏中的翻译服务项可切换服务。切换目标语言时，在命令面板执行 `Translate: Switch Target Language`。

### 翻译 Hover 文档

1. 将鼠标悬停在函数、类型或其他符号上，点击 Hover 中的「翻译」。
2. 扩展重新读取文档，在右侧结果面板展示原文并开始翻译。

文档来自 VS Code 的 `vscode.executeHoverProvider`，依赖对应语言扩展。仅当文档包含可翻译正文时，Hover 才显示「翻译」入口；普通悬停会查询文档，但不会调用翻译服务。

Markdown 围栏代码块和缩进代码块原样保留，不发送给翻译服务；行内代码随正文发送。扩展不解析源码注释，不读取诊断报错、调试值等其他浮窗内容，也不修改原生 Hover。

点击前或读取期间，源文档发生修改或关闭时，需要重新悬停。成功读取后使用文档快照，翻译失败重试时不重新读取文档。

### 结果面板

选区翻译和 Hover 翻译共用一个面板。每次请求在底部追加卡片并滚动到该卡片，编辑器保持焦点。

- 原文在上，默认折叠；译文在下，默认展开，两部分可独立折叠。
- 「译文」行显示翻译服务、LLM 模型和本次耗时。非 LLM 服务不显示模型；模型名称过长时，可悬停查看完整名称。
- 加载状态、错误和空文档提示显示在对应卡片的译文区域。失败后点击「重试」，沿用原请求配置，在原卡片更新状态和结果。
- 耗时包含文档读取和翻译等待，在成功或失败后显示。重试重新计时，缓存命中也按本次请求计时。

卡片历史仅在当前面板内保留，关闭面板后清空。已发送的请求仍可能完成并进入缓存，但不会重新打开面板或影响重新打开后的卡片。

### 使用边界

- 选区翻译无需语言扩展。代码、注释和 Markdown 均作为普通文本发送给翻译服务，保留首尾空白，不自动跳过代码块。
- 翻译使用触发时的服务和语言配置，结果对应选区或 Hover 文档快照，不随之后的选区或编辑自动更新。
- 面板按 Markdown 排版原文和译文。原始 HTML 被禁用，链接仅显示文字，图片仅显示替代文字，不执行脚本、命令或外部资源请求。
- 查看译文不会修改源码。「翻译并替换」在执行替换前检查文档版本，并通过 VS Code 文本编辑支持撤销。
- 相同文本、服务和语言对的翻译结果可复用缓存。

## 扩展设置

### 服务与语言

| 设置                    | 说明                                                                                         | 默认值   |
| ----------------------- | -------------------------------------------------------------------------------------------- | -------- |
| `translator.provider`   | 翻译服务：`openai` / `deepseek` / `zai` / `openai-compatible` / `google` / `deepl` / `baidu` | `google` |
| `translator.targetLang` | 目标语言代码，如 `zh-CN`、`en`、`ja`、`fr`                                                   | `zh-CN`  |
| `translator.sourceLang` | 源语言代码，`auto` 表示自动检测                                                              | `auto`   |

### LLM 服务

| 设置                       | 说明                                                                                 | 默认值         |
| -------------------------- | ------------------------------------------------------------------------------------ | -------------- |
| `translator.apiKey`        | 当前 LLM 服务的 API Key                                                              | 空             |
| `translator.model`         | 模型或推理接入点 ID                                                                  | `gpt-5.4-mini` |
| `translator.thinkingLevel` | 思考档位：`off` / `minimal` / `low` / `medium` / `high` / `xhigh` / `max`            | `off`          |
| `translator.baseUrl`       | 仅 `openai-compatible` 使用的基础地址，包含 API 版本路径，不包含 `/chat/completions` | 空             |

切换 LLM 服务时，需同时更新 API Key 和模型。内置服务使用 pi-ai 模型目录中的 ID 和 SDK 自带端点；`openai-compatible` 支持自定义模型或推理接入点 ID。

内置模型不支持的思考档位会在请求前报错，兼容接口的支持情况由服务端校验。兼容接口通过 SDK 按端点识别协议差异，未知端点使用 OpenAI Chat Completions 的 `reasoning_effort`。模型不支持该参数或不能关闭思考时，需要选择匹配的模型和档位。思考内容不作为译文展示。

#### DeepSeek

使用 SDK 内置端点和模型信息：

```json
{
  "translator.provider": "deepseek",
  "translator.apiKey": "你的 DeepSeek API Key",
  "translator.model": "deepseek-flash",
  "translator.thinkingLevel": "low"
}
```

#### OpenAI-compatible

智谱、Z.AI 普通 API、火山方舟及其他兼容接口使用 `openai-compatible`。以下为火山方舟配置示例：

```json
{
  "translator.provider": "openai-compatible",
  "translator.apiKey": "你的 API Key",
  "translator.model": "你的模型或推理接入点 ID",
  "translator.thinkingLevel": "off",
  "translator.baseUrl": "https://ark.cn-beijing.volces.com/api/v3"
}
```

其他基础地址：

- 智谱普通 API：`https://open.bigmodel.cn/api/paas/v4`。
- Z.AI 普通 API：`https://api.z.ai/api/paas/v4`。

内置 `zai` 使用 pi-ai 的 Coding Plan 端点，不是 Z.AI 普通 API。使用前请确认套餐允许该用途。

### Google、DeepL 和百度

| 设置                       | 说明                                                       | 默认值 |
| -------------------------- | ---------------------------------------------------------- | ------ |
| `translator.google.apiKey` | Google Cloud Translation API Key，留空时使用非官方免费接口 | 空     |
| `translator.deepl.apiKey`  | DeepL API Key                                              | 空     |
| `translator.deepl.useFree` | 使用 DeepL 免费接口                                        | `true` |
| `translator.baidu.appid`   | 百度翻译 APP ID                                            | 空     |
| `translator.baidu.secret`  | 百度翻译 Secret                                            | 空     |

### 旧设置迁移

扩展不会自动迁移旧设置，请手动修改：

- `translator.openai.apiKey` → `translator.apiKey`。
- `translator.openai.model` → `translator.model`。
- `translator.openai.baseUrl` 已移除。使用自定义端点时，选择 `openai-compatible` 并填写 `translator.baseUrl`。

## 命令与快捷键

| 命令                                         | 命令 ID                          | macOS       | Windows / Linux |
| -------------------------------------------- | -------------------------------- | ----------- | --------------- |
| `Translate: Translate Selected Text`         | `translator.translateSelection`  | `Cmd+Alt+T` | `Ctrl+Alt+T`    |
| `Translate: Translate and Replace Selection` | `translator.translateAndReplace` | `Cmd+Alt+R` | `Ctrl+Alt+R`    |
| `Translate: Switch Provider`                 | `translator.pickProvider`        | —           | —               |
| `Translate: Switch Target Language`          | `translator.pickTargetLang`      | —           | —               |

## 发布前检查

发布前执行类型检查、Lint 和生产构建：

```sh
npm run package
```

打包 VSIX：

```sh
npx @vscode/vsce package
```

## 问题反馈

如遇问题，请提交 [Issue](https://github.com/saltfishpr/vscode-translator/issues)。
