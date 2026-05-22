import { TranslatorConfig } from '../config';
import { Translator } from './base';
import { GoogleTranslator } from './google';
import { DeepLTranslator } from './deepl';
import { OpenAITranslator } from './openai';
import { BaiduTranslator } from './baidu';

export function createTranslator(cfg: TranslatorConfig): Translator {
  switch (cfg.provider) {
    case 'google':
      return new GoogleTranslator(cfg.google.apiKey);
    case 'deepl':
      return new DeepLTranslator(cfg.deepl.apiKey, cfg.deepl.useFree);
    case 'openai':
      return new OpenAITranslator(cfg.openai.apiKey, cfg.openai.baseUrl, cfg.openai.model);
    case 'baidu':
      return new BaiduTranslator(cfg.baidu.appid, cfg.baidu.secret);
    default:
      throw new Error(`Unknown provider: ${cfg.provider}`);
  }
}

export * from './base';
