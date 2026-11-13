// Eskiz düzenleyici: SolidWorks mantığında çizim araçları, otomatik ilişkiler,
// akıllı ölçü, sürükleyerek düzenleme, kırpma, radyüs ve tanımlılık renkleri.
import * as THREE from "three";
import type { Frame, RelType, SArc, SCircle, SDim, SEnt, SLine, SketchData, Vec2, Vec3, SectionItem, SEllipse, SText, SSpline } from "../doc/types";
import { ORIGIN } from "../doc/types";
import { evalNum, fmtNum, toLocal, toWorld, dot, sub } from "../doc/math";
import type { InputHandler, Viewer } from "../viewer";
import { solve, analyze, type SolveResult } from "./solver";
import { pictureMesh } from "./picture";
import { autoDefine } from "./define";
import { traceImage, imageDataOf } from "./trace";
import { prefs } from "../input/prefs";
import { offsetEnts, mirrorEnts, linearPattern, circularPattern, moveEnts, centroid } from "./ops";
import {
  P, addArc, addCircle, addLine, addPointEnt, addPt, addRel, applicableRelations, arcAngles, cleanup, deleteIds,
  entPoints, getEnt, lineAngleSign, measure, nid, relationsOf, REL_GLYPH, REL_NAMES, usersOf, entSamples, ellipseGeo, replacePoint, splineHandle,
} from "./model";
import { extractLoops, segPoints, textAlong } from "./profile";
import {
  add2, ang, arcMid, circle3, circleCircle, crs2, d2, dot2, inArc, len2, lineCircle, lineLine, mul2, nearestOnArc,
  nearestOnSeg, niceStep, norm2, normAng, perp, pointInPoly, sub2, TAU,
} from "./geom";

import { lenTxt, units } from "../doc/math";
import { recognize, hvOf, shapeName, rectCorners, outline, type Shape } from "./freehand";

export type SkTool =
  | "select" | "free" | "line" | "centerline" | "rect" | "crect" | "circle" | "carc" | "tarc" | "arc3"
  | "slot" | "polygon" | "point" | "fillet" | "trim" | "dim"
  | "rect3" | "para" | "circle3" | "schamfer" | "extend" | "convert"
  | "offset" | "mirror" | "spat" | "scpat" | "move"
  | "cslot" | "aslot" | "ellipse" | "pellipse" | "parabola" | "spline" | "text" | "isect" | "picture"
  | "mline" | "crect3" | "conic" | "eqcurve" | "split" | "jog" | "ordinate" | "block" | "pierce";

/** "3, 5" ya da "2,1; 3,2" → örnek anahtarları */
const skipList = (t: string) => t.split(/[;\s]+/).map((x) => x.trim()).filter(Boolean).flatMap((x) => (/^\d+,\d+$/.test(x) ? [x] : x.split(",").filter(Boolean)));

/** Seçim üzerinde çalışan işlem araçları */
export const OP_TOOLS: SkTool[] = ["offset", "mirror", "spat", "scpat", "move"];

