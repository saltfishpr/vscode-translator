# Translator for VS Code

使用多种 LLM 服务及 Google / DeepL / 百度，翻译选中文本和语言扩展提供的 Hover 文档。

## 功能

- 支持通过 `@earendil-works/pi-ai` 接入的 OpenAI、DeepSeek、Z.AI 和 OpenAI-compatible 等 LLM 服务，以及 Google、DeepL 和百度。
- 翻译选中文本，在右侧 Webview Panel 中展示原文和译文。
- 翻译并替换选中文本。
- 在 Hover 中点击「翻译」，在右侧 Panel 展示文档原文和译文；Markdown 代码块原样保留，不发送给翻译服务。
- 翻译结果自动缓存：相同文本、相同服务和语言对的结果会被复用，减少重复 API 调用。
- 通过命令面板或状态栏快速切换翻译服务和目标语言。

## 使用方式

1. 在编辑器中选中文本。
2. 执行 `Translate: Translate Selected Text` 在右侧查看原文和译文，或执行 `Translate: Translate and Replace Selection` 直接替换原文。
3. 需要切换服务时，点击状态栏中的翻译服务项，或执行 `Translate: Switch Provider`。
4. 需要切换目标语言时，执行 `Translate: Switch Target Language`。

### 翻译 Hover 文档

1. 将鼠标悬停在编辑器中的符号上，点击 Hover 中的「翻译」。仅浏览 Hover 不会调用翻译服务。
2. 扩展重新获取该位置所有 HoverProvider 返回的文档，在右侧 Panel 显示加载状态、原文和译文，不改变原有 Hover 或编辑器选区。
3. Markdown 围栏代码块（反引号、波浪线）、缩进代码块以及列表、引用中的代码块均原样保留，不发送给翻译服务。旧版 Hover 的 `{ language, value }` 内容同样视为代码块。
4. Panel 显示目标语言、翻译服务和耗时；失败后可点击「重试」。关闭 Panel 后，完成的请求不会重新打开它。相同正文片段可复用翻译缓存。

### 语言支持与边界

- 支持所有通过 VS Code HoverProvider 提供文档的语言扩展，包括 Go package 文档；不再解析源码或依赖“转到定义”。
- 「翻译」入口按词范围显示，因此没有文档的词也可能出现入口。文档为空或仅包含代码块时，Panel 提示没有可翻译正文，不调用翻译服务。
- VS Code 公共 API 不能读取已渲染浮窗的 DOM。点击时会重新查询 HoverProvider，结果不保证包含诊断信息、调试器内容等其他浮窗元素。
- Panel 沿用纯文本展示，保留 Markdown 源文本，不执行文档或译文中的 HTML、脚本及链接。代码块之外的 Markdown 格式、链接和行内代码由翻译服务处理。
- 原有 Hover 内容保持不变；多个 HoverProvider 的最终排列顺序由 VS Code 决定。

## 要求

- VS Code 版本 >= 1.120.0
- 根据所选翻译服务配置相应凭据：
  - LLM：对应服务的 API Key 和模型 ID；仅自定义 OpenAI-compatible 接口需要 Base URL。
  - Google：可选 API Key，留空时使用非官方免费接口。
  - DeepL：DeepL API Key。
  - 百度：百度翻译 APP ID 与 Secret。

## 扩展设置

本扩展提供以下设置：

- `translator.provider`：翻译服务提供商，可选 `openai` / `deepseek` / `zai` / `openai-compatible` / `google` / `deepl` / `baidu`，默认 `google`。
- `translator.targetLang`：目标语言代码（如 `zh-CN`、`en`、`ja`、`fr`），默认 `zh-CN`。
- `translator.sourceLang`：源语言代码，`auto` 表示自动检测，默认 `auto`。
- `translator.apiKey`：当前 LLM 服务的 API Key；切换 LLM 服务时需同时更新 Key 和模型。
- `translator.model`：当前 LLM 服务的模型 ID，默认 `gpt-5.4-mini`。内置 provider 使用 pi-ai 模型目录中的 ID；`openai-compatible` 支持任意模型或推理接入点 ID。
- `translator.thinkingLevel`：LLM 思考档位，可选 `off` / `minimal` / `low` / `medium` / `high` / `xhigh` / `max`，默认 `off`。内置模型不支持的档位会在请求前报错；兼容接口的实际支持情况由服务端校验。思考内容不作为译文展示。
- `translator.baseUrl`：仅 `openai-compatible` 使用，填写包含 API 版本路径的基础地址，不包含 `/chat/completions`。内置 provider 使用 SDK 自带的端点，不读取此设置。
- `translator.google.apiKey`：Google Cloud Translation API Key（留空则使用免费接口）。
- `translator.deepl.apiKey`：DeepL API Key。
- `translator.deepl.useFree`：是否使用 DeepL 免费接口，默认 `true`。
- `translator.baidu.appid`：百度翻译 APP ID。
- `translator.baidu.secret`：百度翻译 Secret。

