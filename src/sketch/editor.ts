// Eskiz düzenleyici: SolidWorks mantığında çizim araçları, otomatik ilişkiler,
// akıllı ölçü, sürükleyerek düzenleme, kırpma, radyüs ve tanımlılık renkleri.
import * as THREE from "three";
import type { Frame, RelType, SArc, SCircle, SDim, SEnt, SLine, SketchData, Vec2, Vec3, SectionItem, SEllipse, SText } from "../doc/types";
import { ORIGIN } from "../doc/types";
import { evalNum, fmtNum, toLocal, toWorld, dot, sub } from "../doc/math";
import type { InputHandler, Viewer } from "../viewer";
import { solve, analyze, type SolveResult } from "./solver";
import { pictureMesh } from "./picture";
import { offsetEnts, mirrorEnts, linearPattern, circularPattern, moveEnts, centroid } from "./ops";
import {
  P, addArc, addCircle, addLine, addPointEnt, addPt, addRel, applicableRelations, arcAngles, cleanup, deleteIds,
  entPoints, getEnt, lineAngleSign, measure, nid, relationsOf, REL_GLYPH, REL_NAMES, usersOf, entSamples, ellipseGeo,
} from "./model";
import {
  add2, ang, arcMid, circle3, circleCircle, crs2, d2, dot2, inArc, len2, lineCircle, lineLine, mul2, nearestOnArc,
  nearestOnSeg, niceStep, norm2, normAng, perp, sub2, TAU,
} from "./geom";

export type SkTool =
  | "select" | "line" | "centerline" | "rect" | "crect" | "circle" | "carc" | "tarc" | "arc3"
  | "slot" | "polygon" | "point" | "fillet" | "trim" | "dim"
  | "rect3" | "para" | "circle3" | "schamfer" | "extend" | "convert"
  | "offset" | "mirror" | "spat" | "scpat" | "move"
  | "cslot" | "aslot" | "ellipse" | "pellipse" | "parabola" | "spline" | "text" | "isect" | "picture"
  | "mline" | "crect3" | "conic" | "eqcurve" | "split" | "jog" | "ordinate";

/** Seçim üzerinde çalışan işlem araçları */
export const OP_TOOLS: SkTool[] = ["offset", "mirror", "spat", "scpat", "move"];

export const TOOL_NAMES: Record<SkTool, string> = {
  select: "Seç",
  line: "Çizgi",
  centerline: "Merkez Çizgisi",
  rect: "Köşe Dikdörtgen",
  crect: "Merkez Dikdörtgen",
  circle: "Daire",
  carc: "Merkez Noktalı Yay",
  tarc: "Teğet Yay",
  arc3: "3 Noktalı Yay",
  slot: "Düz Kanal",
  polygon: "Çokgen",
  point: "Nokta",
  fillet: "Eskiz Radyüsü",
  trim: "Kırp",
  dim: "Akıllı Ölçü",
  rect3: "3 Noktalı Dikdörtgen",
  para: "Paralelkenar",
  circle3: "Çevre Dairesi",
  schamfer: "Eskiz Pahı",
  extend: "Uzat",
  convert: "Varlıkları Dönüştür",
  offset: "Varlıkları Ötele",
  mirror: "Varlıkları Aynala",
  spat: "Doğrusal Eskiz Çoğaltma",
  scpat: "Dairesel Eskiz Çoğaltma",
  move: "Taşı / Kopyala / Döndür / Ölçekle",
  cslot: "Merkez Noktalı Kanal",
  aslot: "Yay Kanal",
  picture: "Eskiz Resmi",
  mline: "Orta Nokta Çizgisi",
  crect3: "3N Merkez Dikdörtgen",
  conic: "Konik",
  eqcurve: "Denklem Eğrisi",
  split: "Ayır",
  jog: "Kademe Çizgisi",
  ordinate: "Koordinat Ölçüsü",
  ellipse: "Elips",
  pellipse: "Kısmi Elips",
  parabola: "Parabol",
  spline: "Spline",
  text: "Metin",
  isect: "Kesişim Eğrisi",
};

const HINTS: Partial<Record<SkTool, string>> = {
  mline: "Orta nokta → bir uç. Çizgi orta noktaya göre simetrik oluşur.",
  crect3: "Merkez → bir kenarın ortası (yön) → köşe.",
  conic: "Başlangıç → bitiş → teğetlerin kesişimi (tepe). Biçim rho ile ayarlanır.",
  eqcurve: "y = f(x) veya parametrik x(t), y(t) yazın; eğri spline olarak oluşturulur.",
  split: "Ayırmak istediğiniz yerde çizgiye / yaya dokunun. Daire için iki noktaya dokunun.",
  jog: "Çizgi üzerinde kademe başlangıcı → bitişi → kademe derinliği.",
  ordinate: "Önce sıfır noktasına (ör. orijin), sonra ölçülecek noktalara dokunun.",
  picture: "Resmi gerçek ölçüye getirmek için 'İki noktayla ölçekle'ye basın, resimde ölçüsünü bildiğiniz iki noktaya dokunun ve gerçek mesafeyi girin.",
  select: "Öğelere dokunarak seçin, sürükleyerek şekli değiştirin. Ölçüye dokunarak değerini değiştirin.",
  line: "Noktalara tıklayarak zincir çizin. İlk noktaya dönünce kapanır. Bitirmek için iki kez dokunun veya Bitir'e basın.",
  centerline: "Merkez çizgisi (yapı geometrisi): döndürme ekseni ve simetri için kullanılır.",
  rect: "İlk köşeye, sonra karşı köşeye dokunun.",
  crect: "Önce merkeze, sonra bir köşeye dokunun.",
  circle: "Önce merkeze, sonra çember üzerinde bir noktaya dokunun.",
  carc: "Merkez → başlangıç → bitiş noktası.",
  tarc: "Bir çizginin veya yayın uç noktasından başlayın, sonra bitiş noktasına dokunun.",
  arc3: "Başlangıç → bitiş → yay üzerindeki bir nokta.",
  slot: "Birinci merkez → ikinci merkez → genişlik.",
  polygon: "Merkeze, sonra bir köşeye dokunun. Kenar sayısını aşağıdan ayarlayın.",
  point: "Nokta koymak için dokunun.",
  fillet: "Yuvarlatılacak köşeye (iki çizginin birleştiği noktaya) dokunun.",
  trim: "Silinecek parçaya dokunun. Kesişimler arasındaki kısım silinir.",
  dim: "Bir veya iki öğe seçin, sonra ölçünün yerine dokunun ve değeri girin.",
  rect3: "İlk köşe → ikinci köşe (kenar yönü) → genişlik.",
  para: "Üç köşeye sırayla dokunun; dördüncü köşe otomatik bulunur.",
  circle3: "Çemberin geçeceği üç noktaya dokunun.",
  schamfer: "Pah kırılacak köşeye dokunun.",
  extend: "Uzatılacak çizginin ucuna yakın dokunun; en yakın öğeye kadar uzar.",
  convert: "Modelin bir kenarına dokunun; eskiz düzlemine izdüşürülüp eskize eklenir.",
  offset: "Ötelenecek çizgi/yay/daireleri seçin (dokunarak), mesafeyi girip Uygula'ya basın.",
  mirror: "Aynalanacak öğeleri ve ayna ekseni olacak merkez çizgisini seçin, sonra Uygula.",
  spat: "Çoğaltılacak öğeleri seçin, yön ve aralığı girip Uygula'ya basın.",
  scpat: "Çoğaltılacak öğeleri seçin. Merkez: seçili nokta veya orijin.",
  move: "Taşınacak öğeleri seçin, ötelemeyi / açıyı / ölçeği girip Uygula'ya basın.",
  cslot: "Kanal merkezi → bir uç merkezi → genişlik.",
  aslot: "Yay merkezi → başlangıç → bitiş → genişlik.",
  ellipse: "Merkez → büyük eksen ucu → küçük eksen.",
  pellipse: "Merkez → büyük eksen ucu → küçük eksen → başlangıç → bitiş.",
  parabola: "Başlangıç → bitiş → tepe noktası.",
  spline: "Noktalara dokunun; bitirmek için iki kez dokunun veya Bitir'e basın. İlk noktaya dönerseniz kapanır.",
  text: "Metni ve boyutu aşağıda yazın, sonra metnin konacağı yere dokunun.",
  isect: "Dokunduğunuzda eskiz düzleminin katıyla kesişimi eskize eklenir.",
};

const C = {
  under: 0x1c4fd8,
  full: 0x111418,
  over: 0xe03131,
  sel: 0x0ca5e9,
  hov: 0xf76707,
  prev: 0xf76707,
  dim: 0x495057,
  origin: 0xc92a2a,
};

type Hit = { kind: "pt" | "ent"; id: string; q: Vec2 };
interface Inference {
  p: Vec2;
  ptId?: string;
  on?: { id: string; t: "line" | "circle" | "arc" };
  mid?: string;
  hv?: "h" | "v";
  label?: string;
}

export interface EditorHost {
  viewer: Viewer;
  panel: HTMLElement;
  toast(msg: string, err?: boolean): void;
  status(text: string, kind: "ok" | "under" | "over"): void;
  changed(): void;
  /** eskiz düzleminin katıyla kesişimi */
  section?: (f: Frame) => Promise<SectionItem[]>;
}

export class SketchEditor implements InputHandler {
  tool: SkTool = "select";
  sel = new Set<string>();
  private hov: Hit | null = null;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private st: any = {};
  private group = new THREE.Group();
  private labelBox: HTMLDivElement;
  private anchors: { el: HTMLElement; w: Vec3; dx?: number; dy?: number }[] = [];
  private result: SolveResult = { ok: true, dof: 0, conflicts: [], redundant: [] };
  private defined = { pts: new Set<string>(), radii: new Set<string>() };
  private cursor: Vec2 | null = null;
  private press: { x: number; y: number; local: Vec2; hit: Hit | null; moved: boolean } | null = null;
  private lastClick = { t: 0, p: [0, 0] as Vec2 };
  private offRender: () => void;
  opts = {
    sides: 6, filletR: 5, chamferD: 3, showRels: true,
    offD: 5, offRev: false,
    n1: 3, s1: 20, a1: 0, n2: 1, s2: 20, a2: 90,
    cn: 6, ctotal: 360,
    mdx: 20, mdy: 0, mang: 0, mcopy: false, mscale: 1,
    text: "İMAJ", textSize: 10, textAngle: 0,
    rho: 0.6, ordDir: "h" as "h" | "v", arcLen: false, edgeDim: false,
    eqMode: "y" as "y" | "t", eqY: "20*sin(x*6)", eqX: "t", eqYt: "t*t/50", eqA: 0, eqB: 60, eqN: 24,
    quickDim: (() => {
      try {
        return localStorage.getItem("imajcad.quickDim") !== "0";
      } catch {
        return true;
      }
    })(),
  };

  constructor(private host: EditorHost, public frame: Frame, public data: SketchData) {
    host.viewer.overlay.add(this.group);
    this.labelBox = document.createElement("div");
    host.viewer.labels.appendChild(this.labelBox);
    this.offRender = host.viewer.onRender(() => this.placeLabels());
    this.resolve();
    this.render();
    this.renderPanel();
  }

  dispose() {
    this.clearGroup();
    this.host.viewer.overlay.remove(this.group);
    this.labelBox.remove();
    this.offRender();
    this.hideBadge();
  }

  // ---------------- Koordinatlar ----------------
  private wpp() {
    return this.host.viewer.worldPerPixel();
  }
  private local(e: { clientX: number; clientY: number }): Vec2 | null {
    const w = this.host.viewer.pickFrame(e.clientX, e.clientY, this.frame);
    return w ? toLocal(this.frame, [w.x, w.y, w.z]) : null;
  }
  private W(p: Vec2): Vec3 {
    return toWorld(this.frame, p);
  }
  private tolPx = 12;

  // ---------------- Geri al ----------------
  private snapshot() {
    this.undoStack.push(JSON.stringify(this.data));
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack.length = 0;
  }
  canUndo() {
    return this.undoStack.length > 0;
  }
  canRedo() {
    return this.redoStack.length > 0;
  }
  undo() {
    const s = this.undoStack.pop();
    if (!s) return;
    this.redoStack.push(JSON.stringify(this.data));
    this.setData(JSON.parse(s));
  }
  redo() {
    const s = this.redoStack.pop();
    if (!s) return;
    this.undoStack.push(JSON.stringify(this.data));
    this.setData(JSON.parse(s));
  }
  private setData(d: SketchData) {
    Object.assign(this.data, d);
    this.sel.clear();
    this.st = {};
    this.resolve();
    this.render();
    this.renderPanel();
    this.host.changed();
  }

  /** Bir işlemi uygula: başarısızsa geri al */
  private op(fn: () => void, failMsg = "Bu işlem eskizi çözülemez hale getiriyor (aşırı tanımlı)"): boolean {
    const before = JSON.stringify(this.data);
    this.snapshot();
    try {
      fn();
    } catch (e) {
      this.undoStack.pop();
      Object.assign(this.data, JSON.parse(before));
      this.host.toast((e as Error).message, true);
      this.render();
      return false;
    }
    cleanup(this.data);
    const r = solve(this.data);
    if (!r.ok || r.conflicts.length) {
      this.undoStack.pop();
      Object.assign(this.data, JSON.parse(before));
      this.resolve();
      this.render();
      if (failMsg) this.host.toast(failMsg, true);
      return false;
    }
    this.resolve();
    this.render();
    this.renderPanel();
    this.host.changed();
    return true;
  }

  /** Çöz ve tanımlılığı hesapla */
  resolve() {
    this.result = solve(this.data);
    this.defined = analyze(this.data, this.result.ok ? this.result.dof : 1);
    const r = this.result;
    if (!r.ok || r.conflicts.length) this.host.status("Aşırı tanımlı", "over");
    else if (r.dof === 0) this.host.status("Tam tanımlı", "ok");
    else this.host.status(`Tanımlanmamış · ${r.dof} serbestlik`, "under");
  }

  // ---------------- Araçlar ----------------
  setTool(t: SkTool) {
    this.finishChain();
    this.tool = t;
    this.st = {};
    if (t !== "select" && !OP_TOOLS.includes(t)) this.sel.clear();
    this.hideBadge();
    this.render();
    this.renderPanel();
  }

  /** Zinciri / yarım kalan çizimi bitir */
  finishChain() {
    const had = Object.keys(this.st).length > 0;
    this.st = {};
    if (had) {
      cleanup(this.data);
      this.resolve();
    }
    this.render();
    this.renderPanel();
  }

  // ---------------- Vuruş testi ve çıkarım ----------------
  private hitTest(p: Vec2, tolPx = this.tolPx, opts: { pts?: boolean; ents?: boolean; exclude?: Set<string> } = {}): Hit | null {
    const tol = tolPx * this.wpp();
    const sk = this.data;
    const ex = opts.exclude ?? new Set();
    if (opts.pts !== false) {
      let best: Hit | null = null;
      let bd = tol;
      for (const id of [ORIGIN, ...Object.keys(sk.pts)]) {
        if (ex.has(id)) continue;
        const q = P(sk, id);
        const d = d2(p, q);
        if (d < bd) {
          bd = d;
          best = { kind: "pt", id, q };
        }
      }
      if (best) return best;
    }
    if (opts.ents !== false) {
      let best: Hit | null = null;
      let bd = tol;
      for (const e of sk.ents) {
        if (ex.has(e.id)) continue;
        const r = this.nearestOnEnt(e, p);
        if (r && r.d < bd) {
          bd = r.d;
          best = { kind: "ent", id: e.id, q: r.q };
        }
      }
      return best;
    }
    return null;
  }

