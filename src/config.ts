import * as vscode from 'vscode';

export type LLMProvider = 'openai' | 'deepseek' | 'zai' | 'openai-compatible';
export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface TranslatorConfig {
  provider: 'google' | 'deepl' | 'baidu' | LLMProvider;
  targetLang: string;
  sourceLang: string;
  apiKey: string;
  model: string;
  thinkingLevel: ThinkingLevel;
  baseUrl: string;
  google: { apiKey: string };
  deepl: { apiKey: string; useFree: boolean };
  baidu: { appid: string; secret: string };
}

export function getConfig(): TranslatorConfig {
  const c = vscode.workspace.getConfiguration('translator');
  return {
    provider: c.get('provider', 'google'),
    targetLang: c.get('targetLang', 'zh-CN'),
    sourceLang: c.get('sourceLang', 'auto'),
    apiKey: c.get('apiKey', ''),
    model: c.get('model', 'gpt-5.4-mini'),
    thinkingLevel: c.get('thinkingLevel', 'off'),
    baseUrl: c.get('baseUrl', ''),
    google: { apiKey: c.get('google.apiKey', '') },
    deepl: {
      apiKey: c.get('deepl.apiKey', ''),
      useFree: c.get('deepl.useFree', true),
    },
    baidu: {
      appid: c.get('baidu.appid', ''),
      secret: c.get('baidu.secret', ''),
    },
  };
}

export async function updateConfig<T>(key: string, value: T) {
  await vscode.workspace
    .getConfiguration('translator')
    .update(key, value, vscode.ConfigurationTarget.Global);
}
