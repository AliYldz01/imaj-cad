// Montaj çalışma alanı (SolidWorks gibi): bileşenler, eşleşmeler (standart / gelişmiş / mekanik), eşzamanlı çözücü,
// eşleşmelere uyarak sürükleme / döndürme, SmartMates (Alt+sürükle), bileşen taşı / döndür / aynala / çoğalt,
// patlatılmış görünüm adımları, girişim, kütle özellikleri, malzeme listesi, STEP.
import * as THREE from "three";
import type { Viewer, InputHandler } from "../viewer";
import type { Kernel } from "../kernel";
import type { MeshData, Vec3 } from "../doc/types";
import { compile } from "../doc/compile";
import { h, numField, checkField, selectField, segField, group, button } from "../ui/dom";
import { type AsmFeat, type AsmDoc, type AsmComp, type AsmPart, type Mate, type MateEnt, type MateType, type ExplodeStep, MATE_NAMES, MATE_GROUPS, ASM_ID, mateTypesFor, newAsm, bom, cylAxis, loadLib, saveToLib, removeFromLib, worldBox } from "./assembly";
import { fastener, FASTENER_NAMES, FASTENER_SIZES, type FastenerKind } from "./toolbox";
import { solveAll, dofAll, wEnt, mateRes } from "./solver";

export interface AsmCtx {
  viewer: Viewer;
  kernel: Kernel;
  toast: (m: string, err?: boolean) => void;
  hint: (m: string) => void;
  showPM: (title: string, ok: () => void, cancel: () => void) => void;
  hidePM: () => void;
  download: (b: Blob, name: string) => void;
  currentPart: () => AsmPart;
  setStatus: (k: string, t: string) => void;
  onLeave: () => void;
  /** bağlam içinde parça düzenle: parça modunda aç, bitince güncel parçayla geri çağır */
  editPart?: (part: AsmPart, done: (p: AsmPart) => void) => void;
}
type Cmd = { id: string; label: string; icon: string; run: () => void; active?: () => boolean } | "sep";

const COLORS = [0x9fb4cc, 0xd4a373, 0x8fbc8f, 0xc9a0dc, 0xe5c07b, 0x88c0d0, 0xd08770, 0xa3be8c];
const KEY = "imajcad.asm";
const uid = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const V3 = (a: Vec3) => new THREE.Vector3(a[0], a[1], a[2]);
const QQ = (c: AsmComp) => new THREE.Quaternion(c.q[0], c.q[1], c.q[2], c.q[3]);
type Pose = { p: Vec3; q: [number, number, number, number] };
void ASM_ID;
const KIND_NAMES: Record<string, string> = { plane: "Düz yüz", cyl: "Silindir", line: "Doğrusal kenar", circle: "Dairesel kenar", point: "Köşe" };

/** eşleşme türünün seçim kutuları: [başlık, adet][] */
function slotsOf(t: MateType): [string, number][] {
  if (t === "symmetric") return [["Eşleşme seçimleri", 2], ["Simetri düzlemi", 1]];
  if (t === "width") return [["Genişlik seçimleri", 2], ["Sekme seçimleri", 2]];
  if (t === "hinge") return [["Eş merkezli seçimleri", 2], ["Çakışık seçimleri", 2]];
  return [["Eşleşme seçimleri", 2]];
}
/** hizalama (hizalı / ters hizalı) anlamlı mı */
const ALIGNABLE = new Set<MateType>(["coincident", "parallel", "distance", "angle", "concentric", "tangent", "limit", "limitAngle", "profileCenter"]);

interface MateDraft {
  edit?: string;
  type: MateType;
  tab: "std" | "adv" | "mech";
  ents: (MateEnt | null)[];
  slot: number;
  v: number;
  vmax: number;
  flip: boolean;
  flipD: boolean;
}

export class AsmUI {
  on = false;
  doc: AsmDoc;
  private group = new THREE.Group();
  private meshes = new Map<string, MeshData | null>();
  private objs = new Map<string, THREE.Group>();
  sel: string | null = null;
  /** çoklu bileşen seçimi (Ctrl) */
  selSet = new Set<string>();
  selMate: string | null = null;
  selSub: string | null = null;
  private mateDraft: MateDraft | null = null;
  private snap: Map<string, Pose> | null = null;
  /** hatalı (sağlanamayan) eşleşmeler */
  bad = new Set<string>();
  /** sürüklerken çarpışma algılama (SolidWorks: Bileşeni taşı → Çarpışma algılama) */
  collide = false;
  /** sürükleme modu: taşı / döndür (SolidWorks Bileşeni Döndür) */
  dragMode: "move" | "rotate" = "move";
  /** Ctrl ile ön seçilen yüzler (eşleşme mini araç çubuğu) */
  private pre: MateEnt[] = [];
  private press: { x: number; y: number; comp: string | null; moved: boolean; ent?: MateEnt | null; alt?: boolean; local?: Vec3; world?: THREE.Vector3; start?: Map<string, Pose> } | null = null;
  /** eski otomatik patlatma katsayısı (uyumluluk) */
  explode = 0;
  /** patlatma animasyonu (0 = toplu, 1 = patlatılmış) */
  private exT = 0;
  /** seçim tıklamalarını alan panel (patlatma / aynala) */
  private picker: ((p: { comp: string; ent: MateEnt | null } | null) => void) | null = null;
  private prevHandler: InputHandler | null = null;

