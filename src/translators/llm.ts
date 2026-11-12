import type { Provider } from "@earendil-works/pi-ai" with { "resolution-mode": "import" };
import type { LLMProvider, ThinkingLevel } from "../config";
import type { Translator, TranslateParams, TranslateResult } from "./base";

export class LLMTranslator implements Translator {
  constructor(
    readonly name: LLMProvider,
    private apiKey: string,
    private modelId: string,
    private thinkingLevel: ThinkingLevel,
    private baseUrl: string,
  ) {}

  async translate(p: TranslateParams): Promise<TranslateResult> {
    if (!this.apiKey.trim()) {
      throw new Error("请配置 translator.apiKey。");
    }
    if (!this.modelId.trim()) {
      throw new Error("请配置 translator.model。");
    }
    if (this.name === "openai-compatible") {
      let url: URL;
      try {
        url = new URL(this.baseUrl);
      } catch {
        throw new Error("请将 translator.baseUrl 配置为 OpenAI-compatible API 的完整基础地址。");
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("translator.baseUrl 必须使用 http 或 https。");
      }
    }

    // pi-ai is ESM-only; load it on demand in the CommonJS extension host.
    const { createModels, createProvider, envApiKeyAuth, getSupportedThinkingLevels } =
      await import("@earendil-works/pi-ai");
    let provider: Provider;
    switch (this.name) {
      case "openai": {
        const { openaiProvider } = await import("@earendil-works/pi-ai/providers/openai");
        provider = openaiProvider();
        break;
      }
      case "deepseek": {
        const { deepseekProvider } = await import("@earendil-works/pi-ai/providers/deepseek");
        provider = deepseekProvider();
        break;
      }
      case "zai": {
        const { zaiProvider } = await import("@earendil-works/pi-ai/providers/zai");
        provider = zaiProvider();
        break;
      }
      case "openai-compatible": {
        const { openAICompletionsApi } = await import("@earendil-works/pi-ai/api/openai-completions.lazy");
        const baseUrl = this.baseUrl.replace(/\/+$/, "");
        provider = createProvider({
          id: this.name,
          baseUrl,
          auth: { apiKey: envApiKeyAuth("API key", []) },
          models: [
            {
              id: this.modelId,
              name: this.modelId,
              api: "openai-completions",
              provider: this.name,
              baseUrl,
              input: ["text"],
              reasoning: true,
              thinkingLevelMap: { off: "none", xhigh: "xhigh", max: "max" },
              // A custom endpoint's limits and pricing are not known locally.
              contextWindow: 0,
              maxTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              compat: {
                supportsStore: false,
                supportsDeveloperRole: false,
              },
            },
          ],
          api: openAICompletionsApi(),
        });
        break;
      }
    }

    const models = createModels();
    models.setProvider(provider);
    const model = models.getModel(this.name, this.modelId);
    if (!model) {
      throw new Error(`pi-ai 尚未收录 ${this.name} 模型 ${this.modelId}，请检查 translator.model。`);
    }
    const levels = getSupportedThinkingLevels(model);
    if (!levels.includes(this.thinkingLevel)) {
      throw new Error(`${model.id} 不支持 thinkingLevel=${this.thinkingLevel}；可选值：${levels.join(", ")}。`);
    }

    const context = {
      systemPrompt:
        `You are a professional translator. Translate the user's text to ${p.targetLang}. ` +
        `Output ONLY the translation, preserve formatting and code identifiers; do not add explanations.`,
      messages: [{ role: "user" as const, content: p.text, timestamp: Date.now() }],
    };
    const reasoning = this.thinkingLevel === "off" ? undefined : this.thinkingLevel;
    // Let a custom endpoint choose its output limit rather than inventing model metadata.
    const result =
      this.name === "openai-compatible"
        ? await models.complete(model, context, { apiKey: this.apiKey, reasoningEffort: reasoning })
        : await models.completeSimple(model, context, { apiKey: this.apiKey, reasoning });
    if (result.stopReason !== "stop") {
      throw new Error(result.errorMessage || `翻译未完成（${result.stopReason}），请重试。`);
    }
    const text = result.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    return { text, provider: this.name };
  }
}
