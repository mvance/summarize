import type { SummaryLength } from "@steipete/summarize-core";

export type SummaryLengthArg =
  | { kind: "preset"; preset: SummaryLength }
  | { kind: "chars"; maxCharacters: number };

export function resolveTargetCharacters(
  lengthArg: SummaryLengthArg,
  maxMap: Record<SummaryLength, number>,
): number {
  return lengthArg.kind === "chars" ? lengthArg.maxCharacters : maxMap[lengthArg.preset];
}
