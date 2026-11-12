import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { getConfig } from "./config";
import { HoverDocument, translateHoverCommand } from "./hoverTranslation";
import { renderPanelHtml } from "./translationPanel";

interface HoverSession {
  id: string;
  document: vscode.TextDocument;
  version: number;
  position: vscode.Position;
  range: vscode.Range;
}

export function registerTranslationHover(ctx: vscode.ExtensionContext) {
  const sessions = new Map<string, HoverSession>();
  const output = vscode.window.createOutputChannel("Translator");

  ctx.subscriptions.push(
    output,
    vscode.workspace.onDidChangeTextDocument(({ document }) => {
      for (const [id, session] of sessions) {
        if (session.document === document) {
          sessions.delete(id);
        }
      }
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      for (const [id, session] of sessions) {
        if (session.document === document) {
          sessions.delete(id);
        }
      }
    }),
    vscode.commands.registerCommand(translateHoverCommand, async (id: string) => {
      const session = sessions.get(id);
      if (!session || session.document.isClosed || session.document.version !== session.version) {
        vscode.window.showWarningMessage("文档已更改或关闭，请重新悬停后翻译。");
        return;
      }

      const config = getConfig();
      const panel = vscode.window.createWebviewPanel(
        "translatorResult",
        "Hover Translation",
        vscode.ViewColumn.Beside,
        {
          enableScripts: false,
          enableCommandUris: [translateHoverCommand],
        },
      );
      let closed = false;
      const onClose = panel.onDidDispose(() => {
        closed = true;
      });
      const progress = vscode.window.setStatusBarMessage("$(sync~spin) 正在翻译 Hover…");
      let original = "";
      panel.webview.html = renderPanelHtml("", "正在读取 Hover 文档…");
      try {
        // Only the click handler queries providers; doing this in provideHover would recurse.
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          "vscode.executeHoverProvider",
          session.document.uri,
          session.position,
        );
        if (closed) {
          return;
        }
        if (session.document.isClosed || session.document.version !== session.version) {
          panel.webview.html = renderPanelHtml("", "文档已更改或关闭，请重新悬停后翻译。");
          return;
        }
        const document = new HoverDocument(hovers ?? []);
        original = document.original;
        panel.webview.html = renderPanelHtml(original, "正在翻译 Hover 正文…");
        const result = await document.translate(config);
        if (!closed) {
          panel.webview.html = result
            ? renderPanelHtml(
                original,
                result.text,
                `${config.targetLang} · ${result.provider} · ${(result.durationMs / 1000).toFixed(2)} 秒`,
              )
            : renderPanelHtml(original, "没有可翻译的 Hover 正文（文档为空或仅包含代码块）。");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        output.appendLine(`Hover translation failed: ${message}`);
        if (!closed) {
          const retry = `command:${translateHoverCommand}?${encodeURIComponent(JSON.stringify([session.id]))}`;
          panel.webview.html = renderPanelHtml(original, `翻译失败：${message}`, undefined, retry);
        }
      } finally {
        progress.dispose();
        onClose.dispose();
      }
    }),
    vscode.languages.registerHoverProvider(
      { language: "*" },
      {
        provideHover(document, position, token) {
          if (token.isCancellationRequested) {
            return;
          }
          const range = document.getWordRangeAtPosition(position);
          if (!range) {
            return;
          }
          let session = [...sessions.values()].find(
            (entry) => entry.document === document && entry.version === document.version && entry.range.isEqual(range),
          );
          if (!session) {
            session = { id: randomUUID(), document, version: document.version, position, range };
            if (sessions.size >= 100) {
              sessions.delete(sessions.keys().next().value!);
            }
            sessions.set(session.id, session);
          }
          const args = encodeURIComponent(JSON.stringify([session.id]));
          const action = new vscode.MarkdownString(
            `[翻译](command:${translateHoverCommand}?${args} "在右侧翻译 Hover 文档")`,
          );
          action.isTrusted = { enabledCommands: [translateHoverCommand] };
          return new vscode.Hover(action, range);
        },
      },
    ),
  );
}
