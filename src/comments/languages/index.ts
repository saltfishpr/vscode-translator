import { cpp } from "./cpp";
import { csharp } from "./csharp";
import { go } from "./go";
import { java } from "./java";
import { php } from "./php";
import { python } from "./python";
import { ruby } from "./ruby";
import { rust } from "./rust";
import { javascript, tsx, typescript } from "./typescript";
import type { CommentLanguage } from "../types";

/** Internal source language rules for declaration and documentation extraction. */
export const commentLanguages: Readonly<Record<string, CommentLanguage>> = {
  go,
  typescript,
  typescriptreact: tsx,
  javascript,
  javascriptreact: javascript,
  python,
  java,
  c: cpp,
  cpp,
  csharp,
  rust,
  php,
  ruby,
};
