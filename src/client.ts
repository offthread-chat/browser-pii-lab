import type { Span } from "./types";
export type ModelResult = {
  spans: Span[];
  loadMs: number;
  inferenceMs: number;
  initialized: boolean;
  resources: unknown[];
  inputTokens: number;
  chunks: number;
  firstChunkMs: number | null;
};
export class ModelClient {
  private worker: Worker | null = null;
  private model = "";
  private next = 0;
  private pending: {
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  cancel() {
    this.worker?.terminate();
    this.worker = null;
    this.model = "";
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error("Cancelled; worker released."));
      this.pending = null;
    }
  }
  async detect(
    model: string,
    text: string,
    progress: (text: string) => void = () => {},
    profile = false,
  ): Promise<ModelResult> {
    if (this.pending) throw new Error("A detection is already running");
    if (model !== this.model) {
      this.cancel();
      this.model = model;
    }
    if (!this.worker)
      this.worker = new Worker(new URL("./model.worker.ts", import.meta.url), {
        type: "module",
      });
    const worker = this.worker,
      id = ++this.next;
    return new Promise((resolve, reject) => {
      const finish = () => {
        if (this.pending) clearTimeout(this.pending.timer);
        this.pending = null;
      };
      this.pending = {
        reject,
        timer: setTimeout(() => this.cancel(), profile ? 1800000 : 180000),
      };
      worker.onmessage = (e) => {
        if (e.data.id !== id) return;
        if (e.data.progress) {
          progress(e.data.progress);
          return;
        }
        finish();
        if (e.data.error) {
          this.cancel();
          reject(new Error(e.data.error));
        } else resolve(e.data.result);
      };
      worker.onerror = () => {
        finish();
        this.cancel();
        reject(
          new Error("Worker failed. Check browser compatibility or retry."),
        );
      };
      worker.postMessage({ id, model, text, profile });
    });
  }
}
