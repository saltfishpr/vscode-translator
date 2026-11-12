/** Renders untrusted provider and translation text without executing HTML, scripts, or document links. */
export function renderPanelHtml(original: string, translated: string, details?: string, retry?: string): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"/>
<style>
  body{font-family:var(--vscode-font-family);padding:16px;line-height:1.6}
  h3{margin-top:0}
  pre{background:var(--vscode-textBlockQuote-background);
      padding:12px;border-radius:6px;white-space:pre-wrap;word-wrap:break-word}
</style></head>
<body>
  ${details ? `<p>${esc(details)}</p>` : ""}
  <h3>Original</h3><pre>${esc(original)}</pre>
  <h3>Translation</h3><pre>${esc(translated)}</pre>
  ${retry ? `<p><a href="${esc(retry)}">重试</a></p>` : ""}
</body></html>`;
}
