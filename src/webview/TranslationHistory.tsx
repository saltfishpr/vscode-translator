import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CardState } from "../translationPanel";
import { TranslationCard } from "./TranslationCard";

export function TranslationHistory({ onReady, onRetry }: { onReady: () => void; onRetry: (id: number) => void }) {
  const [cards, setCards] = useState(new Map<number, CardState>());
  const list = useRef<HTMLElement>(null);
  const previousCount = useRef(0);

  useEffect(() => {
    const receive = ({ data }: MessageEvent<{ cards: CardState[] }>) => {
      setCards((previous) => {
        const next = new Map(previous);
        for (const state of data.cards) {
          next.set(state.id, state);
        }
        return next;
      });
    };
    window.addEventListener("message", receive);
    onReady();
    return () => window.removeEventListener("message", receive);
  }, [onReady]);

  useLayoutEffect(() => {
    if (cards.size > previousCount.current) {
      list.current?.lastElementChild?.scrollIntoView({ block: "start" });
    }
    previousCount.current = cards.size;
  }, [cards]);

  return (
    <main id="cards" aria-label="翻译记录" ref={list}>
      {Array.from(cards.values())
        .sort((a, b) => a.id - b.id)
        .map((state) => (
          <TranslationCard key={state.id} state={state} onRetry={onRetry} />
        ))}
    </main>
  );
}
