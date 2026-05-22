# vscode-translator

使用 Google / DeepL / OpenAI / 百度 等翻译服务翻译编辑器中选中的文本。

## Features

- 支持多种翻译服务：Google、DeepL、OpenAI（及兼容接口）、百度。
- 翻译选中文本并以悬浮提示或输出面板的形式展示结果。
- 翻译并替换选中文本。
- 通过命令快速切换翻译服务和目标语言。

## Requirements

- VS Code 版本 >= 1.120.0
- 根据所选翻译服务，需要相应的 API 密钥：
    - Google：可选 API Key（留空则使用免费接口）
    - DeepL：DeepL API Key
    - OpenAI：API Key 以及可选的 Base URL、模型名称
    - 百度：APP ID 与 Secret

## Extension Settings

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
- `translator.openai.model`：OpenAI 翻译使用的模型名称，默认 `gpt-4o-mini`。
- `translator.baidu.appid`：百度翻译 APP ID。
- `translator.baidu.secret`：百度翻译 Secret。

## Commands & Keybindings

本扩展提供以下命令：

- `Translate: Translate Selected Text`（`translator.translateSelection`）：翻译选中文本，默认快捷键 `Ctrl+Alt+T` / `Cmd+Alt+T`。
- `Translate: Translate and Replace Selection`（`translator.translateAndReplace`）：翻译并替换选中文本，默认快捷键 `Ctrl+Alt+R` / `Cmd+Alt+R`。
- `Translate: Switch Provider`（`translator.pickProvider`）：切换翻译服务。
- `Translate: Switch Target Language`（`translator.pickTargetLang`）：切换目标语言。

## Known Issues

暂无。如发现问题请提交 Issue。

## Release Notes

### 0.0.1

- 初始版本，支持 Google / DeepL / OpenAI / 百度 翻译服务。

---

## Following extension guidelines

请确认已阅读并遵循扩展开发的最佳实践。

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

**Enjoy!**
