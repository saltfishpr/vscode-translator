# Translator for VS Code

使用多种 LLM 服务及 Google / DeepL / 百度，翻译选中文本和 Hover 中的文档注释。

## 功能

- 支持通过 `@earendil-works/pi-ai` 接入的 OpenAI、DeepSeek、Z.AI 和 OpenAI-compatible 等 LLM 服务，以及 Google、DeepL 和百度。
- 翻译选中文本，在右侧 Webview Panel 中展示原文和译文。
- 翻译并替换选中文本。
- 在 Hover 中点击「翻译」，在同一浮窗中追加注释译文，并支持复制和失败重试。
- 翻译结果自动缓存：相同文本、相同服务和语言对的结果会被复用，减少重复 API 调用。
- 通过命令面板或状态栏快速切换翻译服务和目标语言。

## 使用方式

1. 在编辑器中选中文本。
2. 执行 `Translate: Translate Selected Text` 在右侧查看原文和译文，或执行 `Translate: Translate and Replace Selection` 直接替换原文。
3. 需要切换服务时，点击状态栏中的翻译服务项，或执行 `Translate: Switch Provider`。
4. 需要切换目标语言时，执行 `Translate: Switch Target Language`。

### 翻译 Hover 注释

1. 在当前支持的语言中，将鼠标悬停在具有文档注释的符号上。
2. 点击 Hover 中的「翻译」。浏览 Hover 不会调用翻译服务。
3. 翻译期间显示 VS Code 原生加载提示和状态栏进度；成功后在同一 Hover 中追加译文、目标语言和翻译服务。
4. 点击「复制译文」复制结果；失败时可在 Hover 内重试。关闭浮窗后，请求完成不会重新打开浮窗，再次悬停可复用缓存。

### 当前语言支持

语言支持由对应的声明和注释解析规则提供。当前支持：

| 语言 | 提取内容 |
| --- | --- |
| Go | 函数、方法、类型、字段、接口成员、常量和变量的关联注释 |
| TypeScript / TSX、JavaScript / JSX | 函数、类、接口、属性、方法和变量的 JSDoc；声明类型以对应语言语法为准 |
| Python | 类、函数和方法体中首条语句的 docstring，包括装饰器修饰的声明 |
| Java | 类型、方法、构造函数、字段和枚举成员的 Javadoc |
| C / C++ | 函数、类型、字段、枚举成员、变量和宏的 Doxygen 或紧邻声明的注释 |
| C# | 类型、方法、构造函数、属性、字段和事件的 XML 文档注释 |
| Rust | 类型、函数、方法、字段、枚举成员、常量等声明的外层文档注释，支持声明前的属性 |
| PHP | 类型、函数、方法、属性和常量的 PHPDoc |
| Ruby | 类、模块、方法、常量和 `attr_reader` / `attr_writer` / `attr_accessor` 的 RDoc 注释 |

扩展使用内置 Tree-sitter WASM 解析器，从声明源码提取关联注释，不要求安装额外的解析工具链。在引用位置使用语言扩展提供的 DefinitionProvider 定位声明，因此跨文件翻译需要相应语言扩展支持“转到定义”。

- 没有注释的成员不会继承其外层类型的注释；Python 不会将函数体中的任意字符串误当成 docstring，Rust 不会将内层文档注释关联到后续声明。
- 注释原文直接发送给翻译服务，代码、链接和文档标签的保留情况取决于翻译服务。
- C 与 C++ 共用 C++ 语法解析器，按源码识别常见声明，不执行宏展开。Python 不会执行 docstring 所在代码。
- 找不到关联注释、声明源码不可读、定义存在不同的候选注释，或语言暂不支持时，不显示「翻译」。不会降级为翻译整段 Hover。
- 源码注释可能与语言扩展整理后的 Hover 文档不同；源码之外的文档不在当前支持范围。暂不支持 Thrift。
- 原有 Hover 内容由语言扩展提供，保持不变；多个 HoverProvider 的最终排列顺序由 VS Code 决定。

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
- 此次保持现有 Hover 的完整结果展示，不在原生 Hover 内逐段刷新。
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

### Unreleased

- LLM 调用改用 `@earendil-works/pi-ai`，新增 DeepSeek、Z.AI、通用兼容接口和 `thinkingLevel` 配置；统一 LLM 的 API Key、模型设置，Base URL 仅供兼容接口使用。
- 新增文档注释的按需 Hover 翻译、复制和失败重试，支持 Go、TypeScript / TSX、JavaScript / JSX、Python、Java、C / C++、C#、Rust、PHP 和 Ruby。
- 选区翻译固定在右侧 Panel 展示，移除原有选区结果 Hover 和 `translator.displayMode` 设置。旧设置可从用户配置中删除。

### 0.1.4

- 扩展更名为 `vscode-llm-translator`，显示名为 `Translator for VS Code`，扩展 ID 为 `saltfishpr.vscode-llm-translator`。

### 0.1.1

- 新增翻译缓存：相同文本、相同翻译服务和语言对的结果会被缓存复用，减少重复 API 调用。

### 0.1.0

- 初始版本，支持 Google / DeepL / OpenAI / 百度翻译、悬浮/面板展示、译文替换、状态栏切换服务与常用目标语言切换。
