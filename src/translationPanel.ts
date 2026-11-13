import { randomUUID } from "node:crypto";
import MarkdownIt from "markdown-it";
import * as vscode from "vscode";
import type { TranslatorConfig } from "./config";
import type { HoverDocument } from "./hoverTranslation";
import { translate } from "./translation";

type TranslationInput = string | HoverDocument | (() => Promise<HoverDocument>);

export type CardState = {
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

  constructor(private readonly extensionUri: vscode.Uri) {}

  /** Appends a card without taking focus; document loading and translation update only that card. */
  async show(input: string | (() => Promise<HoverDocument>), config: TranslatorConfig): Promise<void> {
    this.ensurePanel();
    const card: TranslationCard = {
      state: { id: ++this.nextId, originalHtml: "", provider: config.provider, status: "loading" },
      input,
      config,
    };
    this.cards.set(card.state.id, card);
    await this.run(card);
  }

  private ensurePanel(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }
    const resourceRoot = vscode.Uri.joinPath(this.extensionUri, "dist", "webview");
    const panel = vscode.window.createWebviewPanel(
      "translatorResult",
      "Translation Result",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, localResourceRoots: [resourceRoot] },
    );
    this.panel = panel;
    const messages = panel.webview.onDidReceiveMessage(async (message: unknown) => {
      if (!message || typeof message !== "object" || !("action" in message) || this.panel !== panel) {
        return;
      }
      if (message.action === "ready") {
        // Hidden webviews may reload; restore all card snapshots in insertion order.
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
    panel.webview.html = this.renderHtml(panel.webview, resourceRoot);
  }

  private async run(card: TranslationCard): Promise<void> {
    const started = performance.now();
    const { config } = card;
    const id = card.state.id;
    let input = card.input;
    const message = typeof input === "function" ? "正在读取 Hover 文档…" : "正在翻译…";
    let originalHtml = "";
    if (typeof input !== "function") {
      originalHtml = markdown.render(typeof input === "string" ? input : input.original);
    }
    card.state = {
      id,
      originalHtml,
      provider: config.provider,
      model: ["google", "deepl", "baidu"].includes(config.provider) ? undefined : config.model,
      status: "loading",
      message,
    };
    const progress = vscode.window.setStatusBarMessage(`$(sync~spin) ${message}`);
    card.progress = progress;
    this.update(card.state);
    try {
      if (typeof input === "function") {
        input = await input();
        if (this.cards.get(id) !== card) {
          return;
        }
        // Retry a loaded snapshot instead of querying potentially changed provider documentation again.
        card.input = input;
        card.state = {
          ...card.state,
          originalHtml: markdown.render(input.original),
          message: "正在翻译…",
        };
        this.update(card.state);
      }
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
        this.update(card.state);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.cards.get(id) === card) {
        this.output.appendLine(`Translation failed (${config.provider}): ${message}`);
        card.state = { ...card.state, status: "error", error: message, durationMs: performance.now() - started };
        this.update(card.state);
      }
    } finally {
      progress.dispose();
      card.progress = undefined;
    }
  }

  private update(state?: CardState): void {
    if (this.panel) {
      const cards = state ? [state] : Array.from(this.cards.values(), ({ state }) => state);
      void this.panel.webview.postMessage({ cards });
    }
  }

  /** Releases the result view and log; late results cannot recreate either. */
  dispose(): void {
    this.panel?.dispose();
    this.output.dispose();
  }

  private renderHtml(webview: vscode.Webview, resourceRoot: vscode.Uri): string {
    const nonce = randomUUID();
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(resourceRoot, "index.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(resourceRoot, "index.css"));
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${styleUri}" />
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
