# vscode-translator

使用 Google / DeepL / OpenAI / 百度 等翻译服务翻译编辑器中选中的文本。

## 功能

- 支持多种翻译服务：Google、DeepL、OpenAI（及兼容接口）、百度。
- 翻译选中文本并以悬浮提示或输出面板的形式展示结果。
- 翻译并替换选中文本。
- 在悬浮结果中直接复制译文或替换原文。
- 翻译结果自动缓存：相同文本、相同服务和语言对的结果会被复用，减少重复 API 调用。
- 通过命令面板或状态栏快速切换翻译服务和目标语言。

## 使用方式

1. 在编辑器中选中文本。
2. 执行 `Translate: Translate Selected Text` 查看译文，或执行 `Translate: Translate and Replace Selection` 直接替换原文。
3. 需要切换服务时，点击状态栏中的翻译服务项，或执行 `Translate: Switch Provider`。
4. 需要切换目标语言时，执行 `Translate: Switch Target Language`。

## 要求

- VS Code 版本 >= 1.120.0
- 根据所选翻译服务配置相应凭据：
  - Google：可选 API Key，留空时使用非官方免费接口。
  - DeepL：DeepL API Key。
  - OpenAI：API Key，可选 Base URL 与模型名称，支持兼容 OpenAI Chat Completions 的接口。
  - 百度：百度翻译 APP ID 与 Secret。

## 扩展设置

本扩展提供以下设置：

- `translator.provider`：翻译服务提供商，可选 `google` / `deepl` / `openai` / `baidu`，默认 `google`。
- `translator.targetLang`：目标语言代码（如 `zh-CN`、`en`、`ja`、`fr`），默认 `zh-CN`。
- `translator.sourceLang`：源语言代码，`auto` 表示自动检测，默认 `auto`。
- `translator.displayMode`：翻译结果展示方式，可选 `hover` / `panel`，默认 `hover`。
- `translator.google.apiKey`：Google Cloud Translation API Key（留空则使用免费接口）。
- `translator.deepl.apiKey`：DeepL API Key。
- `translator.deepl.useFree`：是否使用 DeepL 免费接口，默认 `true`。
- `translator.openai.apiKey`：OpenAI 或兼容服务的 API Key。
- `translator.openai.baseUrl`：OpenAI 兼容服务的 Base URL，默认 `https://api.openai.com/v1`。
- `translator.openai.model`：OpenAI 翻译使用的模型名称，默认 `gpt-5.4-mini`。
- `translator.baidu.appid`：百度翻译 APP ID。
- `translator.baidu.secret`：百度翻译 Secret。

## 命令与快捷键

本扩展提供以下命令：

- `Translate: Translate Selected Text`（`translator.translateSelection`）：翻译选中文本，默认快捷键 `Ctrl+Alt+T` / `Cmd+Alt+T`。
- `Translate: Translate and Replace Selection`（`translator.translateAndReplace`）：翻译并替换选中文本，默认快捷键 `Ctrl+Alt+R` / `Cmd+Alt+R`。
- `Translate: Switch Provider`（`translator.pickProvider`）：切换翻译服务。
- `Translate: Switch Target Language`（`translator.pickTargetLang`）：切换目标语言。

## 发布前检查

发布 v0.1.0 前建议执行：

```sh
npm run package
```

如需打包 VSIX：

```sh
npx vsce package
```

## 已知问题

暂无。如发现问题请提交 Issue。

## 更新日志

### 0.1.1

- 新增翻译缓存：相同文本、相同翻译服务和语言对的结果会被缓存复用，减少重复 API 调用。

### 0.1.0

- 初始版本，支持 Google / DeepL / OpenAI / 百度翻译、悬浮/面板展示、译文替换、状态栏切换服务与常用目标语言切换。