  private nearestOnEnt(e: SEnt, p: Vec2): { q: Vec2; d: number } | null {
    const sk = this.data;
    if (e.t === "line") {
      const r = nearestOnSeg(p, P(sk, e.p1), P(sk, e.p2));
      return { q: r.q, d: r.d };
    }
    if (e.t === "circle") {
      const c = P(sk, e.c);
      const u = norm2(sub2(p, c));
      const q = add2(c, mul2(u, e.r));
      return { q, d: d2(p, q) };
    }
    if (e.t === "arc") {
      const { c, s, e: en } = arcAngles(sk, e);
      return nearestOnArc(p, c, e.r, s, en);
    }
    if (e.t === "text") {
      const q = P(sk, e.p);
      const w = e.size * 0.6 * e.text.length;
      const a = (e.angle * Math.PI) / 180;
      const lx = (p[0] - q[0]) * Math.cos(a) + (p[1] - q[1]) * Math.sin(a);
      const ly = -(p[0] - q[0]) * Math.sin(a) + (p[1] - q[1]) * Math.cos(a);
      const inside = lx >= 0 && lx <= w && ly >= 0 && ly <= e.size;
      return { q, d: inside ? 0 : d2(p, q) };
    }
    const pts = entSamples(sk, e);
    let best: { q: Vec2; d: number } | null = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const r = nearestOnSeg(p, pts[i], pts[i + 1]);
      if (!best || r.d < best.d) best = { q: r.q, d: r.d };
    }
    return best;
  }

  private snapGrid(v: number) {
    const step = niceStep(this.wpp() * 2.5);
    return Math.round(v / step) * step;
  }

  /** SolidWorks benzeri otomatik ilişki çıkarımı */
  private infer(p: Vec2, from?: Vec2 | null, exclude: Set<string> = new Set()): Inference {
    const tol = this.tolPx * this.wpp();
    const sk = this.data;
    const h = this.hitTest(p, this.tolPx, { ents: false, exclude });
    if (h) return { p: h.q, ptId: h.id, label: h.id === ORIGIN ? "Orijin" : "Çakışık" };
    // çizgi orta noktası
    for (const e of sk.ents) {
      if (e.t !== "line" || exclude.has(e.id)) continue;
      const m = mul2(add2(P(sk, e.p1), P(sk, e.p2)), 0.5);
      if (d2(m, p) < tol * 0.8) return { p: m, mid: e.id, label: "Orta nokta" };
    }
    const he = this.hitTest(p, this.tolPx * 0.8, { pts: false, exclude });
    if (he) {
      const e = getEnt(sk, he.id)!;
      const t = e.t === "line" ? "line" : e.t === "circle" ? "circle" : e.t === "arc" ? "arc" : null;
      if (t) {
        let q = he.q;
        let hv: "h" | "v" | undefined;
        // eğri üzerinde + yatay/dikey hizalama
        if (from && t === "line") {
          const l = e as SLine;
          const A = P(sk, l.p1), B = P(sk, l.p2);
          if (Math.abs(q[1] - from[1]) < tol * 0.7) {
            const x = lineLine(A, B, from, [from[0] + 1, from[1]]);
            if (x && x.ta >= 0 && x.ta <= 1) [q, hv] = [x.p, "h"];
          } else if (Math.abs(q[0] - from[0]) < tol * 0.7) {
            const x = lineLine(A, B, from, [from[0], from[1] + 1]);
            if (x && x.ta >= 0 && x.ta <= 1) [q, hv] = [x.p, "v"];
          }
        }
        return { p: q, on: { id: e.id, t }, hv, label: "Üzerinde" + (hv ? (hv === "h" ? " · Yatay" : " · Dikey") : "") };
      }
    }
    let q: Vec2 = [this.snapGrid(p[0]), this.snapGrid(p[1])];
    let hv: "h" | "v" | undefined;
    if (from) {
      if (Math.abs(p[1] - from[1]) < tol * 0.7) {
        q = [q[0], from[1]];
        hv = "h";
      } else if (Math.abs(p[0] - from[0]) < tol * 0.7) {
        q = [from[0], q[1]];
        hv = "v";
      }
    }
    // diğer noktalarla yatay/dikey hizalama (ilişki eklemeden)
    if (!hv) {
      for (const id of [ORIGIN, ...Object.keys(sk.pts)]) {
        if (exclude.has(id)) continue;
        const o = P(sk, id);
        if (Math.abs(p[0] - o[0]) < tol * 0.5) q = [o[0], q[1]];
        if (Math.abs(p[1] - o[1]) < tol * 0.5) q = [q[0], o[1]];
      }
    }
    return { p: q, hv, label: hv === "h" ? "Yatay" : hv === "v" ? "Dikey" : undefined };
  }

  /** Çıkarımdan nokta oluştur (veya var olanı kullan) */
  private makePoint(inf: Inference): string {
    if (inf.ptId) return inf.ptId;
    const id = addPt(this.data, inf.p);
    if (inf.on) addRel(this.data, inf.on.t === "line" ? "onLine" : "onCircle", [id, inf.on.id]);
    if (inf.mid) addRel(this.data, "midpoint", [id, inf.mid]);
    return id;
  }

  // ---------------- Giriş ----------------
  down = (e: PointerEvent) => {
    const p = this.local(e);
    if (!p) return;
    this.tolPx = e.pointerType === "touch" ? 20 : e.pointerType === "pen" ? 12 : 10;
    this.press = { x: e.clientX, y: e.clientY, local: p, hit: this.hitTest(p), moved: false };
  };
  move = (e: PointerEvent) => {
    const p = this.local(e);
    if (!p || !this.press) return;
    if (!this.press.moved && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 7) {
      this.press.moved = true;
      if (this.tool === "select") this.beginDrag(this.press.local, this.press.hit);
      else if (this.dragCreates()) this.click(this.press.local, e);
    }
    if (this.press.moved) {
      if (this.tool === "select") this.dragTo(p);
      else this.preview(p, e);
    }
  };
  up = (e: PointerEvent) => {
    const p = this.local(e);
    const d = this.press;
    this.press = null;
    if (!p || !d) return;
    if (this.tool === "select" && d.moved) return this.endDrag();
    if (d.moved && !this.dragCreates()) return;
    this.click(p, e);
  };
  hover = (e: PointerEvent) => {
    const p = this.local(e);
    if (!p) return;
    this.tolPx = e.pointerType === "pen" ? 12 : 10;
    this.preview(p, e);
  };
  tap = (e: PointerEvent) => {
    const p = this.local(e);
    if (!p) return;
    this.tolPx = 20;
    this.preview(p, e);
    this.click(p, e);
  };

  private dragCreates() {
    return ["line", "centerline", "rect", "crect", "circle", "polygon"].includes(this.tool) && !this.chainActive();
  }
  private chainActive() {
    return !!(this.st.last || this.st.aPos || this.st.infs?.length);
  }

  // ---------------- Önizleme ----------------
  private preview(p: Vec2, e: { clientX: number; clientY: number }) {
    this.cursor = p;
    const t = this.tool;
    if (t === "select" || t === "trim" || t === "fillet" || t === "schamfer" || t === "extend" || OP_TOOLS.includes(t)) {
      const h = this.hitTest(p, this.tolPx, t === "fillet" || t === "schamfer" ? { ents: false } : t === "trim" || t === "extend" ? { pts: false } : {});
      if (h?.id !== this.hov?.id) {
        this.hov = h;
        this.render();
      }
      return;
    }
    if (t === "convert") {
      const hit = this.host.viewer.pick(e.clientX, e.clientY, { edge: true });
      this.host.viewer.setHighlight({ faces: [], edges: [], planes: [] }, hit);
      return;
    }
    if (t === "dim") {
      const h = this.hitTest(p);
      this.hov = h;
      this.render();
      return;
    }
    const from = this.st.lastPos ?? this.st.aPos ?? null;
    const inf = this.infer(p, t === "line" || t === "centerline" ? from : null);
    this.st.inf = inf;
    this.render();
    const text = this.liveText(inf.p);
    if (inf.label || text) this.showBadge(e.clientX, e.clientY, [inf.label, text].filter(Boolean).join("  "));
    else this.hideBadge();
  }

  private liveText(p: Vec2): string {
    const st = this.st;
    const f = (v: number) => fmtNum(v, 1);
    switch (this.tool) {
      case "line":
      case "centerline":
        return st.lastPos ? `L ${f(d2(st.lastPos, p))}` : "";
      case "rect":
        return st.aPos ? `${f(Math.abs(p[0] - st.aPos[0]))} × ${f(Math.abs(p[1] - st.aPos[1]))}` : "";
      case "crect":
        return st.aPos ? `${f(2 * Math.abs(p[0] - st.aPos[0]))} × ${f(2 * Math.abs(p[1] - st.aPos[1]))}` : "";
      case "circle":
      case "polygon":
        return st.aPos ? `R ${f(d2(st.aPos, p))}` : "";
      case "carc":
        return st.aPos ? `R ${f(d2(st.aPos, st.bPos ?? p))}` : "";
      case "rect3":
      case "para":
        return st.aPos && !st.bPos ? `L ${f(d2(st.aPos, p))}` : st.bPos ? `L ${f(d2(st.bPos, p))}` : "";
      default:
        return "";
    }
  }

  private badge: HTMLDivElement | null = null;
  private showBadge(x: number, y: number, text: string) {
    if (!this.badge) {
      this.badge = document.createElement("div");
      this.badge.className = "sk-badge";
      document.body.appendChild(this.badge);
    }
    this.badge.textContent = text;
    this.badge.style.display = "block";
    this.badge.style.left = x + 16 + "px";
    this.badge.style.top = y - 34 + "px";
  }
  private hideBadge() {
    if (this.badge) this.badge.style.display = "none";
  }

  // ---------------- Tıklama (araç mantığı) ----------------
  /** Çizim tıklaması: yeni oluşan varlıklar için dinamik ayna ve hızlı ölçü */
  private click(p: Vec2, e: { clientX: number; clientY: number; pointerType?: string }) {
    const before = new Set(this.data.ents.map((x) => x.id));
    const tool = this.tool;
    this.clickInner(p, e);
    if (["select", "dim", "trim", "extend", "fillet", "schamfer", "convert", "isect", "ordinate", "split", "jog"].includes(tool) || OP_TOOLS.includes(tool)) return;
    const created = this.data.ents.filter((x) => !before.has(x.id));
    if (!created.length) return;
    if (this.dynAxis && getEnt(this.data, this.dynAxis)) {
      const ax = getEnt(this.data, this.dynAxis) as SLine;
      const src = created.filter((x) => x.id !== ax.id);
      if (src.length && this.op(() => mirrorEnts(this.data, src, ax), "Dinamik ayna uygulanamadı")) this.host.changed();
    }
    if (this.opts.quickDim) this.quickDims(created, e);
  }

  /** Dinamik ayna ekseni (merkez çizgisi) */
  dynAxis: string | null = null;

  /** Çizimden hemen sonra ölçü girişi (SolidWorks'teki sayısal giriş gibi) */
  private quickDims(created: SEnt[], e: { clientX: number; clientY: number; pointerType?: string }) {
    const sk = this.data;
    const real = created.filter((x) => !x.cons);
    const lines = real.filter((x) => x.t === "line") as SLine[];
    const arcs = real.filter((x) => x.t === "arc") as SArc[];
    const circles = created.filter((x) => x.t === "circle") as SCircle[];
    type F = { label: string; cur: number; make: (v: number) => Omit<SDim, "id"> };
    const fields: F[] = [];
    const len = (l: SLine) => d2(P(sk, l.p1), P(sk, l.p2));
    const mid = (l: SLine): Vec2 => {
      const a = P(sk, l.p1), b = P(sk, l.p2);
      return [(a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.15, (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.15];
    };
    const lenF = (label: string, l: SLine): F => ({ label, cur: len(l), make: (v) => ({ t: "dist", refs: [l.p1, l.p2], sub: "a", v, lp: mid(l) }) });
    if (lines.length === 1 && !arcs.length && !circles.length) fields.push(lenF("Uzunluk", lines[0]));
    else if (lines.length === 4 && !arcs.length) {
      const dx = (l: SLine) => Math.abs(P(sk, l.p2)[0] - P(sk, l.p1)[0]), dy = (l: SLine) => Math.abs(P(sk, l.p2)[1] - P(sk, l.p1)[1]);
      const w = [...lines].sort((a, b) => dx(b) - dx(a))[0], hh = [...lines].sort((a, b) => dy(b) - dy(a))[0];
      fields.push(lenF("Genişlik", w), lenF("Yükseklik", hh));
    } else if (circles.length === 1 && !lines.length) {
      const c = circles[0];
      fields.push({ label: c.cons ? "Çevre dairesi çapı" : "Çap", cur: 2 * c.r, make: (v) => ({ t: "dia", refs: [c.id], v, lp: add2(P(sk, c.c), [c.r * 0.8, c.r * 0.8]) }) });
    } else if (arcs.length === 1 && lines.length <= 1 && !circles.length) {
      const a = arcs[0];
      fields.push({ label: "Yarıçap", cur: a.r, make: (v) => ({ t: "rad", refs: [a.id], v, lp: add2(P(sk, a.c), [a.r * 0.7, a.r * 0.7]) }) });
    } else if (arcs.length === 2 && lines.length === 2) {
      const a = arcs[0], b = arcs[1];
      fields.push({ label: "Kanal genişliği", cur: 2 * a.r, make: (v) => ({ t: "dia", refs: [a.id], v, lp: add2(P(sk, a.c), [a.r, a.r]) }) });
      if (a.c !== b.c) fields.push({ label: "Merkezler arası", cur: d2(P(sk, a.c), P(sk, b.c)), make: (v) => ({ t: "dist", refs: [a.c, b.c], sub: "a", v, lp: add2(P(sk, a.c), [0, a.r * 1.6]) }) });
    } else if (circles.length === 1 && circles[0].cons && lines.length >= 3) {
      const c = circles[0];
      fields.push({ label: "Çevre dairesi çapı", cur: 2 * c.r, make: (v) => ({ t: "dia", refs: [c.id], v, lp: add2(P(sk, c.c), [c.r, c.r]) }) });
    }
    document.querySelector(".dim-prompt.quick")?.remove();
    if (!fields.length) return;
    const box = document.createElement("div");
    box.className = "dim-prompt quick";
    const inputs: HTMLInputElement[] = [];
    const edited = fields.map(() => false);
    fields.forEach((f, i) => {
      const row = document.createElement("label");
      row.textContent = f.label;
      const inp = document.createElement("input");
      inp.setAttribute("inputmode", "decimal");
      inp.autocomplete = "off";
      inp.value = fmtNum(f.cur, 2);
      inp.addEventListener("input", () => (edited[i] = true));
      inp.addEventListener("focus", () => inp.select());
      inp.addEventListener("keydown", (ev) => {
        ev.stopPropagation();
        if (ev.key === "Enter") apply();
        if (ev.key === "Escape") box.remove();
        if (ev.key === "Tab" && i === fields.length - 1) {
          ev.preventDefault();
          inputs[0].focus();
        }
      });
      row.appendChild(inp);
      inputs.push(inp);
      box.appendChild(row);
    });
    const ok = document.createElement("button");
    ok.className = "ok";
    ok.textContent = "✓";
    const no = document.createElement("button");
    no.className = "no";
    no.textContent = "✕";
    box.append(ok, no);
    const apply = () => {
      let any = false;
      for (let i = 0; i < fields.length; i++) {
        if (!edited[i]) continue;
        const raw = inputs[i].value.trim();
        const v = evalNum(raw);
        if (v === null || v <= 0) {
          inputs[i].classList.add("bad");
          return;
        }
        const d: SDim = { id: nid(this.data, "d"), ...fields[i].make(v) } as SDim;
        if (/[a-zA-ZçğıöşüÇĞİÖŞÜ_]/.test(raw.replace(/^=/, ""))) d.expr = raw.replace(/^=/, "");
        if (this.op(() => this.data.dims.push(d), "")) any = true;
        else this.host.toast(`${fields[i].label}: eskizi aşırı tanımlıyor, eklenmedi`, true);
      }
      box.remove();
      if (any) {
        // zincir çizimi güncel uçtan devam etsin
        if (this.st.last) this.st.lastPos = P(this.data, this.st.last);
        this.host.changed();
      }
    };
    ok.addEventListener("click", apply);
    no.addEventListener("click", () => box.remove());
    box.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    document.body.appendChild(box);
    const r = box.getBoundingClientRect();
    box.style.left = Math.max(8, Math.min(window.innerWidth - r.width - 8, e.clientX + 18)) + "px";
    box.style.top = Math.max(8, Math.min(window.innerHeight - r.height - 8, e.clientY + 18)) + "px";
    if (e.pointerType === "mouse") inputs[0].focus();
  }

  /** 3 noktalı merkez dikdörtgen köşeleri: merkez, kenar ortası, köşe yönü */
  private crect3Pts(c: Vec2, m: Vec2, p: Vec2): Vec2[] | null {
    const a = d2(c, m);
    if (a < 1e-9) return null;
    const u = norm2(sub2(m, c)), v = perp(u);
    const hh = dot2(sub2(p, c), v);
    if (Math.abs(hh) < 1e-9) return null;
    return [add2(add2(c, mul2(u, a)), mul2(v, -hh)), add2(add2(c, mul2(u, a)), mul2(v, hh)), add2(add2(c, mul2(u, -a)), mul2(v, hh)), add2(add2(c, mul2(u, -a)), mul2(v, -hh))];
  }

  /** Denklem eğrisi: spline noktaları hesaplanır ve sabitlenir */
  createEquationCurve() {
    const o = this.opts;
    const n = Math.max(4, Math.min(200, Math.round(o.eqN)));
    const pts: Vec2[] = [];
    for (let i = 0; i <= n; i++) {
      const t = o.eqA + ((o.eqB - o.eqA) * i) / n;
      const vars = (name: string) => (name === "x" || name === "t" ? t : undefined);
      const x = o.eqMode === "y" ? t : evalNum(o.eqX, vars);
      const y = evalNum(o.eqMode === "y" ? o.eqY : o.eqYt, vars);
      if (x === null || y === null || !isFinite(x) || !isFinite(y)) return this.host.toast(`İfade hesaplanamadı (t=${fmtNum(t, 3)})`, true);
      pts.push([x, y]);
    }
    const sk = this.data;
    const ok = this.op(() => {
      const ids = pts.map((q) => addPt(sk, q));
      sk.ents.push({ id: nid(sk, "s"), t: "spline", pts: ids, eq: true } as any);
      ids.forEach((id) => addRel(sk, "fix", [id], { fx: sk.pts[id].x, fy: sk.pts[id].y }));
    });
    if (ok) {
      this.host.changed();
      this.host.toast(`Denklem eğrisi oluşturuldu (${pts.length} nokta)`);
    }
  }

  /** Eskize resim yerleştir (genişlik varsayılan 200 mm, orijin merkezli) */
  setPicture(src: string, aspect: number) {
    this.op(() => (this.data.pic = { src, aspect, x: 0, y: 0, w: 200, rot: 0, op: 0.6 }));
    this.setTool("picture");
    this.host.changed();
  }

  private clickInner(p: Vec2, e: { clientX: number; clientY: number }) {
    const now = performance.now();
    const dbl = now - this.lastClick.t < 400 && d2(p, this.lastClick.p) < this.tolPx * this.wpp();
    this.lastClick = { t: now, p };
    const st = this.st;
    const sk = this.data;
    switch (this.tool) {
      case "mline": {
        if (!st.aPos) {
          st.ainf = this.infer(p);
          st.aPos = st.ainf.p;
          return this.render();
        }
        const inf = this.infer(p, st.aPos);
        if (d2(inf.p, st.aPos) < 1e-9) return;
        const m = st.aPos as Vec2;
        const ainf = st.ainf as Inference;
        this.op(() => {
          const mp = this.makePoint(ainf);
          const b = this.makePoint(inf);
          const a = addPt(sk, [2 * m[0] - inf.p[0], 2 * m[1] - inf.p[1]]);
          const l = addLine(sk, a, b);
          addRel(sk, "midpoint", [mp, l.id]);
          if (inf.hv) addRel(sk, inf.hv === "h" ? "horizontal" : "vertical", [l.id]);
        });
        this.st = {};
        return this.render();
      }
      case "crect3": {
        if (!st.aPos) {
          st.ainf = this.infer(p);
          st.aPos = st.ainf.p;
          return this.render();
        }
        if (!st.bPos) {
          st.bPos = this.infer(p, st.aPos).p;
          if (d2(st.aPos, st.bPos) < 1e-9) st.bPos = null;
          return this.render();
        }
        const q = this.crect3Pts(st.aPos, st.bPos, this.infer(p).p);
        if (!q) return;
        const ainf = st.ainf as Inference;
        this.op(() => {
          const ids = q.map((x) => addPt(sk, x));
          const ls = ids.map((id, i) => addLine(sk, id, ids[(i + 1) % 4]));
          addRel(sk, "perpendicular", [ls[0].id, ls[1].id]);
          addRel(sk, "parallel", [ls[0].id, ls[2].id]);
          addRel(sk, "parallel", [ls[1].id, ls[3].id]);
          const m = this.makePoint(ainf);
          const d1 = addLine(sk, ids[0], ids[2], true), d2l = addLine(sk, ids[1], ids[3], true);
          addRel(sk, "midpoint", [m, d1.id]);
          addRel(sk, "midpoint", [m, d2l.id]);
        });
        this.st = {};
        return this.render();
      }
      case "conic": {
        st.infs = st.infs ?? [];
        st.infs.push(this.infer(p));
        if (st.infs.length === 1) st.aPos = st.infs[0].p;
        if (st.infs.length === 2) st.bPos = st.infs[1].p;
        if (st.infs.length < 3) return this.render();
        const [si, ei, ki] = st.infs as Inference[];
        this.st = {};
        const rho = Math.max(0.05, Math.min(0.95, this.opts.rho));
        this.op(() => {
          const s0 = this.makePoint(si), e0 = this.makePoint(ei);
          sk.ents.push({ id: nid(sk, "q"), t: "parabola", s: s0, e: e0, k: addPt(sk, ki.p), rho });
        });
        return this.render();
      }
      case "split": {
        const h = this.hitTest(p, this.tolPx, { ents: true, pts: false });
        const e = h ? getEnt(sk, h.id) : null;
        if (!e || (e.t !== "line" && e.t !== "arc" && e.t !== "circle")) return this.host.toast("Ayırmak için bir çizgiye, yaya veya daireye dokunun");
        const q = this.nearestOnEnt(e, p)!.q;
        if (e.t === "circle") {
          if (!st.splitC || st.splitC.id !== e.id) {
            st.splitC = { id: e.id, q };
            return this.host.toast("Dairenin ikinci ayırma noktasına dokunun");
          }
          const q1 = st.splitC.q as Vec2;
          this.st = {};
          this.op(() => {
            const a = addPt(sk, q1), b = addPt(sk, q);
            const a1 = addArc(sk, e.c, a, b, e.cons), a2 = addArc(sk, e.c, b, a, e.cons);
            a1.r = a2.r = e.r;
            deleteIds(sk, [e.id]);
          });
          return this.render();
        }
        this.op(() => {
          const n = addPt(sk, q);
          if (e.t === "line") {
            const old2 = e.p2;
            e.p2 = n;
            addLine(sk, n, old2, e.cons);
            addRel(sk, "collinear", [e.id, sk.ents[sk.ents.length - 1].id]);
          } else {
            const old = e.e;
            e.e = n;
            const a2 = addArc(sk, e.c, n, old, e.cons);
            a2.r = e.r;
          }
        });
        return this.render();
      }
      case "jog": {
        if (!st.jog) {
          const h = this.hitTest(p, this.tolPx, { ents: true, pts: false });
          const e = h ? getEnt(sk, h.id) : null;
          if (!e || e.t !== "line") return this.host.toast("Kademe için bir çizgiye dokunun");
          st.jog = { id: e.id, a: this.nearestOnEnt(e, p)!.q };
          st.aPos = st.jog.a;
          return this.render();
        }
        const e = getEnt(sk, st.jog.id) as SLine;
        if (!st.jog.b) {
          st.jog.b = this.nearestOnEnt(e, p)!.q;
          st.bPos = st.jog.b;
          return this.render();
        }
        const A0 = P(sk, e.p1), B0 = P(sk, e.p2);
        const u = norm2(sub2(B0, A0));
        let qa: Vec2 = st.jog.a, qb: Vec2 = st.jog.b;
        if (dot2(sub2(qb, qa), u) < 0) [qa, qb] = [qb, qa];
        const n = perp(u);
        const depth = dot2(sub2(p, qa), n);
        if (Math.abs(depth) < 1e-6 || d2(qa, qb) < 1e-6) return;
        this.st = {};
        this.op(() => {
          const pa = addPt(sk, qa), pb = addPt(sk, qb);
          const pa2 = addPt(sk, add2(qa, mul2(n, depth))), pb2 = addPt(sk, add2(qb, mul2(n, depth)));
          const old2 = e.p2;
          e.p2 = pa;
          const l1 = addLine(sk, pa, pa2), l2 = addLine(sk, pa2, pb2), l3 = addLine(sk, pb2, pb), l4 = addLine(sk, pb, old2);
          addRel(sk, "perpendicular", [e.id, l1.id]);
          addRel(sk, "parallel", [e.id, l2.id]);
          addRel(sk, "parallel", [l1.id, l3.id]);
          addRel(sk, "collinear", [e.id, l4.id]);
        });
        return this.render();
      }
      case "ordinate": {
        const h = this.hitTest(p, this.tolPx, { pts: true, ents: false });
        const pid = h?.id;
        if (!pid || (!sk.pts[pid] && pid !== ORIGIN)) return this.host.toast("Bir noktaya dokunun");
        if (!st.base) {
          st.base = pid;
          return this.host.toast("Sıfır noktası seçildi; ölçülecek noktalara dokunun");
        }
        if (pid === st.base) return;
        const A = P(sk, st.base), B = P(sk, pid);
        const sub: "h" | "v" = this.opts.ordDir;
        const v = sub === "h" ? B[0] - A[0] : B[1] - A[1];
        const lp: Vec2 = sub === "h" ? [B[0], Math.max(A[1], B[1]) + 8 * this.wpp() * 3] : [Math.max(A[0], B[0]) + 8 * this.wpp() * 3, B[1]];
        const dd: SDim = { id: nid(sk, "d"), t: "dist", refs: [st.base, pid], sub, v, lp };
        if (!this.op(() => sk.dims.push(dd), "")) {
          this.op(() => sk.dims.push({ ...dd, id: nid(sk, "d"), ref: true }));
          this.host.toast("Aşırı tanımlayacağı için referans ölçü olarak eklendi");
        }
        this.host.changed();
        return this.render();
      }
      case "picture": {
        if (!st.cal || !sk.pic) return;
        st.calPts = [...(st.calPts ?? []), p];
        this.render();
        if (st.calPts.length < 2) return this.host.toast("İkinci noktaya dokunun");
        const [a, b] = st.calPts as Vec2[];
        const meas = d2(a, b);
        this.st = {};
        if (meas < 1e-6) return;
        this.promptValue(e.clientX, e.clientY, meas, "mm", (real) => {
          if (real <= 0) return;
          const k = real / meas;
          this.op(() => {
            const pc = this.data.pic!;
            pc.w *= k;
            pc.x = a[0] + (pc.x - a[0]) * k;
            pc.y = a[1] + (pc.y - a[1]) * k;
          });
          this.host.changed();
          this.renderPanel();
          this.host.toast(`Resim ölçeklendi (×${fmtNum(k, 3)})`);
        });
        return;
      }
      case "select":
        return this.selectClick(p);
      case "line":
      case "centerline": {
        const cons = this.tool === "centerline";
        if (!st.last) {
          const inf = this.infer(p, null);
          this.snapshot();
          st.last = this.makePoint(inf);
          st.first = st.last;
          st.lastPos = P(sk, st.last);
          st.count = 0;
          this.undoStack.pop(); // nokta ekleme tek başına bir adım değil
          this.render();
          return;
        }
        if (dbl) return this.finishChain();
        const inf = this.infer(p, st.lastPos);
        if (d2(inf.p, st.lastPos) < 1e-9) return;
        const prev = st.last;
        let closed = false;
        this.op(() => {
          const b = this.makePoint(inf);
          const l = addLine(sk, prev, b, cons);
          if (inf.hv) addRel(sk, inf.hv === "h" ? "horizontal" : "vertical", [l.id]);
          st.last = b;
          st.count++;
          closed = !!inf.ptId;
        });
        if (closed || cons) this.finishChain();
        else st.lastPos = P(sk, st.last);
        return this.renderPanel();
      }
      case "rect":
      case "crect": {
        if (!st.aPos) {
          st.ainf = this.infer(p);
          st.aPos = st.ainf.p;
          return this.render();
        }
        const inf = this.infer(p);
        const a: Vec2 = st.aPos;
        const b: Vec2 = inf.p;
        if (Math.abs(b[0] - a[0]) < 1e-9 || Math.abs(b[1] - a[1]) < 1e-9) return;
        const ainf = st.ainf as Inference;
        this.op(() => {
          if (this.tool === "rect") {
            const p1 = this.makePoint(ainf);
            const p3 = this.makePoint(inf);
            const p2 = addPt(sk, [b[0], a[1]]);
            const p4 = addPt(sk, [a[0], b[1]]);
            const l1 = addLine(sk, p1, p2), l2 = addLine(sk, p2, p3), l3 = addLine(sk, p3, p4), l4 = addLine(sk, p4, p1);
            addRel(sk, "horizontal", [l1.id]);
            addRel(sk, "horizontal", [l3.id]);
            addRel(sk, "vertical", [l2.id]);
            addRel(sk, "vertical", [l4.id]);
          } else {
            const m = this.makePoint(ainf);
            const dx = b[0] - a[0], dy = b[1] - a[1];
            const q1 = addPt(sk, [a[0] - dx, a[1] - dy]);
            const q2 = addPt(sk, [a[0] + dx, a[1] - dy]);
            const q3 = inf.ptId ? inf.ptId : addPt(sk, b);
            const q4 = addPt(sk, [a[0] - dx, a[1] + dy]);
            const l1 = addLine(sk, q1, q2), l2 = addLine(sk, q2, q3), l3 = addLine(sk, q3, q4), l4 = addLine(sk, q4, q1);
            addRel(sk, "horizontal", [l1.id]);
            addRel(sk, "horizontal", [l3.id]);
            addRel(sk, "vertical", [l2.id]);
            addRel(sk, "vertical", [l4.id]);
            const d1 = addLine(sk, q1, q3, true), dd = addLine(sk, q2, q4, true);
            addRel(sk, "midpoint", [m, d1.id]);
            addRel(sk, "midpoint", [m, dd.id]);
          }
        });
        this.st = {};
        return this.render();
      }
      case "circle":
      case "polygon": {
        if (!st.aPos) {
          st.ainf = this.infer(p);
          st.aPos = st.ainf.p;
          return this.render();
        }
        const inf = this.infer(p);
        const r = d2(st.aPos, inf.p);
        if (r < 1e-6) return;
        const ainf = st.ainf as Inference;
        this.op(() => {
          const c = this.makePoint(ainf);
          if (this.tool === "circle") {
            const ci = addCircle(sk, c, r);
            if (inf.ptId) addRel(sk, "onCircle", [inf.ptId, ci.id]);
          } else {
            const n = Math.max(3, Math.min(64, Math.round(this.opts.sides)));
            const cc = addCircle(sk, c, r, true);
            const a0 = ang(st.aPos, inf.p);
            const ids: string[] = [];
            for (let i = 0; i < n; i++) {
              const a = a0 + (i / n) * TAU;
              ids.push(i === 0 && inf.ptId ? inf.ptId : addPt(sk, [st.aPos[0] + r * Math.cos(a), st.aPos[1] + r * Math.sin(a)]));
            }
            const lines = ids.map((id, i) => addLine(sk, id, ids[(i + 1) % n]));
            ids.forEach((id) => addRel(sk, "onCircle", [id, cc.id]));
            for (let i = 1; i < n; i++) addRel(sk, "equal", [lines[0].id, lines[i].id]);
          }
        });
        this.st = {};
        return this.render();
      }
      case "carc": {
        if (!st.aPos) {
          st.ainf = this.infer(p);
          st.aPos = st.ainf.p;
          return this.render();
        }
        if (!st.bPos) {
          st.binf = this.infer(p);
          st.bPos = st.binf.p;
          st.sweep = 0;
          st.lastAng = ang(st.aPos, st.bPos);
          return this.render();
        }
        const inf = this.infer(p);
        this.trackSweep(inf.p);
        const c0 = st.aPos as Vec2, s0 = st.bPos as Vec2;
        const r = d2(c0, s0);
        const ea = ang(c0, inf.p);
        const e0: Vec2 = [c0[0] + r * Math.cos(ea), c0[1] + r * Math.sin(ea)];
        const ainf = st.ainf as Inference, binf = st.binf as Inference;
        const ccw = st.sweep >= 0;
        this.op(() => {
          const c = this.makePoint(ainf);
          const s = this.makePoint(binf);
          const en = inf.ptId ?? addPt(sk, e0);
          const a = ccw ? addArc(sk, c, s, en) : addArc(sk, c, en, s);
          a.r = r;
          if (inf.on && !inf.ptId) addRel(sk, inf.on.t === "line" ? "onLine" : "onCircle", [en, inf.on.id]);
        });
        this.st = {};
        return this.render();
      }
      case "arc3": {
        if (!st.aPos) {
          st.ainf = this.infer(p);
          st.aPos = st.ainf.p;
          return this.render();
        }
        if (!st.bPos) {
          st.binf = this.infer(p);
          st.bPos = st.binf.p;
          return this.render();
        }
        const m = this.infer(p).p;
        const cc = circle3(st.aPos, st.bPos, m);
        if (!cc) return;
        const ainf = st.ainf as Inference, binf = st.binf as Inference;
        const ccw = inArc(ang(cc.c, m), ang(cc.c, st.aPos), ang(cc.c, st.bPos));
        this.op(() => {
          const s = this.makePoint(ainf);
          const en = this.makePoint(binf);
          const c = addPt(sk, cc.c);
          const a = ccw ? addArc(sk, c, s, en) : addArc(sk, c, en, s);
          a.r = cc.r;
        });
        this.st = {};
        return this.render();
      }
      case "tarc": {
        if (!st.start) {
          const h = this.hitTest(p, this.tolPx, { ents: false });
          const users = h ? usersOf(sk, h.id).filter((x) => (x.t === "line" || (x.t === "arc" && (x.s === h.id || x.e === h.id)))) : [];
          if (!h || !users.length) return this.host.toast("Teğet yay bir çizginin veya yayın uç noktasından başlamalı");
          st.start = h.id;
          st.base = users[users.length - 1].id;
          st.tdir = this.tangentAt(st.base, h.id);
          st.aPos = P(sk, h.id);
          return this.render();
        }
        const inf = this.infer(p);
        const geo = this.tangentArcGeo(st.aPos, st.tdir, inf.p);
        if (!geo) return;
        this.op(() => {
          const en = this.makePoint(inf);
          const c = addPt(sk, geo.c);
          const a = geo.ccw ? addArc(sk, c, st.start, en) : addArc(sk, c, en, st.start);
          a.r = geo.r;
          addRel(sk, "tangent", [st.base, a.id]);
        });
        this.st = {};
        return this.render();
      }
      case "slot":
      case "cslot": {
        if (!st.aPos) {
          st.ainf = this.infer(p);
          st.aPos = st.ainf.p;
          return this.render();
        }
        if (!st.bPos) {
          st.binf = this.infer(p, st.aPos);
          st.bPos = st.binf.p;
          if (d2(st.aPos, st.bPos) < 1e-6) st.bPos = null;
          return this.render();
        }
        let a = st.aPos as Vec2;
        const b = st.bPos as Vec2;
        let ainf = st.ainf as Inference;
        const binf = st.binf as Inference;
        if (this.tool === "cslot") {
          a = [2 * a[0] - b[0], 2 * a[1] - b[1]];
          ainf = { p: a };
        }
        const u = norm2(sub2(b, a));
        const n = perp(u);
        const w = Math.max(1e-3, Math.abs(dot2(sub2(p, a), n)));
        this.op(() => {
          const c1 = this.makePoint(ainf);
          const c2 = this.makePoint(binf);
          const cl = addLine(sk, c1, c2, true);
          if (binf.hv) addRel(sk, binf.hv === "h" ? "horizontal" : "vertical", [cl.id]);
          const t1 = addPt(sk, add2(a, mul2(n, w))), t2 = addPt(sk, add2(b, mul2(n, w)));
          const b1 = addPt(sk, add2(a, mul2(n, -w))), b2 = addPt(sk, add2(b, mul2(n, -w)));
          const a1 = addArc(sk, c1, t1, b1);
          const a2 = addArc(sk, c2, b2, t2);
          const L1 = addLine(sk, t1, t2), L2 = addLine(sk, b1, b2);
          addRel(sk, "tangent", [L1.id, a1.id]);
          addRel(sk, "tangent", [L1.id, a2.id]);
          addRel(sk, "tangent", [L2.id, a1.id]);
          addRel(sk, "tangent", [L2.id, a2.id]);
          addRel(sk, "equal", [a1.id, a2.id]);
        });
        this.st = {};
        return this.render();
      }
      case "point": {
        const inf = this.infer(p);
        this.op(() => {
          const id = addPt(sk, inf.p);
          if (inf.ptId) addRel(sk, "coincident", [id, inf.ptId]);
          else {
            if (inf.on) addRel(sk, inf.on.t === "line" ? "onLine" : "onCircle", [id, inf.on.id]);
            if (inf.mid) addRel(sk, "midpoint", [id, inf.mid]);
          }
          addPointEnt(sk, id);
        });
        return;
      }
      case "rect3":
      case "para": {
        if (!st.aPos) {
          st.ainf = this.infer(p);
          st.aPos = st.ainf.p;
          return this.render();
        }
        if (!st.bPos) {
          st.binf = this.infer(p, st.aPos);
          st.bPos = st.binf.p;
          if (d2(st.aPos, st.bPos) < 1e-9) st.bPos = null;
          return this.render();
        }
        const cinf = this.infer(p);
        const [A, B, Cc, D] = this.quad(st.aPos, st.bPos, cinf.p);
        if (Math.abs(crs2(sub2(B, A), sub2(Cc, B))) < 1e-9) return;
        const ainf = st.ainf as Inference, binf = st.binf as Inference;
        const isPara = this.tool === "para";
        this.op(() => {
          const a = this.makePoint(ainf), b = this.makePoint(binf);
          const c = isPara && cinf.ptId ? cinf.ptId : addPt(sk, Cc);
          const dd = addPt(sk, D);
          const l1 = addLine(sk, a, b), l2 = addLine(sk, b, c), l3 = addLine(sk, c, dd), l4 = addLine(sk, dd, a);
          if (binf.hv) addRel(sk, binf.hv === "h" ? "horizontal" : "vertical", [l1.id]);
          addRel(sk, "parallel", [l1.id, l3.id]);
          addRel(sk, "parallel", [l2.id, l4.id]);
          if (!isPara) addRel(sk, "perpendicular", [l1.id, l2.id]);
        });
        this.st = {};
        return this.render();
      }
      case "circle3": {
        st.infs = st.infs ?? [];
        st.infs.push(this.infer(p));
        if (st.infs.length < 3) {
          st.aPos = st.infs[0].p;
          return this.render();
        }
        const [i1, i2, i3] = st.infs as Inference[];
        const cc = circle3(i1.p, i2.p, i3.p);
        this.st = {};
        if (!cc) return this.host.toast("Noktalar aynı doğru üzerinde", true);
        this.op(() => {
          const c = addPt(sk, cc.c);
          const ci = addCircle(sk, c, cc.r);
          for (const inf of [i1, i2, i3]) if (inf.ptId) addRel(sk, "onCircle", [inf.ptId, ci.id]);
        });
        return this.render();
      }
      case "aslot": {
        st.infs = st.infs ?? [];
        st.infs.push(this.infer(p));
        if (st.infs.length === 1) st.aPos = st.infs[0].p;
        if (st.infs.length === 2) {
          st.bPos = st.infs[1].p;
          st.sweep = 0;
          st.lastAng = ang(st.aPos, st.bPos);
        }
        if (st.infs.length === 3) {
          this.trackSweep(st.infs[2].p);
          st.e3 = st.infs[2].p;
        }
        if (st.infs.length < 4) return this.render();
        const geo = this.arcSlotGeo(st.aPos, st.bPos, st.sweep, st.infs[3].p);
        this.st = {};
        if (!geo) return this.host.toast("Geçersiz yay kanal", true);
        const ci = this.st.infs?.[0] as Inference | undefined;
        void ci;
        this.op(() => this.buildArcSlot(geo));
        return this.render();
      }
      case "ellipse":
      case "pellipse": {
        st.infs = st.infs ?? [];
        st.infs.push(this.infer(p));
        const n = st.infs.length;
        if (n === 1) st.aPos = st.infs[0].p;
        if (n === 2) st.bPos = st.infs[1].p;
        const need = this.tool === "ellipse" ? 3 : 5;
        if (n === 3) st.rb = Math.max(1e-3, this.minorFrom(st.aPos, st.bPos, st.infs[2].p));
        if (n < need) return this.render();
        const [ci, ai] = st.infs as Inference[];
        const rb = st.rb;
        const isP = this.tool === "pellipse";
        const pts = st.infs.map((x: Inference) => x.p);
        this.st = {};
        this.op(() => {
          const c = this.makePoint(ci);
          const a = addPt(sk, ai.p);
          const el: SEllipse = { id: nid(sk, "e"), t: "ellipse", c, a, rb };
          if (isP) {
            sk.ents.push(el);
            const g = ellipseGeo(sk, el);
            let t0 = g.param(pts[3]), t1 = g.param(pts[4]);
            if (normAng(t1 - t0) < 1e-6) t1 = t0 + Math.PI;
            el.t0 = t0;
            el.t1 = t1;
            el.s = addPt(sk, g.at(t0));
            el.e = addPt(sk, g.at(t1));
          } else sk.ents.push(el);
          addLine(sk, c, a, true);
        });
        return this.render();
      }
      case "parabola": {
        st.infs = st.infs ?? [];
        st.infs.push(this.infer(p));
        if (st.infs.length === 1) st.aPos = st.infs[0].p;
        if (st.infs.length === 2) st.bPos = st.infs[1].p;
        if (st.infs.length < 3) return this.render();
        const [si, ei, pk] = st.infs as Inference[];
        const k: Vec2 = [2 * pk.p[0] - (si.p[0] + ei.p[0]) / 2, 2 * pk.p[1] - (si.p[1] + ei.p[1]) / 2];
        this.st = {};
        this.op(() => {
          const s0 = this.makePoint(si), e0 = this.makePoint(ei);
          sk.ents.push({ id: nid(sk, "q"), t: "parabola", s: s0, e: e0, k: addPt(sk, k) });
        });
        return this.render();
      }
      case "spline": {
        st.infs = st.infs ?? [];
        const inf = this.infer(p);
        const first = st.infs[0] as Inference | undefined;
        const closing = first && st.infs.length >= 3 && d2(inf.p, first.p) < this.tolPx * this.wpp();
        if ((dbl && st.infs.length >= 2) || closing) return this.finishSpline(!!closing);
        st.infs.push(inf);
        st.lastPos = inf.p;
        this.renderPanel();
        return this.render();
      }
      case "text": {
        const inf = this.infer(p);
        const o = this.opts;
        if (!o.text.trim()) return this.host.toast("Önce metni yazın", true);
        this.op(() => {
          const pid = this.makePoint(inf);
          sk.ents.push({ id: nid(sk, "x"), t: "text", p: pid, text: o.text, size: o.textSize, angle: o.textAngle });
        });
        return;
      }
      case "isect":
        return this.intersectionCurve();
      case "schamfer":
        return this.chamferAt(p);
      case "extend":
        return this.extendAt(p);
      case "convert":
        return this.convertAt(e);
      case "offset":
      case "mirror":
      case "spat":
      case "scpat":
      case "move":
        return this.selectClick(p);
      case "fillet":
        return this.filletAt(p);
      case "trim":
        return this.trimAt(p);
      case "dim":
        return this.dimClick(p, e);
    }
  }

  private trackSweep(p: Vec2) {
    const st = this.st;
    if (!st.aPos || !st.bPos) return;
    const a = ang(st.aPos, p);
    let d = a - st.lastAng;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    st.sweep += d;
    st.lastAng = a;
  }

  /** Bir varlığın uç noktasındaki dışa doğru teğet yönü */
  private tangentAt(entId: string, ptId: string): Vec2 {
    const sk = this.data;
    const e = getEnt(sk, entId)!;
    if (e.t === "line") {
      const other = e.p1 === ptId ? e.p2 : e.p1;
      return norm2(sub2(P(sk, ptId), P(sk, other)));
    }
    const a = e as SArc;
    const c = P(sk, a.c), q = P(sk, ptId);
    const radial = norm2(sub2(q, c));
    // yay s'den e'ye CCW; e ucunda dışa yön CCW teğet, s ucunda CW teğet
    return ptId === a.e ? perp(radial) : mul2(perp(radial), -1);
  }

  private tangentArcGeo(s: Vec2, t: Vec2, e: Vec2) {
    const n = perp(t);
    const v = sub2(e, s);
    const den = 2 * dot2(v, n);
    if (Math.abs(den) < 1e-9) return null;
    const k = dot2(v, v) / den;
    const c = add2(s, mul2(n, k));
    return { c, r: Math.abs(k), ccw: k > 0 };
  }

  // ---------------- Seçim ve sürükleme ----------------
  private selectClick(p: Vec2) {
    const h = this.hitTest(p);
    if (!h) {
      if (this.sel.size) {
        this.sel.clear();
        this.render();
        this.renderPanel();
      }
      return;
    }
    if (this.sel.has(h.id)) this.sel.delete(h.id);
    else this.sel.add(h.id);
    this.render();
    this.renderPanel();
  }

  private drag: { kind: "pt" | "line" | "radius" | "move"; ids: string[]; start: Vec2; orig: Record<string, Vec2>; ent?: string } | null = null;

  private beginDrag(p: Vec2, h: Hit | null) {
    const sk = this.data;
    if (!h || h.id === ORIGIN) return;
    this.snapshot();
    if (h.kind === "pt") {
      this.drag = { kind: "pt", ids: [h.id], start: p, orig: { [h.id]: P(sk, h.id) } };
      return;
    }
    const e = getEnt(sk, h.id)!;
    if (e.t === "circle" || e.t === "arc") {
      this.drag = { kind: "radius", ids: [], start: p, orig: {}, ent: e.id };
      return;
    }
    const ids = entPoints(e).filter((x) => x !== ORIGIN);
    const orig: Record<string, Vec2> = {};
    ids.forEach((id) => (orig[id] = P(sk, id)));
    this.drag = { kind: "move", ids, start: p, orig };
  }

  private dragTo(p: Vec2) {
    const dr = this.drag;
    if (!dr) return;
    const sk = this.data;
    const dv = sub2(p, dr.start);
    if (dr.kind === "radius") {
      const e = getEnt(sk, dr.ent!) as SCircle | SArc;
      solve(sk, { radius: { [e.id]: d2(P(sk, e.c), p) } });
    } else {
      const pts: Record<string, [number, number]> = {};
      for (const id of dr.ids) pts[id] = add2(dr.orig[id], dv) as [number, number];
      solve(sk, { pts });
    }
    this.render();
  }

  private endDrag() {
    if (!this.drag) return;
    this.drag = null;
    this.resolve();
    this.render();
    this.renderPanel();
    this.host.changed();
  }

  deleteSelection() {
    if (!this.sel.size) return;
    const ids = [...this.sel];
    this.sel.clear();
    this.op(() => {
      // seçilen noktalar: noktayı kullanan varlıkları sil
      const extra: string[] = [];
      for (const id of ids) if (this.data.pts[id]) usersOf(this.data, id).forEach((e) => extra.push(e.id));
      deleteIds(this.data, [...ids, ...extra]);
    });
  }

  toggleConstruction() {
    const ents = [...this.sel].map((id) => getEnt(this.data, id)).filter((e) => e && e.t !== "point" && e.t !== "text") as SEnt[];
    if (!ents.length) return this.host.toast("Önce çizgi, daire veya yay seçin");
    const on = !ents.every((e) => e.cons);
    this.op(() => ents.forEach((e) => (on ? (e.cons = true) : delete e.cons)));
  }

  addRelations(opt: { build: () => { t: RelType; refs: string[]; fx?: number; fy?: number }[] }) {
    const ok = this.op(() => {
      for (const r of opt.build()) {
        const exists = this.data.rels.some((x) => x.t === r.t && x.refs.join() === r.refs.join());
        if (!exists) addRel(this.data, r.t, r.refs, r.fx !== undefined ? { fx: r.fx, fy: r.fy } : {});
      }
    }, "Bu ilişki diğerleriyle çelişiyor (aşırı tanımlı)");
    if (ok) {
      this.sel.clear();
      this.render();
      this.renderPanel();
    }
  }

  // ---------------- Eskiz radyüsü ----------------
  private filletAt(p: Vec2) {
    const sk = this.data;
    const h = this.hitTest(p, this.tolPx, { ents: false });
    if (!h || h.id === ORIGIN) return this.host.toast("İki çizginin birleştiği köşeye dokunun");
    const lines = usersOf(sk, h.id).filter((e) => e.t === "line") as SLine[];
    if (lines.length !== 2 || usersOf(sk, h.id).length !== 2) return this.host.toast("Köşede tam olarak iki çizgi birleşmeli");
    const r = this.opts.filletR;
    const Pp = P(sk, h.id);
    const [L1, L2] = lines;
    const A = P(sk, L1.p1 === h.id ? L1.p2 : L1.p1), B = P(sk, L2.p1 === h.id ? L2.p2 : L2.p1);
    const u1 = norm2(sub2(A, Pp)), u2 = norm2(sub2(B, Pp));
    const th = Math.acos(Math.max(-1, Math.min(1, dot2(u1, u2))));
    if (th < 1e-3 || Math.abs(th - Math.PI) < 1e-3) return this.host.toast("Çizgiler paralel; köşe yuvarlatılamaz");
    const d = r / Math.tan(th / 2);
    if (d >= d2(A, Pp) || d >= d2(B, Pp)) return this.host.toast("Yarıçap bu köşe için çok büyük", true);
    const T1 = add2(Pp, mul2(u1, d)), T2 = add2(Pp, mul2(u2, d));
    const bis = norm2(add2(u1, u2));
    const Cc = add2(Pp, mul2(bis, r / Math.sin(th / 2)));
    const ccw = crs2(sub2(T1, Cc), sub2(T2, Cc)) > 0;
    this.op(() => {
      const t1 = addPt(sk, T1), t2 = addPt(sk, T2), c = addPt(sk, Cc);
      for (const [L, t] of [[L1, t1], [L2, t2]] as [SLine, string][]) {
        if (L.p1 === h.id) L.p1 = t;
        else L.p2 = t;
      }
      // köşe noktasına bağlı ilişki ve ölçüleri kaldır
      sk.rels = sk.rels.filter((x) => !x.refs.includes(h.id));
      sk.dims = sk.dims.filter((x) => !x.refs.includes(h.id));
      const a = ccw ? addArc(sk, c, t1, t2) : addArc(sk, c, t2, t1);
      a.r = r;
      addRel(sk, "tangent", [L1.id, a.id]);
      addRel(sk, "tangent", [L2.id, a.id]);
      sk.dims.push({ id: nid(sk, "d"), t: "rad", refs: [a.id], v: r, lp: add2(Cc, mul2(bis, -r * 2)) as Vec2 });
    });
  }

  /** 3 noktalı dikdörtgen / paralelkenar köşeleri */
  private quad(a: Vec2, b: Vec2, c: Vec2): [Vec2, Vec2, Vec2, Vec2] {
    if (this.tool === "para") return [a, b, c, add2(a, sub2(c, b))];
    const n = perp(norm2(sub2(b, a)));
    const w = dot2(sub2(c, b), n);
    return [a, b, add2(b, mul2(n, w)), add2(a, mul2(n, w))];
  }

  /** Küçük yarıçap: noktanın büyük eksene uzaklığı */
  private minorFrom(c: Vec2, a: Vec2, p: Vec2) {
    const u = norm2(sub2(a, c));
    return Math.abs(crs2(u, sub2(p, c)));
  }

  private arcSlotGeo(c: Vec2, s: Vec2, sweep: number, wp: Vec2) {
    const r = d2(c, s);
    const w = Math.abs(d2(c, wp) - r);
    if (r < 1e-6 || w < 1e-6 || w >= r || Math.abs(sweep) < 1e-6) return null;
    let a0 = ang(c, s), a1 = a0 + sweep;
    if (sweep < 0) [a0, a1] = [a1, a0];
    return { c, r, w, a0, a1 };
  }

  private buildArcSlot(g: { c: Vec2; r: number; w: number; a0: number; a1: number }) {
    const sk = this.data;
    const U = (t: number, rr: number): Vec2 => [g.c[0] + rr * Math.cos(t), g.c[1] + rr * Math.sin(t)];
    const c = addPt(sk, g.c);
    const S = addPt(sk, U(g.a0, g.r)), E = addPt(sk, U(g.a1, g.r));
    const cl = addArc(sk, c, S, E, true);
    cl.r = g.r;
    const o1 = addPt(sk, U(g.a0, g.r + g.w)), o2 = addPt(sk, U(g.a1, g.r + g.w));
    const i1 = addPt(sk, U(g.a0, g.r - g.w)), i2 = addPt(sk, U(g.a1, g.r - g.w));
    const outer = addArc(sk, c, o1, o2);
    const inner = addArc(sk, c, i1, i2);
    // uç kapakları: dışa doğru yarım daireler. Kapak merkezi, radyal yapı çizgisinin orta noktasıdır.
    const capS = addArc(sk, S, i1, o1);
    const capE = addArc(sk, E, o2, i2);
    capS.r = capE.r = g.w;
    for (const [a, b, m] of [[i1, o1, S], [i2, o2, E]] as [string, string, string][]) {
      const rl = addLine(sk, a, b, true);
      addRel(sk, "midpoint", [m, rl.id]);
      addRel(sk, "onLine", [c, rl.id]);
    }
    void outer;
    void inner;
  }

  private finishSpline(closed: boolean) {
    const infs = (this.st.infs ?? []) as Inference[];
    this.st = {};
    if (infs.length < 2) return this.render();
    const sk = this.data;
    this.op(() => {
      const ids = infs.map((x) => this.makePoint(x));
      if (closed) ids.push(ids[0]);
      sk.ents.push({ id: nid(sk, "s"), t: "spline", pts: ids, eq: true } as any);
    });
    this.render();
    this.renderPanel();
  }

  private async intersectionCurve() {
    if (!this.host.section) return;
    const items = await this.host.section(this.frame);
    if (!items.length) return this.host.toast("Eskiz düzlemi katıyı kesmiyor", true);
    const sk = this.data;
    const L = (w: Vec3) => toLocal(this.frame, w);
    const pt = (q: Vec2) => {
      for (const id of [ORIGIN, ...Object.keys(sk.pts)]) if (d2(P(sk, id), q) < 1e-6) return id;
      const id = addPt(sk, q);
      addRel(sk, "fix", [id], { fx: q[0], fy: q[1] });
      return id;
    };
    this.op(() => {
      for (const it of items) {
        if (it.k === "line") addLine(sk, pt(L(it.s)), pt(L(it.e)));
        else if (it.k === "circle") {
          const c = pt(L(it.c));
          if (it.closed) {
            const ci = addCircle(sk, c, it.r);
            sk.dims.push({ id: nid(sk, "d"), t: "dia", refs: [ci.id], v: it.r * 2, lp: add2(L(it.c), [it.r, it.r]) });
          } else {
            const cc = L(it.c), s0 = L(it.s), e0 = L(it.e), m0 = L(it.m);
            const ccw = inArc(ang(cc, m0), ang(cc, s0), ang(cc, e0));
            const a = ccw ? addArc(sk, c, pt(s0), pt(e0)) : addArc(sk, c, pt(e0), pt(s0));
            a.r = it.r;
          }
        } else {
          const ids = it.pts.map((w) => pt(L(w)));
          for (let i = 0; i < ids.length - 1; i++) if (ids[i] !== ids[i + 1]) addLine(sk, ids[i], ids[i + 1]);
        }
      }
    });
    this.host.toast(`${items.length} kesişim eğrisi eklendi`);
  }

  /** Tam tanımla: orijine göre yatay/dikey ölçüler ve yarıçaplar ekler */
  fullyDefine() {
    const sk = this.data;
    this.snapshot();
    const before = JSON.stringify(sk);
    let added = 0;
    const tryDim = (d: SDim) => {
      const before = solve(sk, undefined, false).dof;
      sk.dims.push(d);
      const r = solve(sk, undefined, false);
      if (!r.ok || r.conflicts.length || r.dof >= before) {
        sk.dims.pop();
        return false;
      }
      added++;
      return true;
    };
    let res = solve(sk);
    let def = analyze(sk, res.dof);
    // yarıçaplar
    for (const e of sk.ents) {
      if ((e.t === "circle" || e.t === "arc") && !def.radii.has(e.id)) {
        const c = P(sk, e.c);
        tryDim({ id: nid(sk, "d"), t: e.t === "circle" ? "dia" : "rad", refs: [e.id], v: e.t === "circle" ? e.r * 2 : e.r, lp: add2(c, [e.r * 0.8, e.r * 0.9]) });
      }
    }
    res = solve(sk);
    def = analyze(sk, res.dof);
    let k = 0;
    for (const id of Object.keys(sk.pts)) {
      if (def.pts.has(id)) continue;
      const q = P(sk, id);
      k++;
      const okx = Math.abs(q[0]) > 1e-9 && tryDim({ id: nid(sk, "d"), t: "dist", sub: "h", refs: q[0] >= 0 ? [ORIGIN, id] : [id, ORIGIN], v: Math.abs(q[0]), lp: [q[0] / 2, Math.min(0, q[1]) - 8 - (k % 5) * 6] });
      const oky = Math.abs(q[1]) > 1e-9 && tryDim({ id: nid(sk, "d"), t: "dist", sub: "v", refs: q[1] >= 0 ? [ORIGIN, id] : [id, ORIGIN], v: Math.abs(q[1]), lp: [Math.min(0, q[0]) - 8 - (k % 5) * 6, q[1] / 2] });
      if (okx || oky) {
        res = solve(sk);
        def = analyze(sk, res.dof);
      }
      if (res.dof === 0) break;
    }
    // orijinde duran ama tanımsız noktalar için sabitle
    res = solve(sk);
    def = analyze(sk, res.dof);
    for (const id of Object.keys(sk.pts)) {
      if (res.dof === 0) break;
      if (def.pts.has(id)) continue;
      const q = P(sk, id);
      const before = solve(sk, undefined, false).dof;
      sk.rels.push({ id: nid(sk, "r"), t: "fix", refs: [id], fx: q[0], fy: q[1] });
      const r = solve(sk, undefined, false);
      if (!r.ok || r.conflicts.length || r.dof >= before) sk.rels.pop();
      else added++;
      res = solve(sk);
      def = analyze(sk, res.dof);
    }
    if (!added) {
      this.undoStack.pop();
      Object.assign(sk, JSON.parse(before));
    }
    this.resolve();
    this.render();
    this.renderPanel();
    this.host.changed();
    this.host.toast(added ? `${added} ölçü/ilişki eklendi` : "Eklenecek ölçü bulunamadı");
  }

  toggleRefDim(id: string) {
    const d = this.data.dims.find((x) => x.id === id);
    if (!d) return;
    this.op(() => {
      d.ref = !d.ref;
      if (!d.ref) d.v = Math.abs(measure(this.data, d)) * (d.t === "dist" && d.sub !== "a" ? Math.sign(measure(this.data, d)) || 1 : 1);
    }, "Sürücü ölçü eskizi aşırı tanımlar");
  }

  // ---------------- Eskiz pahı ----------------
  private chamferAt(p: Vec2) {
    const sk = this.data;
    const h = this.hitTest(p, this.tolPx, { ents: false });
    if (!h || h.id === ORIGIN) return this.host.toast("İki çizginin birleştiği köşeye dokunun");
    const lines = usersOf(sk, h.id).filter((e) => e.t === "line") as SLine[];
    if (lines.length !== 2 || usersOf(sk, h.id).length !== 2) return this.host.toast("Köşede tam olarak iki çizgi birleşmeli");
    const d = this.opts.chamferD;
    const Pp = P(sk, h.id);
    const [L1, L2] = lines;
    const A = P(sk, L1.p1 === h.id ? L1.p2 : L1.p1), B = P(sk, L2.p1 === h.id ? L2.p2 : L2.p1);
    if (d >= d2(A, Pp) || d >= d2(B, Pp)) return this.host.toast("Pah mesafesi bu köşe için çok büyük", true);
    const T1 = add2(Pp, mul2(norm2(sub2(A, Pp)), d)), T2 = add2(Pp, mul2(norm2(sub2(B, Pp)), d));
    this.op(() => {
      const t1 = addPt(sk, T1), t2 = addPt(sk, T2);
      for (const [L, t] of [[L1, t1], [L2, t2]] as [SLine, string][]) {
        if (L.p1 === h.id) L.p1 = t;
        else L.p2 = t;
      }
      sk.rels = sk.rels.filter((x) => !x.refs.includes(h.id));
      sk.dims = sk.dims.filter((x) => !x.refs.includes(h.id));
      addLine(sk, t1, t2);
    });
  }

  // ---------------- Uzat ----------------
  private extendAt(p: Vec2) {
    const sk = this.data;
    const h = this.hitTest(p, this.tolPx, { pts: false });
    const e = h && getEnt(sk, h.id);
    if (!e || e.t !== "line") return this.host.toast("Uzatılacak bir çizgiye dokunun");
    const A = P(sk, e.p1), B = P(sk, e.p2);
    const atEnd = d2(h!.q, B) < d2(h!.q, A);
    const end = atEnd ? e.p2 : e.p1;
    const from = atEnd ? A : B, to = atEnd ? B : A;
    if (usersOf(sk, end).length > 1) return this.host.toast("Bu uç başka öğelere bağlı; uzatılamaz", true);
    const dir = norm2(sub2(to, from));
    const L = d2(from, to);
    let best: { p: Vec2; t: number; by: string } | null = null;
    for (const o of sk.ents) {
      if (o.id === e.id || (o.t !== "line" && o.t !== "circle" && o.t !== "arc")) continue;
      let cands: Vec2[] = [];
      if (o.t === "line") {
        const x = lineLine(from, to, P(sk, o.p1), P(sk, o.p2));
        if (x && x.tb >= -1e-9 && x.tb <= 1 + 1e-9) cands = [x.p];
      } else {
        cands = lineCircle(from, to, P(sk, o.c), o.r).map((x) => x.p);
        if (o.t === "arc") {
          const { c, s: as, e: ae } = arcAngles(sk, o);
          cands = cands.filter((q) => inArc(ang(c, q), as, ae));
        }
      }
      for (const q of cands) {
        const t = dot2(sub2(q, from), dir);
        if (t > L + 1e-6 && (!best || t < best.t)) best = { p: q, t, by: o.id };
      }
    }
    if (!best) return this.host.toast("Uzatılacak bir hedef bulunamadı", true);
    const b = best;
    this.op(() => {
      sk.pts[end] = { x: b.p[0], y: b.p[1] };
      sk.dims = sk.dims.filter((d) => !(d.refs.includes(e.p1) && d.refs.includes(e.p2)));
      const be = getEnt(sk, b.by)!;
      addRel(sk, be.t === "line" ? "onLine" : "onCircle", [end, b.by]);
    });
  }

  // ---------------- Varlıkları dönüştür ----------------
  private convertAt(e: { clientX: number; clientY: number }) {
    const v = this.host.viewer;
    const hit = v.pick(e.clientX, e.clientY, { edge: true });
    if (!hit || hit.kind !== "edge" || !v.mesh) return this.host.toast("Modelin bir kenarına dokunun");
    const info = v.mesh.edges[hit.index];
    const sk = this.data;
    const L = (w: Vec3) => toLocal(this.frame, w);
    const exact = (q: Vec2) => {
      for (const id of [ORIGIN, ...Object.keys(sk.pts)]) if (d2(P(sk, id), q) < 1e-6) return id;
      return null;
    };
    const pt = (q: Vec2) => {
      const ex = exact(q);
      if (ex) return ex;
      const id = addPt(sk, q);
      addRel(sk, "fix", [id], { fx: q[0], fy: q[1] });
      return id;
    };
    if (info.type === "LINE") {
      const a = L(info.s), b = L(info.e);
      if (d2(a, b) < 1e-6) return this.host.toast("Bu kenar eskiz düzlemine dik; dönüştürülemez", true);
      this.op(() => addLine(sk, pt(a), pt(b)));
    } else if (info.type === "CIRCLE" && info.c && info.r && info.ax) {
      if (Math.abs(Math.abs(dot(info.ax, this.frame.n)) - 1) > 1e-4) return this.host.toast("Bu daire eskiz düzlemine paralel değil", true);
      const c = L(info.c);
      this.op(() => {
        const cid = pt(c);
        if (info.closed) {
          const ci = addCircle(sk, cid, info.r!);
          sk.dims.push({ id: nid(sk, "d"), t: "dia", refs: [ci.id], v: info.r! * 2, lp: add2(c, [info.r! * 1.2, info.r! * 1.2]) });
        } else {
          const s0 = L(info.s), e0 = L(info.e), m0 = L(info.m);
          const ccw = inArc(ang(c, m0), ang(c, s0), ang(c, e0));
          const sId = pt(s0), eId = pt(e0);
          const a = ccw ? addArc(sk, cid, sId, eId) : addArc(sk, cid, eId, sId);
          a.r = info.r!;
        }
      });
    } else return this.host.toast("Bu kenar türü henüz dönüştürülemiyor (çizgi ve daire/yay destekleniyor)", true);
    void sub;
  }

  // ---------------- Seçim işlemleri ----------------
  private selEnts(): SEnt[] {
    return [...this.sel].map((id) => getEnt(this.data, id)).filter(Boolean) as SEnt[];
  }

  /** İşlem aracını uygular (önizleme için kopya veri üzerinde de çalışır) */
  private runOp(sk: SketchData): string | null {
    const ents = [...this.sel].map((id) => sk.ents.find((e) => e.id === id)).filter(Boolean) as SEnt[];
    const o = this.opts;
    switch (this.tool) {
      case "offset":
        return offsetEnts(sk, ents, o.offD, o.offRev);
      case "mirror": {
        const lines = ents.filter((e) => e.t === "line") as SLine[];
        const axis = lines.find((l) => l.cons) ?? lines[lines.length - 1];
        if (!axis) return "Ayna ekseni için bir çizgi (tercihen merkez çizgisi) seçin";
        const rest = ents.filter((e) => e !== axis);
        if (!rest.length) return "Aynalanacak öğeleri seçin";
        mirrorEnts(sk, rest, axis);
        return null;
      }
      case "spat":
        if (!ents.length) return "Çoğaltılacak öğeleri seçin";
        linearPattern(sk, ents.filter((e) => e.t !== "point" || ents.length === 1), { n1: o.n1, s1: o.s1, a1: o.a1, n2: o.n2, s2: o.s2, a2: o.a2 });
        return null;
      case "scpat": {
        const pts = [...this.sel].filter((id) => id === ORIGIN || sk.pts[id]);
        const cpt = pts.length === 1 ? P(sk, pts[0]) : ([0, 0] as Vec2);
        if (!ents.length) return "Çoğaltılacak öğeleri seçin";
        circularPattern(sk, ents, { c: cpt, n: Math.max(2, Math.round(o.cn)), total: o.ctotal });
        return null;
      }
      case "move":
        if (!ents.length) return "Taşınacak öğeleri seçin";
        moveEnts(sk, ents, { dx: o.mdx, dy: o.mdy, ang: o.mang, c: centroid(sk, ents), copy: o.mcopy, scale: o.mscale });
        return null;
    }
    return null;
  }

  applyOp() {
    let err: string | null = null;
    const ok = this.op(() => {
      err = this.runOp(this.data);
      if (err) throw new Error(err);
    });
    if (ok) {
      this.sel.clear();
      this.render();
      this.renderPanel();
    }
  }

  private renderOpPreview() {
    if (!OP_TOOLS.includes(this.tool) || !this.sel.size) return;
    const copy: SketchData = JSON.parse(JSON.stringify(this.data));
    const before = new Set(copy.ents.map((e) => e.id));
    try {
      if (this.runOp(copy)) return;
    } catch {
      return;
    }
    const moved = this.tool === "move" && !this.opts.mcopy;
    const tmp = this.data;
    this.data = copy;
    for (const e of copy.ents) if (moved ? this.sel.has(e.id) : !before.has(e.id)) if (e.t !== "point") this.addLines(this.entPolyline(e), C.prev, 2, !!e.cons);
    this.data = tmp;
  }

  // ---------------- Kırpma ----------------
  private trimAt(p: Vec2) {
    const sk = this.data;
    const h = this.hitTest(p, this.tolPx, { pts: false });
    if (!h) return;
    const e = getEnt(sk, h.id)!;
    if (e.t !== "line" && e.t !== "circle" && e.t !== "arc") return this.op(() => deleteIds(sk, [e.id]));
    // e üzerindeki kesişim noktaları (parametre ile)
    const cuts = this.intersections(e);
    const exact = (q: Vec2) => {
      for (const id of [ORIGIN, ...Object.keys(sk.pts)]) if (d2(P(sk, id), q) < 1e-6) return id;
      return null;
    };
    const mk = (q: Vec2, by: string) => {
      const ex = exact(q);
      if (ex) return ex;
      const id = addPt(sk, q);
      const be = getEnt(sk, by)!;
      if (be.t === "line") addRel(sk, "onLine", [id, by]);
      else if (be.t === "circle" || be.t === "arc") addRel(sk, "onCircle", [id, by]);
      return id;
    };
    if (e.t === "line") {
      const A = P(sk, e.p1), B = P(sk, e.p2);
      const t = nearestOnSeg(h.q, A, B).t;
      const lo = cuts.filter((c) => c.t < t - 1e-9).sort((a, b) => b.t - a.t)[0];
      const hi = cuts.filter((c) => c.t > t + 1e-9).sort((a, b) => a.t - b.t)[0];
      this.op(() => {
        if (!lo && !hi) return deleteIds(sk, [e.id]);
        // ölçüleri temizle (uzunluk değişiyor)
        sk.dims = sk.dims.filter((d) => !(d.refs.includes(e.p1) && d.refs.includes(e.p2)));
        if (lo && hi) {
          const q1 = mk(lo.p, lo.by), q2 = mk(hi.p, hi.by);
          const oldP2 = e.p2;
          e.p2 = q1;
          const nl = addLine(sk, q2, oldP2, e.cons);
          for (const r of sk.rels.filter((r) => r.refs.includes(e.id) && (r.t === "horizontal" || r.t === "vertical")))
            addRel(sk, r.t, [nl.id]);
        } else if (lo) e.p2 = mk(lo.p, lo.by);
        else e.p1 = mk(hi!.p, hi!.by);
      });
      return;
    }
    // daire / yay: açı ile
    const c = P(sk, e.c);
    const a = ang(c, h.q);
    if (e.t === "circle") {
      if (cuts.length < 2) return this.op(() => deleteIds(sk, [e.id]));
      const rel = (x: number) => normAng(x - a);
      const sorted = [...cuts].sort((x, y) => rel(x.t) - rel(y.t));
      const next = sorted[0], prev = sorted[sorted.length - 1];
      this.op(() => {
        const s = mk(next.p, next.by), en = mk(prev.p, prev.by);
        const arc = e as unknown as SArc;
        (arc as any).t = "arc";
        arc.s = s;
        arc.e = en;
      });
      return;
    }
    const arc = e as SArc;
    const { s: as, e: ae } = arcAngles(sk, arc);
    const pos = (x: number) => normAng(x - as);
    const ta = pos(a);
    const inside = cuts.filter((x) => pos(x.t) > 1e-9 && pos(x.t) < normAng(ae - as) - 1e-9);
    const lo = inside.filter((x) => pos(x.t) < ta).sort((x, y) => pos(y.t) - pos(x.t))[0];
    const hi = inside.filter((x) => pos(x.t) > ta).sort((x, y) => pos(x.t) - pos(y.t))[0];
    this.op(() => {
      if (!lo && !hi) return deleteIds(sk, [arc.id]);
      if (lo && hi) {
        const q1 = mk(lo.p, lo.by), q2 = mk(hi.p, hi.by);
        const oldE = arc.e;
        arc.e = q1;
        const na = addArc(sk, arc.c, q2, oldE, arc.cons);
        na.r = arc.r;
      } else if (lo) arc.e = mk(lo.p, lo.by);
      else arc.s = mk(hi!.p, hi!.by);
    });
  }

  /** Varlığın diğerleriyle kesişimleri: çizgide t (0..1), eğride açı */
  private intersections(e: SEnt): { p: Vec2; t: number; by: string }[] {
    const sk = this.data;
    const out: { p: Vec2; t: number; by: string }[] = [];
    const onOther = (o: SEnt, q: Vec2) => {
      if (o.t === "line") {
        const r = nearestOnSeg(q, P(sk, o.p1), P(sk, o.p2));
        return r.d < 1e-6;
      }
      if (o.t === "arc") {
        const { c, s, e: en } = arcAngles(sk, o);
        return inArc(ang(c, q), s, en);
      }
      return true;
    };
    for (const o of sk.ents) {
      if (o.id === e.id || (o.t !== "line" && o.t !== "circle" && o.t !== "arc")) continue;
      let pts: Vec2[] = [];
      if (e.t === "line") {
        const A = P(sk, e.p1), B = P(sk, e.p2);
        if (o.t === "line") {
          const x = lineLine(A, B, P(sk, o.p1), P(sk, o.p2));
          if (x && x.tb >= -1e-9 && x.tb <= 1 + 1e-9) pts = [x.p];
        } else if (o.t === "circle" || o.t === "arc") pts = lineCircle(A, B, P(sk, o.c), o.r).map((x) => x.p);
        for (const q of pts) {
          if (!onOther(o, q)) continue;
          const t = nearestOnSeg(q, A, B).t;
          const ab = sub2(B, A);
          const tt = dot2(sub2(q, A), ab) / (dot2(ab, ab) || 1);
          if (tt > 1e-9 && tt < 1 - 1e-9) out.push({ p: q, t, by: o.id });
        }
      } else if (e.t === "circle" || e.t === "arc") {
        const c = P(sk, e.c);
        if (o.t === "line") {
          pts = lineCircle(P(sk, o.p1), P(sk, o.p2), c, e.r).filter((x) => x.t >= -1e-9 && x.t <= 1 + 1e-9).map((x) => x.p);
        } else if (o.t === "circle" || o.t === "arc") pts = circleCircle(c, e.r, P(sk, o.c), o.r);
        for (const q of pts) if (onOther(o, q)) out.push({ p: q, t: ang(c, q), by: o.id });
      }
    }
    return out;
  }

  // ---------------- Akıllı ölçü ----------------
  private dimClick(p: Vec2, e: { clientX: number; clientY: number }) {
    const st = this.st;
    st.refs = st.refs ?? [];
    const h = this.hitTest(p);
    if (h) {
      if (st.refs.length >= 2 || st.refs.includes(h.id)) st.refs = [];
      st.refs.push(h.id);
      this.render();
      return;
    }
    if (!st.refs.length) return;
    const spec = this.dimSpec(st.refs, p);
    st.refs = [];
    this.render();
    if (!spec) return this.host.toast("Bu seçim için ölçü yok");
    const cur = measure(this.data, spec);
    this.promptValue(e.clientX, e.clientY, Math.abs(cur), spec.t === "angle" ? "°" : "", (v) => {
      if (spec.t !== "angle" && v <= 0 && spec.t !== "dist") return this.host.toast("Değer sıfırdan büyük olmalı", true);
      const make = (): SDim => {
        const d: SDim = { id: nid(this.data, "d"), ...spec, v: spec.t === "dist" && spec.sub !== "a" ? v * Math.sign(cur || 1) : v };
        if (d.t === "dist" && d.sub !== "a" && cur < 0) {
          d.refs = [d.refs[1], d.refs[0]];
          d.v = v;
        }
        const ex = this.lastExpr;
        if (ex) d.expr = ex;
        return d;
      };
      const ok = this.op(() => this.data.dims.push(make()), "");
      if (ok) return this.host.changed();
      // SolidWorks gibi: aşırı tanımlıyorsa referans ölçü olarak eklemeyi öner
      if (confirm("Bu ölçü eskizi aşırı tanımlar. Referans (sürülen) ölçü olarak eklensin mi?")) {
        this.op(() => {
          const d = make();
          d.ref = true;
          d.v = Math.abs(cur);
          delete d.expr;
          this.data.dims.push(d);
        });
        this.host.changed();
      }
    });
  }

  /** Seçilen öğelere ve etiket konumuna göre ölçü türü */
  private dimSpec(refs: string[], lp: Vec2): Omit<SDim, "id" | "v"> | null {
    const sk = this.data;
    const ents = refs.map((r) => getEnt(sk, r));
    const isPt = (i: number) => !ents[i] || ents[i]!.t === "point";
    const ptOf = (i: number) => (ents[i]?.t === "point" ? (ents[i] as any).p : refs[i]);
    const subFor = (A: Vec2, B: Vec2): "a" | "h" | "v" => {
      const minX = Math.min(A[0], B[0]), maxX = Math.max(A[0], B[0]);
      const minY = Math.min(A[1], B[1]), maxY = Math.max(A[1], B[1]);
      if (Math.abs(A[0] - B[0]) < 1e-9 || Math.abs(A[1] - B[1]) < 1e-9) return "a";
      const outY = lp[1] > maxY || lp[1] < minY, outX = lp[0] > maxX || lp[0] < minX;
      if (outY && !outX) return "h";
      if (outX && !outY) return "v";
      return "a";
    };
    if (refs.length === 1) {
      const e = ents[0];
      if (!e) return null;
      if (e.t === "line") return { t: "dist", refs: [e.p1, e.p2], sub: subFor(P(sk, e.p1), P(sk, e.p2)), lp };
      if (e.t === "circle") return { t: "dia", refs: [e.id], lp };
      if (e.t === "arc") return this.opts.arcLen ? { t: "alen", refs: [e.id], lp } : { t: "rad", refs: [e.id], lp };
      return null;
    }
    if (this.opts.edgeDim) {
      if (ents[0]?.t === "circle" && ents[1]?.t === "line") return { t: "cl", refs: [refs[0], refs[1]], lp };
      if (ents[1]?.t === "circle" && ents[0]?.t === "line") return { t: "cl", refs: [refs[1], refs[0]], lp };
      if (ents[0]?.t === "circle" && ents[1]?.t === "circle") return { t: "cc", refs: [refs[0], refs[1]], lp };
    }
    const [e0, e1] = ents;
    if (isPt(0) && isPt(1)) {
      const a = ptOf(0), b = ptOf(1);
      return { t: "dist", refs: [a, b], sub: subFor(P(sk, a), P(sk, b)), lp };
    }
    const curve = (e?: SEnt) => e && (e.t === "circle" || e.t === "arc");
    if (isPt(0) && e1?.t === "line") return { t: "pldist", refs: [ptOf(0), e1.id], lp };
    if (isPt(1) && e0?.t === "line") return { t: "pldist", refs: [ptOf(1), e0.id], lp };
    if (e0?.t === "line" && e1?.t === "line") {
      const u = sub2(P(sk, e0.p2), P(sk, e0.p1)), v = sub2(P(sk, e1.p2), P(sk, e1.p1));
      if (Math.abs(crs2(norm2(u), norm2(v))) < 1e-4) return { t: "pldist", refs: [e0.id, e1.id], lp };
      return { t: "angle", refs: [e0.id, e1.id], lp, sgn: lineAngleSign(sk, e0, e1) };
    }
    if (curve(e0) && e1?.t === "line") return { t: "pldist", refs: [e0!.id, e1.id], lp };
    if (curve(e1) && e0?.t === "line") return { t: "pldist", refs: [e1!.id, e0.id], lp };
    if (curve(e0) && curve(e1)) {
      const a = (e0 as any).c, b = (e1 as any).c;
      return { t: "dist", refs: [a, b], sub: subFor(P(sk, a), P(sk, b)), lp };
    }
    if (curve(e0) && isPt(1)) {
      const a = (e0 as any).c, b = ptOf(1);
      return { t: "dist", refs: [a, b], sub: subFor(P(sk, a), P(sk, b)), lp };
    }
    if (curve(e1) && isPt(0)) {
      const a = ptOf(0), b = (e1 as any).c;
      return { t: "dist", refs: [a, b], sub: subFor(P(sk, a), P(sk, b)), lp };
    }
    return null;
  }

  editDim(d: SDim, x: number, y: number) {
    if (d.ref) return this.host.toast("Referans ölçü geometriye göre değişir; düzenlenemez. Sürücü yapmak için seçip 'Sürücü ölçü' deyin.");
    this.promptValue(x, y, Math.abs(d.v), d.t === "angle" ? "°" : "", (v) => {
      const ex = this.lastExpr;
      if (v <= 0 && d.t !== "dist") return this.host.toast("Değer sıfırdan büyük olmalı", true);
      const old = d.v;
      const ok = this.op(() => {
        const dd = this.data.dims.find((x) => x.id === d.id);
        if (dd) {
          dd.v = dd.t === "dist" && dd.sub !== "a" ? v * Math.sign(old || 1) : v;
          if (ex) dd.expr = ex;
          else delete dd.expr;
        }
      }, "Bu değer eskizde çözülemiyor");
      if (ok) this.host.changed();
    });
  }

  /** son girilen değer değişken içeren bir ifadeyse (ör. "=kalinlik*2") */
  lastExpr: string | null = null;

  private promptValue(x: number, y: number, cur: number, unit: string, done: (v: number) => void) {
    document.querySelector(".dim-prompt")?.remove();
    const box = document.createElement("div");
    box.className = "dim-prompt";
    box.innerHTML = `<input inputmode="decimal" autocomplete="off" /><span>${unit}</span><button class="ok" aria-label="Tamam">✓</button><button class="no" aria-label="İptal">✕</button>`;
    const inp = box.querySelector("input")!;
    inp.value = fmtNum(cur, 3);
    document.body.appendChild(box);
    const r = box.getBoundingClientRect();
    box.style.left = Math.max(8, Math.min(window.innerWidth - r.width - 8, x - r.width / 2)) + "px";
    box.style.top = Math.max(8, Math.min(window.innerHeight - r.height - 8, y - r.height - 24)) + "px";
    inp.focus();
    inp.select();
    const close = () => box.remove();
    const apply = () => {
      const raw = inp.value.trim();
      const v = evalNum(raw);
      if (v === null) {
        inp.classList.add("bad");
        return;
      }
      this.lastExpr = /[a-zA-ZçğıöşüÇĞİÖŞÜ_]/.test(raw.replace(/^=/, "")) ? raw.replace(/^=/, "") : null;
      close();
      done(v);
    };
    box.querySelector(".ok")!.addEventListener("click", apply);
    box.querySelector(".no")!.addEventListener("click", close);
    inp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") apply();
      if (ev.key === "Escape") close();
      ev.stopPropagation();
    });
  }

  // ---------------- Çizim ----------------
  private clearGroup() {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      (c as any).geometry?.dispose();
      (c as any).material?.dispose?.();
    }
    this.labelBox.innerHTML = "";
    this.anchors = [];
  }

  private entColor(e: SEnt): number {
    if (this.sel.has(e.id)) return C.sel;
    if (this.hov?.id === e.id || (this.tool === "dim" && this.st.refs?.includes(e.id))) return C.hov;
    if (!this.result.ok || this.result.conflicts.length) return C.over;
    const pts = entPoints(e);
    const def = pts.every((p) => this.defined.pts.has(p)) && (e.t !== "circle" || this.defined.radii.has(e.id)) && (e.t !== "arc" || this.defined.radii.has(e.id) || pts.every((p) => this.defined.pts.has(p)));
    return def ? C.full : C.under;
  }

  private entPolyline(e: SEnt): Vec2[] {
    return entSamples(this.data, e);
  }

  private segs(poly: Vec2[]): number[] {
    const out: number[] = [];
    for (let i = 0; i < poly.length - 1; i++) out.push(...this.W(poly[i]), ...this.W(poly[i + 1]));
    return out;
  }

  private addLines(poly: Vec2[], color: number, width = 2, dashed = false) {
    if (poly.length < 2) return;
    this.group.add(this.host.viewer.fatLines(this.segs(poly), color, width, dashed));
  }

  render() {
    this.clearGroup();
    const sk = this.data;
    const v = this.host.viewer;
    if (sk.pic) this.group.add(pictureMesh(sk.pic, this.frame, () => this.host.viewer.requestRender()));
    // orijin işareti
    const o = 12 * this.wpp();
    this.addLines([[0, 0], [o * 2, 0]], C.origin, 1.5);
    this.addLines([[0, 0], [0, o * 2]], C.origin, 1.5);

    for (const e of sk.ents) {
      if (e.t === "text") {
        this.drawText(e);
        continue;
      }
      if (e.t === "point") continue;
      const col = this.entColor(e);
      this.addLines(this.entPolyline(e), col, this.sel.has(e.id) || this.hov?.id === e.id ? 3 : 2, !!e.cons);
    }
    // noktalar
    const ptCols = new Map<number, number[]>();
    const pushPt = (p: Vec2, col: number) => {
      if (!ptCols.has(col)) ptCols.set(col, []);
      ptCols.get(col)!.push(...this.W(p));
    };
    const shown = new Set<string>();
    for (const e of sk.ents) for (const id of entPoints(e)) shown.add(id);
    for (const id of shown) {
      if (id === ORIGIN) continue;
      const col = this.sel.has(id) ? C.sel : this.hov?.id === id || (this.tool === "dim" && this.st.refs?.includes(id)) ? C.hov : this.result.conflicts.length ? C.over : this.defined.pts.has(id) ? C.full : C.under;
      pushPt(P(sk, id), col);
    }
    if (this.hov?.id === ORIGIN || this.sel.has(ORIGIN)) pushPt([0, 0], this.sel.has(ORIGIN) ? C.sel : C.hov);
    for (const [col, arr] of ptCols) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size: col === C.sel || col === C.hov ? 9 : 6, sizeAttenuation: false, depthTest: false }));
      pts.renderOrder = 30;
      this.group.add(pts);
    }
    this.renderPreview();
    this.renderOpPreview();
    this.renderDims();
    if (this.opts.showRels) this.renderRels();
    v.requestRender();
    this.placeLabels();
  }

  private renderPreview() {
    const st = this.st;
    const cur: Vec2 | null = st.inf?.p ?? this.cursor;
    if (!cur) return;
    const pc = C.prev;
    switch (this.tool) {
      case "line":
      case "centerline":
        if (st.lastPos) this.addLines([st.lastPos, cur], pc, 2, this.tool === "centerline");
        break;
      case "rect":
        if (st.aPos) {
          const a = st.aPos;
          this.addLines([a, [cur[0], a[1]], cur, [a[0], cur[1]], a], pc);
        }
        break;
      case "crect":
        if (st.aPos) {
          const a = st.aPos, dx = cur[0] - a[0], dy = cur[1] - a[1];
          this.addLines([[a[0] - dx, a[1] - dy], [a[0] + dx, a[1] - dy], [a[0] + dx, a[1] + dy], [a[0] - dx, a[1] + dy], [a[0] - dx, a[1] - dy]], pc);
        }
        break;
      case "circle":
        if (st.aPos) this.addLines(this.circlePts(st.aPos, d2(st.aPos, cur)), pc);
        break;
      case "polygon":
        if (st.aPos) {
          const n = Math.max(3, Math.round(this.opts.sides));
          const r = d2(st.aPos, cur), a0 = ang(st.aPos, cur);
          const pts: Vec2[] = [];
          for (let i = 0; i <= n; i++) pts.push([st.aPos[0] + r * Math.cos(a0 + (i / n) * TAU), st.aPos[1] + r * Math.sin(a0 + (i / n) * TAU)]);
          this.addLines(pts, pc);
          this.addLines(this.circlePts(st.aPos, r), pc, 1, true);
        }
        break;
      case "carc":
        if (st.aPos && !st.bPos) this.addLines([st.aPos, cur], pc, 1, true);
        if (st.aPos && st.bPos) {
          this.trackSweep(cur);
          const r = d2(st.aPos, st.bPos);
          const s = ang(st.aPos, st.bPos);
          const sw = st.sweep;
          const pts: Vec2[] = [];
          for (let i = 0; i <= 48; i++) pts.push([st.aPos[0] + r * Math.cos(s + (sw * i) / 48), st.aPos[1] + r * Math.sin(s + (sw * i) / 48)]);
          this.addLines(pts, pc);
        }
        break;
      case "arc3":
        if (st.aPos && !st.bPos) this.addLines([st.aPos, cur], pc, 1, true);
        if (st.aPos && st.bPos) {
          const c = circle3(st.aPos, st.bPos, cur);
          if (c) {
            const a0 = ang(c.c, st.aPos), a1 = ang(c.c, st.bPos);
            const ccw = inArc(ang(c.c, cur), a0, a1);
            const [s, e] = ccw ? [a0, a1] : [a1, a0];
            const span = normAng(e - s);
            const pts: Vec2[] = [];
            for (let i = 0; i <= 48; i++) pts.push([c.c[0] + c.r * Math.cos(s + (span * i) / 48), c.c[1] + c.r * Math.sin(s + (span * i) / 48)]);
            this.addLines(pts, pc);
          }
        }
        break;
      case "tarc":
        if (st.aPos) {
          const g = this.tangentArcGeo(st.aPos, st.tdir, cur);
          if (g) {
            let s = ang(g.c, st.aPos), e = ang(g.c, cur);
            if (!g.ccw) [s, e] = [e, s];
            const span = normAng(e - s);
            const pts: Vec2[] = [];
            for (let i = 0; i <= 48; i++) pts.push([g.c[0] + g.r * Math.cos(s + (span * i) / 48), g.c[1] + g.r * Math.sin(s + (span * i) / 48)]);
            this.addLines(pts, pc);
          }
        }
        break;
      case "slot":
        if (st.aPos && !st.bPos) this.addLines([st.aPos, cur], pc, 1, true);
        if (st.aPos && st.bPos) {
          const a = st.aPos as Vec2, b = st.bPos as Vec2;
          const u = norm2(sub2(b, a)), n = perp(u);
          const w = Math.abs(dot2(sub2(cur, a), n));
          const pts: Vec2[] = [];
          const base = Math.atan2(n[1], n[0]);
          for (let i = 0; i <= 24; i++) pts.push(add2(a, mul2([Math.cos(base + (Math.PI * i) / 24), Math.sin(base + (Math.PI * i) / 24)], w)));
          for (let i = 0; i <= 24; i++) pts.push(add2(b, mul2([Math.cos(base + Math.PI + (Math.PI * i) / 24), Math.sin(base + Math.PI + (Math.PI * i) / 24)], w)));
          pts.push(pts[0]);
          this.addLines(pts, pc);
          this.addLines([a, b], pc, 1, true);
        }
        break;
      case "mline":
        if (st.aPos) this.addLines([[2 * st.aPos[0] - cur[0], 2 * st.aPos[1] - cur[1]], cur], pc);
        break;
      case "crect3":
        if (st.aPos && !st.bPos) this.addLines([st.aPos, cur], pc, 1, true);
        if (st.aPos && st.bPos) {
          const q = this.crect3Pts(st.aPos, st.bPos, cur);
          if (q) this.addLines([...q, q[0]], pc);
        }
        break;
      case "conic":
        if (st.aPos && !st.bPos) this.addLines([st.aPos, cur], pc, 1, true);
        if (st.aPos && st.bPos) {
          const w = this.opts.rho / (1 - this.opts.rho);
          const A = st.aPos as Vec2, B = st.bPos as Vec2;
          const q: Vec2[] = [];
          for (let i = 0; i <= 32; i++) {
            const t = i / 32, u = 1 - t, dd = u * u + 2 * w * u * t + t * t;
            q.push([(u * u * A[0] + 2 * w * u * t * cur[0] + t * t * B[0]) / dd, (u * u * A[1] + 2 * w * u * t * cur[1] + t * t * B[1]) / dd]);
          }
          this.addLines(q, pc);
          this.addLines([A, cur, B], pc, 1, true);
        }
        break;
      case "jog":
        if (st.aPos && st.bPos) {
          const e = getEnt(this.data, st.jog?.id) as SLine | undefined;
          if (e) {
            const u = norm2(sub2(P(this.data, e.p2), P(this.data, e.p1))), n = perp(u);
            const dep = dot2(sub2(cur, st.aPos), n);
            this.addLines([st.aPos, add2(st.aPos, mul2(n, dep)), add2(st.bPos, mul2(n, dep)), st.bPos], pc);
          }
        }
        break;
      case "rect3":
      case "para":
        if (st.aPos && !st.bPos) this.addLines([st.aPos, cur], pc);
        if (st.aPos && st.bPos) {
          const [A, B, Cc, D] = this.quad(st.aPos, st.bPos, cur);
          this.addLines([A, B, Cc, D, A], pc);
        }
        break;
      case "aslot":
        if (st.aPos && !st.bPos) this.addLines([st.aPos, cur], pc, 1, true);
        if (st.aPos && st.bPos) {
          if (!st.e3) this.trackSweep(cur);
          const r = d2(st.aPos, st.bPos), s0 = ang(st.aPos, st.bPos), sw = st.sweep;
          const pts: Vec2[] = [];
          for (let i = 0; i <= 48; i++) pts.push([st.aPos[0] + r * Math.cos(s0 + (sw * i) / 48), st.aPos[1] + r * Math.sin(s0 + (sw * i) / 48)]);
          this.addLines(pts, pc, st.e3 ? 1 : 2, !!st.e3);
          if (st.e3) {
            const g = this.arcSlotGeo(st.aPos, st.bPos, st.sweep, cur);
            if (g) for (const rr of [g.r - g.w, g.r + g.w]) {
              const q: Vec2[] = [];
              for (let i = 0; i <= 48; i++) q.push([g.c[0] + rr * Math.cos(g.a0 + ((g.a1 - g.a0) * i) / 48), g.c[1] + rr * Math.sin(g.a0 + ((g.a1 - g.a0) * i) / 48)]);
              this.addLines(q, pc);
            }
          }
        }
        break;
      case "ellipse":
      case "pellipse":
        if (st.aPos && !st.bPos) this.addLines([st.aPos, cur], pc, 1, true);
        if (st.aPos && st.bPos) {
          const rb = st.rb ?? this.minorFrom(st.aPos, st.bPos, cur);
          const tmp = { id: "_", t: "ellipse" as const, c: "_c", a: "_a", rb };
          const fake: SketchData = { pts: { _c: { x: st.aPos[0], y: st.aPos[1] }, _a: { x: st.bPos[0], y: st.bPos[1] } }, ents: [], rels: [], dims: [], seq: 0 };
          const g = ellipseGeo(fake, tmp);
          const ptsE: Vec2[] = [];
          let t0 = 0, span = TAU;
          if (st.infs?.length === 4) {
            t0 = g.param(st.infs[3].p);
            span = normAng(g.param(cur) - t0) || TAU;
          }
          for (let i = 0; i <= 72; i++) ptsE.push(g.at(t0 + (span * i) / 72));
          this.addLines(ptsE, pc, st.infs?.length >= 3 ? 1 : 2, st.infs?.length === 3);
        }
        break;
      case "parabola":
        if (st.aPos && !st.bPos) this.addLines([st.aPos, cur], pc, 1, true);
        if (st.aPos && st.bPos) {
          const k: Vec2 = [2 * cur[0] - (st.aPos[0] + st.bPos[0]) / 2, 2 * cur[1] - (st.aPos[1] + st.bPos[1]) / 2];
          const q: Vec2[] = [];
          for (let i = 0; i <= 32; i++) {
            const t = i / 32, u = 1 - t;
            q.push([u * u * st.aPos[0] + 2 * u * t * k[0] + t * t * st.bPos[0], u * u * st.aPos[1] + 2 * u * t * k[1] + t * t * st.bPos[1]]);
          }
          this.addLines(q, pc);
        }
        break;
      case "spline":
        if (st.infs?.length) {
          const fake: SketchData = { pts: {}, ents: [], rels: [], dims: [], seq: 0 };
          const ids = [...st.infs.map((x: Inference) => x.p), cur].map((q: Vec2, i: number) => {
            fake.pts["s" + i] = { x: q[0], y: q[1] };
            return "s" + i;
          });
          this.addLines(entSamples(fake, { id: "_", t: "spline", pts: ids }), pc);
        }
        break;
      case "circle3":
        if (st.infs?.length === 1) this.addLines([st.infs[0].p, cur], pc, 1, true);
        if (st.infs?.length === 2) {
          const c = circle3(st.infs[0].p, st.infs[1].p, cur);
          if (c) this.addLines(this.circlePts(c.c, c.r), pc);
        }
        break;
      case "dim":
        if (st.refs?.length) {
          const spec = this.dimSpec(st.refs, cur);
          if (spec) this.drawDim({ ...spec, id: "_", v: Math.abs(measure(this.data, spec)) }, C.prev, true);
        }
        break;
    }
  }

  private circlePts(c: Vec2, r: number): Vec2[] {
    const out: Vec2[] = [];
    for (let i = 0; i <= 72; i++) out.push([c[0] + r * Math.cos((i / 72) * TAU), c[1] + r * Math.sin((i / 72) * TAU)]);
    return out;
  }

  private drawText(e: SText) {
    const el = document.createElement("div");
    const col = this.entColor(e);
    el.className = "sk-text";
    el.textContent = e.text;
    el.style.color = "#" + col.toString(16).padStart(6, "0");
    const px = e.size / this.wpp();
    el.style.fontSize = px * 1.05 + "px";
    el.style.lineHeight = "1";
    this.labelBox.appendChild(el);
    const q = P(this.data, e.p);
    // metin taban çizgisi sol alt köşededir
    this.anchors.push({ el, w: this.W(q), dx: 0, dy: 0, text: { angle: e.angle } } as any);
  }

  // ---------------- Ölçü çizimi ----------------
  private renderDims() {
    const bad = new Set([...this.result.conflicts, ...this.result.redundant]);
    for (const d of this.data.dims) {
      if (d.ref) d.v = Math.abs(measure(this.data, d));
      this.drawDim(d, bad.has(d.id) ? C.over : this.sel.has(d.id) ? C.sel : C.dim, false);
    }
  }

  private arrow(at: Vec2, dir: Vec2, color: number) {
    const s = 9 * this.wpp();
    const u = norm2(dir);
    const rot = (v: Vec2, a: number): Vec2 => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
    const b1 = sub2(at, mul2(rot(u, 0.35), s)), b2 = sub2(at, mul2(rot(u, -0.35), s));
    this.addLines([b1, at, b2], color, 1.5);
  }

  private drawDim(d: SDim, color: number, preview: boolean) {
    const sk = this.data;
    const g = 4 * this.wpp();
    const L = d.lp;
    let text = "";
    if (d.t === "dist") {
      const A = P(sk, d.refs[0]), B = P(sk, d.refs[1]);
      const u: Vec2 = d.sub === "h" ? [1, 0] : d.sub === "v" ? [0, 1] : norm2(sub2(B, A));
      if (len2(sub2(B, A)) < 1e-9) return;
      const n = perp(u);
      const A2 = add2(A, mul2(n, dot2(sub2(L, A), n)));
      const B2 = add2(B, mul2(n, dot2(sub2(L, B), n)));
      const sgnA = Math.sign(dot2(sub2(A2, A), n)) || 1, sgnB = Math.sign(dot2(sub2(B2, B), n)) || 1;
      this.addLines([add2(A, mul2(n, sgnA * g)), add2(A2, mul2(n, sgnA * g))], color, 1);
      this.addLines([add2(B, mul2(n, sgnB * g)), add2(B2, mul2(n, sgnB * g))], color, 1);
      const tA = dot2(sub2(A2, A2), u), tB = dot2(sub2(B2, A2), u), tL = dot2(sub2(L, A2), u);
      const lo = Math.min(tA, tB, tL), hi = Math.max(tA, tB, tL);
      this.addLines([add2(A2, mul2(u, lo)), add2(A2, mul2(u, hi))], color, 1);
      const dirAB = norm2(sub2(B2, A2));
      this.arrow(A2, mul2(dirAB, -1), color);
      this.arrow(B2, dirAB, color);
      text = fmtNum(Math.abs(d.v), 2);
    } else if (d.t === "dia" || d.t === "rad") {
      const e = getEnt(sk, d.refs[0]) as SCircle | SArc;
      if (!e) return;
      const c = P(sk, e.c);
      const u = norm2(sub2(L, c));
      const r = e.r;
      const rim = add2(c, mul2(u, r));
      if (d.t === "dia") {
        const rim2 = add2(c, mul2(u, -r));
        const far = len2(sub2(L, c)) > r ? L : rim;
        this.addLines([rim2, far], color, 1);
        this.arrow(rim, u, color);
        this.arrow(rim2, mul2(u, -1), color);
        text = "Ø" + fmtNum(Math.abs(d.v), 2);
      } else {
        const far = len2(sub2(L, c)) > r ? L : rim;
        this.addLines([c, far], color, 1);
        this.arrow(rim, u, color);
        text = "R" + fmtNum(Math.abs(d.v), 2);
      }
    } else if (d.t === "angle") {
      const l1 = getEnt(sk, d.refs[0]) as SLine, l2 = getEnt(sk, d.refs[1]) as SLine;
      if (!l1 || !l2) return;
      const A1 = P(sk, l1.p1), A2 = P(sk, l1.p2), B1 = P(sk, l2.p1), B2 = P(sk, l2.p2);
      const x = lineLine(A1, A2, B1, B2);
      if (x) {
        const R = d2(L, x.p);
        const a1 = Math.atan2(A2[1] - A1[1], A2[0] - A1[0]);
        const sw = ((d.sgn ?? 1) * Math.abs(d.v) * Math.PI) / 180;
        const pts: Vec2[] = [];
        for (let i = 0; i <= 32; i++) pts.push(add2(x.p, mul2([Math.cos(a1 + (sw * i) / 32), Math.sin(a1 + (sw * i) / 32)], R)));
        this.addLines(pts, color, 1);
      }
      text = fmtNum(Math.abs(d.v), 2) + "°";
    } else if (d.t === "alen") {
      const e = getEnt(sk, d.refs[0]) as SArc;
      if (!e) return;
      const c = P(sk, e.c), a0 = P(sk, e.s), a1 = P(sk, e.e);
      const R = Math.max(e.r + 3 * g, d2(L, c));
      const t0 = Math.atan2(a0[1] - c[1], a0[0] - c[0]);
      let sw = Math.atan2(a1[1] - c[1], a1[0] - c[0]) - t0;
      if (sw <= 0) sw += TAU;
      const pts: Vec2[] = [];
      for (let i = 0; i <= 32; i++) pts.push(add2(c, mul2([Math.cos(t0 + (sw * i) / 32), Math.sin(t0 + (sw * i) / 32)], R)));
      this.addLines(pts, color, 1);
      this.addLines([a0, pts[0]], color, 1);
      this.addLines([a1, pts[32]], color, 1);
      text = "⌒" + fmtNum(Math.abs(d.v), 2);
    } else if (d.t === "cl" || d.t === "cc") {
      const c1 = getEnt(sk, d.refs[0]) as SCircle;
      const o = getEnt(sk, d.refs[1]) as any;
      if (!c1 || !o) return;
      const C1 = P(sk, c1.c);
      let A: Vec2, B: Vec2;
      if (d.t === "cl") {
        const la = P(sk, o.p1), lb = P(sk, o.p2);
        const u = norm2(sub2(lb, la));
        const F = add2(la, mul2(u, dot2(sub2(C1, la), u)));
        const dir = norm2(sub2(F, C1));
        A = add2(C1, mul2(dir, c1.r));
        B = F;
      } else {
        const C2 = P(sk, o.c);
        const dir = norm2(sub2(C2, C1));
        A = add2(C1, mul2(dir, c1.r));
        B = add2(C2, mul2(dir, -o.r));
      }
      this.addLines([A, B], color, 1);
      const dir = norm2(sub2(B, A));
      this.arrow(B, dir, color);
      this.arrow(A, mul2(dir, -1), color);
      text = fmtNum(Math.abs(d.v), 2);
    } else if (d.t === "pldist") {
      const ea = getEnt(sk, d.refs[0]), eb = getEnt(sk, d.refs[1]);
      let p: Vec2, l: SLine;
      if (ea?.t === "line" && eb?.t === "line") [p, l] = [P(sk, eb.p1), ea];
      else if (ea && (ea.t === "circle" || ea.t === "arc")) [p, l] = [P(sk, ea.c), eb as SLine];
      else [p, l] = [P(sk, d.refs[0]), eb as SLine];
      if (!l) return;
      const A = P(sk, l.p1), B = P(sk, l.p2);
      const u = norm2(sub2(B, A));
      const F = add2(A, mul2(u, dot2(sub2(p, A), u)));
      const k = dot2(sub2(L, F), u);
      const p2 = add2(p, mul2(u, k)), F2 = add2(F, mul2(u, k));
      this.addLines([p, p2], color, 1);
      this.addLines([F, F2], color, 1);
      this.addLines([p2, F2], color, 1);
      const dir = norm2(sub2(F2, p2));
      this.arrow(F2, dir, color);
      this.arrow(p2, mul2(dir, -1), color);
      text = fmtNum(Math.abs(d.v), 2);
    }
    const el = document.createElement("div");
    el.className = "dim" + (preview ? " preview" : "") + (color === C.over ? " err" : color === C.sel ? " sel" : "") + (d.ref ? " ref" : "");
    el.textContent = d.ref ? `(${text})` : d.expr ? `Σ ${text}` : text;
    this.labelBox.appendChild(el);
    this.anchors.push({ el, w: this.W(L) });
    if (!preview) this.wireDimLabel(el, d);
  }

  private wireDimLabel(el: HTMLElement, d: SDim) {
    let start: { x: number; y: number; moved: boolean } | null = null;
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY, moved: false };
    });
    el.addEventListener("pointermove", (e) => {
      if (!start) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) start.moved = true;
      if (start.moved) {
        const p = this.local(e);
        if (p) {
          d.lp = p;
          this.render();
        }
      }
    });
    el.addEventListener("pointerup", (e) => {
      if (!start) return;
      const moved = start.moved;
      start = null;
      if (moved) return this.host.changed();
      if (this.tool === "select" && this.sel.size && !this.sel.has(d.id)) {
        this.sel.add(d.id);
        this.render();
        this.renderPanel();
        return;
      }
      this.editDim(d, e.clientX, e.clientY);
    });
  }

  // ---------------- İlişki simgeleri ----------------
  private renderRels() {
    const sk = this.data;
    const counts = new Map<string, number>();
    const bad = new Set([...this.result.conflicts, ...this.result.redundant]);
    const eqPts = new Set(sk.ents.flatMap((e) => (e.t === "spline" && (e as any).eq ? e.pts : [])));
    const place = (key: string, pos: Vec2, r: (typeof sk.rels)[0]) => {
      if (r.t === "fix" && eqPts.has(r.refs[0]) && !bad.has(r.id)) return;
      const k = counts.get(key) ?? 0;
      counts.set(key, k + 1);
      const el = document.createElement("div");
      el.className = "rel" + (this.sel.has(r.id) ? " sel" : "") + (bad.has(r.id) ? " err" : "");
      el.textContent = REL_GLYPH[r.t];
      el.title = REL_NAMES[r.t];
      el.addEventListener("pointerdown", (e) => e.stopPropagation());
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.tool !== "select") this.setTool("select");
        if (this.sel.has(r.id)) this.sel.delete(r.id);
        else this.sel.add(r.id);
        this.render();
        this.renderPanel();
      });
      this.labelBox.appendChild(el);
      this.anchors.push({ el, w: this.W(pos), dx: 10 + k * 16, dy: -16 });
    };
    const anchorOf = (id: string): Vec2 | null => {
      const e = getEnt(sk, id);
      if (!e) return id === ORIGIN || sk.pts[id] ? P(sk, id) : null;
      if (e.t === "line") return mul2(add2(P(sk, e.p1), P(sk, e.p2)), 0.5);
      if (e.t === "circle") return add2(P(sk, e.c), mul2([Math.SQRT1_2, Math.SQRT1_2], e.r));
      if (e.t === "arc") {
        const { c, s, e: en } = arcAngles(sk, e);
        return arcMid(c, e.r, s, en);
      }
      return P(sk, (e as any).p);
    };
    for (const r of sk.rels) {
      const targets = r.t === "symmetric" ? [r.refs[0], r.refs[1]] : r.t === "onLine" || r.t === "onCircle" || r.t === "midpoint" ? [r.refs[0]] : r.refs;
      for (const id of targets) {
        const a = anchorOf(id);
        if (a) place(id, a, r);
      }
    }
  }

  private placeLabels() {
    const v = this.host.viewer;
    for (const a of this.anchors as any[]) {
      const [x, y] = v.toScreen(a.w);
      if (a.text) {
        a.el.style.transformOrigin = "0 100%";
        a.el.style.transform = `translate(${x}px, ${y}px) translate(0, -100%) rotate(${-a.text.angle}deg)`;
      } else a.el.style.transform = `translate(${x + (a.dx ?? 0)}px, ${y + (a.dy ?? 0)}px) translate(-50%, -50%)`;
    }
  }

  // ---------------- Panel ----------------
  renderPanel() {
    const box = this.host.panel;
    box.innerHTML = "";
    const h = (tag: string, cls = "", text = "") => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (text) el.textContent = text;
      return el;
    };
    const title = h("div", "pm-title", TOOL_NAMES[this.tool]);
    box.appendChild(title);
    const hint = HINTS[this.tool];
    if (hint && (this.tool !== "select" || !this.sel.size)) box.appendChild(h("p", "pm-hint", hint));

    if (this.tool === "conic") box.appendChild(this.numField("Rho (0,05–0,95)", this.opts.rho, (v) => (this.opts.rho = Math.max(0.05, Math.min(0.95, v)))));
    if (this.tool === "ordinate") {
      const sel = document.createElement("select");
      sel.innerHTML = `<option value="h">Yatay (X) koordinat</option><option value="v">Dikey (Y) koordinat</option>`;
      sel.value = this.opts.ordDir;
      sel.addEventListener("change", () => (this.opts.ordDir = sel.value as any));
      box.appendChild(sel);
      if (this.st.base) {
        const b = h("button", "btn", "Yeni sıfır noktası seç");
        b.addEventListener("click", () => ((this.st = {}), this.renderPanel()));
        box.appendChild(b);
      }
    }
    if (this.tool === "dim") {
      const mk = (label: string, key: "arcLen" | "edgeDim") => {
        const l = h("label", "pm-check");
        const c = document.createElement("input");
        c.type = "checkbox";
        c.checked = this.opts[key];
        c.addEventListener("change", () => (this.opts[key] = c.checked));
        l.append(c, document.createTextNode(" " + label));
        box.appendChild(l);
      };
      mk("Yayda yay uzunluğunu ölç", "arcLen");
      mk("Dairede merkez yerine en yakın kenar", "edgeDim");
    }
    if (this.tool === "eqcurve") {
      const sel = document.createElement("select");
      sel.innerHTML = `<option value="y">Açık: y = f(x)</option><option value="t">Parametrik: x(t), y(t)</option>`;
      sel.value = this.opts.eqMode;
      sel.addEventListener("change", () => ((this.opts.eqMode = sel.value as any), this.renderPanel()));
      box.appendChild(sel);
      if (this.opts.eqMode === "y") box.appendChild(this.textField("y(x) =", this.opts.eqY, (v) => (this.opts.eqY = v)));
      else {
        box.appendChild(this.textField("x(t) =", this.opts.eqX, (v) => (this.opts.eqX = v)));
        box.appendChild(this.textField("y(t) =", this.opts.eqYt, (v) => (this.opts.eqYt = v)));
      }
      box.appendChild(this.numField(this.opts.eqMode === "y" ? "x başlangıç" : "t başlangıç", this.opts.eqA, (v) => (this.opts.eqA = v), { any: true }));
      box.appendChild(this.numField(this.opts.eqMode === "y" ? "x bitiş" : "t bitiş", this.opts.eqB, (v) => (this.opts.eqB = v), { any: true }));
      box.appendChild(this.numField("Nokta sayısı", this.opts.eqN, (v) => (this.opts.eqN = v)));
      box.appendChild(h("p", "pm-hint", "Fonksiyonlar: sin, cos, tan (derece), sqrt, abs, pi; global değişkenler de kullanılabilir."));
      const b = h("button", "btn primary", "Eğriyi oluştur");
      b.addEventListener("click", () => this.createEquationCurve());
      box.appendChild(b);
    }
    if (this.tool === "picture") {
      const pc = this.data.pic;
      if (!pc) box.appendChild(h("p", "pm-hint", "Bu eskizde resim yok. Komut çubuğundaki 'Eskiz Resmi' ile fotoğraf seçin veya çekin."));
      else {
        const set = (fn: (q: NonNullable<SketchData["pic"]>) => void) => {
          this.op(() => fn(this.data.pic!));
          this.render();
        };
        box.appendChild(this.numField("Genişlik (mm)", pc.w, (v) => v > 0 && set((q) => (q.w = v))));
        box.appendChild(this.numField("Merkez X", pc.x, (v) => set((q) => (q.x = v)), { any: true }));
        box.appendChild(this.numField("Merkez Y", pc.y, (v) => set((q) => (q.y = v)), { any: true }));
        box.appendChild(this.numField("Döndür (°)", pc.rot, (v) => set((q) => (q.rot = v)), { any: true }));
        box.appendChild(this.numField("Saydamlık (%)", Math.round((1 - pc.op) * 100), (v) => set((q) => (q.op = Math.max(0.05, Math.min(1, 1 - v / 100)))), { any: true }));
        const fl = h("button", "btn", pc.flip ? "Aynalamayı kaldır" : "Yatay aynala");
        fl.addEventListener("click", () => (set((q) => (q.flip = !q.flip)), this.renderPanel()));
        const cal = h("button", "btn primary", this.st.cal ? "İlk noktaya dokunun…" : "İki noktayla ölçekle");
        cal.addEventListener("click", () => {
          this.st = { cal: true, calPts: [] };
          this.host.toast("Resimde ölçüsünü bildiğiniz ilk noktaya dokunun");
          this.renderPanel();
        });
        const rm = h("button", "btn danger", "Resmi kaldır");
        rm.addEventListener("click", () => {
          this.op(() => delete this.data.pic);
          this.host.changed();
          this.renderPanel();
        });
        const row = h("div", "pm-buttons");
        row.append(cal, fl, rm);
        box.appendChild(row);
      }
    }
    if (this.tool === "polygon") box.appendChild(this.numField("Kenar sayısı", this.opts.sides, (v) => (this.opts.sides = Math.max(3, Math.round(v)))));
    if (this.tool === "fillet") box.appendChild(this.numField("Yarıçap", this.opts.filletR, (v) => (this.opts.filletR = v)));
    if (this.tool === "schamfer") box.appendChild(this.numField("Mesafe", this.opts.chamferD, (v) => (this.opts.chamferD = v)));
    if (this.tool === "spline" && this.st.infs?.length >= 2) {
      const b = h("button", "btn primary", "Spline'ı bitir");
      b.addEventListener("click", () => this.finishSpline(false));
      box.appendChild(b);
    }
    if (this.tool === "text") {
      box.appendChild(this.textField("Metin", this.opts.text, (v) => (this.opts.text = v)));
      box.appendChild(this.numField("Yükseklik (mm)", this.opts.textSize, (v) => (this.opts.textSize = v)));
      box.appendChild(this.numField("Açı (°)", this.opts.textAngle, (v) => (this.opts.textAngle = v), { any: true }));
    }
    if (OP_TOOLS.includes(this.tool)) this.opPanel(box, h);
    if ((this.tool === "line" || this.tool === "centerline") && this.st.last) {
      const b = h("button", "btn", "Zinciri bitir");
      b.addEventListener("click", () => this.finishChain());
      box.appendChild(b);
    }
    if (this.tool !== "select" && this.chainActive() && this.tool !== "line") {
      const b = h("button", "btn", "Vazgeç");
      b.addEventListener("click", () => this.finishChain());
      box.appendChild(b);
    }

    if (this.tool === "select" && this.sel.size) {
      const sk = this.data;
      const ids = [...this.sel];
      const names = ids.map((id) => {
        const e = getEnt(sk, id);
        if (e) return ({ line: "Çizgi", circle: "Daire", arc: "Yay", point: "Nokta", ellipse: "Elips", spline: "Spline", parabola: "Parabol", text: "Metin" } as Record<string, string>)[e.t] + (e.cons ? " (yapı)" : "");
        if (id === ORIGIN) return "Orijin";
        if (sk.pts[id]) return "Nokta";
        const r = sk.rels.find((x) => x.id === id);
        if (r) return "İlişki: " + REL_NAMES[r.t];
        const d = sk.dims.find((x) => x.id === id);
        if (d) return "Ölçü";
        return id;
      });
      box.appendChild(h("div", "pm-sub", `Seçili (${ids.length})`));
      const ul = h("ul", "pm-list");
      names.forEach((n) => ul.appendChild(h("li", "", n)));
      box.appendChild(ul);

      if (ids.length === 1) {
        const e = getEnt(sk, ids[0]);
        if (e?.t === "ellipse") {
          const g = ellipseGeo(sk, e);
          box.appendChild(h("p", "pm-hint", `Büyük yarıçap ${fmtNum(g.rx, 2)} (merkez–uç ölçüsüyle)`));
          box.appendChild(this.numField("Küçük yarıçap", e.rb, (v) => this.op(() => (e.rb = v))));
        }
        if (e?.t === "parabola") box.appendChild(this.numField("Rho (0,5 = parabol)", e.rho ?? 0.5, (v) => this.op(() => (e.rho = Math.max(0.05, Math.min(0.95, v))))));
        if (e?.t === "text") {
          box.appendChild(this.textField("Metin", e.text, (v) => this.op(() => (e.text = v))));
          box.appendChild(this.numField("Yükseklik", e.size, (v) => this.op(() => (e.size = v))));
          box.appendChild(this.numField("Açı (°)", e.angle, (v) => this.op(() => (e.angle = v)), { any: true }));
        }
        const dd = sk.dims.find((x) => x.id === ids[0]);
        if (dd) {
          const b = h("button", "btn", dd.ref ? "Sürücü ölçü yap" : "Referans ölçü yap");
          b.addEventListener("click", () => this.toggleRefDim(dd.id));
          box.appendChild(b);
          if (dd.expr) box.appendChild(h("p", "pm-hint", `Denklem: ${dd.expr}`));
        }
        if (e?.t === "line") {
          const A = P(sk, e.p1), B = P(sk, e.p2);
          box.appendChild(h("p", "pm-hint", `Uzunluk ${fmtNum(d2(A, B), 2)} · Açı ${fmtNum((Math.atan2(B[1] - A[1], B[0] - A[0]) * 180) / Math.PI, 2)}°`));
        } else if (e && (e.t === "circle" || e.t === "arc")) box.appendChild(h("p", "pm-hint", `Yarıçap ${fmtNum(e.r, 2)}`));
      }

      const opts = applicableRelations(sk, ids);
      if (opts.length) {
        box.appendChild(h("div", "pm-sub", "İlişki ekle"));
        const wrap = h("div", "pm-buttons");
        for (const o of opts) {
          const b = h("button", "btn rel-btn", `${REL_GLYPH[o.t]} ${o.label}`);
          b.addEventListener("click", () => this.addRelations(o));
          wrap.appendChild(b);
        }
        box.appendChild(wrap);
      }
      const existing = new Map<string, (typeof sk.rels)[0]>();
      ids.forEach((id) => relationsOf(sk, id).forEach((r) => existing.set(r.id, r)));
      if (existing.size) {
        box.appendChild(h("div", "pm-sub", "Mevcut ilişkiler"));
        const ul2 = h("ul", "pm-list");
        for (const r of existing.values()) {
          const li = h("li", "pm-rel");
          li.appendChild(h("span", "", `${REL_GLYPH[r.t]} ${REL_NAMES[r.t]}`));
          const x = h("button", "x", "✕");
          x.title = "İlişkiyi sil";
          x.addEventListener("click", () => this.op(() => deleteIds(this.data, [r.id])));
          li.appendChild(x);
          ul2.appendChild(li);
        }
        box.appendChild(ul2);
      }
      const row = h("div", "pm-buttons");
      const cons = h("button", "btn", "Yapı geometrisi");
      cons.addEventListener("click", () => this.toggleConstruction());
      const del = h("button", "btn danger", "Sil");
      del.addEventListener("click", () => this.deleteSelection());
      row.append(cons, del);
      box.appendChild(row);
    }

    // genel seçenekler
    const qd = h("label", "pm-check");
    const qc = document.createElement("input");
    qc.type = "checkbox";
    qc.checked = this.opts.quickDim;
    qc.addEventListener("change", () => {
      this.opts.quickDim = qc.checked;
      try {
        localStorage.setItem("imajcad.quickDim", qc.checked ? "1" : "0");
      } catch {}
    });
    qd.append(qc, document.createTextNode(" Çizdikten sonra ölçü gir"));
    box.appendChild(qd);
    if (this.dynAxis && getEnt(this.data, this.dynAxis)) {
      const b = h("button", "btn", "Dinamik aynayı kapat");
      b.addEventListener("click", () => ((this.dynAxis = null), this.renderPanel(), this.render()));
      box.appendChild(h("p", "pm-hint", "Dinamik ayna açık: çizilen her öğe eksene göre aynalanır."));
      box.appendChild(b);
    } else if (this.tool === "select" && this.sel.size === 1 && getEnt(this.data, [...this.sel][0])?.t === "line") {
      const b = h("button", "btn", "Dinamik ayna ekseni yap");
      b.addEventListener("click", () => {
        this.dynAxis = [...this.sel][0];
        this.host.toast("Dinamik ayna açık: çizdikleriniz bu çizgiye göre aynalanacak");
        this.renderPanel();
      });
      box.appendChild(b);
    }

    const r = this.result;
    const info = h("p", "pm-status " + (!r.ok || r.conflicts.length ? "over" : r.dof === 0 ? "ok" : "under"));
    info.textContent = !r.ok || r.conflicts.length ? "Aşırı tanımlı: kırmızı ilişki/ölçüyü silin" : r.dof === 0 ? "Eskiz tam tanımlı" : `Eskiz tanımlanmamış (${r.dof} serbestlik). Mavi öğeler hareket edebilir.`;
    box.appendChild(info);
  }

  private opPanel(box: HTMLElement, h: (tag: string, cls?: string, text?: string) => HTMLElement) {
    const o = this.opts;
    const num = (label: string, key: keyof typeof o, opts: { min?: number; any?: boolean } = {}) =>
      box.appendChild(this.numField(label, o[key] as number, (v) => ((o as any)[key] = v), opts));
    const chk = (label: string, key: keyof typeof o) => {
      const l = h("label", "pm-check");
      const c = document.createElement("input");
      c.type = "checkbox";
      c.checked = !!o[key];
      c.addEventListener("change", () => {
        (o as any)[key] = c.checked;
        this.render();
      });
      l.append(c, document.createTextNode(label));
      box.appendChild(l);
    };
    box.appendChild(h("div", "pm-sub", `Seçili: ${this.selEnts().length} öğe`));
    switch (this.tool) {
      case "offset":
        num("Mesafe", "offD");
        chk("Yönü ters çevir", "offRev");
        break;
      case "mirror":
        box.appendChild(h("p", "pm-hint", "Eksen: seçimdeki merkez çizgisi (yoksa son seçilen çizgi)."));
        break;
      case "spat":
        box.appendChild(h("div", "pm-sub", "Yön 1"));
        num("Adet", "n1", { min: 1 });
        num("Aralık", "s1", { any: true });
        num("Açı (°)", "a1", { any: true });
        box.appendChild(h("div", "pm-sub", "Yön 2"));
        num("Adet", "n2", { min: 1 });
        num("Aralık", "s2", { any: true });
        num("Açı (°)", "a2", { any: true });
        break;
      case "scpat":
        num("Adet", "cn", { min: 2 });
        num("Toplam açı (°)", "ctotal");
        break;
      case "move":
        num("X öteleme", "mdx", { any: true });
        num("Y öteleme", "mdy", { any: true });
        num("Döndürme açısı (°)", "mang", { any: true });
        num("Ölçek", "mscale", { min: 1e-6 });
        chk("Kopyala (orijinali koru)", "mcopy");
        break;
    }
    const b = h("button", "btn primary", "Uygula");
    b.addEventListener("click", () => this.applyOp());
    box.appendChild(b);
  }

  private textField(label: string, val: string, set: (v: string) => void) {
    const l = document.createElement("label");
    l.className = "pm-field";
    l.textContent = label;
    const inp = document.createElement("input");
    inp.value = val;
    inp.addEventListener("change", () => {
      set(inp.value);
      this.render();
    });
    inp.addEventListener("keydown", (ev) => ev.stopPropagation());
    l.appendChild(inp);
    return l;
  }

  private numField(label: string, val: number, set: (v: number) => void, o: { min?: number; any?: boolean } = {}) {
    const l = document.createElement("label");
    l.className = "pm-field";
    l.textContent = label;
    const inp = document.createElement("input");
    inp.inputMode = "decimal";
    inp.value = fmtNum(val, 3);
    inp.addEventListener("input", () => {
      const v = evalNum(inp.value);
      const ok = v !== null && (o.any || v >= (o.min ?? 1e-9));
      inp.classList.toggle("bad", !ok);
      if (ok) {
        set(v!);
        this.render();
      }
    });
    inp.addEventListener("keydown", (ev) => ev.stopPropagation());
    l.appendChild(inp);
    return l;
  }

  /** Eskiz noktalarının dünya koordinatlarında sınırları */
  bounds(): [Vec3, Vec3] | null {
    const ids = Object.keys(this.data.pts);
    if (!ids.length) return null;
    const mn: Vec3 = [Infinity, Infinity, Infinity], mx: Vec3 = [-Infinity, -Infinity, -Infinity];
    const addP = (q: Vec2) => {
      const w = this.W(q);
      for (let i = 0; i < 3; i++) {
        mn[i] = Math.min(mn[i], w[i]);
        mx[i] = Math.max(mx[i], w[i]);
      }
    };
    for (const id of ids) addP(P(this.data, id));
    for (const e of this.data.ents) if (e.t === "circle" || e.t === "arc") {
      const c = P(this.data, e.c);
      addP([c[0] - e.r, c[1] - e.r]);
      addP([c[0] + e.r, c[1] + e.r]);
    }
    return [mn, mx];
  }

  hasContent() {
    return this.data.ents.length > 0;
  }
}