export const TOOL_NAMES: Record<SkTool, string> = {
  select: "Seç",
  free: "Serbest Çizim",
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
  pierce: "Delme İlişkisi",
  offset: "Varlıkları Ötele",
  mirror: "Varlıkları Aynala",
  spat: "Doğrusal Eskiz Çoğaltma",
  scpat: "Dairesel Eskiz Çoğaltma",
  move: "Taşı / Kopyala / Döndür / Ölçekle",
  cslot: "Merkez Noktalı Kanal",
  aslot: "Yay Kanal",
  picture: "Eskiz Resmi",
  mline: "Orta Nokta Çizgisi",
  block: "Blok Ekle",
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
  block: "Listeden bir blok seçin ve eklenecek yere dokunun. Blok kaydetmek için Seç aracıyla öğeleri seçip 'Blok olarak kaydet'e basın.",
  crect3: "Merkez → bir kenarın ortası (yön) → köşe.",
  conic: "Başlangıç → bitiş → teğetlerin kesişimi (tepe). Biçim rho ile ayarlanır.",
  eqcurve: "y = f(x) veya parametrik x(t), y(t) yazın; eğri spline olarak oluşturulur.",
  split: "Ayırmak istediğiniz yerde çizgiye / yaya dokunun. Daire için iki noktaya dokunun.",
  jog: "Çizgi üzerinde kademe başlangıcı → bitişi → kademe derinliği.",
  ordinate: "Önce sıfır noktasına (ör. orijin), sonra ölçülecek noktalara dokunun.",
  picture: "Resmi gerçek ölçüye getirmek için 'İki noktayla ölçekle'ye basın, resimde ölçüsünü bildiğiniz iki noktaya dokunun ve gerçek mesafeyi girin.",
  select: "Öğelere dokunarak seçin, sürükleyerek şekli değiştirin. Ölçüye dokunarak değerini değiştirin.",
  free: "Basılı tutup şekli kabaca çizin, bırakmadan bir an bekleyin: çizgi / yay / daire / çokgene dönüşür. Bırakınca eklenir. Bekleme yapmadan bırakırsanız da tanınır.",
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
  pierce: "Önce eskiz noktasını seçin, sonra eskiz düzlemini delen model kenarına dokunun (nokta kenarın düzlemi kestiği yere sabitlenir).",
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
interface Guide {
  a: Vec2;
  b: Vec2;
  /** true: ilişki eklenir (sarı), false: yalnız hizalama (mavi) */
  rel: boolean;
}
interface Inference {
  p: Vec2;
  ptId?: string;
  on?: { id: string; t: "line" | "circle" | "arc" };
  /** kesişim: ikinci eğri */
  on2?: { id: string; t: "line" | "circle" | "arc" };
  mid?: string;
  hv?: "h" | "v";
  /** zincirdeki önceki eğriye göre ilişki (yeni çizgiye) */
  lineRel?: { t: "perpendicular" | "collinear" | "tangent"; ref: string };
  guides?: Guide[];
  /** model noktasına bağla (sabit) */
  fixAt?: Vec2;
  /** model kenarı üzerinde (modelLines indeksi) */
  onModel?: number;
  /** dikdörtgen merkezi: köşegen uç noktaları */
  rectC?: [string, string];
  /** çeyrek noktası: 0 sağ, 1 üst, 2 sol, 3 alt (merkezle yatay/dikey hizalanır) */
  quad?: number;
  glyph?: string;
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
  /** son basışın değiştirici tuşları (SolidWorks: Ctrl/Shift ile çoklu seçim) */
  private mods = { add: false, mouse: false };
  /** pencere / kesişen seçim kutusu */
  private boxSel: { x0: number; y0: number; x1: number; y1: number; el: HTMLDivElement } | null = null;
  private lastClick = { t: 0, p: [0, 0] as Vec2 };
  private offRender: () => void;
  opts = {
    sides: 6, filletR: 5, chamferD: 3, showRels: true, chainDim: false, comb: false, combScale: 1, ...(() => { try { const o = JSON.parse(localStorage.getItem("imajcad.skset") || "{}"); return { gridStep: +o.gridStep || 0, angSnap: +o.angSnap || 0 }; } catch { return { gridStep: 0, angSnap: 0 }; } })(), slotDims: "none" as "none" | "cc" | "total", textFont: "",
    gridSnap: (() => {
      try {
        return localStorage.getItem("imajcad.gridSnap") === "1";
      } catch {
        return false;
      }
    })(),
    offD: 5, offRev: false,
    n1: 3, s1: 20, a1: 0, n2: 1, s2: 20, a2: 90, pskip: "",
    cn: 6, ctotal: 360,
    mdx: 20, mdy: 0, mang: 0, mcopy: false, mscale: 1, mkind: "all" as "all" | "move" | "copy" | "rot" | "scale" | "stretch", convInner: false,
    text: "İMAJ", textSize: 10, textAngle: 0,
    rho: 0.6, ordDir: "h" as "h" | "v", arcLen: false, edgeDim: false, block: "",
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
    try {
      this.loadModelRefs();
    } catch {}
    this.fixOldQuads();
    this.labelBox = document.createElement("div");
    host.viewer.labels.appendChild(this.labelBox);
    this.offRender = host.viewer.onRender(() => this.placeLabels());
    this.resolve();
    this.render();
    this.renderPanel();
  }

  dispose() {
    document.querySelector(".dim-prompt.quick")?.remove();
    this.clearGroup();
    this.host.viewer.overlay.remove(this.group);
    this.labelBox.remove();
    this.offRender();
    this.hideBadge();
    this.boxSel?.el.remove();
    this.host.viewer.renderer.domElement.style.cursor = "";
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
  /** ölçü mevcut değeriyle eklense hiçbir serbestliği almıyor mu (gereksiz ölçü) */
  private dimRedundant(spec: Omit<SDim, "id" | "v">, cur: number): boolean {
    if (!this.result.ok) return false;
    const tmp: SketchData = JSON.parse(JSON.stringify(this.data));
    const v = spec.t === "dist" && (spec as any).sub !== "a" ? cur : Math.abs(cur);
    const d = { id: "probeDim", ...spec, v } as SDim;
    if (d.t === "dist" && d.sub !== "a" && cur < 0) (d.refs = [d.refs[1], d.refs[0]]), (d.v = -cur);
    tmp.dims.push(d);
    const r = solve(tmp, undefined, false);
    const prev = new Set(this.result.redundant);
    return r.ok && (r.redundant.some((x) => !prev.has(x)) || r.dof >= this.result.dof);
  }
  /** son op gereksiz (fazla) ölçü yüzünden reddedildi */
  redundantHit = false;
  /** SolidWorks "sürücü olarak bırak": gereksiz sürücü ölçü kabul edilir (eskiz aşırı tanımlı gösterilir) */
  private allowOver = false;
  /** gereksiz ölçü penceresi: sürülen yap / sürücü olarak bırak / vazgeç */
  askRedundant(msg: string, keepOk = true): Promise<"ref" | "keep" | null> {
    document.querySelector("dialog.redund-dlg")?.remove();
    const d = document.createElement("dialog");
    d.className = "input-dialog redund-dlg";
    const p = document.createElement("p");
    p.textContent = "Gereksiz ölçü: " + msg;
    d.appendChild(p);
    const row = document.createElement("div");
    row.className = "pm-buttons";
    d.appendChild(row);
    document.body.appendChild(d);
    return new Promise((res) => {
      const b = (t: string, v: "ref" | "keep" | null, cls = "btn") => {
        const x = document.createElement("button");
        x.className = cls;
        x.textContent = t;
        x.dataset.v = v ?? "";
        x.addEventListener("click", () => (d.close(), d.remove(), res(v)));
        row.appendChild(x);
      };
      b("Sürülen (referans) yap", "ref", "btn primary");
      if (keepOk) b("Sürücü olarak bırak (aşırı tanımlı)", "keep");
      b("Vazgeç", null);
      d.addEventListener("cancel", () => (d.remove(), res(null)));
      d.showModal();
    });
  }
  private addOver(make: () => SDim, a: "ref" | "keep") {
    this.allowOver = a === "keep";
    try {
      const ok = this.op(() => this.data.dims.push(make()));
      if (ok && a === "keep") this.host.toast("Eskiz aşırı tanımlı: gereksiz ölçü kırmızı gösterilir", true);
    } finally {
      this.allowOver = false;
    }
    this.host.changed();
  }
  private op(fn: () => void, failMsg = "Bu işlem eskizi çözülemez hale getiriyor (aşırı tanımlı)"): boolean {
    const before = JSON.stringify(this.data);
    const dimIds = new Set(this.data.dims.map((d) => d.id));
    const prevRed = new Set(this.result?.redundant ?? []), prevDof = this.result?.ok ? this.result.dof : undefined;
    const geo0 = Object.keys(this.data.pts).length + ":" + this.data.ents.length;
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
    // SolidWorks gibi: yeni sürücü ölçü hiçbir serbestliği almıyorsa (değeri tutsa bile) gereksizdir → reddet
    const newDims = this.data.dims.filter((d) => !dimIds.has(d.id) && !d.ref);
    this.redundantHit = false;
    if (!this.allowOver && r.ok && !r.conflicts.length && newDims.length && (r.redundant.some((x) => !prevRed.has(x)) || (prevDof !== undefined && r.dof >= prevDof && geo0 === Object.keys(this.data.pts).length + ":" + this.data.ents.length))) {
      this.undoStack.pop();
      Object.assign(this.data, JSON.parse(before));
      this.redundantHit = true;
      this.resolve();
      this.render();
      if (failMsg) this.host.toast("Gereksiz ölçü: bu ölçü eskizi aşırı tanımlar (değer zaten diğer ölçü / ilişkilerle belirli)", true);
      return false;
    }
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
  /** eski eskizler: çeyrekten yakalanıp yalnız "çember üzerinde" kalmış ve ölçülendirilmiş noktalar → merkezle hizala (v0.55 öncesi kayma hatası) */
  private fixOldQuads() {
    const sk = this.data;
    for (const r of [...sk.rels]) {
      if (r.t !== "onCircle") continue;
      const [pid, cid] = r.refs;
      const c = getEnt(sk, cid) as SCircle | undefined;
      if (!c?.c || !sk.pts[pid] || !sk.dims.some((d) => d.refs.includes(pid))) continue;
      if (sk.rels.some((x) => (x.t === "horizontal" || x.t === "vertical") && x.refs.includes(pid) && x.refs.includes(c.c))) continue;
      const p = P(sk, pid), q = P(sk, c.c), tol = 1e-6 * Math.max(1, c.r);
      if (Math.abs(p[1] - q[1]) < tol) addRel(sk, "horizontal", [pid, c.c]);
      else if (Math.abs(p[0] - q[0]) < tol) addRel(sk, "vertical", [pid, c.c]);
    }
  }
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
    this.chainSt = null;
    document.querySelector(".dim-prompt.quick")?.remove();
    this.finishChain();
    this.tool = t;
    this.st = {};
    this.wake = [];
    if (t !== "select" && !OP_TOOLS.includes(t)) this.sel.clear();
    this.hideBadge();
    this.render();
    this.renderPanel();
  }

  /** imleç: her durumda tepki — yakalanan yerin türüne göre SolidWorks gibi simge (yazı yok) */
  private curKind = "";
  setCursor(k: string) {
    if (k === this.curKind) return;
    this.curKind = k;
    const cv = this.host.viewer.renderer.domElement;
    if (k === "pointer" || k === "default") {
      this.host.viewer.snapIcon = null;
      return void (cv.style.cursor = k);
    }
    const O = "#e8590c", Y = "#ffd43b";
    // sağ alttaki küçük simge (x:20..36, y:20..36)
    const icons: Record<string, string> = {
      draw: `<path d='M30 18l6 6-9 9-7 1 1-7z' fill='#fff' stroke='#1c4fd8' stroke-width='1.4'/>`,
      end: `<rect x='22' y='22' width='11' height='11' fill='${Y}' stroke='${O}' stroke-width='2'/>`,
      mid: `<path d='M20 34h16' stroke='#333' stroke-width='1.5'/><path d='M28 21l6 10h-12z' fill='${Y}' stroke='${O}' stroke-width='2'/>`,
      center: `<circle cx='28' cy='28' r='7' fill='none' stroke='${O}' stroke-width='2'/><circle cx='28' cy='28' r='2.5' fill='${O}'/>`,
      quad: `<circle cx='28' cy='28' r='7' fill='none' stroke='#333' stroke-width='1.3'/><circle cx='35' cy='28' r='3' fill='${Y}' stroke='${O}' stroke-width='1.5'/>`,
      isect: `<path d='M21 21l14 14M35 21L21 35' stroke='${O}' stroke-width='2.5'/>`,
      on: `<path d='M20 33l16-10' stroke='#333' stroke-width='1.5'/><circle cx='28' cy='28' r='3.5' fill='${Y}' stroke='${O}' stroke-width='1.5'/>`,
      onc: `<path d='M21 34a10 10 0 0 1 14-12' fill='none' stroke='#333' stroke-width='1.5'/><circle cx='26' cy='26' r='3.5' fill='${Y}' stroke='${O}' stroke-width='1.5'/>`,
      h: `<path d='M20 28h16' stroke='${O}' stroke-width='3'/>`,
      v: `<path d='M28 20v16' stroke='${O}' stroke-width='3'/>`,
      perp: `<path d='M21 34h15M24 34V21' stroke='${O}' stroke-width='2.5'/>`,
      tan: `<path d='M20 34h16' stroke='#333' stroke-width='1.5'/><circle cx='28' cy='27' r='6' fill='none' stroke='${O}' stroke-width='2'/>`,
      model: `<rect x='22' y='22' width='11' height='11' fill='#74c0fc' stroke='#1864ab' stroke-width='2'/>`,
      origin: `<path d='M22 34V22M22 34h12' stroke='#c92a2a' stroke-width='2.5'/>`,
    };
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><path d='M10 1v6M10 13v6M1 10h6M13 10h6' stroke='#111' stroke-width='1.6'/>${icons[k] ?? ""}</svg>`;
    cv.style.cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 10 10, crosshair`;
    // telefon/kalem: aynı simge çizim noktasının yanında rozet olarak (büyütülmüş)
    this.host.viewer.snapIcon = k === "draw" ? null : `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='10 10 30 30'><rect x='16' y='16' width='24' height='24' rx='6' fill='#fff' opacity='.92'/>${icons[k] ?? ""}</svg>`;
    this.host.viewer.requestRender();
  }
  /** çıkarım sonucundan imleç türü */
  private snapKind(inf: Inference | null | undefined, draw = true): string {
    if (!inf) return draw ? "draw" : "default";
    const L = inf.label ?? "";
    if (inf.ptId) return inf.ptId === ORIGIN ? "origin" : "end";
    if (inf.fixAt) return L.includes("ortası") ? "mid" : L.includes("merkez") ? "center" : "model";
    if (inf.rectC) return "center";
    if (inf.on2) return "isect";
    if (inf.mid || L === "Yay ortası") return "mid";
    if (L === "Çeyrek") return "quad";
    if (inf.onModel !== undefined || inf.on) return inf.on && inf.on.t !== "line" ? "onc" : "on";
    if (inf.lineRel?.t === "perpendicular") return "perp";
    if (inf.lineRel?.t === "tangent") return "tan";
    if (inf.lineRel?.t === "collinear") return "on";
    if (inf.hv) return inf.hv;
    return draw ? "draw" : "default";
  }

  /** Sayıyla çizim: çizgi (X,Y / uzunluk, açı), dikdörtgen (G, Y), daire (Ø) */
  numericEntry(first = "") {
    const st = this.st, t = this.tool;
    const r1 = (v: number) => Math.round(v * 100) / 100;
    const at = (q: Vec2) => {
      this.noInfer = true;
      this.click(q, { clientX: 0, clientY: 0, pointerType: "mouse" });
      this.noInfer = false;
    };
    const lastEnt = () => this.data.ents[this.data.ents.length - 1];
    let fields: [string, number][] = [];
    let apply: (v: number[]) => void;
    const startXY = () => {
      fields = [["X", 0], ["Y", 0]];
      apply = (v) => at([v[0], v[1]]);
    };
    if (t === "line" || t === "centerline") {
      if (!st.last) startXY();
      else {
        const c = this.cursor ?? add2(st.lastPos, [10, 0]);
        fields = [["Uzunluk", r1(d2(st.lastPos, c))], ["Açı °", r1((ang(st.lastPos, c) * 180) / Math.PI)]];
        apply = (v) => {
          if (!(v[0] > 0)) return;
          const a = (v[1] * Math.PI) / 180;
          at(add2(st.lastPos, [v[0] * Math.cos(a), v[0] * Math.sin(a)]));
          const l = lastEnt() as SLine;
          if (l?.t !== "line") return;
          this.op(() => {
            const k = ((v[1] % 360) + 360) % 180;
            if (k === 0) addRel(this.data, "horizontal", [l.id]);
            else if (k === 90) addRel(this.data, "vertical", [l.id]);
            this.data.dims.push({ id: nid(this.data, "d"), t: "dist", refs: [l.p1, l.p2], sub: "a", v: v[0], lp: mul2(add2(P(this.data, l.p1), P(this.data, l.p2)), 0.5) } as SDim);
          });
        };
      }
    } else if (t === "rect" || t === "crect") {
      if (!st.aPos) startXY();
      else {
        fields = [["Genişlik", 50], ["Yükseklik", 30]];
        apply = (v) => at(add2(st.aPos, t === "rect" ? [v[0], v[1]] : [v[0] / 2, v[1] / 2]));
      }
    } else if (t === "circle") {
      if (!st.aPos) startXY();
      else {
        fields = [["Çap Ø", 20]];
        apply = (v) => {
          if (!(v[0] > 0)) return;
          at(add2(st.aPos, [v[0] / 2, 0]));
          const c = lastEnt();
          if (c?.t === "circle") this.op(() => this.data.dims.push({ id: nid(this.data, "d"), t: "dia", refs: [c.id], v: v[0], lp: add2(P(this.data, c.c), [v[0] * 0.4, v[0] * 0.6]) } as SDim));
        };
      }
    } else return this.host.toast("Sayıyla giriş: Çizgi, Dikdörtgen veya Daire aracında");
    document.querySelector(".dim-prompt")?.remove();
    const box = document.createElement("div");
    box.className = "dim-prompt quick num-entry";
    const ins = fields.map(([l, v], i) => {
      const lb = document.createElement("label");
      lb.textContent = l;
      const inp = document.createElement("input");
      inp.inputMode = "decimal";
      inp.value = i === 0 && first ? first : String(v);
      lb.appendChild(inp);
      box.appendChild(lb);
      return inp;
    });
    const ok = document.createElement("button");
    ok.className = "ok";
    ok.textContent = "✓";
    const no = document.createElement("button");
    no.className = "no";
    no.textContent = "✕";
    box.append(ok, no);
    document.body.appendChild(box);
    box.style.left = Math.max(8, innerWidth / 2 - box.offsetWidth / 2) + "px";
    box.style.top = "70px";
    const go = () => {
      const v = ins.map((x) => evalNum(x.value.trim()));
      if (v.some((x) => x === null)) return;
      box.remove();
      apply(v as number[]);
      this.render();
      this.renderPanel();
    };
    ok.addEventListener("click", go);
    no.addEventListener("click", () => box.remove());
    ins.forEach((x, i) =>
      x.addEventListener("keydown", (ev) => {
        ev.stopPropagation();
        if (ev.key === "Enter") i < ins.length - 1 ? (ins[i + 1].focus(), ins[i + 1].select()) : go();
        if (ev.key === "Escape") box.remove();
      }),
    );
    ins[0].focus();
    if (!first) ins[0].select();
  }

  /** Kaba eskizi düzelt: neredeyse yatay/dikey çizgilere ilişki ekle */
  straighten() {
    const sk = this.data;
    let n = 0;
    this.op(() => {
      for (const e of sk.ents) {
        if (e.t !== "line") continue;
        if (relationsOf(sk, e.id).some((r) => ["horizontal", "vertical", "parallel", "perpendicular", "collinear"].includes(r.t))) continue;
        const A = P(sk, e.p1), B = P(sk, e.p2);
        const a = Math.abs(((Math.atan2(B[1] - A[1], B[0] - A[0]) * 180) / Math.PI + 360) % 180);
        if (a < 6 || a > 174) addRel(sk, "horizontal", [e.id]), n++;
        else if (Math.abs(a - 90) < 6) addRel(sk, "vertical", [e.id]), n++;
      }
    }, "Düzeltilemedi");
    this.host.toast(n ? `${n} çizgi yatay/dikey yapıldı` : "Düzeltilecek eğik çizgi yok");
  }

  /** Zincir / yarım çizim var mı (Esc davranışı için) */
  isDrawing() {
    return Object.keys(this.st).some((k) => k !== "inf" && this.st[k] != null);
  }
  /** A tuşu: çizgi zincirinde çizgi ↔ teğet yay */
  toggleLineArc() {
    if (this.tool === "line" && this.st.last && this.st.lastEnt) {
      this.st.arc = !this.st.arc;
      this.st.arcDir = this.st.arcNormal = undefined;
      this.host.toast(this.st.arc ? "Yay modu (A: çizgiye dön)" : "Çizgi modu");
      this.render();
    } else if (this.tool === "line") this.host.toast("Yaya geçmek için önce bir çizgi çizin");
  }
  /** Ctrl+A */
  selectAll() {
    this.sel.clear();
    for (const e of this.data.ents) this.sel.add(e.id);
    this.render();
    this.renderPanel();
  }
  private clip: SketchData | null = null;
  /** Ctrl+C: seçili varlıkları panoya kopyala */
  copySel() {
    const ids = new Set([...this.sel].filter((id) => getEnt(this.data, id)));
    if (!ids.size) return this.host.toast("Kopyalanacak öğe seçin");
    const ents = this.data.ents.filter((e) => ids.has(e.id)).map((e) => JSON.parse(JSON.stringify(e)));
    const pts: SketchData["pts"] = {};
    const walk = (o: any) => {
      for (const v of Object.values(o)) if (typeof v === "string" && this.data.pts[v]) pts[v] = { ...this.data.pts[v] };
    };
    ents.forEach(walk);
    this.clip = { ...JSON.parse(JSON.stringify(this.data)), ents, pts, rels: [], dims: [] };
    this.host.toast(`${ents.length} öğe kopyalandı`);
  }
  /** Ctrl+V: panodakileri imleç konumuna yapıştır */
  paste() {
    if (!this.clip) return this.host.toast("Pano boş");
    const cl = this.clip;
    const xs = Object.values(cl.pts);
    if (!xs.length) return;
    const cx = xs.reduce((a, q) => a + q.x, 0) / xs.length, cy = xs.reduce((a, q) => a + q.y, 0) / xs.length;
    const at = this.cursor ?? [cx + 10, cy + 10];
    this.op(() => {
      const map = new Map<string, string>();
      for (const [id, q] of Object.entries(cl.pts)) map.set(id, addPt(this.data, [q.x - cx + at[0], q.y - cy + at[1]]));
      this.sel.clear();
      for (const e0 of cl.ents) {
        const e = JSON.parse(JSON.stringify(e0));
        for (const k of Object.keys(e)) if (typeof e[k] === "string" && map.has(e[k])) e[k] = map.get(e[k]);
        for (const k of Object.keys(e)) if (Array.isArray(e[k]) && e[k].every((x: any) => typeof x === "string")) e[k] = e[k].map((x: string) => map.get(x) ?? x);
        e.id = nid(this.data, e.id.replace(/\d+$/, ""));
        this.data.ents.push(e);
        this.sel.add(e.id);
      }
    }, "Yapıştırılamadı");
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
    if (e.t === "text" && e.on) {
      const lay = textAlong(sk, e) ?? [];
      let bd = Infinity, bq: Vec2 = P(sk, e.p);
      for (const c of lay) {
        const a = (c.angle * Math.PI) / 180, m: Vec2 = [c.x + Math.cos(a) * e.size * 0.3 - Math.sin(a) * e.size * 0.5, c.y + Math.sin(a) * e.size * 0.3 + Math.cos(a) * e.size * 0.5];
        const dd = Math.max(0, d2(p, m) - e.size * 0.5);
        if (dd < bd) (bd = dd), (bq = m);
      }
      return { q: bq, d: bd };
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
    const step = this.opts.gridStep > 0 ? this.opts.gridStep : niceStep(this.wpp() * 2.5);
    return Math.round(v / step) * step;
  }

  /** Ctrl basılıyken çıkarım kapalı (SolidWorks) */
  private noInfer = false;
  /** "Uyandırılmış" noktalar: imleç üzerinde bekletilen noktalardan hizalama çizgileri */
  private wake: Vec2[] = [];
  /** Hızlı yakalama filtresi: kapalı yakalama türleri */
  snapOff = new Set<string>(
    (() => {
      try {
        return JSON.parse(localStorage.getItem("imajcad.snapOff") || "[]");
      } catch {
        return [];
      }
    })(),
  );
  toggleSnap(k: string) {
    this.snapOff.has(k) ? this.snapOff.delete(k) : this.snapOff.add(k);
    try {
      localStorage.setItem("imajcad.snapOff", JSON.stringify([...this.snapOff]));
    } catch {}
  }
  private wakeHover: { id: string; t: number } | null = null;

  private curveKind(e: SEnt | undefined): "line" | "circle" | "arc" | null {
    return e?.t === "line" ? "line" : e?.t === "circle" ? "circle" : e?.t === "arc" ? "arc" : null;
  }

  /** İki eğrinin kesişimleri */
  private pairX(a: SEnt, b: SEnt): Vec2[] {
    const sk = this.data;
    const geo = (e: SEnt) =>
      e.t === "line" ? { k: "l" as const, A: P(sk, e.p1), B: P(sk, e.p2) } : e.t === "circle" ? { k: "c" as const, c: P(sk, e.c), r: e.r, arc: null as null | { s: number; e: number } } : e.t === "arc" ? (() => { const g = arcAngles(sk, e); return { k: "c" as const, c: g.c, r: e.r, arc: { s: g.s, e: g.e } }; })() : null;
    const ga = geo(a), gb = geo(b);
    if (!ga || !gb) return [];
    const onArc = (g: any, q: Vec2) => !g.arc || inArc(ang(g.c, q), g.arc.s, g.arc.e);
    const out: Vec2[] = [];
    if (ga.k === "l" && gb.k === "l") {
      const x = lineLine(ga.A, ga.B, gb.A, gb.B);
      if (x && x.ta >= -1e-9 && x.ta <= 1 + 1e-9 && x.tb >= -1e-9 && x.tb <= 1 + 1e-9) out.push(x.p);
    } else if (ga.k === "l" || gb.k === "l") {
      const L = (ga.k === "l" ? ga : gb) as any, Cc = (ga.k === "l" ? gb : ga) as any;
      for (const x of lineCircle(L.A, L.B, Cc.c, Cc.r)) if (x.t >= -1e-9 && x.t <= 1 + 1e-9 && onArc(Cc, x.p)) out.push(x.p);
    } else {
      const A = ga as any, B = gb as any;
      for (const q of circleCircle(A.c, A.r, B.c, B.r)) if (onArc(A, q) && onArc(B, q)) out.push(q);
    }
    return out;
  }

  /**
   * SolidWorks benzeri çıkarım motoru.
   * Öncelik: nokta (çakışık) → orta nokta → kesişim → çeyrek nokta →
   * eğri üzerinde (+ hizalama çizgisiyle kesişim) → iki hizalama çizgisinin kesişimi → tek hizalama çizgisi → serbest.
   * Sarı kesikli çizgiler ilişki ekler (yatay/dikey/dik/doğrusal/teğet), mavi çizgiler yalnız hizalar.
   */
  private infer(p: Vec2, from?: Vec2 | null, exclude: Set<string> = new Set()): Inference {
    if (this.noInfer) return { p };
    const wpp = this.wpp();
    const tol = this.tolPx * wpp;
    const sk = this.data;
    // 1) nokta
    const on = (k: string) => !this.snapOff.has(k);
    const h = on("end") ? this.hitTest(p, this.tolPx, { ents: false, exclude }) : null;
    if (h) return { p: h.q, ptId: h.id, glyph: REL_GLYPH.coincident, label: h.id === ORIGIN ? "Orijin" : "Çakışık" };
    // model kenarlarının köşe / orta / merkez noktaları (sabit noktaya bağlanır)
    for (const r of on("model") ? this.modelPts : [])
      if (d2(r.p, p) < tol) return { p: r.p, fixAt: r.p, glyph: r.k === "m" ? REL_GLYPH.midpoint : REL_GLYPH.coincident, label: r.k === "v" ? "Model köşesi" : r.k === "m" ? "Model kenar ortası" : "Model merkezi" };
    // 2) orta noktalar (çizgi: ilişki eklenir, yay: yalnız konum)
    for (const e of on("mid") ? sk.ents : []) {
      if (exclude.has(e.id)) continue;
      if (e.t === "line") {
        const m = mul2(add2(P(sk, e.p1), P(sk, e.p2)), 0.5);
        if (d2(m, p) < tol * 0.8) return { p: m, mid: e.id, glyph: REL_GLYPH.midpoint, label: "Orta nokta" };
      } else if (e.t === "arc") {
        const g = arcAngles(sk, e);
        const m = arcMid(g.c, e.r, g.s, g.e);
        if (d2(m, p) < tol * 0.8) return { p: m, on: { id: e.id, t: "arc" }, glyph: REL_GLYPH.onCircle, label: "Yay ortası" };
      }
    }
    // dikdörtgen merkezi
    for (const r of on("center") ? this.rectCenters() : [])
      if (!exclude.has(r.a) && d2(r.c, p) < tol * 0.8) return { p: r.c, rectC: [r.a, r.b], glyph: "⊕", label: "Dikdörtgen merkezi" };
    // yakındaki eğriler
    const near: { e: SEnt; t: "line" | "circle" | "arc"; q: Vec2; d: number }[] = [];
    for (const e of sk.ents) {
      if (exclude.has(e.id)) continue;
      const t = this.curveKind(e);
      if (!t) continue;
      const r = this.nearestOnEnt(e, p);
      if (r && r.d < tol * 2.5) near.push({ e, t, q: r.q, d: r.d });
    }
    near.sort((x, y) => x.d - y.d);
    // 3) kesişim
    if (on("isect"))
    for (let i = 0; i < near.length; i++)
      for (let j = i + 1; j < near.length; j++)
        for (const x of this.pairX(near[i].e, near[j].e))
          if (d2(x, p) < tol)
            return { p: x, on: { id: near[i].e.id, t: near[i].t }, on2: { id: near[j].e.id, t: near[j].t }, glyph: "✕", label: "Kesişim" };
    // 4) çeyrek noktalar
    for (const n of on("quad") ? near : []) {
      if (n.t === "line") continue;
      const c = P(sk, (n.e as SCircle).c), r = (n.e as SCircle).r;
      for (let k = 0; k < 4; k++) {
        const q: Vec2 = [c[0] + r * Math.cos((k * Math.PI) / 2), c[1] + r * Math.sin((k * Math.PI) / 2)];
        if (n.t === "arc") {
          const g = arcAngles(sk, n.e as SArc);
          if (!inArc((k * Math.PI) / 2, g.s, g.e)) continue;
        }
        if (d2(q, p) < tol * 0.8) return { p: q, on: { id: n.e.id, t: n.t }, quad: k, glyph: "◔", label: "Çeyrek" };
      }
    }
    // hizalama çizgileri
    type G = { o: Vec2; d: Vec2; rel: boolean; ray: boolean; hv?: "h" | "v"; lineRel?: Inference["lineRel"]; label: string; glyph: string };
    const G: G[] = [];
    if (from && on("hv")) {
      G.push({ o: from, d: [1, 0], rel: true, ray: false, hv: "h", label: "Yatay", glyph: REL_GLYPH.horizontal });
      G.push({ o: from, d: [0, 1], rel: true, ray: false, hv: "v", label: "Dikey", glyph: REL_GLYPH.vertical });
    }
    if (from && on("perp")) {
      const st = this.st;
      const prev = st.lastEnt && st.last && st.lastPos && d2(st.lastPos, from) < 1e-9 ? getEnt(sk, st.lastEnt) : null;
      if (prev && (prev.t === "line" || prev.t === "arc")) {
        const t = this.tangentAt(prev.id, st.last);
        const axis = Math.abs(t[0]) < 1e-6 || Math.abs(t[1]) < 1e-6;
        if (prev.t === "line") {
          if (!axis) {
            G.push({ o: from, d: t, rel: true, ray: true, lineRel: { t: "collinear", ref: prev.id }, label: "Doğrusal", glyph: REL_GLYPH.collinear });
            G.push({ o: from, d: perp(t), rel: true, ray: false, lineRel: { t: "perpendicular", ref: prev.id }, label: "Dik", glyph: REL_GLYPH.perpendicular });
          }
        } else G.push({ o: from, d: t, rel: true, ray: true, lineRel: { t: "tangent", ref: prev.id }, label: "Teğet", glyph: REL_GLYPH.tangent });
      }
    }
    for (const o of on("guide") ? this.wake : []) {
      if (from && d2(o, from) < 1e-9) continue;
      G.push({ o, d: [1, 0], rel: false, ray: false, label: "", glyph: "" });
      G.push({ o, d: [0, 1], rel: false, ray: false, label: "", glyph: "" });
    }
    const gDist = (g: G, q: Vec2) => {
      const v = sub2(q, g.o);
      if (g.ray && dot2(v, g.d) < 0) return Infinity;
      return Math.abs(v[0] * g.d[1] - v[1] * g.d[0]);
    };
    const proj = (g: G, q: Vec2): Vec2 => add2(g.o, mul2(g.d, dot2(sub2(q, g.o), g.d)));
    const close = G.filter((g) => gDist(g, p) < tol * 0.7).sort((a, b) => gDist(a, p) - gDist(b, p));
    const ext = (g: G, q: Vec2): Guide => {
      const u = norm2(sub2(q, g.o));
      return { a: g.o, b: d2(q, g.o) > 1e-9 ? add2(q, mul2(u, 30 * wpp)) : q, rel: g.rel };
    };
    const pack = (q: Vec2, gs: G[], extra: Partial<Inference> = {}): Inference => {
      const relG = gs.find((g) => g.rel);
      const labels = [extra.label, ...gs.filter((g) => g.label).map((g) => g.label)].filter(Boolean);
      return {
        p: q,
        hv: relG?.hv,
        lineRel: relG?.lineRel,
        guides: gs.map((g) => ext(g, q)),
        glyph: [extra.glyph, ...gs.map((g) => g.glyph)].filter(Boolean).join(" ") || undefined,
        ...extra,
        label: labels.join(" · ") || undefined,
      };
    };
    // 5) eğri üzerinde (hizalama çizgisiyle kesişebilir)
    const onE = on("on") ? near.find((n) => n.d < tol * 0.8) : undefined;
    if (onE) {
      const on = onE;
      const onI = { id: on.e.id, t: on.t };
      for (const g of close.length ? G : []) {
        let xs: Vec2[] = [];
        const B = add2(g.o, g.d);
        if (on.t === "line") {
          const l = on.e as SLine;
          const x = lineLine(P(sk, l.p1), P(sk, l.p2), g.o, B);
          if (x && x.ta >= 0 && x.ta <= 1) xs = [x.p];
        } else {
          const c = P(sk, (on.e as SCircle).c);
          xs = lineCircle(g.o, B, c, (on.e as SCircle).r).map((x) => x.p);
          if (on.t === "arc") {
            const ag = arcAngles(sk, on.e as SArc);
            xs = xs.filter((q) => inArc(ang(c, q), ag.s, ag.e));
          }
        }
        const x = xs.filter((q) => gDist(g, q) < 1e-6).sort((a, b) => d2(a, p) - d2(b, p))[0];
        if (x && d2(x, p) < tol) return pack(x, [g], { on: onI, glyph: REL_GLYPH.onLine, label: "Üzerinde" });
      }
      return { p: on.q, on: onI, glyph: REL_GLYPH.onLine, label: "Üzerinde" };
    }
    // 5b) model kenarı üzerinde
    {
      let bi = -1, bd = tol * 0.8, bq: Vec2 = p;
      this.modelLines.forEach((l, i) => {
        const r = nearestOnSeg(p, l.a, l.b);
        if (r.d < bd) (bd = r.d), (bi = i), (bq = r.q);
      });
      if (bi >= 0) return { p: bq, onModel: bi, glyph: REL_GLYPH.onLine, label: "Model kenarı üzerinde" };
    }
    // 6) iki hizalama çizgisinin kesişimi
    for (let i = 0; i < close.length; i++)
      for (let j = i + 1; j < close.length; j++) {
        const a = close[i], b = close[j];
        if (Math.abs(a.d[0] * b.d[1] - a.d[1] * b.d[0]) < 1e-6) continue;
        const x = lineLine(a.o, add2(a.o, a.d), b.o, add2(b.o, b.d));
        if (x && d2(x.p, p) < tol && gDist(a, x.p) < 1e-6 && gDist(b, x.p) < 1e-6) return pack(x.p, a.rel || !b.rel ? [a, b] : [b, a]);
      }
    // 7) tek hizalama çizgisi
    if (close.length) {
      const g = close.find((x) => x.rel) && gDist(close.find((x) => x.rel)!, p) < tol * 0.7 ? close.find((x) => x.rel)! : close[0];
      return pack(proj(g, p), [g]);
    }
    // 8) serbest: açı yakalama (başlangıç noktasına göre, ör. 15°) ve ızgara yakalama isteğe bağlı
    if (this.opts.angSnap > 0 && from) {
      const v = sub2(p, from), L = Math.hypot(v[0], v[1]);
      if (L > 1e-9) {
        const st = (this.opts.angSnap * Math.PI) / 180, a0 = Math.round(Math.atan2(v[1], v[0]) / st) * st;
        const L2 = this.opts.gridSnap ? Math.max(this.snapGrid(L), 1e-6) : L;
        return { p: [from[0] + Math.cos(a0) * L2, from[1] + Math.sin(a0) * L2] };
      }
    }
    return { p: this.opts.gridSnap ? [this.snapGrid(p[0]), this.snapGrid(p[1])] : p };
  }

  /**
   * SolidWorks çizgi→yay otomatik geçişi: zincirde imleci son uç noktaya geri getirip
   * çıkınca yay moduna geçilir. Teğet yönünde çıkılırsa teğet yay, dik yönde çıkılırsa normal yay.
   */
  private autoArc(p: Vec2) {
    const st = this.st;
    if (this.tool !== "line" || !st.last || !st.lastEnt || !st.lastPos || this.noInfer || !getEnt(this.data, st.lastEnt)) return;
    const dpx = d2(p, st.lastPos) / this.wpp();
    if (dpx > 25) {
      if (st.backIn) {
        // uç noktadan çıkış: yönü belirle
        const t = this.tangentAt(st.lastEnt, st.last);
        const v = norm2(sub2(p, st.lastPos));
        st.backIn = false;
        st.away = false;
        if (st.arc) {
          st.arc = false;
          st.arcDir = st.arcNormal = undefined;
        } else {
          st.arc = true;
          if (Math.abs(dot2(v, t)) >= 0.6) {
            st.arcDir = mul2(t, Math.sign(dot2(v, t)) || 1);
            st.arcNormal = undefined;
          } else {
            const n = perp(t);
            st.arcDir = mul2(n, Math.sign(dot2(v, n)) || 1);
            st.arcNormal = true;
          }
        }
        this.render();
      } else st.away = true;
    } else if (dpx < 5 && st.away) st.backIn = true;
  }

  /** İmleç bir noktanın üzerinde ~0.3 s bekleyince o nokta "uyanır" */
  private trackWake(p: Vec2) {
    // uyandırılabilir: noktalar, çizgi orta noktaları, model köşe/orta/merkezleri, üzerinde durulan dairenin merkezi
    const tol = this.tolPx * this.wpp();
    const sk = this.data;
    let q: Vec2 | null = null;
    const h = this.hitTest(p, this.tolPx, { ents: false });
    if (h) q = h.q;
    if (!q)
      for (const e of sk.ents)
        if (e.t === "line") {
          const m = mul2(add2(P(sk, e.p1), P(sk, e.p2)), 0.5);
          if (d2(m, p) < tol) q = m;
        }
    if (!q) for (const r of this.modelPts) if (d2(r.p, p) < tol) q = r.p;
    if (!q) for (const r of this.rectCenters()) if (d2(r.c, p) < tol) q = r.c;
    if (!q) {
      const he = this.hitTest(p, this.tolPx * 0.8, { pts: false });
      const e = he && getEnt(sk, he.id);
      if (e && (e.t === "circle" || e.t === "arc")) q = P(sk, e.c);
    }
    if (!q) return void (this.wakeHover = null);
    const id = q[0].toFixed(4) + "," + q[1].toFixed(4);
    const now = performance.now();
    if (!this.wakeHover || this.wakeHover.id !== id) this.wakeHover = { id, t: now };
    else if (now - this.wakeHover.t > 250 && !this.wake.some((w) => d2(w, q!) < 1e-6)) {
      this.wake.unshift(q);
      this.wake.length = Math.min(this.wake.length, 4);
      this.render();
    }
  }

  // ---------- eskiz düzlemindeki model kenarları (SolidWorks: yüzün konturlarına yakalama) ----------
  /** model köşe / orta / merkez noktaları (yerel) */
  private modelPts: { p: Vec2; k: "v" | "m" | "c" }[] = [];
  /** model doğru kenarları (yerel) */
  private modelLines: { a: Vec2; b: Vec2 }[] = [];
  private loadModelRefs() {
    this.modelPts = [];
    this.modelLines = [];
    const mesh = this.host.viewer.mesh;
    if (!mesh) return;
    const f = this.frame;
    const onPl = (w: Vec3) => Math.abs(dot(sub(w, f.o), f.n)) < 1e-3;
    const add = (w: Vec3, k: "v" | "m" | "c") => {
      const q = toLocal(f, w);
      if (!this.modelPts.some((x) => d2(x.p, q) < 1e-6)) this.modelPts.push({ p: q, k });
    };
    for (const e of mesh.edges as any[]) {
      if (!e.s || !e.e || !onPl(e.s) || !onPl(e.e) || !onPl(e.m)) continue;
      if (e.c && e.r) {
        if (onPl(e.c)) add(e.c, "c");
        if (d2(toLocal(f, e.s), toLocal(f, e.e)) > 1e-6) add(e.s, "v"), add(e.e, "v");
        continue;
      }
      add(e.s, "v");
      add(e.e, "v");
      add(e.m, "m");
      this.modelLines.push({ a: toLocal(f, e.s), b: toLocal(f, e.e) });
    }
  }
  /** kapalı 4 çizgili döngüler (dikdörtgen / paralelkenar): merkez ve köşegen uçları */
  private rectCenters(): { c: Vec2; a: string; b: string }[] {
    const sk = this.data;
    const adj = new Map<string, string[]>();
    for (const e of sk.ents)
      if (e.t === "line") {
        adj.set(e.p1, [...(adj.get(e.p1) ?? []), e.p2]);
        adj.set(e.p2, [...(adj.get(e.p2) ?? []), e.p1]);
      }
    const out: { c: Vec2; a: string; b: string }[] = [];
    const seen = new Set<string>();
    for (const [a, na] of adj)
      for (const b of na)
        for (const c of adj.get(b) ?? []) {
          if (c === a) continue;
          for (const d of adj.get(c) ?? []) {
            if (d === b || d === a || !(adj.get(d) ?? []).includes(a)) continue;
            const key = [a, b, c, d].sort().join();
            if (seen.has(key)) continue;
            seen.add(key);
            const A = P(sk, a), C = P(sk, c), B = P(sk, b), D = P(sk, d);
            const m1 = mul2(add2(A, C), 0.5), m2 = mul2(add2(B, D), 0.5);
            if (d2(m1, m2) < 1e-6) out.push({ c: m1, a, b: c });
          }
        }
    return out;
  }
  /** model kenarı için sabit yapı çizgisi (op içinde çağrılır) */
  private ensureModelLine(ml: { a: Vec2; b: Vec2 }): string {
    const sk = this.data;
    const pt = (q: Vec2) => {
      for (const id of [ORIGIN, ...Object.keys(sk.pts)]) if (d2(P(sk, id), q) < 1e-6) return id;
      const id = addPt(sk, q);
      addRel(sk, "fix", [id], { fx: q[0], fy: q[1] });
      return id;
    };
    const a = pt(ml.a), b = pt(ml.b);
    const ex = sk.ents.find((e) => e.t === "line" && ((e.p1 === a && e.p2 === b) || (e.p1 === b && e.p2 === a)));
    return ex ? ex.id : addLine(sk, a, b, true).id;
  }
  /** model kenarını sabitlenmiş yapı çizgisine dönüştür (ölçü/ilişki referansı) */
  private modelLineAt(p: Vec2): string | null {
    const tol = this.tolPx * this.wpp();
    const ml = this.modelLines.find((l) => nearestOnSeg(p, l.a, l.b).d < tol);
    if (!ml) return null;
    const sk = this.data;
    const pt = (q: Vec2) => {
      for (const id of [ORIGIN, ...Object.keys(sk.pts)]) if (d2(P(sk, id), q) < 1e-6) return id;
      const id = addPt(sk, q);
      addRel(sk, "fix", [id], { fx: q[0], fy: q[1] });
      return id;
    };
    let lid = "";
    this.op(() => {
      const a = pt(ml.a), b = pt(ml.b);
      const ex = sk.ents.find((e) => e.t === "line" && ((e.p1 === a && e.p2 === b) || (e.p1 === b && e.p2 === a)));
      lid = ex ? ex.id : addLine(sk, a, b, true).id;
    });
    return lid || null;
  }

  /** Çıkarımdan nokta oluştur (veya var olanı kullan) */
  private makePoint(inf: Inference): string {
    if (inf.ptId) return inf.ptId;
    if (inf.fixAt) {
      for (const pid of Object.keys(this.data.pts)) if (d2(P(this.data, pid), inf.fixAt) < 1e-6) return pid;
      const fid = addPt(this.data, inf.fixAt);
      addRel(this.data, "fix", [fid], { fx: inf.fixAt[0], fy: inf.fixAt[1] });
      return fid;
    }
    const id = addPt(this.data, inf.p);
    if (inf.onModel !== undefined && this.modelLines[inf.onModel]) addRel(this.data, "onLine", [id, this.ensureModelLine(this.modelLines[inf.onModel])]);
    if (inf.rectC) {
      const [a, b] = inf.rectC;
      let dg = this.data.ents.find((e) => e.t === "line" && ((e.p1 === a && e.p2 === b) || (e.p1 === b && e.p2 === a)));
      if (!dg) dg = addLine(this.data, a, b, true);
      addRel(this.data, "midpoint", [id, dg.id]);
    }
    if (inf.on) addRel(this.data, inf.on.t === "line" ? "onLine" : "onCircle", [id, inf.on.id]);
    if (inf.on2) addRel(this.data, inf.on2.t === "line" ? "onLine" : "onCircle", [id, inf.on2.id]);
    if (inf.mid) addRel(this.data, "midpoint", [id, inf.mid]);
    // çeyrek: çember üzerinde kalması yetmez, yarıçap değişince kaymasın diye merkezle yatay / dikey hizala (SolidWorks çeyrek noktası)
    if (inf.quad !== undefined && inf.on && inf.on.t !== "line") {
      const ce = getEnt(this.data, inf.on.id) as SCircle | undefined;
      if (ce?.c) addRel(this.data, inf.quad % 2 === 0 ? "horizontal" : "vertical", [id, ce.c]);
    }
    return id;
  }

  // ---------------- Giriş ----------------
  down = (e: PointerEvent) => {
    const p = this.local(e);
    if (!p) return;
    this.tolPx = (e.pointerType === "touch" ? 20 : e.pointerType === "pen" ? 12 : 10) * prefs.snapSize;
    this.press = { x: e.clientX, y: e.clientY, local: p, hit: this.hitTest(p), moved: false };
    this.mods = { add: e.ctrlKey || e.shiftKey || e.metaKey, mouse: e.pointerType === "mouse" };
    this.noInfer = e.ctrlKey && this.tool !== "select";
    this.lift = this.liftMode(e);
    this.trimmedIds.clear();
    if (this.tool === "free") return this.freeStart(p, e);
    if (this.lift) this.preview(p, e);
  };
  /** kaldırınca yerleştir: kalem/parmakla çizim araçlarında */
  private lift = false;
  private trimmedIds = new Set<string>();
  private liftMode(e: { pointerType: string }) {
    return e.pointerType !== "mouse" && prefs.placeOnLift && this.tool !== "select" && this.tool !== "dim" && this.tool !== "free";
  }
  /** basış iptal (ikinci parmak / uzun basma) */
  cancel = () => {
    this.press = null;
    this.freeStop();
    this.lift = false;
    if (this.boxSel) {
      this.boxSel.el.remove();
      this.boxSel = null;
    }
    this.hideBadge();
    this.render();
  };
  move = (e: PointerEvent) => {
    const p = this.local(e);
    if (!p || !this.press) return;
    if (this.tool === "free") return this.freeMove(p, e);
    if (this.lift) {
      this.press.moved = true;
      return this.preview(p, e);
    }
    // SolidWorks güç kırpma: basılı sürükleyerek üzerinden geçilen parçaları kırp
    if (this.tool === "trim" && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 7) {
      this.press.moved = true;
      const h = this.hitTest(p, this.tolPx * 0.7, { pts: false });
      const key = h ? h.id + ":" + Math.round(p[0]) + "," + Math.round(p[1]) : "";
      if (h && !this.trimmedIds.has(h.id)) {
        this.trimmedIds.add(h.id);
        this.click(p, e);
      }
      void key;
      return;
    }
    if (!this.press.moved && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 7) {
      this.press.moved = true;
      const hnd = this.tool === "select" ? this.handleAt(this.press.local) : null;
      if (hnd) {
        this.snapshot();
        this.drag = { kind: "handle", ids: [], start: this.press.local, orig: {}, ent: hnd.ent, hi: hnd.i, hs: hnd.s };
      } else if (this.tool === "select" && (!this.press.hit || this.press.hit.id === ORIGIN) && e.pointerType !== "touch") this.startBox(this.press.x, this.press.y);
      else if (this.tool === "select") this.beginDrag(this.press.local, this.press.hit);
      else if (this.dragCreates()) this.click(this.press.local, e);
    }
    if (this.press.moved) {
      if (this.boxSel) this.updateBox(e.clientX, e.clientY);
      else if (this.tool === "select") this.dragTo(p);
      else this.preview(p, e);
    }
  };
  up = (e: PointerEvent) => {
    const p = this.local(e);
    const d = this.press;
    this.press = null;
    if (this.boxSel) return this.endBox();
    if (this.tool === "free") return this.freeEnd(p);
    if (!p || !d) return;
    if (this.lift) {
      this.lift = false;
      this.preview(p, e);
      this.hideBadge();
      return this.click(p, e);
    }
    if (this.tool === "select" && d.moved) return this.endDrag();
    if (d.moved && !this.dragCreates()) return;
    this.click(p, e);
  };
  hover = (e: PointerEvent) => {
    const p = this.local(e);
    if (!p) return;
    this.tolPx = (e.pointerType === "pen" ? 12 : 10) * prefs.snapSize;
    this.preview(p, e);
  };
  tap = (e: PointerEvent) => {
    const p = this.local(e);
    if (!p) return;
    if (this.tool === "free") return;
    this.tolPx = 20 * prefs.snapSize;
    this.preview(p, e);
    this.click(p, e);
  };

  // ---------------- DXF içe aktarma ----------------
  /** DXF (R12/R2000+) ENTITIES: LINE, CIRCLE, ARC, LWPOLYLINE, POLYLINE/VERTEX, POINT → eskiz öğeleri; uçlar birleştirilir */
  importDxf(text: string): number {
    const L = text.split(/\r?\n/).map((x) => x.trim());
    const pairs: [number, string][] = [];
    for (let i = 0; i + 1 < L.length; i += 2) pairs.push([parseInt(L[i]), L[i + 1]]);
    const ents: { t: string; g: Map<number, string[]> }[] = [];
    let inEnt = false, cur: { t: string; g: Map<number, string[]> } | null = null;
    for (const [c, v] of pairs) {
      if (c === 2 && v === "ENTITIES") inEnt = true;
      if (!inEnt) continue;
      if (c === 0) {
        if (v === "ENDSEC") break;
        cur = { t: v, g: new Map() };
        ents.push(cur);
      } else if (cur) {
        if (!cur.g.has(c)) cur.g.set(c, []);
        cur.g.get(c)!.push(v);
      }
    }
    const sk = this.data;
    const num = (e: { g: Map<number, string[]> }, c: number, i = 0) => parseFloat(e.g.get(c)?.[i] ?? "0");
    const pid = new Map<string, string>();
    const P = (x: number, y: number) => {
      const k = `${x.toFixed(4)},${y.toFixed(4)}`;
      if (!pid.has(k)) pid.set(k, addPt(sk, [x, y]));
      return pid.get(k)!;
    };
    let n = 0;
    this.op(() => {
      let poly: Vec2[] = [], polyClosed = false;
      const flushPoly = () => {
        for (let i = 0; i + 1 < poly.length; i++) addLine(sk, P(...poly[i]), P(...poly[i + 1])), n++;
        if (polyClosed && poly.length > 2) addLine(sk, P(...poly[poly.length - 1]), P(...poly[0])), n++;
        poly = [];
      };
      for (const e of ents) {
        if (e.t === "LINE") addLine(sk, P(num(e, 10), num(e, 20)), P(num(e, 11), num(e, 21))), n++;
        else if (e.t === "CIRCLE") addCircle(sk, addPt(sk, [num(e, 10), num(e, 20)]), num(e, 40)), n++;
        else if (e.t === "ARC") {
          const cx = num(e, 10), cy = num(e, 20), r = num(e, 40), a0 = (num(e, 50) * Math.PI) / 180, a1 = (num(e, 51) * Math.PI) / 180;
          addArc(sk, addPt(sk, [cx, cy]), P(cx + r * Math.cos(a0), cy + r * Math.sin(a0)), P(cx + r * Math.cos(a1), cy + r * Math.sin(a1))), n++;
        } else if (e.t === "LWPOLYLINE") {
          const xs = e.g.get(10) ?? [], ys = e.g.get(20) ?? [];
          poly = xs.map((x, i) => [parseFloat(x), parseFloat(ys[i] ?? "0")] as Vec2);
          polyClosed = (parseInt(e.g.get(70)?.[0] ?? "0") & 1) === 1;
          flushPoly();
        } else if (e.t === "POLYLINE") (poly = []), (polyClosed = (parseInt(e.g.get(70)?.[0] ?? "0") & 1) === 1);
        else if (e.t === "VERTEX") poly.push([num(e, 10), num(e, 20)]);
        else if (e.t === "SEQEND") flushPoly();
        else if (e.t === "POINT") addPointEnt(sk, addPt(sk, [num(e, 10), num(e, 20)])), n++;
      }
    }, "DXF eklenemedi");
    this.render();
    this.host.changed?.();
    return n;
  }

  // ---------------- Serbest çizim ----------------
  /** elle çizilen iz (eskiz koordinatı), tanınan şekil, bekleme sayacı */
  free: { pts: Vec2[]; shape: Shape | null; timer: number; sx: number; sy: number; snapA?: string | null } | null = null;
  private freeStart(p: Vec2, e: PointerEvent) {
    this.freeStop();
    const h = this.hitTest(p, this.tolPx, { ents: false });
    const a = h && h.kind === "pt" ? h.id : null;
    this.free = { pts: [p], shape: null, timer: 0, sx: e.clientX, sy: e.clientY, snapA: a };
    this.freeArm();
    this.render();
  }
  private freeArm() {
    const f = this.free;
    if (!f) return;
    clearTimeout(f.timer);
    f.timer = window.setTimeout(() => this.freeRecognize(true), 550);
  }
  private freeMove(p: Vec2, e: PointerEvent) {
    const f = this.free;
    if (!f) return;
    const moved = Math.hypot(e.clientX - f.sx, e.clientY - f.sy);
    if (f.shape) {
      // tanındıktan sonra belirgin hareket = çizime devam
      if (moved < 10) return;
      f.shape = null;
    }
    if (moved < 2) return;
    f.sx = e.clientX;
    f.sy = e.clientY;
    f.pts.push(p);
    this.freeArm();
    this.render();
  }
  /** iz tanınır ve önizlenir (bekleme sonunda ya da bırakınca) */
  freeRecognize(byHold = false) {
    const f = this.free;
    if (!f || f.pts.length < 2) return null;
    f.shape = recognize(f.pts, this.wpp());
    if (f.shape && byHold) {
      navigator.vibrate?.(12);
      this.host.toast("Tanındı: " + shapeName(f.shape) + " — bırakınca eklenir");
    }
    this.render();
    return f.shape;
  }
  private freeStop() {
    if (this.free) clearTimeout(this.free.timer);
    this.free = null;
  }
  private freeEnd(_p: Vec2 | null) {
    const f = this.free;
    if (!f) return;
    clearTimeout(f.timer);
    const sh = f.shape ?? recognize(f.pts, this.wpp());
    const snapA = f.snapA;
    this.free = null;
    if (!sh) return this.render();
    this.addShape(sh, snapA);
  }
  /** tanınan şekli eskize ekle: uçlar mevcut noktalara yakalanır, yatay/dikey/dik ilişkiler verilir */
  addShape(sh: Shape, snapA: string | null = null) {
    const sk = this.data;
    // uç noktalar mevcut noktalara (orijin dahil) yakalanır; aynı noktaya iki kez yakalanma olmaz
    const used = new Set<string>();
    const ptAt = (q: Vec2, _pref?: string | null): string => {
      const h = this.noSnap ? null : this.hitTest(q, this.tolPx, { ents: false, exclude: used });
      if (h && h.kind === "pt") return used.add(h.id), h.id;
      const id = addPt(sk, q);
      used.add(id);
      return id;
    };
    const name = shapeName(sh);
    this.op(() => {
      if (sh.kind === "circle") {
        addCircle(sk, addPt(sk, sh.c), sh.r);
      } else if (sh.kind === "arc") {
        const g = circle3(sh.s, sh.m, sh.e);
        if (!g) return void addLine(sk, ptAt(sh.s, snapA), ptAt(sh.e));
        // yay CCW: s→e; orta nokta yayın üzerinde olmalı
        const cr = (sh.m[0] - sh.s[0]) * (sh.e[1] - sh.s[1]) - (sh.m[1] - sh.s[1]) * (sh.e[0] - sh.s[0]);
        const [s0, e0] = cr > 0 ? [sh.s, sh.e] : [sh.e, sh.s];
        const i0 = ptAt(s0, cr > 0 ? snapA : null), i1 = ptAt(e0, cr > 0 ? null : snapA);
        // uç noktaları mevcut noktaya yakalandıysa yarıçap korunur, merkez uydurulur
        addArc(sk, addPt(sk, g.c), i0, i1);
      } else if (sh.kind === "ellipse") {
        const c = addPt(sk, sh.c);
        const a = addPt(sk, [sh.c[0] + sh.u[0] * sh.a, sh.c[1] + sh.u[1] * sh.a]);
        sk.ents.push({ id: nid(sk, "e"), t: "ellipse", c, a, rb: sh.b } as SEllipse);
        if (Math.abs(sh.u[1]) < 1e-9) addRel(sk, "horizontal", [c, a]);
        else if (Math.abs(sh.u[0]) < 1e-9) addRel(sk, "vertical", [c, a]);
      } else if (sh.kind === "rect") {
        this.addRect(sh, ptAt);
      } else if (sh.kind === "line" || sh.kind === "poly") {
        const pts = sh.kind === "line" ? [sh.a, sh.b] : sh.pts;
        const closed = sh.kind === "poly" && sh.closed;
        const ids = pts.map((q, i) => ptAt(q, i === 0 ? snapA : null));
        const n = ids.length;
        const lines: { id: string; a: Vec2; b: Vec2 }[] = [];
        for (let i = 0; i < (closed ? n : n - 1); i++) {
          const a = ids[i], b = ids[(i + 1) % n];
          if (a === b) continue;
          const l: any = { id: nid(sk, "l"), t: "line", p1: a, p2: b };
          sk.ents.push(l);
          lines.push({ id: l.id, a: pts[i], b: pts[(i + 1) % n] });
        }
        const dir: ("h" | "v" | null)[] = lines.map((l) => hvOf(l.a, l.b, 8));
        lines.forEach((l, i) => {
          if (dir[i] === "h") addRel(sk, "horizontal", [l.id]);
          else if (dir[i] === "v") addRel(sk, "vertical", [l.id]);
        });
        // eksene hizalı olmayan ardışık çizgiler ~90° ise dik
        for (let i = 0; i < lines.length; i++) {
          const j = i + 1 < lines.length ? i + 1 : closed ? 0 : -1;
          if (j < 0 || j === i || (dir[i] && dir[j])) continue;
          const L1 = lines[i], L2 = lines[j];
          const a1 = Math.atan2(L1.b[1] - L1.a[1], L1.b[0] - L1.a[0]), a2 = Math.atan2(L2.b[1] - L2.a[1], L2.b[0] - L2.a[0]);
          let da = Math.abs(a2 - a1) % Math.PI;
          if (Math.abs(da - Math.PI / 2) < (8 * Math.PI) / 180) addRel(sk, "perpendicular", [L1.id, L2.id]);
        }
      } else {
        const ids = sh.pts.map((q, i) => ptAt(q, i === 0 ? snapA : null));
        const cl = sh.pts.length > 3 && Math.hypot(sh.pts[0][0] - sh.pts[sh.pts.length - 1][0], sh.pts[0][1] - sh.pts[sh.pts.length - 1][1]) < 1e-9;
        if (cl) ids[ids.length - 1] = ids[0];
        sk.ents.push({ id: nid(sk, "s"), t: "spline", pts: ids, eq: true } as any);
      }
    }, name + " eklenemedi");
  }

  /** dikdörtgen / kare / yuvarlatılmış dikdörtgen: kenarlar, yaylar ve ilişkiler */
  private addRect(sh: Extract<Shape, { kind: "rect" }>, ptAt: (q: Vec2) => string) {
    const sk = this.data;
    const { c, u, hx, hy, r } = sh;
    const v: Vec2 = [-u[1], u[0]];
    const W = (x: number, y: number): Vec2 => [c[0] + u[0] * x + v[0] * y, c[1] + u[1] * x + v[1] * y];
    const sides: SLine[] = [];
    const rel = () => {
      // alt, sağ, üst, sol
      if (sh.axis) {
        const hz = Math.abs(u[0]) > 0.5;
        addRel(sk, hz ? "horizontal" : "vertical", [sides[0].id]);
        addRel(sk, hz ? "horizontal" : "vertical", [sides[2].id]);
        addRel(sk, hz ? "vertical" : "horizontal", [sides[1].id]);
        addRel(sk, hz ? "vertical" : "horizontal", [sides[3].id]);
      } else {
        addRel(sk, "parallel", [sides[0].id, sides[2].id]);
        addRel(sk, "parallel", [sides[1].id, sides[3].id]);
        addRel(sk, "perpendicular", [sides[0].id, sides[1].id]);
      }
      if (sh.square) addRel(sk, "equal", [sides[0].id, sides[1].id]);
    };
    if (r <= 0) {
      const ids = rectCorners(sh).map((q) => ptAt(q));
      for (let i = 0; i < 4; i++) sides.push(addLine(sk, ids[i], ids[(i + 1) % 4]));
      return rel();
    }
    const ax = hx - r, ay = hy - r;
    // köşe merkezleri (sağ-alt, sağ-üst, sol-üst, sol-alt) ve kenar uçları, saat yönü tersine
    const cs: [number, number][] = [[ax, -ay], [ax, ay], [-ax, ay], [-ax, -ay]];
    const sideEnds: [Vec2, Vec2][] = [
      [W(-ax, -hy), W(ax, -hy)],
      [W(hx, -ay), W(hx, ay)],
      [W(ax, hy), W(-ax, hy)],
      [W(-hx, ay), W(-hx, -ay)],
    ];
    const P2 = sideEnds.map(([a, b]) => [addPt(sk, a), addPt(sk, b)] as [string, string]);
    for (let i = 0; i < 4; i++) sides.push(addLine(sk, P2[i][0], P2[i][1]));
    const arcs: SArc[] = [];
    for (let i = 0; i < 4; i++) {
      const cc = addPt(sk, W(cs[i][0], cs[i][1]));
      const a = addArc(sk, cc, P2[i][1], P2[(i + 1) % 4][0]);
      arcs.push(a);
      addRel(sk, "tangent", [sides[i].id, a.id]);
      addRel(sk, "tangent", [sides[(i + 1) % 4].id, a.id]);
    }
    for (let i = 1; i < 4; i++) addRel(sk, "equal", [arcs[0].id, arcs[i].id]);
    rel();
  }

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
      this.setCursor(h ? (h.kind === "pt" ? (h.id === ORIGIN ? "origin" : "end") : "pointer") : "default");
      return;
    }
    if (t === "convert" || t === "pierce") {
      const hit = this.host.viewer.pick(e.clientX, e.clientY, { edge: true });
      this.host.viewer.setHighlight({ faces: [], edges: [], planes: [] }, hit);
      return;
    }
    if (t === "dim") {
      const h = this.hitTest(p, this.tolPx, { ents: false });
      const v = h ? null : this.virtualPt(p);
      this.hov = h ?? (v ? null : this.hitTest(p));
      this.st.vpt = v;
      this.render();
      this.hideBadge();
      this.setCursor(h ? (h.id === ORIGIN ? "origin" : "end") : v ? this.snapKind(v, false) : this.hov ? "pointer" : "default");
      return;
    }
    const from = this.st.lastPos ?? this.st.aPos ?? null;
    this.noInfer = !!(e as any).ctrlKey;
    this.autoArc(p);
    if (!this.noInfer) this.trackWake(p);
    const lineLike = t === "line" || t === "centerline" || ((t === "slot" || t === "cslot" || t === "rect3" || t === "para") && !this.st.bPos);
    const inf = this.infer(p, lineLike ? from : null);
    this.setCursor(this.snapKind(inf));
    const prevLabel = (this.st.inf as Inference | undefined)?.label;
    this.st.inf = inf;
    if (inf.label && inf.label !== prevLabel && (e as any).pointerType && (e as any).pointerType !== "mouse" && prefs.haptic) navigator.vibrate?.(6);
    this.render();
    const text = this.liveText(inf.p);
    // yakalama türü imleçte simgeyle gösterilir; kutuda yalnız canlı ölçü (uzunluk / yarıçap)
    if (text) this.showBadge(e.clientX, e.clientY, text, inf.label);
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
  private showBadge(x: number, y: number, text: string, title?: string) {
    if (!this.badge) {
      this.badge = document.createElement("div");
      this.badge.className = "sk-badge";
      document.body.appendChild(this.badge);
    }
    this.badge.textContent = text;
    this.badge.title = title ?? "";
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
    if (["select", "dim", "trim", "extend", "fillet", "schamfer", "convert", "pierce", "isect", "ordinate", "split", "jog"].includes(tool) || OP_TOOLS.includes(tool)) return;
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

  /** Açık uçlar (kontrol sonucu): çizimde kırmızı işaretlenir */
  openEnds: string[] = [];

  /** Eskizi kontrol et ve onar: çakışan noktaları birleştir, sıfır boylu / tekrarlı öğeleri sil, açık uçları göster */
  repairSketch() {
    const sk = this.data;
    const tol = Math.max(1e-6, this.wpp() * 0.5);
    let merged = 0, zero = 0, dup = 0;
    const ok = this.op(() => {
      // yakın noktaları birleştir
      const ids = Object.keys(sk.pts);
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          const a = sk.pts[ids[i]], b = sk.pts[ids[j]];
          if (!a || !b) continue;
          if (Math.hypot(a.x - b.x, a.y - b.y) < tol) {
            replacePoint(sk, ids[j], ids[i]);
            delete sk.pts[ids[j]];
            merged++;
          }
        }
      // orijine çakışanlar
      for (const id of Object.keys(sk.pts)) {
        const q = sk.pts[id];
        if (Math.hypot(q.x, q.y) < tol) {
          replacePoint(sk, id, ORIGIN);
          delete sk.pts[id];
          merged++;
        }
      }
      // sıfır boylu çizgiler
      const kill: string[] = [];
      for (const e of sk.ents) if (e.t === "line" && (e.p1 === e.p2 || d2(P(sk, e.p1), P(sk, e.p2)) < tol)) kill.push(e.id);
      zero = kill.length;
      // tekrarlı öğeler
      const seen = new Map<string, string>();
      for (const e of sk.ents) {
        if (kill.includes(e.id)) continue;
        const k = e.t === "line" ? `l:${[e.p1, e.p2].sort().join(",")}` : e.t === "circle" ? `c:${e.c}:${e.r.toFixed(6)}` : e.t === "arc" ? `a:${e.c}:${e.s}:${e.e}` : `${e.id}`;
        if (seen.has(k)) {
          kill.push(e.id);
          dup++;
        } else seen.set(k, e.id);
      }
      if (kill.length) deleteIds(sk, kill);
      // ilişkiler: kendi kendine çakışık
      sk.rels = sk.rels.filter((r) => !(r.t === "coincident" && r.refs[0] === r.refs[1]));
      cleanup(sk);
    }, "Onarım eskizi çözülemez hale getiriyor");
    // açık uçlar
    const cnt = new Map<string, number>();
    for (const e of sk.ents) {
      if (e.cons) continue;
      const ends = e.t === "line" ? [e.p1, e.p2] : e.t === "arc" ? [e.s, e.e] : e.t === "parabola" ? [e.s, e.e] : e.t === "spline" ? [e.pts[0], e.pts[e.pts.length - 1]] : e.t === "ellipse" && e.s && e.e ? [e.s, e.e] : [];
      if (e.t === "spline" && e.pts[0] === e.pts[e.pts.length - 1]) continue;
      ends.forEach((p) => cnt.set(p, (cnt.get(p) ?? 0) + 1));
    }
    this.openEnds = [...cnt].filter(([, n]) => n === 1).map(([p]) => p);
    const multi = [...cnt].filter(([, n]) => n > 2).length;
    const { error } = extractLoops(sk);
    if (ok) this.host.changed();
    this.render();
    const parts = [
      merged ? `${merged} nokta birleştirildi` : "",
      zero ? `${zero} sıfır boylu çizgi silindi` : "",
      dup ? `${dup} tekrarlı öğe silindi` : "",
      this.openEnds.length ? `${this.openEnds.length} açık uç (kırmızı)` : "",
      multi ? `${multi} noktada 2'den fazla öğe birleşiyor` : "",
      error ? `Profil: ${error}` : "",
    ].filter(Boolean);
    this.host.toast(parts.length ? parts.join(" · ") : "Eskizde sorun bulunamadı");
  }

  /** Öğelerden blok tanımı (noktalar ağırlık merkezine göre) */
  private blockDef(ents: SEnt[]): { def: BlockDef; c: Vec2 } {
    const sk = this.data;
    const pids = new Set(ents.flatMap((e) => entPoints(e)));
    pids.delete(ORIGIN);
    const pts: Record<string, { x: number; y: number }> = {};
    let cx = 0, cy = 0;
    for (const id of pids) {
      pts[id] = { ...sk.pts[id] };
      cx += pts[id].x;
      cy += pts[id].y;
    }
    cx /= pids.size || 1;
    cy /= pids.size || 1;
    for (const id of pids) {
      pts[id].x -= cx;
      pts[id].y -= cy;
    }
    const inSet = (r: string) => pids.has(r) || ents.some((e) => e.id === r);
    const rels = sk.rels.filter((r) => r.t !== "fix" && r.refs.every(inSet));
    const dims = sk.dims.filter((d) => d.refs.every(inSet)).map((d) => ({ ...d, lp: [d.lp[0] - cx, d.lp[1] - cy] as Vec2 }));
    const clean = JSON.parse(JSON.stringify(ents)).map((e: any) => (delete e.blk, e));
    return { def: { pts, ents: clean, rels: JSON.parse(JSON.stringify(rels)), dims }, c: [cx, cy] };
  }

  /** Seçili öğeleri blok olarak kütüphaneye kaydet (öğeler bu bloğun örneği olur) */
  saveBlock(name: string) {
    const ents = this.data.ents.filter((e) => this.sel.has(e.id));
    if (!ents.length) return this.host.toast("Önce blok yapılacak öğeleri seçin", true);
    const lib = loadBlocks();
    lib[name] = this.blockDef(ents).def;
    saveBlocks(lib);
    const tag = `${name}#${nid(this.data, "b")}`;
    for (const e of ents) e.blk = tag;
    this.host.changed();
    this.host.toast(`"${name}" bloğu kaydedildi`);
  }

  /** Eskizdeki blok örnekleri: etiket → öğeler */
  blockInstances(name?: string): Map<string, SEnt[]> {
    const m = new Map<string, SEnt[]>();
    for (const e of this.data.ents) if (e.blk && (!name || e.blk.split("#")[0] === name)) m.set(e.blk, [...(m.get(e.blk) ?? []), e]);
    return m;
  }
  /** Blok düzenleme modu (SolidWorks Bloğu Düzenle): bir örnek yerinde düzenlenir, Bloğu güncelle → tanım + tüm örnekler */
  blockEdit: { tag: string; before: Set<string> } | null = null;
  private selBlockTag(): string | undefined {
    for (const id of this.sel) {
      const e = this.data.ents.find((x) => x.id === id);
      if (e?.blk) return e.blk;
    }
  }
  editBlock(tag = this.selBlockTag()) {
    if (!tag) return this.host.toast("Önce bir blok örneğinin öğesini seçin", true);
    this.blockEdit = { tag, before: new Set(this.data.ents.map((e) => e.id)) };
    this.sel.clear();
    for (const e of this.data.ents) if (e.blk === tag) this.sel.add(e.id);
    this.host.toast(`Blok düzenleniyor: ${tag.split("#")[0]} — bitince "Bloğu güncelle"`);
    this.render();
    this.renderPanel();
  }
  /** Düzenlenen örnekten tanımı yenile, diğer örnekleri aynı ağırlık merkezinde yeniden kur */
  finishBlockEdit(apply = true) {
    const be = this.blockEdit;
    this.blockEdit = null;
    if (!be || !apply) return this.renderPanel();
    const name = be.tag.split("#")[0];
    this.op(() => {
      const sk = this.data;
      for (const e of sk.ents) if (!be.before.has(e.id)) e.blk = be.tag; // düzenlerken çizilenler bloğa katılır
      const mine = sk.ents.filter((e) => e.blk === be.tag);
      if (!mine.length) return;
      const lib = loadBlocks();
      lib[name] = this.blockDef(mine).def;
      saveBlocks(lib);
      for (const [tag, ents] of this.blockInstances(name)) {
        if (tag === be.tag) continue;
        const c = this.blockDef(ents).c;
        deleteIds(sk, ents.map((e) => e.id));
        this.insertBlock(name, c, tag);
      }
    }, "Blok güncellenemedi");
    this.host.toast(`"${name}" bloğu ve tüm örnekleri güncellendi`);
    this.renderPanel();
  }
  /** Bloğu dağıt: örnek sıradan öğelere döner */
  explodeBlock(tag = this.selBlockTag()) {
    if (!tag) return this.host.toast("Önce bir blok örneğinin öğesini seçin", true);
    this.op(() => this.data.ents.forEach((e) => e.blk === tag && delete e.blk));
    this.host.toast("Blok dağıtıldı");
  }

  /** Bloğu verilen noktaya ekle */
  private insertBlock(name: string, at: Vec2, tag?: string) {
    const b = loadBlocks()[name];
    if (!b) return;
    const sk = this.data;
    tag ??= `${name}#${nid(sk, "b")}`;
    const map = new Map<string, string>();
    for (const id of Object.keys(b.pts)) {
      const n = nid(sk, "p");
      map.set(id, n);
      sk.pts[n] = { x: b.pts[id].x + at[0], y: b.pts[id].y + at[1] };
    }
    const rid = (x: string) => map.get(x) ?? x;
    for (const e of b.ents) {
      const n = nid(sk, e.id.replace(/\d+$/, "") || "e");
      map.set(e.id, n);
    }
    for (const e of b.ents) {
      const c: any = JSON.parse(JSON.stringify(e));
      c.id = map.get(e.id);
      c.blk = tag;
      for (const k of ["p", "p1", "p2", "c", "s", "e", "a", "k"]) if (typeof c[k] === "string") c[k] = rid(c[k]);
      if (Array.isArray(c.pts)) c.pts = c.pts.map(rid);
      sk.ents.push(c);
    }
    for (const r of b.rels) sk.rels.push({ ...r, id: nid(sk, "r"), refs: r.refs.map(rid) });
    for (const d of b.dims) sk.dims.push({ ...d, id: nid(sk, "d"), refs: d.refs.map(rid), lp: [d.lp[0] + at[0], d.lp[1] + at[1]] });
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
      case "block": {
        const name = this.opts.block;
        if (!name || !loadBlocks()[name]) return this.host.toast("Önce listeden bir blok seçin", true);
        const at = this.infer(p).p;
        this.op(() => this.insertBlock(name, at), "Blok eklenemedi");
        this.host.changed();
        return this.render();
      }
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
        if (st.arc && st.lastEnt && getEnt(sk, st.lastEnt)) {
          // A tuşu: zincir içinde teğet yay, sonra çizgiye geri dön (SolidWorks)
          const inf = this.infer(p);
          const tdir = st.arcDir ?? this.tangentAt(st.lastEnt, st.last);
          const geo = this.tangentArcGeo(st.lastPos, tdir, inf.p);
          if (!geo) return;
          const start = st.last, base = st.lastEnt, normal = !!st.arcNormal;
          let closed = false;
          this.op(() => {
            const en = this.makePoint(inf);
            const c = addPt(sk, geo.c);
            const a = geo.ccw ? addArc(sk, c, start, en) : addArc(sk, c, en, start);
            a.r = geo.r;
            if (!normal) addRel(sk, "tangent", [base, a.id]);
            st.last = en;
            st.lastEnt = a.id;
            closed = !!inf.ptId;
          });
          st.arc = false;
          st.arcDir = st.arcNormal = undefined;
          st.away = false;
          if (closed) this.finishChain();
          else st.lastPos = P(sk, st.last);
          return this.renderPanel();
        }
        st.arc = false;
        const inf = this.infer(p, st.lastPos);
        if (d2(inf.p, st.lastPos) < 1e-9) return;
        const prev = st.last;
        let closed = false;
        this.op(() => {
          const b = this.makePoint(inf);
          const l = addLine(sk, prev, b, cons);
          const pa = P(sk, prev), pb = P(sk, b);
          const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
          // SolidWorks: düz çizilen çizgi (var olan noktaya kapanırken de) yatay/dikey ilişkisi alır
          const hv = inf.hv ?? (Math.abs(pb[1] - pa[1]) <= 1e-6 * Math.max(1, L) ? "h" : Math.abs(pb[0] - pa[0]) <= 1e-6 * Math.max(1, L) ? "v" : undefined);
          if (hv) {
            // aynı iki nokta arasında önceden hizalama ilişkisi varsa çizgi ilişkisiyle değiştir (fazla tanım olmasın)
            const tp = hv === "h" ? "horizontal" : "vertical";
            sk.rels = sk.rels.filter((r) => !(r.t === tp && r.refs.length === 2 && r.refs.includes(prev) && r.refs.includes(b)));
            addRel(sk, tp, [l.id]);
          } else if (inf.lineRel && getEnt(sk, inf.lineRel.ref)) addRel(sk, inf.lineRel.t, [inf.lineRel.ref, l.id]);
          // yeni nokta başka bir noktayla hizalandıysa (mavi kılavuz) hizalama ilişkisi kur
          if (!inf.ptId && !cons) {
            let gotH = false, gotV = false;
            for (const [id, q] of Object.entries(sk.pts)) {
              if (id === b || id === prev || id === ORIGIN) continue;
              const qq = P(sk, id);
              if (!gotV && hv !== "v" && Math.abs(qq[0] - pb[0]) < 1e-6) (addRel(sk, "vertical", [id, b]), (gotV = true));
              else if (!gotH && hv !== "h" && Math.abs(qq[1] - pb[1]) < 1e-6) (addRel(sk, "horizontal", [id, b]), (gotH = true));
              void q;
            }
          }
          st.last = b;
          st.lastEnt = l.id;
          st.away = false;
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
          // SolidWorks: kanal ölçüleri (merkezden merkeze ya da toplam boy) + genişlik
          const sd = this.opts.slotDims;
          if (sd !== "none") {
            const L = d2(a, b), lp = add2(mul2(add2(a, b), 0.5), mul2(n, w * 2.5));
            if (sd === "cc") sk.dims.push({ id: nid(sk, "d"), t: "dist", refs: [c1, c2], v: L, sub: "a", lp });
            else sk.dims.push({ id: nid(sk, "d"), t: "cc", refs: [a1.id, a2.id], v: L + 2 * w, cond: "max", lp });
            sk.dims.push({ id: nid(sk, "d"), t: "dia", refs: [a1.id], v: 2 * w, lp: add2(a, mul2(n, -w * 2.5)) });
          }
        });
        this.st = {};
        return this.render();
      }
      case "point": {
        const inf = this.infer(p);
        this.op(() => {
          let id: string;
          if (inf.ptId) {
            id = addPt(sk, inf.p);
            addRel(sk, "coincident", [id, inf.ptId]);
          } else id = this.makePoint(inf);
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
          // eğriye dokunulduysa ya da tek eğri seçiliyse: eğri üzerinde metin
          const selCurve = [...this.sel].map((id) => getEnt(sk, id)).find((x) => x && x.t !== "text" && x.t !== "point");
          const on = inf.on?.id ?? selCurve?.id;
          sk.ents.push({ id: nid(sk, "x"), t: "text", p: pid, text: o.text, size: o.textSize, angle: o.textAngle, ...(on ? { on } : {}), ...(o.textFont ? { font: o.textFont } : {}) });
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
      case "pierce":
        return this.pierceAt(p, e);
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
  // ---------- pencere / kesişen seçim (SolidWorks: soldan sağa pencere, sağdan sola kesişen) ----------
  private startBox(x: number, y: number) {
    const el = document.createElement("div");
    el.className = "sk-box";
    document.body.appendChild(el);
    this.boxSel = { x0: x, y0: y, x1: x, y1: y, el };
  }
  private updateBox(x: number, y: number) {
    const b = this.boxSel!;
    b.x1 = x;
    b.y1 = y;
    const cross = x < b.x0;
    Object.assign(b.el.style, {
      left: Math.min(b.x0, x) + "px", top: Math.min(b.y0, y) + "px",
      width: Math.abs(x - b.x0) + "px", height: Math.abs(y - b.y0) + "px",
    });
    b.el.classList.toggle("cross", cross);
  }
  private endBox() {
    const b = this.boxSel!;
    this.boxSel = null;
    b.el.remove();
    const corners = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(([x, y]) => this.local({ clientX: x, clientY: y }));
    if (corners.some((c) => !c) || Math.abs(b.x1 - b.x0) < 3 || Math.abs(b.y1 - b.y0) < 3) return;
    const poly = corners as Vec2[];
    const cross = b.x1 < b.x0;
    const inside = (q: Vec2) => pointInPoly(q, poly);
    const hitsEdge = (a: Vec2, c: Vec2) => {
      for (let i = 0; i < 4; i++) {
        const x = lineLine(a, c, poly[i], poly[(i + 1) % 4]);
        if (x && x.ta >= 0 && x.ta <= 1 && x.tb >= 0 && x.tb <= 1) return true;
      }
      return false;
    };
    const sk = this.data;
    const found: string[] = [];
    for (const e of sk.ents) {
      const pl = e.t === "point" ? [P(sk, e.p), P(sk, e.p)] : e.t === "text" ? [P(sk, e.p), P(sk, e.p)] : this.entPolyline(e);
      if (!pl.length) continue;
      const allIn = pl.every(inside);
      const anyHit = allIn || pl.some(inside) || pl.some((q, i) => i > 0 && hitsEdge(pl[i - 1], q));
      if (cross ? anyHit : allIn) found.push(e.id);
    }
    // bağımsız noktalar (pencere içinde)
    if (!this.mods.add) this.sel.clear();
    for (const id of found) this.sel.add(id);
    this.render();
    this.renderPanel();
  }

  private selectClick(p: Vec2) {
    let h = this.hitTest(p, this.tolPx, { ents: false }) ?? (this.tool === "select" && this.mods.add ? (() => {
      // Ctrl ile: orta nokta / çeyrek / merkez gibi noktalar da seçilebilir (ilişki vermek için)
      const v = this.virtualPt(p);
      const id = v && this.realizeVirtual(v);
      return id ? ({ kind: "pt", id, q: P(this.data, id) } as Hit) : null;
    })() : null) ?? this.hitTest(p);
    if (!h && this.tool === "select") {
      const ml = this.modelLineAt(p);
      if (ml) h = { kind: "ent", id: ml, q: p };
    }
    // fare: SolidWorks gibi tek tık seçimi değiştirir, Ctrl/Shift ekler/çıkarır. Kalem/parmak: dokunuş ekler/çıkarır.
    if (h && this.mods.mouse && !this.mods.add && this.tool === "select") {
      this.sel.clear();
      this.sel.add(h.id);
      this.render();
      this.renderPanel();
      return;
    }
    if (!h) {
      if (this.mods.add) return;
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

  private drag: { kind: "pt" | "line" | "radius" | "move" | "handle"; ids: string[]; start: Vec2; orig: Record<string, Vec2>; ent?: string; hi?: number; hs?: number } | null = null;

  /** Spline tutamakları: her nokta için iki uç (a = geri, b = ileri) */
  splineHandles(e: SSpline): { i: number; p: Vec2; a: Vec2; b: Vec2; set: boolean }[] {
    const closed = e.pts.length > 2 && e.pts[0] === e.pts[e.pts.length - 1];
    const pts = (closed ? e.pts.slice(0, -1) : e.pts).map((id) => P(this.data, id));
    return pts.map((p, i) => {
      const v = splineHandle(pts, closed, i, e.h);
      return { i, p, a: sub2(p, v), b: add2(p, v), set: !!e.h?.[i] };
    });
  }
  /** İmleç seçili bir spline'ın tutamak ucunda mı */
  private handleAt(p: Vec2): { ent: string; i: number; s: number } | null {
    const tol = this.tolPx * this.wpp();
    for (const id of this.sel) {
      const e = getEnt(this.data, id);
      if (e?.t !== "spline") continue;
      for (const hd of this.splineHandles(e)) {
        if (d2(p, hd.b) < tol) return { ent: e.id, i: hd.i, s: 1 };
        if (d2(p, hd.a) < tol) return { ent: e.id, i: hd.i, s: -1 };
      }
    }
    return null;
  }
  /** Seçim spline + ucunda buluşan yay mı: {spline, yay, uç indeksi} */
  private curvPair(ids: string[]): { sp: SSpline; arc: SArc | SCircle; i: number } | null {
    const es = ids.map((id) => getEnt(this.data, id));
    const sp = es.find((x) => x?.t === "spline") as SSpline | undefined;
    const arc = es.find((x) => x?.t === "arc" || x?.t === "circle") as SArc | SCircle | undefined;
    if (!sp || !arc || sp.pts.length < 2) return null;
    const n = sp.pts.length;
    for (const i of [0, n - 1]) {
      const q = P(this.data, sp.pts[i]);
      if (Math.abs(d2(q, P(this.data, arc.c)) - arc.r) < 1e-3 * Math.max(1, arc.r)) return { sp, arc, i };
    }
    return null;
  }
  /** Eşit eğrilik: spline ucundaki tutamağı yayın teğetine çevirir, boyunu κ = 1/R verecek şekilde seçer (Bezier: κ0 = 2|(P2−P0)×t| / (3L²)) */
  equalCurvature(ids: string[]) {
    const cp = this.curvPair(ids);
    if (!cp) return this.host.toast("Spline ucu ile o uçta buluşan bir yay seçin", true);
    const { sp, arc, i } = cp;
    const closed = sp.pts.length > 2 && sp.pts[0] === sp.pts[sp.pts.length - 1];
    const pts = (closed ? sp.pts.slice(0, -1) : sp.pts).map((id) => P(this.data, id));
    const last = i !== 0, k = last ? pts.length - 1 : 0, nb = last ? k - 1 : 1;
    const P0 = pts[k], c = P(this.data, arc.c);
    const rad = norm2(sub2(P0, c));
    let t: Vec2 = [-rad[1], rad[0]];
    // spline'ın gidiş yönü (ucundan içeri) teğetle aynı tarafta olsun
    const inward = sub2(pts[nb], P0);
    if (t[0] * inward[0] + t[1] * inward[1] < 0) t = [-t[0], -t[1]];
    // P2: komşu segmentin ikinci kontrol noktası (komşu noktanın tutamağıyla)
    const hn = splineHandle(pts, closed, nb, sp.h);
    const P2 = last ? add2(pts[nb], hn) : sub2(pts[nb], hn);
    const w = sub2(P2, P0), cr = w[0] * t[1] - w[1] * t[0];
    // eğrilik merkezi yayın merkeziyle aynı tarafta olmalı
    const side = sub2(c, P0), cs = side[0] * t[1] - side[1] * t[0];
    if (Math.abs(cr) < 1e-9 || Math.sign(cr) !== Math.sign(cs)) return this.host.toast("Eşit eğrilik bu yönde kurulamıyor (spline yayın öbür tarafına bükülüyor)", true);
    const L = Math.sqrt((2 * Math.abs(cr) * arc.r) / 3);
    // ilk noktada tutamak ileri yönde (h), sonda geri yönde (−h) uygulanır
    const hv: Vec2 = last ? [-t[0] * L, -t[1] * L] : [t[0] * L, t[1] * L];
    this.setSplineHandle(sp.id, k, hv);
    this.host.toast(`Eşit eğrilik: R ${fmtNum(arc.r, 2)} · tutamak ${fmtNum(L, 2)} mm`);
  }
  /** Tutamağı ayarla (açı ° ve ağırlık mm) ya da sıfırla */
  setSplineHandle(id: string, i: number, v: Vec2 | null) {
    this.op(() => {
      const e = getEnt(this.data, id) as SSpline;
      const n = e.pts.length;
      e.h = e.h ?? Array(n).fill(null);
      e.h[i] = v;
      if (e.h.every((x) => !x)) delete e.h;
    });
  }

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
    if (dr.kind === "handle") {
      const e = getEnt(sk, dr.ent!) as SSpline;
      const pp = this.splineHandles(e)[dr.hi!].p;
      e.h = e.h ?? Array(e.pts.length).fill(null);
      e.h[dr.hi!] = mul2(sub2(p, pp), dr.hs!);
      return this.render();
    }
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
        if ((r as any).merge) {
          // SolidWorks "Birleştir": ikinci noktayı birinciye kaynaştır
          const [a, b] = r.refs;
          const pa = P(this.data, a);
          this.data.pts[b] && Object.assign(this.data.pts[a] ?? {}, { x: pa[0], y: pa[1] });
          replacePoint(this.data, b, a);
          this.data.rels = this.data.rels.filter((x) => !(x.refs.includes(a) && x.refs.includes(b)));
          for (const x of this.data.rels) x.refs = x.refs.map((id) => (id === b ? a : id));
          for (const x of this.data.dims) x.refs = x.refs.map((id) => (id === b ? a : id));
          delete this.data.pts[b];
          continue;
        }
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
  /** köşe kümesi: aynı yerde duran (kırpmadan kalan) veya çakışık ilişkili noktalar */
  private cornerCluster(pid: string): string[] {
    const sk = this.data;
    const q0 = P(sk, pid);
    const ids = new Set<string>([pid]);
    for (const id of Object.keys(sk.pts)) if (id !== ORIGIN && d2(P(sk, id), q0) < 1e-4) ids.add(id);
    for (const r of sk.rels) if (r.t === "coincident" && r.refs.some((x) => ids.has(x))) r.refs.forEach((x) => sk.pts[x] && x !== ORIGIN && ids.add(x));
    return [...ids];
  }
  /** kümedeki noktaları tek noktada birleştir (varlık, ilişki, ölçü kimliklerini değiştir) */
  private mergeCorner(ids: string[]): string {
    const sk = this.data;
    const [keep, ...rest] = ids;
    if (!rest.length) return keep;
    const R = new Set(rest);
    const sw = (x: string) => (R.has(x) ? keep : x);
    for (const e of sk.ents as any[]) for (const k of ["p1", "p2", "c", "s", "e", "p"]) if (typeof e[k] === "string") e[k] = sw(e[k]);
    sk.rels = sk.rels.filter((r) => !(r.t === "coincident" && r.refs.every((x) => x === keep || R.has(x))));
    for (const r of sk.rels) r.refs = r.refs.map(sw);
    for (const d of sk.dims) d.refs = d.refs.map(sw);
    for (const x of rest) delete sk.pts[x];
    return keep;
  }
  private filletAt(p: Vec2) {
    const sk = this.data;
    const h = this.hitTest(p, this.tolPx, { ents: false });
    if (!h || h.id === ORIGIN) return this.host.toast("İki çizginin/yayın birleştiği köşeye dokunun");
    const cl = this.cornerCluster(h.id);
    const curves = sk.ents.filter((e) => (e.t === "line" || e.t === "arc") && !e.cons && entPoints(e).some((x) => cl.includes(x))) as (SLine | SArc)[];
    if (curves.length !== 2) return this.host.toast(curves.length < 2 ? "Köşede birleşen iki çizgi/yay bulunamadı" : "Köşede ikiden fazla çizgi/yay var; önce fazlasını kırpın");
    const r = this.opts.filletR;
    const Pp = P(sk, h.id);
    // her eğri için: köşedeki uç, ofset adayları, eğri üzerinde mi testi, izdüşüm
    type Cv = { e: SLine | SArc; offs: ({ t: "l"; a: Vec2; b: Vec2 } | { t: "c"; c: Vec2; r: number })[]; on: (q: Vec2) => boolean; proj: (q: Vec2) => Vec2 };
    const mkCv = (e: SLine | SArc): Cv => {
      if (e.t === "line") {
        const atStart = cl.includes(e.p1);
        const A = Pp, B = P(sk, atStart ? e.p2 : e.p1);
        const dir = norm2(sub2(B, A)), n = perp(dir), L = d2(A, B);
        const ext = mul2(dir, L * 4);
        return {
          e,
          offs: [1, -1].map((sg) => ({ t: "l" as const, a: add2(sub2(A, ext), mul2(n, sg * r)), b: add2(add2(B, ext), mul2(n, sg * r)) })),
          on: (q) => { const t = dot2(sub2(q, A), dir); return t > 1e-7 && t < L - 1e-7; },
          proj: (q) => add2(A, mul2(dir, dot2(sub2(q, A), dir))),
        };
      }
      const c = P(sk, e.c), R0 = d2(c, P(sk, e.s));
      const { s: as, e: ae } = arcAngles(sk, e);
      return {
        e,
        offs: [R0 + r, R0 - r].filter((x) => x > 1e-9).map((rr) => ({ t: "c" as const, c, r: rr })),
        on: (q) => { const a = ang(c, q); return inArc(a, as, ae) && d2(q, P(sk, e.s)) > 1e-7 && d2(q, P(sk, e.e)) > 1e-7; },
        proj: (q) => add2(c, mul2(norm2(sub2(q, c)), R0)),
      };
    };
    const [C1, C2] = curves.map(mkCv);
    let best: { C: Vec2; T1: Vec2; T2: Vec2; d: number } | null = null;
    for (const o1 of C1.offs)
      for (const o2 of C2.offs) {
        let xs: Vec2[] = [];
        if (o1.t === "l" && o2.t === "l") { const x = lineLine(o1.a, o1.b, o2.a, o2.b); xs = x ? [x.p] : []; }
        else if (o1.t === "l" && o2.t === "c") xs = lineCircle(o1.a, o1.b, o2.c, o2.r).map((x) => x.p);
        else if (o1.t === "c" && o2.t === "l") xs = lineCircle(o2.a, o2.b, o1.c, o1.r).map((x) => x.p);
        else if (o1.t === "c" && o2.t === "c") xs = circleCircle(o1.c, o1.r, o2.c, o2.r);
        for (const C of xs) {
          const T1 = C1.proj(C), T2 = C2.proj(C);
          if (!C1.on(T1) || !C2.on(T2)) continue;
          const dd = d2(T1, Pp) + d2(T2, Pp);
          if (!best || dd < best.d) best = { C, T1, T2, d: dd };
        }
      }
    if (!best) return this.host.toast("Bu yarıçapla köşe yuvarlatılamıyor (yarıçap çok büyük veya eğriler teğet)", true);
    const { C: Cc, T1, T2 } = best;
    const ccw = crs2(sub2(T1, Cc), sub2(T2, Cc)) > 0;
    this.op(() => {
      const pid = this.mergeCorner(cl);
      const t1 = addPt(sk, T1), t2 = addPt(sk, T2), c = addPt(sk, Cc);
      for (const [E, t] of [[C1.e, t1], [C2.e, t2]] as [SLine | SArc, string][]) {
        if (E.t === "line") E.p1 === pid ? (E.p1 = t) : (E.p2 = t);
        else E.s === pid ? (E.s = t) : (E.e = t);
      }
      // SolidWorks sanal sivri köşe: köşeye ölçü / ilişki bağlıysa köşe yapı noktası olarak kalır (iki eğrinin uzantısında), ölçüler korunur
      this.virtualSharp(pid, [C1.e.id, C2.e.id]);
      const a = ccw ? addArc(sk, c, t1, t2) : addArc(sk, c, t2, t1);
      a.r = r;
      addRel(sk, "tangent", [C1.e.id, a.id]);
      addRel(sk, "tangent", [C2.e.id, a.id]);
      sk.dims.push({ id: nid(sk, "d"), t: "rad", refs: [a.id], v: r, lp: add2(Cc, mul2(norm2(sub2(Pp, Cc)), -r * 2)) as Vec2 });
    });
  }

  /** radyüs / pah sonrası eski köşe: ölçü ya da ilişki bağlıysa sanal sivri köşe (yapı noktası, iki eğrinin üzerinde) yap; değilse sil */
  private virtualSharp(pid: string, curves: string[]) {
    const sk = this.data;
    const used = sk.dims.some((x) => x.refs.includes(pid)) || sk.rels.some((x) => x.refs.includes(pid) && !curves.some((c) => x.refs.includes(c)));
    if (!used || pid === ORIGIN) {
      sk.rels = sk.rels.filter((x) => !x.refs.includes(pid));
      sk.dims = sk.dims.filter((x) => !x.refs.includes(pid));
      if (!sk.ents.some((e) => entPoints(e).includes(pid))) delete sk.pts[pid];
      return;
    }
    // köşeyi eğrilerle bağlayan eski ilişkiler (ör. üzerinde) kalkar; eğrilerin uzantısında kalması için yeni ilişkiler
    sk.rels = sk.rels.filter((x) => !(x.refs.includes(pid) && curves.some((c) => x.refs.includes(c))));
    if (!sk.ents.some((e) => e.t === "point" && (e as any).p === pid)) sk.ents.push({ id: nid(sk, "e"), t: "point", p: pid, cons: true } as any);
    for (const cid of curves) {
      const c = getEnt(sk, cid);
      if (c) addRel(sk, c.t === "line" ? "onLine" : "onCircle", [pid, cid]);
    }
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

  private noSnap = false;
  traceOpt = { fg: "auto" as "auto" | "dark" | "light", thr: 0, eps: 1.5, shapes: true };
  /** Eskiz resminden kenar izleme: dış kontur ve delikler eskize eklenir (dönen: eklenen şekil sayısı) */
  async traceEdges(): Promise<number> {
    const pc = this.data.pic;
    if (!pc) return 0;
    const o = this.traceOpt;
    let img: ImageData;
    try {
      img = await imageDataOf(pc.src, 600);
    } catch (e: any) {
      this.host.toast(String(e?.message ?? e));
      return 0;
    }
    const r = traceImage(img, { thr: o.thr || undefined, invert: o.fg === "auto" ? undefined : o.fg === "light", eps: o.eps });
    if (!r.loops.length) {
      this.host.toast("Kenar izlenemedi: eşiği ya da nesne rengini değiştirin");
      return 0;
    }
    const H = pc.w * pc.aspect, a = (pc.rot * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    const map = (q: Vec2): Vec2 => {
      let lx = (q[0] / r.w - 0.5) * pc.w;
      const ly = (0.5 - q[1] / r.h) * H;
      if (pc.flip) lx = -lx;
      return [pc.x + lx * ca - ly * sa, pc.y + lx * sa + ly * ca];
    };
    const px = pc.w / r.w;
    let n = 0;
    this.snapshot();
    const stack = this.undoStack.length;
    for (const loop of r.loops) {
      const pts = loop.map(map);
      let sh: Shape | null = null;
      if (o.shapes) {
        const g = recognize([...pts, pts[0]], px);
        if (g && (g.kind === "circle" || g.kind === "rect" || g.kind === "ellipse")) sh = g;
      }
      if (!sh) sh = { kind: "poly", pts, closed: true };
      this.noSnap = true;
      try {
        this.addShape(sh);
      } finally {
        this.noSnap = false;
      }
      n++;
    }
    // addShape kendi geri alma adımlarını ekler: tek adıma indir
    this.undoStack.length = stack;
    this.resolve();
    this.render();
    this.renderPanel();
    this.host.changed();
    this.host.toast(`${n} kontur izlendi (eşik ${r.thr})`);
    return n;
  }

  /** Tam tanımla: orijine göre yatay/dikey ölçüler ve yarıçaplar ekler */
  fullyDefine() {
    const sk = this.data;
    this.snapshot();
    const before = JSON.stringify(sk);
    const added = autoDefine(sk);
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

  /** daire / yay içeren ölçü: hangi eğriler (merkez ölçüsü ya da kenar ölçüsü) */
  arcDimOf(d: SDim): { kind: "cl" | "cc"; a: string; b: string } | null {
    const sk = this.data;
    const curve = (id: string) => { const e = getEnt(sk, id); return e && (e.t === "circle" || e.t === "arc") ? e : null; };
    if (d.t === "cl" || d.t === "cc") return { kind: d.t, a: d.refs[0], b: d.refs[1] };
    if (d.t === "pldist" && curve(d.refs[0]) && getEnt(sk, d.refs[1])?.t === "line") return { kind: "cl", a: d.refs[0], b: d.refs[1] };
    if (d.t === "dist") {
      const byC = (pid: string) => sk.ents.find((e) => (e.t === "circle" || e.t === "arc") && e.c === pid);
      const ca = byC(d.refs[0]), cb = byC(d.refs[1]);
      if (ca && cb) return { kind: "cc", a: ca.id, b: cb.id };
    }
    return null;
  }
  /** SolidWorks yay koşulu: merkez / en yakın / en uzak; ölçü değeri geometriyi değiştirmez (yeni ölçü mevcut değerle) */
  setArcCond(id: string, cond: "c" | "min" | "max") {
    const sk = this.data;
    const d = sk.dims.find((x) => x.id === id);
    const ac = d && this.arcDimOf(d);
    if (!d || !ac) return;
    this.op(() => {
      if (cond === "c") {
        if (ac.kind === "cl") Object.assign(d, { t: "pldist", refs: [ac.a, ac.b], cond: undefined });
        else {
          const ea = getEnt(sk, ac.a) as any, eb = getEnt(sk, ac.b) as any;
          Object.assign(d, { t: "dist", refs: [ea.c, eb.c], sub: "a", cond: undefined });
        }
      } else Object.assign(d, { t: ac.kind, refs: [ac.a, ac.b], sub: undefined, cond });
      d.v = Math.abs(measure(sk, d));
    });
  }

  /** çap ↔ yarıçap gösterimi (SolidWorks: ölçünün ok tarafı / "yarıçap olarak göster") */
  toggleDiaRad(id?: string) {
    const d = this.data.dims.find((x) => x.id === (id ?? [...this.sel][0]) && (x.t === "dia" || x.t === "rad"));
    if (!d) return false;
    this.op(() => {
      const toRad = d.t === "dia";
      d.t = toRad ? "rad" : "dia";
      d.v = toRad ? d.v / 2 : d.v * 2;
      if (d.expr) d.expr = toRad ? `(${d.expr})/2` : `(${d.expr})*2`;
    });
    this.host.changed();
    return true;
  }
  /** çift mesafe: merkez çizgisine olan mesafe iki katı (çap) olarak gösterilir / girilir */
  toggleDouble(id: string) {
    const d = this.data.dims.find((x) => x.id === id && x.t === "pldist");
    if (!d) return false;
    this.op(() => {
      d.dbl = !d.dbl || undefined;
      d.v = d.dbl ? d.v * 2 : d.v / 2;
      if (d.expr) d.expr = d.dbl ? `(${d.expr})*2` : `(${d.expr})/2`;
    });
    this.host.changed();
    return true;
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
    const cl = this.cornerCluster(h.id);
    if (cl.length > 1) this.op(() => void this.mergeCorner(cl));
    const lines = usersOf(sk, h.id).filter((e) => e.t === "line" && !e.cons) as SLine[];
    if (lines.length !== 2) return this.host.toast("Pah için köşede tam olarak iki çizgi birleşmeli");
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
      this.virtualSharp(h.id, [L1.id, L2.id]);
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
    const hit = v.pick(e.clientX, e.clientY, { edge: true, face: true });
    if (!hit || !v.mesh) return this.host.toast("Modelin bir kenarına ya da yüzüne dokunun");
    if (hit.kind === "face") return this.convertFace(hit.index);
    if (hit.kind !== "edge") return this.host.toast("Modelin bir kenarına ya da yüzüne dokunun");
    this.convertEdge(v.mesh.edges[hit.index]);
  }
  /** Delme ilişkisi (SolidWorks Pierce): seçili nokta, eskiz düzlemini kesen model kenarının kesişimine sabitlenir */
  pierceAt(p: Vec2, e: { clientX: number; clientY: number }) {
    const sk = this.data, v = this.host.viewer;
    let pid = [...this.sel].find((id) => sk.pts[id]) ?? ([...this.sel].map((id) => getEnt(sk, id)).find((x) => x?.t === "point") as any)?.p;
    if (!pid) {
      // seçim yoksa: dokunulan yere yakın nokta seçilir (ilk dokunuş)
      const hh = this.hitTest(p, this.tolPx, { ents: false });
      if (hh && sk.pts[hh.id]) {
        this.sel = new Set([hh.id]);
        this.render();
        return this.host.toast("Şimdi eskiz düzlemini delen model kenarına dokunun");
      }
      return this.host.toast("Önce bir eskiz noktası seçin");
    }
    const hit = v.pick(e.clientX, e.clientY, { edge: true });
    if (!hit || hit.kind !== "edge" || !v.mesh) return this.host.toast("Eskiz düzlemini delen bir model kenarına dokunun");
    const md = v.mesh, pts: Vec3[] = [];
    for (let k = 0; k < md.edgeGroups.length; k += 3) {
      if (md.edgeGroups[k + 2] !== hit.index) continue;
      for (let i = md.edgeGroups[k]; i < md.edgeGroups[k] + md.edgeGroups[k + 1]; i++) pts.push([md.lines[i * 3], md.lines[i * 3 + 1], md.lines[i * 3 + 2]]);
    }
    const f = this.frame, sd = (q: Vec3) => dot([q[0] - f.o[0], q[1] - f.o[1], q[2] - f.o[2]], f.n);
    let x: Vec3 | null = null;
    for (let i = 0; i + 1 < pts.length && !x; i++) {
      const a = sd(pts[i]), b = sd(pts[i + 1]);
      if (Math.abs(a) < 1e-7) x = pts[i];
      else if (a * b < 0) {
        const t = a / (a - b);
        x = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, pts[i][2] + (pts[i + 1][2] - pts[i][2]) * t];
      }
    }
    if (!x) return this.host.toast("Bu kenar eskiz düzlemini kesmiyor", true);
    const q = toLocal(f, x);
    const id = pid;
    this.op(() => {
      sk.rels = sk.rels.filter((r) => !(r.t === "fix" && r.refs[0] === id));
      sk.pts[id] = { x: q[0], y: q[1] };
      addRel(sk, "fix", [id], { fx: q[0], fy: q[1] });
    }, "Nokta bu konuma taşınamıyor (diğer ilişkilerle çelişiyor)");
    this.host.changed();
    this.render();
  }
  /** SolidWorks: düz yüz → dış döngü (+ "iç döngüleri de al" seçeneği); silindir → eskiz düzlemindeki silüet kenarları */
  convertFace(fi: number) {
    const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const v = this.host.viewer, md = v.mesh!;
    const f = md.faces[fi];
    // yüzün üçgenleri (kenar orta noktası yüzde mi testi ve silüet uzunluğu için)
    const tris: Vec3[][] = [];
    const g = md.faceGroups;
    for (let i = 0; i < g.length; i += 3) {
      if (g[i + 2] !== fi) continue;
      for (let t = g[i]; t < g[i] + g[i + 1]; t += 3) tris.push([0, 1, 2].map((k) => { const vi = md.triangles[t + k] * 3; return [md.vertices[vi], md.vertices[vi + 1], md.vertices[vi + 2]] as Vec3; }));
    }
    if (f.ax && f.ac && f.r) {
      const A = f.ax, n = this.frame.n, ac = f.ac;
      if (Math.abs(dot(A, n)) > 1e-3) return this.host.toast("Silüet: silindir ekseni eskiz düzlemine paralel olmalı", true);
      // eksene dik, düzlemde yön; silüet çizgileri eksen ± r
      const w: Vec3 = [A[1] * n[2] - A[2] * n[1], A[2] * n[0] - A[0] * n[2], A[0] * n[1] - A[1] * n[0]];
      let lo = Infinity, hi = -Infinity;
      for (const t of tris) for (const q of t) {
        const s2 = dot([q[0] - ac[0], q[1] - ac[1], q[2] - ac[2]], A);
        (lo = Math.min(lo, s2)), (hi = Math.max(hi, s2));
      }
      const P = (s2: number, k: number): Vec3 => [ac[0] + A[0] * s2 + w[0] * k * f.r!, ac[1] + A[1] * s2 + w[1] * k * f.r!, ac[2] + A[2] * s2 + w[2] * k * f.r!];
      for (const k of [1, -1]) this.convertEdge({ type: "LINE", s: P(lo, k), e: P(hi, k), m: P((lo + hi) / 2, k), d: A } as any);
      return this.host.toast("Silüet kenarları dönüştürüldü");
    }
    if (!f.n) return this.host.toast("Bu yüz türü dönüştürülemez (düz yüz ya da silindir seçin)", true);
    const on = (q: Vec3) => {
      for (const t of tris) {
        const [a, b, c] = t;
        const v0 = sub3(c, a), v1 = sub3(b, a), v2 = sub3(q, a);
        const d00 = dot(v0, v0), d01 = dot(v0, v1), d02 = dot(v0, v2), d11 = dot(v1, v1), d12 = dot(v1, v2);
        const den = d00 * d11 - d01 * d01 || 1;
        const u = (d11 * d02 - d01 * d12) / den, w2 = (d00 * d12 - d01 * d02) / den;
        if (u >= -1e-3 && w2 >= -1e-3 && u + w2 <= 1 + 1e-3 && Math.abs(dot(sub3(q, a), f.n!)) < 1e-3) return true;
      }
      return false;
    };
    const edges = md.edges.filter((e) => [e.s, e.e, e.m].every((q) => Math.abs(dot(sub3(q, f.c), f.n!)) < 1e-3) && on(e.m ?? e.s));
    if (!edges.length) return this.host.toast("Yüzün kenarları bulunamadı", true);
    // dış döngü: yüz merkezinden en uzak kenarı içeren bağlı küme; iç döngüler isteğe bağlı
    const key = (q: Vec3) => q.map((x) => x.toFixed(3)).join(",");
    const comp = new Map<number, number>();
    let nc = 0;
    edges.forEach((e, i) => {
      if (comp.has(i)) return;
      const stack = [i];
      comp.set(i, nc);
      while (stack.length) {
        const j = stack.pop()!;
        const ks = [key(edges[j].s), key(edges[j].e)];
        edges.forEach((x, k) => !comp.has(k) && (ks.includes(key(x.s)) || ks.includes(key(x.e))) && (comp.set(k, nc), stack.push(k)));
      }
      nc++;
    });
    const far = (e: any) => Math.max(...[e.s, e.e, e.m].map((q: Vec3) => Math.hypot(q[0] - f.c[0], q[1] - f.c[1], q[2] - f.c[2])));
    let outer = 0, fd = -1;
    edges.forEach((e, i) => far(e) > fd && ((fd = far(e)), (outer = comp.get(i)!)));
    const take = edges.filter((_, i) => this.opts.convInner || comp.get(i) === outer);
    for (const e of take) this.convertEdge(e);
    this.host.toast(`${take.length} kenar dönüştürüldü${nc > 1 && !this.opts.convInner ? " (iç döngüler için: İç döngüleri de al)" : ""}`);
  }
  private convertEdge(info: any) {
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

  /** ayrı Taşı / Kopyala / Döndür / Ölçekle / Esnet komutları (SolidWorks) */
  setMoveKind(k: "all" | "move" | "copy" | "rot" | "scale" | "stretch") {
    this.opts.mkind = k;
    if (k === "rot" && !this.opts.mang) this.opts.mang = 90;
    if (k === "scale" && this.opts.mscale === 1) this.opts.mscale = 2;
    this.renderPanel();
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
      case "offset": {
        // SolidWorks: çift yön, taban geometriyi yapı geometrisine çevir
        const err = offsetEnts(sk, ents, o.offD, o.offRev);
        if (err) return err;
        if ((o as any).offBoth) {
          const e2 = offsetEnts(sk, ents.map((e) => sk.ents.find((x) => x.id === e.id)!).filter(Boolean), o.offD, !o.offRev);
          if (e2) return e2;
        }
        if ((o as any).offBaseCons) for (const e of ents) if (e.t !== "point" && e.t !== "text") (e as any).cons = true;
        return null;
      }
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
        linearPattern(sk, ents.filter((e) => e.t !== "point" || ents.length === 1), { n1: o.n1, s1: o.s1, a1: o.a1, n2: o.n2, s2: o.s2, a2: o.a2, skip: skipList(o.pskip) });
        return null;
      case "scpat": {
        const pts = [...this.sel].filter((id) => id === ORIGIN || sk.pts[id]);
        const cpt = pts.length === 1 ? P(sk, pts[0]) : ([0, 0] as Vec2);
        if (!ents.length) return "Çoğaltılacak öğeleri seçin";
        circularPattern(sk, ents, { c: cpt, n: Math.max(2, Math.round(o.cn)), total: o.ctotal, skip: skipList(o.pskip) });
        return null;
      }
      case "move": {
        const k = o.mkind;
        if (k === "stretch") {
          // esnet: seçili noktalar + seçili öğelerin noktaları kayar; bağlı diğer öğeler uzar
          const pts = new Set<string>([...this.sel].filter((id) => sk.pts[id]));
          ents.forEach((e) => entPoints(e).forEach((q) => q !== ORIGIN && pts.add(q)));
          if (!pts.size) return "Esnetilecek noktaları / öğeleri seçin (pencere seçimi kullanılabilir)";
          for (const id of pts) sk.pts[id] = { x: sk.pts[id].x + o.mdx, y: sk.pts[id].y + o.mdy };
          for (const r of sk.rels) if (r.t === "fix" && pts.has(r.refs[0])) [r.fx, r.fy] = [sk.pts[r.refs[0]].x, sk.pts[r.refs[0]].y];
          return null;
        }
        if (!ents.length) return "Taşınacak öğeleri seçin";
        const dx = k === "rot" || k === "scale" ? 0 : o.mdx, dy = k === "rot" || k === "scale" ? 0 : o.mdy;
        const angV = k === "all" || k === "rot" ? o.mang : 0, sc = k === "all" || k === "scale" ? o.mscale : 1;
        const copy = k === "copy" ? true : k === "move" ? false : o.mcopy;
        moveEnts(sk, ents, { dx, dy, ang: angV, c: centroid(sk, ents), copy, scale: sc });
        return null;
      }
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
          // SolidWorks: ortadan kırpılan çizginin iki parçası doğrusal kalır
          if (sk.rels.some((r) => r.refs.includes(e.id) && r.refs.length === 1 && (r.t === "horizontal" || r.t === "vertical")))
            for (const r of sk.rels.filter((r) => r.refs.includes(e.id) && r.refs.length === 1 && (r.t === "horizontal" || r.t === "vertical"))) addRel(sk, r.t, [nl.id]);
          else addRel(sk, "collinear", [e.id, nl.id]);
          // teğet ilişkileri: kesim noktası hangi parçaya yakınsa o parçaya taşınır
          for (const r of sk.rels.filter((r) => r.t === "tangent" && r.refs.includes(e.id))) {
            const other = getEnt(sk, r.refs.find((x) => x !== e.id)!);
            if (!other || (other.t !== "circle" && other.t !== "arc")) continue;
            const cc = P(sk, other.c);
            const near = (l: SLine) => nearestOnSeg(cc, P(sk, l.p1), P(sk, l.p2)).d;
            if (near(nl) < near(e as SLine)) r.refs = r.refs.map((x) => (x === e.id ? nl.id : x));
          }
        } else if (lo) e.p2 = mk(lo.p, lo.by);
        else e.p1 = mk(hi!.p, hi!.by);
      });
      return;
    }
    // daire / yay: açı ile
    const c = P(sk, e.c);
    const a = ang(c, h.q);
    if (e.t === "circle") {
      if (!cuts.length) return this.op(() => deleteIds(sk, [e.id]));
      if (cuts.length < 2) return this.host.toast("Daireyi kırpmak için en az iki kesişim gerekir (tek teğet/kesişim var)", true);
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
        // SolidWorks: aynı daireden kalan iki yay eş yarıçaplı kalır (merkez zaten ortak)
        addRel(sk, "equal", [arc.id, na.id]);
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
    // aynı noktadaki kesişimleri tekle (teğet noktası, üç varlığın kesiştiği nokta) — sıfır boylu parça oluşmasın
    const uniq: typeof out = [];
    for (const x of out) if (!uniq.some((u) => d2(u.p, x.p) < 1e-6)) uniq.push(x);
    return uniq;
  }

  // ---------------- Akıllı ölçü ----------------
  /** ölçü/seçim için sanal nokta: çizgi ortası, çeyrek, yay ortası, kesişim, dikdörtgen merkezi, model köşe/orta/merkez/kenar */
  private virtualPt(p: Vec2): Inference | null {
    const inf = this.infer(p);
    if (inf.ptId || !inf.label) return null;
    if (inf.mid || inf.fixAt || inf.rectC || inf.on2 || inf.onModel === undefined && inf.on && (inf.label === "Çeyrek" || inf.label === "Yay ortası")) return inf;
    return null;
  }
  /** sanal noktayı gerçek eskiz noktasına dönüştür (ilişkileriyle) */
  private realizeVirtual(v: Inference): string | null {
    let id: string | null = null;
    this.op(() => {
      id = this.makePoint(v);
      if (!getEnt(this.data, id!) && !this.data.ents.some((e) => e.t === "point" && (e as any).p === id) && !this.data.ents.some((e) => entPoints(e).includes(id!))) addPointEnt(this.data, id!);
    });
    return id;
  }

  /** zincir ölçü durumu: son ölçünün ikinci noktası, yönü ve ölçü çizgisi konumu */
  chainSt: { last: string; sub: "h" | "v"; lp: Vec2 } | null = null;
  private dimClick(p: Vec2, e: { clientX: number; clientY: number }) {
    const st = this.st;
    st.refs = st.refs ?? [];
    let h = this.hitTest(p, this.tolPx, { ents: false });
    if (!h) {
      const v = this.virtualPt(p);
      const id = v && this.realizeVirtual(v);
      if (id) {
        h = { kind: "pt", id, q: P(this.data, id) };
        // tek başına kalırsa (boşluğa tıklanınca) ait olduğu eğriye dön
        const owner = v!.mid ?? (v!.on && !v!.on2 ? v!.on.id : undefined);
        if (owner) (st.vown = st.vown ?? {})[id] = owner;
      }
    }
    if (!h) h = this.hitTest(p);
    if (!h) {
      const ml = this.modelLineAt(p);
      if (ml) h = { kind: "ent", id: ml, q: p };
    }
    // zincir ölçü (SolidWorks): önceki yatay / dikey ölçünün son noktasından bu noktaya aynı hizada
    let forced: any = null;
    const ch = this.chainSt;
    if (h && h.kind === "pt" && this.opts.chainDim && ch && !st.refs.length && h.id !== ch.last && this.data.pts[ch.last]) {
      const A = P(this.data, ch.last), B = P(this.data, h.id);
      forced = { t: "dist", refs: [ch.last, h.id], sub: ch.sub, lp: ch.sub === "h" ? [(A[0] + B[0]) / 2, ch.lp[1]] : [ch.lp[0], (A[1] + B[1]) / 2] };
      h = null;
    }
    if (h) {
      if (st.refs.length >= 2 || st.refs.includes(h.id)) st.refs = [];
      st.refs.push(h.id);
      this.render();
      return;
    }
    if (!forced && !st.refs.length) return;
    if (st.refs.length === 1 && st.vown?.[st.refs[0]]) {
      // çizgi ortasına / çeyreğe tıklanıp tek bırakıldı: SolidWorks gibi çizginin/dairenin kendisini ölç
      const vid = st.refs[0];
      st.refs = [st.vown[vid]];
      this.op(() => deleteIds(this.data, [...this.data.ents.filter((e) => e.t === "point" && (e as any).p === vid).map((e) => e.id), vid]));
    }
    st.vown = undefined;
    const spec = forced ?? this.dimSpec(st.refs, p);
    st.refs = [];
    this.render();
    if (!spec) return this.host.toast("Bu seçim için ölçü yok");
    const cur = measure(this.data, spec);
    // SolidWorks: ölçü konur konmaz gereksizse sor — sürülen (referans) yap ya da vazgeç
    if (this.dimRedundant(spec, cur)) {
      void this.askRedundant("Bu ölçüyü eklemek eskizi aşırı tanımlar (değeri zaten diğer ölçü / ilişkilerle belirli).").then((a) => {
        if (!a) return;
        this.addOver(() => ({ id: nid(this.data, "d"), ...spec, v: Math.abs(cur), ...(a === "ref" ? { ref: true } : {}) }) as SDim, a);
      });
      return;
    }
    this.promptValue(e.clientX, e.clientY, Math.abs(cur), spec.t === "angle" ? "°" : "mm", (v) => {
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
      if (ok && spec.t === "dist" && (spec.sub === "h" || spec.sub === "v")) this.chainSt = { last: spec.refs[1], sub: spec.sub, lp: spec.lp };
      if (ok) return this.host.changed();
      // SolidWorks gibi: aşırı tanımlıyorsa referans ölçü olarak eklemeyi öner
      const red = this.redundantHit;
      void this.askRedundant(red ? "Bu ölçü eskizi aşırı tanımlar (değeri zaten belirli)." : "Bu ölçü değeri diğer ölçü / ilişkilerle çelişiyor; eskiz aşırı tanımlı olur.", red).then((a) => {
        if (!a) return;
        this.addOver(() => {
          const d = make();
          if (a === "ref") {
            d.ref = true;
            d.v = Math.abs(cur);
            delete d.expr;
          } else d.v = Math.abs(cur) * (d.v < 0 ? -1 : 1);
          return d;
        }, a);
      });
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
    // SolidWorks çift mesafe: merkez çizgisine (yapı çizgisi) ölçüde etiket çizginin öbür yanına konursa Ø
    const dblOf = (q: Vec2, l: SLine) => {
      if (!l.cons) return {};
      const A = P(sk, l.p1), u = sub2(P(sk, l.p2), A);
      const s1 = crs2(u, sub2(q, A)), s2 = crs2(u, sub2(lp, A));
      return s1 * s2 < 0 ? { dbl: true } : {};
    };
    if (isPt(0) && e1?.t === "line") return { t: "pldist", refs: [ptOf(0), e1.id], lp, ...dblOf(P(sk, ptOf(0)), e1) };
    if (isPt(1) && e0?.t === "line") return { t: "pldist", refs: [ptOf(1), e0.id], lp, ...dblOf(P(sk, ptOf(1)), e0) };
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
    // SolidWorks Değiştir kutusu: değer yazarken / ⟳ ile eskiz canlı güncellenir, ✕ ile geri döner
    const snap = JSON.stringify(this.data);
    let flip = false;
    const restore = () => {
      this.data = JSON.parse(snap);
      this.resolve();
      this.render();
    };
    const live = (v: number | null, toggleFlip = false) => {
      if (toggleFlip) flip = !flip;
      this.data = JSON.parse(snap);
      const dd = this.data.dims.find((x) => x.id === d.id);
      if (dd && v !== null && (v > 0 || dd.t === "dist")) {
        const sg = (dd.t === "dist" && dd.sub !== "a" ? Math.sign(dd.v || 1) : 1) * (flip ? -1 : 1);
        dd.v = dd.t === "dist" && dd.sub !== "a" ? v * sg : v;
      }
      this.resolve();
      this.render();
    };
    this.promptValue(x, y, Math.abs(d.v), d.t === "angle" ? "°" : "mm", (v) => {
      restore();
      const ex = this.lastExpr;
      if (v <= 0 && d.t !== "dist") return this.host.toast("Değer sıfırdan büyük olmalı", true);
      const old = d.v * (flip ? -1 : 1);
      const ok = this.op(() => {
        const dd = this.data.dims.find((x) => x.id === d.id);
        if (dd) {
          dd.v = dd.t === "dist" && dd.sub !== "a" ? v * Math.sign(old || 1) : v;
          if (flip && dd.t !== "dist") flip = false;
          if (ex) dd.expr = ex;
          else delete dd.expr;
        }
      }, "Bu değer eskizde çözülemiyor");
      if (ok) this.host.changed();
    }, { live, cancel: restore, canFlip: d.t === "dist" && d.sub !== "a" });
  }

  /** son girilen değer değişken içeren bir ifadeyse (ör. "=kalinlik*2") */
  lastExpr: string | null = null;

  private promptValue(x: number, y: number, cur: number, unit: string, done: (v: number) => void, extra?: { live: (v: number | null, flip?: boolean) => void; cancel: () => void; canFlip: boolean }) {
    document.querySelector(".dim-prompt")?.remove();
    if (unit === "mm" && units === "in") {
      const d0 = done, ex = extra;
      cur = cur / 25.4;
      unit = "in";
      done = (v) => d0(v * 25.4);
      if (ex) extra = { ...ex, live: (v, fl) => ex.live(v === null ? null : v * 25.4, fl) };
    }
    const box = document.createElement("div");
    box.className = "dim-prompt";
    box.innerHTML = `<button class="dec" aria-label="Azalt">−</button><input inputmode="decimal" autocomplete="off" /><button class="inc" aria-label="Artır">+</button><span>${unit}</span><button class="ok" aria-label="Tamam">✓</button><button class="no" aria-label="İptal">✕</button>${extra ? `<button class="rb" title="Yeniden oluştur (canlı)">⟳</button>${extra.canFlip ? `<button class="fl" title="Yönü ters çevir">±</button>` : ""}` : ""}`;
    const inp = box.querySelector("input")!;
    inp.value = fmtNum(cur, 3);
    const liveNow = () => extra?.live(evalNum(inp.value.trim()));
    if (extra) {
      inp.addEventListener("input", liveNow);
      box.querySelector(".rb")!.addEventListener("click", liveNow);
      box.querySelector(".fl")?.addEventListener("click", () => extra.live(evalNum(inp.value.trim()), true));
    }
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
    box.querySelector(".no")!.addEventListener("click", () => (close(), extra?.cancel()));
    // SolidWorks Değiştir kutusu: tekerlek / ↑↓ ile artım (Shift ×10, Alt ×0,1)
    const bump = (dir: number, ev: { shiftKey: boolean; altKey: boolean }) => {
      const v = evalNum(inp.value.trim());
      if (v === null) return;
      const step = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
      inp.value = fmtNum(Math.round((v + dir * step) * 1e6) / 1e6, 3);
      inp.classList.remove("bad");
      liveNow();
    };
    box.querySelector(".dec")!.addEventListener("click", () => bump(-1, { shiftKey: false, altKey: false }));
    box.querySelector(".inc")!.addEventListener("click", () => bump(1, { shiftKey: false, altKey: false }));
    inp.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      bump(ev.deltaY < 0 ? 1 : -1, ev);
    }, { passive: false });
    inp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") apply();
      if (ev.key === "Escape") (close(), extra?.cancel());
      if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
        ev.preventDefault();
        bump(ev.key === "ArrowUp" ? 1 : -1, ev);
      }
      ev.stopPropagation();
    });
  }

  // ---------------- Çizim ----------------
  /** Kapalı bölgeleri açık renkle gölgelendir (katı oluşturulabilecek profiller) */
  private shadeRegions() {
    let loops: any[];
    try {
      loops = extractLoops(this.data).loops;
    } catch {
      return;
    }
    if (!loops.length) return;
    const ptsOf = (l: any): Vec2[] => {
      if ("circle" in l) return Array.from({ length: 48 }, (_, i) => [l.circle.c[0] + l.circle.r * Math.cos((i / 48) * TAU), l.circle.c[1] + l.circle.r * Math.sin((i / 48) * TAU)] as Vec2);
      if ("ellipse" in l) {
        const { c, rx, ry, rot } = l.ellipse;
        const cr = Math.cos((rot * Math.PI) / 180), sr = Math.sin((rot * Math.PI) / 180);
        return Array.from({ length: 48 }, (_, i) => {
          const a = (i / 48) * TAU, x = rx * Math.cos(a), y = ry * Math.sin(a);
          return [c[0] + x * cr - y * sr, c[1] + x * sr + y * cr] as Vec2;
        });
      }
      return l.segs.flatMap((sg: any) => segPoints(sg, 12).slice(0, -1));
    };
    const inside = (p: Vec2, pl: Vec2[]) => {
      let c = false;
      for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) {
        const a = pl[i], b = pl[j];
        if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
      }
      return c;
    };
    const polys = loops.map((l) => ({ pts: ptsOf(l), depth: l.depth as number }));
    const mat = new THREE.MeshBasicMaterial({ color: 0x4dabf7, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
    for (const outer of polys.filter((q) => q.depth % 2 === 0)) {
      if (outer.pts.length < 3) continue;
      const shape = new THREE.Shape(outer.pts.map((q) => new THREE.Vector2(q[0], q[1])));
      for (const hole of polys.filter((q) => q.depth === outer.depth + 1 && q.pts.length > 2 && inside(q.pts[0], outer.pts)))
        shape.holes.push(new THREE.Path(hole.pts.map((q) => new THREE.Vector2(q[0], q[1]))));
      const geo = new THREE.ShapeGeometry(shape);
      const m = new THREE.Mesh(geo, mat);
      const f = this.frame;
      const x = new THREE.Vector3(...f.x), n = new THREE.Vector3(...f.n), y = new THREE.Vector3().crossVectors(n, x);
      m.matrixAutoUpdate = false;
      m.matrix.copy(new THREE.Matrix4().makeTranslation(...f.o).multiply(new THREE.Matrix4().makeBasis(x, y, n)));
      m.renderOrder = -5;
      this.group.add(m);
    }
  }

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

  /** eğrilik tarağı: örnek noktalarda eğrilik (üç nokta çemberi), normal yönde ölçekli dişler ve uçlarını birleştiren zarf */
  combOf(pts: Vec2[]): Vec2[][] {
    if (pts.length < 3) return [];
    const ks: number[] = [], ns: Vec2[] = [];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const A = d2(b, c), B = d2(a, c), C = d2(a, b), cr = crs2(sub2(b, a), sub2(c, a));
      ks.push(A * B * C > 1e-12 ? (2 * cr) / (A * B * C) : 0);
      const t = norm2(sub2(c, a));
      ns.push([-t[1], t[0]]);
    }
    const kmax = Math.max(...ks.map(Math.abs), 1e-9);
    const scale = (this.opts.combScale * this.wpp() * 60) / kmax;
    const teeth: Vec2[][] = [], env: Vec2[] = [];
    ks.forEach((k, i) => {
      const p = pts[i + 1], q: Vec2 = add2(p, mul2(ns[i], -k * scale));
      teeth.push([p, q]);
      env.push(q);
    });
    return [...teeth, env];
  }
  /** spline eğrilik tarağı açık / kapalı */
  toggleComb() {
    this.opts.comb = !this.opts.comb;
    this.render();
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
    if (!this.press?.moved) this.shadeRegions();
    if (this.openEnds.length) {
      const k = 5 * this.wpp();
      for (const id of this.openEnds) {
        if (!sk.pts[id]) continue;
        const q = P(sk, id);
        this.addLines([[q[0] - k, q[1] - k], [q[0] + k, q[1] + k]], 0xe03131, 3);
        this.addLines([[q[0] - k, q[1] + k], [q[0] + k, q[1] - k]], 0xe03131, 3);
      }
    }
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
      // eğrilik tarağı (SolidWorks): seçili spline / konik için normal yönde eğrilikle orantılı dişler + zarf
      if ((e.t === "spline" || e.t === "parabola" || e.t === "ellipse") && this.sel.has(e.id) && this.opts.comb) for (const seg of this.combOf(this.entPolyline(e))) this.addLines(seg, 0xd6336c, 1);
      // spline tutamakları (seçiliyken): nokta ± tutamak, uçlarda kare; elle verilmiş olanlar mavi
      if (e.t === "spline" && this.sel.has(e.id))
        for (const hd of this.splineHandles(e)) {
          const col = hd.set ? 0x1c7ed6 : 0x868e96, r = 4 * this.wpp();
          this.addLines([hd.a, hd.b], col, 1.5);
          for (const t of [hd.a, hd.b]) this.addLines([[t[0] - r, t[1] - r], [t[0] + r, t[1] - r], [t[0] + r, t[1] + r], [t[0] - r, t[1] + r], [t[0] - r, t[1] - r]], col, 1.5);
        }
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
    const gi = this.st.inf as Inference | undefined;
    if (gi?.guides && this.tool !== "select") for (const g of gi.guides) this.addLines([g.a, g.b], g.rel ? 0xf59f00 : 0x339af0, 1.2, true);
    this.renderPreview();
    this.renderFree();
    this.renderOpPreview();
    this.renderDims();
    if (this.opts.showRels) this.renderRels();
    v.requestRender();
    this.placeLabels();
  }

  private renderFree() {
    const f = this.free;
    if (!f) return;
    if (!f.shape) return void (f.pts.length > 1 && this.addLines(f.pts, C.prev, 2));
    this.addLines(f.pts, 0xbbbbbb, 1, true);
    const sh = f.shape, col = 0x1e90ff;
    if (sh.kind === "line") this.addLines([sh.a, sh.b], col, 3);
    else if (sh.kind === "poly") this.addLines(sh.closed ? [...sh.pts, sh.pts[0]] : sh.pts, col, 3);
    else if (sh.kind === "rect" || sh.kind === "ellipse") this.addLines(outline(sh), col, 3);
    else if (sh.kind === "circle") this.addLines(Array.from({ length: 65 }, (_, i) => [sh.c[0] + sh.r * Math.cos((i / 64) * 2 * Math.PI), sh.c[1] + sh.r * Math.sin((i / 64) * 2 * Math.PI)] as Vec2), col, 3);
    else if (sh.kind === "arc") {
      const g = circle3(sh.s, sh.m, sh.e);
      if (!g) return this.addLines([sh.s, sh.e], col, 3);
      const a0 = Math.atan2(sh.s[1] - g.c[1], sh.s[0] - g.c[0]), am = Math.atan2(sh.m[1] - g.c[1], sh.m[0] - g.c[0]), a1 = Math.atan2(sh.e[1] - g.c[1], sh.e[0] - g.c[0]);
      const norm = (x: number) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let sw = norm(a1 - a0);
      if (norm(am - a0) > sw) sw = sw - 2 * Math.PI;
      this.addLines(Array.from({ length: 49 }, (_, i) => [g.c[0] + g.r * Math.cos(a0 + (sw * i) / 48), g.c[1] + g.r * Math.sin(a0 + (sw * i) / 48)] as Vec2), col, 3);
    } else this.addLines(sh.pts, col, 3);
  }
  private renderPreview() {
    const st = this.st;
    const cur: Vec2 | null = st.inf?.p ?? this.cursor;
    if (!cur) return;
    const pc = C.prev;
    switch (this.tool) {
      case "line":
      case "centerline":
        if (st.lastPos && st.arc && st.lastEnt && getEnt(this.data, st.lastEnt)) {
          const g = this.tangentArcGeo(st.lastPos, st.arcDir ?? this.tangentAt(st.lastEnt, st.last), cur);
          if (g) {
            let s0 = ang(g.c, st.lastPos), e0 = ang(g.c, cur);
            if (!g.ccw) [s0, e0] = [e0, s0];
            const span = normAng(e0 - s0);
            const pts: Vec2[] = [];
            for (let i = 0; i <= 48; i++) pts.push([g.c[0] + g.r * Math.cos(s0 + (span * i) / 48), g.c[1] + g.r * Math.sin(s0 + (span * i) / 48)]);
            this.addLines(pts, pc);
          }
        } else if (st.lastPos) this.addLines([st.lastPos, cur], pc, 2, this.tool === "centerline");
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
    const lay = e.on ? textAlong(this.data, e) : null;
    if (lay) {
      for (const c of lay) this.drawTextAt({ ...e, on: undefined, text: c.ch, angle: c.angle }, [c.x, c.y]);
      return;
    }
    this.drawTextAt(e, P(this.data, e.p));
  }
  private drawTextAt(e: SText, q: Vec2) {
    const el = document.createElement("div");
    const col = this.entColor(e);
    el.className = "sk-text";
    el.textContent = e.text;
    el.style.color = "#" + col.toString(16).padStart(6, "0");
    const px = e.size / this.wpp();
    el.style.fontSize = px * 1.05 + "px";
    el.style.lineHeight = "1";
    this.labelBox.appendChild(el);
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
      text = (d.dbl ? "Ø" : "") + lenTxt(Math.abs(d.v));
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
        text = "Ø" + lenTxt(Math.abs(d.v));
      } else {
        const far = len2(sub2(L, c)) > r ? L : rim;
        this.addLines([c, far], color, 1);
        this.arrow(rim, u, color);
        text = "R" + lenTxt(Math.abs(d.v));
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
      text = "⌒" + lenTxt(Math.abs(d.v));
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
      text = lenTxt(Math.abs(d.v));
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
      text = lenTxt(Math.abs(d.v));
    }
    const el = document.createElement("div");
    el.className = "dim" + (preview ? " preview" : "") + (color === C.over ? " err" : color === C.sel ? " sel" : "") + (d.ref ? " ref" : "");
    el.textContent = d.ref ? `(${text})` : d.expr ? `Σ ${text}` : text;
    this.labelBox.appendChild(el);
    this.anchors.push({ el, w: this.W(L) });
    if (!preview) this.wireDimLabel(el, d);
  }

  private dimClickT = { id: "", t: 0 };
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
      // fare: SolidWorks gibi tek tık seçer, çift tık Değiştir kutusunu açar
      if (e.pointerType === "mouse" && this.tool === "select") {
        const now = performance.now();
        const dbl = this.dimClickT.id === d.id && now - this.dimClickT.t < 450;
        this.dimClickT = { id: d.id, t: now };
        if (!dbl) {
          if (!(e.ctrlKey || e.shiftKey)) this.sel.clear();
          this.sel.add(d.id);
          this.render();
          this.renderPanel();
          return;
        }
      }
      if (this.tool === "select" && this.sel.size && !this.sel.has(d.id) && e.pointerType !== "mouse") {
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
    if (this.blockEdit) {
      const bx = h("div", "pm-section block-edit");
      bx.appendChild(h("b", "", `Blok düzenleniyor: ${this.blockEdit.tag.split("#")[0]}`));
      bx.appendChild(h("p", "pm-hint", "Örneği düzenleyin (yeni çizilen öğeler bloğa katılır). Güncelleyince tanım ve tüm örnekler değişir."));
      const r = h("div", "pm-buttons");
      const ok = h("button", "btn primary", "Bloğu güncelle");
      ok.addEventListener("click", () => this.finishBlockEdit(true));
      const no = h("button", "btn", "Blok düzenlemeden çık");
      no.addEventListener("click", () => this.finishBlockEdit(false));
      r.append(ok, no);
      bx.appendChild(r);
      box.appendChild(bx);
    }

    if (this.tool === "block") {
      const lib = loadBlocks();
      const names = Object.keys(lib);
      if (!names.length) box.appendChild(h("p", "pm-hint", "Kütüphanede blok yok."));
      else {
        if (!names.includes(this.opts.block)) this.opts.block = names[0];
        const sel = document.createElement("select");
        sel.innerHTML = names.map((n) => `<option>${n.replace(/</g, "&lt;")}</option>`).join("");
        sel.value = this.opts.block;
        sel.addEventListener("change", () => (this.opts.block = sel.value));
        box.appendChild(sel);
        const del = h("button", "btn danger", "Bloğu kütüphaneden sil");
        del.addEventListener("click", () => {
          const l = loadBlocks();
          delete l[this.opts.block];
          saveBlocks(l);
          this.renderPanel();
        });
        box.appendChild(del);
      }
    }
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
      mk("Zincir ölçü (sıradaki noktalar öncekinden ölçülür)", "chainDim" as any);
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
        box.appendChild(h("div", "pm-sub", "Kenarları izle"));
        const tz = this.traceOpt;
        const fsel = document.createElement("select");
        fsel.innerHTML = `<option value="auto">Nesne: otomatik</option><option value="dark">Koyu nesne, açık zemin</option><option value="light">Açık nesne, koyu zemin</option>`;
        fsel.value = tz.fg;
        fsel.addEventListener("change", () => (tz.fg = fsel.value as any));
        box.appendChild(fsel);
        box.appendChild(this.numField("Eşik (0 = otomatik)", tz.thr, (v) => (tz.thr = Math.max(0, Math.min(255, Math.round(v))))));
        box.appendChild(this.numField("Sadeleştirme (piksel)", tz.eps, (v) => (tz.eps = Math.max(0.5, v))));
        const rl = h("label", "pm-check");
        const rc = document.createElement("input");
        rc.type = "checkbox";
        rc.checked = tz.shapes;
        rc.addEventListener("change", () => (tz.shapes = rc.checked));
        rl.append(rc, document.createTextNode(" Daire / dikdörtgen / elips tanı"));
        box.appendChild(rl);
        const tb = h("button", "btn primary", "Kenarları izle");
        tb.addEventListener("click", () => void this.traceEdges());
        box.appendChild(tb);
        box.appendChild(h("p", "pm-hint", "Önce resmi iki noktayla gerçek ölçüye getirin. Parçayı düz, zıt renkli zemine koyup tepeden çekin."));
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
      const fs = document.createElement("select");
      fs.innerHTML = `<option value="">Yazı tipi: Sans</option><option value="bold">Sans kalın</option><option value="serif">Serif</option><option value="mono">Eş aralıklı (mono)</option>`;
      fs.value = this.opts.textFont;
      fs.addEventListener("change", () => (this.opts.textFont = fs.value));
      box.append(fs, h("p", "pm-hint", "Eğri üzerinde metin: bir çizgiye / yaya / spline'a dokunun (ya da önce eğriyi seçin)."));
    }
    if (this.tool === "slot" || this.tool === "cslot") {
      const sl = document.createElement("select");
      sl.innerHTML = `<option value="none">Ölçü ekleme</option><option value="cc">Ölçü: merkezden merkeze + genişlik</option><option value="total">Ölçü: toplam boy + genişlik</option>`;
      sl.value = this.opts.slotDims;
      sl.addEventListener("change", () => (this.opts.slotDims = sl.value as any));
      box.appendChild(sl);
    }
    if (this.tool === "convert") {
      const l = h("label", "pm-check");
      const c = document.createElement("input");
      c.type = "checkbox";
      c.checked = this.opts.convInner;
      c.addEventListener("change", () => (this.opts.convInner = c.checked));
      l.append(c, " Düz yüzde iç döngüleri de al");
      box.append(l, h("p", "pm-hint", "Kenara dokunun: o kenar; düz yüze dokunun: yüzün döngüsü; silindire dokunun: silüet kenarları."));
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
        if (e && (e.t === "spline" || e.t === "parabola" || e.t === "ellipse")) {
          const cb = h("button", "btn" + (this.opts.comb ? " primary" : ""), this.opts.comb ? "Eğrilik tarağını gizle" : "Eğrilik tarağı");
          cb.addEventListener("click", () => (this.toggleComb(), this.renderPanel()));
          box.appendChild(cb);
          if (this.opts.comb) box.appendChild(this.numField("Tarak ölçeği", this.opts.combScale, (v) => ((this.opts.combScale = Math.max(0.05, v)), this.render()), { min: 0.05 } as any));
          if (e.t === "spline") {
            box.appendChild(h("p", "pm-hint", "Tutamaklar: uçlarındaki kareleri sürükleyin (yön = teğet, boy = ağırlık)."));
            const hs = this.splineHandles(e);
            for (const [k, nm] of [[0, "Başlangıç"], [hs.length - 1, "Bitiş"]] as const) {
              const v = sub2(hs[k].b, hs[k].p);
              box.appendChild(this.numField(`${nm} teğet açısı (°)`, +((Math.atan2(v[1], v[0]) * 180) / Math.PI).toFixed(3), (deg) => {
                const L = Math.hypot(v[0], v[1]) || 1, r = (deg * Math.PI) / 180;
                this.setSplineHandle(e.id, k, [Math.cos(r) * L, Math.sin(r) * L]);
              }, { any: true }));
              box.appendChild(this.numField(`${nm} ağırlığı (mm)`, +Math.hypot(v[0], v[1]).toFixed(3), (L) => {
                const a = Math.atan2(v[1], v[0]);
                this.setSplineHandle(e.id, k, [Math.cos(a) * L, Math.sin(a) * L]);
              }, { min: 0.01 } as any));
            }
            if (e.h) {
              const rb = h("button", "btn", "Tutamakları sıfırla");
              rb.addEventListener("click", () => this.op(() => delete e.h));
              box.appendChild(rb);
            }
          }
        }
        if (e?.t === "text") {
          box.appendChild(this.textField("Metin", e.text, (v) => this.op(() => (e.text = v))));
          box.appendChild(this.numField("Yükseklik", e.size, (v) => this.op(() => (e.size = v))));
          box.appendChild(this.numField("Açı (°)", e.angle, (v) => this.op(() => (e.angle = v)), { any: true }));
          const fs = document.createElement("select");
          fs.innerHTML = `<option value="">Yazı tipi: Sans</option><option value="bold">Sans kalın</option><option value="serif">Serif</option><option value="mono">Eş aralıklı (mono)</option>`;
          fs.value = e.font ?? "";
          fs.addEventListener("change", () => this.op(() => (e.font = fs.value || undefined)));
          box.appendChild(fs);
          const cs = document.createElement("select");
          const curves = sk.ents.filter((x) => x.t !== "text" && x.t !== "point");
          cs.innerHTML = `<option value="">Eğri üzerinde değil</option>` + curves.map((x) => `<option value="${x.id}">Eğri: ${x.id} (${x.t})</option>`).join("");
          cs.value = e.on ?? "";
          cs.addEventListener("change", () => this.op(() => (e.on = cs.value || undefined)));
          box.appendChild(cs);
          if (e.on) {
            box.appendChild(this.numField("Harf aralığı (×)", e.sp ?? 1, (v) => this.op(() => (e.sp = Math.max(0.3, v))), { min: 0.3 } as any));
            const fb = h("button", "btn", "Eğrinin yönünü çevir");
            fb.addEventListener("click", () => this.op(() => (e.flip = !e.flip)));
            box.appendChild(fb);
          }
        }
        const dd = sk.dims.find((x) => x.id === ids[0]);
        if (dd) {
          const b = h("button", "btn", dd.ref ? "Sürücü ölçü yap" : "Referans ölçü yap");
          b.addEventListener("click", () => this.toggleRefDim(dd.id));
          box.appendChild(b);
          if (dd.t === "pldist") {
            const db = h("button", "btn" + (dd.dbl ? " primary" : ""), "Çift mesafe (Ø, döndürme profili)");
            db.addEventListener("click", () => this.toggleDouble(dd.id));
            box.appendChild(db);
          }
          if (dd.t === "dia" || dd.t === "rad") {
            const tb = h("button", "btn", dd.t === "dia" ? "Yarıçap olarak göster (D)" : "Çap olarak göster (D)");
            tb.addEventListener("click", () => this.toggleDiaRad(dd.id));
            box.appendChild(tb);
          }
          if (dd.expr) box.appendChild(h("p", "pm-hint", `Denklem: ${dd.expr}`));
          const ac = this.arcDimOf(dd);
          if (ac) {
            const cur = dd.t === "cl" || dd.t === "cc" ? dd.cond ?? "min" : "c";
            const row = h("div", "pm-row");
            row.appendChild(h("span", "pm-sub", "Yay koşulu"));
            for (const [k, t] of [["c", "Merkez"], ["min", "En yakın"], ["max", "En uzak"]] as const) {
              const bb = h("button", "btn" + (cur === k ? " primary" : ""), t);
              bb.addEventListener("click", () => this.setArcCond(dd.id, k));
              row.appendChild(bb);
            }
            box.appendChild(row);
          }
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
      // eşit eğrilik (spline ucu ↔ yay): tutamak yönü teğete, boyu eğriliği eşitleyecek şekilde ayarlanır (tek seferlik)
      const ecu = ids.length === 2 ? this.curvPair(ids) : null;
      if (ecu) {
        const b = h("button", "btn rel-btn", "≈ Eşit eğrilik");
        b.addEventListener("click", () => this.equalCurvature(ids));
        (box.querySelector(".pm-buttons") ?? box).appendChild(b);
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
      if (ids.some((id) => getEnt(sk, id))) {
        const bb = h("button", "btn", "Blok olarak kaydet");
        bb.addEventListener("click", () => {
          const nm = prompt("Blok adı:", "Blok");
          if (nm) this.saveBlock(nm);
        });
        box.appendChild(bb);
        const tag = this.selBlockTag();
        if (tag && !this.blockEdit) {
          const eb = h("button", "btn", `Bloğu düzenle (${tag.split("#")[0]})`);
          eb.addEventListener("click", () => this.editBlock(tag));
          const xb = h("button", "btn", "Bloğu dağıt");
          xb.addEventListener("click", () => this.explodeBlock(tag));
          box.append(eb, xb);
        }
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
    const gd = h("label", "pm-check");
    const gc = document.createElement("input");
    gc.type = "checkbox";
    gc.checked = this.opts.gridSnap;
    gc.addEventListener("change", () => {
      this.opts.gridSnap = gc.checked;
      try {
        localStorage.setItem("imajcad.gridSnap", gc.checked ? "1" : "0");
      } catch {}
    });
    gd.append(gc, document.createTextNode(" Izgaraya yakala"));
    box.appendChild(gd);
    // eskiz ayarları: ızgara aralığı (0 = otomatik) ve açı yakalama (0 = kapalı)
    const keep = () => {
      try {
        localStorage.setItem("imajcad.skset", JSON.stringify({ gridStep: this.opts.gridStep, angSnap: this.opts.angSnap }));
      } catch {}
    };
    box.appendChild(this.numField("Izgara aralığı (0 = otomatik)", this.opts.gridStep, (v) => ((this.opts.gridStep = Math.max(0, v)), keep()), { min: 0 } as any));
    const as = document.createElement("select");
    as.innerHTML = `<option value="0">Açı yakalama: kapalı</option><option value="5">Açı yakalama: 5°</option><option value="15">Açı yakalama: 15°</option><option value="30">Açı yakalama: 30°</option><option value="45">Açı yakalama: 45°</option>`;
    as.value = String(this.opts.angSnap);
    as.addEventListener("change", () => ((this.opts.angSnap = +as.value), keep()));
    box.appendChild(as);
    if (["line", "centerline", "rect", "crect", "circle"].includes(this.tool)) {
      const nb = h("button", "btn", "Sayıyla gir (123)");
      nb.addEventListener("click", () => this.numericEntry());
      box.appendChild(nb);
    }
    if (this.tool === "select" && this.data.ents.length) {
      const sb = h("button", "btn", "Kaba çizimi düzelt (yatay/dikey)");
      sb.addEventListener("click", () => this.straighten());
      box.appendChild(sb);
    }
    if (this.tool !== "select") box.appendChild(h("p", "pm-hint", "Ctrl basılı: otomatik ilişki/yakalama kapalı. Bir noktanın üzerinde bekleyin: mavi hizalama çizgileri çıkar."));
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
    if (!r.ok || r.conflicts.length) box.appendChild(this.sketchXpert(h));
  }
  /** SketchXpert (SolidWorks): çakışan ilişki / ölçüleri listeler, tek tek silmeyi dener ve çözen seçenekleri önerir */
  xpertSolutions(): { id: string; label: string }[] {
    const sk = this.data, r = this.result;
    const cands = [...new Set([...r.conflicts, ...r.redundant].map((x) => x.split("#")[0]))];
    const label = (id: string) => {
      const rel = sk.rels.find((x) => x.id === id);
      if (rel) return "İlişki: " + REL_NAMES[rel.t];
      const d = sk.dims.find((x) => x.id === id);
      return d ? `Ölçü: ${fmtNum(d.v, 2)}` : id;
    };
    const out: { id: string; label: string }[] = [];
    for (const id of cands) {
      const tmp: SketchData = JSON.parse(JSON.stringify(sk));
      tmp.rels = tmp.rels.filter((x) => x.id !== id);
      tmp.dims = tmp.dims.filter((x) => x.id !== id);
      const t = solve(tmp, undefined, false);
      if (t.ok && !t.conflicts.length) out.push({ id, label: label(id) });
    }
    return out;
  }
  private sketchXpert(h: (tag: string, cls?: string, text?: string) => HTMLElement) {
    const box = h("div", "pm-xpert");
    box.appendChild(h("div", "pm-sub", "SketchXpert — çözüm önerileri"));
    const sols = this.xpertSolutions();
    if (!sols.length) box.appendChild(h("p", "pm-hint", "Tek bir öğeyi silmek yetmiyor; kırmızı öğelerden birkaçını silin."));
    for (const sol of sols) {
      const row = h("div", "pm-relrow");
      row.appendChild(h("span", "", `${sol.label} silinirse eskiz çözülür`));
      const b = h("button", "btn primary", "Uygula");
      b.addEventListener("click", () => {
        this.op(() => {
          this.data.rels = this.data.rels.filter((x) => x.id !== sol.id);
          this.data.dims = this.data.dims.filter((x) => x.id !== sol.id);
        });
        this.host.changed();
        this.render();
        this.renderPanel();
      });
      row.appendChild(b);
      box.appendChild(row);
    }
    return box;
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
        chk("Çift yön", "offBoth" as any);
        chk("Tabanı yapı geometrisi yap", "offBaseCons" as any);
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
        box.appendChild(this.textField("Atlanacak örnekler (ör. 3 ya da 2,1)", o.pskip, (v) => ((o.pskip = v), this.render())));
        break;
      case "scpat":
        num("Adet", "cn", { min: 2 });
        num("Toplam açı (°)", "ctotal");
        box.appendChild(this.textField("Atlanacak örnekler (ör. 3, 5)", o.pskip, (v) => ((o.pskip = v), this.render())));
        break;
      case "move": {
        const k = this.opts.mkind;
        if (k === "all" || k === "move" || k === "copy" || k === "stretch") num("X öteleme", "mdx", { any: true }), num("Y öteleme", "mdy", { any: true });
        if (k === "all" || k === "rot") num("Döndürme açısı (°)", "mang", { any: true });
        if (k === "all" || k === "scale") num("Ölçek", "mscale", { min: 1e-6 });
        if (k === "all" || k === "rot" || k === "scale") chk("Kopyala (orijinali koru)", "mcopy");
        if (k === "stretch") box.appendChild(h("p", "pm-hint", "Esnet: seçili noktalar ve seçili öğelerin uçları taşınır; onlara bağlı seçilmemiş çizgiler uzar / kısalır."));
        break;
      }
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

// ---------------- Blok kütüphanesi (cihazda) ----------------
type BlockDef = { pts: Record<string, { x: number; y: number }>; ents: SEnt[]; rels: SketchData["rels"]; dims: SketchData["dims"] };
export function loadBlocks(): Record<string, BlockDef> {
  try {
    return JSON.parse(localStorage.getItem("imajcad.blocks") ?? "{}");
  } catch {
    return {};
  }
}
function saveBlocks(b: Record<string, BlockDef>) {
  try {
    localStorage.setItem("imajcad.blocks", JSON.stringify(b));
  } catch {}
}
