import { randomUUID } from "node:crypto";
import MarkdownIt from "markdown-it";
import * as vscode from "vscode";
import type { TranslatorConfig } from "./config";
import type { HoverDocument } from "./hoverTranslation";
import { translate } from "./translation";

type TranslationInput = string | HoverDocument | (() => Promise<HoverDocument>);

type CardState = {
  id: number;
  originalHtml: string;
  provider: string;
  model?: string;
  durationMs?: number;
  status: "loading" | "ready" | "error" | "empty";
  message?: string;
  translatedHtml?: string;
  error?: string;
};

type TranslationCard = {
  state: CardState;
  input: TranslationInput;
  config: TranslatorConfig;
  progress?: vscode.Disposable;
};

const markdown = new MarkdownIt({ html: false, breaks: true });
// Documentation and model output may contain links or images; keep their text without enabling actions or requests.
markdown.renderer.rules.link_open = () => "<span>";
markdown.renderer.rules.link_close = () => "</span>";
markdown.renderer.rules.image = (tokens, index) => markdown.utils.escapeHtml(tokens[index].content);

/** Appends selection or hover snapshots to one panel; closing it clears cards without cancelling shared requests. */
export class TranslationPanel implements vscode.Disposable {
  private panel?: vscode.WebviewPanel;
  private readonly cards = new Map<number, TranslationCard>();
  private nextId = 0;
  private readonly output = vscode.window.createOutputChannel("Translator");

  /** Appends a card without taking focus; document loading and translation update only that card. */
  async show(input: string | (() => Promise<HoverDocument>), config: TranslatorConfig): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
    } else {
      const panel = vscode.window.createWebviewPanel(
        "translatorResult",
        "Translation Result",
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableScripts: true, localResourceRoots: [] },
      );
      this.panel = panel;
      const messages = panel.webview.onDidReceiveMessage(async (message: unknown) => {
        if (!message || typeof message !== "object" || !("action" in message) || this.panel !== panel) {
          return;
        }
        if (message.action === "ready") {
          this.update();
          return;
        }
        if (!("id" in message) || typeof message.id !== "number") {
          return;
        }
        const card = this.cards.get(message.id);
        if (message.action === "retry" && card?.state.status === "error") {
          await this.run(card);
        }
      });
      const closed = panel.onDidDispose(() => {
        this.panel = undefined;
        for (const card of this.cards.values()) {
          card.progress?.dispose();
        }
        this.cards.clear();
        messages.dispose();
        closed.dispose();
      });
      panel.webview.html = this.renderHtml();
    }
    const card: TranslationCard = {
      state: { id: ++this.nextId, originalHtml: "", provider: config.provider, status: "loading" },
      input,
      config,
    };
    this.cards.set(card.state.id, card);
    await this.run(card);
  }

  private async run(card: TranslationCard): Promise<void> {
    const started = performance.now();
    const { config } = card;
    const id = card.state.id;
    let input = card.input;
    const message = typeof input === "function" ? "正在读取 Hover 文档…" : "正在翻译…";
    card.state = {
      id,
      originalHtml: markdown.render(
        typeof input === "string" ? input : typeof input === "function" ? "" : input.original,
      ),
      provider: config.provider,
      model: ["google", "deepl", "baidu"].includes(config.provider) ? undefined : config.model,
      status: "loading",
      message,
    };
    const progress = vscode.window.setStatusBarMessage(`$(sync~spin) ${message}`);
    card.progress = progress;
    this.update();
    try {
      if (typeof input === "function") {
        input = await input();
      }
      if (this.cards.get(id) !== card) {
        return;
      }
      // Retry a loaded snapshot instead of querying potentially changed provider documentation again.
      card.input = input;
      card.state = {
        ...card.state,
        originalHtml: markdown.render(typeof input === "string" ? input : input.original),
        message: "正在翻译…",
      };
      this.update();
      const result = typeof input === "string" ? await translate(input, config) : await input.translate(config);
      if (this.cards.get(id) === card) {
        card.state = {
          ...card.state,
          status: result ? "ready" : "empty",
          message: result ? undefined : "没有可翻译的 Hover 正文（文档为空或仅包含代码块）。",
          translatedHtml: result ? markdown.render(result.text) : undefined,
          provider: result?.provider ?? config.provider,
          durationMs: performance.now() - started,
        };
        this.update();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.cards.get(id) === card) {
        this.output.appendLine(`Translation failed (${config.provider}): ${message}`);
        card.state = { ...card.state, status: "error", error: message, durationMs: performance.now() - started };
        this.update();
      }
    } finally {
      progress.dispose();
      card.progress = undefined;
    }
  }

  private update(): void {
    if (this.panel) {
      // Hidden webviews may reload; their ready message requests all card snapshots in insertion order.
      void this.panel.webview.postMessage({ cards: Array.from(this.cards.values(), ({ state }) => state) });
    }
  }

  /** Releases the result view and log; late results cannot recreate either. */
  dispose(): void {
    this.panel?.dispose();
    this.output.dispose();
  }

  private renderHtml(): string {
    const nonce = randomUUID();
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <style nonce="${nonce}">
    body { margin: 0; padding: 16px; color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); line-height: 1.6; }
    main { display: grid; gap: 16px; }
    .card { min-width: 0; border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border, transparent));
      border-radius: 7px; overflow: hidden; background: var(--vscode-editor-background);
      box-shadow: 0 1px 2px var(--vscode-widget-shadow, transparent); }
    details + details { border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border, transparent)); }
    summary { display: flex; align-items: center; gap: 10px; box-sizing: border-box; height: calc(1.6em + 20px);
      padding: 0 14px; font-size: 1em; line-height: 1.6; cursor: pointer; user-select: none; list-style: none; }
    summary::-webkit-details-marker { display: none; }
    summary::before { content: ''; width: 5px; height: 5px; flex: 0 0 auto; margin-right: 2px;
      border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); }
    details[open] > summary::before { transform: rotate(45deg); }
    summary:hover { background: var(--vscode-list-hoverBackground); }
    summary > .label { flex: 0 0 auto; font-weight: 600; }
    .metadata { display: flex; align-items: center; flex: 1; min-width: 0; gap: 8px;
      color: var(--vscode-descriptionForeground); font-size: .85em; }
    .provider { min-width: 0; max-width: 45%; padding: 1px 6px; border-radius: 4px;
      background: var(--vscode-textCodeBlock-background); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .model { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-family: var(--vscode-editor-font-family); }
    .duration { flex: 0 0 auto; margin-left: auto; color: var(--vscode-descriptionForeground);
      font-size: .85em; font-variant-numeric: tabular-nums; }
    .section-body { padding: 6px 16px 16px; }
    .content { overflow-wrap: anywhere; line-height: 1.7; }
    .content > :first-child { margin-top: 0; }
    .content > :last-child { margin-bottom: 0; }
    .content p { margin: 0 0 10px; }
    .content h1, .content h2, .content h3 { margin: 14px 0 8px; font-size: 1.05em; font-weight: 600; }
    .content ul, .content ol { padding-left: 22px; margin: 8px 0; }
    .content pre { max-width: 100%; box-sizing: border-box; margin: 0 0 12px; padding: 10px 12px;
      border: 1px solid var(--vscode-widget-border, transparent); border-radius: 5px;
      background: var(--vscode-textCodeBlock-background); overflow-x: auto; line-height: 1.5; tab-size: 4; }
    .content code { font-family: var(--vscode-editor-font-family); font-size: .92em; }
    .content :not(pre) > code { padding: 1px 4px; border-radius: 3px; background: var(--vscode-textCodeBlock-background); }
    .content blockquote { margin: 10px 0; padding-left: 12px; border-left: 3px solid var(--vscode-textBlockQuote-border);
      color: var(--vscode-descriptionForeground); }
    .content table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 10px 0; }
    .content th, .content td { padding: 4px 8px; border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border)); }
    .status { margin: 0; color: var(--vscode-descriptionForeground); white-space: pre-wrap; overflow-wrap: anywhere; }
    .card[data-status="error"] .status { color: var(--vscode-errorForeground); }
    button { margin-top: 8px; padding: 3px 10px; border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 3px; color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground);
      cursor: pointer; font: inherit; }
    button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button:focus-visible, summary:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -2px; }
    [hidden] { display: none; }
  </style>
