import * as crypto from 'crypto';
import { Translator, TranslateParams, TranslateResult } from './base';

export class BaiduTranslator implements Translator {
  readonly name = 'baidu';
  constructor(
    private appid: string,
    private secret: string
  ) {}

  async translate(p: TranslateParams): Promise<TranslateResult> {
    if (!this.appid || !this.secret) {
      throw new Error('Baidu appid/secret is not configured.');
    }
    const salt = Date.now().toString();
    const sign = crypto
      .createHash('md5')
      .update(this.appid + p.text + salt + this.secret)
      .digest('hex');
    const params = new URLSearchParams({
      q: p.text,
      from: this.normalize(p.sourceLang),
      to: this.normalize(p.targetLang),
      appid: this.appid,
      salt,
      sign,
    });
    const url = `https://fanyi-api.baidu.com/api/trans/vip/translate?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Baidu ${res.status}`);
    }
    const data: any = await res.json();
    if (data.error_code) {
      throw new Error(`Baidu ${data.error_code}: ${data.error_msg}`);
    }
    const text = (data.trans_result as any[]).map((r) => r.dst).join('\n');
    return { text, provider: this.name, detectedSource: data.from };
  }

  private normalize(lang: string): string {
    const map: Record<string, string> = {
      auto: 'auto',
      'zh-CN': 'zh',
      'zh-TW': 'cht',
      en: 'en',
      ja: 'jp',
      ko: 'kor',
      fr: 'fra',
      de: 'de',
      es: 'spa',
      ru: 'ru',
    };
    return map[lang] ?? lang;
  }
}
