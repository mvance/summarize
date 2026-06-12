export type SummaryStreamChunk = {
  streamed: string;
  prevStreamed: string;
  appended: string;
};

export type SummaryStreamHandler = {
  onChunk: (chunk: SummaryStreamChunk) => boolean | Promise<boolean>;
  onDone?: ((finalText: string) => boolean | Promise<boolean>) | null;
  onReset: () => void | Promise<void>;
};