</head>
<body>
  <main id="cards" aria-label="翻译记录"></main>
  <template id="card-template">
    <article class="card">
      <details class="original">
        <summary><span class="label">原文</span></summary>
        <div class="section-body"><div class="content"></div></div>
      </details>
      <details class="translation" open>
        <summary>
          <span class="label">译文</span>
          <span class="metadata"><span class="provider"></span><span class="model" hidden></span></span>
          <span class="duration" title="本次执行耗时（含文档读取）" hidden></span>
        </summary>
        <div class="section-body" aria-live="polite">
          <p class="status" role="status"></p>
          <div class="content" hidden></div>
          <button type="button" hidden>重试</button>
        </div>
      </details>
    </article>
  </template>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const list = document.getElementById('cards');
    const template = document.getElementById('card-template');
    const cards = new Map();
    window.addEventListener('message', ({ data }) => {
      let appended;
      for (const state of data.cards) {
        let card = cards.get(state.id);
        if (!card) {
          const element = template.content.firstElementChild.cloneNode(true);
          card = {
            element,
            original: element.querySelector('.original .content'),
            translation: element.querySelector('.translation .content'),
            provider: element.querySelector('.provider'),
            model: element.querySelector('.model'),
            duration: element.querySelector('.duration'),
            status: element.querySelector('.status'),
            retry: element.querySelector('button'),
          };
          card.retry.addEventListener('click', () => vscode.postMessage({ action: 'retry', id: state.id }));
          cards.set(state.id, card);
          list.appendChild(element);
          appended = element;
        }
        // These HTML strings come only from the extension's Markdown renderer, with raw HTML and active links disabled.
        if (card.originalHtml !== state.originalHtml) {
          card.original.innerHTML = state.originalHtml;
          card.originalHtml = state.originalHtml;
        }
        const translatedHtml = state.translatedHtml ?? '';
        if (card.translatedHtml !== translatedHtml) {
          card.translation.innerHTML = translatedHtml;
          card.translatedHtml = translatedHtml;
        }
        card.provider.textContent = state.provider;
        card.provider.title = state.provider;
        card.model.textContent = state.model ?? '';
        card.model.title = state.model ?? '';
        card.model.hidden = !state.model;
        card.duration.hidden = state.durationMs === undefined;
        card.duration.textContent = state.durationMs === undefined ? '' : (state.durationMs / 1000).toFixed(2) + 's';
        card.element.dataset.status = state.status;
        card.element.setAttribute('aria-busy', String(state.status === 'loading'));
        card.translation.hidden = state.status !== 'ready';
        card.status.hidden = state.status === 'ready';
        card.status.textContent = state.status === 'error' ? '翻译失败：' + state.error : state.message ?? '';
        card.retry.hidden = state.status !== 'error';
      }
      appended?.scrollIntoView({ block: 'start' });
    });
    vscode.postMessage({ action: 'ready' });
  </script>
</body>
</html>`;
  }
}
