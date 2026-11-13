import { createRoot } from "react-dom/client";
import { TranslationHistory } from "./TranslationHistory";
import "./styles.css";

declare function acquireVsCodeApi(): {
  postMessage(message: { action: "ready" } | { action: "retry"; id: number }): void;
};

const vscode = acquireVsCodeApi();
const onReady = () => vscode.postMessage({ action: "ready" });
const onRetry = (id: number) => vscode.postMessage({ action: "retry", id });

createRoot(document.getElementById("root")!).render(<TranslationHistory onReady={onReady} onRetry={onRetry} />);
