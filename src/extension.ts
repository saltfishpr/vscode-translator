import * as vscode from 'vscode';
import { getConfig, updateConfig } from './config';
import { createTranslator } from './translators';

let statusBar: vscode.StatusBarItem;

export function activate(ctx: vscode.ExtensionContext) {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'translator.pickProvider';
  refreshStatusBar();
  statusBar.show();
  ctx.subscriptions.push(statusBar);

  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('translator')) {
        refreshStatusBar();
      }
    }),
    vscode.commands.registerCommand('translator.translateSelection', () => runTranslate(false)),
    vscode.commands.registerCommand('translator.translateAndReplace', () => runTranslate(true)),
    vscode.commands.registerCommand('translator.pickProvider', pickProvider),
    vscode.commands.registerCommand('translator.pickTargetLang', pickTargetLang),
    vscode.commands.registerCommand('translator._copy', async (text: string) => {
      await vscode.env.clipboard.writeText(text);
      vscode.window.setStatusBarMessage('✔ Copied translation', 2000);
    }),
    vscode.commands.registerCommand(
      'translator._replace',
      async (args: {
        uri: string;
        range: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
        text: string;
      }) => {
        const uri = vscode.Uri.parse(args.uri);
        const ed = vscode.window.visibleTextEditors.find(
          (e) => e.document.uri.toString() === uri.toString()
        );
        if (!ed) {
          return;
        }
        const range = new vscode.Range(
          new vscode.Position(args.range.start.line, args.range.start.character),
          new vscode.Position(args.range.end.line, args.range.end.character)
        );
        await ed.edit((eb) => eb.replace(range, args.text));
      }
    )
  );
}

export function deactivate() {}

function refreshStatusBar() {
  const cfg = getConfig();
  statusBar.text = `$(globe) ${cfg.provider} → ${cfg.targetLang}`;
  statusBar.tooltip = 'Click to switch translation provider';
}

async function runTranslate(replace: boolean) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor.');
    return;
  }
  const sel = editor.selection;
  const text = editor.document.getText(sel).trim();
  if (!text) {
    vscode.window.showWarningMessage('Please select some text first.');
    return;
  }

  const cfg = getConfig();
  const translator = createTranslator(cfg);

  const progress = vscode.window.setStatusBarMessage(
    `$(sync~spin) Translating with ${translator.name}...`
  );
  try {
    const result = await translator.translate({
      text,
      sourceLang: cfg.sourceLang,
      targetLang: cfg.targetLang,
    });

    if (replace) {
      await editor.edit((eb) => eb.replace(sel, result.text));
      vscode.window.setStatusBarMessage(`✔ Replaced with translation (${result.provider})`, 3000);
      return;
    }

    await showResult(editor, sel, text, result.text, cfg.displayMode);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Translate failed: ${err.message}`);
  } finally {
    progress.dispose();
  }
}

async function showResult(
  editor: vscode.TextEditor,
  sel: vscode.Selection,
  original: string,
  translated: string,
  mode: 'hover' | 'panel'
) {
  switch (mode) {
    case 'panel': {
      const panel = vscode.window.createWebviewPanel(
        'translatorResult',
        'Translation Result',
        vscode.ViewColumn.Beside,
        { enableScripts: false }
      );
      panel.webview.html = renderPanelHtml(original, translated);
      break;
    }
    case 'hover':
    default: {
      await showHoverAtSelection(editor, sel, original, translated);
    }
  }
}

async function showHoverAtSelection(
  editor: vscode.TextEditor,
  sel: vscode.Selection,
  original: string,
  translated: string
) {
  const range = new vscode.Range(sel.start, sel.end);
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.supportHtml = false;
  md.appendMarkdown(`**Translation**\n\n${translated}\n\n---\n\n`);
  const copyArgs = encodeURIComponent(JSON.stringify([translated]));
  const replaceArgs = encodeURIComponent(
    JSON.stringify([
      { uri: editor.document.uri.toString(), range: serializeRange(range), text: translated },
    ])
  );
  md.appendMarkdown(
    `[Copy](command:translator._copy?${copyArgs}) · [Replace](command:translator._replace?${replaceArgs})`
  );

  const provider = vscode.languages.registerHoverProvider(
    { scheme: editor.document.uri.scheme, pattern: editor.document.uri.fsPath },
    {
      provideHover(doc, pos) {
        if (doc.uri.toString() !== editor.document.uri.toString()) {
          return;
        }
        if (!range.contains(pos)) {
          return;
        }
        return new vscode.Hover(md, range);
      },
    }
  );

  // 把光标移动到选区起点，让悬浮框出现在选中文本附近
  editor.selection = new vscode.Selection(sel.start, sel.start);
  await vscode.commands.executeCommand('editor.action.showHover');
  // 恢复原选区
  editor.selection = sel;

  // 在用户切换选区或编辑后清理 provider；延迟订阅，避免上面恢复选区立即触发
  const disposables: vscode.Disposable[] = [provider];
  const cleanup = () => {
    disposables.forEach((d) => d.dispose());
  };
  setTimeout(() => {
    disposables.push(
      vscode.window.onDidChangeTextEditorSelection(() => cleanup()),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === editor.document.uri.toString()) {
          cleanup();
        }
      })
    );
  }, 300);
  setTimeout(cleanup, 30000);
}

function serializeRange(r: vscode.Range) {
  return {
    start: { line: r.start.line, character: r.start.character },
    end: { line: r.end.line, character: r.end.character },
  };
}

function renderPanelHtml(original: string, translated: string): string {
  const esc = (s: string) =>
    s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body{font-family:var(--vscode-font-family);padding:16px;line-height:1.6}
  h3{margin-top:0}
  pre{background:var(--vscode-textBlockQuote-background);
      padding:12px;border-radius:6px;white-space:pre-wrap;word-wrap:break-word}
</style></head>
<body>
  <h3>Original</h3><pre>${esc(original)}</pre>
  <h3>Translation</h3><pre>${esc(translated)}</pre>
</body></html>`;
}

async function pickProvider() {
  const items: vscode.QuickPickItem[] = [
    { label: 'google', description: 'Google Translate' },
    { label: 'deepl', description: 'DeepL' },
    { label: 'openai', description: 'OpenAI / compatible LLM' },
    { label: 'baidu', description: 'Baidu Translate' },
  ];
  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: 'Choose translation provider',
  });
  if (pick) {
    await updateConfig('provider', pick.label);
    vscode.window.setStatusBarMessage(`Provider → ${pick.label}`, 2000);
  }
}

async function pickTargetLang() {
  const langs = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'pt', 'it'];
  const pick = await vscode.window.showQuickPick(langs, {
    placeHolder: 'Choose target language',
  });
  if (pick) {
    await updateConfig('targetLang', pick);
    vscode.window.setStatusBarMessage(`Target → ${pick}`, 2000);
  }
}
