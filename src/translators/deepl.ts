import { Translator, TranslateParams, TranslateResult } from './base';

export class DeepLTranslator implements Translator {
  readonly name = 'deepl';
  constructor(
    private apiKey: string,
    private useFree: boolean
  ) {}

  async translate(p: TranslateParams): Promise<TranslateResult> {
    if (!this.apiKey) {
      throw new Error('DeepL API key is not configured.');
    }
    const host = this.useFree ? 'api-free.deepl.com' : 'api.deepl.com';
    const url = `https://${host}/v2/translate`;
    const params = new URLSearchParams();
    params.append('text', p.text);
    params.append('target_lang', this.normalizeLang(p.targetLang));
    if (p.sourceLang !== 'auto') {
      params.append('source_lang', this.normalizeLang(p.sourceLang));
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!res.ok) {
      throw new Error(`DeepL ${res.status}: ${await res.text()}`);
    }
    const data: any = await res.json();
    const tr = data.translations[0];
    return {
      text: tr.text,
      provider: this.name,
      detectedSource: tr.detected_source_language,
    };
  }

  private normalizeLang(lang: string): string {
    // DeepL uses upper-case codes; map zh-CN -> ZH
    const map: Record<string, string> = {
      'zh-CN': 'ZH',
      'zh-TW': 'ZH',
      en: 'EN',
      ja: 'JA',
      fr: 'FR',
      de: 'DE',
    };
    return map[lang] ?? lang.toUpperCase();
  }
}