### LLM 配置示例

DeepSeek 使用 SDK 内置端点和模型信息：

```json
{
  "translator.provider": "deepseek",
  "translator.apiKey": "你的 DeepSeek API Key",
  "translator.model": "deepseek-flash",
  "translator.thinkingLevel": "low"
}
```

智谱、Z.AI 普通 API、火山方舟及其他兼容接口统一使用 `openai-compatible`：

```json
{
  "translator.provider": "openai-compatible",
  "translator.apiKey": "你的 API Key",
  "translator.model": "你的模型或推理接入点 ID",
  "translator.thinkingLevel": "off",
  "translator.baseUrl": "https://ark.cn-beijing.volces.com/api/v3"
}
```

- 智谱普通 API 的基础地址：`https://open.bigmodel.cn/api/paas/v4`。
- Z.AI 普通 API 的基础地址：`https://api.z.ai/api/paas/v4`。内置 `zai` 使用 pi-ai 的 Coding Plan 端点，不是普通 API；使用前请确认套餐允许该用途。
- 兼容接口通过 SDK 按端点识别协议差异；未知端点使用 OpenAI Chat Completions 的 `reasoning_effort`。模型不支持该参数或不能关闭思考时，需要选择匹配的模型和档位。
- 旧的 `translator.openai.apiKey`、`translator.openai.model` 分别改为 `translator.apiKey`、`translator.model`。旧的 `translator.openai.baseUrl` 已移除；使用自定义端点时改选 `openai-compatible` 并填写 `translator.baseUrl`。扩展不会自动迁移旧设置。

## 命令与快捷键

本扩展提供以下命令：

- `Translate: Translate Selected Text`（`translator.translateSelection`）：翻译选中文本，默认快捷键 `Ctrl+Alt+T` / `Cmd+Alt+T`。
- `Translate: Translate and Replace Selection`（`translator.translateAndReplace`）：翻译并替换选中文本，默认快捷键 `Ctrl+Alt+R` / `Cmd+Alt+R`。
- `Translate: Switch Provider`（`translator.pickProvider`）：切换翻译服务。
- `Translate: Switch Target Language`（`translator.pickTargetLang`）：切换目标语言。

## 发布前检查

发布前建议执行：

```sh
npm run package
```

如需打包 VSIX：

```sh
npx @vscode/vsce package
```

## 已知问题

暂无。如发现问题请提交 Issue。

## 更新日志

### 未发布

- Hover 翻译改为读取语言扩展提供的文档，在右侧 Panel 展示原文和译文，移除按语言解析源码及 Tree-sitter WASM 依赖。
- Markdown 代码块不发送给翻译服务，译文中原样保留。

### 0.1.5

- LLM 调用改用 `@earendil-works/pi-ai`，新增 DeepSeek、Z.AI、通用兼容接口和 `thinkingLevel` 配置；统一 LLM 的 API Key、模型设置，Base URL 仅供兼容接口使用。
- 新增文档注释的按需 Hover 翻译、复制和失败重试，支持 Go、TypeScript / TSX、JavaScript / JSX、Python、Java、C / C++、C#、Rust、PHP 和 Ruby。
- 选区翻译固定在右侧 Panel 展示，移除原有选区结果 Hover 和 `translator.displayMode` 设置。旧设置可从用户配置中删除。

### 0.1.4

- 扩展更名为 `vscode-llm-translator`，显示名为 `Translator for VS Code`，扩展 ID 为 `saltfishpr.vscode-llm-translator`。

### 0.1.1

- 新增翻译缓存：相同文本、相同翻译服务和语言对的结果会被缓存复用，减少重复 API 调用。

### 0.1.0

- 初始版本，支持 Google / DeepL / OpenAI / 百度翻译、悬浮/面板展示、译文替换、状态栏切换服务与常用目标语言切换。
