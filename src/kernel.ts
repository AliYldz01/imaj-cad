// Çekirdek iş parçacığıyla konuşan istemci.
import type { Frame, KFeature, KernelRequest, KernelResponse, MassProps, MeasureItem, MeshData } from "./doc/types";

export type BuildResult = { mesh: MeshData | null; errors: { featureId: string; message: string }[]; frames: Record<string, Frame> };

export class Kernel {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, (r: any) => void>();
  readonly ready: Promise<void>;

  constructor() {
    this.worker = new Worker(new URL("./kernel.worker.ts", import.meta.url), { type: "module" });
    let resolveReady!: () => void;
    let rejectReady!: (e: Error) => void;
    this.ready = new Promise((res, rej) => {
      resolveReady = res;
      rejectReady = rej;
    });
    this.worker.onmessage = (ev: MessageEvent<KernelResponse>) => {
      const msg = ev.data;
      if (msg.type === "ready") return resolveReady();
      if (msg.type === "fatal") return rejectReady(new Error(msg.message));
      const cb = this.pending.get(msg.id);
      if (cb) {
        this.pending.delete(msg.id);
        cb(msg);
      }
    };
    this.worker.onerror = (e) => rejectReady(new Error(e.message || "Çekirdek başlatılamadı"));
  }

  private request<T>(req: Omit<KernelRequest, "id">): Promise<T> {
    const id = this.nextId++;
    return new Promise((res) => {
      this.pending.set(id, res);
      this.worker.postMessage({ ...req, id });
    });
  }

  async build(features: KFeature[]): Promise<BuildResult> {
    await this.ready;
    const r = await this.request<BuildResult>({ type: "build", features } as any);
    return { mesh: r.mesh, errors: r.errors, frames: r.frames ?? {} };
  }

  async export(format: "step" | "stl"): Promise<{ blob: Blob | null; message?: string }> {
    await this.ready;
    return this.request({ type: "export", format } as any);
  }

  async measure(items: MeasureItem[]): Promise<string[]> {
    await this.ready;
    const r = await this.request<{ lines: string[] }>({ type: "measure", items } as any);
    return r.lines;
  }

  async props(): Promise<MassProps | null> {
    await this.ready;
    const r = await this.request<{ props: MassProps | null }>({ type: "props" } as any);
    return r.props;
  }
}
