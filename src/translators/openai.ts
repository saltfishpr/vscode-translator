import { Translator, TranslateParams, TranslateResult } from './base';

export class OpenAITranslator implements Translator {
  readonly name = 'openai';
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private model: string
  ) {}

  async translate(p: TranslateParams): Promise<TranslateResult> {
    if (!this.apiKey) {
      throw new Error('API key is not configured.');
    }
    const url = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const sys =
      `You are a professional translator. Translate the user's text to ${p.targetLang}. ` +
      `Output ONLY the translation, preserve formatting and code identifiers; do not add explanations.`;
    const body = {
      model: this.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: p.text },
      ],
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`API request failed with status ${res.status}: ${await res.text()}`);
    }
    const data: any = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    return { text, provider: this.name };
  }
}
