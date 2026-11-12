import { TranslatorConfig } from '../config';
import { Translator } from './base';
import { GoogleTranslator } from './google';
import { DeepLTranslator } from './deepl';
import { LLMTranslator } from './llm';
import { BaiduTranslator } from './baidu';

export function createTranslator(cfg: TranslatorConfig): Translator {
  switch (cfg.provider) {
    case 'google':
      return new GoogleTranslator(cfg.google.apiKey);
    case 'deepl':
      return new DeepLTranslator(cfg.deepl.apiKey, cfg.deepl.useFree);
    case 'openai':
    case 'deepseek':
    case 'zai':
    case 'openai-compatible':
      return new LLMTranslator(cfg.provider, cfg.apiKey, cfg.model, cfg.thinkingLevel, cfg.baseUrl);
    case 'baidu':
      return new BaiduTranslator(cfg.baidu.appid, cfg.baidu.secret);
    default:
      throw new Error(`Unknown provider: ${cfg.provider}`);
  }
}

export * from './base';
