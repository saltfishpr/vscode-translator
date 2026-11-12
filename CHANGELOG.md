# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.6] - 2026-11-12

### Changed

- Translate HoverProvider documentation on click and display the original and translation in a right-side Panel, without language-specific source or definition lookup.
- Preserve Markdown fenced and indented code blocks, including nested blocks and legacy code hovers, without sending them to translation providers.
- Remove Tree-sitter WASM parsers and source-comment extraction. Hover actions now appear on word ranges; empty or code-only documentation does not trigger translation requests.

### Fixed

- Prefer the local extension host in remote workspaces, with the workspace extension host as a fallback.

## [0.1.5] - 2026-11-12

### Added

- DeepSeek, Z.AI, and generic OpenAI-compatible LLM translation through `@earendil-works/pi-ai`, with configurable thinking levels.
- On-demand documentation translation in the editor hover, with copy and retry actions, for Go, TypeScript / TSX, JavaScript / JSX, Python, Java, C / C++, C#, Rust, PHP, and Ruby.
- Bundled Tree-sitter WASM parsers to extract declaration-bound comments, including definitions in other files.
- Preserve documentation code, links, tags, and declaration identifiers during translation; deduplicate concurrent requests.
- Language-specific extraction for Python docstrings, Rust outer documentation, C# XML documentation, Javadoc, PHPDoc, Doxygen, and Ruby RDoc.

### Changed

- LLM credentials and model settings now use `translator.apiKey`, `translator.model`, and `translator.thinkingLevel`. Built-in providers use SDK endpoints; only `openai-compatible` reads `translator.baseUrl`. Removed the old `translator.openai.*` settings; migration is manual.
- Selected-text translations now always display the original and translated text in a side-by-side Webview Panel.
- Removed the selected-text result hover, its copy/replace actions, and the `translator.displayMode` setting. The translate-and-replace command remains available.

### Fixed

- Extract comments associated with Go short variable declarations.
- Resolve the macOS VS Code executable path in integration tests by upgrading `@vscode/test-electron` to 3.1.0.

## [0.1.4] - 2026-11-08

### Changed

- Renamed the extension to `vscode-llm-translator` with the display name `Translator for VS Code`. The extension ID is now `saltfishpr.vscode-llm-translator`.
- Releases are now published to the VS Code Marketplace automatically via GitHub Actions.

## [0.1.1] - 2026-05-30

### Added

- Translation cache: repeated translations of the same text with the same provider/language pair are served from an in-memory LRU cache, avoiding redundant API calls.

### Changed

- Refined OpenAI translator system prompt.

## [0.1.0] - 2026-05-23

### Added

- Translate selected editor text with Google, DeepL, OpenAI-compatible APIs, or Baidu Translate.
- Show translation results in a hover popup or a side panel.
- Replace the selected text with the translation.
- Copy or replace directly from the hover result actions.
- Switch provider and target language from commands or the status bar.
- Configure source language, target language, display mode, provider credentials, OpenAI-compatible base URL, and model.

### Notes

- Google can use either a configured Cloud Translation API key or the unauthenticated fallback endpoint.
- DeepL, OpenAI-compatible APIs, and Baidu require credentials before use.
