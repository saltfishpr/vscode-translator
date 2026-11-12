import type { TranslatorConfig } from './config';
import { createTranslator } from './translators';
import type { TranslateResult } from './translators';
import type { SourceComment } from './comments';

type TimedTranslateResult = TranslateResult & { durationMs: number };

const cache = new Map<string, TimedTranslateResult>();
const pending = new Map<string, Promise<TimedTranslateResult>>();

export function translationKey(
  text: string,
  cfg: TranslatorConfig,
  comment?: SourceComment
): string {
  return JSON.stringify([
    cfg.provider,
    cfg.sourceLang,
    cfg.targetLang,
    ['google', 'deepl', 'baidu'].includes(cfg.provider)
      ? undefined
      : [cfg.model, cfg.thinkingLevel, cfg.provider === 'openai-compatible' ? cfg.baseUrl : undefined],
    cfg.provider === 'deepl' ? cfg.deepl.useFree : undefined,
    text,
    comment?.identifiers,
    comment?.style,
  ]);
}

export function cachedTranslation(key: string): TimedTranslateResult | undefined {
  const result = cache.get(key);
  if (result) {
    cache.delete(key);
    cache.set(key, result);
  }
  return result;
}

export async function translate(
  text: string,
  cfg: TranslatorConfig,
  comment?: SourceComment
): Promise<TimedTranslateResult> {
  const key = translationKey(text, cfg, comment);
  const cached = cachedTranslation(key);
  if (cached) {
    return cached;
  }
  const existing = pending.get(key);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    const translator = createTranslator(cfg);
    const start = performance.now();
    const translation = await translator.translate({
      text,
      sourceLang: cfg.sourceLang,
      targetLang: cfg.targetLang,
    });
    const result = { ...translation, durationMs: performance.now() - start };
    if (!result.text.trim()) {
      throw new Error('翻译服务返回了空内容。');
    }
    if (cache.size >= 200) {
      cache.delete(cache.keys().next().value!);
    }
    cache.set(key, result);
    return result;
  })();
  pending.set(key, request);
  try {
    return await request;
  } finally {
    pending.delete(key);
  }
}
