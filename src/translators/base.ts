export interface TranslateParams {
  text: string;
  sourceLang: string;
  targetLang: string;
}

export interface TranslateResult {
  text: string;
  provider: string;
  detectedSource?: string;
}

export interface Translator {
  readonly name: string;
  translate(params: TranslateParams): Promise<TranslateResult>;
}
