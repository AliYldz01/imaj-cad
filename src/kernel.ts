// Çekirdek iş parçacığıyla konuşan istemci.
import type { Frame, KFeature, KernelRequest, KernelResponse, MassProps, MeasureItem, MeshData, SectionItem, FlatResult, CutItem, WeldItem, DrawData, Vec3, RefHeals } from "./doc/types";

export type BuildResult = { mesh: MeshData | null; errors: { featureId: string; message: string }[]; frames: Record<string, Frame>; members: { key: string; name: string; body: number }[]; heals?: RefHeals };

/** Kiriş orta kesiti: cu = v yönündeki en uzak lif (Iu ile), cv = u yönündeki (Iv ile) */
export interface BeamSec { ax: number; u: number; v: number; L: number; A: number; Iu: number; Iv: number; Iuv: number; cu: number; cv: number; c: [number, number] }

export class Kernel {
  private worker!: Worker;
  private nextId = 1;
  private pending = new Map<number, (r: any) => void>();
  ready!: Promise<void>;
  /** P-2: kurulum bu süreyi aşarsa çekirdek yeniden başlatılır (kilitlenen OCC işlemi) */
  buildTimeout = 120000;
  onRestart?: () => void;

  constructor() {
    this.spawn();
  }

  private spawn() {
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

  /** kilitlenen çekirdeği durdurur, bekleyen isteklere hata döner, yenisini başlatır */
  restart(msg = "Çekirdek yanıt vermedi; yeniden başlatıldı") {
    this.worker.terminate();
    const cbs = [...this.pending.values()];
    this.pending.clear();
    this.spawn();
    for (const cb of cbs) cb({ error: msg, message: msg, mesh: null, errors: [{ featureId: "", message: msg }] });
    this.onRestart?.();
  }

  private request<T>(req: Omit<KernelRequest, "id">, timeout = 0): Promise<T> {
    const id = this.nextId++;
    return new Promise((res) => {
      let t = 0;
      this.pending.set(id, (r) => (clearTimeout(t), res(r)));
      this.worker.postMessage({ ...req, id });
      if (timeout) t = window.setTimeout(() => this.pending.has(id) && this.restart(`İşlem ${Math.round(timeout / 1000)} sn içinde bitmedi; çekirdek yeniden başlatıldı (son değişikliği kontrol edin)`), timeout);
    });
  }

  /** montaj: STEP veya bileşenler arası girişim */
  async pdraw(features: KFeature[], opts: { iso?: boolean; section?: boolean; third?: boolean }): Promise<any> {
    await this.ready;
    return this.request<any>({ type: "pdraw", features, opts } as any);
  }
  async asm(op: "step" | "interfere" | "clearance" | "draw", parts: { features: KFeature[]; q: number[]; p: Vec3; name: string }[]): Promise<{ blob?: Blob | null; pairs?: { a: number; b: number; vol: number; v?: number[]; t?: number[] }[]; dist?: { a: number; b: number; d: number }[]; message?: string; draw?: any; error?: string }> {
    await this.ready;
    return this.request({ type: "asm", op, parts } as any);
  }
  async build(features: KFeature[]): Promise<BuildResult> {
    await this.ready;
    const fontUrl = new URL("fonts/DejaVuSans.ttf", document.baseURI).href;
    const r = await this.request<BuildResult>({ type: "build", features, fontUrl } as any, this.buildTimeout);
    return { mesh: r.mesh, errors: r.errors, frames: r.frames ?? {}, members: r.members ?? [], heals: r.heals };
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

  async flat(body: number, t: number, k: number, table?: { angle: number; ba: number }[], r?: number): Promise<FlatResult> {
    await this.ready;
    return this.request<FlatResult>({ type: "flat", body, t, k, table, r } as any);
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

  /** İki yüzün kesişim eğrileri (düz yüz sınırsız düzlem sayılır) — nokta zincirleri */
  async isect(a: import("./doc/types").FaceRef, b: import("./doc/types").FaceRef): Promise<Vec3[][]> {
    await this.ready;
    const r = await this.request<{ r: Vec3[][] }>({ type: "isect", a, b } as any);
    return r.r ?? [];
  }
  /** yüz noktasını oluşturan özellik (araç katısının sınırında; son özellikten geriye) */
  async faceOwner(c: Vec3): Promise<string | null> {
    await this.ready;
    const r = await this.request<{ r: string | null }>({ type: "owner", c } as any);
    return r.r ?? null;
  }
  /** Geometri kontrolü: gövde başına geçerlilik, serbest kenar, kısa kenar, küçük yüz, hacim */
  async check(): Promise<{ bodies: { i: number; valid: boolean; free: number; short: number; small: number; volume: number; faces: number; edges: number }[]; surfs: number }> {
    await this.ready;
    const r = await this.request<{ r: any }>({ type: "check" } as any);
    return r.r;
  }

  async beam(ax = -1): Promise<BeamSec | null> {
    await this.ready;
    const r = await this.request<{ r: BeamSec | null }>({ type: "beam", ax } as any);
    return r.r;
  }

  async props(): Promise<MassProps | null> {
    await this.ready;
    const r = await this.request<{ props: MassProps | null }>({ type: "props" } as any);
    return r.props;
  }
}
