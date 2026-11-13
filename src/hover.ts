import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { getConfig } from "./config";
import { HoverDocument, translateHoverCommand } from "./hoverTranslation";
import type { TranslationPanel } from "./translationPanel";

/** Adds a translation action only where other providers supply translatable documentation. */
export function registerTranslationHover(ctx: vscode.ExtensionContext, panel: TranslationPanel): void {
  const sessions = new Map<string, { document: vscode.TextDocument; version: number; position: vscode.Position }>();
  const querying = new Set<string>();

  async function readHoverDocument(document: vscode.TextDocument, position: vscode.Position): Promise<HoverDocument> {
    const key = JSON.stringify([document.uri.toString(), position.line, position.character]);
    querying.add(key);
    try {
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        document.uri,
        position,
      );
      return new HoverDocument(hovers ?? []);
    } finally {
      querying.delete(key);
    }
  }

  ctx.subscriptions.push(
    {
      dispose: () => {
        sessions.clear();
        querying.clear();
      },
    },
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
    vscode.commands.registerCommand(translateHoverCommand, async (id: unknown) => {
      const session = typeof id === "string" ? sessions.get(id) : undefined;
      if (!session || session.document.isClosed || session.document.version !== session.version) {
        vscode.window.showWarningMessage("文档已更改或关闭，请重新悬停后翻译。");
        return;
      }

      await panel.show(async () => {
        if (session.document.isClosed || session.document.version !== session.version) {
          throw new Error("文档已更改或关闭，请重新悬停后翻译。");
        }
        const hoverDocument = await readHoverDocument(session.document, session.position);
        if (session.document.isClosed || session.document.version !== session.version) {
          throw new Error("文档已更改或关闭，请重新悬停后翻译。");
        }
        return hoverDocument;
      }, getConfig());
    }),
    vscode.languages.registerHoverProvider("*", {
      async provideHover(document, position, token) {
        const key = JSON.stringify([document.uri.toString(), position.line, position.character]);
        // executeHoverProvider invokes this provider too; skip only the position being queried.
        if (token.isCancellationRequested || document.isClosed || querying.has(key)) {
          return;
        }
        const version = document.version;
        let hoverDocument: HoverDocument;
        try {
          hoverDocument = await readHoverDocument(document, position);
        } catch {
          return;
        }
        if (
          token.isCancellationRequested ||
          document.isClosed ||
          document.version !== version ||
          !hoverDocument.shouldTranslate
        ) {
          return;
        }
        const id = randomUUID();
        if (sessions.size >= 100) {
          sessions.delete(sessions.keys().next().value!);
        }
        sessions.set(id, { document, version, position });
        const args = encodeURIComponent(JSON.stringify([id]));
        const action = new vscode.MarkdownString(
          `[翻译](command:${translateHoverCommand}?${args} "在右侧翻译 Hover 文档")`,
        );
        action.isTrusted = { enabledCommands: [translateHoverCommand] };
        return new vscode.Hover(action, document.getWordRangeAtPosition(position));
      },
    }),
  );
}