  constructor(private ctx: AsmCtx) {
    try {
      this.doc = JSON.parse(localStorage.getItem(KEY) || "null") ?? newAsm();
    } catch {
      this.doc = newAsm();
    }
    this.exT = this.doc.exploded ? 1 : 0;
    ctx.viewer.scene.add(this.group);
    this.group.visible = false;
  }
  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.doc, (k, v) => (k.startsWith("_") ? undefined : v)));
    } catch {}
  }

  // ---------- giriş / çıkış ----------
  async enter() {
    if (this.on) return;
    this.on = true;
    this.prevHandler = this.ctx.viewer.handler;
    this.ctx.viewer.handler = this.input;
    this.ctx.viewer.setModel(null);
    this.group.visible = true;
    this.ctx.hint(this.doc.comps.length ? "" : "Montaj: 'Bileşen Ekle' ile parça ekleyin");
    // parça dosyası değiştiyse (aynı kimlik) önce eski geometriyi kur, sonra güncelle → eşleşmeler taşınır
    const cur = this.ctx.currentPart();
    if (cur.key && this.doc.comps.some((c) => c.part.key === cur.key && JSON.stringify(c.part.features) !== JSON.stringify(cur.features))) {
      await this.refresh();
      const n = this.syncFromPart(cur);
      if (n) this.ctx.toast(`"${cur.name}" parçası değişmiş: ${n} bileşen güncellendi`), this.save();
    }
    await this.refresh();
    if (this.lost.size || this.doc.mates.length) (this.solve(), this.draw(), this.renderTree());
    this.ctx.viewer.fit();
  }
  leave() {
    if (!this.on) return;
    this.on = false;
    this.cancelMate();
    this.picker = null;
    this.group.visible = false;
    this.ctx.viewer.handler = this.prevHandler;
    this.ctx.onLeave();
  }

  /** bileşen ağlarını kur (önbellekli) ve sahneyi yenile */
  async refresh() {
    const v = this.ctx.viewer;
    for (const c of this.doc.comps) {
      const fs = JSON.stringify(this.featsOf(c));
      const key = c.id + ":" + fs.length + ":" + hash(fs);
      if ((this as any)["k_" + c.id] === key && this.meshes.has(c.id)) continue;
      this.ctx.setStatus("busy", `Bileşen kuruluyor: ${c.name}`);
      const old = (this as any)["k_" + c.id] ? this.meshes.get(c.id) : undefined;
      try {
        const { kfeats } = compile(this.featsOf(c), c.part.profiles ?? {});
        const r = await this.ctx.kernel.build(kfeats);
        this.meshes.set(c.id, r.mesh);
        if (old && r.mesh) this.remapMates(c, old, r.mesh);
      } catch {
        this.meshes.set(c.id, null);
      }
      (this as any)["k_" + c.id] = key;
    }
    this.meta();
    this.ctx.setStatus("ok", `Montaj · ${this.doc.comps.length} bileşen`);
    this.draw();
    v.requestRender();
  }
  /** parça değişince eşleşme varlıklarını yeni geometriye taşı (SolidWorks: referans izlenir, kaybolursa ⚠) */
  lost = new Set<string>();
  remapMates(c: AsmComp, old: MeshData, nw: MeshData) {
    if (!old.bbox || !nw.bbox) return;
    const U = (p: Vec3, b: { min: Vec3; max: Vec3 }) => p.map((v, i) => (v - b.min[i]) / Math.max(b.max[i] - b.min[i], 1e-3)) as Vec3;
    const d3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const par = (a: Vec3, b: Vec3) => Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) > 0.999;
    const same = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > 0.999;
    const cands = (k: MateEnt["kind"]): { c: Vec3; n: Vec3; r?: number }[] => {
      const out: { c: Vec3; n: Vec3; r?: number }[] = [];
      if (k === "plane") nw.faces.forEach((f) => f.n && out.push({ c: f.c, n: f.n }));
      if (k === "cyl") nw.faces.forEach((f, i) => { const ax = !f.n && f.r ? f.ax ?? cylAxis(nw, i) : null; if (ax) out.push({ c: f.ac ?? f.c, n: ax, r: f.r }); });
      if (k === "circle") nw.edges.forEach((e: any) => e.c && e.r && e.ax && out.push({ c: e.c, n: e.ax, r: e.r }));
      if (k === "line") nw.edges.forEach((e: any) => e.d && out.push({ c: e.m, n: e.d }));
      if (k === "point") nw.edges.forEach((e: any) => { if (e.s) out.push({ c: e.s, n: [0, 0, 1] }); if (e.e) out.push({ c: e.e, n: [0, 0, 1] }); });
      return out;
    };
    const fixedLabels = ["Ön düzlem", "Üst düzlem", "Sağ düzlem", "Orijin"];
    let moved = 0, lost = 0;
    for (const m of this.doc.mates) {
      for (const slot of ["a", "b", "c", "d"] as const) {
        const e = (m as any)[slot] as MateEnt | undefined;
        if (!e || e.comp !== c.id || fixedLabels.includes(e.label ?? "")) continue;
        const cs = cands(e.kind);
        const dirOk = (x: { n: Vec3 }) => (e.kind === "plane" ? same(x.n, e.n) : e.kind === "point" ? true : par(x.n, e.n));
        // geometri aynen duruyorsa dokunma
        if (cs.some((x) => d3(x.c, e.c) < 1e-3 && dirOk(x) && (e.r === undefined || Math.abs((x.r ?? 0) - e.r) < 1e-3))) continue;
        const u0 = U(e.c, old.bbox), diag = d3(nw.bbox.min, nw.bbox.max) || 1;
        const sc = cs.filter(dirOk).map((x) => ({ x, v: d3(U(x.c, nw.bbox!), u0) + (e.r !== undefined ? Math.abs((x.r ?? 0) - e.r) / diag : 0) })).sort((p, q) => p.v - q.v);
        if (sc.length && sc[0].v < 0.35 && (sc.length < 2 || sc[1].v - sc[0].v > 0.03 || d3(sc[1].x.c, sc[0].x.c) < 1e-3)) {
          const x = sc[0].x;
          if (e.kind === "plane" || e.kind === "point") e.c = x.c;
          else {
            // eksen / doğrultu: yön işaretini koru
            e.c = x.c;
            if (e.n[0] * x.n[0] + e.n[1] * x.n[1] + e.n[2] * x.n[2] < 0) e.n = [-x.n[0], -x.n[1], -x.n[2]];
            else e.n = x.n;
            if (x.r !== undefined) e.r = x.r;
          }
          this.lost.delete(m.id);
          moved++;
        } else {
          this.lost.add(m.id);
          lost++;
        }
      }
    }
    if (moved || lost) this.ctx.toast(lost ? `${c.name}: ${moved} eşleşme referansı güncellendi, ${lost} referans bulunamadı (⚠ — düzenleyin)` : `${c.name}: ${moved} eşleşme referansı yeni geometriye taşındı`, lost > 0);
  }
  /** bileşenin özellikleri + ona uygulanan montaj özellikleri (montaj kesmesi / deliği; parça dosyasına yazılmaz) */
  featsOf(c: AsmComp): any[] {
    const fs = (this.doc.feats ?? []).filter((f) => !f.off && f.comps.includes(c.id));
    if (!fs.length) return c.part.features;
    const qi = QQ(c).invert();
    const L = (w: Vec3) => V3(w).sub(V3(c.p)).applyQuaternion(qi).toArray() as Vec3;
    const D = (w: Vec3) => V3(w).applyQuaternion(qi).toArray() as Vec3;
    const out: any[] = [...c.part.features];
    for (const f of fs) {
      const pts: Record<string, { x: number; y: number }> = {};
      const ents: any[] = [];
      let k = 0;
      const P = (x: number, y: number) => ((pts["p" + ++k] = { x, y }), "p" + k);
      for (const [x, y] of f.pts) {
        if (f.type === "hole") ents.push({ id: "c" + ++k, t: "circle", c: P(x, y), r: f.d / 2 });
        else {
          const a = P(x - f.w / 2, y - f.h / 2), b = P(x + f.w / 2, y - f.h / 2), cc = P(x + f.w / 2, y + f.h / 2), d = P(x - f.w / 2, y + f.h / 2);
          for (const [u, v] of [[a, b], [b, cc], [cc, d], [d, a]]) ents.push({ id: "l" + ++k, t: "line", p1: u, p2: v });
        }
      }
      const sid = "__as_" + f.id;
      out.push({ id: sid, type: "sketch", name: f.name, plane: { k: "face", frame: { o: L(f.o), x: D(f.x), n: D(f.n) } }, data: { pts, ents, rels: [], dims: [], seq: k + 1 } });
      out.push({ id: "__ax_" + f.id, type: "extrude", name: f.name, sketch: sid, cut: true, end: f.through ? "through" : "blind", d1: f.depth, rev: false, dir2: false, end2: "blind", d2: 10 });
    }
    return out;
  }
  /** SolidWorks montaj özelliği: montaj deliği / kesmesi */
  openAsmCut() {
    const st = { type: "hole" as "hole" | "cut", d: 10, w: 20, h: 10, through: true, depth: 10, frame: null as null | { o: Vec3; x: Vec3; n: Vec3 }, pts: [] as [number, number][], comps: new Set(this.doc.comps.map((c) => c.id)) };
    const finish = () => {
      this.picker = null;
      this.ctx.hidePM();
      this.renderTree();
    };
    const done = async () => {
      if (!st.frame || !st.pts.length) return this.ctx.toast("Bir bileşenin düz yüzüne dokunarak konum seçin", true);
      if (!st.comps.size) return this.ctx.toast("Etkilenecek en az bir bileşen seçin", true);
      const n = (this.doc.feats ??= []).length + 1;
      this.doc.feats.push({ id: uid(), type: st.type, name: `${st.type === "hole" ? "Montaj Deliği" : "Montaj Kesmesi"}${n}`, ...st.frame, pts: st.pts, d: st.d, w: st.w, h: st.h, through: st.through, depth: st.depth, comps: [...st.comps] });
      finish();
      this.save();
      await this.refresh();
      this.solve();
      this.draw();
      this.renderTree();
    };
    this.ctx.showPM("Montaj kesme / deliği", done, finish);
    const body = document.getElementById("pm-body")!;
    const num = (label: string, v: number, set: (x: number) => void) => numField(label, v, (x) => x > 0 && set(x), { unit: "mm" });
    const render = () => {
      body.innerHTML = "";
      body.appendChild(group("Tür", segField([{ v: "hole", t: "Delik" }, { v: "cut", t: "Dikdörtgen kesme" }], st.type, (v) => ((st.type = v as any), render()))));
      body.appendChild(group("Boyut", ...(st.type === "hole" ? [num("Çap", st.d, (x) => (st.d = x))] : [num("Genişlik", st.w, (x) => (st.w = x)), num("Yükseklik", st.h, (x) => (st.h = x))])));
      body.appendChild(group("Uç koşulu", segField([{ v: "t", t: "Tümünü geç" }, { v: "b", t: "Kör" }], st.through ? "t" : "b", (v) => ((st.through = v === "t"), render())), ...(st.through ? [] : [num("Derinlik", st.depth, (x) => (st.depth = x))])));
      body.appendChild(group("Konumlar", h("div", "pm-picks", st.pts.length ? st.pts.map((p) => `(${p[0].toFixed(1)}, ${p[1].toFixed(1)})`).join(" · ") : "Bir bileşenin düz yüzüne dokunun; her dokunuş bir konum ekler"), ...(st.pts.length ? [button("Son konumu sil", () => (st.pts.pop(), st.pts.length || (st.frame = null), render()), "btn")] : [])));
      const list = h("div", "pm-picks");
      for (const c of this.doc.comps) {
        const lab = h("label", "check");
        const cb = h("input") as HTMLInputElement;
        cb.type = "checkbox";
        cb.checked = st.comps.has(c.id);
        cb.addEventListener("change", () => (cb.checked ? st.comps.add(c.id) : st.comps.delete(c.id)));
        lab.append(cb, " " + c.name);
        list.appendChild(lab);
      }
      body.appendChild(group("Etkilenen bileşenler", list));
    };
    this.picker = (p) => {
      if (!p?.ent || p.ent.kind !== "plane" || !(p as any).point) return this.ctx.toast("Bir düz yüze dokunun", true);
      const c = this.doc.comps.find((x) => x.id === p.comp)!;
      const wn = V3(p.ent.n).applyQuaternion(QQ(c)).normalize();
      const pt = (p as any).point as THREE.Vector3;
      // yüz düzlemine izdüşür
      const wc = V3(p.ent.c).applyQuaternion(QQ(c)).add(V3(c.p));
      const w = pt.clone().addScaledVector(wn, -pt.clone().sub(wc).dot(wn));
      if (!st.frame) {
        const ref = Math.abs(wn.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
        const x = new THREE.Vector3().crossVectors(ref, wn).normalize();
        st.frame = { o: w.toArray() as Vec3, x: x.toArray() as Vec3, n: wn.toArray() as Vec3 };
      }
      const o = V3(st.frame.o), x = V3(st.frame.x), y = new THREE.Vector3().crossVectors(V3(st.frame.n), x);
      const r = w.clone().sub(o);
      st.pts.push([Math.round(r.dot(x) * 100) / 100, Math.round(r.dot(y) * 100) / 100]);
      render();
    };
    render();
  }
  /** montaj resmi: izometrik görünüş + balonlar + malzeme listesi */
  async drawing() {
    const vis = this.doc.comps.filter((c) => !c.hidden);
    if (!vis.length) return this.ctx.toast("Montajda bileşen yok", true);
    this.ctx.setStatus("busy", "Montaj resmi hazırlanıyor…");
    const parts = vis.map((c) => ({ features: compile(this.featsOf(c), c.part.profiles ?? {}).kfeats, q: c.q, p: c.p, name: c.name }));
    const r = await this.ctx.kernel.asm("draw", parts);
    this.meshes.clear();
    await this.refresh();
    if (!r.draw) return this.ctx.toast("Montaj resmi: " + (r.error ?? "çizilemedi"), true);
    const b = bom({ ...this.doc, comps: vis });
    const balloonOf = vis.map((c) => b.find((x) => x.name === c.part.name)!.no);
    // patlatma adımları varsa ikinci sayfa için patlatılmış konumlarla ayrıca çiz
    let exploded: any = null;
    if ((this.doc.steps ?? []).length) {
      const ex = vis.map((c) => {
        const o = new THREE.Vector3();
        for (const s of this.doc.steps ?? []) if (s.comps.includes(c.id)) o.addScaledVector(V3(s.dir).normalize(), s.d);
        return { features: compile(this.featsOf(c), c.part.profiles ?? {}).kfeats, q: c.q, p: [c.p[0] + o.x, c.p[1] + o.y, c.p[2] + o.z] as Vec3, name: c.name };
      });
      const r2 = await this.ctx.kernel.asm("draw", ex);
      exploded = r2.draw ?? null;
      this.meshes.clear();
      await this.refresh();
    }
    (window as any).__openTechDrawing?.({ data: r.draw, bom: b, balloonOf, name: this.doc.name, exploded });
  }
  /** SolidWorks Delik Hizalama: farklı bileşenlerdeki paralel, örtüşen ama eş eksenli olmayan delikler */
  holeAlignment(tol = 0.01) {
    type Hole = { comp: AsmComp; c: THREE.Vector3; a: THREE.Vector3; r: number; t0: number; t1: number };
    const holes: Hole[] = [];
    for (const c of this.doc.comps) {
      const md = this.meshes.get(c.id);
      if (!md || c.hidden) continue;
      const q = QQ(c);
      md.faces.forEach((f, fi) => {
        if (!f.r || !f.ax) return;
        const ac = V3(f.ac ?? f.c).applyQuaternion(q).add(V3(c.p));
        const a = V3(f.ax).applyQuaternion(q).normalize();
        // eksen boyunca yüz uzunluğu ve iç (delik) mi: yüz normali eksene doğru mu
        let t0 = Infinity, t1 = -Infinity, inward = 0;
        for (let i = 0; i < md.faceGroups.length; i += 3) {
          if (md.faceGroups[i + 2] !== fi) continue;
          for (let k = md.faceGroups[i]; k < md.faceGroups[i] + md.faceGroups[i + 1]; k++) {
            const vi = md.triangles[k];
            const w = new THREE.Vector3(md.vertices[vi * 3], md.vertices[vi * 3 + 1], md.vertices[vi * 3 + 2]).applyQuaternion(q).add(V3(c.p));
            const t = w.clone().sub(ac).dot(a);
            t0 = Math.min(t0, t);
            t1 = Math.max(t1, t);
            const nrm = new THREE.Vector3(md.normals[vi * 3], md.normals[vi * 3 + 1], md.normals[vi * 3 + 2]).applyQuaternion(q);
            const rad = w.clone().sub(ac).addScaledVector(a, -t);
            inward += nrm.dot(rad) < 0 ? 1 : -1;
          }
        }
        if (inward > 0 && !holes.some((o) => o.comp === c && o.c.distanceTo(ac) < 1e-4 && Math.abs(o.r - f.r!) < 1e-4)) holes.push({ comp: c, c: ac, a, r: f.r, t0, t1 });
      });
    }
    const rows: { a: Hole; b: Hole; off: number }[] = [];
    for (let i = 0; i < holes.length; i++)
      for (let j = i + 1; j < holes.length; j++) {
        const A = holes[i], B = holes[j];
        if (A.comp === B.comp || Math.abs(A.a.dot(B.a)) < 0.999) continue;
        const d = B.c.clone().sub(A.c);
        const along = d.dot(A.a);
        const off = d.clone().addScaledVector(A.a, -along).length();
        if (off <= tol || off >= Math.max(A.r, B.r)) continue;
        // eksen boyunca örtüşme / değme (1 mm)
        const s = B.a.dot(A.a) > 0 ? 1 : -1;
        const b0 = along + Math.min(s * B.t0, s * B.t1), b1 = along + Math.max(s * B.t0, s * B.t1);
        if (b1 < A.t0 - 1 || b0 > A.t1 + 1) continue;
        rows.push({ a: A, b: B, off });
      }
    return rows.map((r) => ({ a: r.a.comp.name, b: r.b.comp.name, da: r.a.r * 2, db: r.b.r * 2, off: r.off }));
  }
  showHoleAlignment() {
    const rows = this.holeAlignment();
    const dlg = document.createElement("dialog");
    dlg.className = "input-dialog";
    dlg.innerHTML = rows.length
      ? `<h2>Delik hizalama: ${rows.length} hizasız delik</h2><table class="cut-table"><tr><th>Bileşen 1</th><th>Ø</th><th>Bileşen 2</th><th>Ø</th><th>Sapma (mm)</th></tr>${rows.map((x) => `<tr><td>${x.a}</td><td>${x.da.toFixed(2)}</td><td>${x.b}</td><td>${x.db.toFixed(2)}</td><td>⚠ ${x.off.toFixed(3)}</td></tr>`).join("")}</table>`
      : `<h2>Delik hizalama</h2><p>Hizasız delik bulunmadı ✓</p>`;
    dlg.appendChild(button("Kapat", () => dlg.close(), "btn primary"));
    document.body.appendChild(dlg);
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
  }
  /** parça dosyasındaki değişiklikleri (aynı parça kimliği) montaja getir */
  syncFromPart(part: AsmPart) {
    if (!part.key) return 0;
    let n = 0;
    for (const c of this.doc.comps)
      if (c.part.key === part.key && JSON.stringify(c.part.features) !== JSON.stringify(part.features)) {
        c.part = JSON.parse(JSON.stringify(part));
        n++;
      }
    return n;
  }
  /** çözücü için bileşen boyutu ve yerel merkez (kaydedilmez) */
  private meta() {
    for (const c of this.doc.comps) {
      const b = this.meshes.get(c.id)?.bbox;
      const a = c as any;
      if (b) {
        a._lc = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
        a._L = Math.max(10, Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / 2);
      }
    }
  }
  /** eşleşmeleri çöz (hatalıları işaretle) */
  solve(o: Parameters<typeof solveAll>[1] = {}) {
    this.meta();
    let r = solveAll(this.doc, o);
    // büyük yer değiştirmelerde (parça değişikliği) bir tur daha
    if (r.bad.length && !o.drag) r = solveAll(this.doc, o);
    this.bad = new Set([...r.bad, ...this.lost]);
    return r;
  }
  private poses(): Map<string, Pose> {
    return new Map(this.doc.comps.map((c) => [c.id, { p: [...c.p] as Vec3, q: [...c.q] as Pose["q"] }]));
  }
  private restore(m: Map<string, Pose>) {
    for (const c of this.doc.comps) {
      const s = m.get(c.id);
      if (s) (c.p = [...s.p] as Vec3), (c.q = [...s.q] as Pose["q"]);
    }
  }

  /** patlatma ötelemesi (adımların toplamı) */
  private explodeOffset(c: AsmComp) {
    const o = new THREE.Vector3();
    if (this.exT > 0) for (const s of this.doc.steps ?? []) if (s.comps.includes(c.id)) o.addScaledVector(V3(s.dir).normalize(), s.d * this.exT);
    if (this.explode > 0) o.add(this.compCenter(c).sub(this.asmCenter()).multiplyScalar(this.explode));
    return o;
  }

  /** sahne nesnelerini oluştur / konumla */
  draw() {
    this.hovKey = "";
    this.hovObj = null;
    for (const o of [...this.group.children]) this.group.remove(o);
    this.objs.clear();
    const mateComps = new Set<string>();
    const sm = this.doc.mates.find((m) => m.id === this.selMate);
    if (sm) for (const e of [sm.a, sm.b, sm.c, sm.d]) if (e) mateComps.add(e.comp);
    const pick = this.mateDraft ? this.mateDraft.ents.filter(Boolean) as MateEnt[] : this.pre;
    this.doc.comps.forEach((c, i) => {
      const m = this.meshes.get(c.id);
      if (!m || c.hidden) return;
      const g = new THREE.Group();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(m.vertices, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(m.normals, 3));
      geo.setIndex(new THREE.BufferAttribute(m.triangles, 1));
      const selC = this.sel === c.id || this.selSet.has(c.id);
      const hl = mateComps.has(c.id);
      const mat = new THREE.MeshStandardMaterial({
        color: COLORS[i % COLORS.length], metalness: 0.1, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
        emissive: selC ? 0x1c4fd8 : hl ? 0x2f9e44 : 0x000000, emissiveIntensity: 0.35, transparent: !!c.transparent, opacity: c.transparent ? 0.35 : 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.comp = c.id;
      const eg = new THREE.BufferGeometry();
      eg.setAttribute("position", new THREE.BufferAttribute(m.lines, 3));
      g.add(mesh, new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x1f2a37 })));
      // seçili eşleşme varlıklarını vurgula
      for (const e of pick) if (e.comp === c.id) g.add(this.entMarker(e));
      g.quaternion.set(...c.q);
      g.position.set(...c.p);
      g.position.add(this.explodeOffset(c));
      this.group.add(g);
      this.objs.set(c.id, g);
    });
    // patlatma çizgileri
    if (this.exT > 0 && (this.doc.steps ?? []).length) {
      const pts: number[] = [];
      for (const c of this.doc.comps) {
        const o = this.explodeOffset(c);
        if (o.length() < 1e-6) continue;
        const a = this.compCenter(c), b = a.clone().add(o);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      if (pts.length) {
        const eg = new THREE.BufferGeometry();
        eg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        this.group.add(new THREE.LineSegments(eg, new THREE.LineDashedMaterial({ color: 0xc92a2a, dashSize: 4, gapSize: 3 })).computeLineDistances());
      }
    }
    // görüntü sınırı (ekrana sığdır için)
    const box = new THREE.Box3().setFromObject(this.group);
    this.ctx.viewer.bbox = box.isEmpty() ? null : box;
    this.ctx.viewer.requestRender();
  }
  /** seçili eşleşme varlığı işareti (yerel koordinatta) */
  private entMarker(e: MateEnt): THREE.Object3D {
    const col = 0xf76707;
    if (e.kind === "plane") {
      const g = new THREE.Mesh(new THREE.CircleGeometry(6, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthTest: false }));
      g.position.set(...e.c);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V3(e.n).normalize());
      g.renderOrder = 5;
      return g;
    }
    if (e.kind === "point") {
      const g = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 8), new THREE.MeshBasicMaterial({ color: col, depthTest: false }));
      g.position.set(...e.c);
      g.renderOrder = 5;
      return g;
    }
    const L = Math.max(20, (e.r ?? 5) * 4);
    const a = V3(e.c).addScaledVector(V3(e.n), -L), b = V3(e.c).addScaledVector(V3(e.n), L);
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, depthTest: false }));
    l.renderOrder = 5;
    return l;
  }
  private compCenter(c: AsmComp) {
    const m = this.meshes.get(c.id);
    const b = m?.bbox;
    const lc = b ? new THREE.Vector3((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2) : new THREE.Vector3();
    return lc.applyQuaternion(QQ(c)).add(V3(c.p));
  }
  private asmCenter() {
    const cs = this.doc.comps.map((c) => this.compCenter(c));
    const s = new THREE.Vector3();
    cs.forEach((v) => s.add(v));
    return cs.length ? s.multiplyScalar(1 / cs.length) : s;
  }

  // ---------- seçim ----------
  /** imleç altındaki bileşen ve eşleşme varlığı: köşe / kenar (ekranda ≤ 8 px) öncelikli, sonra yüz */
  pick(x: number, y: number, skip?: string): { comp: string; ent: MateEnt | null; point?: THREE.Vector3 } | null {
    const v = this.ctx.viewer;
    const rc = v.ray(x, y);
    const meshes: THREE.Mesh[] = [];
    this.group.traverse((o) => (o as any).isMesh && o.userData.comp && o.userData.comp !== skip && meshes.push(o as THREE.Mesh));
    const hit = rc.intersectObjects(meshes, false)[0];
    // kenar / köşe: yakındaki bileşenlerin kenarlarını ekrana izdüşür
    const r = v.renderer.domElement.getBoundingClientRect();
    const scr = (w: THREE.Vector3) => {
      const q = v.toScreen([w.x, w.y, w.z]);
      return [q[0] + r.left, q[1] + r.top];
    };
    const hitDist = hit ? hit.distance : Infinity;
    const camDir = new THREE.Vector3();
    v.camera.getWorldDirection(camDir);
    let best: { comp: string; ent: MateEnt; d: number } | null = null;
    for (const c of this.doc.comps) {
      if (c.hidden || c.id === skip) continue;
      const md = this.meshes.get(c.id);
      const g = this.objs.get(c.id);
      if (!md || !g) continue;
      const W = (p: Vec3) => V3(p).applyQuaternion(g.quaternion).add(g.position);
      // görünürlük: kesişim noktasından çok gerideki kenarları atla
      const visible = (w: THREE.Vector3) => !hit || w.clone().sub(v.camera.position).dot(camDir) <= hitDist + 1;
      md.edges.forEach((e) => {
        for (const [P, k] of [[e.s, "point"], [e.e, "point"]] as [Vec3, string][]) {
          const w = W(P);
          if (!visible(w)) continue;
          const s = scr(w), d = Math.hypot(s[0] - x, s[1] - y);
          if (d < 7 && (!best || d < best.d - 2)) best = { comp: c.id, ent: { comp: c.id, kind: k as any, c: P, n: [0, 0, 1], label: "Köşe" }, d };
        }
        const segs: [Vec3, Vec3][] = [];
        if (e.c && e.r && e.ax) {
          // daire kenarı: çevreden örnek
          const ax = V3(e.ax).normalize(), u = new THREE.Vector3().subVectors(V3(e.s), V3(e.c)).normalize();
          if (u.length() < 0.5) return;
          const w2 = new THREE.Vector3().crossVectors(ax, u);
          for (let i = 0; i < 24; i++) {
            const a0 = (i / 24) * 2 * Math.PI, a1 = ((i + 1) / 24) * 2 * Math.PI;
            const p0 = V3(e.c).addScaledVector(u, e.r * Math.cos(a0)).addScaledVector(w2, e.r * Math.sin(a0));
            const p1 = V3(e.c).addScaledVector(u, e.r * Math.cos(a1)).addScaledVector(w2, e.r * Math.sin(a1));
            segs.push([[p0.x, p0.y, p0.z], [p1.x, p1.y, p1.z]]);
          }
        } else if (e.d) segs.push([e.s, e.e]);
        for (const [a, b] of segs) {
          const wa = W(a), wb = W(b);
          if (!visible(wa.clone().add(wb).multiplyScalar(0.5))) continue;
          const sa = scr(wa), sb = scr(wb);
          const dx = sb[0] - sa[0], dy = sb[1] - sa[1], L2 = dx * dx + dy * dy;
          const t = L2 ? Math.max(0, Math.min(1, ((x - sa[0]) * dx + (y - sa[1]) * dy) / L2)) : 0;
          const d = Math.hypot(sa[0] + t * dx - x, sa[1] + t * dy - y) + 2; // köşeler öncelikli
          if (d < 7 && (!best || d < best.d)) {
            const ent: MateEnt = e.c && e.r && e.ax ? { comp: c.id, kind: "circle", c: e.c, n: e.ax, r: e.r, label: `Daire kenarı Ø${(e.r * 2).toFixed(1)}` } : { comp: c.id, kind: "line", c: e.m, n: e.d!, label: "Doğrusal kenar" };
            best = { comp: c.id, ent, d };
          }
        }
      });
    }
    if (best) return { comp: (best as any).comp, ent: (best as any).ent, point: hit?.point };
    if (!hit) return null;
    const id = hit.object.userData.comp as string;
    const md = this.meshes.get(id);
    if (!md || hit.faceIndex == null) return { comp: id, ent: null, point: hit.point };
    const tri = hit.faceIndex * 3;
    let fi = -1;
    for (let i = 0; i < md.faceGroups.length; i += 3) if (tri >= md.faceGroups[i] && tri < md.faceGroups[i] + md.faceGroups[i + 1]) fi = md.faceGroups[i + 2];
    const f = md.faces[fi];
    if (!f) return { comp: id, ent: null, point: hit.point };
    if (f.n) return { comp: id, ent: { comp: id, kind: "plane", c: f.c, n: f.n, label: "Düz yüz" }, point: hit.point };
    const ax = f.ax ?? cylAxis(md, fi);
    if (ax && f.r) return { comp: id, ent: { comp: id, kind: "cyl", c: f.ac ?? f.c, n: ax, r: f.r, label: `Silindir Ø${(f.r * 2).toFixed(1)}` }, point: hit.point };
    return { comp: id, ent: null, point: hit.point };
  }

  // ---------- ön seçim vurgusu (SolidWorks dinamik vurgu) ----------
  private hovKey = "";
  private hovObj: THREE.Object3D | null = null;
  private hovRaf = 0;
  private hovEv: { x: number; y: number } | null = null;
  private setHover(p: { comp: string; ent: MateEnt | null } | null) {
    const key = p ? `${p.comp}|${p.ent ? p.ent.kind + JSON.stringify(p.ent.c) + JSON.stringify(p.ent.n) : ""}` : "";
    if (key === this.hovKey) return;
    this.hovKey = key;
    this.hovObj?.parent?.remove(this.hovObj);
    this.hovObj = null;
    this.ctx.viewer.renderer.domElement.style.cursor = p ? "pointer" : "";
    const v = this.ctx.viewer;
    const g = p && this.objs.get(p.comp);
    const md = p && this.meshes.get(p.comp);
    if (!p || !g || !md) return v.requestRender();
    const COL = 0xf76707;
    const o = new THREE.Group();
    const e = p.ent;
    if (!e || e.kind === "plane" || e.kind === "cyl") {
      // yüzü bul (ışın) ve tümüyle boya
      const fi = this.faceAt(p.comp, this.hovEv!.x, this.hovEv!.y);
      if (fi >= 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(md.vertices, 3));
        geo.setAttribute("normal", new THREE.BufferAttribute(md.normals, 3));
        const idx: number[] = [];
        for (let k = 0; k < md.faceGroups.length; k += 3) if (md.faceGroups[k + 2] === fi) for (let j = md.faceGroups[k]; j < md.faceGroups[k] + md.faceGroups[k + 1]; j++) idx.push(md.triangles[j]);
        geo.setIndex(idx);
        o.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffb066, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
        const ol = v.faceOutline(md, fi);
        if (ol.length) o.add(v.fatLines(ol, COL, 2.5, false, false));
      }
    } else if (e.kind === "point") {
      const m = new THREE.Mesh(new THREE.SphereGeometry(Math.max(1, v.worldPerPixel() * 5), 12, 8), new THREE.MeshBasicMaterial({ color: COL, depthTest: false }));
      m.position.set(...e.c);
      m.renderOrder = 30;
      o.add(m);
    } else {
      // kenar: kenar grubunun çizgileri
      const ei = md.edges.findIndex((x) => (e.kind === "circle" ? x.c && Math.hypot(x.c[0] - e.c[0], x.c[1] - e.c[1], x.c[2] - e.c[2]) < 1e-6 && Math.abs((x.r ?? 0) - (e.r ?? 0)) < 1e-6 : Math.hypot(x.m[0] - e.c[0], x.m[1] - e.c[1], x.m[2] - e.c[2]) < 1e-6));
      if (ei >= 0) {
        const pos: number[] = [];
        for (let k = 0; k < md.edgeGroups.length; k += 3) if (md.edgeGroups[k + 2] === ei) pos.push(...md.lines.slice(md.edgeGroups[k] * 3, (md.edgeGroups[k] + md.edgeGroups[k + 1]) * 3));
        if (pos.length) o.add(v.fatLines(pos, COL, 4));
      }
    }
    g.add(o);
    this.hovObj = o;
    v.requestRender();
  }
  /** bileşende imleç altındaki yüz indeksi */
  private faceAt(comp: string, x: number, y: number): number {
    const g = this.objs.get(comp), md = this.meshes.get(comp);
    if (!g || !md) return -1;
    const meshes: THREE.Mesh[] = [];
    g.traverse((o) => (o as any).isMesh && o.userData.comp === comp && meshes.push(o as THREE.Mesh));
    const hit = this.ctx.viewer.ray(x, y).intersectObjects(meshes, false)[0];
    if (!hit || hit.faceIndex == null) return -1;
    const tri = hit.faceIndex * 3;
    for (let i = 0; i < md.faceGroups.length; i += 3) if (tri >= md.faceGroups[i] && tri < md.faceGroups[i] + md.faceGroups[i + 1]) return md.faceGroups[i + 2];
    return -1;
  }

  input: InputHandler = {
    hover: (e) => {
      // kare başına bir kez (büyük montajlarda akıcı kalsın)
      this.hovEv = { x: e.clientX, y: e.clientY };
      if (this.hovRaf) return;
      this.hovRaf = requestAnimationFrame(() => {
        this.hovRaf = 0;
        if (!this.on || !this.hovEv || this.press) return;
        this.setHover(this.pick(this.hovEv.x, this.hovEv.y));
      });
    },
    down: (e) => {
      this.setHover(null);
      const p = this.pick(e.clientX, e.clientY);
      const c = p ? this.doc.comps.find((x) => x.id === p.comp) : null;
      let local: Vec3 | undefined, world: THREE.Vector3 | undefined;
      if (c && p?.point) {
        world = p.point.clone().sub(this.explodeOffset(c));
        const l = world.clone().sub(V3(c.p)).applyQuaternion(QQ(c).invert());
        local = [l.x, l.y, l.z];
      }
      this.press = { x: e.clientX, y: e.clientY, comp: p?.comp ?? null, moved: false, ent: p?.ent ?? null, alt: !!(e as any).altKey, local, world, start: this.poses() };
    },
    move: (e) => {
      const pr = this.press;
      if (!pr || !pr.comp || this.mateDraft || this.picker) return;
      const c = this.doc.comps.find((x) => x.id === pr.comp);
      if (!c || c.fixed) return;
      const dx = e.clientX - pr.x, dy = e.clientY - pr.y;
      if (!pr.moved && Math.hypot(dx, dy) < 6) return;
      pr.moved = true;
      const v = this.ctx.viewer;
      const cam = v.camera;
      const k = v.worldPerPixel();
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const before = this.poses();
      if (pr.alt) {
        // SmartMates: serbestçe taşı (eşleşme bırakınca oluşur)
        const d = right.multiplyScalar(dx * k).add(up.multiplyScalar(-dy * k));
        c.p = [c.p[0] + d.x, c.p[1] + d.y, c.p[2] + d.z];
      } else if (this.dragMode === "rotate") {
        // SolidWorks Bileşeni Döndür: ekran eksenleri etrafında, eşleşmelere uyarak
        const ang = 0.01;
        const r = new THREE.Quaternion().setFromAxisAngle(up, dx * ang).multiply(new THREE.Quaternion().setFromAxisAngle(right, dy * ang));
        const t = r.multiply(QQ(c));
        this.solve({ drag: { comp: c.id, rot: [t.x, t.y, t.z, t.w] } });
      } else {
        // eşleşmelere uyarak sürükle: tutulan nokta imlecin altına gelmeye çalışır
        if (!pr.local || !pr.world) {
          const l = this.compCenter(c);
          pr.world = l;
          const q = l.clone().sub(V3(c.p)).applyQuaternion(QQ(c).invert());
          pr.local = [q.x, q.y, q.z];
        }
        pr.world.add(right.multiplyScalar(dx * k)).add(up.multiplyScalar(-dy * k));
        const free = !this.doc.mates.some((m) => !m.off && [m.a, m.b, m.c, m.d].some((x) => x?.comp === c.id));
        if (free) {
          const cur = V3(pr.local).applyQuaternion(QQ(c)).add(V3(c.p));
          const d = pr.world.clone().sub(cur);
          c.p = [c.p[0] + d.x, c.p[1] + d.y, c.p[2] + d.z];
        } else this.solve({ drag: { comp: c.id, local: pr.local, target: [pr.world.x, pr.world.y, pr.world.z] }, iters: 20 });
      }
      if (this.collide && this.collidesAny()) {
        this.restore(before);
        this.ctx.hint("Çarpışma: bileşen durduruldu");
      }
      pr.x = e.clientX;
      pr.y = e.clientY;
      this.draw();
    },
    up: (e) => {
      const pr = this.press;
      this.press = null;
      if (pr?.moved) {
        if (pr.alt && pr.ent && pr.start) {
          // SmartMates: bırakılan yerdeki varlıkla önerilen eşleşme
          const t = this.pick(e.clientX, e.clientY, pr.comp ?? undefined);
          this.restore(pr.start);
          if (t?.ent) {
            const typ = this.suggest(t.ent, pr.ent);
            this.addMate({ id: uid(), type: typ, a: t.ent, b: pr.ent });
            this.ctx.toast(`SmartMate: ${MATE_NAMES[typ]}`);
            return;
          }
          this.draw();
          return;
        }
        this.solve();
        this.save();
        this.draw();
        this.renderTree();
        return;
      }
      this.click(e.clientX, e.clientY, e.ctrlKey || e.metaKey);
    },
    tap: (e) => this.click(e.clientX, e.clientY),
  };

  /** dünya sınır kutusu (mesh köşe noktalarından) */
  bbox(c: AsmComp): THREE.Box3 | null {
    const m = this.meshes.get(c.id);
    if (!m || !m.vertices.length) return null;
    const v = m.vertices, mn: Vec3 = [Infinity, Infinity, Infinity], mx: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < v.length; i += 3) for (let k = 0; k < 3; k++) (mn[k] = Math.min(mn[k], v[i + k])), (mx[k] = Math.max(mx[k], v[i + k]));
    return worldBox(c, { min: mn, max: mx });
  }
  /** c başka bir görünür bileşenle çakışıyor mu: kutu ön elemesi + gerçek geometri (köşe noktası diğer gövdenin içinde mi) */
  collides(c: AsmComp): boolean {
    const a = this.bbox(c);
    if (!a) return false;
    a.expandByScalar(-0.05);
    return this.doc.comps.some((o) => {
      if (o === c || o.hidden) return false;
      const b = this.bbox(o);
      if (!b?.intersectsBox(a)) return false;
      const box = a.clone().intersect(b);
      return this.penetrates(c, o, box) || this.penetrates(o, c, box) || this.gridOverlap(c, o, box);
    });
  }
  /** kesişim kutusunda 5×5×5 ızgara: iki gövdenin de içinde kalan nokta var mı */
  private gridOverlap(a: AsmComp, b: AsmComp, box: THREE.Box3): boolean {
    const n = 5, s = box.getSize(new THREE.Vector3());
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        for (let k = 0; k < n; k++) {
          const w = new THREE.Vector3(box.min.x + (s.x * (i + 0.5)) / n, box.min.y + (s.y * (j + 0.5)) / n, box.min.z + (s.z * (k + 0.5)) / n);
          if (this.inside(a, w) && this.inside(b, w)) return true;
        }
    return false;
  }
  /** dünya noktası bileşenin malzemesi içinde mi (önce tek ışın paritesi, sonra 6 ışınla doğrula) */
  private inside(c: AsmComp, w: THREE.Vector3): boolean {
    const rm = this.rayMeshOf(c);
    if (!rm) return false;
    const p = w.clone().applyMatrix4(new THREE.Matrix4().compose(V3(c.p), QQ(c), new THREE.Vector3(1, 1, 1)).invert());
    const rc = new THREE.Raycaster();
    const dirs = [new THREE.Vector3(1, 0.0123, 0.0071).normalize(), new THREE.Vector3(-0.0091, 1, 0.0137).normalize(), new THREE.Vector3(0.0113, -0.0077, 1).normalize()];
    rc.set(p, dirs[0]);
    if (rc.intersectObject(rm, false).length % 2 === 0) return false;
    for (const d of dirs)
      for (const sgn of [1, -1]) {
        rc.set(p, d.clone().multiplyScalar(sgn));
        const hits = rc.intersectObject(rm, false);
        if (!hits.length || hits[0].distance < 0.05 || hits.length % 2 === 0) return false;
      }
    return true;
  }
  private rayMeshOf(b: AsmComp): THREE.Mesh | null {
    const mb = this.meshes.get(b.id);
    if (!mb) return null;
    let rm = this.rayMesh.get(b.id);
    if (!rm || rm.userData.src !== mb) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(mb.vertices, 3));
      g.setIndex(new THREE.BufferAttribute(mb.triangles, 1));
      rm = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      rm.userData.src = mb;
      this.rayMesh.set(b.id, rm);
    }
    return rm;
  }
  private rayMesh = new Map<string, THREE.Mesh>();
  /** a'nın (ve kenar ortalarının) kesişim kutusundaki noktalarından biri b'nin malzemesinin içinde mi (ışın paritesi, 0.05 mm pay) */
  private penetrates(a: AsmComp, b: AsmComp, box: THREE.Box3): boolean {
    const ma = this.meshes.get(a.id), mb = this.meshes.get(b.id);
    if (!ma || !mb) return false;
    let rm = this.rayMesh.get(b.id);
    if (!rm || rm.userData.src !== mb) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(mb.vertices, 3));
      g.setIndex(new THREE.BufferAttribute(mb.triangles, 1));
      rm = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      rm.userData.src = mb;
      this.rayMesh.set(b.id, rm);
    }
    const Ma = new THREE.Matrix4().compose(V3(a.p), QQ(a), new THREE.Vector3(1, 1, 1));
    const MbInv = new THREE.Matrix4().compose(V3(b.p), QQ(b), new THREE.Vector3(1, 1, 1)).invert();
    const v = ma.vertices, pts: THREE.Vector3[] = [];
    for (let i = 0; i < v.length; i += 3) {
      const w = new THREE.Vector3(v[i], v[i + 1], v[i + 2]).applyMatrix4(Ma);
      if (box.containsPoint(w)) pts.push(w);
    }
    // üçgen ağırlık merkezleri de (büyük yüzler köşesiz girebilir)
    const t = ma.triangles;
    for (let i = 0; i < t.length && pts.length < 1500; i += 3) {
      const w = new THREE.Vector3();
      for (let k = 0; k < 3; k++) w.add(new THREE.Vector3(v[t[i + k] * 3], v[t[i + k] * 3 + 1], v[t[i + k] * 3 + 2]));
      w.multiplyScalar(1 / 3).applyMatrix4(Ma);
      if (box.containsPoint(w)) pts.push(w);
    }
    const step = Math.max(1, Math.floor(pts.length / 400));
    const rc = new THREE.Raycaster();
    const dirs = [new THREE.Vector3(1, 0.0123, 0.0071).normalize(), new THREE.Vector3(-0.0091, 1, 0.0137).normalize(), new THREE.Vector3(0.0113, -0.0077, 1).normalize()];
    for (let i = 0; i < pts.length; i += step) {
      const p = pts[i].clone().applyMatrix4(MbInv);
      let inside = true;
      for (const d of dirs) {
        for (const sgn of [1, -1]) {
          rc.set(p, d.clone().multiplyScalar(sgn));
          const hits = rc.intersectObject(rm, false);
          if (!hits.length || hits[0].distance < 0.05 || hits.length % 2 === 0) {
            inside = false;
            break;
          }
        }
        if (!inside) break;
      }
      if (inside) return true;
    }
    return false;
  }
  private collidesAny() {
    const mv = this.press?.start;
    return this.doc.comps.some((c) => {
      const s = mv?.get(c.id);
      const moved = !s || s.p.some((v, i) => Math.abs(v - c.p[i]) > 1e-9) || s.q.some((v, i) => Math.abs(v - c.q[i]) > 1e-9);
      return moved && this.collides(c);
    });
  }

  private click(x: number, y: number, ctrl = false) {
    const p = this.pick(x, y);
    if (this.picker) return this.picker(p);
    if (!this.mateDraft && ctrl && p?.ent) {
      // SolidWorks: Ctrl ile iki varlık seç → eşleşme açılır araç çubuğu
      this.pre = [...this.pre.filter((e) => e.comp !== p.ent!.comp), p.ent].slice(-2);
      if (this.pre.length === 2) this.showMateBar(x, y);
      else this.ctx.hint("İkinci bileşenden bir yüz / kenar / köşe seçin (Ctrl)");
      this.draw();
      return;
    }
    this.pre = [];
    document.querySelector(".asm-matebar")?.remove();
    if (this.mateDraft) {
      if (!p?.ent) return this.ctx.toast("Yüz, kenar veya köşe seçin", true);
      this.pickInto(p.ent);
      return;
    }
    if (ctrl && p) {
      if (this.selSet.has(p.comp)) this.selSet.delete(p.comp);
      else this.selSet.add(p.comp);
      this.sel = p.comp;
    } else {
      this.sel = p?.comp ?? null;
      this.selSet = new Set(this.sel ? [this.sel] : []);
    }
    this.selMate = null;
    this.draw();
    this.renderTree();
  }

  // ---------- eşleşme ----------
  /** seçim türlerine göre geçerli standart eşleşmeler */
  static typesFor(ents: MateEnt[]): MateType[] {
    return mateTypesFor(ents);
  }
  /** eşleşme açılır araç çubuğu (Ctrl ile iki varlık seçilince) */
  showMateBar(x: number, y: number) {
    document.querySelector(".asm-matebar")?.remove();
    const ents = this.pre.slice();
    const bar = h("div", "minibar sw-popup asm-matebar");
    const types = AsmUI.typesFor(ents);
    const sug = this.suggest(ents[0], ents[1]);
    for (const t of [sug, ...types.filter((x) => x !== sug)]) {
      const b = h("button", "s3-rb", MATE_NAMES[t]);
      b.dataset.mate = t;
      b.addEventListener("click", () => {
        bar.remove();
        let v: number | undefined, vmax: number | undefined;
        if (t === "distance" || t === "angle") {
          const r = prompt(t === "angle" ? "Açı (°)" : "Mesafe (mm)", t === "angle" ? "90" : "10");
          if (r === null) return;
          v = parseFloat(r.replace(",", ".")) || 0;
        }
        if (t === "limit") {
          const r = prompt("Limit mesafe: en az; en çok (mm)", "0; 20");
          if (r === null) return;
          const [a, b2] = r.split(/[;\s]+/).map((z) => parseFloat(z.replace(",", ".")) || 0);
          (v = a), (vmax = b2 ?? a);
        }
        const mm: Mate = { id: uid(), type: t, a: ents[0], b: ents[1], v, vmax, flip: this.autoFlip(t, ents[0], ents[1]) || undefined };
        mm.flipD = this.autoSide(mm) || undefined;
        this.addMate(mm);
        this.pre = [];
      });
      bar.appendChild(b);
    }
    const more = h("button", "s3-rb", "Diğer…");
    more.addEventListener("click", () => (bar.remove(), this.startMate()));
    bar.appendChild(more);
    bar.style.cssText += `position:fixed;z-index:60;flex-wrap:wrap;max-width:330px;gap:4px;left:${Math.max(4, Math.min(innerWidth - 340, x + 14))}px;top:${Math.max(4, y - 70)}px`;
    bar.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    document.body.appendChild(bar);
  }
  /** SolidWorks: hizalama, varlıkların şu anki yönüne en yakın olan seçilir (çakışık düzlemler varsayılan ters) */
  /** mesafe / limit: mevcut tarafı koru → ölçüyü ters çevir gerekirse açılır */
  private autoSide(m: Mate): boolean {
    if (m.type !== "distance" && m.type !== "limit") return !!m.flipD;
    const cm = new Map<string, AsmComp>(this.doc.comps.map((c) => [c.id, c]));
    if (!cm.has(m.a.comp) || !cm.has(m.b.comp)) return !!m.flipD;
    const r = mateRes({ ...m, type: "distance", v: 0, flipD: false }, cm).r;
    return (r[r.length - 1] ?? 0) < -1e-9;
  }
  private autoFlip(t: MateType, a: MateEnt, b: MateEnt) {
    if (!ALIGNABLE.has(t) || t === "tangent") return false;
    const ca = this.doc.comps.find((c) => c.id === a.comp), cb = this.doc.comps.find((c) => c.id === b.comp);
    if (!ca || !cb) return false;
    const d = wEnt(a, ca).N.dot(wEnt(b, cb).N);
    if (t === "coincident" && a.kind === "plane" && b.kind === "plane") return d > 0.7;
    return d > 0;
  }
  /** eşleşme ekle; sağlanamazsa geri al (SolidWorks: aşırı tanımlama hatası) */
  addMate(m: Mate, keepBad = false, at = -1): boolean {
    this.prepRef(m);
    const before = this.poses();
    if (at >= 0) this.doc.mates.splice(at, 0, m);
    else this.doc.mates.push(m);
    const r = this.solve();
    if (r.bad.includes(m.id) && !keepBad) {
      this.doc.mates = this.doc.mates.filter((x) => x !== m);
      this.restore(before);
      this.solve();
      this.ctx.toast(`${MATE_NAMES[m.type]} eşleşmesi sağlanamıyor: montajı aşırı tanımlıyor veya geometri uygun değil`, true);
      this.draw();
      return false;
    }
    if (!r.ok) this.ctx.toast("Bazı eşleşmeler sağlanamıyor (kırmızı)", true);
    this.ctx.hint("");
    this.save();
    this.draw();
    this.renderTree();
    return true;
  }
  /** kilit ve mekanik eşleşmeler: oluşturulduğu andaki konumlar */
  private prepRef(m: Mate) {
    const ca = this.doc.comps.find((c) => c.id === m.a.comp), cb = this.doc.comps.find((c) => c.id === m.b.comp);
    if (!ca || !cb) return;
    if (["lock", "gear", "rack", "screw", "coupler", "universal"].includes(m.type) && !m.ref) m.ref = { pa: [...ca.p], qa: [...ca.q], pb: [...cb.p], qb: [...cb.q] };
    m.L = Math.max((ca as any)._L ?? 50, (cb as any)._L ?? 50);
  }
  suggest(a: MateEnt, b: MateEnt): MateType {
    const ax = (e: MateEnt) => e.kind === "cyl" || e.kind === "circle" || e.kind === "line";
    if (ax(a) && ax(b)) return a.kind === "line" && b.kind === "line" ? "coincident" : "concentric";
    if (a.kind === "cyl" || b.kind === "cyl") return a.kind === "plane" || b.kind === "plane" ? "tangent" : "coincident";
    return "coincident";
  }
  startMate(edit?: Mate) {
    if (this.doc.comps.length < 2) return this.ctx.toast("Eşleşme için en az iki bileşen gerekir", true);
    this.cancelMate();
    this.snap = this.poses();
    if (edit) {
      const tab = (Object.keys(MATE_GROUPS) as ("std" | "adv" | "mech")[]).find((g) => MATE_GROUPS[g].includes(edit.type)) ?? "std";
      this.mateDraft = { edit: edit.id, type: edit.type, tab, ents: [edit.a, edit.b, edit.c ?? null, edit.d ?? null], slot: 0, v: edit.v ?? 10, vmax: edit.vmax ?? 20, flip: !!edit.flip, flipD: !!edit.flipD };
      (edit as any)._wasOff = !!edit.off;
      edit.off = true; // önizleme sırasında eskisi devre dışı
    } else {
      const ents = this.pre.slice();
      this.mateDraft = { type: "coincident", tab: "std", ents: [ents[0] ?? null, ents[1] ?? null, null, null], slot: ents.length >= 2 ? 0 : ents.length, v: 10, vmax: 20, flip: false, flipD: false };
      if (ents.length === 2) {
        this.mateDraft.type = this.suggest(ents[0], ents[1]);
        this.mateDraft.flip = this.autoFlip(this.mateDraft.type, ents[0], ents[1]);
      }
    }
    this.pre = [];
    this.ctx.showPM(edit ? `Eşleşmeyi düzenle — ${MATE_NAMES[edit.type]}` : "Eşleşme", () => this.commitMate(), () => this.cancelMate());
    this.renderMatePM();
    this.preview();
    this.renderTree();
  }
  private cancelMate() {
    if (!this.mateDraft) return;
    const d = this.mateDraft;
    this.mateDraft = null;
    this.doc.mates = this.doc.mates.filter((m) => m.id !== "__draft");
    if (d.edit) {
      const m = this.doc.mates.find((x) => x.id === d.edit);
      if (m) m.off = (m as any)._wasOff ?? false;
    }
    if (this.snap) this.restore(this.snap);
    this.snap = null;
    this.solve();
    this.ctx.hidePM();
    this.ctx.hint("");
    this.draw();
    this.renderTree();
  }
  /** taslak eşleşmeyi seçimlerle doldur */
  private pickInto(e: MateEnt) {
    const d = this.mateDraft!;
    const slots = slotsOf(d.type);
    const ranges: [number, number][] = [];
    let k = 0;
    for (const [, n] of slots) (ranges.push([k, k + n]), (k += n));
    const [s0, s1] = ranges[d.slot >= ranges[0][1] ? 1 : 0] ?? ranges[0];
    // boş yere koy; doluysa sonuncuyu değiştir
    let at = -1;
    for (let i = s0; i < s1; i++) if (!d.ents[i]) (at = i), (i = s1);
    if (at < 0) at = s1 - 1;
    const other = at === s0 ? d.ents[s0 + 1] : d.ents[s0];
    if (other && other.comp === e.comp && s1 - s0 === 2 && d.type !== "width") return this.ctx.toast("İkinci seçim başka bir bileşenden olmalı", true);
    d.ents[at] = e;
    // ilk grup dolunca sonraki gruba geç
    if (d.ents.slice(s0, s1).every(Boolean) && ranges.length > 1 && s0 === 0) d.slot = ranges[1][0];
    if (d.tab === "std" && d.ents[0] && d.ents[1] && !d.edit) {
      const types = AsmUI.typesFor([d.ents[0], d.ents[1]]);
      if (!types.includes(d.type)) d.type = types[0];
      if (d.type === "coincident" || d.type === "concentric") d.type = this.suggest(d.ents[0], d.ents[1]);
      d.flip = this.autoFlip(d.type, d.ents[0], d.ents[1]);
    }
    this.renderMatePM();
    this.preview();
  }
  /** taslaktan eşleşme nesnesi (eksik seçimde null) */
  private draftMate(): Mate | null {
    const d = this.mateDraft;
    if (!d) return null;
    const need = slotsOf(d.type).reduce((s, [, n]) => s + n, 0);
    const ents = d.ents.slice(0, need);
    if (d.type === "width" && ents[0] && ents[1] && ents[2] && !ents[3]) ents.length = 3; // sekme tek silindir olabilir
    else if (ents.some((e) => !e)) return null;
    const [a, b, c, dd] = ents as MateEnt[];
    const vals = ["distance", "angle", "limit", "limitAngle", "gear", "rack", "screw", "coupler", "profileCenter"].includes(d.type);
    return { id: "__draft", type: d.type, a, b, ...(c ? { c } : {}), ...(dd ? { d: dd } : {}), v: vals ? d.v : undefined, vmax: ["limit", "limitAngle", "gear", "coupler"].includes(d.type) ? d.vmax : undefined, flip: d.flip || undefined, flipD: d.flipD || undefined };
  }
  /** canlı önizleme */
  private preview() {
    const d = this.mateDraft;
    if (!d || !this.snap) return;
    this.doc.mates = this.doc.mates.filter((m) => m.id !== "__draft");
    this.restore(this.snap);
    const m = this.draftMate();
    let msg = "";
    if (m) {
      if (d.edit) {
        const old = this.doc.mates.find((x) => x.id === d.edit);
        if (old?.ref) m.ref = old.ref;
      }
      this.prepRef(m);
      this.doc.mates.push(m);
      const r = this.solve();
      if (r.bad.includes("__draft")) msg = "Bu eşleşme sağlanamıyor (aşırı tanım veya uygun olmayan seçim)";
    } else this.solve();
    const st = document.getElementById("mate-status");
    if (st) ((st.textContent = msg || (m ? "✓ Önizleme" : "")), st.classList.toggle("err", !!msg));
    this.draw();
  }
  private renderMatePM() {
    const d = this.mateDraft;
    if (!d) return;
    const body = document.getElementById("pm-body")!;
    body.innerHTML = "";
    const name = (e: MateEnt) => `${this.doc.comps.find((c) => c.id === e.comp)?.name ?? "Montaj"} · ${e.label ?? KIND_NAMES[e.kind]}`;
    // seçim kutuları
    let k = 0;
    slotsOf(d.type).forEach(([title, n], si) => {
      const s0 = k;
      k += n;
      const box = h("div", "pm-picks mate-slot" + (d.slot >= s0 && d.slot < s0 + n ? " active" : ""));
      for (let i = s0; i < s0 + n; i++) {
        const e = d.ents[i];
        const row = h("div", "pm-relrow");
        row.appendChild(h("span", "", e ? name(e) : "—"));
        if (e) row.appendChild(button("✕", () => ((d.ents[i] = null), (d.slot = s0), this.renderMatePM(), this.preview()), "btn danger rel-x"));
        box.appendChild(row);
      }
      box.addEventListener("click", () => ((d.slot = s0), this.renderMatePM()));
      body.appendChild(group(title + (si === 0 ? "" : " (tıklayıp seçin)"), box));
    });
    // tür sekmeleri
    body.appendChild(
      segField([{ v: "std", t: "Standart" }, { v: "adv", t: "Gelişmiş" }, { v: "mech", t: "Mekanik" }], d.tab, (v) => {
        d.tab = v;
        d.type = MATE_GROUPS[v][0];
        this.renderMatePM();
        this.preview();
      }),
    );
    const real = d.ents.filter(Boolean) as MateEnt[];
    const valid = d.tab === "std" ? AsmUI.typesFor(real.slice(0, 2)) : MATE_GROUPS[d.tab];
    const grid = h("div", "mate-types");
    for (const t of MATE_GROUPS[d.tab]) {
      const b = h("button", "s3-rb" + (t === d.type ? " on" : "") + (valid.includes(t) ? "" : " dis"), MATE_NAMES[t]);
      b.dataset.mate = t;
      b.addEventListener("click", () => {
        d.type = t;
        if (d.ents[0] && d.ents[1]) {
          d.flip = this.autoFlip(t, d.ents[0], d.ents[1]);
          d.flipD = this.autoSide({ id: "x", type: t, a: d.ents[0], b: d.ents[1], flip: d.flip });
        }
        this.renderMatePM();
        this.preview();
      });
      grid.appendChild(b);
    }
    body.appendChild(group(d.tab === "std" ? "Standart eşleşmeler" : d.tab === "adv" ? "Gelişmiş eşleşmeler" : "Mekanik eşleşmeler", grid));
    // değerler
    const pv = () => this.preview();
    const vals: HTMLElement[] = [];
    const nf = (l: string, key: "v" | "vmax", unit: string) => numField(l, d[key], (x) => ((d[key] = x), pv()), { unit });
    if (d.type === "distance") vals.push(nf("Mesafe", "v", "mm"), checkField("Ölçüyü ters çevir", d.flipD, (x) => ((d.flipD = x), pv())));
    if (d.type === "angle") vals.push(nf("Açı", "v", "°"));
    if (d.type === "limit") vals.push(nf("En az", "v", "mm"), nf("En çok", "vmax", "mm"), checkField("Ölçüyü ters çevir", d.flipD, (x) => ((d.flipD = x), pv())));
    if (d.type === "limitAngle") vals.push(nf("En az açı", "v", "°"), nf("En çok açı", "vmax", "°"));
    if (d.type === "gear") vals.push(nf("Oran: 1. dişli çapı", "v", "mm"), nf("Oran: 2. dişli çapı", "vmax", "mm"));
    if (d.type === "rack") vals.push(nf("Pinyon hatve çapı", "v", "mm"));
    if (d.type === "screw") vals.push(nf("Hatve (tur başına)", "v", "mm"));
    if (d.type === "coupler") vals.push(nf("Oran: 1. bileşen", "v", "mm"), nf("Oran: 2. bileşen", "vmax", "mm"));
    if (d.type === "profileCenter") vals.push(nf("Öteleme", "v", "mm"));
    if (["gear", "rack", "screw", "coupler", "universal"].includes(d.type)) vals.push(checkField("Ters çevir", d.flip, (x) => ((d.flip = x), pv())));
    if (ALIGNABLE.has(d.type))
      vals.push(
        h("div", "pm-hint", "Eşleşme hizalaması"),
        segField([{ v: "anti", t: "Ters hizalı" }, { v: "al", t: "Hizalı" }], d.flip ? "al" : "anti", (x) => ((d.flip = x === "al"), pv())),
      );
    if (vals.length) body.appendChild(group("Değerler", ...vals));
    const st = h("p", "pm-hint mate-status");
    st.id = "mate-status";
    body.appendChild(st);
    const tips: Partial<Record<MateType, string>> = {
      symmetric: "İki varlık, seçilen simetri düzlemine göre simetrik konumlanır.",
      width: "Sekme (veya silindir) iki genişlik yüzünün tam ortasında kalır.",
      profileCenter: "İki düz yüzün profil merkezleri hizalanır ve yüzler çakışır (öteleme verilebilir).",
      universal: "İki milin dönmesi üniversal mafsal bağıntısıyla bağlanır (milleri ayrıca eksenlerine eşleştirin).",
      hinge: "Eş merkezli + çakışık eşleşmeyi tek eşleşmede birleştirir: yalnız eksen etrafında döner.",
      gear: "İki silindir ekseninin dönmeleri çaplar oranında bağlanır (eş merkezli eşleşmeleri ayrıca verin).",
      rack: "1. seçim: kremayerin doğrusal kenarı / düz yüzü (hareket yönü); 2. seçim: pinyon silindiri.",
      screw: "1. seçim: vida ekseni, 2. seçim: somun ekseni. Dönme × hatve = ilerleme.",
      coupler: "İki bileşenin seçilen yönlerdeki ötelemeleri oranla bağlanır.",
      limit: "Bileşen en az / en çok arasında serbestçe hareket eder.",
      limitAngle: "İki yüz arasındaki açı en az / en çok arasında kalır.",
      lock: "İki bileşen arasındaki göreli konum olduğu gibi kilitlenir.",
    };
    if (tips[d.type]) body.appendChild(h("p", "pm-hint", tips[d.type]!));
    this.ctx.hint(real.length < 2 ? "Eşleştirilecek yüz / kenar / köşelere dokunun (iki farklı bileşen)" : "Türü seçip ✓ ile onaylayın");
    this.draw();
  }
  private commitMate() {
    const d = this.mateDraft;
    if (!d) return;
    const m = this.draftMate();
    if (!m) return this.ctx.toast("Seçimleri tamamlayın", true);
    const old = d.edit ? this.doc.mates.find((x) => x.id === d.edit) : null;
    m.id = old?.id ?? uid();
    if (old?.ref && m.type === old.type) m.ref = old.ref;
    else delete m.ref;
    const at = old ? this.doc.mates.indexOf(old) : -1;
    this.doc.mates = this.doc.mates.filter((x) => x.id !== "__draft" && x !== old);
    if (this.snap) this.restore(this.snap);
    this.mateDraft = null;
    this.snap = null;
    const ok = this.addMate(m, false, at);
    if (!ok && old) (old.off = (old as any)._wasOff || undefined), this.doc.mates.splice(Math.max(0, at), 0, old), this.solve();
    if (!ok) {
      // SolidWorks: hata varsa panel açık kalır
      this.startMate(old ?? undefined);
      if (!old && this.mateDraft) {
        const md = this.mateDraft as MateDraft;
        Object.assign(md, { type: m.type, ents: [m.a, m.b, m.c ?? null, m.d ?? null], v: m.v ?? 10, vmax: m.vmax ?? 20, flip: !!m.flip, flipD: !!m.flipD });
        this.renderMatePM();
      }
      return;
    }
    this.ctx.hidePM();
  }
  /** eşleşmeyi bastır / etkinleştir, hizalamayı çevir, sil */
  mateAct(m: Mate, act: "off" | "flip" | "del") {
    if (act === "off") m.off = !m.off;
    if (act === "flip") m.flip = !m.flip || undefined;
    if (act === "del") this.doc.mates = this.doc.mates.filter((x) => x !== m);
    if (act === "del" && this.selMate === m.id) this.selMate = null;
    this.solve();
    this.save();
    this.draw();
    this.renderTree();
  }

  // ---------- bileşen işlemleri ----------
  addComp(part: AsmPart) {
    const n = this.doc.comps.filter((c) => c.part.name === part.name).length + 1;
    const first = !this.doc.comps.length;
    // yeni bileşeni mevcut montajın yanına koy
    const box = new THREE.Box3().setFromObject(this.group);
    const x = box.isEmpty() ? 0 : box.max.x + 30;
    this.doc.comps.push({ id: uid(), name: `${part.name}<${n}>`, part: JSON.parse(JSON.stringify(part)), q: [0, 0, 0, 1], p: [x, 0, 0], fixed: first });
    this.save();
    this.refresh().then(() => this.renderTree());
  }
  openAddDialog(replace?: AsmComp) {
    const dlg = document.createElement("dialog");
    dlg.className = "input-dialog";
    dlg.appendChild(h("h2", "", replace ? `Bileşeni değiştir: ${replace.name}` : "Bileşen ekle"));
    const lib = loadLib();
    const cur = this.ctx.currentPart();
    const add = (p: AsmPart) => (dlg.close(), replace ? this.replaceComp(replace, p) : this.addComp(p));
    dlg.appendChild(button(`Geçerli parça: ${cur.name}`, () => add(cur), "btn primary wide"));
    dlg.appendChild(h("h3", "", "Parça kütüphanesi"));
    const names = Object.keys(lib);
    if (!names.length) dlg.appendChild(h("p", "pm-hint", "Kütüphane boş. Parça modunda Montaj sekmesindeki 'Parçayı kütüphaneye kaydet' ile ekleyin."));
    for (const n of names) {
      const row = h("div", "pm-row");
      row.append(button(n, () => add(lib[n]), "btn wide"), button("Sil", () => (removeFromLib(n), row.remove()), "btn danger"));
      dlg.appendChild(row);
    }
    dlg.appendChild(h("h3", "", "Dosyadan"));
    dlg.appendChild(
      button("Parça dosyası aç (.icad)…", () => {
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = ".icad,.json";
        inp.onchange = async () => {
          const f = inp.files?.[0];
          if (!f) return;
          try {
            const d = JSON.parse(await f.text());
            add({ name: d.name || f.name.replace(/\.\w+$/, ""), features: d.features, eqs: d.eqs, profiles: d.profiles });
          } catch {
            this.ctx.toast("Dosya okunamadı", true);
          }
        };
        inp.click();
      }),
    );
    if (!replace) {
      dlg.appendChild(
        button("Alt montaj ekle (.icasm)…", () => {
          const inp = document.createElement("input");
          inp.type = "file";
          inp.accept = ".icasm,.json";
          inp.onchange = async () => {
            const f = inp.files?.[0];
            if (!f) return;
            try {
              const d = JSON.parse(await f.text());
              if (d.kind !== "asm") throw 0;
              dlg.close();
              this.insertSub(d);
            } catch {
              this.ctx.toast("Montaj dosyası okunamadı", true);
            }
          };
          inp.click();
        }),
      );
      dlg.appendChild(button("Bağlantı elemanı (cıvata / somun / pul)…", () => (dlg.close(), this.openToolbox())));
    }
    dlg.appendChild(button("Kapat", () => dlg.close()));
    document.body.appendChild(dlg);
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
  }
  private comp() {
    return this.doc.comps.find((c) => c.id === this.sel) ?? null;
  }
  /** SolidWorks Bileşeni Taşı / Döndür paneli */
  openMove(rotate = false) {
    const c = this.comp();
    if (!c) return this.ctx.toast("Önce bir bileşen seçin", true);
    if (c.fixed) return this.ctx.toast("Sabit bileşen taşınamaz (önce 'Serbest bırak')", true);
    const st = { mode: rotate ? "rdelta" : "free", x: 0, y: 0, z: 0, ax: "y", ang: 90 };
    const start = this.poses();
    this.dragMode = rotate ? "rotate" : "move";
    this.ctx.showPM(rotate ? "Bileşeni döndür" : "Bileşeni taşı", () => ((this.dragMode = "move"), this.ctx.hidePM(), this.save(), this.renderTree()), () => {
      this.dragMode = "move";
      this.restore(start);
      this.solve();
      this.draw();
      this.ctx.hidePM();
    });
    const body = document.getElementById("pm-body")!;
    const go = () => {
      const before = this.poses();
      if (st.mode === "delta") c.p = [c.p[0] + st.x, c.p[1] + st.y, c.p[2] + st.z];
      else if (st.mode === "to") {
        const cc = this.compCenter(c);
        c.p = [c.p[0] + st.x - cc.x, c.p[1] + st.y - cc.y, c.p[2] + st.z - cc.z];
      } else if (st.mode === "rdelta") {
        const cc = this.compCenter(c);
        let q = new THREE.Quaternion();
        ([["x", st.x], ["y", st.y], ["z", st.z]] as [string, number][]).forEach(([a, v]) => {
          if (v) q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(a === "x" ? 1 : 0, a === "y" ? 1 : 0, a === "z" ? 1 : 0), (v * Math.PI) / 180).multiply(q);
        });
        const nq = q.clone().multiply(QQ(c));
        const p = V3(c.p).sub(cc).applyQuaternion(q).add(cc);
        c.q = [nq.x, nq.y, nq.z, nq.w];
        c.p = [p.x, p.y, p.z];
      }
      // eşleşmeler varsa yeni konumu hedef alarak çöz
      const tgt = this.poses().get(c.id)!;
      this.restore(before);
      if (st.mode === "rdelta") this.solve({ drag: { comp: c.id, rot: tgt.q } });
      else {
        const lc = ((c as any)._lc as Vec3) ?? [0, 0, 0];
        const w = V3(lc).applyQuaternion(new THREE.Quaternion(...tgt.q)).add(V3(tgt.p));
        this.solve({ drag: { comp: c.id, local: lc, target: [w.x, w.y, w.z] } });
        if (!this.doc.mates.some((m) => !m.off && [m.a, m.b, m.c, m.d].some((x) => x?.comp === c.id))) (c.p = tgt.p), (c.q = tgt.q);
      }
      this.draw();
    };
    const render = () => {
      body.innerHTML = "";
      const modes = rotate
        ? [{ v: "free", t: "Serbest sürükle" }, { v: "rdelta", t: "Delta XYZ ile (açı)" }]
        : [{ v: "free", t: "Serbest sürükle" }, { v: "delta", t: "Delta XYZ ile" }, { v: "to", t: "XYZ konumuna (merkez)" }];
      body.appendChild(group(rotate ? "Döndür" : "Taşı", selectField("Yöntem", modes, st.mode, (v) => ((st.mode = v), render()))));
      if (st.mode !== "free") {
        const u = rotate ? "°" : "mm";
        if (st.mode === "to") {
          const cc = this.compCenter(c);
          (st.x = +cc.x.toFixed(3)), (st.y = +cc.y.toFixed(3)), (st.z = +cc.z.toFixed(3));
        }
        body.appendChild(group("Değerler", numField(rotate ? "X ekseni" : "X", st.x, (v) => (st.x = v), { unit: u }), numField(rotate ? "Y ekseni" : "Y", st.y, (v) => (st.y = v), { unit: u }), numField(rotate ? "Z ekseni" : "Z", st.z, (v) => (st.z = v), { unit: u }), button("Uygula", go, "btn primary")));
      } else body.appendChild(h("p", "pm-hint", rotate ? "Bileşeni grafik alanda sürükleyerek döndürün. Eşleşmeler korunur: yalnız kalan serbestlik yönünde döner." : "Bileşeni grafik alanda sürükleyin. Eşleşmeler korunur: yalnız kalan serbestlik yönünde hareket eder. Alt + sürükle = SmartMate."));
      body.appendChild(group("Seçenekler", checkField("Çarpışma algıla (çarpınca dur)", this.collide, (v) => (this.collide = v)), segField([{ v: "move", t: "Sürükle = taşı" }, { v: "rotate", t: "Sürükle = döndür" }], this.dragMode, (v) => (this.dragMode = v))));
    };
    render();
  }
  /** SolidWorks Bileşenleri Aynala: kopya (aynı parça) veya ters el (aynalı parça) */
  openMirror() {
    const st = { plane: "yz", custom: null as MateEnt | null, hand: true, comps: new Set(this.selSet.size ? this.selSet : this.sel ? [this.sel] : []) };
    const start = new Set(this.selSet);
    const finish = () => {
      this.picker = null;
      this.ctx.hidePM();
      this.selSet = start;
      this.draw();
    };
    const done = () => {
      if (!st.comps.size) return this.ctx.toast("Aynalanacak bileşenleri seçin", true);
      // ayna düzlemi (dünya)
      let P = new THREE.Vector3(), N = new THREE.Vector3(1, 0, 0);
      if (st.plane === "xy") N.set(0, 0, 1);
      if (st.plane === "xz") N.set(0, 1, 0);
      if (st.plane === "face" && st.custom) {
        const cc = this.doc.comps.find((c) => c.id === st.custom!.comp)!;
        const w = wEnt(st.custom, cc);
        (P = w.P), (N = w.N);
      }
      const M = new THREE.Matrix3().set(1 - 2 * N.x * N.x, -2 * N.x * N.y, -2 * N.x * N.z, -2 * N.y * N.x, 1 - 2 * N.y * N.y, -2 * N.y * N.z, -2 * N.z * N.x, -2 * N.z * N.y, 1 - 2 * N.z * N.z);
      const refl = (p: THREE.Vector3) => p.clone().addScaledVector(N, -2 * p.clone().sub(P).dot(N));
      for (const id of st.comps) {
        const c = this.doc.comps.find((x) => x.id === id);
        if (!c) continue;
        const R = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(QQ(c)));
        let part = JSON.parse(JSON.stringify(c.part)) as AsmPart, q: THREE.Quaternion;
        if (st.hand) {
          // ters el: parça yerel YZ düzleminde aynalanır; R' = M·R·Mx (uygun dönme)
          part = { ...part, name: part.name + " (ayna)", features: [...part.features, { id: "mirAsm", type: "mirror", name: "Montaj aynası", feats: [], body: true, only: true, plane: { k: "std", n: "right" } } as any] };
          const Mx = new THREE.Matrix3().set(-1, 0, 0, 0, 1, 0, 0, 0, 1);
          const Rn = M.clone().multiply(R).multiply(Mx);
          const m4 = new THREE.Matrix4().setFromMatrix3(Rn);
          q = new THREE.Quaternion().setFromRotationMatrix(m4);
        } else {
          // kopya: aynı parça, yönelim aynı, konum aynalanır (bileşen merkezine göre)
          q = QQ(c);
        }
        let p: THREE.Vector3;
        if (st.hand) p = refl(V3(c.p));
        else {
          const cc = this.compCenter(c), mc = refl(cc);
          p = V3(c.p).add(mc.sub(cc));
        }
        const n = this.doc.comps.filter((x) => x.part.name === part.name).length + 1;
        this.doc.comps.push({ id: uid(), name: `${part.name}<${n}>`, part, q: [q.x, q.y, q.z, q.w], p: [p.x, p.y, p.z], fixed: false });
      }
      finish();
      this.save();
      this.refresh().then(() => this.renderTree());
    };
    this.ctx.showPM("Bileşenleri aynala", done, finish);
    const body = document.getElementById("pm-body")!;
    const render = () => {
      body.innerHTML = "";
      body.appendChild(
        group(
          "Ayna düzlemi",
          selectField("Düzlem", [{ v: "yz", t: "Montaj Sağ düzlemi (YZ)" }, { v: "xy", t: "Montaj Ön düzlemi (XY)" }, { v: "xz", t: "Montaj Üst düzlemi (XZ)" }, { v: "face", t: st.custom ? "Seçilen düz yüz ✓" : "Bir düz yüz seçin…" }], st.plane, (v) => ((st.plane = v), render())),
        ),
      );
      const names = [...st.comps].map((id) => this.doc.comps.find((c) => c.id === id)?.name ?? "?");
      body.appendChild(group("Aynalanacak bileşenler", h("div", "pm-picks", names.length ? names.join(", ") : "Grafik alanda bileşenlere dokunun")));
      body.appendChild(group("Yönlendirme", segField([{ v: "hand", t: "Ters el (aynalı parça)" }, { v: "copy", t: "Kopya" }], st.hand ? "hand" : "copy", (v) => ((st.hand = v === "hand"), render())), h("p", "pm-hint", st.hand ? "Parçanın aynalanmış (sağ/sol) sürümü oluşturulur: '(ayna)' adıyla." : "Aynı parça aynalanmış konuma kopyalanır (simetrik parçalar için).")));
    };
    this.picker = (p) => {
      if (!p) return;
      if (st.plane === "face" && p.ent?.kind === "plane" && !st.custom) st.custom = p.ent;
      else if (st.comps.has(p.comp)) st.comps.delete(p.comp);
      else st.comps.add(p.comp);
      this.selSet = new Set(st.comps);
      this.draw();
      render();
    };
    this.selSet = new Set(st.comps);
    this.draw();
    render();
  }
  /** SolidWorks Patlatılmış Görünüm: adımlar (bileşenler + yön + mesafe) */
  openExplode() {
    if (!this.doc.steps) this.doc.steps = [];
    const st = { comps: new Set<string>(this.selSet), dir: "y", custom: null as Vec3 | null, d: 50 };
    const finish = () => {
      this.picker = null;
      this.ctx.hidePM();
      this.selSet = new Set();
      this.save();
      this.draw();
      this.renderTree();
    };
    this.doc.exploded = true;
    this.exT = 1;
    this.ctx.showPM("Patlatılmış görünüm", finish, finish);
    const body = document.getElementById("pm-body")!;
    const dirV = (): Vec3 => {
      if (st.dir === "face" && st.custom) return st.custom;
      const s = st.dir.startsWith("-") ? -1 : 1, a = st.dir.slice(-1);
      return [a === "x" ? s : 0, a === "y" ? s : 0, a === "z" ? s : 0];
    };
    const render = () => {
      body.innerHTML = "";
      const steps = this.doc.steps!;
      const list = h("div", "pm-feats");
      steps.forEach((s, i) => {
        const row = h("div", "pm-relrow");
        const nm = s.comps.map((id) => this.doc.comps.find((c) => c.id === id)?.name ?? "?").join(", ");
        row.append(h("span", "", `Adım ${i + 1}: ${nm} · ${s.d} mm`), button("✕", () => (steps.splice(i, 1), this.draw(), render()), "btn danger rel-x"));
        list.appendChild(row);
      });
      body.appendChild(group("Patlatma adımları", ...(steps.length ? [list] : [h("p", "pm-hint", "Henüz adım yok")]), button("Otomatik adımlar (merkezden dışa)", () => (this.autoExplode(), render()), "btn")));
      const names = [...st.comps].map((id) => this.doc.comps.find((c) => c.id === id)?.name ?? "?");
      body.appendChild(
        group(
          "Yeni adım",
          h("div", "pm-picks", names.length ? names.join(", ") : "Taşınacak bileşenlere dokunun"),
          selectField("Yön", [{ v: "x", t: "+X" }, { v: "-x", t: "−X" }, { v: "y", t: "+Y" }, { v: "-y", t: "−Y" }, { v: "z", t: "+Z" }, { v: "-z", t: "−Z" }, { v: "face", t: st.custom ? "Seçilen yüz normali ✓" : "Yüz normali (yüze dokunun)" }], st.dir, (v) => ((st.dir = v), (st.custom = v === "face" ? st.custom : null), render())),
          numField("Mesafe", st.d, (v) => (st.d = v), { unit: "mm" }),
          button("Adım ekle", () => {
            if (!st.comps.size) return this.ctx.toast("Bileşen seçin", true);
            steps.push({ id: uid(), comps: [...st.comps], dir: dirV(), d: st.d });
            st.comps.clear();
            this.selSet = new Set();
            this.draw();
            render();
          }, "btn primary"),
        ),
      );
    };
    this.picker = (p) => {
      if (!p) return;
      if (st.dir === "face" && p.ent?.kind === "plane") {
        const c = this.doc.comps.find((x) => x.id === p.comp)!;
        const n = wEnt(p.ent, c).N;
        st.custom = [n.x, n.y, n.z];
      } else if (st.comps.has(p.comp)) st.comps.delete(p.comp);
      else st.comps.add(p.comp);
      this.selSet = new Set(st.comps);
      this.draw();
      render();
    };
    this.draw();
    render();
  }
  private autoExplode() {
    const center = this.asmCenter();
    const steps: ExplodeStep[] = [];
    for (const c of this.doc.comps) {
      if (c.fixed) continue;
      const d = this.compCenter(c).sub(center);
      const L = ((c as any)._L ?? 30) * 1.6;
      if (d.length() < 1e-6) d.set(0, 1, 0);
      d.normalize();
      steps.push({ id: uid(), comps: [c.id], dir: [d.x, d.y, d.z], d: Math.round(L) });
    }
    this.doc.steps = steps;
    this.doc.exploded = true;
    this.exT = 1;
    this.save();
    this.draw();
  }
  /** patlat / daralt (animasyonlu) */
  toggleExplode() {
    if (!(this.doc.steps ?? []).length) return this.openExplode();
    const to = this.doc.exploded ? 0 : 1;
    this.doc.exploded = !!to;
    const from = this.exT, t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 700);
      this.exT = from + (to - from) * (k * k * (3 - 2 * k));
      this.draw();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    this.save();
  }
  /** kütle özellikleri (ağlardan; yoğunluk varsayılan çelik) */
  massProps() {
    const rho = 7.85e-3; // g/mm³
    let V = 0;
    const C = new THREE.Vector3();
    const rows: string[] = [];
    for (const c of this.doc.comps) {
      if (c.hidden) continue;
      const m = this.meshes.get(c.id);
      if (!m) continue;
      let v = 0;
      const cc = new THREE.Vector3();
      const P = (i: number) => new THREE.Vector3(m.vertices[i * 3], m.vertices[i * 3 + 1], m.vertices[i * 3 + 2]);
      for (let t = 0; t < m.triangles.length; t += 3) {
        const a = P(m.triangles[t]), b = P(m.triangles[t + 1]), d = P(m.triangles[t + 2]);
        const dv = a.dot(new THREE.Vector3().crossVectors(b, d)) / 6;
        v += dv;
        cc.addScaledVector(a.clone().add(b).add(d), dv / 4);
      }
      if (Math.abs(v) < 1e-9) continue;
      cc.multiplyScalar(1 / v).applyQuaternion(QQ(c)).add(V3(c.p));
      v = Math.abs(v);
      V += v;
      C.addScaledVector(cc, v);
      rows.push(`<tr><td>${c.name}</td><td>${(v / 1000).toFixed(2)}</td><td>${((v * rho) / 1000).toFixed(3)}</td></tr>`);
    }
    if (V > 0) C.multiplyScalar(1 / V);
    const dlg = document.createElement("dialog");
    dlg.className = "input-dialog";
    dlg.innerHTML = `<h2>Kütle özellikleri — ${this.doc.name}</h2><p>Toplam hacim: <b>${(V / 1000).toFixed(2)} cm³</b> · Kütle (çelik 7,85 g/cm³): <b>${((V * rho) / 1000).toFixed(3)} kg</b><br>Ağırlık merkezi: X ${C.x.toFixed(2)} · Y ${C.y.toFixed(2)} · Z ${C.z.toFixed(2)} mm</p><table class="cut-table"><tr><th>Bileşen</th><th>Hacim (cm³)</th><th>Kütle (kg)</th></tr>${rows.join("")}</table>`;
    dlg.appendChild(button("Kapat", () => dlg.close(), "btn primary"));
    document.body.appendChild(dlg);
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
  }
  /** bileşen çoğaltma: doğrusal / dairesel (SolidWorks Doğrusal/Dairesel Bileşen Çoğaltma) */
  openPattern() {
    const c = this.comp();
    if (!c) return this.ctx.toast("Önce çoğaltılacak bileşeni seçin", true);
    const st = { kind: "lin", ax: "x", n: 3, d: 50, ang: 360, n2: 1, d2: 50, ax2: "y" };
    const done = () => {
      const axis = (a: string) => new THREE.Vector3(a === "x" ? 1 : 0, a === "y" ? 1 : 0, a === "z" ? 1 : 0);
      const src = c;
      let k = this.doc.comps.filter((x) => x.part.name === src.part.name).length;
      const add = (p: THREE.Vector3, q: THREE.Quaternion) => {
        k++;
        this.doc.comps.push({ id: uid(), name: `${src.part.name}<${k}>`, part: JSON.parse(JSON.stringify(src.part)), q: [q.x, q.y, q.z, q.w], p: [p.x, p.y, p.z], fixed: false });
      };
      const p0 = new THREE.Vector3(...src.p), q0 = new THREE.Quaternion(...src.q);
      if (st.kind === "lin") {
        for (let i = 0; i < Math.max(1, st.n); i++)
          for (let j = 0; j < Math.max(1, st.n2); j++) {
            if (!i && !j) continue;
            add(p0.clone().addScaledVector(axis(st.ax), i * st.d).addScaledVector(axis(st.ax2), j * st.d2), q0.clone());
          }
      } else {
        const n = Math.max(2, st.n), step = ((st.ang >= 360 ? st.ang / n : st.ang / (n - 1)) * Math.PI) / 180;
        for (let i = 1; i < n; i++) {
          const r = new THREE.Quaternion().setFromAxisAngle(axis(st.ax), i * step);
          add(p0.clone().applyQuaternion(r), r.clone().multiply(q0));
        }
      }
      this.ctx.hidePM();
      this.save();
      this.refresh().then(() => this.renderTree());
    };
    this.ctx.showPM("Bileşen çoğaltma", done, () => this.ctx.hidePM());
    const body = document.getElementById("pm-body")!;
    const render = () => {
      body.innerHTML = "";
      const axes = [{ v: "x", t: "X" }, { v: "y", t: "Y" }, { v: "z", t: "Z" }];
      body.appendChild(group("Tür", selectField("Çoğaltma", [{ v: "lin", t: "Doğrusal" }, { v: "circ", t: "Dairesel (orijin ekseni)" }], st.kind, (v) => ((st.kind = v), render()))));
      if (st.kind === "lin") {
        body.appendChild(group("Yön 1", selectField("Yön", axes, st.ax, (v) => (st.ax = v)), numField("Aralık", st.d, (v) => (st.d = v), { unit: "mm" }), numField("Adet", st.n, (v) => (st.n = Math.round(v)))));
        body.appendChild(group("Yön 2", selectField("Yön", axes, st.ax2, (v) => (st.ax2 = v)), numField("Aralık", st.d2, (v) => (st.d2 = v), { unit: "mm" }), numField("Adet", st.n2, (v) => (st.n2 = Math.round(v)))));
      } else body.appendChild(group("Eksen", selectField("Eksen", axes, st.ax, (v) => (st.ax = v)), numField("Toplam açı", st.ang, (v) => (st.ang = v), { unit: "°" }), numField("Adet", st.n, (v) => (st.n = Math.round(v)))));
      body.appendChild(h("p", "pm-hint", `Kaynak: ${c.name}. Kopyalar serbest bileşen olarak eklenir.`));
    };
    render();
  }
  async interference() {
    const parts = this.doc.comps.filter((c) => !c.hidden).map((c) => ({ features: compile(this.featsOf(c), c.part.profiles ?? {}).kfeats, q: c.q, p: c.p, name: c.name }));
    this.ctx.setStatus("busy", "Girişim hesaplanıyor…");
    const r = await this.ctx.kernel.asm("interfere", parts);
    this.meshes.clear();
    await this.refresh();
    const vis = this.doc.comps.filter((c) => !c.hidden);
    const pr = r.pairs ?? [];
    this.ctx.toast(pr.length ? "Girişim: " + pr.map((x) => `${vis[x.a].name} ↔ ${vis[x.b].name} (${x.vol.toFixed(1)} mm³)`).join(" · ") : "Girişim yok ✓", pr.length > 0);
  }
  async exportStep() {
    const parts = this.doc.comps.filter((c) => !c.hidden).map((c) => ({ features: compile(this.featsOf(c), c.part.profiles ?? {}).kfeats, q: c.q, p: c.p, name: c.name }));
    this.ctx.setStatus("busy", "STEP hazırlanıyor…");
    const r = await this.ctx.kernel.asm("step", parts);
    this.meshes.clear();
    await this.refresh();
    if (!r.blob) return this.ctx.toast(r.message ?? "Dışa aktarılamadı", true);
    this.ctx.download(r.blob, `${this.doc.name}.step`);
  }
  showBom() {
    const rows = bom(this.doc);
    const dlg = document.createElement("dialog");
    dlg.className = "input-dialog";
    dlg.innerHTML = `<h2>Malzeme listesi — ${this.doc.name}</h2><table class="cut-table"><tr><th>No</th><th>Parça</th><th>Adet</th></tr>${rows.map((r) => `<tr><td>${r.no}</td><td>${r.name}</td><td>${r.qty}</td></tr>`).join("")}</table>`;
    const bar = h("div", "cut-bar");
    bar.append(
      button("CSV indir", () => this.ctx.download(new Blob(["No;Parça;Adet\n" + rows.map((r) => `${r.no};${r.name};${r.qty}`).join("\n")], { type: "text/csv" }), `${this.doc.name}_BOM.csv`)),
      button("Kapat", () => dlg.close(), "btn primary"),
    );
    dlg.appendChild(bar);
    document.body.appendChild(dlg);
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
  }

  // ---------- ana düzlemler / orijin (bileşen ve montaj) ----------
  /** bileşenin (veya montajın) Ön / Üst / Sağ düzlemi ve orijini eşleşme varlığı olarak */
  planeEnts(comp: string): [string, MateEnt][] {
    return [
      ["Ön düzlem", { comp, kind: "plane", c: [0, 0, 0], n: [0, 0, 1], label: "Ön düzlem" }],
      ["Üst düzlem", { comp, kind: "plane", c: [0, 0, 0], n: [0, 1, 0], label: "Üst düzlem" }],
      ["Sağ düzlem", { comp, kind: "plane", c: [0, 0, 0], n: [1, 0, 0], label: "Sağ düzlem" }],
      ["Orijin", { comp, kind: "point", c: [0, 0, 0], n: [0, 0, 1], label: "Orijin" }],
    ];
  }

  // ---------- alt montaj ----------
  /** .icasm dosyasını alt montaj olarak ekle (rijit) */
  insertSub(sub: AsmDoc) {
    const map = new Map<string, string>();
    const box = new THREE.Box3().setFromObject(this.group);
    const dx = box.isEmpty() ? 0 : box.max.x + 40;
    const sid = uid();
    for (const c of sub.comps) {
      const id = uid();
      map.set(c.id, id);
      this.doc.comps.push({ ...JSON.parse(JSON.stringify(c)), id, p: [c.p[0] + dx, c.p[1], c.p[2]], fixed: false });
    }
    const re = (e?: MateEnt) => (e ? { ...e, comp: map.get(e.comp) ?? e.comp } : undefined);
    for (const m of sub.mates) {
      if ([m.a, m.b, m.c, m.d].some((e) => e && !map.has(e.comp))) continue;
      this.doc.mates.push({ ...JSON.parse(JSON.stringify(m)), id: uid(), a: re(m.a)!, b: re(m.b)!, ...(m.c ? { c: re(m.c) } : {}), ...(m.d ? { d: re(m.d) } : {}), sub: sid });
    }
    const ids = [...map.values()];
    this.doc.subs = [...(this.doc.subs ?? []), { id: sid, name: sub.name, comps: ids, rigid: true, poses: this.capture(ids) }];
    this.save();
    this.refresh().then(() => this.renderTree());
  }
  private capture(ids: string[]) {
    const out: Record<string, { p: Vec3; q: [number, number, number, number] }> = {};
    for (const id of ids) {
      const c = this.doc.comps.find((x) => x.id === id);
      if (c) out[id] = { p: [...c.p] as Vec3, q: [...c.q] as Pose["q"] };
    }
    return out;
  }
  /** seçili bileşenlerden alt montaj oluştur (aralarındaki eşleşmeler iç eşleşme olur) */
  formSub() {
    const ids = [...this.selSet].filter((id) => !(this.doc.subs ?? []).some((s) => s.comps.includes(id)));
    if (ids.length < 2) return this.ctx.toast("Ctrl ile en az iki bileşen seçin", true);
    const name = prompt("Alt montaj adı", "AltMontaj" + ((this.doc.subs?.length ?? 0) + 1))?.trim();
    if (!name) return;
    const sid = uid();
    for (const m of this.doc.mates) if (!m.sub && [m.a, m.b, m.c, m.d].every((e) => !e || ids.includes(e.comp))) m.sub = sid;
    this.doc.subs = [...(this.doc.subs ?? []), { id: sid, name, comps: ids, rigid: true, poses: this.capture(ids) }];
    this.solve();
    this.save();
    this.draw();
    this.renderTree();
  }
  subAct(id: string, act: "rigid" | "dissolve" | "save") {
    const s = (this.doc.subs ?? []).find((x) => x.id === id);
    if (!s) return;
    if (act === "rigid") {
      s.rigid = !s.rigid;
      if (s.rigid) s.poses = this.capture(s.comps); // esnekten rijite: güncel konumlar kilitlenir
    } else if (act === "dissolve") {
      for (const m of this.doc.mates) if (m.sub === id) delete m.sub;
      this.doc.subs = (this.doc.subs ?? []).filter((x) => x !== s);
    } else {
      const comps = this.doc.comps.filter((c) => s.comps.includes(c.id));
      const mates = this.doc.mates.filter((m) => m.sub === id).map((m) => ({ ...m, sub: undefined }));
      const d: AsmDoc = { kind: "asm", name: s.name, comps: JSON.parse(JSON.stringify(comps, (k, v) => (k.startsWith("_") ? undefined : v))), mates };
      if (d.comps[0]) d.comps[0].fixed = true;
      return this.ctx.download(new Blob([JSON.stringify(d)], { type: "application/json" }), `${s.name}.icasm`);
    }
    this.solve();
    this.save();
    this.draw();
    this.renderTree();
  }
  /** bileşeni başka parçayla değiştir: konum ve eşleşmeler korunur */
  replaceComp(c: AsmComp, part: AsmPart, allInstances = false) {
    // parçayı düzenle: aynı parçanın tüm örnekleri güncellenir (SolidWorks); bileşen değiştir: yalnız seçili
    const k = c.part.key ?? c.part.name;
    const targets = allInstances ? this.doc.comps.filter((x) => (x.part.key ?? x.part.name) === k) : [c];
    for (const t of targets) t.part = JSON.parse(JSON.stringify({ ...part, key: part.key ?? (allInstances ? c.part.key : undefined) }));
    if (!allInstances) c.name = `${part.name}<${this.doc.comps.filter((x) => x.part.name === part.name).length}>`;
    this.save();
    this.refresh().then(() => {
      const r = this.solve();
      this.draw();
      this.renderTree();
      this.ctx.toast(r.ok ? "Bileşen değiştirildi" : "Bileşen değiştirildi; bazı eşleşmeler artık sağlanamıyor (⚠) — düzenleyin", !r.ok);
    });
  }
  /** eşleşmeleriyle kopyala: kopya, kaynağın eşleşmelerini aynı referanslarla alır (sonra düzenlenir) */
  copyWithMates(c: AsmComp) {
    const id = uid();
    const n = this.doc.comps.filter((x) => x.part.name === c.part.name).length + 1;
    const L = ((c as any)._L ?? 30) * 1.5;
    this.doc.comps.push({ ...JSON.parse(JSON.stringify(c, (k, v) => (k.startsWith("_") ? undefined : v))), id, name: `${c.part.name}<${n}>`, fixed: false, p: [c.p[0] + L, c.p[1], c.p[2]] });
    const sw = (e?: MateEnt) => (e ? { ...e, comp: e.comp === c.id ? id : e.comp } : undefined);
    let k = 0;
    for (const m of this.doc.mates.slice()) {
      if (m.sub || ![m.a, m.b, m.c, m.d].some((e) => e?.comp === c.id)) continue;
      // yerleşimi belirleyen öteleme eşleşmeleri bastırılmış gelir (SolidWorks: yeni referans seçilir)
      const off = ["coincident", "distance", "concentric", "lock", "tangent", "width", "symmetric", "profileCenter", "hinge"].includes(m.type);
      this.doc.mates.push({ ...JSON.parse(JSON.stringify(m)), id: uid(), a: sw(m.a)!, b: sw(m.b)!, ...(m.c ? { c: sw(m.c) } : {}), ...(m.d ? { d: sw(m.d) } : {}), ...(off ? { off: true } : {}), ref: undefined });
      k++;
    }
    this.save();
    this.refresh().then(() => {
      this.solve();
      this.draw();
      this.renderTree();
      this.ctx.toast(`${k} eşleşme kopyalandı; konumlandıranlar bastırılmış — düzenleyip yeni referansları seçin`);
    });
  }

  // ---------- MateXpert ----------
  /** sağlanamayan eşleşmeleri ve hangisi bastırılınca çözüldüğünü bul */
  mateXpert() {
    const r = this.solve();
    const dlg = document.createElement("dialog");
    dlg.className = "input-dialog";
    const nm = (m: Mate) => `${MATE_NAMES[m.type]} (${[...new Set([m.a, m.b].map((e) => this.doc.comps.find((c) => c.id === e.comp)?.name ?? "Montaj"))].join(", ")})`;
    dlg.appendChild(h("h2", "", "MateXpert — eşleşme analizi"));
    if (r.ok) dlg.appendChild(h("p", "", "✓ Tüm eşleşmeler sağlanıyor. Sorun yok."));
    else {
      const bad = this.doc.mates.filter((m) => this.bad.has(m.id));
      dlg.appendChild(h("p", "", `Sağlanamayan eşleşmeler (${bad.length}): ${bad.map(nm).join(" · ")}`));
      // aday: bastırılınca tüm eşleşmeler sağlanıyorsa
      const start = this.poses();
      const fix: Mate[] = [];
      for (const m of this.doc.mates.filter((x) => !x.off)) {
        m.off = true;
        const rr = solveAll(this.doc);
        m.off = undefined;
        this.restore(start);
        if (rr.ok) fix.push(m);
      }
      this.solve();
      if (fix.length) {
        dlg.appendChild(h("p", "", "Şunlardan birini bastırmak sorunu çözer:"));
        for (const m of fix) dlg.appendChild(button(`Bastır: ${nm(m)}`, () => (dlg.close(), this.mateAct(m, "off")), "btn wide"));
      } else dlg.appendChild(h("p", "pm-hint", "Tek bir eşleşmeyi bastırmak yetmiyor; sağlanamayanları düzenleyin veya silin."));
    }
    dlg.appendChild(button("Kapat", () => dlg.close(), "btn primary"));
    document.body.appendChild(dlg);
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
  }

  // ---------- boşluk doğrulama ----------
  async clearance() {
    const vis = this.doc.comps.filter((c) => !c.hidden);
    const sel = vis.filter((c) => this.selSet.has(c.id));
    const use = sel.length >= 2 ? sel : vis;
    const min = parseFloat((prompt("Boşluk doğrulama: en az boşluk (mm)", "1") ?? "").replace(",", "."));
    if (!isFinite(min)) return;
    const parts = use.map((c) => ({ features: compile(this.featsOf(c), c.part.profiles ?? {}).kfeats, q: c.q, p: c.p, name: c.name }));
    this.ctx.setStatus("busy", "Boşluk hesaplanıyor…");
    const r = await this.ctx.kernel.asm("clearance", parts);
    this.meshes.clear();
    await this.refresh();
    const rows = (r.dist ?? []).sort((a, b) => a.d - b.d);
    const dlg = document.createElement("dialog");
    dlg.className = "input-dialog";
    dlg.innerHTML = `<h2>Boşluk doğrulama (en az ${min} mm)</h2><table class="cut-table"><tr><th>Bileşen 1</th><th>Bileşen 2</th><th>Boşluk (mm)</th><th></th></tr>${rows.map((x) => `<tr><td>${use[x.a].name}</td><td>${use[x.b].name}</td><td>${x.d.toFixed(3)}</td><td>${x.d < min - 1e-6 ? "⚠ az" : "✓"}</td></tr>`).join("")}</table>`;
    dlg.appendChild(button("Kapat", () => dlg.close(), "btn primary"));
    document.body.appendChild(dlg);
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
  }

  // ---------- montaj kesit görünümü ----------
  openSection() {
    const st = { ax: "x", off: 0, flip: false };
    const R = this.ctx.viewer.renderer;
    const apply = () => {
      const n = new THREE.Vector3(st.ax === "x" ? 1 : 0, st.ax === "y" ? 1 : 0, st.ax === "z" ? 1 : 0).multiplyScalar(st.flip ? 1 : -1);
      R.clippingPlanes = [new THREE.Plane(n, st.flip ? -st.off : st.off)];
      this.ctx.viewer.requestRender();
    };
    const close = () => {
      R.clippingPlanes = [];
      this.ctx.viewer.requestRender();
      this.ctx.hidePM();
    };
    this.ctx.showPM("Montaj kesit görünümü", close, close);
    const body = document.getElementById("pm-body")!;
    const box = new THREE.Box3().setFromObject(this.group);
    const render = () => {
      body.innerHTML = "";
      const lo = box.isEmpty() ? -100 : (box.min as any)[st.ax], hi = box.isEmpty() ? 100 : (box.max as any)[st.ax];
      const sl = h("input") as HTMLInputElement;
      sl.type = "range";
      sl.min = String(lo);
      sl.max = String(hi);
      sl.step = "0.5";
      sl.value = String(st.off);
      sl.style.width = "100%";
      sl.addEventListener("input", () => ((st.off = +sl.value), apply()));
      body.appendChild(group("Kesit düzlemi", segField([{ v: "x", t: "Sağ (YZ)" }, { v: "y", t: "Üst (XZ)" }, { v: "z", t: "Ön (XY)" }], st.ax, (v) => ((st.ax = v), (st.off = 0), render(), apply())), sl, numField("Öteleme", st.off, (v) => ((st.off = v), apply()), { unit: "mm" }), checkField("Tarafı çevir", st.flip, (v) => ((st.flip = v), apply()))));
    };
    render();
    apply();
  }

  // ---------- hareket etüdü (motor) ----------
  openMotion() {
    const st = { comp: this.sel, ent: null as MateEnt | null, kind: "rot", speed: 30, dur: 4, playing: false };
    const start = this.poses();
    let raf = 0;
    const stop = () => {
      st.playing = false;
      cancelAnimationFrame(raf);
    };
    const finish = () => {
      stop();
      this.picker = null;
      this.ctx.hidePM();
    };
    this.ctx.showPM("Hareket etüdü", finish, () => (finish(), this.restore(start), this.solve(), this.draw()));
    const body = document.getElementById("pm-body")!;
    const play = () => {
      const c = this.doc.comps.find((x) => x.id === st.comp);
      if (!c || !st.ent) return this.ctx.toast("Motor için bileşen ve yön (silindir / kenar / yüz) seçin", true);
      if (c.fixed) return this.ctx.toast("Sabit bileşen hareket ettirilemez", true);
      stop();
      st.playing = true;
      const t0 = performance.now();
      let last = t0;
      const step = (now: number) => {
        if (!st.playing) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const w = wEnt(st.ent!, c);
        if (st.kind === "rot") {
          // devir/dk → rad/s
          const ang = ((st.speed * 2 * Math.PI) / 60) * dt;
          const r = new THREE.Quaternion().setFromAxisAngle(w.N, ang);
          const q = r.multiply(QQ(c));
          this.solve({ drag: { comp: c.id, rot: [q.x, q.y, q.z, q.w] }, iters: 15 });
        } else {
          const lc = ((c as any)._lc as Vec3) ?? [0, 0, 0];
          const P = V3(lc).applyQuaternion(QQ(c)).add(V3(c.p)).addScaledVector(w.N, st.speed * dt);
          this.solve({ drag: { comp: c.id, local: lc, target: [P.x, P.y, P.z] }, iters: 15 });
        }
        this.draw();
        if ((now - t0) / 1000 < st.dur) raf = requestAnimationFrame(step);
        else st.playing = false;
      };
      raf = requestAnimationFrame(step);
    };
    const render = () => {
      body.innerHTML = "";
      const cn = this.doc.comps.find((x) => x.id === st.comp)?.name;
      body.appendChild(group("Motor", segField([{ v: "rot", t: "Döner motor" }, { v: "lin", t: "Doğrusal motor" }], st.kind, (v) => ((st.kind = v), render())), h("div", "pm-picks", `${cn ?? "Bileşen seçilmedi"} · ${st.ent ? st.ent.label ?? KIND_NAMES[st.ent.kind] : "yön: silindir / kenar / düz yüz seçin"}`), numField(st.kind === "rot" ? "Hız" : "Hız", st.speed, (v) => (st.speed = v), { unit: st.kind === "rot" ? "dev/dk" : "mm/s" }), numField("Süre", st.dur, (v) => (st.dur = Math.max(0.1, v)), { unit: "s" })));
      const row = h("div", "pm-row");
      row.append(button("▶ Oynat", play, "btn primary"), button("■ Durdur", stop), button("⟲ Başa al", () => (stop(), this.restore(start), this.solve(), this.draw())));
      body.appendChild(row);
      body.appendChild(h("p", "pm-hint", "Motor bileşeni seçilen eksen etrafında döndürür veya yön boyunca iter; eşleşmeler (dişli, menteşe, vida, kremayer…) diğer bileşenleri birlikte hareket ettirir."));
    };
    this.picker = (p) => {
      if (!p) return;
      st.comp = p.comp;
      if (p.ent) st.ent = p.ent.kind === "point" ? null : p.ent;
      render();
    };
    render();
  }

  // ---------- bağlantı elemanları (Toolbox) ----------
  openToolbox() {
    const st = { kind: "bolt" as FastenerKind, size: "M10", len: 30 };
    const done = () => (this.ctx.hidePM(), this.addComp(fastener(st.kind, st.size, st.len)));
    this.ctx.showPM("Bağlantı elemanı (Toolbox)", done, () => this.ctx.hidePM());
    const body = document.getElementById("pm-body")!;
    const render = () => {
      body.innerHTML = "";
      body.appendChild(
        group(
          "Eleman",
          selectField("Tür", (Object.keys(FASTENER_NAMES) as FastenerKind[]).map((k) => ({ v: k, t: FASTENER_NAMES[k] })), st.kind, (v) => ((st.kind = v), render())),
          selectField("Boyut", Object.keys(FASTENER_SIZES).map((k) => ({ v: k, t: k })), st.size, (v) => (st.size = v)),
          ...(st.kind === "bolt" ? [selectField("Boy", [8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 100].map((k) => ({ v: String(k), t: k + " mm" })), String(st.len), (v) => (st.len = +v))] : []),
        ),
      );
      body.appendChild(h("p", "pm-hint", "Eleman montaja eklenir; deliğe eş merkezli + yüzeye çakışık eşleştirin (Alt + sürükle ile SmartMate)."));
    };
    render();
  }
  // ---------- ağaç (SolidWorks FeatureManager: bileşenler + Eşleşmeler klasörü) ----------
  renderTree() {
    const ul = document.getElementById("tree")!;
    const acts = document.getElementById("tree-actions")!;
    (document.getElementById("part-name") as HTMLElement).textContent = this.doc.name + " (montaj)";
    ul.innerHTML = "";
    acts.innerHTML = "";
    const dof = dofAll(this.doc);
    const nm = (id: string) => this.doc.comps.find((c) => c.id === id)?.name ?? "Montaj";
    // ana düzlemler / orijin: eşleşme panelinde tıklanınca seçim olur (SolidWorks)
    const planeRows = (comp: string, cls: string) => {
      for (const [t, e] of this.planeEnts(comp)) {
        const li = h("li", cls, (e.kind === "point" ? "∘ " : "▱ ") + t);
        li.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (this.mateDraft) this.pickInto(e);
          else if (this.picker) this.picker({ comp, ent: e });
          else this.ctx.toast("Ana düzlemler eşleşme seçimi içindir: önce Eşleşme'yi açın");
        });
        ul.appendChild(li);
      }
    };
    if (this.mateDraft || this.picker) {
      ul.appendChild(h("li", "rollbar", "Montaj ana düzlemleri"));
      planeRows(ASM_ID, "child");
    }
    const subOf = (id: string) => (this.doc.subs ?? []).find((x) => x.comps.includes(id));
    const shownSub = new Set<string>();
    for (const c of this.doc.comps) {
      const sb = subOf(c.id);
      if (sb && !shownSub.has(sb.id)) {
        shownSub.add(sb.id);
        const li = h("li", "rollbar" + (this.selSub === sb.id ? " sel" : ""), `▣ ${sb.name} (${sb.rigid ? "rijit" : "esnek"} alt montaj)`);
        li.addEventListener("click", () => ((this.selSub = this.selSub === sb.id ? null : sb.id), (this.sel = null), (this.selMate = null), this.selSet = new Set(this.selSub ? sb.comps : []), this.draw(), this.renderTree()));
        ul.appendChild(li);
      }
      const f = dof.get(c.id) ?? 0;
      const li = h("li", (sb ? "child " : "") + (this.sel === c.id || this.selSet.has(c.id) ? "sel " : "") + (c.hidden ? "off" : ""));
      li.appendChild(h("span", "", `${c.fixed ? "(f) " : f > 0 ? "(-) " : ""}${c.name}`));
      li.title = c.fixed ? "Sabit" : f > 0 ? `${f} serbestlik derecesi kaldı` : "Tam tanımlı";
      li.addEventListener("click", (ev) => {
        if ((ev as MouseEvent).ctrlKey) this.selSet.has(c.id) ? this.selSet.delete(c.id) : this.selSet.add(c.id);
        else this.selSet = new Set([c.id]);
        this.sel = c.id;
        this.selMate = null;
        this.selSub = null;
        this.draw();
        this.renderTree();
      });
      ul.appendChild(li);
      if ((this.mateDraft || this.picker) && (this.sel === c.id || this.selSet.has(c.id) || this.doc.comps.length <= 3)) planeRows(c.id, "child");
    }
    if (this.doc.feats?.length) {
      ul.appendChild(h("li", "rollbar", "Montaj özellikleri"));
      for (const f of this.doc.feats) {
        const li = h("li", "child" + (f.off ? " off" : ""), `${f.type === "hole" ? "⊙" : "▭"} ${f.name} (${f.comps.length} bileşen)`);
        li.title = "Sağ tık / uzun bas: bastır veya sil";
        const act = async (k: "off" | "del") => {
          if (k === "del") this.doc.feats = this.doc.feats!.filter((x) => x !== f);
          else f.off = !f.off;
          this.save();
          await this.refresh();
          this.solve();
          this.draw();
          this.renderTree();
        };
        li.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          if (confirm(`${f.name}: ${f.off ? "Etkinleştir" : "Bastır"}? (İptal = silme seçeneği)`)) void act("off");
          else if (confirm(`${f.name} silinsin mi?`)) void act("del");
        });
        ul.appendChild(li);
      }
    }
    if (this.doc.mates.length) {
      ul.appendChild(h("li", "rollbar", `Eşleşmeler (${this.doc.mates.filter((m) => m.id !== "__draft").length})`));
      for (const m of this.doc.mates) {
        if (m.id === "__draft") continue;
        const val = m.v !== undefined ? ` ${m.v}${m.type === "angle" || m.type === "limitAngle" ? "°" : ""}${m.vmax !== undefined ? "…" + m.vmax : ""}` : "";
        const ents = [m.a, m.b, m.c, m.d].filter(Boolean).map((e) => nm(e!.comp));
        const li = h("li", "child" + (m.off ? " off" : "") + (this.bad.has(m.id) ? " err" : "") + (this.selMate === m.id ? " sel" : ""), `${this.bad.has(m.id) ? "⚠ " : ""}${MATE_NAMES[m.type]}${val} (${[...new Set(ents)].join(", ")})`);
        li.title = this.bad.has(m.id) ? "Bu eşleşme sağlanamıyor (aşırı tanım / çelişki)" : "Çift tık: düzenle";
        li.addEventListener("click", () => {
          this.selMate = this.selMate === m.id ? null : m.id;
          this.sel = null;
          this.selSet.clear();
          this.draw();
          this.renderTree();
        });
        li.addEventListener("dblclick", () => this.startMate(m));
        ul.appendChild(li);
      }
    }
    if ((this.doc.steps ?? []).length) {
      const li = h("li", "rollbar", `Patlatılmış görünüm (${this.doc.steps!.length} adım) · ${this.doc.exploded ? "patlatılmış" : "toplu"}`);
      li.addEventListener("dblclick", () => this.openExplode());
      ul.appendChild(li);
    }
    const add = (t: string, fn: () => void, cls = "btn") => acts.appendChild(button(t, fn, cls));
    const ss = (this.doc.subs ?? []).find((x) => x.id === this.selSub);
    if (ss) {
      add(ss.rigid ? "Esnek yap" : "Rijit yap", () => this.subAct(ss.id, "rigid"), "btn primary");
      add("Alt montajı dağıt", () => this.subAct(ss.id, "dissolve"));
      add("Alt montajı kaydet (.icasm)", () => this.subAct(ss.id, "save"));
      return;
    }
    if (this.selSet.size >= 2) add("Seçilenlerden alt montaj oluştur", () => this.formSub(), "btn primary");
    const sm = this.doc.mates.find((m) => m.id === this.selMate);
    if (sm) {
      add("Düzenle", () => this.startMate(sm), "btn primary");
      add(sm.off ? "Etkinleştir" : "Bastır", () => this.mateAct(sm, "off"));
      if (ALIGNABLE.has(sm.type)) add("Hizalamayı çevir", () => this.mateAct(sm, "flip"));
      add("Sil", () => this.mateAct(sm, "del"), "btn danger");
      return;
    }
    const c = this.comp();
    if (!c) return;
    add(c.fixed ? "Serbest bırak" : "Sabitle", () => ((c.fixed = !c.fixed), this.solve(), this.save(), this.draw(), this.renderTree()));
    add(c.hidden ? "Göster" : "Gizle", () => ((c.hidden = !c.hidden), this.save(), this.draw(), this.renderTree()));
    add(c.transparent ? "Opak" : "Saydam", () => ((c.transparent = !c.transparent || undefined), this.save(), this.draw(), this.renderTree()));
    add("Taşı", () => this.openMove());
    add("Döndür", () => this.openMove(true));
    add("Eşleşmelerini göster", () => {
      const ms = this.doc.mates.filter((m) => [m.a, m.b, m.c, m.d].some((e) => e?.comp === c.id));
      this.ctx.toast(ms.length ? ms.map((m) => MATE_NAMES[m.type]).join(", ") : "Bu bileşenin eşleşmesi yok");
    });
    add("Aynala", () => this.openMirror());
    add("Değiştir…", () => this.openAddDialog(c));
    add("Eşleşmeleriyle kopyala", () => this.copyWithMates(c));
    if (this.ctx.editPart) add("Parçayı düzenle", () => this.ctx.editPart!(c.part, (np) => this.replaceComp(c, np, true)));
    add("Kütüphaneden güncelle", () => {
      const p = loadLib()[c.part.name];
      if (!p) return this.ctx.toast("Kütüphanede bu adla parça yok", true);
      c.part = JSON.parse(JSON.stringify(p));
      this.meshes.delete(c.id);
      this.save();
      this.refresh();
    });
    add("Sil", () => {
      this.doc.comps = this.doc.comps.filter((x) => x !== c);
      this.doc.mates = this.doc.mates.filter((m) => ![m.a, m.b, m.c, m.d].some((e) => e?.comp === c.id));
      for (const sb of this.doc.subs ?? []) sb.comps = sb.comps.filter((x) => x !== c.id);
      this.doc.subs = (this.doc.subs ?? []).filter((sb) => sb.comps.length > 1);
      this.sel = null;
      this.selSet.clear();
      this.save();
      this.draw();
      this.renderTree();
    }, "btn danger");
  }

  // ---------- komutlar (SolidWorks Montaj sekmesi) ----------
  commands(): Cmd[] {
    if (!this.on)
      return [
        { id: "asmOpen", label: "Montajı Aç", icon: "file", run: () => this.enter() },
        { id: "libSave", label: "Kütüphaneye Kaydet", icon: "file", run: () => (saveToLib(this.ctx.currentPart()), this.ctx.toast(`"${this.ctx.currentPart().name}" kütüphaneye kaydedildi`)) },
      ];
    return [
      { id: "addComp", label: "Bileşen Ekle", icon: "extrude", run: () => this.openAddDialog() },
      { id: "mate", label: "Eşleşme", icon: "normal", run: () => this.startMate(), active: () => !!this.mateDraft },
      { id: "move", label: "Bileşeni Taşı", icon: "move", run: () => this.openMove() },
      { id: "rotate", label: "Bileşeni Döndür", icon: "revolve", run: () => this.openMove(true), active: () => this.dragMode === "rotate" },
      "sep",
      { id: "cpattern", label: "Bileşen Çoğalt", icon: "lpattern", run: () => this.openPattern() },
      { id: "cmirror", label: "Bileşen Aynala", icon: "mirror", run: () => this.openMirror() },
      { id: "asmCut", label: "Montaj Kesme / Delik", icon: "hole", run: () => this.openAsmCut() },
      { id: "collide", label: "Çarpışma Algıla", icon: "measure", run: () => ((this.collide = !this.collide), this.ctx.toast(this.collide ? "Sürüklerken çarpışma algılama açık" : "Çarpışma algılama kapalı")), active: () => this.collide },
      { id: "explodeView", label: "Patlatılmış Görünüm", icon: "lpattern", run: () => this.openExplode() },
      { id: "explode", label: this.doc.exploded ? "Daralt" : "Patlat", icon: "cpattern", run: () => this.toggleExplode(), active: () => !!this.doc.exploded },
      "sep",
      { id: "toolbox", label: "Bağlantı Elemanı", icon: "hole", run: () => this.openToolbox() },
      { id: "motion", label: "Hareket Etüdü", icon: "revolve", run: () => this.openMotion() },
      "sep",
      { id: "interf", label: "Girişim", icon: "interfere", run: () => this.interference() },
      { id: "clear", label: "Boşluk Doğrula", icon: "measure", run: () => this.clearance() },
      { id: "holeal", label: "Delik Hizalama", icon: "hole", run: () => this.showHoleAlignment() },
      { id: "asmdraw", label: "Montaj Resmi", icon: "dxf", run: () => void this.drawing() },
      { id: "asec", label: "Montaj Kesiti", icon: "section", run: () => this.openSection() },
      { id: "matex", label: "MateXpert", icon: "relations", run: () => this.mateXpert() },
      { id: "mass", label: "Kütle Özell.", icon: "mass", run: () => this.massProps() },
      { id: "bom", label: "Malzeme Listesi", icon: "cutlist", run: () => this.showBom() },
      { id: "step", label: "STEP (montaj)", icon: "file", run: () => this.exportStep() },
      "sep",
      {
        id: "rename",
        label: "Montaj Adı",
        icon: "rename",
        run: () => {
          const n = prompt("Montaj adı", this.doc.name)?.trim();
          if (n) (this.doc.name = n), this.save(), this.renderTree();
        },
      },
      { id: "saveAsm", label: "Montajı Kaydet", icon: "file", run: () => this.ctx.download(new Blob([JSON.stringify(this.doc, (k, v) => (k.startsWith("_") ? undefined : v))], { type: "application/json" }), `${this.doc.name}.icasm`) },
      {
        id: "openAsm",
        label: "Montaj Dosyası Aç",
        icon: "file",
        run: () => {
          const inp = document.createElement("input");
          inp.type = "file";
          inp.accept = ".icasm,.json";
          inp.onchange = async () => {
            const f = inp.files?.[0];
            if (!f) return;
            try {
              const d = JSON.parse(await f.text());
              if (d.kind !== "asm") throw 0;
              this.doc = d;
              this.exT = d.exploded ? 1 : 0;
              this.meshes.clear();
              this.save();
              await this.refresh();
              this.solve();
              this.renderTree();
            } catch {
              this.ctx.toast("Montaj dosyası okunamadı", true);
            }
          };
          inp.click();
        },
      },
      {
        id: "newAsm",
        label: "Yeni Montaj",
        icon: "file",
        run: () => {
          if (this.doc.comps.length && !confirm("Yeni montaj başlatılsın mı? (Mevcut montajı önce kaydedin)")) return;
          this.doc = newAsm();
          this.exT = 0;
          this.meshes.clear();
          this.save();
          this.draw();
          this.renderTree();
        },
      },
      { id: "leave", label: "Parçaya Dön", icon: "exitSketch", run: () => this.leave() },
    ];
  }
}

function hash(s: string) {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0;
  return x;
}
