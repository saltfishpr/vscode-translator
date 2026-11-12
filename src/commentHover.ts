import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { CommentParser } from './comments';
import { commentLanguages } from './commentLanguages';
import type { SourceComment } from './comments';
import { getConfig } from './config';
import type { TranslatorConfig } from './config';
import { cachedTranslation, translate, translationKey } from './translation';

interface HoverSession {
  id: string;
  document: vscode.TextDocument;
  version: number;
  source: vscode.TextDocument;
  sourceVersion: number;
  range: vscode.Range;
  comment: SourceComment;
  config: TranslatorConfig;
  key: string;
  pending?: Promise<void>;
  error?: string;
}

export function registerCommentHover(ctx: vscode.ExtensionContext) {
  const parser = new CommentParser(ctx.asAbsolutePath('dist/parsers'));
  const sessions = new Map<string, HoverSession>();
  const output = vscode.window.createOutputChannel('Translator');
  const current = (session: HoverSession) =>
    sessions.has(session.id) &&
    !session.document.isClosed &&
    !session.source.isClosed &&
    session.document.version === session.version &&
    session.source.version === session.sourceVersion &&
    session.key === translationKey(session.comment.text, getConfig(), session.comment);

  ctx.subscriptions.push(
    parser,
    output,
    vscode.workspace.onDidChangeTextDocument(({ document }) => {
      parser.forget(document.uri.toString());
      for (const [id, session] of sessions) {
        if (session.document === document || session.source === document) {
          sessions.delete(id);
        }
      }
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      parser.forget(document.uri.toString());
      for (const [id, session] of sessions) {
        if (session.document === document || session.source === document) {
          sessions.delete(id);
        }
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('translator')) {
        sessions.clear();
      }
    }),
    vscode.commands.registerCommand('translator._translateComment', async (id: string) => {
      const session = sessions.get(id);
      const editor = vscode.window.activeTextEditor;
      if (
        !session ||
        !editor ||
        editor.document !== session.document ||
        !current(session) ||
        session.pending
      ) {
        return;
      }
      session.error = undefined;
      const progress = vscode.window.setStatusBarMessage('$(sync~spin) 正在翻译注释…');
      session.pending = translate(session.comment.text, session.config, session.comment)
        .then(
          () => {},
          (error: unknown) => {
            session.error = error instanceof Error ? error.message : String(error);
            output.appendLine(`Comment translation failed: ${session.error}`);
          }
        )
        .finally(() => {
          session.pending = undefined;
          progress.dispose();
        });

      // Start an async hover once, at the clicked symbol. Its cancellation token prevents
      // a completed request from reopening a hover the user has already dismissed.
      const selections = editor.selections;
      const anchor = new vscode.Selection(session.range.start, session.range.start);
      await vscode.commands.executeCommand('editor.action.hideHover');
      if (vscode.window.activeTextEditor !== editor || !current(session)) {
        return;
      }
      editor.selection = anchor;
      try {
        await vscode.commands.executeCommand('editor.action.showHover', { focus: 'noAutoFocus' });
      } finally {
        if (editor.selection.isEqual(anchor)) {
          editor.selections = selections;
        }
      }
    }),
    vscode.commands.registerCommand('translator._copyComment', async (id: string) => {
      const session = sessions.get(id);
      if (!session || !current(session)) {
        return;
      }
      const result = cachedTranslation(session.key);
      if (result) {
        await vscode.env.clipboard.writeText(result.text);
        vscode.window.setStatusBarMessage('✔ 已复制译文', 2000);
      }
    }),
    vscode.languages.registerHoverProvider(
      // A wildcard scores below language-specific providers, placing translations after their hovers.
      { language: '*' },
      {
        async provideHover(document, position, token) {
          if (!Object.hasOwn(commentLanguages, document.languageId)) {
            return;
          }
          const version = document.version;
          const range = document.getWordRangeAtPosition(position);
          if (!range) {
            return;
          }
          try {
            const read = async (
              source: vscode.TextDocument,
              at: vscode.Position,
              atDeclarationStart = false
            ) => {
              const sourceVersion = source.version;
              const comment = await parser.read(
                source.uri.toString(),
                sourceVersion,
                source.languageId,
                source.getText(),
                source.offsetAt(at),
                atDeclarationStart
              );
              if (comment && !source.isClosed && source.version === sourceVersion) {
                return { source, sourceVersion, comment };
              }
            };

            let found = await read(document, position);
            if (token.isCancellationRequested || document.version !== version) {
              return;
            }
            if (!found) {
              const definitions = await vscode.commands.executeCommand<
                (vscode.Location | vscode.LocationLink)[]
              >('vscode.executeDefinitionProvider', document.uri, position);
              if (token.isCancellationRequested || document.version !== version) {
                return;
              }
              for (const definition of definitions ?? []) {
                const uri = 'targetUri' in definition ? definition.targetUri : definition.uri;
                const at =
                  'targetUri' in definition
                    ? (definition.targetSelectionRange ?? definition.targetRange).start
                    : definition.range.start;
                let candidate;
                try {
                  candidate = await read(await vscode.workspace.openTextDocument(uri), at, true);
                } catch {
                  // Definitions can point to inaccessible dependencies or unsupported virtual documents.
                  continue;
                }
                if (token.isCancellationRequested || document.version !== version) {
                  return;
                }
                if (candidate) {
                  if (found && found.comment.text !== candidate.comment.text) {
                    // Do not choose an arbitrary comment when the symbol resolves ambiguously.
                    return;
                  }
                  found = candidate;
                }
              }
            }
            if (!found || token.isCancellationRequested || document.version !== version) {
              return;
            }

            const config = getConfig();
            const key = translationKey(found.comment.text, config, found.comment);
            let session = [...sessions.values()].find(
              (entry) =>
                entry.document === document &&
                entry.version === version &&
                entry.source === found.source &&
                entry.sourceVersion === found.sourceVersion &&
                entry.range.isEqual(range) &&
                entry.key === key
            );
            if (!session) {
              session = {
                id: randomUUID(),
                document,
                version,
                range,
                config,
                key,
                ...found,
              };
              if (sessions.size >= 100) {
                sessions.delete(sessions.keys().next().value!);
              }
              sessions.set(session.id, session);
            }
            if (session.pending) {
              await session.pending;
            }
            if (token.isCancellationRequested || !current(session)) {
              return;
            }

            const args = encodeURIComponent(JSON.stringify([session.id]));
            const actions = new vscode.MarkdownString();
            actions.isTrusted = {
              enabledCommands: ['translator._translateComment', 'translator._copyComment'],
            };
            const result = cachedTranslation(key);
            if (result) {
              const body = new vscode.MarkdownString();
              body.appendMarkdown('**译文 · ');
              body.appendText(`${config.targetLang} · ${result.provider} · ${(result.durationMs / 1000).toFixed(2)} 秒`);
              body.appendMarkdown(`**\n\n${result.text}`);
              actions.appendMarkdown(`[复制译文](command:translator._copyComment?${args})`);
              return new vscode.Hover([body, actions], range);
            }
            if (session.error) {
              const error = new vscode.MarkdownString();
              error.appendText(`翻译失败：${session.error.split(/\r?\n/)[0].slice(0, 200)}`);
              actions.appendMarkdown(`[重试](command:translator._translateComment?${args})`);
              return new vscode.Hover([error, actions], range);
            }
            actions.appendMarkdown(
              `[翻译](command:translator._translateComment?${args} "翻译此符号的注释")`
            );
            return new vscode.Hover(actions, range);
          } catch (error) {
            output.appendLine(`Cannot read comment: ${String(error)}`);
            return;
          }
        },
      }
    )
  );
}
