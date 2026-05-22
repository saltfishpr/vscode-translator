import * as vscode from 'vscode';

export interface TranslatorConfig {
  provider: 'google' | 'deepl' | 'openai' | 'baidu';
  targetLang: string;
  sourceLang: string;
  displayMode: 'hover' | 'panel';
  google: { apiKey: string };
  deepl: { apiKey: string; useFree: boolean };
  openai: { apiKey: string; baseUrl: string; model: string };
  baidu: { appid: string; secret: string };
}

export function getConfig(): TranslatorConfig {
  const c = vscode.workspace.getConfiguration('translator');
  return {
    provider: c.get('provider', 'google'),
    targetLang: c.get('targetLang', 'zh-CN'),
    sourceLang: c.get('sourceLang', 'auto'),
    displayMode: c.get('displayMode', 'hover'),
    google: { apiKey: c.get('google.apiKey', '') },
    deepl: {
      apiKey: c.get('deepl.apiKey', ''),
      useFree: c.get('deepl.useFree', true),
    },
    openai: {
      apiKey: c.get('openai.apiKey', ''),
      baseUrl: c.get('openai.baseUrl', 'https://api.openai.com/v1'),
      model: c.get('openai.model', 'gpt-5.4-mini'),
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
