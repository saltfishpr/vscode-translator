import { memo, useState } from "react";
import type { CardState } from "../translationPanel";

export const TranslationCard = memo(function TranslationCard({
  state,
  onRetry,
}: {
  state: CardState;
  onRetry: (id: number) => void;
}) {
  const [translationOpen, setTranslationOpen] = useState(true);
  const ready = state.status === "ready";
  const loading = state.status === "loading";
  const failed = state.status === "error";

  // HTML comes only from the extension's Markdown renderer, with raw HTML and active links disabled.
  return (
    <article className="card" data-status={state.status} aria-busy={loading}>
      <details className="original">
        <summary>
          <span className="label">原文</span>
        </summary>
        <div className="section-body">
          <div className="content" dangerouslySetInnerHTML={{ __html: state.originalHtml }} />
        </div>
      </details>
      <details
        className="translation"
        open={translationOpen}
        onToggle={(event) => setTranslationOpen(event.currentTarget.open)}
      >
        <summary>
          <span className="label">译文</span>
          <span className="metadata">
            <span className="provider" title={state.provider}>
              {state.provider}
            </span>
            <span className="model" title={state.model ?? ""} hidden={!state.model}>
              {state.model ?? ""}
            </span>
          </span>
          <span className="duration" title="本次执行耗时（含文档读取）" hidden={state.durationMs === undefined}>
            {state.durationMs === undefined ? "" : `${(state.durationMs / 1000).toFixed(2)}s`}
          </span>
        </summary>
        <div className="section-body" aria-live="polite">
          <p className="status" role="status" hidden={ready}>
            {failed ? `翻译失败：${state.error}` : (state.message ?? "")}
          </p>
          <div className="content" hidden={!ready} dangerouslySetInnerHTML={{ __html: state.translatedHtml ?? "" }} />
          <button type="button" hidden={!failed} onClick={() => onRetry(state.id)}>
            重试
          </button>
        </div>
      </details>
    </article>
  );
});
