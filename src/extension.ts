import * as vscode from "vscode";
import { getConfig, updateConfig } from "./config";
import { registerTranslationHover } from "./hover";
import { translate } from "./translation";
import { TranslationPanel } from "./translationPanel";

let statusBar: vscode.StatusBarItem;

export function activate(ctx: vscode.ExtensionContext) {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = "translator.pickProvider";
  refreshStatusBar();
  statusBar.show();
  const panel = new TranslationPanel();
  ctx.subscriptions.push(statusBar, panel);
  registerTranslationHover(ctx, panel);

  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("translator")) {
        refreshStatusBar();
      }
    }),
    vscode.commands.registerCommand("translator.translateSelection", () => translateSelection(panel)),
    vscode.commands.registerCommand("translator.translateAndReplace", translateAndReplace),
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

async function translateSelection(panel: TranslationPanel) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("没有活动编辑器。");
    return;
  }
  const text = editor.document.getText(editor.selection);
  if (!text.trim()) {
    vscode.window.showWarningMessage("请先选中需要翻译的文本。");
    return;
  }

  await panel.show(text, getConfig());
}

async function translateAndReplace() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("没有活动编辑器。");
    return;
  }
  const document = editor.document;
  const version = document.version;
  const sel = editor.selection;
  const text = document.getText(sel);
  if (!text.trim()) {
    vscode.window.showWarningMessage("请先选中需要翻译的文本。");
    return;
  }

  const cfg = getConfig();
  const progress = vscode.window.setStatusBarMessage(`$(sync~spin) 正在使用 ${cfg.provider} 翻译…`);
  try {
    const result = await translate(text, cfg);
    if (document.isClosed || document.version !== version) {
      vscode.window.showWarningMessage("文档已更改或关闭，未替换原文。请重新选择后翻译。");
      return;
    }
    const applied = await editor.edit((eb) => eb.replace(sel, result.text));
    if (applied) {
      vscode.window.setStatusBarMessage(`$(check) 已替换为译文（${result.provider}）`, 3000);
    } else {
      vscode.window.showWarningMessage("无法替换选区，文档可能已更改或不可编辑。");
    }
  } catch (error) {
    vscode.window.showErrorMessage(`翻译或替换失败：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    progress.dispose();
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
