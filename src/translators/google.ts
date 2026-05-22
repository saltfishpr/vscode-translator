import { Translator, TranslateParams, TranslateResult } from './base';

export class GoogleTranslator implements Translator {
  readonly name = 'google';
  constructor(private apiKey: string) {}

  async translate(p: TranslateParams): Promise<TranslateResult> {
    if (this.apiKey) {
      return this.officialApi(p);
    }
    return this.freeApi(p);
  }

  private async officialApi(p: TranslateParams): Promise<TranslateResult> {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`;
    const body = {
      q: p.text,
      target: p.targetLang,
      ...(p.sourceLang !== 'auto' ? { source: p.sourceLang } : {}),
      format: 'text',
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Google API ${res.status}: ${await res.text()}`);
    }
    const data: any = await res.json();
    const t = data.data.translations[0];
    return {
      text: t.translatedText,
      provider: this.name,
      detectedSource: t.detectedSourceLanguage,
    };
  }

  // Fallback: unofficial endpoint (no key required, rate-limited)
  private async freeApi(p: TranslateParams): Promise<TranslateResult> {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx` +
      `&sl=${encodeURIComponent(p.sourceLang)}` +
      `&tl=${encodeURIComponent(p.targetLang)}` +
      `&dt=t&q=${encodeURIComponent(p.text)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Google free API ${res.status}`);
    }
    const data: any = await res.json();
    const text = (data[0] as any[]).map((seg: any) => seg[0]).join('');
    return { text, provider: this.name, detectedSource: data[2] };
  }
}
