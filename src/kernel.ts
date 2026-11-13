// Çekirdek iş parçacığıyla konuşan istemci.
import type { Frame, KFeature, KernelRequest, KernelResponse, MassProps, MeasureItem, MeshData, SectionItem, FlatResult, CutItem, WeldItem, DrawData, Vec3 } from "./doc/types";

export type BuildResult = { mesh: MeshData | null; errors: { featureId: string; message: string }[]; frames: Record<string, Frame>; members: { key: string; name: string; body: number }[] };

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

  /** montaj: STEP veya bileşenler arası girişim */
  async asm(op: "step" | "interfere" | "clearance", parts: { features: KFeature[]; q: number[]; p: Vec3; name: string }[]): Promise<{ blob?: Blob | null; pairs?: { a: number; b: number; vol: number }[]; dist?: { a: number; b: number; d: number }[]; message?: string }> {
    await this.ready;
    return this.request({ type: "asm", op, parts } as any);
  }
  async build(features: KFeature[]): Promise<BuildResult> {
    await this.ready;
    const fontUrl = new URL("fonts/DejaVuSans.ttf", document.baseURI).href;
    const r = await this.request<BuildResult>({ type: "build", features, fontUrl } as any);
    return { mesh: r.mesh, errors: r.errors, frames: r.frames ?? {}, members: r.members ?? [] };
  }

  async export(format: "step" | "stl"): Promise<{ blob: Blob | null; message?: string }> {
    await this.ready;
    return this.request({ type: "export", format } as any);
  }

  async cutList(): Promise<CutItem[]> {
    return (await this.cutListFull()).items;
  }

  async cutListFull(): Promise<{ items: CutItem[]; welds: WeldItem[] }> {
    await this.ready;
    const r = await this.request<{ items: CutItem[]; welds: WeldItem[] }>({ type: "cutlist" } as any);
    return { items: r.items, welds: r.welds ?? [] };
  }

  async interfere(): Promise<{ a: number; b: number; vol: number }[]> {
    await this.ready;
    const r = await this.request<{ pairs: { a: number; b: number; vol: number }[] }>({ type: "interfere" } as any);
    return r.pairs;
  }

  async drawing(body: number): Promise<DrawData> {
    await this.ready;
    return this.request<DrawData>({ type: "drawing", body } as any);
  }

  async exportBody(body: number): Promise<{ blob: Blob | null; message?: string }> {
    await this.ready;
    return this.request({ type: "exportBody", body } as any);
  }

  async flat(body: number, t: number, k: number): Promise<FlatResult> {
    await this.ready;
    return this.request<FlatResult>({ type: "flat", body, t, k } as any);
  }

  async measure(items: MeasureItem[]): Promise<string[]> {
    await this.ready;
    const r = await this.request<{ lines: string[] }>({ type: "measure", items } as any);
    return r.lines;
  }

  async section(frame: Frame): Promise<SectionItem[]> {
    await this.ready;
    const r = await this.request<{ items: SectionItem[] }>({ type: "section", frame } as any);
    return r.items;
  }

  async props(): Promise<MassProps | null> {
    await this.ready;
    const r = await this.request<{ props: MassProps | null }>({ type: "props" } as any);
    return r.props;
  }
}
