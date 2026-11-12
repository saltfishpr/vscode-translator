import * as vscode from "vscode";
import { getConfig, updateConfig } from "./config";
import { registerTranslationHover } from "./hover";
import { translate } from "./translation";
import { renderPanelHtml } from "./translationPanel";

let statusBar: vscode.StatusBarItem;

export function activate(ctx: vscode.ExtensionContext) {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = "translator.pickProvider";
  refreshStatusBar();
  statusBar.show();
  ctx.subscriptions.push(statusBar);
  registerTranslationHover(ctx);

  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("translator")) {
        refreshStatusBar();
      }
    }),
    vscode.commands.registerCommand("translator.translateSelection", () => runTranslate(false)),
    vscode.commands.registerCommand("translator.translateAndReplace", () => runTranslate(true)),
    vscode.commands.registerCommand("translator.pickProvider", pickProvider),
    vscode.commands.registerCommand("translator.pickTargetLang", pickTargetLang),
  );
}

export function deactivate() {}

function refreshStatusBar() {
  const cfg = getConfig();
  statusBar.text = `$(globe) ${cfg.provider} → ${cfg.targetLang}`;
  statusBar.tooltip = "Click to switch translation provider";
}

async function runTranslate(replace: boolean) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor.");
    return;
  }
  const sel = editor.selection;
  const text = editor.document.getText(sel).trim();
  if (!text) {
    vscode.window.showWarningMessage("Please select some text first.");
    return;
  }

  const cfg = getConfig();

  const progress = vscode.window.setStatusBarMessage(`$(sync~spin) Translating with ${cfg.provider}...`);
  let result;
  try {
    result = await translate(text, cfg);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Translate failed: ${err.message}`);
    return;
  } finally {
    progress.dispose();
  }

  if (replace) {
    await editor.edit((eb) => eb.replace(sel, result.text));
    vscode.window.setStatusBarMessage(`✔ Replaced with translation (${result.provider})`, 3000);
  } else {
    const panel = vscode.window.createWebviewPanel("translatorResult", "Translation Result", vscode.ViewColumn.Beside, {
      enableScripts: false,
    });
    panel.webview.html = renderPanelHtml(text, result.text);
  }
}

async function pickProvider() {
  const items: vscode.QuickPickItem[] = [
    { label: "openai", description: "OpenAI" },
    { label: "deepseek", description: "DeepSeek" },
    { label: "zai", description: "Z.AI（pi-ai 内置 Coding Plan 端点）" },
    { label: "openai-compatible", description: "自定义兼容接口（如智谱、Z.AI 普通 API、火山方舟）" },
    { label: "google", description: "Google Translate" },
    { label: "deepl", description: "DeepL" },
    { label: "baidu", description: "Baidu Translate" },
  ];
  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: "Choose translation provider",
  });
  if (pick) {
    await updateConfig("provider", pick.label);
    vscode.window.setStatusBarMessage(`Provider → ${pick.label}`, 2000);
  }
}

async function pickTargetLang() {
  const langs = ["zh-CN", "zh-TW", "en", "ja", "ko", "fr", "de", "es", "ru", "pt", "it"];
  const pick = await vscode.window.showQuickPick(langs, {
    placeHolder: "Choose target language",
  });
  if (pick) {
    await updateConfig("targetLang", pick);
    vscode.window.setStatusBarMessage(`Target → ${pick}`, 2000);
  }
}
