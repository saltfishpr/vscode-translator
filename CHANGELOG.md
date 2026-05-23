# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
