import "./style.css";
import { Viewer, type InputHandler, type PickHit } from "./viewer";
import { Kernel } from "./kernel";
import { initSolver } from "./sketch/solver";
import { SketchEditor, TOOL_NAMES, type SkTool } from "./sketch/editor";
import { newSketch } from "./sketch/model";
import { pointPos } from "./sketch/profile";
import { compile, resolveFrame, sketchUsers } from "./doc/compile";
import { STD_FRAMES, STD_NAMES, dist3, fmtNum, frameFromNormal, toWorld, toLocal, evalNum, setVarResolver, AXES } from "./doc/math";
import { solve as solveSketch } from "./sketch/solver";
import type {
  EdgeRef, Feature, FaceRef, PartDoc, PlaneRef, SketchFeature, StdPlane, Vec3, ExtrudeFeature, RevolveFeature, HoleFeature, MeasureItem, Vec2,
  FlatResult, Sketch3DFeature,
} from "./doc/types";
import { lastSheetBase, sheetParamsBefore, bendAllowance } from "./sheet/sheet";
import { flatToDxf } from "./sheet/dxf";
import { PROFILES, ALIGN_NAMES, placedProfile, loadLibrary, saveLibrary, type ProfileStd } from "./weld/profiles";
import { extractLoops } from "./sketch/profile";
import { sheetSvg, sheetsHtml, plateDxf, type SheetInfo } from "./weld/drawing";
import { loadImageFile, pictureMesh } from "./sketch/picture";
import { holeDefaults, MATERIALS, METRIC_PITCH, sizesFor, threadMajor, threadLabel } from "./doc/standards";
import * as THREE from "three";
import { ICONS } from "./ui/icons";
import { WIZARDS } from "./ui/wizards";
import { prefs, savePrefs, onPrefs, effectiveProfile, detected, isTouchDevice, PROFILE_INFO, DEFAULTS, type PenProfile } from "./input/prefs";
import { h, numField, checkField, selectField, segField, group, button, setEqHook } from "./ui/dom";

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const STORE = "imajcad.doc.v2";

// =====================================================================
// Belge
// =====================================================================
function emptyDoc(): PartDoc {
  return { version: 2, name: "Parça1", features: [], seq: {} };
}
let doc: PartDoc = loadDoc();
function loadDoc(): PartDoc {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const d = JSON.parse(raw);
      if (d?.version === 2) return d;
    }
  } catch {
    /* yok */
  }
  return emptyDoc();
}
function saveDoc() {
  try {
    localStorage.setItem(STORE, JSON.stringify(doc));
  } catch {
    /* depolama yok */
  }
}
const undoStack: string[] = [];
const redoStack: string[] = [];
function commitDoc(mutate: () => void) {
  undoStack.push(JSON.stringify(doc));
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
  mutate();
  saveDoc();
  afterDocChange();
}
function afterDocChange() {
  const eqErr = applyEquations();
  if (eqErr.length) toast(eqErr[0], true);
  renderTree();
  updatePlanes();
  rebuild();
  updateUndo();
}
const FEAT_NAMES: Record<string, string> = {
  sheetjog: "Kademe",
  miterflange: "Gönye-Flanş",
  closecorner: "Köşe-Kapatma",
  tosheet: "Saca-Dönüştür",
  combine: "Birleştir",
  splitbody: "Gövde-Böl",
  movebody: "Gövde-Taşı",
  delbody: "Gövde-Sil",
  indent: "Girinti",
  spattern: "Eskiz-Çoğaltma",
  tpattern: "Tablo-Çoğaltma",
  cvpattern: "Eğri-Çoğaltma",
  fpattern: "Doldurma-Çoğaltma",
  thread: "Diş",
  flex: "Esnet",
  vchamfer: "Köşe-Pahı",
  sketch3d: "3B-Eskiz",
  weld: "Kaynak-Dikişi",
  member: "Yapı-Elemanı",
  trim: "Kırp-Uzat",
  endcap: "Uç-Kapağı",
  gusset: "Köşe-Takviyesi",
  sheetbase: "Taban-Flanş",
  edgeflange: "Kenar-Flanş",
  hem: "Kenet",
  sketchbend: "Çizgiden-Büküm",
  sketch: "Eskiz",
  extrude: "Ekstrüzyon",
  cutExtrude: "Kesme-Ekstrüzyon",
  revolve: "Döndürme",
  cutRevolve: "Kesme-Döndürme",
  fillet: "Radyüs",
  chamfer: "Pah",
  shell: "Kabuk",
  lpattern: "DoğrusalÇoğaltma",
  cpattern: "DaireselÇoğaltma",
  mirror: "Ayna",
  plane: "Düzlem",
  sweep: "Süpürme",
  cutSweep: "Kesme-Süpürme",
  loft: "Loft",
  cutLoft: "Kesme-Loft",
  hole: "Delik",
  draft: "Koniklik",
  rib: "Kaburga",
  dome: "Kubbe",
  wrap: "Sarma",
  scale: "Ölçekle",
  import: "İçeAktarılan",
  axis: "Eksen",
  point: "Nokta",
  csys: "KoordinatSistemi",
};
function nextName(key: string) {
  doc.seq[key] = (doc.seq[key] ?? 0) + 1;
  return `${FEAT_NAMES[key] ?? key}${doc.seq[key]}`;
}
// ---------- Denklemler ----------
function varValue(name: string, seen = new Set<string>()): number | undefined {
  const ex = doc.vars?.[name];
  if (ex === undefined || seen.has(name)) return undefined;
  seen.add(name);
  return evalNum(ex, (n) => varValue(n, seen)) ?? undefined;
}
setVarResolver((n) => varValue(n));
setEqHook({
  get: (k) => doc.eqs?.[k],
  set: (k, e) => {
    doc.eqs = doc.eqs ?? {};
    if (e) doc.eqs[k] = e;
    else delete doc.eqs[k];
  },
});
/** Değişkenler değişince bağlı alanları ve eskiz ölçülerini günceller */
function applyEquations(): string[] {
  const errs: string[] = [];
  for (const [k, ex] of Object.entries(doc.eqs ?? {})) {
    const [fid, prop] = k.split(".");
    const f = getFeat(fid) as any;
    if (mode.k === "pm" && mode.draft.id === fid) continue;
    if (!f) continue;
    const v = evalNum(ex);
    if (v === null) errs.push(`${f.name}: "${ex}" hesaplanamadı`);
    else if (prop.includes("[")) {
      const m = prop.match(/^(\w+)\[(\d+)\]\[(\d+)\]$/);
      if (m && f[m[1]]?.[+m[2]]) f[m[1]][+m[2]][+m[3]] = v;
    } else f[prop] = v;
  }
  for (const f of doc.features) {
    if (f.type !== "sketch") continue;
    let changed = false;
    for (const d of f.data.dims) {
      if (!d.expr) continue;
      const v = evalNum(d.expr);
      if (v === null) {
        errs.push(`${f.name}: ölçü "${d.expr}" hesaplanamadı`);
        continue;
      }
      const nv = d.t === "dist" && d.sub !== "a" ? Math.abs(v) * Math.sign(d.v || 1) : Math.abs(v);
      if (Math.abs(nv - d.v) > 1e-12) {
        d.v = nv;
        changed = true;
      }
    }
    if (changed) solveSketch(f.data);
  }
  return errs;
}

/** Yeni özelliklerin ekleneceği yer (geri sarma çubuğu) */
function insertAt() {
  return doc.rollback ?? doc.features.length;
}
function insertFeature(f: Feature) {
  const i = insertAt();
  doc.features.splice(i, 0, f);
  if (doc.rollback !== null && doc.rollback !== undefined) doc.rollback++;
}

const uid = () => "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const featIndex = (id: string) => doc.features.findIndex((f) => f.id === id);
const getFeat = (id: string) => doc.features.find((f) => f.id === id);
function consumerOf(sketchId: string) {
  return sketchUsers(doc.features, sketchId)[0];
}

// =====================================================================
// Bileşenler
// =====================================================================
const viewer = new Viewer($("#view"));
const kernel = new Kernel();
let featureErrors = new Map<string, string>();

function setStatus(kind: "ok" | "busy" | "err" | "load" | "under" | "over", text: string) {
  const s = $("#status");
  s.className = kind;
  $("#status-text").textContent = text;
}
let toastTimer = 0;
function toast(msg: string, isErr = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = isErr ? "err" : "";
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), isErr ? 5000 : 2600);
}
function hint(text: string) {
  $("#hint").textContent = text;
}

// =====================================================================
// Mod durumu
// =====================================================================
type Mode =
  | { k: "part" }
  | { k: "pickSketchPlane"; tool?: SkTool }
  | { k: "sketch"; featId: string; isNew: boolean; orig: string; editor: SketchEditor }
  | { k: "pm"; draft: Feature; editingId?: string }
  | { k: "measure"; items: MeasureItem[] }
  | { k: "section" }
  | { k: "flat"; res: FlatResult; body: number };
let mode: Mode = { k: "part" };

// Parça modunda seçim
const psel = { faces: new Set<number>(), edges: new Set<number>(), planes: new Set<string>() };
let treeSel: string | null = null;
let hoverHit: PickHit | null = null;

// =====================================================================
// Yeniden hesaplama
// =====================================================================
let building = false;
let pending = false;
let firstBuild = true;

/** Görünümde hesaplanacak özellikler (moda göre geri sarılmış) */
function viewFeatures(): { feats: Feature[]; draftId?: string } {
  const all = doc.rollback !== null && doc.rollback !== undefined ? doc.features.slice(0, doc.rollback) : doc.features;
  if (mode.k === "sketch") return { feats: doc.features.slice(0, featIndex(mode.featId)) };
  if (mode.k === "pm") {
    const d = mode.draft;
    const live = !["fillet", "chamfer", "shell", "draft", "combine", "delbody", "indent", "thread", "tosheet"].includes(d.type) && !((d.type === "edgeflange" || d.type === "hem" || d.type === "miterflange") && !(d as any)._preview);
    const base = mode.editingId ? doc.features.slice(0, featIndex(mode.editingId)) : all;
    return { feats: live ? [...base, d] : base, draftId: d.id };
  }
  return { feats: all };
}

async function rebuild() {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  if (mode.k === "flat") leaveFlat();
  const isSketch = mode.k === "sketch";
  if (!isSketch) setStatus("busy", "Hesaplanıyor…");
  try {
    const { feats, draftId } = viewFeatures();
    const { kfeats, errors } = compile(feats, doc.profiles ?? {});
    const t0 = performance.now();
    const res = await kernel.build(kfeats);
    // yüz üzerindeki eskizler: yüz taşındıysa eskiz düzlemini güncelle
    for (const [sid, fr] of Object.entries(res.frames)) {
      const sf = getFeat(sid);
      if (sf?.type === "sketch" && sf.plane.k === "face") {
        sf.plane.frame = fr;
        if (sf.plane.face) sf.plane.face = { ...sf.plane.face, c: [sf.plane.face.c[0] + (fr.o[0] - sf.plane.face.c[0]) * Math.abs(fr.n[0]), sf.plane.face.c[1] + (fr.o[1] - sf.plane.face.c[1]) * Math.abs(fr.n[1]), sf.plane.face.c[2] + (fr.o[2] - sf.plane.face.c[2]) * Math.abs(fr.n[2])] };
      }
    }
    viewer.setModel(res.mesh);
    memberBodies = res.members;
    const errs = new Map(errors);
    res.errors.forEach((e) => errs.set(e.featureId, e.message));
    if (mode.k === "part") featureErrors = errs;
    draftError = draftId ? errs.get(draftId) ?? null : null;
    if (draftId && errs.get(draftId)) setStatus("err", errs.get(draftId)!);
    else if (mode.k === "part" && errs.size) setStatus("err", `${errs.size} özellikte hata`);
    else if (mode.k !== "sketch") setStatus("ok", `Hazır · ${Math.round(performance.now() - t0)} ms${res.mesh?.bodies && res.mesh.bodies > 1 ? ` · ${res.mesh.bodies} gövde` : ""}${doc.rollback != null ? " · geri sarılmış" : ""}`);
    if (firstBuild && res.mesh) viewer.fit();
    firstBuild = false;
    clearPartSel();
    renderTree();
    drawSketches();
    drawRefGeom();
    refreshHighlight();
  } catch (e) {
    setStatus("err", "Çekirdek hatası: " + (e as Error).message);
  } finally {
    building = false;
    if (pending) {
      pending = false;
      rebuild();
    }
  }
}

let draftError: string | null = null;
/** son yapımda yapı elemanı anahtarı -> gövde sırası */
let memberBodies: { key: string; name: string; body: number }[] = [];
let previewTimer = 0;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => rebuild(), 220);
}

// =====================================================================
// Düzlemler ve eskiz görüntüsü
// =====================================================================
function updatePlanes() {
  const list = (["front", "top", "right"] as StdPlane[]).map((n) => ({ id: n, frame: STD_FRAMES[n], label: STD_NAMES[n] }));
  for (const f of doc.features) {
    if (f.type !== "plane" || f.off) continue;
    const fr = resolveFrame({ k: "ref", id: f.id }, doc.features);
    if (fr) list.push({ id: f.id, frame: fr, label: f.name } as any);
  }
  viewer.setPlanes(list);
  viewer.setPlanesVisible(planesOn && mode.k !== "sketch");
}
let planesOn = true;

let sketchGroup: any[] = [];
function drawSketches() {
  for (const o of sketchGroup) {
    viewer.overlay.remove(o);
    o.geometry?.dispose();
  }
  sketchGroup = [];
  if (mode.k === "sketch") return viewer.requestRender();
  const { feats } = viewFeatures();
  for (const f of feats) {
    if (f.type !== "sketch" || f.off) continue;
    const shown = !consumerOf(f.id) || treeSel === f.id;
    if (!shown) continue;
    const fr = resolveFrame(f.plane, doc.features);
    if (!fr) continue;
    const segs: number[] = [];
    const cons: number[] = [];
    const sk = f.data;
    for (const e of sk.ents) {
      const pts: [number, number][] = [];
      if (e.t === "line") pts.push(pointPos(sk, e.p1), pointPos(sk, e.p2));
      else if (e.t === "circle" || e.t === "arc") {
        const c = pointPos(sk, e.c);
        let a0 = 0, a1 = Math.PI * 2;
        if (e.t === "arc") {
          const s = pointPos(sk, e.s), en = pointPos(sk, e.e);
          a0 = Math.atan2(s[1] - c[1], s[0] - c[0]);
          a1 = Math.atan2(en[1] - c[1], en[0] - c[0]);
          if (a1 <= a0) a1 += Math.PI * 2;
        }
        for (let i = 0; i <= 48; i++) pts.push([c[0] + e.r * Math.cos(a0 + ((a1 - a0) * i) / 48), c[1] + e.r * Math.sin(a0 + ((a1 - a0) * i) / 48)]);
      }
      const arr = e.cons ? cons : segs;
      for (let i = 0; i < pts.length - 1; i++) arr.push(...toWorld(fr, pts[i]), ...toWorld(fr, pts[i + 1]));
    }
    if (sk.pic) sketchGroup.push(pictureMesh(sk.pic, fr, () => viewer.requestRender()) as any);
    const col = treeSel === f.id ? 0x0ca5e9 : 0x1f2a37;
    if (segs.length) sketchGroup.push(viewer.fatLines(segs, col, 1.6));
    if (cons.length) sketchGroup.push(viewer.fatLines(cons, 0x6b7686, 1, true));
  }
  // 3B eskizler
  const s3 = feats.filter((f) => f.type === "sketch3d" && !f.off) as Sketch3DFeature[];
  if (mode.k === "pm" && mode.draft.type === "sketch3d" && !s3.includes(mode.draft)) s3.push(mode.draft);
  for (const f of s3) {
    const editing = mode.k === "pm" && mode.draft.id === f.id;
    if (!editing && consumerOf(f.id) && treeSel !== f.id) continue;
    const P = (id: string) => f.xyz[f.ids.indexOf(id)];
    const segs: number[] = [], cons: number[] = [];
    for (const l of f.lines) {
      const a = P(l.a), b = P(l.b);
      if (a && b) (l.cons ? cons : segs).push(...a, ...b);
    }
    const col = editing || treeSel === f.id ? 0x0ca5e9 : 0x1f2a37;
    if (segs.length) sketchGroup.push(viewer.fatLines(segs, col, 2));
    if (cons.length) sketchGroup.push(viewer.fatLines(cons, 0x6b7686, 1, true));
    if (editing) {
      const k = viewer.worldPerPixel() * 5;
      const act = (f as any)._act ?? f.xyz.length - 1;
      f.xyz.forEach((p, i) => {
        const kk = i === act ? k * 1.8 : k;
        sketchGroup.push(viewer.fatLines([p[0] - kk, p[1], p[2], p[0] + kk, p[1], p[2], p[0], p[1] - kk, p[2], p[0], p[1] + kk, p[2], p[0], p[1], p[2] - kk, p[0], p[1], p[2] + kk], i === act ? 0xf76707 : 0x0ca5e9, i === act ? 3 : 2));
      });
    }
  }
  sketchGroup.forEach((o) => viewer.overlay.add(o));
  viewer.requestRender();
}

// =====================================================================
// Seçim (parça modu)
// =====================================================================
function clearPartSel() {
  psel.faces.clear();
  psel.edges.clear();
  psel.planes.clear();
}
function refreshHighlight() {
  const sel = { faces: [...psel.faces], edges: [...psel.edges], planes: [...psel.planes] };
  if (mode.k === "pm") {
    const d = mode.draft;
    const m = viewer.mesh;
    if (m && (d.type === "fillet" || d.type === "chamfer")) {
      sel.edges = d.edges.map((r) => nearestEdge(r)).filter((i) => i >= 0);
      sel.faces = (d.faces ?? []).map((r) => nearestFace(r)).filter((i) => i >= 0);
    }
    if (m && d.type === "tosheet") sel.edges = [...d.bends, ...d.rips].map((r) => nearestEdge(r)).filter((i) => i >= 0);
    if (m && d.type === "closecorner") sel.faces = d.faces.map((r) => nearestFace(r)).filter((i) => i >= 0);
    if (m && d.type === "miterflange" && !(d as any)._preview) sel.edges = d.edges.map((r) => nearestEdge(r)).filter((i) => i >= 0);
    if (m && (d.type === "edgeflange" || d.type === "hem") && !(d as any)._preview) sel.edges = d.edges.map((r) => nearestEdge(r)).filter((i) => i >= 0);
    if (m && d.type === "weld") sel.faces = [...d.pairs.flatMap((p) => [p.f1, p.f2]), ...((d as any)._p1 ? [(d as any)._p1] : [])].map((r) => nearestFace(r)).filter((i) => i >= 0);
    const bodyFaces = (refs: (FaceRef | null | undefined)[]) => {
      const bs = new Set(refs.filter(Boolean).map((r) => m!.faces[nearestFace(r!)]?.b).filter((b) => b !== undefined));
      return m!.faces.map((f, i) => (f.b !== undefined && bs.has(f.b) ? i : -1)).filter((i) => i >= 0);
    };
    if (m && d.type === "combine") sel.faces = bodyFaces([d.main, ...d.tools]);
    if (m && (d.type === "splitbody" || d.type === "movebody" || d.type === "flex")) sel.faces = bodyFaces([d.body]);
    if (m && d.type === "delbody") sel.faces = bodyFaces(d.bodies);
    if (m && d.type === "indent") sel.faces = bodyFaces([d.target, d.tool]);
    if (m && (d.type === "fpattern" || d.type === "thread") && d.face) sel.faces = [nearestFace(d.face)].filter((i) => i >= 0);
    if (m && d.type === "endcap") sel.faces = d.faces.map((r) => nearestFace(r)).filter((i) => i >= 0);
    if (m && d.type === "gusset") sel.faces = [d.f1, d.f2].filter(Boolean).map((r) => nearestFace(r!)).filter((i) => i >= 0);
    if (m && d.type === "trim") {
      const keys = new Set([...d.targets, ...d.bounds].map((r) => `${r.f}:${r.i}`));
      const bs = new Set(memberBodies.filter((x) => keys.has(x.key)).map((x) => x.body));
      sel.faces = m.faces.map((f, i) => (f.b !== undefined && bs.has(f.b) ? i : -1)).filter((i) => i >= 0);
      sel.faces.push(...(d.faces ?? []).map((r) => nearestFace(r)).filter((i) => i >= 0));
    }
    if (m && (d.type === "shell" || d.type === "draft")) sel.faces = d.faces.map((r) => nearestFace(r)).filter((i) => i >= 0);
    if (m && d.type === "extrude" && d.face) sel.faces = [nearestFace(d.face)].filter((i) => i >= 0);
    const pr = d.type === "mirror" ? d.plane : d.type === "plane" ? d.base : null;
    if (pr?.k === "std") sel.planes.push(pr.n);
    if (pr?.k === "ref") sel.planes.push(pr.id);
  }
  if (mode.k === "measure" && viewer.mesh) {
    for (const it of mode.items) {
      if (it.k === "edge") sel.edges.push(nearestEdge(it.ref));
      else sel.faces.push(nearestFace(it.ref));
    }
  }
  if (treeSel && (["front", "top", "right"].includes(treeSel) || getFeat(treeSel)?.type === "plane")) sel.planes.push(treeSel);
  viewer.setHighlight(sel, hoverHit);
}
function nearestEdge(r: EdgeRef) {
  const m = viewer.mesh!;
  let best = -1, bd = 1e-3 + 0.5;
  m.edges.forEach((e, i) => {
    const d = dist3(e.m, r.m);
    if (d < bd) [bd, best] = [d, i];
  });
  return best;
}
function nearestFace(r: FaceRef) {
  const m = viewer.mesh!;
  let best = -1, bd = 0.5;
  m.faces.forEach((f, i) => {
    const d = dist3(f.c, r.c) + (r.r !== undefined ? (f.r === undefined ? 1 : Math.abs(f.r - r.r) * 10) : 0) + (r.n && f.n ? (1 - (f.n[0] * r.n[0] + f.n[1] * r.n[1] + f.n[2] * r.n[2])) * 5 : 0);
    if (d < bd) [bd, best] = [d, i];
  });
  return best;
}

/** Seçilen düzlem/yüzü PlaneRef'e çevirir */
function planeRefFromHit(hit: PickHit): PlaneRef | null {
  if (hit.kind === "plane") return ["front", "top", "right"].includes(hit.id) ? { k: "std", n: hit.id as StdPlane } : { k: "ref", id: hit.id };
  if (hit.kind === "face") {
    const f = viewer.mesh?.faces[hit.index];
    if (!f?.n) return null;
    return { k: "face", frame: frameFromNormal(f.c, f.n), label: "Yüz", face: { c: f.c, n: f.n } };
  }
  return null;
}
function planeRefFromSelection(): PlaneRef | null {
  if (treeSel && ["front", "top", "right"].includes(treeSel)) return { k: "std", n: treeSel as StdPlane };
  if (treeSel && getFeat(treeSel)?.type === "plane") return { k: "ref", id: treeSel };
  if (psel.planes.size === 1) {
    const id = [...psel.planes][0];
    return ["front", "top", "right"].includes(id) ? { k: "std", n: id as StdPlane } : { k: "ref", id };
  }
  if (psel.faces.size === 1) {
    const f = viewer.mesh?.faces[[...psel.faces][0]];
    if (f?.n) return { k: "face", frame: frameFromNormal(f.c, f.n), label: "Yüz", face: { c: f.c, n: f.n } };
  }
  return null;
}
function planeLabel(r: PlaneRef) {
  if (r.k === "std") return STD_NAMES[r.n];
  if (r.k === "ref") return getFeat(r.id)?.name ?? "Düzlem";
  return r.label ?? "Yüz";
}

const partInput: InputHandler = {
  hover(e) {
    const want = pickWant();
    const hit = viewer.pick(e.clientX, e.clientY, want);
    viewer.renderer.domElement.style.cursor = hit ? "pointer" : "";
    const same = JSON.stringify(hit && { k: hit.kind, i: (hit as any).index ?? (hit as any).id }) === JSON.stringify(hoverHit && { k: hoverHit.kind, i: (hoverHit as any).index ?? (hoverHit as any).id });
    if (!same) {
      hoverHit = hit;
      refreshHighlight();
    }
  },
  up(e) {
    partClick(e);
  },
  tap(e) {
    partClick(e);
  },
};
/** seçim filtresi (parmakla kenar/yüz seçmeyi kolaylaştırır) */
let selFilter: "all" | "face" | "edge" = "all";
function pickWant() {
  if (mode.k === "pickSketchPlane") return { face: true, plane: true };
  if (mode.k === "pm") {
    const t = mode.draft.type;
    if (t === "fillet" && mode.draft.type === "fillet" && mode.draft.kind === "full") return { face: true };
    if (t === "fillet" || t === "chamfer") return { edge: true, face: true };
    if (t === "trim" || t === "endcap" || t === "gusset" || t === "weld") return { face: true };
    if (t === "sketch3d") return { face: true, edge: true, plane: true };
    if (["combine", "movebody", "delbody", "indent", "fpattern", "thread", "flex"].includes(t)) return { face: true };
    if (t === "splitbody") return (mode.draft as any)._pick === "plane" ? { face: true, plane: true } : { face: true };
    if (t === "vchamfer") return { edge: true };
    if (t === "edgeflange" || t === "hem" || t === "miterflange") return (mode.draft as any)._preview ? {} : { edge: true };
    if (t === "tosheet") return { edge: true };
    if (t === "closecorner") return { face: true };
    if (t === "shell" || t === "draft" || t === "hole" || t === "dome" || t === "wrap") return { face: true };
    if (t === "axis") return { edge: true };
    if (t === "point" || t === "csys") return { edge: true, face: true };
    if (t === "extrude") return mode.draft.type === "extrude" && (mode.draft.end === "surface" || mode.draft.end === "offset") ? { face: true } : {};
    if (t === "mirror" || t === "plane") return { face: true, plane: true };
    return {};
  }
  if (mode.k === "measure") return { face: true, edge: true };
  if (selFilter === "face") return { face: true };
  if (selFilter === "edge") return { edge: true };
  return { face: true, edge: true, plane: true };
}

function partClick(e: PointerEvent) {
  const hit = viewer.pick(e.clientX, e.clientY, pickWant());
  if (mode.k === "pickSketchPlane") {
    if (!hit) return;
    const ref = planeRefFromHit(hit);
    if (!ref) return toast("Eskiz yalnızca düzlemsel bir yüze veya düzleme çizilebilir", true);
    return startSketch(ref, mode.tool);
  }
  if (mode.k === "pm") return pmPick(hit, e);
  if (mode.k === "measure") return measurePick(hit);
  // normal seçim (fare: SolidWorks gibi tık seçimi değiştirir, Ctrl/Shift ekler)
  const replace = e.pointerType === "mouse" && !(e.ctrlKey || e.shiftKey || e.metaKey);
  if (hit && replace) clearPartSel();
  if (!hit) {
    clearPartSel();
    treeSel = null;
  } else if (hit.kind === "face") toggle(psel.faces, hit.index);
  else if (hit.kind === "edge") toggle(psel.edges, hit.index);
  else {
    toggle(psel.planes, hit.id);
    treeSel = null;
  }
  renderTree();
  refreshHighlight();
  updateSelHint();
}
function toggle<T>(s: Set<T>, v: T) {
  if (s.has(v)) s.delete(v);
  else s.add(v);
}
function updateSelHint() {
  const n = psel.faces.size + psel.edges.size + psel.planes.size;
  if (mode.k !== "part") return;
  if (!n) return hint("");
  const parts = [];
  if (psel.faces.size) parts.push(`${psel.faces.size} yüz`);
  if (psel.edges.size) parts.push(`${psel.edges.size} kenar`);
  if (psel.planes.size) parts.push(`${psel.planes.size} düzlem`);
  hint(`Seçili: ${parts.join(", ")}`);
}

viewer.handler = partInput;

// =====================================================================
// Eskiz modu
// =====================================================================
function beginSketchCommand(tool?: SkTool) {
  endAux();
  if (mode.k === "sketch") {
    if (tool) mode.editor.setTool(tool);
    else exitSketch(true);
    renderCommands();
    return;
  }
  if (mode.k === "pm") return toast("Önce açık özelliği tamamlayın (✓ veya ✕)");
  const ref = planeRefFromSelection();
  if (ref) return startSketch(ref, tool);
  mode = { k: "pickSketchPlane", tool };
  hint("Eskiz için bir düzlem (Ön / Üst / Sağ) veya katının düz bir yüzünü seçin");
  updatePlanes();
  renderCommands();
}

function startSketch(plane: PlaneRef, tool?: SkTool) {
  const f: SketchFeature = { id: uid(), type: "sketch", name: nextName("sketch"), plane, data: newSketch() };
  undoStack.push(JSON.stringify(doc));
  redoStack.length = 0;
  insertFeature(f);
  openSketch(f, true, tool);
}

function openSketch(f: SketchFeature, isNew: boolean, tool?: SkTool) {
  const frame = resolveFrame(f.plane, doc.features);
  if (!frame) return toast("Eskiz düzlemi bulunamadı", true);
  clearPartSel();
  treeSel = null;
  hoverHit = null;
  const orig = JSON.stringify(f.data);
  const editor = new SketchEditor(
    {
      viewer,
      panel: $("#pm-body"),
      toast,
      status: (text, kind) => setStatus(kind === "ok" ? "ok" : kind, `${f.name}: ${text}`),
      changed: () => {
        saveDocSoon();
        updateUndo();
      },
      section: (fr) => kernel.section(fr),
    },
    frame,
    f.data,
  );
  mode = { k: "sketch", featId: f.id, isNew, orig, editor };
  viewer.handler = editor;
  viewer.setTouchRotate(false);
  viewer.viewNormal(frame);
  hint("");
  showPM(`${f.name}`, () => exitSketch(true), () => exitSketch(false));
  setTab("sketch");
  editor.setTool(tool ?? "line");
  updatePlanes();
  renderCommands();
  rebuild();
  // mevcut eskizi açarken eskizi ve modeli ekrana sığdır
  if (!isNew && f.data.ents.length) setTimeout(fitAll, 50);
}

let saveTimer = 0;
function saveDocSoon() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveDoc, 400);
}

function exitSketch(keep: boolean) {
  if (mode.k !== "sketch") return;
  const { featId, isNew, orig, editor } = mode;
  editor.dispose();
  const f = getFeat(featId) as SketchFeature;
  const removeNew = () => {
    const i = featIndex(featId);
    doc.features.splice(i, 1);
    if (doc.rollback != null && i < doc.rollback) doc.rollback--;
  };
  if (!keep) {
    if (isNew) removeNew();
    else f.data = JSON.parse(orig);
    undoStack.pop();
  } else if (isNew && !f.data.ents.length) {
    removeNew();
    undoStack.pop();
  } else if (!isNew) {
    undoStack.push(JSON.stringify({ ...doc, features: doc.features.map((x) => (x.id === featId ? { ...x, data: JSON.parse(orig) } : x)) }));
  }
  mode = { k: "part" };
  viewer.handler = partInput;
  viewer.setTouchRotate(true);
  hidePM();
  if (keep && f && doc.features.includes(f)) treeSel = f.id;
  saveDoc();
  setTab("features");
  afterDocChange();
  viewer.hideTouchpad();
  if (keep && f && isNew && doc.features.includes(f)) {
    // sonraki adım önerisi (parmakla kolay erişim)
    if (f.data.ents.length && !consumerOf(f.id)) suggest([["Ekstrüzyon", () => newFeature("extrude")], ["Ekst. Kesme", () => newFeature("cutExtrude")], ["Döndürme", () => newFeature("revolve")]]);
  }
}
/** ekranın altında kısa süreli öneri düğmeleri */
function suggest(items: [string, () => void][]) {
  document.querySelector(".suggest")?.remove();
  const bar = h("div", "suggest");
  for (const [l, fn] of items) {
    const b = h("button", "btn", l);
    b.addEventListener("click", () => (bar.remove(), fn()));
    bar.appendChild(b);
  }
  document.body.appendChild(bar);
  setTimeout(() => bar.remove(), 9000);
}

// =====================================================================
// Özellik paneli (PropertyManager)
// =====================================================================
let pmOk: () => void = () => {};
let pmCancel: () => void = () => {};
function showPM(title: string, ok: () => void, cancel: () => void) {
  $("#pm-title").textContent = title;
  $("#pm").hidden = false;
  $("#side").classList.add("pm-open");
  document.body.classList.add("sheet");
  pmOk = ok;
  pmCancel = cancel;
}
function hidePM() {
  $("#pm").hidden = true;
  $("#pm-body").innerHTML = "";
  $("#side").classList.remove("pm-open");
  document.body.classList.toggle("sheet", $("#side").classList.contains("open"));
  hint("");
}
$("#pm-ok").addEventListener("click", () => pmOk());
$("#pm-cancel").addEventListener("click", () => pmCancel());

function lastFreeSketch(before = insertAt()): SketchFeature | undefined {
  if (treeSel && getFeat(treeSel)?.type === "sketch") return getFeat(treeSel) as SketchFeature;
  for (let i = before - 1; i >= 0; i--) {
    const f = doc.features[i];
    if (f.type === "sketch" && !consumerOf(f.id)) return f;
  }
  return undefined;
}

function newFeature(kind: string) {
  endAux();
  if (mode.k === "sketch") {
    const fid = mode.featId;
    exitSketch(true);
    if (getFeat(fid)) treeSel = fid;
  }
  if (mode.k === "pm") return toast("Önce açık özelliği tamamlayın (✓ veya ✕)");
  if (mode.k === "pickSketchPlane") cancelPick();
  const id = uid();
  let draft: Feature;
  const sk = lastFreeSketch();
  switch (kind) {
    case "extrude":
    case "cutExtrude": {
      if (!sk) return toast("Önce kapalı bir eskiz çizin", true);
      const cut = kind === "cutExtrude";
      draft = { id, type: "extrude", name: "", sketch: sk.id, cut, end: cut ? "through" : "blind", d1: 20, rev: false, dir2: false, end2: "blind", d2: 10 };
      break;
    }
    case "revolve":
    case "cutRevolve": {
      if (!sk) return toast("Önce bir eskiz ve merkez çizgisi çizin", true);
      const axes = sk.data.ents.filter((e) => e.t === "line");
      const axis = (axes.find((e) => e.cons) ?? axes[0])?.id ?? "";
      draft = { id, type: "revolve", name: "", sketch: sk.id, cut: kind === "cutRevolve", axis, angle: 360, mid: false, rev: false };
      break;
    }
    case "fillet":
      draft = { id, type: "fillet", name: "", r: 3, edges: selectedEdgeRefs() };
      break;
    case "chamfer":
      draft = { id, type: "chamfer", name: "", d: 2, edges: selectedEdgeRefs() };
      break;
    case "shell":
      draft = { id, type: "shell", name: "", t: 2, faces: [...psel.faces].map((i) => faceRef(i)) };
      break;
    case "lpattern":
      draft = { id, type: "lpattern", name: "", feats: patternable().slice(-1).map((f) => f.id), axis: "x", rev: false, count: 3, spacing: 30, dir2: false, axis2: "z", rev2: false, count2: 2, spacing2: 30 };
      break;
    case "cpattern":
      draft = { id, type: "cpattern", name: "", feats: patternable().slice(-1).map((f) => f.id), axis: "y", count: 6, angle: 360, equal: true };
      break;
    case "mirror":
      draft = { id, type: "mirror", name: "", feats: [], body: true, plane: planeRefFromSelection() ?? { k: "std", n: "right" } };
      break;
    case "plane":
      draft = { id, type: "plane", name: "", base: planeRefFromSelection() ?? { k: "std", n: "front" }, offset: 20, flip: false };
      break;
    case "sweep": {
      const free = doc.features.filter((f) => f.type === "sketch" && !consumerOf(f.id)) as SketchFeature[];
      if (free.length < 2) return toast("Süpürme için iki eskiz gerekir: kapalı profil ve yol", true);
      const pathSk = free.find((f) => !extractClosed(f)) ?? free[free.length - 1];
      const prof = free.find((f) => f !== pathSk && extractClosed(f)) ?? free.find((f) => f !== pathSk)!;
      draft = { id, type: "sweep", name: "", sketch: prof.id, path: pathSk.id, cut: false };
      break;
    }
    case "loft": {
      const free = doc.features.filter((f) => f.type === "sketch" && !consumerOf(f.id) && extractClosed(f)) as SketchFeature[];
      if (free.length < 2) return toast("Loft için en az iki kapalı profil eskizi gerekir", true);
      draft = { id, type: "loft", name: "", sketches: free.slice(-2).map((f) => f.id), cut: false, ruled: false };
      break;
    }
    case "hole": {
      const pl = planeRefFromSelection();
      draft = { id, type: "hole", name: "", htype: "simple", size: "M8", std: "iso", ...holeDefaults("simple", "M8"), through: true, plane: pl && pl.k === "face" ? pl : null, pts: [] } as HoleFeature;
      break;
    }
    case "draft":
      draft = { id, type: "draft", name: "", angle: 3, plane: planeRefFromSelection() ?? { k: "std", n: "top" }, faces: [...psel.faces].map((i) => faceRef(i)), rev: false };
      break;
    case "rib": {
      if (!sk) return toast("Kaburga için açık bir çizgi eskizi çizin", true);
      draft = { id, type: "rib", name: "", sketch: sk.id, t: 5, side: "mid", dir: "parallel", flip: false };
      break;
    }
    case "dome": {
      const fi = [...psel.faces][0];
      draft = { id, type: "dome", name: "", face: fi !== undefined && viewer.mesh?.faces[fi].n ? faceRef(fi) : null, h: 10 };
      break;
    }
    case "wrap": {
      if (!sk) return toast("Sarma için önce kapalı bir eskiz (veya metin) çizin", true);
      draft = { id, type: "wrap", name: "", sketch: sk.id, face: null, mode: "emboss", depth: 1 };
      break;
    }
    case "scale":
      draft = { id, type: "scale", name: "", factor: 1.5, center: "origin" };
      break;
    case "sketch3d":
      draft = { id, type: "sketch3d", name: "", ids: [], xyz: [], lines: [], r: 0, seq: 1 };
      Object.assign(draft, { _link: true, _len: 100, _d: [0, 0, 0] });
      break;
    case "member": {
      const isSk = (f?: Feature) => f?.type === "sketch" || f?.type === "sketch3d";
      const skel = isSk(treeSel ? getFeat(treeSel) : undefined) ? getFeat(treeSel!) : [...doc.features.slice(0, insertAt())].reverse().find((f) => isSk(f));
      if (!skel) return toast("Önce iskelet eskizini çizin (elemanların eksen çizgileri)", true);
      const segs =
        skel.type === "sketch3d"
          ? skel.lines.filter((l) => !l.cons).map((l) => ({ sk: skel.id, ent: l.id }))
          : (skel as SketchFeature).data.ents.filter((e) => !e.cons && (e.t === "line" || e.t === "arc")).map((e) => ({ sk: skel.id, ent: e.id }));
      const prev = [...doc.features].reverse().find((f) => f.type === "member") as any;
      draft = { id, type: "member", name: "", segs, std: prev?.std ?? "kutu", size: prev?.size ?? "40x40x3", align: "c", mirror: false, rot: 0, corner: "miter", gap: 0 };
      break;
    }
    case "combine":
      draft = { id, type: "combine", name: "", op: "add", main: null, tools: [] };
      (draft as any)._pick = "main";
      break;
    case "splitbody":
      draft = { id, type: "splitbody", name: "", body: null, plane: planeRefFromSelection() ?? { k: "std", n: "right" } };
      (draft as any)._pick = "body";
      break;
    case "movebody":
      draft = { id, type: "movebody", name: "", body: null, copy: false, d: [50, 0, 0], axis: "y", angle: 0 };
      break;
    case "delbody":
      draft = { id, type: "delbody", name: "", bodies: [], keep: false };
      break;
    case "indent":
      draft = { id, type: "indent", name: "", target: null, tool: null, clearance: 1, keepTool: true };
      (draft as any)._pick = "target";
      break;
    case "spattern":
    case "cvpattern": {
      const skl = [...doc.features.slice(0, insertAt())].reverse().find((f) => f.type === "sketch") as SketchFeature | undefined;
      if (!skl) return toast(kind === "spattern" ? "Önce kopya konumlarını nokta olarak bir eskize çizin" : "Önce kopyaların izleyeceği eğriyi bir eskize çizin", true);
      const fs = patternable().slice(-1).map((f) => f.id);
      draft = kind === "spattern" ? { id, type: "spattern", name: "", feats: fs, sketch: skl.id } : { id, type: "cvpattern", name: "", feats: fs, sketch: skl.id, count: 4, spacing: 30, equal: true, align: false };
      break;
    }
    case "tpattern":
      draft = { id, type: "tpattern", name: "", feats: patternable().slice(-1).map((f) => f.id), rows: [[30, 0, 0], [60, 0, 0]] };
      break;
    case "fpattern": {
      const fi = [...psel.faces][0];
      draft = { id, type: "fpattern", name: "", feats: patternable().slice(-1).map((f) => f.id), face: fi !== undefined && viewer.mesh?.faces[fi].n ? faceRef(fi) : null, spacing: 25, layout: "stagger", margin: 5, angle: 0 };
      break;
    }
    case "thread": {
      const fi = [...psel.faces][0];
      const f0 = fi !== undefined ? viewer.mesh?.faces[fi] : undefined;
      draft = { id, type: "thread", name: "", face: f0?.type === "CYLINDRE" ? faceRef(fi!) : null, pitch: 1.5, length: 0, left: false, fromEnd: false };
      if (f0?.r) (draft as any).pitch = threadPitchFor(f0.r);
      break;
    }
    case "flex":
      draft = { id, type: "flex", name: "", body: null, mode: "bend", axis: "x", value: 90, dir: "y" };
      break;
    case "vchamfer":
      draft = { id, type: "vchamfer", name: "", v: null, d: 5 };
      break;
    case "weld":
      draft = { id, type: "weld", name: "", pairs: [], a: 3, intermittent: false, len: 50, pitch: 100 };
      break;
    case "trim":
      if (!doc.features.some((f) => f.type === "member")) return toast("Önce yapı elemanı oluşturun", true);
      draft = { id, type: "trim", name: "", targets: [], bounds: [] };
      (draft as any)._pick = "targets";
      break;
    case "endcap": {
      const m = viewer.mesh;
      draft = { id, type: "endcap", name: "", faces: [...psel.faces].filter((i) => m?.faces[i].n).map((i) => faceRef(i)), t: 5, inset: 0 };
      break;
    }
    case "gusset": {
      const m = viewer.mesh;
      const fs = [...psel.faces].filter((i) => m?.faces[i].n).map((i) => faceRef(i));
      draft = { id, type: "gusset", name: "", f1: fs[0] ?? null, f2: fs[1] ?? null, d1: 100, d2: 100, t: 6, chamfer: 10, offset: 0 };
      break;
    }
    case "sheetbase": {
      if (!sk) return toast("Önce taban flanş için bir eskiz çizin (kapalı: levha, açık: bükümlü profil)", true);
      const prev = lastSheetBase(doc.features.slice(0, insertAt()));
      draft = { id, type: "sheetbase", name: "", sketch: sk.id, t: prev?.t ?? 2, r: prev?.r ?? 2, k: prev?.k ?? 0.5, rev: false, d: 50, mid: false, relief: prev?.relief ?? 0.5 };
      break;
    }
    case "edgeflange":
    case "hem": {
      const sp = sheetParamsBefore(doc.features.slice(0, insertAt()), null);
      if (!sp) return toast("Önce bir taban flanş oluşturun", true);
      const m = viewer.mesh;
      const edges = [...psel.edges].filter((i) => m?.edges[i].type === "LINE").map((i) => ({ m: m!.edges[i].m, d: m!.edges[i].d }));
      draft =
        kind === "hem"
          ? { id, type: "hem", name: "", edges, kind: "closed", L: 10, gap: 1, pos: "inside", flip: false }
          : { id, type: "edgeflange", name: "", edges, L: 25, angle: 90, pos: "inside", lenRef: "outer", flip: false, useDef: true, r: sp.r, o1: 0, o2: 0, gap: 0.2 };
      break;
    }
    case "sheetjog":
    case "miterflange": {
      const sp = sheetParamsBefore(doc.features.slice(0, insertAt()), null);
      if (!sp) return toast("Önce bir taban flanş oluşturun", true);
      if (!sk) return toast(kind === "sheetjog" ? "Sacın düz yüzüne tek bir kademe çizgisi çizin" : "Önce flanş profilini (açık zincir) ilk kenarın ucunda, kenara dik bir düzlemde çizin", true);
      if (kind === "sheetjog") draft = { id, type: "sheetjog", name: "", sketch: sk.id, H: 20, side: false, flip: false, useDef: true, r: sp.r };
      else {
        const m = viewer.mesh;
        const edges = [...psel.edges].filter((i) => m?.edges[i].type === "LINE").map((i) => ({ m: m!.edges[i].m, d: m!.edges[i].d }));
        draft = { id, type: "miterflange", name: "", sketch: sk.id, edges, rev: false, gap: 0.5 };
      }
      break;
    }
    case "closecorner": {
      if (!sheetParamsBefore(doc.features.slice(0, insertAt()), null)) return toast("Önce bir taban flanş oluşturun", true);
      draft = { id, type: "closecorner", name: "", faces: [], overlap: false, gap: 0.2 };
      break;
    }
    case "tosheet":
      draft = { id, type: "tosheet", name: "", bends: [], rips: [], t: 2, r: 2, k: 0.5, relief: 0.5, gap: 0.5 };
      (draft as any)._pick = "bends";
      break;
    case "sketchbend": {
      const sp = sheetParamsBefore(doc.features.slice(0, insertAt()), null);
      if (!sp) return toast("Önce bir taban flanş oluşturun", true);
      if (!sk) return toast("Sacın düz yüzüne tek bir büküm çizgisi çizin", true);
      draft = { id, type: "sketchbend", name: "", sketch: sk.id, angle: 90, side: false, flip: false, pos: "center", useDef: true, r: sp.r };
      break;
    }
    case "axis":
      draft = { id, type: "axis", name: "", p: [0, 0, 0], d: [0, 1, 0] };
      break;
    case "point":
      draft = { id, type: "point", name: "", p: [0, 0, 0] };
      break;
    case "csys":
      draft = { id, type: "csys", name: "", o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0] };
      break;
    default:
      return;
  }
  draft.name = nextNamePeek(kind);
  openFeaturePM(draft, undefined, kind);
}
function extractClosed(f: Feature) {
  if (f.type !== "sketch") return false;
  const ends = new Map<string, number>();
  for (const e of f.data.ents) {
    if (e.cons) continue;
    if (e.t === "circle") return true;
    const ids = e.t === "line" ? [e.p1, e.p2] : e.t === "arc" ? [e.s, e.e] : [];
    ids.forEach((p) => ends.set(p, (ends.get(p) ?? 0) + 1));
  }
  return ends.size > 0 && [...ends.values()].every((n) => n === 2);
}
function nextNamePeek(kind: string) {
  return `${FEAT_NAMES[kind] ?? kind}${(doc.seq[kind] ?? 0) + 1}`;
}
function selectedEdgeRefs(): EdgeRef[] {
  const m = viewer.mesh;
  if (!m) return [];
  return [...psel.edges].map((i) => ({ m: m.edges[i].m, d: m.edges[i].d }));
}
function faceRef(i: number): FaceRef {
  const f = viewer.mesh!.faces[i];
  return f.r !== undefined && !f.n ? { c: f.c, n: f.n, r: f.r } : { c: f.c, n: f.n };
}
function patternable(before = insertAt()) {
  return doc.features.slice(0, before).filter((f) => ["extrude", "revolve", "sweep", "loft", "hole", "rib"].includes(f.type) && !f.off);
}

function openFeaturePM(draft: Feature, editingId: string | undefined, kind: string) {
  mode = { k: "pm", draft, editingId };
  clearPartSel();
  hoverHit = null;
  showPM(
    draft.name,
    () => commitFeature(kind),
    () => cancelFeature(),
  );
  renderFeaturePM(kind);
  renderCommands();
  rebuild();
}

function cancelFeature() {
  mode = { k: "part" };
  hidePM();
  renderCommands();
  rebuild();
}

function commitFeature(kind: string) {
  if (mode.k !== "pm") return;
  const { draft, editingId } = mode;
  if ((draft.type === "fillet" || draft.type === "chamfer") && !draft.edges.length) return toast("En az bir kenar seçin", true);
  if (draft.type === "shell" && !draft.faces.length) return toast("Kaldırılacak en az bir yüz seçin", true);
  if ((draft.type === "lpattern" || draft.type === "cpattern") && !draft.feats.length) return toast("Çoğaltılacak özelliği seçin", true);
  if (draft.type === "mirror" && !draft.body && !draft.feats.length) return toast("Aynalanacak özelliği seçin veya 'Tüm gövde'yi işaretleyin", true);
  if (draft.type === "revolve" && !draft.axis) return toast("Döndürme ekseni için eskize bir merkez çizgisi çizin", true);
  if (draft.type === "hole" && (!draft.plane || !draft.pts.length)) return toast("Deliğin konumunu seçin: yüze dokunun", true);
  if (draft.type === "draft" && !draft.faces.length) return toast("Koniklik verilecek yüzleri seçin", true);
  if ((draft.type === "dome" || draft.type === "wrap") && !draft.face) return toast("Yüzü seçin", true);
  if (draft.type === "sketch3d" && !draft.lines.length) return toast("3B eskizde en az bir çizgi olmalı", true);
  if (draft.type === "sketch3d") ["_link", "_len", "_d", "_act", "_abs"].forEach((k) => delete (draft as any)[k]);
  if (draft.type === "weld" && !draft.pairs.length) return toast("Kaynak için en az bir yüz çifti seçin", true);
  delete (draft as any)._p1;
  if (draft.type === "member" && !draft.segs.length) return toast("En az bir segment seçin", true);
  if (draft.type === "trim" && (!draft.targets.length || (!draft.bounds.length && !draft.faces?.length))) return toast("Kırpılacak elemanları ve sınırı (eleman veya düz yüz) seçin", true);
  if (draft.type === "endcap" && !draft.faces.length) return toast("Elemanın uç yüzünü seçin", true);
  if (draft.type === "gusset" && (!draft.f1 || !draft.f2)) return toast("İç köşeyi oluşturan iki yüzü seçin", true);
  delete (draft as any)._pick;
  if (draft.type === "miterflange" && !draft.edges.length) return toast("Flanş kenarlarını seçin", true);
  if (draft.type === "tosheet" && !draft.bends.length) return toast("Büküm kenarlarını seçin", true);
  if (draft.type === "closecorner" && !draft.faces.length) return toast("Uç yüz seçin", true);
  if ((draft.type === "edgeflange" || draft.type === "hem") && !draft.edges.length) return toast("Flanş eklenecek kenarı seçin", true);
  delete (draft as any)._origin;
  if ((draft.type === "edgeflange" || draft.type === "hem" || draft.type === "miterflange") && (draft as any)._preview) {
    delete (draft as any)._preview;
    if (draftError) return toast(draftError, true);
  } else delete (draft as any)._preview;
  if (draft.type === "extrude" && (draft.end === "surface" || draft.end === "offset") && !draft.face) return toast("Hedef yüzü seçin", true);
  if (draftError && !["fillet", "chamfer", "shell", "draft", "edgeflange", "hem", "miterflange", "combine", "delbody", "indent", "thread", "tosheet"].includes(draft.type)) return toast(draftError, true);
  mode = { k: "part" };
  hidePM();
  commitDoc(() => {
    if (editingId) doc.features = doc.features.map((f) => (f.id === editingId ? draft : f));
    else {
      nextName(kind);
      insertFeature(draft);
    }
  });
  treeSel = draft.id;
  renderCommands();
}

function kindOf(f: Feature) {
  if (f.type === "extrude") return f.cut ? "cutExtrude" : "extrude";
  if (f.type === "revolve") return f.cut ? "cutRevolve" : "revolve";
  if (f.type === "sweep") return f.cut ? "cutSweep" : "sweep";
  if (f.type === "loft") return f.cut ? "cutLoft" : "loft";
  return f.type;
}

function editFeature(id: string) {
  endAux();
  const f = getFeat(id);
  if (!f) return;
  if (f.type === "sketch") return openSketch(f, false);
  openFeaturePM(JSON.parse(JSON.stringify(f)), id, kindOf(f));
}

function renderFeaturePM(kind: string) {
  if (mode.k !== "pm") return;
  const d = mode.draft as any;
  const body = $("#pm-body");
  body.innerHTML = "";
  const upd = () => schedulePreview();
  const idx = mode.editingId ? featIndex(mode.editingId) : doc.features.length;
  const sketches = doc.features.slice(0, idx).filter((f) => f.type === "sketch") as SketchFeature[];
  const sketchSel = () =>
    selectField("Eskiz", sketches.map((s) => ({ v: s.id, t: s.name })), d.sketch, (v) => {
      d.sketch = v;
      if (d.type === "revolve") {
        const sk = getFeat(v) as SketchFeature;
        const ax = sk.data.ents.filter((e) => e.t === "line");
        d.axis = (ax.find((e) => e.cons) ?? ax[0])?.id ?? "";
        renderFeaturePM(kind);
      }
      upd();
    });
  const planeOpts = () => {
    const opts: { v: string; t: string }[] = (["front", "top", "right"] as StdPlane[]).map((n) => ({ v: "std:" + n, t: STD_NAMES[n] }));
    doc.features.slice(0, idx).forEach((f) => f.type === "plane" && opts.push({ v: "ref:" + f.id, t: f.name }));
    return opts;
  };
  const planeField = (label: string, get: () => PlaneRef, set: (r: PlaneRef) => void) => {
    const cur = get();
    const opts = planeOpts();
    let val = cur.k === "std" ? "std:" + cur.n : cur.k === "ref" ? "ref:" + cur.id : "face";
    if (cur.k === "face") opts.push({ v: "face", t: cur.label ?? "Seçili yüz" });
    const f = selectField(label, opts, val, (v) => {
      if (v.startsWith("std:")) set({ k: "std", n: v.slice(4) as StdPlane });
      else if (v.startsWith("ref:")) set({ k: "ref", id: v.slice(4) });
      refreshHighlight();
      upd();
    });
    const wrap = h("div");
    wrap.append(f, h("p", "pm-hint", "Görünümden bir düzleme veya düz yüze dokunarak da seçebilirsiniz."));
    return wrap;
  };
  const featChecks = (title: string) => {
    const list = patternable(idx);
    const box = h("div", "pm-feats");
    if (!list.length) box.appendChild(h("p", "pm-hint", "Çoğaltılabilecek özellik yok (Ekstrüzyon / Döndürme)."));
    for (const f of list) {
      box.appendChild(
        checkField(f.name, d.feats.includes(f.id), (on) => {
          d.feats = on ? [...d.feats, f.id] : d.feats.filter((x: string) => x !== f.id);
          upd();
        }),
      );
    }
    return group(title, box);
  };
  const axisOpts = [
    { v: "x", t: "X ekseni" },
    { v: "y", t: "Y ekseni" },
    { v: "z", t: "Z ekseni" },
  ] as { v: "x" | "y" | "z"; t: string }[];

  switch (d.type) {
    case "extrude": {
      const e = d as ExtrudeFeature;
      body.appendChild(group("Kaynak", sketchSel()));
      const endOpts = [
        { v: "blind", t: "Kör" },
        { v: "through", t: "Tümünden geçen" },
        { v: "surface", t: "Yüzeye kadar" },
        { v: "offset", t: "Yüzeyden ötele" },
        { v: "next", t: "Sonrakine kadar" },
        { v: "mid", t: "Orta düzlem" },
      ] as const;
      const g1 = group(
        "Yön 1",
        selectField("Uç koşulu", [...endOpts], e.end, (v) => {
          e.end = v;
          renderFeaturePM(kind);
          upd();
        }),
      );
      if (e.end === "blind" || e.end === "mid") g1.appendChild(numField("Derinlik", e.d1, (v) => ((e.d1 = v), upd()), { min: 0.001, unit: "mm", key: `${e.id}.d1` }));
      if (e.end === "surface" || e.end === "offset") {
        g1.appendChild(h("div", "pm-picks", e.face ? "Hedef yüz seçili" : "Hedef yüze dokunun (eskize paralel düz yüz)"));
        if (e.end === "offset") g1.appendChild(numField("Öteleme mesafesi", e.offd ?? 0, (v) => ((e.offd = v), upd()), { unit: "mm" }));
      }
      g1.appendChild(checkField("Yönü ters çevir", e.rev, (v) => ((e.rev = v), upd())));
      g1.appendChild(numField("Başlangıç ötelemesi", e.startOff ?? 0, (v) => ((e.startOff = v || undefined), upd()), { unit: "mm" }));
      if (e.end === "blind" || e.end === "mid") {
        g1.appendChild(numField("Büküm açısı", e.twist ?? 0, (v) => ((e.twist = v), upd()), { unit: "°", key: `${e.id}.twist` }));
      }
      if (e.end !== "through" && e.end !== "mid" && e.end !== "next" && !e.twist) {
        g1.appendChild(checkField("Koniklik", !!e.draft, (v) => ((e.draft = v ? 3 : 0), renderFeaturePM(kind), upd())));
        if (e.draft) {
          g1.appendChild(numField("Koniklik açısı", e.draft, (v) => ((e.draft = v), upd()), { min: 0.01, unit: "°", key: `${e.id}.draft` }));
          g1.appendChild(checkField("Dışa doğru", !!e.draftOut, (v) => ((e.draftOut = v), upd())));
        }
      }
      body.appendChild(g1);
      if (e.end === "blind" || e.end === "through") {
        const g2 = group("Yön 2", checkField("İkinci yönü kullan", e.dir2, (v) => ((e.dir2 = v), renderFeaturePM(kind), upd())));
        if (e.dir2) {
          g2.appendChild(
            selectField("Uç koşulu", [{ v: "blind", t: "Kör" }, { v: "through", t: "Tümünden geçen" }], e.end2, (v) => ((e.end2 = v as any), renderFeaturePM(kind), upd())),
          );
          if (e.end2 === "blind") g2.appendChild(numField("Derinlik", e.d2, (v) => ((e.d2 = v), upd()), { min: 0.001, unit: "mm", key: `${e.id}.d2` }));
        }
        body.appendChild(g2);
      }
      body.appendChild(thinGroup(e, kind));
      body.appendChild(
        segField([{ v: "boss", t: "Malzeme ekle" }, { v: "cut", t: "Kes" }], e.cut ? "cut" : "boss", (v) => {
          e.cut = v === "cut";
          renderFeaturePM(kind);
          upd();
        }),
      );
      if (!e.cut) body.appendChild(checkField("Sonucu birleştir (kapalıysa ayrı gövde)", e.merge !== false, (v) => ((e.merge = v), upd())));
      break;
    }
    case "revolve": {
      const r = d as RevolveFeature;
      body.appendChild(group("Kaynak", sketchSel()));
      const sk = getFeat(r.sketch) as SketchFeature | undefined;
      const lines = (sk?.data.ents.filter((e) => e.t === "line") ?? []) as any[];
      const axOpts = lines.map((l, i) => {
        const a = pointPos(sk!.data, l.p1), b = pointPos(sk!.data, l.p2);
        return { v: l.id, t: `${l.cons ? "Merkez çizgisi" : "Çizgi"} ${i + 1} (${fmtNum(a[0], 1)},${fmtNum(a[1], 1)} → ${fmtNum(b[0], 1)},${fmtNum(b[1], 1)})` };
      });
      body.appendChild(
        group(
          "Döndürme ekseni",
          axOpts.length ? selectField("Eksen", axOpts, r.axis, (v) => ((r.axis = v), upd())) : h("p", "pm-hint", "Eskizde çizgi yok. Eskize bir merkez çizgisi ekleyin."),
        ),
      );
      const g = group("Açı", numField("Açı", r.angle, (v) => ((r.angle = v), upd()), { min: 0.01, unit: "°", key: `${r.id}.angle` }));
      g.appendChild(checkField("Orta düzlem", r.mid, (v) => ((r.mid = v), upd())));
      g.appendChild(checkField("Yönü ters çevir", r.rev, (v) => ((r.rev = v), upd())));
      body.appendChild(g);
      body.appendChild(thinGroup(r, kind));
      body.appendChild(segField([{ v: "boss", t: "Malzeme ekle" }, { v: "cut", t: "Kes" }], r.cut ? "cut" : "boss", (v) => ((r.cut = v === "cut"), renderFeaturePM(kind), upd())));
      if (!r.cut) body.appendChild(checkField("Sonucu birleştir (kapalıysa ayrı gövde)", r.merge !== false, (v) => ((r.merge = v), upd())));
      break;
    }
    case "fillet":
    case "chamfer": {
      const isF = d.type === "fillet";
      if (isF)
        body.appendChild(
          selectField(
            "Radyüs türü",
            [
              { v: "const", t: "Sabit boyutlu" },
              { v: "var", t: "Değişken boyutlu (başlangıç → bitiş)" },
              { v: "full", t: "Tam yuvarlak (orta yüz)" },
            ],
            d.kind ?? "const",
            (v) => ((d.kind = v), renderFeaturePM(kind), refreshHighlight()),
          ),
        );
      else
        body.appendChild(
          selectField(
            "Pah türü",
            [
              { v: "equal", t: "Eşit mesafe" },
              { v: "dd", t: "Mesafe – mesafe" },
              { v: "da", t: "Mesafe – açı" },
            ],
            d.kind ?? "equal",
            (v) => ((d.kind = v), renderFeaturePM(kind)),
          ),
        );
      if (isF && d.kind === "full") {
        body.appendChild(group("Tam yuvarlak", h("div", "pm-picks", d.faces?.length ? "Orta yüz seçili" : "Yuvarlatılacak şeridin orta (üst) yüzüne dokunun"), h("p", "pm-hint", "Yüzün iki paralel kenarı, yüz genişliğinin yarısı kadar yuvarlatılır.")));
        hint("Tam yuvarlak için orta yüze dokunun");
        break;
      }
      body.appendChild(
        group(
          isF ? "Radyüs parametreleri" : "Pah parametreleri",
          numField(isF ? (d.kind === "var" ? "Başlangıç yarıçapı" : "Yarıçap") : "Mesafe", isF ? d.r : d.d, (v) => (isF ? (d.r = v) : (d.d = v)), { min: 0.001, unit: "mm", key: `${d.id}.${isF ? "r" : "d"}` }),
        ),
      );
      if (isF && d.kind === "var") body.appendChild(numField("Bitiş yarıçapı", d.r2 ?? d.r, (v) => (d.r2 = v), { min: 0.001, unit: "mm", key: `${d.id}.r2` }));
      if (!isF && d.kind === "dd") body.appendChild(numField("İkinci mesafe", d.d2 ?? d.d, (v) => (d.d2 = v), { min: 0.001, unit: "mm", key: `${d.id}.d2` }));
      if (!isF && d.kind === "da") body.appendChild(numField("Açı", d.angle ?? 45, (v) => (d.angle = v), { min: 0.1, unit: "°", key: `${d.id}.angle` }));
      if (!isF && d.kind && d.kind !== "equal") body.appendChild(checkField("Yönü ters çevir", !!d.flip, (v) => (d.flip = v)));
      const nf = (d.faces ?? []).length;
      const picks = h("div", "pm-picks", d.edges.length || nf ? `${d.edges.length} kenar, ${nf} yüz seçili` : "Kenarlara veya yüzlere dokunun");
      const g = group("Kenarlar ve yüzler", picks, h("p", "pm-hint", "Bir yüz seçmek o yüzün tüm kenarlarını seçer."));
      if (d.edges.length || nf) g.appendChild(button("Seçimi temizle", () => ((d.edges = []), (d.faces = []), renderFeaturePM(kind), refreshHighlight())));
      body.appendChild(g);
      hint(isF ? "Yuvarlatılacak kenarlara veya yüzlere dokunun" : "Pah kırılacak kenarlara veya yüzlere dokunun");
      break;
    }
    case "shell": {
      body.appendChild(group("Parametreler", numField("Kalınlık", d.t, (v) => (d.t = v), { min: 0.001, unit: "mm", key: `${d.id}.t` })));
      const picks = h("div", "pm-picks", d.faces.length ? `${d.faces.length} yüz seçili` : "Kaldırılacak yüzlere dokunun");
      const g = group("Kaldırılacak yüzler", picks);
      if (d.faces.length) g.appendChild(button("Seçimi temizle", () => ((d.faces = []), renderFeaturePM(kind), refreshHighlight())));
      body.appendChild(g);
      hint("Açık kalacak (kaldırılacak) yüzlere dokunun");
      break;
    }
    case "lpattern": {
      const g1 = group(
        "Yön 1",
        selectField("Yön", axisOpts, d.axis, (v) => ((d.axis = v), upd())),
        checkField("Ters çevir", d.rev, (v) => ((d.rev = v), upd())),
        numField("Aralık", d.spacing, (v) => ((d.spacing = v), upd()), { min: 0.001, unit: "mm", key: `${d.id}.spacing` }),
        numField("Adet", d.count, (v) => ((d.count = v), upd()), { min: 1, int: true, key: `${d.id}.count` }),
      );
      body.appendChild(g1);
      const g2 = group("Yön 2", checkField("İkinci yönü kullan", d.dir2, (v) => ((d.dir2 = v), renderFeaturePM(kind), upd())));
      if (d.dir2)
        g2.append(
          selectField("Yön", axisOpts, d.axis2, (v) => ((d.axis2 = v), upd())),
          checkField("Ters çevir", d.rev2, (v) => ((d.rev2 = v), upd())),
          numField("Aralık", d.spacing2, (v) => ((d.spacing2 = v), upd()), { min: 0.001, unit: "mm" }),
          numField("Adet", d.count2, (v) => ((d.count2 = v), upd()), { min: 1, int: true }),
        );
      body.appendChild(g2);
      body.appendChild(featChecks("Çoğaltılacak özellikler"));
      break;
    }
    case "cpattern": {
      body.appendChild(
        group(
          "Parametreler",
          selectField("Eksen (orijinden geçen)", axisOpts, d.axis, (v) => ((d.axis = v), upd())),
          numField(d.equal ? "Toplam açı" : "Aralık açısı", d.angle, (v) => ((d.angle = v), upd()), { min: 0.01, unit: "°", key: `${d.id}.angle` }),
          numField("Adet", d.count, (v) => ((d.count = v), upd()), { min: 2, int: true, key: `${d.id}.count` }),
          checkField("Eşit aralık", d.equal, (v) => ((d.equal = v), renderFeaturePM(kind), upd())),
        ),
      );
      body.appendChild(featChecks("Çoğaltılacak özellikler"));
      break;
    }
    case "mirror": {
      body.appendChild(group("Ayna düzlemi", planeField("Düzlem", () => d.plane, (r) => (d.plane = r))));
      const g = group("Aynalanacak", checkField("Tüm gövde", d.body, (v) => ((d.body = v), renderFeaturePM(kind), upd())));
      body.appendChild(g);
      if (!d.body) body.appendChild(featChecks("Özellikler"));
      break;
    }
    case "sweep": {
      const opts = sketches.map((s) => ({ v: s.id, t: s.name }));
      body.appendChild(
        group(
          "Profil ve yol",
          selectField("Profil (kapalı eskiz)", opts, d.sketch, (v) => ((d.sketch = v), upd())),
          selectField("Yol (açık veya kapalı zincir)", opts, d.path, (v) => ((d.path = v), upd())),
          h("p", "pm-hint", "Profil eskizi, yolun başlangıç noktasında yola dik bir düzlemde olmalıdır."),
        ),
      );
      body.appendChild(segField([{ v: "boss", t: "Malzeme ekle" }, { v: "cut", t: "Kes" }], d.cut ? "cut" : "boss", (v) => ((d.cut = v === "cut"), upd())));
      break;
    }
    case "loft": {
      const box = h("div", "pm-feats");
      const closed = sketches.filter((s) => extractClosed(s));
      for (const s of closed)
        box.appendChild(
          checkField(`${s.name}${d.sketches.includes(s.id) ? ` (${d.sketches.indexOf(s.id) + 1}.)` : ""}`, d.sketches.includes(s.id), (on) => {
            d.sketches = on ? [...d.sketches, s.id] : d.sketches.filter((x: string) => x !== s.id);
            renderFeaturePM(kind);
            upd();
          }),
        );
      body.appendChild(group("Profiller (seçim sırasıyla)", box, h("p", "pm-hint", "Her profil tek bir kapalı kontur olmalı. Sıra, seçim sırasıdır.")));
      body.appendChild(
        group(
          "Seçenekler",
          checkField("Düz yüzeyli (ruled)", d.ruled, (v) => ((d.ruled = v), upd())),
          selectField("Merkez çizgisi", [{ v: "", t: "Yok" }, ...sketches.filter((s) => !d.sketches.includes(s.id)).map((s) => ({ v: s.id, t: s.name }))], d.center ?? "", (v) => {
            d.center = v || undefined;
            upd();
          }),
        ),
      );
      const gbox = h("div", "pm-feats");
      for (const s of sketches.filter((x) => !extractClosed(x) && !d.sketches.includes(x.id) && x.id !== d.center))
        gbox.appendChild(
          checkField(s.name, !!d.guides?.includes(s.id), (on) => {
            d.guides = on ? [...(d.guides ?? []), s.id] : (d.guides ?? []).filter((x: string) => x !== s.id);
            upd();
          }),
        );
      body.appendChild(group("Kılavuz eğriler", gbox, h("p", "pm-hint", "Kılavuz eğri iki profilin karşılıklı noktalarını birleştiren açık bir eğri olmalı. Ara kesitler kılavuza oturacak şekilde ölçeklenir.")));
      body.appendChild(segField([{ v: "boss", t: "Malzeme ekle" }, { v: "cut", t: "Kes" }], d.cut ? "cut" : "boss", (v) => ((d.cut = v === "cut"), upd())));
      break;
    }
    case "hole": {
      const hf = d as HoleFeature;
      const std = hf.std ?? "iso";
      const setStd = () => {
        if (hf.size !== "custom") Object.assign(hf, holeDefaults(hf.htype, hf.size, hf.std ?? "iso"));
      };
      body.appendChild(
        group(
          "Delik türü",
          segField(
            [
              { v: "simple", t: "Düz" },
              { v: "cbore", t: "Havşa" },
              { v: "csink", t: "Konik" },
              { v: "tap", t: "Kılavuz" },
            ],
            hf.htype,
            (v) => {
              hf.htype = v as any;
              setStd();
              renderFeaturePM(kind);
              upd();
            },
          ),
          selectField(
            "Standart",
            [
              { v: "iso", t: "ISO metrik (M)" },
              { v: "pipe", t: "Boru dişi (G / BSPP)" },
              { v: "inch", t: "İnç (UNC)" },
            ],
            std,
            (v) => {
              hf.std = v as any;
              hf.size = sizesFor(hf.std!)[std === "iso" ? 1 : 1];
              setStd();
              renderFeaturePM(kind);
              upd();
            },
          ),
          selectField("Boyut", [...sizesFor(std).map((k) => ({ v: k, t: k })), { v: "custom", t: "Özel" }], hf.size, (v) => {
            hf.size = v;
            setStd();
            renderFeaturePM(kind);
            upd();
          }),
        ),
      );
      const g = group(
        "Ölçüler",
        numField(hf.htype === "tap" ? "Matkap çapı" : "Delik çapı", hf.d, (v) => ((hf.d = v), (hf.size = "custom"), upd()), { min: 0.01, unit: "mm", key: `${hf.id}.d` }),
        checkField("Tümünden geçen", hf.through, (v) => ((hf.through = v), renderFeaturePM(kind), upd())),
      );
      if (!hf.through) g.appendChild(numField("Derinlik", hf.depth, (v) => ((hf.depth = v), upd()), { min: 0.01, unit: "mm", key: `${hf.id}.depth` }));
      if (hf.htype === "cbore") {
        g.appendChild(numField("Havşa çapı", hf.cd, (v) => ((hf.cd = v), upd()), { min: 0.01, unit: "mm" }));
        g.appendChild(numField("Havşa derinliği", hf.cdepth, (v) => ((hf.cdepth = v), upd()), { min: 0.01, unit: "mm" }));
      }
      if (hf.htype === "csink") {
        g.appendChild(numField("Konik havşa çapı", hf.cd, (v) => ((hf.cd = v), upd()), { min: 0.01, unit: "mm" }));
        g.appendChild(numField("Havşa açısı", hf.cangle, (v) => ((hf.cangle = v), upd()), { min: 1, unit: "°" }));
      }
      if (hf.htype === "tap") {
        g.appendChild(h("p", "pm-hint", `Kılavuz matkabı. Diş: ${hf.size !== "custom" ? threadLabel(std, hf.size) : "özel"}`));
        g.appendChild(checkField("Kozmetik diş göster", !!hf.cosmetic, (v) => ((hf.cosmetic = v), drawRefGeom())));
      }
      body.appendChild(g);
      const pos = group("Konumlar", h("p", "pm-hint", hf.plane ? "Yüze dokunarak delik ekleyin. Konumları aşağıdan düzenleyebilirsiniz." : "Önce deliğin açılacağı düz yüze dokunun."));
      hf.pts.forEach((pt: Vec2, i: number) => {
        const row = h("div", "pm-row");
        row.append(
          numField(`${i + 1}. X`, pt[0], (v) => ((pt[0] = v), upd()), {}),
          numField("Y", pt[1], (v) => ((pt[1] = v), upd()), {}),
          button("✕", () => (hf.pts.splice(i, 1), renderFeaturePM(kind), upd()), "btn danger"),
        );
        pos.appendChild(row);
      });
      body.appendChild(pos);
      hint(hf.plane ? "Delik eklemek için yüze dokunun" : "Deliğin açılacağı düz yüze dokunun");
      break;
    }
    case "draft": {
      body.appendChild(group("Koniklik", numField("Açı", d.angle, (v) => ((d.angle = v), upd()), { min: 0.01, unit: "°" }), checkField("Yönü ters çevir", d.rev, (v) => ((d.rev = v), upd()))));
      body.appendChild(group("Nötr düzlem", planeField("Düzlem", () => d.plane, (r) => (d.plane = r))));
      const picks = h("div", "pm-picks", d.faces.length ? `${d.faces.length} yüz seçili` : "Koniklik verilecek yüzlere dokunun");
      const g = group("Yüzler", picks);
      if (d.faces.length) g.appendChild(button("Seçimi temizle", () => ((d.faces = []), renderFeaturePM(kind), refreshHighlight())));
      body.appendChild(g);
      hint("Koniklik verilecek yan yüzlere dokunun");
      break;
    }
    case "rib": {
      body.appendChild(group("Eskiz", selectField("Kaburga eskizi (açık çizgi)", sketches.map((s) => ({ v: s.id, t: s.name })), d.sketch, (v) => ((d.sketch = v), upd()))));
      body.appendChild(
        group(
          "Parametreler",
          numField("Kalınlık", d.t, (v) => ((d.t = v), upd()), { min: 0.01, unit: "mm", key: `${d.id}.t` }),
          segField([{ v: "one", t: "Tek taraf" }, { v: "mid", t: "Her iki taraf" }, { v: "rev", t: "Diğer taraf" }], d.side, (v) => ((d.side = v as any), upd())),
          selectField("Uzama yönü", [{ v: "parallel", t: "Eskize paralel" }, { v: "normal", t: "Eskize dik" }], d.dir, (v) => ((d.dir = v as any), upd())),
          checkField("Malzeme tarafını ters çevir", d.flip, (v) => ((d.flip = v), upd())),
        ),
      );
      break;
    }
    case "member": {
      const std = d.std as ProfileStd;
      const lib = loadLibrary();
      const docP = doc.profiles ?? {};
      const closedSk = sketches.filter((x) => extractClosed(x) && !d.segs.some((sg: any) => sg.sk === x.id));
      let sizeOpts: { v: string; t: string }[];
      if (d.std === "sketch") sizeOpts = closedSk.map((x) => ({ v: x.id, t: x.name }));
      else if (d.std === "custom") {
        const ids = new Set([...Object.keys(docP), ...Object.keys(lib)]);
        sizeOpts = [...ids].map((k) => ({ v: k, t: (docP[k] ?? lib[k]).name + (docP[k] ? "" : " (kütüphane)") }));
      } else sizeOpts = Object.keys(PROFILES[std].sizes).map((z) => ({ v: z, t: z }));
      if (sizeOpts.length && !sizeOpts.some((o) => o.v === d.size)) d.size = sizeOpts[0].v;
      // kütüphaneden seçilen profil belgeye gömülür
      const embed = () => {
        if (d.std === "custom" && d.size && !docP[d.size] && lib[d.size]) {
          doc.profiles = { ...docP, [d.size]: { name: lib[d.size].name, loops: lib[d.size].loops } };
        }
      };
      embed();
      let info = "";
      try {
        let custom: any;
        if (d.std === "sketch") custom = extractLoops((getFeat(d.size) as SketchFeature).data).loops;
        else if (d.std === "custom") custom = (doc.profiles ?? {})[d.size]?.loops;
        const pr = placedProfile(std, d.size, d.align, d.mirror, d.rot, custom);
        const rho = MATERIALS[doc.material ?? "steel"]?.rho ?? 7.85;
        info = `Kesit alanı ${fmtNum(pr.area / 100, 2)} cm² · ≈ ${fmtNum((pr.area * rho) / 1000, 2)} kg/m`;
      } catch {}
      const stdOpts = [...(Object.keys(PROFILES) as ProfileStd[]).map((k) => ({ v: k as string, t: PROFILES[k].label })), { v: "custom", t: "Özel profil (kütüphane)" }, { v: "sketch", t: "Eskizden profil (bu belgede)" }];
      const gp = group(
        "Profil",
        selectField("Standart", stdOpts, d.std, (v) => {
          d.std = v;
          d.size = "";
          renderFeaturePM(kind);
          upd();
        }),
        sizeOpts.length
          ? selectField(d.std === "sketch" ? "Profil eskizi" : "Ölçü", sizeOpts, d.size, (v) => ((d.size = v), embed(), renderFeaturePM(kind), upd()))
          : h("p", "pm-hint", d.std === "sketch" ? "Belgede kapalı bir profil eskizi yok. Profilin kesitini kapalı bir eskiz olarak çizin; eskizin orijini delme noktası olur." : "Kütüphanede profil yok. Aşağıdan bir eskizi kütüphaneye ekleyin."),
        h("p", "pm-hint", `${PROFILES[std]?.std ?? (d.std === "sketch" ? "Eskiz değişince eleman güncellenir" : "Özel profil")} · ${info}`),
      );
      if (d.std === "custom" || d.std === "sketch") {
        if (closedSk.length)
          gp.appendChild(
            button("Bir eskizi kütüphaneye ekle…", () => {
              const sk = d.std === "sketch" ? (getFeat(d.size) as SketchFeature) : closedSk[closedSk.length - 1];
              const nm = prompt("Profil adı (ör. Özel kutu 45x25x2):", sk?.name ?? "Özel profil");
              if (!nm || !sk) return;
              const { loops, error } = extractLoops(sk.data);
              if (error || !loops.length) return toast("Eskizde kapalı kontur yok", true);
              const pid = "p" + Date.now().toString(36);
              const l2 = loadLibrary();
              l2[pid] = { name: nm, loops };
              saveLibrary(l2);
              doc.profiles = { ...(doc.profiles ?? {}), [pid]: { name: nm, loops } };
              d.std = "custom";
              d.size = pid;
              toast(`"${nm}" kütüphaneye eklendi`);
              renderFeaturePM(kind);
              upd();
            }, "btn"),
          );
        const io = h("div", "pm-row");
        io.append(
          button("Kütüphaneyi dışa aktar", () => download(new Blob([JSON.stringify(loadLibrary(), null, 1)], { type: "application/json" }), "imajcad_profiller.json"), "btn"),
          button("İçe aktar…", () => {
            const inp = h("input") as HTMLInputElement;
            inp.type = "file";
            inp.accept = ".json,application/json";
            inp.onchange = async () => {
              const file = inp.files?.[0];
              if (!file) return;
              try {
                const data = JSON.parse(await file.text());
                const l2 = { ...loadLibrary(), ...data };
                saveLibrary(l2);
                toast(`${Object.keys(data).length} profil içe aktarıldı`);
                renderFeaturePM(kind);
              } catch {
                toast("Profil dosyası okunamadı", true);
              }
            };
            inp.click();
          }, "btn"),
        );
        gp.appendChild(io);
      }
      body.appendChild(gp);
      body.appendChild(
        group(
          "Konum",
          selectField("Delme noktası", Object.entries(ALIGN_NAMES).map(([v, t]) => ({ v, t })), d.align, (v) => ((d.align = v), upd())),
          numField("Döndürme açısı", d.rot, (v) => ((d.rot = v), upd()), { unit: "°", key: `${d.id}.rot` }),
          checkField("Profili aynala", d.mirror, (v) => ((d.mirror = v), upd())),
        ),
      );
      const gc = group(
        "Köşe işlemi",
        segField([{ v: "miter", t: "Gönye" }, { v: "butt1", t: "Alın 1" }, { v: "butt2", t: "Alın 2" }, { v: "none", t: "Yok" }], d.corner, (v) => ((d.corner = v), renderFeaturePM(kind), upd())),
      );
      if (d.corner !== "none") gc.appendChild(numField("Boşluk", d.gap, (v) => ((d.gap = Math.max(0, v)), upd()), { min: 0, unit: "mm" }));
      gc.appendChild(h("p", "pm-hint", "Uç uca birleşen iki eleman köşede kesilir. T birleşimleri için Kırp/Uzat kullanın."));
      body.appendChild(gc);
      // segmentler
      const segBox = h("div", "pm-feats");
      for (const sk of sketches) {
        const ents = sk.data.ents.filter((e) => !e.cons && (e.t === "line" || e.t === "arc"));
        if (!ents.length) continue;
        const all = ents.every((e) => d.segs.some((x: any) => x.sk === sk.id && x.ent === e.id));
        segBox.appendChild(
          checkField(`${sk.name} — tümü (${ents.length})`, all, (on) => {
            d.segs = d.segs.filter((x: any) => x.sk !== sk.id);
            if (on) d.segs.push(...ents.map((e) => ({ sk: sk.id, ent: e.id })));
            renderFeaturePM(kind);
            upd();
          }),
        );
        ents.forEach((e, j) => {
          let lbl = "";
          if (e.t === "line") {
            const a = pointPos(sk.data, e.p1), b = pointPos(sk.data, e.p2);
            lbl = `Çizgi ${j + 1} · ${fmtNum(Math.hypot(b[0] - a[0], b[1] - a[1]), 1)} mm`;
          } else lbl = `Yay ${j + 1} · R${fmtNum((e as any).r, 1)}`;
          const on = d.segs.some((x: any) => x.sk === sk.id && x.ent === e.id);
          const cf = checkField(lbl, on, (v) => {
            d.segs = d.segs.filter((x: any) => !(x.sk === sk.id && x.ent === e.id));
            if (v) d.segs.push({ sk: sk.id, ent: e.id });
            upd();
          });
          cf.style.paddingLeft = "18px";
          segBox.appendChild(cf);
        });
      }
      for (const s3 of doc.features.slice(0, idx).filter((f) => f.type === "sketch3d") as Sketch3DFeature[]) {
        const ls = s3.lines.filter((l) => !l.cons);
        if (!ls.length) continue;
        const all = ls.every((l) => d.segs.some((x: any) => x.sk === s3.id && x.ent === l.id));
        segBox.appendChild(
          checkField(`${s3.name} — tümü (${ls.length})`, all, (on) => {
            d.segs = d.segs.filter((x: any) => x.sk !== s3.id);
            if (on) d.segs.push(...ls.map((l) => ({ sk: s3.id, ent: l.id })));
            renderFeaturePM(kind);
            upd();
          }),
        );
        ls.forEach((l, j) => {
          const a = s3.xyz[s3.ids.indexOf(l.a)], b = s3.xyz[s3.ids.indexOf(l.b)];
          const on = d.segs.some((x: any) => x.sk === s3.id && x.ent === l.id);
          const cf = checkField(`Çizgi ${j + 1} · ${fmtNum(dist3(a, b), 1)} mm`, on, (v) => {
            d.segs = d.segs.filter((x: any) => !(x.sk === s3.id && x.ent === l.id));
            if (v) d.segs.push({ sk: s3.id, ent: l.id });
            upd();
          });
          cf.style.paddingLeft = "18px";
          segBox.appendChild(cf);
        });
      }
      body.appendChild(group(`Segmentler (${d.segs.length} seçili)`, segBox));
      break;
    }
    case "sketch3d": {
      const f3 = d as Sketch3DFeature & { _link: boolean; _len: number; _d: Vec3; _act?: number; _abs?: Vec3 };
      f3._link ??= true;
      f3._len ??= 100;
      f3._d ??= [0, 0, 0];
      const act = f3._act ?? f3.xyz.length - 1;
      const g1 = group("Nokta ekle");
      g1.appendChild(checkField("Etkin noktaya çizgiyle bağla", f3._link, (v) => (f3._link = v)));
      g1.appendChild(numField("Uzunluk", f3._len, (v) => (f3._len = v), { min: 0.001, unit: "mm" }));
      const dirs = h("div", "dir-grid");
      ([["+X", [1, 0, 0]], ["−X", [-1, 0, 0]], ["+Y", [0, 1, 0]], ["−Y", [0, -1, 0]], ["+Z", [0, 0, 1]], ["−Z", [0, 0, -1]]] as [string, Vec3][]).forEach(([t, v]) =>
        dirs.appendChild(
          button(t, () => {
            if (!f3.xyz.length) return toast("Önce bir başlangıç noktası ekleyin (modele dokunun veya koordinat girin)", true);
            const p = f3.xyz[act];
            s3Add(f3, [p[0] + v[0] * f3._len, p[1] + v[1] * f3._len, p[2] + v[2] * f3._len]);
          }, "btn"),
        ),
      );
      g1.appendChild(dirs);
      g1.appendChild(h("p", "pm-hint", "Etkin noktadan seçilen yönde, girilen uzunlukta yeni nokta ve çizgi ekler."));
      const dl = h("div", "pm-row3");
      const dv = f3._d;
      dl.append(
        numField("Δx", dv[0], (v) => (dv[0] = v), { unit: "mm" }),
        numField("Δy", dv[1], (v) => (dv[1] = v), { unit: "mm" }),
        numField("Δz", dv[2], (v) => (dv[2] = v), { unit: "mm" }),
      );
      g1.appendChild(dl);
      g1.appendChild(
        button("Göreli ekle (Δ)", () => {
          if (!f3.xyz.length) return toast("Önce bir başlangıç noktası ekleyin", true);
          const p = f3.xyz[act];
          s3Add(f3, [p[0] + dv[0], p[1] + dv[1], p[2] + dv[2]]);
        }, "btn"),
      );
      const ab = (f3._abs = f3._abs ?? [0, 0, 0]);
      const al = h("div", "pm-row3");
      al.append(numField("X", ab[0], (v) => (ab[0] = v), { unit: "mm" }), numField("Y", ab[1], (v) => (ab[1] = v), { unit: "mm" }), numField("Z", ab[2], (v) => (ab[2] = v), { unit: "mm" }));
      g1.appendChild(al);
      g1.appendChild(button("Mutlak koordinatla ekle", () => s3Add(f3, [ab[0], ab[1], ab[2]]), "btn"));
      body.appendChild(g1);
      // noktalar
      const pl = h("div", "pm-feats");
      if (!f3.xyz.length) pl.appendChild(h("p", "pm-hint", "Henüz nokta yok. Modelde bir köşeye / yüze / düzleme dokunun ya da koordinat girin."));
      f3.ids.forEach((pid, i) => {
        const row = h("div", "s3-pt" + (i === act ? " act" : ""));
        const lab = button(`N${i + 1}`, () => ((f3._act = i), renderFeaturePM(kind), drawSketches()), "btn" + (i === act ? " primary" : ""));
        row.appendChild(lab);
        (["X", "Y", "Z"] as const).forEach((ax, k) => {
          const nf = numField(ax, f3.xyz[i][k], (v) => {
            f3.xyz[i][k] = v;
            drawSketches();
            upd();
          }, { key: `${f3.id}.xyz[${i}][${k}]` });
          row.appendChild(nf);
        });
        row.appendChild(
          button("✕", () => {
            f3.lines = f3.lines.filter((l) => l.a !== pid && l.b !== pid);
            f3.ids.splice(i, 1);
            f3.xyz.splice(i, 1);
            f3._act = Math.min(act, f3.xyz.length - 1);
            renderFeaturePM(kind);
            drawSketches();
            upd();
          }, "btn danger"),
        );
        pl.appendChild(row);
      });
      body.appendChild(group(`Noktalar (${f3.xyz.length})`, pl, h("p", "pm-hint", "Bir noktayı etkin yapmak için N düğmesine basın; yeni çizgiler etkin noktadan başlar.")));
      // çizgiler
      const ll = h("div", "pm-feats");
      f3.lines.forEach((l, j) => {
        const ia = f3.ids.indexOf(l.a), ib = f3.ids.indexOf(l.b);
        const row = h("div", "pm-row");
        row.append(
          h("span", "", `N${ia + 1} → N${ib + 1} · ${fmtNum(dist3(f3.xyz[ia], f3.xyz[ib]), 1)} mm`),
          checkField("Yapı", !!l.cons, (v) => ((l.cons = v), drawSketches())),
          button("✕", () => (f3.lines.splice(j, 1), renderFeaturePM(kind), drawSketches(), upd()), "btn danger"),
        );
        ll.appendChild(row);
      });
      const gl = group(`Çizgiler (${f3.lines.length})`, ll);
      if (f3.xyz.length > 2)
        gl.appendChild(
          button("Etkin noktayı ilk noktaya bağla (kapat)", () => {
            if (act === 0) return;
            f3.lines.push({ id: `l${f3.seq++}`, a: f3.ids[act], b: f3.ids[0] });
            renderFeaturePM(kind);
            drawSketches();
          }, "btn"),
        );
      body.appendChild(gl);
      body.appendChild(group("Büküm", numField("Köşe yarıçapı", f3.r, (v) => ((f3.r = Math.max(0, v)), upd()), { min: 0, unit: "mm", key: `${f3.id}.r` }), h("p", "pm-hint", "0'dan büyükse iki çizginin birleştiği köşeler bu yarıçapla bükülür (bükümlü boru / profil).")));
      hint("Nokta eklemek için modele, köşelere veya düzlemlere dokunun");
      break;
    }
    case "trim": {
      const nm = (r: any) => {
        const f = getFeat(r.f);
        return `${f?.name ?? "?"} · ${r.i + 1}. segment`;
      };
      const listEl = (arr: any[]) => {
        const box = h("div", "pm-feats");
        if (!arr.length) box.appendChild(h("p", "pm-hint", "Seçim yok"));
        arr.forEach((r, j) => {
          const row = h("div", "pm-row");
          row.append(h("span", "", nm(r)), button("✕", () => (arr.splice(j, 1), renderFeaturePM(kind), refreshHighlight(), upd()), "btn danger"));
          box.appendChild(row);
        });
        return box;
      };
      body.appendChild(
        group(
          "Seçim",
          segField([{ v: "targets", t: "Kırpılacak" }, { v: "bounds", t: "Sınır" }], d._pick ?? "targets", (v) => ((d._pick = v), renderFeaturePM(kind))),
          h("p", "pm-hint", d._pick === "bounds" ? "Kırpma sınırı olan elemanlara dokunun" : "Kırpılacak / uzatılacak elemanlara dokunun"),
        ),
      );
      body.appendChild(group(`Kırpılacak elemanlar (${d.targets.length})`, listEl(d.targets)));
      body.appendChild(group(`Sınır elemanlar (${d.bounds.length})`, listEl(d.bounds)));
      if (d.faces?.length) {
        const fb = h("div", "pm-feats");
        d.faces.forEach((_: any, j: number) => {
          const row = h("div", "pm-row");
          row.append(h("span", "", `Sınır yüz ${j + 1}`), button("✕", () => (d.faces.splice(j, 1), renderFeaturePM(kind), refreshHighlight(), upd()), "btn danger"));
          fb.appendChild(row);
        });
        body.appendChild(group(`Sınır yüzler (${d.faces.length})`, fb));
      }
      body.appendChild(group("Kesim", checkField("Profile göre kes (koplama)", !!d.coped, (v) => ((d.coped = v), upd())), h("p", "pm-hint", "Kapalıyken düz kesilir: eleman sınırın yüzeyinde biter. Uç sınıra yetişmiyorsa eleman uzatılır.")));
      hint(d._pick === "bounds" ? "Sınır elemanlarına dokunun" : "Kırpılacak elemanlara dokunun");
      break;
    }
    case "combine": {
      body.appendChild(group("İşlem", segField([{ v: "add", t: "Ekle" }, { v: "sub", t: "Çıkar" }, { v: "common", t: "Ortak" }], d.op, (v) => ((d.op = v), upd()))));
      body.appendChild(
        group(
          "Gövdeler",
          segField([{ v: "main", t: "Ana gövde" }, { v: "tools", t: "Araç gövdeler" }], d._pick ?? "main", (v) => ((d._pick = v), renderFeaturePM(kind))),
          h("div", "pm-picks", `Ana: ${d.main ? "seçili" : "—"} · Araç: ${d.tools.length}`),
          h("p", "pm-hint", d.op === "sub" ? "Araç gövdeler ana gövdeden çıkarılır." : d.op === "common" ? "Yalnızca gövdelerin ortak hacmi kalır." : "Gövdeler tek gövdede birleşir."),
        ),
      );
      hint(d._pick === "tools" ? "Araç gövdelere dokunun" : "Ana gövdeye dokunun");
      break;
    }
    case "splitbody": {
      body.appendChild(
        group(
          "Seçim",
          segField([{ v: "body", t: "Gövde" }, { v: "plane", t: "Bölme düzlemi" }], d._pick ?? "body", (v) => ((d._pick = v), renderFeaturePM(kind))),
          h("div", "pm-picks", `Gövde: ${d.body ? "seçili" : "—"}`),
          planeField("Düzlem", () => d.plane, (r) => (d.plane = r)),
        ),
      );
      hint(d._pick === "plane" ? "Bölme düzlemine veya düz yüze dokunun" : "Bölünecek gövdeye dokunun");
      break;
    }
    case "movebody": {
      const dv = h("div", "pm-row3");
      dv.append(numField("ΔX", d.d[0], (v) => ((d.d[0] = v), upd()), { unit: "mm" }), numField("ΔY", d.d[1], (v) => ((d.d[1] = v), upd()), { unit: "mm" }), numField("ΔZ", d.d[2], (v) => ((d.d[2] = v), upd()), { unit: "mm" }));
      body.appendChild(group("Gövde", h("div", "pm-picks", d.body ? "Gövde seçili" : "Taşınacak gövdeye dokunun"), checkField("Kopyala (orijinal kalsın)", d.copy, (v) => ((d.copy = v), upd()))));
      body.appendChild(group("Öteleme", dv));
      body.appendChild(group("Döndürme (ağırlık merkezi etrafında)", selectField("Eksen", axisOpts, d.axis, (v) => ((d.axis = v), upd())), numField("Açı", d.angle, (v) => ((d.angle = v), upd()), { unit: "°" })));
      hint("Taşınacak gövdeye dokunun");
      break;
    }
    case "delbody":
      body.appendChild(group("Gövdeler", h("div", "pm-picks", `${d.bodies.length} gövde seçili`), checkField("Seçilenleri tut, diğerlerini sil", d.keep, (v) => ((d.keep = v), upd()))));
      hint("Gövdelere dokunun");
      break;
    case "indent":
      body.appendChild(
        group(
          "Gövdeler",
          segField([{ v: "target", t: "Hedef" }, { v: "tool", t: "Araç" }], d._pick ?? "target", (v) => ((d._pick = v), renderFeaturePM(kind))),
          h("div", "pm-picks", `Hedef: ${d.target ? "seçili" : "—"} · Araç: ${d.tool ? "seçili" : "—"}`),
          numField("Boşluk", d.clearance, (v) => ((d.clearance = Math.max(0, v)), upd()), { min: 0, unit: "mm" }),
          checkField("Araç gövdeyi koru", d.keepTool, (v) => ((d.keepTool = v), upd())),
          h("p", "pm-hint", "Hedef gövdeden, araç gövdenin boşluk kadar büyütülmüş hali çıkarılır."),
        ),
      );
      hint(d._pick === "tool" ? "Araç gövdeye dokunun" : "Hedef gövdeye dokunun");
      break;
    case "spattern":
      body.appendChild(featChecks("Çoğaltılacak özellikler"));
      body.appendChild(group("Konumlar", selectField("Nokta eskizi", sketches.map((x) => ({ v: x.id, t: x.name })), d.sketch, (v) => ((d.sketch = v), upd())), h("p", "pm-hint", "Eskizdeki her noktaya bir kopya yerleşir (nokta yoksa çizgi uçları kullanılır).")));
      break;
    case "tpattern": {
      body.appendChild(featChecks("Çoğaltılacak özellikler"));
      const tb = h("div", "pm-feats");
      d.rows.forEach((r: Vec3, j: number) => {
        const row = h("div", "s3-pt");
        row.append(
          h("span", "", `${j + 1}`),
          numField("ΔX", r[0], (v) => ((r[0] = v), upd()), { unit: "" }),
          numField("ΔY", r[1], (v) => ((r[1] = v), upd()), { unit: "" }),
          numField("ΔZ", r[2], (v) => ((r[2] = v), upd()), { unit: "" }),
          button("✕", () => (d.rows.splice(j, 1), renderFeaturePM(kind), upd()), "btn danger"),
        );
        tb.appendChild(row);
      });
      body.appendChild(group(`Tablo (${d.rows.length} kopya, ilk konuma göre öteleme)`, tb, button("+ Satır ekle", () => (d.rows.push([0, 0, 0]), renderFeaturePM(kind)), "btn")));
      break;
    }
    case "cvpattern":
      body.appendChild(featChecks("Çoğaltılacak özellikler"));
      body.appendChild(
        group(
          "Eğri",
          selectField("Eğri eskizi", sketches.map((x) => ({ v: x.id, t: x.name })), d.sketch, (v) => ((d.sketch = v), upd())),
          numField("Adet (ilk dahil)", d.count, (v) => ((d.count = Math.max(2, Math.round(v))), upd()), { min: 2, int: true }),
          checkField("Eşit aralık (eğri sonuna kadar)", d.equal, (v) => ((d.equal = v), renderFeaturePM(kind), upd())),
          ...(d.equal ? [] : [numField("Aralık", d.spacing, (v) => ((d.spacing = v), upd()), { min: 0.01, unit: "mm" })]),
          checkField("Eğri yönüne göre döndür", d.align, (v) => ((d.align = v), upd())),
        ),
      );
      break;
    case "fpattern":
      body.appendChild(featChecks("Çoğaltılacak özellikler"));
      body.appendChild(
        group(
          "Doldurma",
          h("div", "pm-picks", d.face ? "Yüz seçili" : "Doldurulacak düz yüze dokunun"),
          segField([{ v: "square", t: "Kare" }, { v: "stagger", t: "Şaşırtmalı" }], d.layout, (v) => ((d.layout = v), upd())),
          numField("Aralık", d.spacing, (v) => ((d.spacing = v), upd()), { min: 0.1, unit: "mm" }),
          numField("Kenar payı", d.margin, (v) => ((d.margin = Math.max(0, v)), upd()), { min: 0, unit: "mm" }),
          numField("Döndürme", d.angle, (v) => ((d.angle = v), upd()), { unit: "°" }),
        ),
      );
      hint("Doldurulacak düz yüze dokunun");
      break;
    case "thread":
      body.appendChild(
        group(
          "Diş",
          h("div", "pm-picks", d.face ? "Silindirik yüz seçili" : "Mile veya deliğe (silindirik yüz) dokunun"),
          numField("Hatve", d.pitch, (v) => ((d.pitch = v), upd()), { min: 0.1, unit: "mm", key: `${d.id}.pitch` }),
          numField("Diş boyu (0 = tüm yüz)", d.length, (v) => ((d.length = Math.max(0, v)), upd()), { min: 0, unit: "mm", key: `${d.id}.length` }),
          checkField("Diğer uçtan başla", d.fromEnd, (v) => ((d.fromEnd = v), upd())),
          checkField("Sol diş", d.left, (v) => ((d.left = v), upd())),
          h("p", "pm-hint", "Metrik ISO 60° profil. Dış/iç diş yüzeye göre otomatik belirlenir. Gerçek diş geometrisi ağır bir işlemdir; uzun dişlerde hesaplama birkaç saniye sürebilir. Yalnızca imalat resmi için Delik Sihirbazı'ndaki görsel diş yeterlidir."),
        ),
      );
      hint("Diş açılacak silindirik yüze dokunun");
      break;
    case "flex": {
      const lab = d.mode === "bend" ? "Büküm açısı (°)" : d.mode === "twist" ? "Burma açısı (°)" : d.mode === "taper" ? "Uç ölçeği (1 = değişmez)" : "Boy oranı (1 = değişmez)";
      body.appendChild(
        group(
          "Esnet",
          h("div", "pm-picks", d.body ? "Gövde seçili" : "Esnetilecek gövdeye dokunun"),
          segField([{ v: "bend", t: "Bük" }, { v: "twist", t: "Bur" }, { v: "taper", t: "Daralt" }, { v: "stretch", t: "Uzat" }], d.mode, (v) => {
            d.mode = v;
            d.value = v === "bend" || v === "twist" ? 90 : v === "taper" ? 0.5 : 1.5;
            renderFeaturePM(kind);
            upd();
          }),
          selectField("Gövde ekseni", axisOpts, d.axis, (v) => ((d.axis = v), upd())),
          numField(lab, d.value, (v) => ((d.value = v), upd()), {}),
          ...(d.mode === "bend" ? [selectField("Büküm yönü", axisOpts, d.dir, (v) => ((d.dir = v), upd()))] : []),
          h("p", "pm-hint", "Gövde, eksen boyunca alınan kesitlerden yeniden oluşturulur; kesiti boyunca sabit gövdelerde (çubuk, profil, mil, lama) çalışır."),
        ),
      );
      hint("Esnetilecek gövdeye dokunun");
      break;
    }
    case "vchamfer":
      body.appendChild(group("Köşe pahı", h("div", "pm-picks", d.v ? "Köşe seçili" : "Köşeye yakın bir kenar ucuna dokunun"), numField("Mesafe", d.d, (v) => ((d.d = v), upd()), { min: 0.01, unit: "mm" })));
      hint("Pah kırılacak köşeye (kenar ucuna) dokunun");
      break;
    case "weld": {
      const list = h("div", "pm-feats");
      if (!d.pairs.length) list.appendChild(h("p", "pm-hint", "Henüz dikiş yok"));
      d.pairs.forEach((_: any, j: number) => {
        const row = h("div", "pm-row");
        row.append(h("span", "", `Dikiş ${j + 1}`), button("✕", () => (d.pairs.splice(j, 1), renderFeaturePM(kind), refreshHighlight(), upd()), "btn danger"));
        list.appendChild(row);
      });
      body.appendChild(group(`Yüz çiftleri (${d.pairs.length})`, h("div", "pm-picks", d._p1 ? "2. yüze dokunun" : "Kaynak yapılacak 1. yüze dokunun"), list, h("p", "pm-hint", "Her dikiş için birbirine değen iki yüz seçin (ör. dikmenin yan yüzü ve kirişin üst yüzü). Boru–levha için boru yüzeyi ve levha yüzü seçilirse çevresel dikiş oluşur.")));
      body.appendChild(
        group(
          "Kaynak",
          numField("Kaynak kalınlığı a", d.a, (v) => ((d.a = v), renderFeaturePM(kind), upd()), { min: 0.5, unit: "mm", key: `${d.id}.a` }),
          h("p", "pm-hint", `Bacak boyu z = a·√2 = ${fmtNum(d.a * Math.SQRT2, 2)} mm`),
          checkField("Kesikli kaynak", d.intermittent, (v) => ((d.intermittent = v), renderFeaturePM(kind), upd())),
          ...(d.intermittent
            ? [numField("Dikiş boyu", d.len, (v) => ((d.len = v), upd()), { min: 1, unit: "mm" }), numField("Adım (merkezden merkeze)", d.pitch, (v) => ((d.pitch = v), upd()), { min: 1, unit: "mm" })]
            : []),
        ),
      );
      hint(d._p1 ? "Kaynağın 2. yüzüne dokunun" : "Kaynağın 1. yüzüne dokunun");
      break;
    }
    case "endcap": {
      const g = group("Yüzler", h("div", "pm-picks", d.faces.length ? `${d.faces.length} uç yüz seçili` : "Elemanların uç yüzlerine dokunun"));
      if (d.faces.length) g.appendChild(button("Seçimi temizle", () => ((d.faces = []), renderFeaturePM(kind), refreshHighlight(), upd())));
      body.appendChild(g);
      body.appendChild(
        group(
          "Parametreler",
          numField("Kalınlık", d.t, (v) => ((d.t = v), upd()), { min: 0.1, unit: "mm", key: `${d.id}.t` }),
          numField("Kenardan içeri", d.inset, (v) => ((d.inset = Math.max(0, v)), upd()), { min: 0, unit: "mm", key: `${d.id}.inset` }),
          h("p", "pm-hint", "Kapak, uç yüzün dış konturundan oluşturulur ve dışa doğru eklenir."),
        ),
      );
      hint("Uç kapağı eklenecek yüzlere dokunun");
      break;
    }
    case "gusset": {
      body.appendChild(group("Yüzler", h("div", "pm-picks", `1. yüz: ${d.f1 ? "seçili" : "—"} · 2. yüz: ${d.f2 ? "seçili" : "—"}`), h("p", "pm-hint", "İç köşeyi oluşturan iki düz yüze dokunun (ör. kirişin alt yüzü ve dikmenin iç yüzü).")));
      body.appendChild(
        group(
          "Ölçüler",
          numField("Kenar 1", d.d1, (v) => ((d.d1 = v), upd()), { min: 0.1, unit: "mm", key: `${d.id}.d1` }),
          numField("Kenar 2", d.d2, (v) => ((d.d2 = v), upd()), { min: 0.1, unit: "mm", key: `${d.id}.d2` }),
          numField("Kalınlık", d.t, (v) => ((d.t = v), upd()), { min: 0.1, unit: "mm", key: `${d.id}.t` }),
          numField("Köşe pahı", d.chamfer, (v) => ((d.chamfer = Math.max(0, v)), upd()), { min: 0, unit: "mm" }),
          numField("Köşe boyunca kaydır", d.offset, (v) => ((d.offset = v), upd()), { unit: "mm" }),
        ),
      );
      hint("İç köşenin iki yüzüne dokunun");
      break;
    }
    case "sheetbase": {
      const sk = getFeat(d.sketch) as SketchFeature | undefined;
      const open = sk ? !extractClosed(sk) : false;
      body.appendChild(group("Eskiz", sketchSel(), h("p", "pm-hint", open ? "Açık profil: çizgiler büküm yarıçapıyla bükülür ve derinlik kadar uzatılır." : "Kapalı profil: düz levha oluşturulur.")));
      if (open)
        body.appendChild(
          group(
            "Derinlik",
            numField("Derinlik", d.d, (v) => ((d.d = v), upd()), { min: 0.01, unit: "mm", key: `${d.id}.d` }),
            checkField("Orta düzlem", d.mid, (v) => ((d.mid = v), upd())),
          ),
        );
      const ba = h("p", "pm-hint", "");
      const info = () => (ba.textContent = `90° büküm payı: ${fmtNum(bendAllowance(90, d.r, d.t, d.k), 3)} mm · Büküm kesintisi: ${fmtNum(2 * (d.r + d.t) - bendAllowance(90, d.r, d.t, d.k), 3)} mm`);
      info();
      body.appendChild(
        group(
          "Sac parametreleri",
          numField("Kalınlık", d.t, (v) => ((d.t = v), info(), upd()), { min: 0.01, unit: "mm", key: `${d.id}.t` }),
          numField("Büküm yarıçapı (iç)", d.r, (v) => ((d.r = v), info(), upd()), { min: 0.01, unit: "mm", key: `${d.id}.r` }),
          numField("K faktörü", d.k, (v) => ((d.k = Math.max(0, Math.min(1, v))), info(), upd()), { min: 0, key: `${d.id}.k` }),
          checkField(open ? "Malzeme tarafını ters çevir" : "Kalınlık yönünü ters çevir", d.rev, (v) => ((d.rev = v), upd())),
          ba,
        ),
      );
      body.appendChild(
        group(
          "Büküm boşaltma",
          numField("Oran (× kalınlık)", d.relief, (v) => ((d.relief = Math.max(0, v)), upd()), { min: 0 }),
          h("p", "pm-hint", "Kısaltılmış kenar flanşlarının iki ucuna dikdörtgen boşaltma açılır."),
        ),
      );
      break;
    }
    case "edgeflange":
    case "hem": {
      const isHem = d.type === "hem";
      const picks = h("div", "pm-picks", d.edges.length ? `${d.edges.length} kenar seçili` : "Sacın dış kenarına dokunun (üst veya alt yüzdeki kenar)");
      const g0 = group("Kenarlar", picks);
      if (d.edges.length) g0.appendChild(button("Seçimi temizle", () => ((d.edges = []), renderFeaturePM(kind), refreshHighlight())));
      g0.appendChild(
        checkField("Önizlemeyi göster", !!d._preview, (v) => {
          d._preview = v;
          refreshHighlight();
          rebuild();
        }),
      );
      body.appendChild(g0);
      if (isHem) {
        body.appendChild(
          group(
            "Kenet",
            segField([{ v: "closed", t: "Kapalı" }, { v: "open", t: "Açık" }], d.kind, (v) => ((d.kind = v), renderFeaturePM(kind), upd())),
            numField("Uzunluk", d.L, (v) => ((d.L = v), upd()), { min: 0.01, unit: "mm", key: `${d.id}.L` }),
            ...(d.kind === "open" ? [numField("Aralık", d.gap, (v) => ((d.gap = v), upd()), { min: 0.1, unit: "mm", key: `${d.id}.gap` })] : []),
            segField([{ v: "inside", t: "Malzeme içte" }, { v: "bendout", t: "Bükümün dışı" }], d.pos, (v) => ((d.pos = v), upd())),
            checkField("Yönü ters çevir", d.flip, (v) => ((d.flip = v), upd())),
          ),
        );
      } else {
        body.appendChild(
          group(
            "Flanş uzunluğu",
            numField("Uzunluk", d.L, (v) => ((d.L = v), upd()), { min: 0.01, unit: "mm", key: `${d.id}.L` }),
            selectField("Ölçü referansı", [{ v: "outer", t: "Dış sanal keskin (dış ölçü)" }, { v: "inner", t: "İç sanal keskin (iç ölçü)" }, { v: "tangent", t: "Teğet (düz kısım)" }], d.lenRef, (v) => ((d.lenRef = v), upd())),
          ),
        );
        body.appendChild(
          group(
            "Açı ve yön",
            numField("Büküm açısı", d.angle, (v) => ((d.angle = v), upd()), { min: 0.1, unit: "°", key: `${d.id}.angle` }),
            checkField("Yönü ters çevir", d.flip, (v) => ((d.flip = v), upd())),
          ),
        );
        body.appendChild(
          group(
            "Flanş konumu",
            segField([{ v: "inside", t: "Malzeme içte" }, { v: "outside", t: "Malzeme dışta" }, { v: "bendout", t: "Bükümün dışı" }], d.pos, (v) => ((d.pos = v), upd())),
            h("p", "pm-hint", d.pos === "inside" ? "Flanşın dış yüzü seçili kenarla aynı hizada; parçanın dış ölçüsü değişmez." : d.pos === "outside" ? "Flanşın iç yüzü seçili kenarla aynı hizada." : "Büküm kenardan başlar; taban kısalmaz."),
          ),
        );
        const gr = group("Büküm yarıçapı", checkField("Varsayılan yarıçapı kullan", d.useDef, (v) => ((d.useDef = v), renderFeaturePM(kind), upd())));
        if (!d.useDef) gr.appendChild(numField("Yarıçap", d.r, (v) => ((d.r = v), upd()), { min: 0.01, unit: "mm", key: `${d.id}.r` }));
        body.appendChild(gr);
        body.appendChild(
          group(
            "Kenar boyunca",
            numField("Baştan kısalt", d.o1, (v) => ((d.o1 = Math.max(0, v)), upd()), { min: 0, unit: "mm", key: `${d.id}.o1` }),
            numField("Sondan kısalt", d.o2, (v) => ((d.o2 = Math.max(0, v)), upd()), { min: 0, unit: "mm", key: `${d.id}.o2` }),
            numField("Köşe boşluğu", d.gap, (v) => ((d.gap = Math.max(0, v)), upd()), { min: 0, unit: "mm" }),
            h("p", "pm-hint", "Birlikte seçilen komşu kenarların flanşları köşede gönyelenir."),
          ),
        );
      }
      hint(d._preview ? "Önizleme açık — kenar seçmek için kapatın" : "Flanş eklenecek kenarlara dokunun");
      break;
    }
    case "sheetjog":
      body.appendChild(group("Kademe çizgisi", sketchSel(), h("p", "pm-hint", "Eskiz sacın düz yüzünde, tek bir çizgi.")));
      body.appendChild(
        group(
          "Kademe",
          numField("Kademe yüksekliği", d.H, (v) => ((d.H = v), upd()), { min: 0.1, unit: "mm", key: `${d.id}.H` }),
          checkField("Hareket eden tarafı değiştir", d.side, (v) => ((d.side = v), upd())),
          checkField("Yönü ters çevir", d.flip, (v) => ((d.flip = v), upd())),
          h("p", "pm-hint", "İki 90° bükümle ötelenmiş kademe; parçanın izdüşüm boyu korunur."),
        ),
      );
      break;
    case "miterflange": {
      const openSk = sketches.filter((x) => !extractClosed(x));
      body.appendChild(group("Profil", selectField("Profil eskizi", openSk.map((x) => ({ v: x.id, t: x.name })), d.sketch, (v) => ((d.sketch = v), upd())), h("p", "pm-hint", "Profil, ilk seçilen kenarın ucunda ve kenara dik düzlemde çizilmiş açık bir zincir olmalı (ör. L, Z, U). Tabanla arasındaki büküm otomatik eklenir.")));
      const g0 = group("Kenarlar", h("div", "pm-picks", d.edges.length ? `${d.edges.length} kenar seçili` : "Flanşın ilerleyeceği kenarlara dokunun"));
      if (d.edges.length) g0.appendChild(button("Seçimi temizle", () => ((d.edges = []), renderFeaturePM(kind), refreshHighlight())));
      g0.appendChild(checkField("Önizlemeyi göster", !!d._preview, (v) => ((d._preview = v), refreshHighlight(), rebuild())));
      body.appendChild(g0);
      body.appendChild(group("Seçenekler", checkField("Malzeme tarafını ters çevir", d.rev, (v) => ((d.rev = v), upd())), numField("Köşe boşluğu", d.gap, (v) => ((d.gap = Math.max(0, v)), upd()), { min: 0, unit: "mm" })));
      hint("Flanş kenarlarına dokunun");
      break;
    }
    case "closecorner":
      body.appendChild(
        group(
          "Köşe kapatma",
          h("div", "pm-picks", d.faces.length ? `${d.faces.length} uç yüz seçili` : "Uzatılacak flanşın köşedeki uç yüzüne dokunun"),
          segField([{ v: "under", t: "Alın (iç yüze kadar)" }, { v: "over", t: "Bindirme (dış yüze kadar)" }], d.overlap ? "over" : "under", (v) => ((d.overlap = v === "over"), upd())),
          numField("Boşluk", d.gap, (v) => ((d.gap = Math.max(0, v)), upd()), { min: 0, unit: "mm" }),
        ),
      );
      hint("Uzatılacak flanş uç yüzüne dokunun");
      break;
    case "tosheet":
      body.appendChild(
        group(
          "Sac parametreleri",
          numField("Kalınlık", d.t, (v) => ((d.t = v), upd()), { min: 0.1, unit: "mm" }),
          numField("Büküm yarıçapı (iç)", d.r, (v) => ((d.r = v), upd()), { min: 0, unit: "mm" }),
          numField("K faktörü", d.k, (v) => ((d.k = Math.max(0, Math.min(1, v))), upd()), {}),
          numField("Yarık boşluğu", d.gap, (v) => ((d.gap = Math.max(0.05, v)), upd()), { min: 0.05, unit: "mm" }),
        ),
      );
      body.appendChild(
        group(
          "Kenarlar",
          segField([{ v: "bends", t: "Büküm kenarları" }, { v: "rips", t: "Yarık kenarları" }], d._pick ?? "bends", (v) => ((d._pick = v), renderFeaturePM(kind))),
          h("div", "pm-picks", `Büküm: ${d.bends.length} · Yarık: ${d.rips.length}`),
          h("p", "pm-hint", "Sabit kalınlıklı (kabuklanmış) katıda: bükülecek dış kenarları ve kesilecek köşe kenarlarını seçin. İç kenarlar otomatik bulunur, köşelere boşaltma açılır."),
        ),
      );
      hint(d._pick === "rips" ? "Yarık açılacak köşe kenarlarına dokunun" : "Büküm olacak dış kenarlara dokunun");
      break;
    case "sketchbend": {
      body.appendChild(group("Büküm çizgisi", sketchSel(), h("p", "pm-hint", "Eskiz sacın düz yüzünde olmalı ve tek bir çizgi içermeli.")));
      body.appendChild(
        group(
          "Büküm",
          numField("Büküm açısı", d.angle, (v) => ((d.angle = v), upd()), { min: 0.1, unit: "°", key: `${d.id}.angle` }),
          selectField("Büküm konumu", [{ v: "center", t: "Büküm merkez çizgisi" }, { v: "inside", t: "Malzeme içte" }, { v: "outside", t: "Malzeme dışta" }], d.pos, (v) => ((d.pos = v), upd())),
          checkField("Bükülen tarafı değiştir", d.side, (v) => ((d.side = v), upd())),
          checkField("Büküm yönünü ters çevir", d.flip, (v) => ((d.flip = v), upd())),
        ),
      );
      const gr = group("Büküm yarıçapı", checkField("Varsayılan yarıçapı kullan", d.useDef, (v) => ((d.useDef = v), renderFeaturePM(kind), upd())));
      if (!d.useDef) gr.appendChild(numField("Yarıçap", d.r, (v) => ((d.r = v), upd()), { min: 0.01, unit: "mm", key: `${d.id}.r` }));
      body.appendChild(gr);
      break;
    }
    case "dome": {
      body.appendChild(group("Yüz", h("div", "pm-picks", d.face ? "Yüz seçili" : "Kubbe yapılacak düz yüze dokunun")));
      body.appendChild(group("Parametreler", numField("Yükseklik", d.h, (v) => ((d.h = v), upd()), { min: 0.01, unit: "mm", key: `${d.id}.h` })));
      hint("Kubbe yapılacak düz yüze dokunun");
      break;
    }
    case "wrap": {
      body.appendChild(group("Kaynak eskiz", selectField("Eskiz", sketches.map((s) => ({ v: s.id, t: s.name })), d.sketch, (v) => ((d.sketch = v), upd())), h("p", "pm-hint", "Eskiz, silindire teğet bir düzlemde olmalı (projeksiyon yöntemi).")));
      body.appendChild(
        group(
          "Sarma",
          segField([{ v: "emboss", t: "Kabartma" }, { v: "deboss", t: "Oyma" }], d.mode, (v) => ((d.mode = v as any), upd())),
          numField("Derinlik", d.depth, (v) => ((d.depth = v), upd()), { min: 0.01, unit: "mm", key: `${d.id}.depth` }),
          h("div", "pm-picks", d.face ? "Silindirik yüz seçili" : "Silindirik yüze dokunun"),
        ),
      );
      hint("Sarılacak silindirik yüze dokunun");
      break;
    }
    case "scale": {
      body.appendChild(
        group(
          "Ölçekle",
          numField("Ölçek oranı", d.factor, (v) => ((d.factor = v), upd()), { min: 0.0001, key: `${d.id}.factor` }),
          selectField("Merkez", [{ v: "origin", t: "Orijin" }, { v: "centroid", t: "Ağırlık merkezi" }], d.center, (v) => ((d.center = v), upd())),
          h("p", "pm-hint", "Tüm gövdeler düzgün ölçeklenir."),
        ),
      );
      break;
    }
    case "axis":
    case "point":
    case "csys": {
      const v3 = (label: string, arr: Vec3, cb: () => void) => {
        const row = h("div", "pm-row3");
        (["X", "Y", "Z"] as const).forEach((ax, i) => row.appendChild(numField(`${label} ${ax}`, arr[i], (v) => ((arr[i] = v), cb()), {})));
        return row;
      };
      if (d.type === "axis") {
        body.appendChild(group("Eksen", h("p", "pm-hint", "Doğrusal bir kenara (eksen kenar boyunca) veya dairesel bir kenara (silindir ekseni) dokunun."), v3("Nokta", d.p, drawRefGeom), v3("Yön", d.d, drawRefGeom)));
        const bs = h("div", "pm-buttons");
        (["x", "y", "z"] as const).forEach((a) => bs.appendChild(button(`${a.toUpperCase()} ekseni`, () => ((d.p = [0, 0, 0]), (d.d = [...AXES[a]] as Vec3), renderFeaturePM(kind), drawRefGeom()))));
        body.appendChild(bs);
      } else if (d.type === "point") {
        body.appendChild(group("Nokta", h("p", "pm-hint", "Bir kenara (orta nokta / daire merkezi) veya yüze (merkez) dokunun ya da koordinat girin."), v3("", d.p, drawRefGeom)));
      } else {
        body.appendChild(group("Koordinat sistemi", h("p", "pm-hint", "Önce başlangıç için kenar/yüze, sonra X ekseni için doğrusal bir kenara dokunun."), v3("Başlangıç", d.o, drawRefGeom)));
      }
      drawRefGeom();
      break;
    }
    case "plane": {
      body.appendChild(group("Referans", planeField("Temel düzlem / yüz", () => d.base, (r) => (d.base = r))));
      body.appendChild(
        group(
          "Öteleme",
          numField("Mesafe", d.offset, (v) => ((d.offset = v), updatePlanePreview()), { unit: "mm", key: `${d.id}.offset` }),
          checkField("Ters çevir", d.flip, (v) => ((d.flip = v), updatePlanePreview())),
        ),
      );
      updatePlanePreview();
      break;
    }
  }
}

function thinGroup(e: any, kind: string) {
  const g = group("İnce özellik", checkField("İnce özellik (açık konturda da çalışır)", !!e.thin, (v) => ((e.thin = v), renderFeaturePM(kind), schedulePreview())));
  if (e.thin) {
    g.appendChild(numField("Kalınlık", e.thinT ?? 2, (v) => ((e.thinT = v), schedulePreview()), { min: 0.01, unit: "mm", key: `${e.id}.thinT` }));
    g.appendChild(segField([{ v: "one", t: "Tek yön" }, { v: "mid", t: "Orta" }, { v: "rev", t: "Ters yön" }], e.thinMode ?? "one", (v) => ((e.thinMode = v), schedulePreview())));
  }
  return g;
}

// ---------- Referans geometri ve kozmetik diş görüntüsü ----------
let refGroup: any[] = [];
function drawRefGeom() {
  for (const o of refGroup) {
    viewer.overlay.remove(o);
    o.geometry?.dispose();
  }
  refGroup = [];
  const size = viewer.bbox ? Math.max(40, viewer.bbox.getSize(new THREE.Vector3()).length() * 0.6) : 80;
  const list = [...viewFeatures().feats];
  if (mode.k === "pm" && ["axis", "point", "csys", "hole"].includes(mode.draft.type)) list.push(mode.draft);
  for (const f of list) {
    if (f.off) continue;
    if (f.type === "axis") {
      const d = f.d, p = f.p, L = size / 2;
      refGroup.push(viewer.fatLines([p[0] - d[0] * L, p[1] - d[1] * L, p[2] - d[2] * L, p[0] + d[0] * L, p[1] + d[1] * L, p[2] + d[2] * L], 0x2b7de9, 1.5, true));
    } else if (f.type === "point") {
      const s = size / 60;
      const p = f.p;
      refGroup.push(viewer.fatLines([p[0] - s, p[1], p[2], p[0] + s, p[1], p[2], p[0], p[1] - s, p[2], p[0], p[1] + s, p[2], p[0], p[1], p[2] - s, p[0], p[1], p[2] + s], 0x2b7de9, 2.5));
    } else if (f.type === "csys") {
      const L = size / 6;
      const z: Vec3 = [f.x[1] * f.y[2] - f.x[2] * f.y[1], f.x[2] * f.y[0] - f.x[0] * f.y[2], f.x[0] * f.y[1] - f.x[1] * f.y[0]];
      const o = f.o;
      [[f.x, 0xd33f3f], [f.y, 0x2f9e44], [z, 0x1c7ed6]].forEach(([v, c]) => {
        const a = v as Vec3;
        refGroup.push(viewer.fatLines([o[0], o[1], o[2], o[0] + a[0] * L, o[1] + a[1] * L, o[2] + a[2] * L], c as number, 2.5));
      });
    } else if (f.type === "hole" && f.cosmetic && f.htype === "tap" && f.plane) {
      const dia = threadMajor(f.std ?? "iso", f.size) ?? f.d * 1.2;
      const fr = resolveFrame(f.plane, doc.features);
      if (!fr) continue;
      const segs: number[] = [];
      for (const p of f.pts)
        for (let i = 0; i < 48; i++) {
          const a0 = (i / 48) * Math.PI * 2, a1 = ((i + 1) / 48) * Math.PI * 2;
          segs.push(...toWorld(fr, [p[0] + (dia / 2) * Math.cos(a0), p[1] + (dia / 2) * Math.sin(a0)]), ...toWorld(fr, [p[0] + (dia / 2) * Math.cos(a1), p[1] + (dia / 2) * Math.sin(a1)]));
        }
      if (segs.length) refGroup.push(viewer.fatLines(segs, 0x2f9e44, 1.2, true));
    }
  }
  refGroup.forEach((o) => viewer.overlay.add(o));
  viewer.requestRender();
}

// ---------- Denklemler penceresi ----------
function openEquations() {
  const dlg = h("dialog");
  dlg.innerHTML = `<h2>Global Değişkenler ve Denklemler</h2><p class="small">Ölçü ve özellik alanlarına <b>=ad</b> veya <b>=L/2+5</b> gibi ifadeler yazabilirsiniz. Fonksiyonlar: sin, cos, tan (derece), sqrt, abs, pi.</p>`;
  const table = h("div", "eq-table");
  const vars = { ...(doc.vars ?? {}) };
  const render = () => {
    table.innerHTML = "";
    for (const [name, ex] of Object.entries(vars)) {
      const row = h("div", "eq-row");
      const n = h("input");
      n.value = name;
      const e = h("input");
      e.value = ex;
      const val = h("span", "eq-val", "");
      const upd = () => {
        const v = evalNum(e.value, (x) => (x === name ? undefined : evalNum(vars[x] ?? "") ?? undefined));
        val.textContent = v === null ? "?" : fmtNum(v, 4);
      };
      n.addEventListener("change", () => {
        const nn = n.value.trim();
        if (!/^[A-Za-zçğıöşüÇĞİÖŞÜ_][A-Za-z0-9çğıöşüÇĞİÖŞÜ_]*$/.test(nn)) return (n.value = name);
        delete vars[name];
        vars[nn] = e.value;
        render();
      });
      e.addEventListener("input", () => ((vars[name] = e.value), upd()));
      [n, e].forEach((x) => x.addEventListener("keydown", (ev) => ev.stopPropagation()));
      const del = button("✕", () => (delete vars[name], render()), "btn danger");
      row.append(n, h("span", "", "="), e, val, del);
      table.appendChild(row);
      upd();
    }
  };
  render();
  dlg.appendChild(table);
  const linked = Object.keys(doc.eqs ?? {}).length + doc.features.reduce((s, f) => s + (f.type === "sketch" ? f.data.dims.filter((d) => d.expr).length : 0), 0);
  dlg.appendChild(h("p", "small", `Bağlı alan / ölçü sayısı: ${linked}`));
  const add = button("+ Değişken ekle", () => {
    let i = 1;
    while (vars[`d${i}`] !== undefined) i++;
    vars[`d${i}`] = "10";
    render();
  });
  const form = h("form");
  form.method = "dialog";
  form.innerHTML = `<button class="btn" value="cancel">İptal</button> <button class="btn primary" value="ok">Uygula</button>`;
  dlg.append(add, form);
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => {
    if (dlg.returnValue === "ok") {
      commitDoc(() => {
        doc.vars = vars;
        const errs = applyEquations();
        if (errs.length) toast(errs[0], true);
      });
    }
    dlg.remove();
  });
  (dlg as HTMLDialogElement).showModal();
}

/** Silindir yarıçapına göre metrik kaba hatve */
function threadPitchFor(r: number) {
  const d = 2 * r;
  const sizes = Object.entries(METRIC_PITCH).map(([k, p]) => [parseFloat(k.slice(1)), p] as [number, number]);
  let best = sizes[0];
  for (const s of sizes) if (Math.abs(s[0] - d) < Math.abs(best[0] - d)) best = s;
  return best[1];
}

async function checkInterference() {
  if (!viewer.mesh) return toast("Model yok", true);
  setStatus("busy", "Girişim kontrol ediliyor…");
  const pairs = await kernel.interfere();
  setStatus("ok", "Hazır");
  if (!pairs.length) return toast((viewer.mesh.bodies ?? 1) > 1 ? "Gövdeler arasında girişim yok" : "Tek gövde var; girişim yok");
  const m = viewer.mesh;
  const bs = new Set(pairs.flatMap((p) => [p.a, p.b]));
  viewer.setHighlight({ faces: m.faces.map((f, i) => (f.b !== undefined && bs.has(f.b) ? i : -1)).filter((i) => i >= 0), edges: [], planes: [] }, null);
  toast(`${pairs.length} girişim: ` + pairs.map((p) => `Gövde ${p.a + 1} ↔ ${p.b + 1} (${fmtNum(p.vol / 1000, 2)} cm³)`).join(", "), true);
}

// ---------- 3B eskiz yardımcıları ----------
function s3Add(f: any, p: Vec3) {
  const pid = `p${f.seq++}`;
  const prev = f._act ?? f.xyz.length - 1;
  f.ids.push(pid);
  f.xyz.push([Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000, Math.round(p[2] * 1000) / 1000]);
  if (f._link !== false && prev >= 0 && f.ids[prev]) f.lines.push({ id: `l${f.seq++}`, a: f.ids[prev], b: pid });
  f._act = f.xyz.length - 1;
  renderFeaturePM("sketch3d");
  drawSketches();
  schedulePreview();
}
/** Dokunulan noktayı yakın köşe / nokta / daire merkezine yakalar */
function snapPoint(p: Vec3): Vec3 {
  const tol = viewer.worldPerPixel() * 14;
  const cands: Vec3[] = [];
  const m = viewer.mesh;
  if (m) for (const e of m.edges) cands.push(e.s, e.e, ...(e.c ? [e.c] : []));
  for (const f of doc.features) if (f.type === "sketch3d") cands.push(...f.xyz);
  if (mode.k === "pm" && mode.draft.type === "sketch3d") cands.push(...mode.draft.xyz);
  for (const f of doc.features) {
    if (f.type !== "sketch") continue;
    const fr = resolveFrame(f.plane, doc.features);
    if (!fr) continue;
    for (const e of f.data.ents) {
      const ids = e.t === "line" ? [e.p1, e.p2] : e.t === "arc" ? [e.s, e.e, e.c] : e.t === "circle" ? [e.c] : e.t === "point" ? [e.p] : [];
      for (const id of ids) cands.push(toWorld(fr, pointPos(f.data, id)));
    }
  }
  let best: Vec3 | null = null, bd = tol;
  for (const c of cands) {
    const d = dist3(c, p);
    if (d < bd) [bd, best] = [d, c];
  }
  return best ? [...best] as Vec3 : [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10, Math.round(p[2] * 10) / 10];
}

// ---------- Kaynaklı yapı: kesim listesi ----------
interface CutRow { no: number; qty: number; name: string; length: number; a1: number; a2: number; kg: number; bodies: number[]; kind: string; dims: [number, number, number] }
let lastWelds: import("./doc/types").WeldItem[] = [];
async function cutRows(): Promise<CutRow[]> {
  const { items, welds } = await kernel.cutListFull();
  lastWelds = welds;
  const rho = MATERIALS[doc.material ?? "steel"]?.rho ?? 7.85;
  const groups = new Map<string, CutRow>();
  for (const it of items) {
    const [p, q] = [it.a1, it.a2].map((x) => Math.round(x * 10) / 10).sort((x, y) => x - y);
    const key = it.kind === "member" ? `${it.name}|${Math.round(it.length * 10)}|${p}|${q}|${Math.round(it.vol / 50)}` : `${it.name}|${it.dims.map((x) => Math.round(x * 10)).join("x")}|${Math.round(it.vol / 100)}`;
    const g = groups.get(key);
    if (g) {
      g.qty++;
      g.bodies.push(it.body);
    } else groups.set(key, { no: 0, qty: 1, name: it.name, length: it.length, a1: p, a2: q, kg: (it.vol * rho) / 1e6, bodies: [it.body], kind: it.kind, dims: it.dims });
  }
  const rows = [...groups.values()].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, "tr") || b.length - a.length : a.kind === "member" ? -1 : 1));
  rows.forEach((r, i) => (r.no = i + 1));
  return rows;
}
const rowDesc = (r: CutRow) => (r.kind === "member" ? r.name : `${r.name} · ${fmtNum(r.dims[0], 1)} × ${fmtNum(r.dims[1], 1)}`);
async function openDrawings(rows: CutRow[]) {
  setStatus("busy", "İmalat resimleri hazırlanıyor…");
  const mat = MATERIALS[doc.material ?? "steel"]?.name ?? "-";
  const date = new Date().toLocaleDateString("tr-TR");
  const sheets: string[] = [];
  let plate: { name: string; dxf: string } | null = null;
  for (const r of rows) {
    const d = await kernel.drawing(r.bodies[0]);
    if (d.error || !d.views.length) {
      toast(`${r.no}. kalem: ${d.error ?? "görünüş üretilemedi"}`, true);
      continue;
    }
    const info: SheetInfo = { project: doc.name, no: r.no, qty: r.qty, desc: rowDesc(r), material: mat, kg: r.kg, a1: r.a1, a2: r.a2, length: d.length || r.length, date };
    sheets.push(sheetSvg(d, info));
    if (rows.length === 1 && d.kind === "plate") plate = { name: `${doc.name}_${r.no}_levha.dxf`, dxf: plateDxf(d.views[0]) };
  }
  setStatus("ok", "Hazır");
  if (!sheets.length) return;
  const html = sheetsHtml(sheets, `${doc.name} imalat resimleri`);
  const dlg = h("dialog", "cut-dialog draw-dialog");
  dlg.innerHTML = `<h2>İmalat resmi${rows.length > 1 ? `leri (${sheets.length} sayfa)` : ` — ${rows[0].no}. kalem`}</h2>`;
  const fr = h("iframe", "draw-frame") as HTMLIFrameElement;
  fr.srcdoc = html;
  dlg.appendChild(fr);
  const bar = h("div", "cut-bar");
  const left = h("div", "pm-row");
  left.append(
    button("Yazdır / PDF", () => fr.contentWindow?.print(), "btn primary"),
    button("HTML indir", () => download(new Blob([html], { type: "text/html" }), `${doc.name}_imalat_resimleri.html`), "btn"),
  );
  if (sheets.length === 1) left.appendChild(button("SVG indir", () => download(new Blob([sheets[0]], { type: "image/svg+xml" }), `${doc.name}_${rows[0].no}.svg`), "btn"));
  if (plate) left.appendChild(button("Levha DXF (1:1)", () => download(new Blob([plate!.dxf], { type: "application/dxf" }), plate!.name), "btn"));
  const form = h("form");
  form.method = "dialog";
  form.innerHTML = `<button class="btn" value="ok">Kapat</button>`;
  bar.append(left, form);
  dlg.appendChild(bar);
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  (dlg as HTMLDialogElement).showModal();
}

async function openCutList() {
  if (mode.k === "pm") return toast("Önce açık özelliği tamamlayın (✓ veya ✕)");
  if (mode.k === "sketch") exitSketch(true);
  if (!viewer.mesh) return toast("Listelenecek gövde yok", true);
  setStatus("busy", "Kesim listesi hazırlanıyor…");
  const rows = await cutRows();
  setStatus("ok", "Hazır");
  const dlg = h("dialog", "cut-dialog");
  const mat = MATERIALS[doc.material ?? "steel"];
  dlg.innerHTML = `<h2>Kesim Listesi — ${doc.name}</h2><p class="small">Malzeme: ${mat?.name ?? "-"} · Aynı profil, boy ve açılar gruplanır. Açı 0° = dik kesim, 45° = gönye.</p>`;
  const wrap = h("div", "cut-wrap");
  const tbl = h("table", "cut-table");
  const head = h("tr");
  ["No", "Adet", "Tanım", "Boy (mm)", "Açı 1", "Açı 2", "Birim kg", "Toplam kg", ""].forEach((x) => head.appendChild(h("th", "", x)));
  tbl.appendChild(head);
  let total = 0, totalLen = new Map<string, number>();
  for (const r of rows) {
    const tr = h("tr");
    const st = button("STEP", async () => {
      const res = await kernel.exportBody(r.bodies[0]);
      if (!res.blob) return toast(res.message ?? "Dışa aktarılamadı", true);
      download(res.blob, `${doc.name}_${r.no}_${r.name.replace(/[^A-Za-z0-9çğıöşüÇĞİÖŞÜ.x-]+/g, "_")}_${Math.round(r.length)}.step`);
    }, "btn");
    tr.append(
      h("td", "", String(r.no)),
      h("td", "", String(r.qty)),
      h("td", "", rowDesc(r)),
      h("td", "num", fmtNum(r.length, 1)),
      h("td", "num", r.kind === "member" ? `${fmtNum(r.a1, 1)}°` : "-"),
      h("td", "num", r.kind === "member" ? `${fmtNum(r.a2, 1)}°` : "-"),
      h("td", "num", fmtNum(r.kg, 2)),
      h("td", "num", fmtNum(r.kg * r.qty, 2)),
    );
    const td = h("td");
    td.append(button("Resim", () => openDrawings([r]), "btn"), st);
    tr.appendChild(td);
    tr.addEventListener("click", (ev) => {
      if ((ev.target as HTMLElement).tagName === "BUTTON") return;
      const m = viewer.mesh;
      if (!m) return;
      const bs = new Set(r.bodies);
      viewer.setHighlight({ faces: m.faces.map((f, i) => (f.b !== undefined && bs.has(f.b) ? i : -1)).filter((i) => i >= 0), edges: [], planes: [] }, null);
      tbl.querySelectorAll("tr").forEach((x) => x.classList.remove("sel"));
      tr.classList.add("sel");
    });
    tbl.appendChild(tr);
    total += r.kg * r.qty;
    if (r.kind === "member") totalLen.set(r.name, (totalLen.get(r.name) ?? 0) + r.length * r.qty);
  }
  wrap.appendChild(tbl);
  dlg.appendChild(wrap);
  if (lastWelds.length) {
    const wt = h("table", "cut-table");
    const hd = h("tr");
    ["Kaynak", "a (mm)", "Dikiş adedi", "Toplam boy (mm)", "Kaynak metali kg"].forEach((x) => hd.appendChild(h("th", "", x)));
    wt.appendChild(hd);
    for (const w of lastWelds) {
      const tr = h("tr");
      tr.append(h("td", "", w.name), h("td", "num", fmtNum(w.a, 1)), h("td", "num", String(w.count)), h("td", "num", fmtNum(w.length, 1)), h("td", "num", fmtNum((w.vol * 7.85) / 1e6, 3)));
      wt.appendChild(tr);
    }
    const ww = h("div", "cut-wrap");
    ww.appendChild(wt);
    dlg.appendChild(h("h3", "", "Kaynak tablosu"));
    dlg.appendChild(ww);
  }
  const sum = [...totalLen].map(([n, L]) => `${n}: ${fmtNum(L / 1000, 2)} m`).join(" · ");
  dlg.appendChild(h("p", "small", `Toplam ağırlık: ${fmtNum(total, 2)} kg${sum ? " · Profil toplam boyları — " + sum : ""}`));
  const csv = button("CSV (Excel) indir", () => {
    const L = [["No", "Adet", "Tanım", "Boy (mm)", "Açı 1 (°)", "Açı 2 (°)", "Birim kg", "Toplam kg"].join(";")];
    for (const r of rows) L.push([r.no, r.qty, rowDesc(r), fmtNum(r.length, 1), r.kind === "member" ? fmtNum(r.a1, 1) : "", r.kind === "member" ? fmtNum(r.a2, 1) : "", fmtNum(r.kg, 3), fmtNum(r.kg * r.qty, 3)].join(";"));
    L.push(`;;;;;;Toplam;${fmtNum(total, 3)}`);
    if (lastWelds.length) {
      L.push("", ["Kaynak", "a (mm)", "Dikiş adedi", "Toplam boy (mm)", "Kaynak metali kg"].join(";"));
      for (const w of lastWelds) L.push([w.name, fmtNum(w.a, 1), w.count, fmtNum(w.length, 1), fmtNum((w.vol * 7.85) / 1e6, 3)].join(";"));
    }
    download(new Blob(["\ufeff" + L.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${doc.name}_kesim_listesi.csv`);
  }, "btn");
  const form = h("form");
  form.method = "dialog";
  form.innerHTML = `<button class="btn primary" value="ok">Kapat</button>`;
  const bar = h("div", "cut-bar");
  const allDw = button("Tüm imalat resimleri", () => openDrawings(rows), "btn");
  const left = h("div", "pm-row");
  left.append(csv, allDw);
  bar.append(left, form);
  dlg.appendChild(bar);
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => (dlg.remove(), refreshHighlight()));
  (dlg as HTMLDialogElement).showModal();
}

async function importStep() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".step,.stp,.STEP,.STP";
  inp.onchange = async () => {
    const file = inp.files?.[0];
    if (!file) return;
    const text = await file.text();
    if (text.length > 4e6) toast("Büyük dosya: tarayıcı kaydına sığmayabilir; .icad olarak kaydedin", true);
    const f: Feature = { id: uid(), type: "import", name: file.name.replace(/\.(step|stp)$/i, ""), file: file.name, data: text };
    commitDoc(() => insertFeature(f));
    firstBuild = true;
  };
  inp.click();
}

function updatePlanePreview() {
  if (mode.k !== "pm" || mode.draft.type !== "plane") return;
  const d = mode.draft;
  updatePlanes();
  const base = resolveFrame(d.base, doc.features);
  if (!base) return;
  const n = d.flip ? -1 : 1;
  const fr = { o: [base.o[0] + base.n[0] * d.offset, base.o[1] + base.n[1] * d.offset, base.o[2] + base.n[2] * d.offset] as Vec3, x: base.x.map((v) => v * n) as Vec3, n: base.n.map((v) => v * n) as Vec3 };
  const list = (["front", "top", "right"] as StdPlane[]).map((k) => ({ id: k, frame: STD_FRAMES[k], label: STD_NAMES[k] }));
  doc.features.forEach((f) => {
    if (f.type === "plane" && f.id !== d.id) {
      const r = resolveFrame({ k: "ref", id: f.id }, doc.features);
      if (r) list.push({ id: f.id, frame: r, label: f.name } as any);
    }
  });
  list.push({ id: "__draft", frame: fr, label: "Yeni düzlem" } as any);
  viewer.setPlanes(list);
  viewer.setHighlight({ faces: [], edges: [], planes: ["__draft"] }, null);
}

function pmPick(hit: PickHit | null, ev?: PointerEvent) {
  if (mode.k !== "pm" || !hit) return;
  const d = mode.draft as any;
  const kind = kindOf(mode.draft);
  const m = viewer.mesh;
  if ((d.type === "fillet" || d.type === "chamfer") && hit.kind === "edge" && m) {
    const e = m.edges[hit.index];
    const i = d.edges.findIndex((r: EdgeRef) => dist3(r.m, e.m) < 1e-3);
    if (i >= 0) d.edges.splice(i, 1);
    else d.edges.push({ m: e.m, d: e.d });
  } else if ((d.type === "fillet" || d.type === "chamfer") && hit.kind === "face" && m) {
    const f = m.faces[hit.index];
    d.faces = d.faces ?? [];
    const i = d.faces.findIndex((r: FaceRef) => dist3(r.c, f.c) < 1e-3);
    if (i >= 0) d.faces.splice(i, 1);
    else d.faces.push({ c: f.c, n: f.n });
  } else if (d.type === "sketch3d") {
    s3Add(d, snapPoint(hit.point));
    return;
  } else if (["combine", "movebody", "delbody", "indent", "splitbody", "flex"].includes(d.type) && hit.kind === "face" && m && !(d.type === "splitbody" && d._pick === "plane")) {
    const r = faceRef(hit.index);
    const sameBody = (x: FaceRef | null) => !!x && m.faces[nearestFace(x)]?.b === m.faces[hit.index].b;
    if (d.type === "combine") {
      if (d._pick === "main") {
        d.main = r;
        d.tools = d.tools.filter((x: FaceRef) => !sameBody(x));
        d._pick = "tools";
      } else {
        if (sameBody(d.main)) return toast("Bu ana gövde; araç olarak başka bir gövde seçin", true);
        const k = d.tools.findIndex((x: FaceRef) => sameBody(x));
        if (k >= 0) d.tools.splice(k, 1);
        else d.tools.push(r);
      }
    } else if (d.type === "delbody") {
      const k = d.bodies.findIndex((x: FaceRef) => sameBody(x));
      if (k >= 0) d.bodies.splice(k, 1);
      else d.bodies.push(r);
    } else if (d.type === "indent") {
      if (d._pick === "target") (d.target = r), (d._pick = "tool");
      else d.tool = r;
    } else d.body = r;
    schedulePreview();
  } else if (d.type === "splitbody" && d._pick === "plane") {
    const ref = planeRefFromHit(hit);
    if (!ref) return toast("Düzlemsel bir yüz veya düzlem seçin", true);
    d.plane = ref;
    schedulePreview();
  } else if (d.type === "fpattern" && hit.kind === "face" && m) {
    if (!m.faces[hit.index].n) return toast("Düz bir yüz seçin", true);
    d.face = faceRef(hit.index);
    schedulePreview();
  } else if (d.type === "thread" && hit.kind === "face" && m) {
    const fc = m.faces[hit.index];
    if (fc.type !== "CYLINDRE") return toast("Silindirik bir yüz (mil veya delik) seçin", true);
    d.face = faceRef(hit.index);
    if (fc.r) d.pitch = threadPitchFor(fc.r);
    schedulePreview();
  } else if (d.type === "vchamfer" && hit.kind === "edge" && m) {
    const e = m.edges[hit.index];
    d.v = dist3(e.s, hit.point) <= dist3(e.e, hit.point) ? e.s : e.e;
    schedulePreview();
  } else if (d.type === "weld" && hit.kind === "face" && m) {
    const fc = m.faces[hit.index];
    if (!fc.n && fc.type !== "CYLINDRE") return toast("Düz yüz veya boru yüzeyi seçin", true);
    const r = faceRef(hit.index);
    if (!d._p1) d._p1 = r;
    else {
      if (dist3(d._p1.c, r.c) < 1e-6) return;
      d.pairs.push({ f1: d._p1, f2: r });
      d._p1 = null;
      schedulePreview();
    }
  } else if (d.type === "trim" && hit.kind === "face" && m) {
    const b = m.faces[hit.index].b;
    const mb = memberBodies.find((x) => x.body === b);
    if (!mb) {
      const fc = m.faces[hit.index];
      if (d._pick !== "bounds" || !fc.n) return toast(d._pick === "bounds" ? "Bir yapı elemanına veya düz bir yüze dokunun" : "Bir yapı elemanına dokunun", true);
      d.faces = d.faces ?? [];
      const k = d.faces.findIndex((r: FaceRef) => dist3(r.c, fc.c) < 1e-3);
      if (k >= 0) d.faces.splice(k, 1);
      else d.faces.push({ c: fc.c, n: fc.n });
      schedulePreview();
      renderFeaturePM(kind);
      refreshHighlight();
      return;
    }
    const [f, i] = [mb.key.slice(0, mb.key.lastIndexOf(":")), parseInt(mb.key.slice(mb.key.lastIndexOf(":") + 1))];
    const list = d._pick === "bounds" ? d.bounds : d.targets;
    const other = d._pick === "bounds" ? d.targets : d.bounds;
    const oi = other.findIndex((r: any) => r.f === f && r.i === i);
    if (oi >= 0) other.splice(oi, 1);
    const k = list.findIndex((r: any) => r.f === f && r.i === i);
    if (k >= 0) list.splice(k, 1);
    else list.push({ f, i });
    schedulePreview();
  } else if (d.type === "endcap" && hit.kind === "face" && m) {
    const fc = m.faces[hit.index];
    if (!fc.n) return toast("Elemanın düz uç yüzünü seçin", true);
    const k = d.faces.findIndex((r: FaceRef) => dist3(r.c, fc.c) < 1e-3);
    if (k >= 0) d.faces.splice(k, 1);
    else d.faces.push({ c: fc.c, n: fc.n });
    schedulePreview();
  } else if (d.type === "gusset" && hit.kind === "face" && m) {
    const fc = m.faces[hit.index];
    if (!fc.n) return toast("Düz bir yüz seçin", true);
    const r = { c: fc.c, n: fc.n };
    if (!d.f1) d.f1 = r;
    else if (!d.f2) d.f2 = r;
    else [d.f1, d.f2] = [d.f2, r];
    schedulePreview();
  } else if (d.type === "tosheet" && hit.kind === "edge" && m) {
    const e = m.edges[hit.index];
    if (e.type !== "LINE") return toast("Düz bir kenar seçin", true);
    const list = d._pick === "rips" ? d.rips : d.bends;
    const other = d._pick === "rips" ? d.bends : d.rips;
    const oi = other.findIndex((r: EdgeRef) => dist3(r.m, e.m) < 1e-3);
    if (oi >= 0) other.splice(oi, 1);
    const k = list.findIndex((r: EdgeRef) => dist3(r.m, e.m) < 1e-3);
    if (k >= 0) list.splice(k, 1);
    else list.push({ m: e.m, d: e.d });
  } else if (d.type === "closecorner" && hit.kind === "face" && m) {
    const fc = m.faces[hit.index];
    if (!fc.n) return toast("Flanşın düz uç yüzünü seçin", true);
    const k = d.faces.findIndex((r: FaceRef) => dist3(r.c, fc.c) < 1e-3);
    if (k >= 0) d.faces.splice(k, 1);
    else d.faces.push(faceRef(hit.index));
    schedulePreview();
  } else if ((d.type === "edgeflange" || d.type === "hem" || d.type === "miterflange") && hit.kind === "edge" && m) {
    if (d._preview) return toast("Kenar seçmek için önizlemeyi kapatın", true);
    const e = m.edges[hit.index];
    if (e.type !== "LINE") return toast("Flanş için düz bir kenar seçin", true);
    const i = d.edges.findIndex((r: EdgeRef) => dist3(r.m, e.m) < 1e-3);
    if (i >= 0) d.edges.splice(i, 1);
    else d.edges.push({ m: e.m, d: e.d });
  } else if (d.type === "extrude" && hit.kind === "face" && m) {
    const f = m.faces[hit.index];
    if (!f.n) return toast("Düz bir yüz seçin", true);
    d.face = { c: f.c, n: f.n };
    schedulePreview();
  } else if (d.type === "hole" && hit.kind === "face" && m) {
    const f = m.faces[hit.index];
    if (!d.plane) {
      if (!f.n) return toast("Delik için düz bir yüz seçin", true);
      d.plane = { k: "face", frame: frameFromNormal(f.c, f.n), label: "Yüz", face: { c: f.c, n: f.n } };
    }
    const fr = d.plane.frame;
    const w = ev ? viewer.pickFrame(ev.clientX, ev.clientY, fr) : null;
    const lp: Vec2 = w ? toLocal(fr, [w.x, w.y, w.z]) : toLocal(fr, hit.point);
    d.pts.push([Math.round(lp[0] * 10) / 10, Math.round(lp[1] * 10) / 10]);
    schedulePreview();
  } else if (d.type === "dome" && hit.kind === "face" && m) {
    const f = m.faces[hit.index];
    if (!f.n) return toast("Kubbe için düz bir yüz seçin", true);
    d.face = { c: f.c, n: f.n };
    schedulePreview();
  } else if (d.type === "wrap" && hit.kind === "face" && m) {
    const f = m.faces[hit.index];
    if (f.type !== "CYLINDRE") return toast("Sarma için silindirik bir yüz seçin", true);
    d.face = { c: f.c, n: f.n };
    schedulePreview();
  } else if (d.type === "axis" && hit.kind === "edge" && m) {
    const e = m.edges[hit.index];
    if (e.d) [d.p, d.d] = [e.m, e.d];
    else if (e.c && e.ax) [d.p, d.d] = [e.c, e.ax];
    else return toast("Doğrusal veya dairesel bir kenar seçin", true);
    drawRefGeom();
  } else if ((d.type === "point" || d.type === "csys") && m) {
    let p: Vec3;
    if (hit.kind === "edge") {
      const e = m.edges[hit.index];
      if (d.type === "csys" && e.d && d._origin) {
        d.x = e.d;
        const up: Vec3 = Math.abs(e.d[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
        const z: Vec3 = [e.d[1] * up[2] - e.d[2] * up[1], e.d[2] * up[0] - e.d[0] * up[2], e.d[0] * up[1] - e.d[1] * up[0]];
        d.y = [z[1] * e.d[2] - z[2] * e.d[1], z[2] * e.d[0] - z[0] * e.d[2], z[0] * e.d[1] - z[1] * e.d[0]];
        drawRefGeom();
        renderFeaturePM(kind);
        return;
      }
      p = e.c ?? e.m;
    } else if (hit.kind === "face") p = m.faces[hit.index].c;
    else return;
    if (d.type === "point") d.p = p;
    else {
      d.o = p;
      d._origin = true;
    }
    drawRefGeom();
  } else if (d.type === "fillet" && d.kind === "full" && hit.kind === "face" && m) {
    const f = m.faces[hit.index];
    d.faces = [{ c: f.c, n: f.n }];
  } else if (d.type === "draft" && hit.kind === "face" && m) {
    const f = m.faces[hit.index];
    const i = d.faces.findIndex((r: FaceRef) => dist3(r.c, f.c) < 1e-3);
    if (i >= 0) d.faces.splice(i, 1);
    else d.faces.push({ c: f.c, n: f.n });
  } else if (d.type === "shell" && hit.kind === "face" && m) {
    const f = m.faces[hit.index];
    const i = d.faces.findIndex((r: FaceRef) => dist3(r.c, f.c) < 1e-3);
    if (i >= 0) d.faces.splice(i, 1);
    else d.faces.push({ c: f.c, n: f.n });
  } else if (d.type === "mirror" || d.type === "plane") {
    const ref = planeRefFromHit(hit);
    if (!ref) return toast("Düzlemsel bir yüz veya düzlem seçin", true);
    if (d.type === "mirror") d.plane = ref;
    else d.base = ref;
    schedulePreview();
  } else return;
  renderFeaturePM(kind);
  refreshHighlight();
}

// =====================================================================
// Değerlendir: ölç, kütle özellikleri, kesit, malzeme
// =====================================================================
/** Ölçme / kesit gibi yardımcı modları kapat */
function endAux() {
  if (mode.k === "flat") {
    leaveFlat();
    rebuild();
    return;
  }
  if (mode.k === "measure" || mode.k === "section") {
    mode = { k: "part" };
    hidePM();
    refreshHighlight();
  }
}

function startMeasure() {
  if (mode.k === "measure") return endAux(), renderCommands();
  if (mode.k === "sketch") exitSketch(true);
  if (mode.k === "pm") return toast("Önce açık özelliği tamamlayın (✓ veya ✕)");
  endAux();
  clearPartSel();
  mode = { k: "measure", items: [] };
  showPM("Ölç", () => (endAux(), renderCommands()), () => (endAux(), renderCommands()));
  renderMeasurePanel([]);
  hint("Ölçmek için bir veya iki kenara / yüze dokunun");
}

function measurePick(hit: PickHit | null) {
  if (mode.k !== "measure" || !viewer.mesh) return;
  if (!hit || (hit.kind !== "face" && hit.kind !== "edge")) {
    mode.items = [];
  } else {
    const it: MeasureItem =
      hit.kind === "edge"
        ? { k: "edge", ref: { m: viewer.mesh.edges[hit.index].m, d: viewer.mesh.edges[hit.index].d } }
        : { k: "face", ref: { c: viewer.mesh.faces[hit.index].c, n: viewer.mesh.faces[hit.index].n } };
    if (mode.items.length >= 2) mode.items = [];
    mode.items.push(it);
  }
  refreshHighlight();
  const items = mode.items;
  if (!items.length) return renderMeasurePanel([]);
  kernel.measure(items).then((lines) => mode.k === "measure" && renderMeasurePanel(lines));
}

function renderMeasurePanel(lines: string[]) {
  const body = $("#pm-body");
  body.innerHTML = "";
  body.appendChild(h("p", "pm-hint", "Bir öğe: uzunluk, çap, alan. İki öğe: en kısa mesafe ve açı. Üçüncü dokunuş yeni ölçüme başlar."));
  if (lines.length) {
    const box = h("div", "pm-result");
    lines.forEach((l) => box.appendChild(h("div", "", l)));
    body.appendChild(box);
  }
}

async function showMassProps() {
  if (mode.k === "sketch") exitSketch(true);
  const p = await kernel.props();
  if (!p) return toast("Kütle özellikleri için bir katı gerekir", true);
  const mat = MATERIALS[doc.material ?? "steel"];
  const mass = (p.volume / 1000) * mat.rho; // g
  const f = (v: number, d = 2) => fmtNum(v, d);
  const size = p.bbox.max.map((v, i) => v - p.bbox.min[i]);
  const dlg = h("dialog");
  dlg.innerHTML = `<h2>Kütle Özellikleri</h2>
    <p class="small">Malzeme: <b>${mat.name}</b> (${f(mat.rho)} g/cm³)</p>
    <div class="pm-result">
      <div>Kütle: <b>${mass >= 1000 ? f(mass / 1000, 3) + " kg" : f(mass, 1) + " g"}</b></div>
      <div>Hacim: ${f(p.volume, 1)} mm³ (${f(p.volume / 1000, 2)} cm³)</div>
      <div>Yüzey alanı: ${f(p.area, 1)} mm²</div>
      <div>Ağırlık merkezi: X ${f(p.com[0])} · Y ${f(p.com[1])} · Z ${f(p.com[2])} mm</div>
      <div>Sınır kutusu: ${f(size[0], 1)} × ${f(size[1], 1)} × ${f(size[2], 1)} mm</div>
    </div>
    <form method="dialog"><button class="btn">Malzeme değiştir</button> <button class="btn primary" value="ok">Kapat</button></form>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => {
    const v = dlg.returnValue;
    dlg.remove();
    if (v !== "ok") chooseMaterial();
  });
  (dlg as HTMLDialogElement).showModal();
}

function chooseMaterial() {
  const dlg = h("dialog");
  dlg.innerHTML = `<h2>Malzeme</h2><p class="small">Kütle hesabında kullanılır.</p>`;
  const list = h("div", "pm-feats");
  for (const [k, m] of Object.entries(MATERIALS)) {
    const l = h("label");
    const r = document.createElement("input");
    r.type = "radio";
    r.name = "mat";
    r.value = k;
    r.checked = (doc.material ?? "steel") === k;
    l.append(r, document.createTextNode(`${m.name} — ${fmtNum(m.rho, 2)} g/cm³`));
    list.appendChild(l);
  }
  dlg.appendChild(list);
  const form = h("form");
  form.method = "dialog";
  form.innerHTML = `<button class="btn" value="cancel">İptal</button> <button class="btn primary" value="ok">Tamam</button>`;
  dlg.appendChild(form);
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => {
    if (dlg.returnValue === "ok") {
      const v = (dlg.querySelector("input[name=mat]:checked") as HTMLInputElement)?.value;
      if (v && v !== doc.material) {
        commitDoc(() => (doc.material = v));
        toast(`Malzeme: ${MATERIALS[v].name}`);
      }
    }
    dlg.remove();
  });
  (dlg as HTMLDialogElement).showModal();
}

let section: { plane: StdPlane; off: number; flip: boolean } | null = null;
function applySection() {
  if (!section) return viewer.setClip(null);
  const f = STD_FRAMES[section.plane];
  viewer.setClip({ o: f.n.map((v) => v * section!.off) as Vec3, x: f.x, n: f.n }, section.flip);
}
// ---------- Sac metal: düz desen ----------
let flatLines: any[] = [];
let flatBodyIdx = 0;
function clearFlatLines() {
  for (const o of flatLines) {
    viewer.overlay.remove(o);
    o.geometry?.dispose();
  }
  flatLines = [];
  viewer.requestRender();
}
function leaveFlat() {
  if (mode.k !== "flat") return;
  clearFlatLines();
  mode = { k: "part" };
  hidePM();
  renderCommands();
}
async function computeFlat(bodyIdx: number): Promise<FlatResult | null> {
  const sb = lastSheetBase(viewFeatures().feats);
  if (!sb) {
    toast("Önce bir taban flanş oluşturun", true);
    return null;
  }
  setStatus("busy", "Açınım hesaplanıyor…");
  const res = await kernel.flat(bodyIdx, sb.t, sb.k);
  setStatus("ok", "Hazır");
  if (res.error) {
    toast(res.error, true);
    return null;
  }
  return res;
}
async function openFlat() {
  if (mode.k === "sketch") exitSketch(true);
  if (mode.k === "pm") return toast("Önce açık özelliği tamamlayın (✓ veya ✕)");
  endAux();
  if (!viewer.mesh) return toast("Açılacak model yok", true);
  const nb = viewer.mesh.bodies ?? 1;
  flatBodyIdx = Math.min(flatBodyIdx, nb - 1);
  const res = await computeFlat(flatBodyIdx);
  if (!res) return;
  clearPartSel();
  mode = { k: "flat", res, body: flatBodyIdx };
  viewer.setModel(res.mesh);
  clearFlatLines();
  for (const b of res.bends) flatLines.push(viewer.fatLines([...b.a3, ...b.b3], b.up ? 0x2f9e44 : 0xd33f3f, 2.5, true));
  viewer.fit();
  showPM("Düz Desen (Açınım)", () => (endAux(), renderCommands()), () => (endAux(), renderCommands()));
  renderFlatPM();
  renderCommands();
}
function renderFlatPM() {
  if (mode.k !== "flat") return;
  const { res } = mode;
  const sb = lastSheetBase(viewFeatures().feats)!;
  const body = $("#pm-body");
  body.innerHTML = "";
  const nb = viewer.mesh?.bodies ?? 1;
  const mat = doc.material ? MATERIALS[doc.material] : null;
  const kg = mat ? (res.area * sb.t * mat.rho) / 1e6 : null;
  const rows: [string, string][] = [
    ["Levha ölçüsü", `${fmtNum(res.w, 2)} × ${fmtNum(res.h, 2)} mm`],
    ["Kalınlık", `${fmtNum(sb.t, 2)} mm`],
    ["Net alan", `${fmtNum(res.area / 100, 2)} cm²`],
    ["K faktörü", fmtNum(sb.k, 3)],
    ["Büküm sayısı", String(res.bends.length)],
  ];
  if (kg !== null) rows.push(["Ağırlık", `${fmtNum(kg, 3)} kg (${mat!.name})`]);
  const tbl = h("table", "eq-table");
  for (const [a, b] of rows) {
    const tr = h("tr");
    tr.append(h("td", "", a), h("td", "", b));
    tbl.appendChild(tr);
  }
  body.appendChild(group("Açınım", tbl));
  if (nb > 1)
    body.appendChild(
      selectField("Gövde", Array.from({ length: nb }, (_, i) => ({ v: String(i), t: `Gövde ${i + 1}` })), String(mode.body), async (v) => {
        flatBodyIdx = parseInt(v);
        leaveFlat();
        await rebuild();
        openFlat();
      }),
    );
  if (res.bends.length) {
    const bt = h("table", "eq-table");
    const hd = h("tr");
    ["#", "Yön", "Açı", "İç R"].forEach((x) => hd.appendChild(h("th", "", x)));
    bt.appendChild(hd);
    res.bends.forEach((b, i) => {
      const tr = h("tr");
      tr.append(h("td", "", `B${i + 1}`), h("td", "", b.up ? "Yukarı" : "Aşağı"), h("td", "", `${fmtNum(b.angle, 1)}°`), h("td", "", fmtNum(b.r, 2)));
      bt.appendChild(tr);
    });
    body.appendChild(group("Büküm tablosu", bt, h("p", "pm-hint", "Yön, açınıma üstten bakıldığına göredir. Yeşil kesikli: yukarı, kırmızı kesikli: aşağı.")));
  }
  body.appendChild(group("Dışa aktar", button("DXF olarak kaydet", () => exportDxf())));
}
async function exportDxf() {
  let res: FlatResult | null = mode.k === "flat" ? mode.res : null;
  if (!res) {
    if (mode.k === "pm") return toast("Önce açık özelliği tamamlayın (✓ veya ✕)");
    if (!viewer.mesh) return toast("Açılacak model yok", true);
    res = await computeFlat(flatBodyIdx);
    if (!res) return;
  }
  const sb = lastSheetBase(viewFeatures().feats);
  const mat = doc.material ? MATERIALS[doc.material]?.name : "";
  const title = `${doc.name} - t=${fmtNum(sb?.t ?? 0, 2)} mm${mat ? " - " + mat : ""} - ${fmtNum(res.w, 1)} x ${fmtNum(res.h, 1)}`;
  const txt = flatToDxf(res.outline, res.bends, res.w, res.h, { bends: true, notes: true, title });
  download(new Blob([txt], { type: "application/dxf" }), `${doc.name}_acinim.dxf`);
}

function openSection() {
  if (mode.k === "sketch") exitSketch(true);
  if (mode.k === "pm") return toast("Önce açık özelliği tamamlayın (✓ veya ✕)");
  endAux();
  if (!section) {
    const c = viewer.bbox ? viewer.bbox.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    section = { plane: "front", off: Math.round(c.z * 10) / 10, flip: false };
  }
  mode = { k: "section" };
  applySection();
  showPM(
    "Kesit Görünüşü",
    () => (endAux(), renderCommands()),
    () => {
      section = null;
      applySection();
      endAux();
      renderCommands();
    },
  );
  const body = $("#pm-body");
  body.innerHTML = "";
  const s = section;
  body.append(
    h("p", "pm-hint", "✓ kesiti açık bırakır, ✕ kapatır. Kesit yalnızca görünümü etkiler."),
    selectField("Kesit düzlemi", (["front", "top", "right"] as StdPlane[]).map((n) => ({ v: n, t: STD_NAMES[n] })), s.plane, (v) => {
      s.plane = v;
      applySection();
    }),
    numField("Öteleme", s.off, (v) => ((s.off = v), applySection()), { unit: "mm" }),
    checkField("Yönü ters çevir", s.flip, (v) => ((s.flip = v), applySection())),
  );
  const range = document.createElement("input");
  range.type = "range";
  const bb = viewer.bbox;
  const ax = { front: 2, top: 1, right: 0 }[s.plane];
  range.min = String(bb ? bb.min.getComponent(ax) - 1 : -100);
  range.max = String(bb ? bb.max.getComponent(ax) + 1 : 100);
  range.step = "0.5";
  range.value = String(s.off);
  range.style.width = "100%";
  range.addEventListener("input", () => {
    s.off = parseFloat(range.value);
    (body.querySelector(".pm-field:nth-of-type(2) input") as HTMLInputElement | null)?.setAttribute("value", range.value);
    applySection();
  });
  body.appendChild(range);
  renderCommands();
}

// =====================================================================
// Özellik ağacı
// =====================================================================
const FEAT_ICON: Record<string, string> = {
  sheetjog: "sheetjog",
  miterflange: "miterflange",
  closecorner: "closecorner",
  tosheet: "tosheet",
  combine: "combine",
  splitbody: "splitbody",
  movebody: "movebody",
  delbody: "delbody",
  indent: "indent",
  spattern: "spattern",
  tpattern: "tpattern",
  cvpattern: "cvpattern",
  fpattern: "fpattern",
  thread: "thread",
  flex: "flex",
  vchamfer: "vchamfer",
  sketch3d: "sketch3d",
  weld: "weld",
  member: "member",
  trim: "trimm",
  endcap: "endcap",
  gusset: "gusset",
  sheetbase: "sheetbase",
  edgeflange: "edgeflange",
  hem: "hem",
  sketchbend: "sketchbend",
  sketch: "sketch",
  extrude: "extrude",
  cutExtrude: "cutExtrude",
  revolve: "revolve",
  cutRevolve: "cutRevolve",
  fillet: "fillet",
  chamfer: "chamfer",
  shell: "shell",
  lpattern: "lpattern",
  cpattern: "cpattern",
  mirror: "mirror",
  plane: "plane",
  sweep: "sweep",
  cutSweep: "sweep",
  loft: "loft",
  cutLoft: "loft",
  hole: "hole",
  draft: "draftf",
  rib: "rib",
  dome: "dome",
  wrap: "wrapf",
  scale: "scalef",
  import: "importf",
  axis: "axisf",
  point: "pointf",
  csys: "csysf",
};

function renderTree() {
  $("#part-name").textContent = doc.name;
  const ul = $("#tree");
  ul.innerHTML = "";
  const rollIdx = mode.k === "sketch" && !mode.isNew ? featIndex(mode.featId) : mode.k === "pm" && mode.editingId ? featIndex(mode.editingId) : doc.rollback ?? Infinity;
  const row = (id: string, name: string, icon: string, cls = "") => {
    const li = h("li", cls);
    li.innerHTML = ICONS[icon] ?? "";
    li.appendChild(h("span", "", name));
    li.addEventListener("click", () => {
      if (mode.k !== "part") return;
      treeSel = treeSel === id ? null : id;
      clearPartSel();
      renderTree();
      drawSketches();
      refreshHighlight();
      hint("");
    });
    li.addEventListener("dblclick", () => {
      if (mode.k === "part" && getFeat(id)) editFeature(id);
    });
    if (treeSel === id) li.classList.add("sel");
    ul.appendChild(li);
    return li;
  };
  (["front", "top", "right"] as StdPlane[]).forEach((n) => row(n, STD_NAMES[n], "plane"));
  const o = h("li", "", "");
  o.innerHTML = ICONS.point + "<span>Orijin</span>";
  ul.appendChild(o);
  const bar = () => {
    const li = h("li", "rollbar");
    li.title = "Geri sarma çubuğu: altındaki özellikler hesaplanmaz";
    li.appendChild(h("span", "", doc.rollback != null ? "▬ Geri sarma çubuğu (sona taşımak için dokunun)" : ""));
    li.addEventListener("click", () => {
      if (mode.k !== "part") return;
      commitDoc(() => (doc.rollback = null));
    });
    ul.appendChild(li);
  };
  doc.features.forEach((f, i) => {
    if (doc.rollback === i) bar();
    if (f.type === "sketch" && consumerOf(f.id)) return;
    const err = featureErrors.get(f.id);
    const cls = [err ? "err" : "", f.off ? "off" : "", i >= rollIdx ? "rolled" : ""].join(" ");
    const label = f.type === "hole" && f.htype === "tap" && f.size !== "custom" ? `${f.name} (${threadLabel(f.std ?? "iso", f.size)})` : f.name;
    const li = row(f.id, label, FEAT_ICON[kindOf(f)] ?? "file", cls);
    if (err) li.title = err;
    const kids =
      f.type === "extrude" || f.type === "revolve" || f.type === "rib" || f.type === "wrap"
        ? [f.sketch]
        : f.type === "sweep"
          ? [f.sketch, f.path]
          : f.type === "loft"
            ? [...f.sketches, ...(f.center ? [f.center] : [])]
            : [];
    for (const kid of kids) {
      const sk = getFeat(kid);
      if (sk && consumerOf(kid) === f) {
        const c = row(sk.id, sk.name, "sketch", "child" + (i >= rollIdx ? " rolled" : ""));
        if (featureErrors.get(sk.id)) c.classList.add("err");
      }
    }
  });
  renderTreeActions();
}

function renderTreeActions() {
  const box = $("#tree-actions");
  box.innerHTML = "";
  if (!treeSel || mode.k !== "part") return;
  const add = (t: string, fn: () => void, cls = "btn") => box.appendChild(button(t, fn, cls));
  if (["front", "top", "right"].includes(treeSel)) {
    add("Eskiz", () => startSketch({ k: "std", n: treeSel as StdPlane }));
    add("Normal görünüm", () => viewer.viewNormal(STD_FRAMES[treeSel as StdPlane]));
    return;
  }
  const f = getFeat(treeSel);
  if (!f) return;
  const err = featureErrors.get(f.id);
  if (err) box.appendChild(h("div", "msg", err));
  if (f.type === "sketch") {
    add("Eskizi düzenle", () => editFeature(f.id), "btn primary");
    if (!consumerOf(f.id)) add("Ekstrüzyon", () => newFeature("extrude"));
  } else {
    add("Düzenle", () => editFeature(f.id), "btn primary");
    if (f.type === "extrude" || f.type === "revolve" || f.type === "sweep") add("Eskizi düzenle", () => editFeature(f.sketch));
    if (f.type === "plane")
      add("Eskiz", () => startSketch({ k: "ref", id: f.id }));
  }
  add("Adlandır", () => {
    const n = prompt("Yeni ad", f.name)?.trim();
    if (n) commitDoc(() => (f.name = n));
  });
  const idx = featIndex(f.id);
  add("Buraya geri sar", () => commitDoc(() => (doc.rollback = idx)));
  if (doc.rollback != null) add("Sona sar", () => commitDoc(() => (doc.rollback = null)));
  add(f.off ? "Etkinleştir" : "Bastır", () => commitDoc(() => (f.off = !f.off)));
  add("Sil", () => deleteFeature(f.id), "btn danger");
}

function deleteFeature(id: string) {
  const f = getFeat(id);
  if (!f) return;
  const deps = f.type === "sketch" ? sketchUsers(doc.features, id) : [];
  const planeDeps = doc.features.filter((x) => x.type === "sketch" && x.plane.k === "ref" && x.plane.id === id);
  let msg = `"${f.name}" silinsin mi?`;
  if (deps.length) msg = `"${f.name}" ve onu kullanan ${deps.map((d) => d.name).join(", ")} silinsin mi?`;
  if (planeDeps.length) msg += `\nBu düzlemdeki eskizler (${planeDeps.map((d) => d.name).join(", ")}) çalışmayacak.`;
  if (!confirm(msg)) return;
  const absorbed = (f.type === "extrude" || f.type === "revolve" ? [f.sketch] : f.type === "sweep" ? [f.sketch, f.path] : f.type === "loft" ? f.sketches : []).filter(
    (sid) => sketchUsers(doc.features, sid).every((u) => u.id === id),
  );
  const delIds = new Set([id, ...deps.map((d) => d.id)]);
  if (absorbed.length && confirm("Kullandığı eskiz(ler) de silinsin mi?")) absorbed.forEach((x) => delIds.add(x));
  treeSel = null;
  commitDoc(() => {
    doc.features = doc.features.filter((x) => !delIds.has(x.id));
    for (const x of doc.features as any[]) if (x.feats) x.feats = x.feats.filter((y: string) => !delIds.has(y));
  });
}

// =====================================================================
// Komut çubuğu
// =====================================================================
type Cmd = { id: string; label: string; icon: string; run: () => void; active?: () => boolean } | "sep";
let tab: "features" | "sketch" | "evaluate" | "sheet" | "weld" = "features";
function setTab(t: "features" | "sketch" | "evaluate" | "sheet" | "weld") {
  tab = t;
  document.querySelectorAll<HTMLButtonElement>("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
  document.querySelector<HTMLElement>(`#tabs button[data-tab="${t}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  renderCommands();
}
document.querySelectorAll<HTMLButtonElement>("#tabs button").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab as any)));

const skTool = (t: SkTool, icon: string, label = TOOL_NAMES[t]): Cmd => ({
  id: t,
  label,
  icon,
  run: () => beginSketchCommand(t),
  active: () => mode.k === "sketch" && mode.editor.tool === t,
});

function commands(): Cmd[] {
  if (tab === "features")
    return [
      { id: "extrude", label: "Ekstrüzyon", icon: "extrude", run: () => newFeature("extrude") },
      { id: "cutExtrude", label: "Ekst. Kesme", icon: "cutExtrude", run: () => newFeature("cutExtrude") },
      { id: "revolve", label: "Döndürme", icon: "revolve", run: () => newFeature("revolve") },
      { id: "cutRevolve", label: "Dönd. Kesme", icon: "cutRevolve", run: () => newFeature("cutRevolve") },
      { id: "sweep", label: "Süpürme", icon: "sweep", run: () => newFeature("sweep") },
      { id: "loft", label: "Loft", icon: "loft", run: () => newFeature("loft") },
      "sep",
      { id: "hole", label: "Delik Sihirb.", icon: "hole", run: () => newFeature("hole") },
      { id: "fillet", label: "Radyüs", icon: "fillet", run: () => newFeature("fillet") },
      { id: "chamfer", label: "Pah", icon: "chamfer", run: () => newFeature("chamfer") },
      { id: "shell", label: "Kabuk", icon: "shell", run: () => newFeature("shell") },
      { id: "draft", label: "Koniklik", icon: "draftf", run: () => newFeature("draft") },
      { id: "rib", label: "Kaburga", icon: "rib", run: () => newFeature("rib") },
      { id: "dome", label: "Kubbe", icon: "dome", run: () => newFeature("dome") },
      { id: "wrap", label: "Sarma", icon: "wrapf", run: () => newFeature("wrap") },
      { id: "scale", label: "Ölçekle", icon: "scalef", run: () => newFeature("scale") },
      "sep",
      { id: "thread", label: "Diş", icon: "thread", run: () => newFeature("thread") },
      { id: "flex", label: "Esnet", icon: "flex", run: () => newFeature("flex") },
      { id: "indent", label: "Girinti", icon: "indent", run: () => newFeature("indent") },
      { id: "vchamfer", label: "Köşe Pahı", icon: "vchamfer", run: () => newFeature("vchamfer") },
      "sep",
      { id: "combine", label: "Birleştir", icon: "combine", run: () => newFeature("combine") },
      { id: "splitbody", label: "Gövde Böl", icon: "splitbody", run: () => newFeature("splitbody") },
      { id: "movebody", label: "Gövde Taşı", icon: "movebody", run: () => newFeature("movebody") },
      { id: "delbody", label: "Gövde Sil", icon: "delbody", run: () => newFeature("delbody") },
      "sep",
      { id: "lpattern", label: "Doğrusal Çoğ.", icon: "lpattern", run: () => newFeature("lpattern") },
      { id: "cpattern", label: "Dairesel Çoğ.", icon: "cpattern", run: () => newFeature("cpattern") },
      { id: "spattern", label: "Eskiz Çoğ.", icon: "spattern", run: () => newFeature("spattern") },
      { id: "tpattern", label: "Tablo Çoğ.", icon: "tpattern", run: () => newFeature("tpattern") },
      { id: "cvpattern", label: "Eğri Çoğ.", icon: "cvpattern", run: () => newFeature("cvpattern") },
      { id: "fpattern", label: "Doldurma Çoğ.", icon: "fpattern", run: () => newFeature("fpattern") },
      { id: "mirror", label: "Ayna", icon: "mirror", run: () => newFeature("mirror") },
      "sep",
      { id: "plane", label: "Ref. Düzlem", icon: "plane", run: () => newFeature("plane") },
      { id: "axis", label: "Ref. Eksen", icon: "axisf", run: () => newFeature("axis") },
      { id: "point", label: "Ref. Nokta", icon: "pointf", run: () => newFeature("point") },
      { id: "csys", label: "Koord. Sist.", icon: "csysf", run: () => newFeature("csys") },
      { id: "sketch", label: "Eskiz", icon: "sketch", run: () => beginSketchCommand() },
    ];
  if (tab === "weld")
    return [
      { id: "sketch3d", label: "3B Eskiz", icon: "sketch3d", run: () => newFeature("sketch3d") },
      { id: "member", label: "Yapı Elemanı", icon: "member", run: () => newFeature("member") },
      { id: "trim", label: "Kırp / Uzat", icon: "trimm", run: () => newFeature("trim") },
      { id: "endcap", label: "Uç Kapağı", icon: "endcap", run: () => newFeature("endcap") },
      { id: "weld", label: "Kaynak Dikişi", icon: "weld", run: () => newFeature("weld") },
      { id: "gusset", label: "Köşe Takviyesi", icon: "gusset", run: () => newFeature("gusset") },
      "sep",
      { id: "sketch", label: "Eskiz", icon: "sketch", run: () => beginSketchCommand() },
      { id: "plane", label: "Ref. Düzlem", icon: "plane", run: () => newFeature("plane") },
      { id: "cutExtrude", label: "Ekst. Kesme", icon: "cutExtrude", run: () => newFeature("cutExtrude") },
      { id: "hole", label: "Delik Sihirb.", icon: "hole", run: () => newFeature("hole") },
      "sep",
      { id: "cutlist", label: "Kesim Listesi", icon: "cutlist", run: () => openCutList() },
    ];
  if (tab === "sheet")
    return [
      { id: "sheetbase", label: "Taban Flanş", icon: "sheetbase", run: () => newFeature("sheetbase") },
      { id: "edgeflange", label: "Kenar Flanş", icon: "edgeflange", run: () => newFeature("edgeflange") },
      { id: "hem", label: "Kenet", icon: "hem", run: () => newFeature("hem") },
      { id: "sketchbend", label: "Çizgiden Büküm", icon: "sketchbend", run: () => newFeature("sketchbend") },
      { id: "sheetjog", label: "Kademe", icon: "sheetjog", run: () => newFeature("sheetjog") },
      { id: "miterflange", label: "Gönye Flanş", icon: "miterflange", run: () => newFeature("miterflange") },
      { id: "closecorner", label: "Köşe Kapat", icon: "closecorner", run: () => newFeature("closecorner") },
      { id: "tosheet", label: "Saca Dönüştür", icon: "tosheet", run: () => newFeature("tosheet") },
      "sep",
      { id: "cutExtrude", label: "Ekst. Kesme", icon: "cutExtrude", run: () => newFeature("cutExtrude") },
      { id: "hole", label: "Delik Sihirb.", icon: "hole", run: () => newFeature("hole") },
      { id: "sketch", label: "Eskiz", icon: "sketch", run: () => beginSketchCommand() },
      "sep",
      { id: "flatten", label: "Düzleştir", icon: "flatten", run: () => (mode.k === "flat" ? (endAux(), renderCommands()) : openFlat()), active: () => mode.k === "flat" },
      { id: "dxf", label: "Açınım DXF", icon: "dxf", run: () => exportDxf() },
    ];
  if (tab === "evaluate")
    return [
      { id: "measure", label: "Ölç", icon: "measure", run: () => startMeasure(), active: () => mode.k === "measure" },
      { id: "mass", label: "Kütle Özell.", icon: "mass", run: () => showMassProps() },
      { id: "section", label: "Kesit", icon: "section", run: () => openSection(), active: () => !!section },
      { id: "material", label: "Malzeme", icon: "material", run: () => chooseMaterial() },
      { id: "equations", label: "Denklemler", icon: "equations", run: () => openEquations() },
      { id: "interfere", label: "Girişim", icon: "interfere", run: () => checkInterference() },
    ];
  const inSk = mode.k === "sketch";
  const ed = inSk ? (mode as any).editor as SketchEditor : null;
  return [
    {
      id: "sketch",
      label: inSk ? "Eskizden Çık" : "Eskiz",
      icon: inSk ? "exitSketch" : "sketch",
      run: () => (inSk ? exitSketch(true) : beginSketchCommand()),
      active: () => mode.k === "pickSketchPlane",
    },
    skTool("select", "select"),
    skTool("dim", "dim"),
    "sep",
    skTool("line", "line"),
    skTool("centerline", "centerline", "Merkez Çiz."),
    skTool("rect", "rect", "Dikdörtgen"),
    skTool("crect", "crect", "Merkez Dikd."),
    skTool("circle", "circle"),
    skTool("carc", "carc", "Merkez Yay"),
    skTool("tarc", "tarc"),
    skTool("arc3", "arc3", "3N Yay"),
    skTool("slot", "slot", "Kanal"),
    skTool("polygon", "polygon"),
    skTool("point", "point"),
    skTool("rect3", "rect3", "3N Dikdörtgen"),
    skTool("para", "para", "Paralelkenar"),
    skTool("circle3", "circle3", "Çevre Dairesi"),
    skTool("cslot", "cslot", "Merkez Kanal"),
    skTool("aslot", "aslot", "Yay Kanal"),
    skTool("ellipse", "ellipse"),
    skTool("pellipse", "pellipse", "Kısmi Elips"),
    skTool("parabola", "parabola"),
    skTool("spline", "spline"),
    skTool("text", "text"),
    "sep",
    skTool("fillet", "sfillet", "Eskiz Radyüs"),
    skTool("schamfer", "schamfer", "Eskiz Pahı"),
    skTool("trim", "trim"),
    skTool("extend", "extend"),
    skTool("offset", "offset", "Ötele"),
    skTool("convert", "convert", "Dönüştür"),
    skTool("isect", "isect", "Kesişim Eğr."),
    "sep",
    skTool("mline", "mline", "Orta N. Çizgi"),
    skTool("crect3", "crect3", "3N Merkez Dikd."),
    skTool("conic", "conic", "Konik"),
    skTool("eqcurve", "eqcurve", "Denklem Eğrisi"),
    skTool("split", "split", "Ayır"),
    skTool("jog", "jog", "Kademe"),
    skTool("ordinate", "ordinate", "Koord. Ölçü"),
    skTool("block", "block", "Blok Ekle"),
    "sep",
    { id: "repair", label: "Eskizi Onar", icon: "repair", run: () => (ed ? ed.repairSketch() : toast("Eskiz içinde kullanılır")) },
    {
      id: "picture",
      label: "Eskiz Resmi",
      icon: "picture",
      run: () => {
        if (!ed) return toast("Önce bir eskiz açın; resim eskizin düzlemine yerleşir", true);
        if (ed.data.pic) return ed.setTool("picture"), renderCommands();
        const inp = h("input") as HTMLInputElement;
        inp.type = "file";
        inp.accept = "image/*";
        inp.onchange = async () => {
          const file = inp.files?.[0];
          if (!file) return;
          try {
            const { src, aspect } = await loadImageFile(file);
            ed.setPicture(src, aspect);
            renderCommands();
          } catch (e) {
            toast((e as Error).message, true);
          }
        };
        inp.click();
      },
      active: () => ed?.tool === "picture",
    },
    skTool("mirror", "smirror", "Aynala"),
    skTool("spat", "spat", "Doğrusal Çoğ."),
    skTool("scpat", "scpat", "Dairesel Çoğ."),
    skTool("move", "move", "Taşı/Kopyala"),
    { id: "fulldef", label: "Tam Tanımla", icon: "fulldef", run: () => (ed ? ed.fullyDefine() : toast("Eskiz içinde kullanılır")) },
    { id: "cons", label: "Yapı Geom.", icon: "construction", run: () => ed ? ed.toggleConstruction() : toast("Eskiz içinde kullanılır") },
    {
      id: "rels",
      label: "İlişkiler",
      icon: "relations",
      run: () => {
        if (!ed) return;
        ed.opts.showRels = !ed.opts.showRels;
        ed.render();
        renderCommands();
      },
      active: () => !!ed?.opts.showRels,
    },
    { id: "del", label: "Sil", icon: "del", run: () => ed ? ed.deleteSelection() : deleteSelectedPart() },
  ];
}

/** Enter ile tekrarlanacak son komut (SolidWorks: Enter = son komutu tekrarla) */
let lastCmd: (() => void) | null = null;

/** komut grupları: ilk grup hep görünür, diğerleri sekme düğmeleriyle açılır */
const GROUP_NAMES: Record<string, string[]> = {
  features: ["", "Detay", "Gelişmiş", "Gövde", "Çoğalt", "Referans"],
  sketch: ["", "Çiz", "Düzenle", "Özel çizim", "Araçlar", "Desen", "İlişki"],
  weld: ["", "Eskiz / Kesme", "Liste"],
  sheet: ["", "Kesme", "Açınım"],
  evaluate: ["", "Eskiz", "Diğer"],
};
const groupSel: Record<string, number> = {};
let lastGroupTool = "";
function renderCommands() {
  const box = $("#cmds");
  box.innerHTML = "";
  const groups: Cmd[][] = [[]];
  for (const c of commands()) {
    if (c === "sep") {
      if (groups[groups.length - 1].length) groups.push([]);
    } else groups[groups.length - 1].push(c);
  }
  if (!groups[groups.length - 1].length) groups.pop();
  const names = GROUP_NAMES[tab] ?? [];
  // etkin araç hangi gruptaysa onu seç
  const act = groups.findIndex((g, i) => i > 0 && g.some((c) => c !== "sep" && c.active?.()));
  const curTool = mode.k === "sketch" ? mode.editor.tool : "";
  if (act > 0 && curTool !== "select" && curTool !== lastGroupTool) groupSel[tab] = act;
  lastGroupTool = curTool;
  let gi = groupSel[tab] ?? 1;
  if (gi >= groups.length) gi = groups.length > 1 ? 1 : 0;
  const list: Cmd[] = [...groups[0]];
  let chips: HTMLElement | null = null;
  if (groups.length > 1) {
    list.push("sep");
    chips = h("div", "cmd-groups");
    groups.slice(1).forEach((g, k) => {
      const i = k + 1;
      const first = g[0] !== "sep" ? g[0].label : "";
      const c = h("button", "cmd-chip" + (i === gi ? " on" : ""), names[i] || first);
      c.addEventListener("click", () => ((groupSel[tab] = i), renderCommands()));
      chips!.appendChild(c);
    });
    list.push(...groups[gi]);
  }
  for (const c of list) {
    if (c === "sep") {
      box.appendChild(h("div", "cmd-sep"));
      continue;
    }
    const b = h("button", "cmd" + (c.active?.() ? " active" : ""));
    b.innerHTML = ICONS[c.icon] ?? "";
    b.appendChild(h("span", "lbl", c.label));
    b.title = c.label;
    b.addEventListener("click", () => {
      lastCmd = c.run;
      c.run();
      renderCommands();
    });
    box.appendChild(b);
  }
  let gbar = document.getElementById("cmdgroups");
  if (!gbar) {
    gbar = h("div", "");
    gbar.id = "cmdgroups";
    box.before(gbar);
  }
  gbar.innerHTML = "";
  if (chips) {
    if (innerWidth <= 820) gbar.appendChild(chips);
    else {
      const sep = box.querySelector(".cmd-sep");
      if (sep) sep.after(chips);
      else box.prepend(chips);
    }
  }
  updateUndo();
}

function deleteSelectedPart() {
  if (treeSel && getFeat(treeSel)) deleteFeature(treeSel);
}

function cancelPick() {
  mode = { k: "part" };
  hint("");
  renderCommands();
}

// Genel düğmeler
const setIcon = (id: string, icon: string, label: string) => {
  const b = $(id);
  b.innerHTML = ICONS[icon];
  b.appendChild(h("span", "lbl", label));
};
setIcon("#tree-btn", "tree", "Ağaç");
setIcon("#undo", "undo", "Geri");
setIcon("#redo", "redo", "İleri");
setIcon("#file-btn", "file", "Dosya");
setIcon("#help-btn", "help", "Yardım");

function updateUndo() {
  const ed = mode.k === "sketch" ? mode.editor : null;
  ($("#undo") as HTMLButtonElement).disabled = ed ? !ed.canUndo() : undoStack.length === 0 || mode.k !== "part";
  ($("#redo") as HTMLButtonElement).disabled = ed ? !ed.canRedo() : redoStack.length === 0 || mode.k !== "part";
}
function undo() {
  if (mode.k === "sketch") return mode.editor.undo(), updateUndo();
  if (mode.k !== "part") return;
  const s = undoStack.pop();
  if (!s) return;
  redoStack.push(JSON.stringify(doc));
  doc = JSON.parse(s);
  treeSel = null;
  saveDoc();
  afterDocChange();
}
function redo() {
  if (mode.k === "sketch") return mode.editor.redo(), updateUndo();
  if (mode.k !== "part") return;
  const s = redoStack.pop();
  if (!s) return;
  undoStack.push(JSON.stringify(doc));
  doc = JSON.parse(s);
  treeSel = null;
  saveDoc();
  afterDocChange();
}
$("#undo").addEventListener("click", undo);
$("#redo").addEventListener("click", redo);

$("#tree-btn").addEventListener("click", () => {
  const side = $("#side");
  if (window.matchMedia("(max-width: 820px)").matches) {
    side.classList.toggle("open");
    document.body.classList.toggle("sheet", side.classList.contains("open") || side.classList.contains("pm-open"));
  } else side.hidden = !side.hidden;
  viewer.resize();
});
$("#side-close").addEventListener("click", () => {
  $("#side").classList.remove("open");
  document.body.classList.toggle("sheet", $("#side").classList.contains("pm-open"));
});
$("#help-btn").addEventListener("click", () => ($("#help") as HTMLDialogElement).showModal());

// =====================================================================
// Görünüm çubuğu
// =====================================================================
function fitAll() {
  if (mode.k !== "sketch") return viewer.fit();
  const b = mode.editor.bounds();
  if (!b) return viewer.fit();
  const box = new THREE.Box3(new THREE.Vector3(...b[0]), new THREE.Vector3(...b[1]));
  if (viewer.bbox) box.union(viewer.bbox);
  viewer.fitBox(box);
}

function renderViewbar() {
  const bar = $("#viewbar");
  bar.innerHTML = "";
  const btn = (icon: string, title: string, fn: () => void, active = false) => {
    const b = h("button", (active ? "active " : "") + (["front", "top", "right", "iso"].includes(icon) ? "orient" : ""));
    b.innerHTML = ICONS[icon];
    b.title = title;
    b.addEventListener("click", fn);
    bar.appendChild(b);
  };
  btn("normal", "Normal görünüm (seçili düzlem / eskiz)", () => {
    if (mode.k === "sketch") return viewer.viewNormal(mode.editor.frame);
    const r = planeRefFromSelection();
    const fr = r && resolveFrame(r, doc.features);
    if (fr) viewer.viewNormal(fr);
    else toast("Bir düzlem veya düz yüz seçin");
  });
  btn("front", "Önden", () => viewer.viewStd("front"));
  btn("top", "Üstten", () => viewer.viewStd("top"));
  btn("right", "Sağdan", () => viewer.viewStd("right"));
  btn("iso", "İzometrik", () => viewer.viewStd("iso"));
  btn("fit", "Ekrana sığdır", () => fitAll());
  btn("planes", "Düzlemleri göster/gizle", () => {
    planesOn = !planesOn;
    updatePlanes();
    renderViewbar();
  }, planesOn);
}
renderViewbar();

// =====================================================================
// Dosya
// =====================================================================
$("#file-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  $("#file-menu").hidden = !$("#file-menu").hidden;
});
document.addEventListener("click", (e) => {
  if (!(e.target as HTMLElement).closest("#file-menu")) $("#file-menu").hidden = true;
});
document.querySelectorAll<HTMLButtonElement>("#file-menu button").forEach((b) =>
  b.addEventListener("click", async () => {
    $("#file-menu").hidden = true;
    const act = b.dataset.act;
    if (act === "wheel") {
      const v = !viewer.controls.reverseWheel;
      viewer.controls.reverseWheel = v;
      try {
        localStorage.setItem("imajcad.wheelReverse", v ? "1" : "0");
      } catch {}
      return toast(v ? "Tekerlek: ileri = yakınlaş" : "Tekerlek: ileri = uzaklaş (SolidWorks varsayılanı)");
    }
    if (act === "keys") return ($("#help") as HTMLDialogElement).showModal();
    if (act === "input") return openInputSettings();
    if (act === "wizard") return openWizard();
    if (act === "welcome") return openWelcome();
    if (mode.k === "sketch" && act !== "save") exitSketch(true);
    if (mode.k === "pm") cancelFeature();
    if (act === "new") {
      if (doc.features.length && !confirm("Yeni parça açılsın mı? (Geri al ile dönebilirsiniz)")) return;
      treeSel = null;
      commitDoc(() => (doc = emptyDoc()));
      viewer.viewStd("iso");
      firstBuild = true;
    } else if (act === "save") {
      const name = (prompt("Dosya adı", doc.name) || doc.name).replace(/[\\/:*?"<>|]/g, "_");
      doc.name = name;
      saveDoc();
      renderTree();
      download(new Blob([JSON.stringify(doc, null, 1)], { type: "application/json" }), `${name}.icad`);
    } else if (act === "open") ($("#file-input") as HTMLInputElement).click();
    else if (act === "import") importStep();
    else if (act === "dxf") exportDxf();
    else if (act === "cutlist") openCutList();
    else if (act === "step" || act === "stl") {
      if (!viewer.mesh) return toast("Dışa aktarılacak katı yok", true);
      setStatus("busy", "Dışa aktarılıyor…");
      const r = await kernel.export(act);
      setStatus("ok", "Hazır");
      if (!r.blob) return toast(r.message ?? "Dışa aktarılamadı", true);
      download(r.blob, `${doc.name}.${act}`);
    }
  }),
);
$("#file-input").addEventListener("change", async () => {
  const inp = $("#file-input") as HTMLInputElement;
  const file = inp.files?.[0];
  inp.value = "";
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (d?.version !== 2 || !Array.isArray(d.features)) throw new Error("Geçersiz dosya");
    treeSel = null;
    commitDoc(() => (doc = d));
    firstBuild = true;
    toast(`${d.name} açıldı`);
  } catch (e) {
    toast("Dosya açılamadı: " + (e as Error).message, true);
  }
});

async function download(blob: Blob, name: string) {
  const file = new File([blob], name, { type: "application/octet-stream" });
  const nav = navigator as any;
  if (matchMedia("(pointer: coarse)").matches && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast(`${name} indirildi`);
}

// =====================================================================
// Klavye
// =====================================================================
// =====================================================================
// SolidWorks klavye kısayolları
// =====================================================================
let mouseXY: [number, number] = [innerWidth / 2, innerHeight / 2];
window.addEventListener("pointermove", (e) => (mouseXY = [e.clientX, e.clientY]), { passive: true });
const fileAct = (act: string) => ($(`#file-menu button[data-act='${act}']`) as HTMLButtonElement | null)?.click();
function normalTo() {
  if (mode.k === "sketch") return viewer.viewNormal(mode.editor.frame);
  const r = planeRefFromSelection();
  const fr = r && resolveFrame(r, doc.features);
  if (fr) viewer.viewNormal(fr);
  else toast("Normal görünüm için bir düzlem veya düz yüz seçin");
}
window.addEventListener("keydown", (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  if (document.querySelector("dialog[open]")) return;
  const k = e.key.toLowerCase();
  const ctrl = e.ctrlKey || e.metaKey;
  const done = () => e.preventDefault();
  // görünüm yönleri: Ctrl+1..8
  if (ctrl && !e.shiftKey && /^[1-8]$/.test(e.key)) {
    done();
    const v = ["front", "back", "left", "right", "top", "bottom", "iso"] as const;
    if (e.key === "8") normalTo();
    else viewer.viewStd(v[+e.key - 1]);
    return;
  }
  if (ctrl && e.shiftKey && k === "z") return done(), viewer.previousView();
  if (ctrl && k === "z") return done(), undo();
  if (ctrl && k === "y") return done(), redo();
  if (ctrl && k === "s") return done(), fileAct("save");
  if (ctrl && k === "o") return done(), fileAct("open");
  if (ctrl && k === "n") return done(), fileAct("new");
  if (ctrl && (k === "b" || k === "q")) return done(), rebuild();
  if (ctrl && k === "r") return done(), viewer.requestRender();
  if (ctrl && k === "a" && mode.k === "sketch") return done(), mode.editor.selectAll();
  if (ctrl && k === "c" && mode.k === "sketch") return done(), mode.editor.copySel();
  if (ctrl && k === "v" && mode.k === "sketch") return done(), mode.editor.paste();
  if (ctrl && k.startsWith("arrow")) {
    done();
    const st = 60;
    const d = { arrowleft: [-st, 0], arrowright: [st, 0], arrowup: [0, -st], arrowdown: [0, st] }[k as "arrowleft"]!;
    viewer.pushView();
    return viewer.controls.pan(d[0], d[1]);
  }
  if (e.altKey && (k === "arrowleft" || k === "arrowright")) return done(), viewer.pushView(), viewer.controls.roll(k === "arrowleft" ? 15 : -15);
  if (k.startsWith("arrow")) {
    done();
    const a = e.shiftKey ? 90 : 15;
    const d = { arrowleft: [-a, 0], arrowright: [a, 0], arrowup: [0, -a], arrowdown: [0, a] }[k as "arrowleft"]!;
    viewer.pushView();
    return viewer.controls.rotateDeg(d[0], d[1]);
  }
  if (ctrl || e.altKey) return;
  if (e.key === " ") return done(), openOrientation();
  if (k === "f") return done(), fitAll();
  if (k === "z") return done(), viewer.zoomStep(e.shiftKey ? 1.25 : 0.8);
  if (k === "s" && !e.shiftKey) return done(), openShortcutBar();
  if (k === "a" && mode.k === "sketch") return done(), mode.editor.toggleLineArc();
  if (/^[0-9.,-]$/.test(e.key) && mode.k === "sketch" && ["line", "centerline", "rect", "crect", "circle"].includes(mode.editor.tool)) return done(), mode.editor.numericEntry(e.key);
  if (e.key === "Escape") escAction();
  else if (e.key === "Delete") {
    if (mode.k === "sketch") mode.editor.deleteSelection();
    else if (mode.k === "part") deleteSelectedPart();
  } else if (e.key === "Enter") {
    if (mode.k === "pm") return pmOk();
    if (lastCmd) {
      done();
      lastCmd();
      renderCommands();
    }
  }
});
function escAction() {
  {
    closePopups();
    if (mode.k === "sketch") {
      if (mode.editor.isDrawing()) mode.editor.finishChain();
      else if (mode.editor.tool !== "select") mode.editor.setTool("select");
      else mode.editor.sel.clear(), mode.editor.render(), mode.editor.renderPanel();
      renderCommands();
    } else if (mode.k === "pickSketchPlane") cancelPick();
    else if (mode.k === "pm") cancelFeature();
    else if (mode.k === "measure" || mode.k === "section" || mode.k === "flat") endAux(), renderCommands();
    else {
      clearPartSel();
      treeSel = null;
      renderTree();
      refreshHighlight();
    }
  }
}

// ---------- Fare hareketleri (sağ sürükle) ve bağlam menüsü (sağ tık) ----------
type GItem = { label: string; icon: string; run: () => void };
function gestureItems(): Partial<Record<"up" | "down" | "left" | "right", GItem>> {
  if (mode.k === "sketch")
    return {
      up: { label: "Akıllı Ölçü", icon: "dim", run: () => beginSketchCommand("dim") },
      right: { label: "Daire", icon: "circle", run: () => beginSketchCommand("circle") },
      down: { label: "Dikdörtgen", icon: "rect", run: () => beginSketchCommand("rect") },
      left: { label: "Çizgi", icon: "line", run: () => beginSketchCommand("line") },
    };
  return {
    up: { label: "Üstten", icon: "top", run: () => viewer.viewStd("top") },
    right: { label: "Sağdan", icon: "right", run: () => viewer.viewStd("right") },
    down: { label: "Alttan", icon: "top", run: () => viewer.viewStd("bottom") },
    left: { label: "Soldan", icon: "right", run: () => viewer.viewStd("left") },
  };
}
function closePopups() {
  document.querySelectorAll(".sw-popup").forEach((x) => x.remove());
}
function popupAt(x: number, y: number, cls: string) {
  closePopups();
  const box = h("div", "sw-popup " + cls);
  document.body.appendChild(box);
  box.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  requestAnimationFrame(() => {
    const r = box.getBoundingClientRect();
    box.style.left = Math.max(4, Math.min(innerWidth - r.width - 4, x)) + "px";
    box.style.top = Math.max(4, Math.min(innerHeight - r.height - 4, y)) + "px";
  });
  return box;
}
window.addEventListener("pointerdown", (e) => {
  if (!(e.target as HTMLElement).closest?.(".sw-popup")) closePopups();
});
function menuItem(box: HTMLElement, label: string, run: () => void, icon?: string) {
  const b = h("button", "sw-mi");
  if (icon && ICONS[icon]) b.innerHTML = ICONS[icon];
  b.appendChild(h("span", "", label));
  b.addEventListener("click", () => {
    closePopups();
    lastCmd = run;
    run();
    renderCommands();
  });
  box.appendChild(b);
}
function openContextMenu(x: number, y: number) {
  const box = popupAt(x, y, "sw-ctx");
  if (mode.k === "sketch") {
    const ed = mode.editor;
    menuItem(box, "Seç", () => ed.setTool("select"), "select");
    if (ed.isDrawing()) menuItem(box, "Zinciri bitir", () => ed.finishChain());
    if (ed.sel.size) {
      menuItem(box, "Yapı geometrisi", () => ed.toggleConstruction(), "centerline");
      menuItem(box, "Sil", () => ed.deleteSelection(), "del");
    }
    menuItem(box, "Akıllı Ölçü", () => ed.setTool("dim"), "dim");
    menuItem(box, "Normal görünüm (Ctrl+8)", () => viewer.viewNormal(ed.frame), "normal");
    menuItem(box, "Ekrana sığdır (F)", () => fitAll(), "fit");
    menuItem(box, "Eskizden çık", () => exitSketch(true), "exitSketch");
  } else if (mode.k === "pm") {
    menuItem(box, "Tamam (✓)", () => pmOk());
    menuItem(box, "İptal (✕)", () => pmCancel());
  } else {
    if (planeRefFromSelection()) {
      menuItem(box, "Eskiz", () => beginSketchCommand(), "sketch");
      menuItem(box, "Normal görünüm (Ctrl+8)", () => normalTo(), "normal");
    }
    if (treeSel && getFeat(treeSel)) {
      menuItem(box, "Özelliği düzenle", () => editFeature(treeSel!));
    }
    menuItem(box, "Ekstrüzyon", () => newFeature("extrude"), "extrude");
    menuItem(box, "Ekstrüzyon kesme", () => newFeature("cutExtrude"), "cutExtrude");
    menuItem(box, "Ekrana sığdır (F)", () => fitAll(), "fit");
    menuItem(box, "İzometrik (Ctrl+7)", () => viewer.viewStd("iso"), "iso");
    menuItem(box, "Önceki görünüm (Ctrl+Shift+Z)", () => viewer.previousView());
  }
}
/** S: imlecin yanında kısayol çubuğu */
function openShortcutBar() {
  const box = popupAt(mouseXY[0] - 120, mouseXY[1] - 30, "sw-sbar");
  const items: [string, string, () => void][] =
    mode.k === "sketch"
      ? [
          ["Çizgi", "line", () => beginSketchCommand("line")],
          ["Dikdörtgen", "rect", () => beginSketchCommand("rect")],
          ["Daire", "circle", () => beginSketchCommand("circle")],
          ["Merkez Yay", "carc", () => beginSketchCommand("carc")],
          ["Teğet Yay", "tarc", () => beginSketchCommand("tarc")],
          ["Kanal", "slot", () => beginSketchCommand("slot")],
          ["Nokta", "point", () => beginSketchCommand("point")],
          ["Akıllı Ölçü", "dim", () => beginSketchCommand("dim")],
          ["Kırp", "trim", () => beginSketchCommand("trim")],
          ["Ötele", "offset", () => beginSketchCommand("offset")],
          ["Aynala", "mirror", () => beginSketchCommand("mirror")],
          ["Eskiz Radyüsü", "fillet", () => beginSketchCommand("fillet")],
        ]
      : [
          ["Eskiz", "sketch", () => beginSketchCommand()],
          ["Ekstrüzyon", "extrude", () => newFeature("extrude")],
          ["Ekst. Kesme", "cutExtrude", () => newFeature("cutExtrude")],
          ["Döndürme", "revolve", () => newFeature("revolve")],
          ["Radyüs", "fillet", () => newFeature("fillet")],
          ["Pah", "chamfer", () => newFeature("chamfer")],
          ["Delik Sihirb.", "hole", () => newFeature("hole")],
          ["Kabuk", "shell", () => newFeature("shell")],
          ["Ayna", "mirror", () => newFeature("mirror")],
          ["Ref. Düzlem", "plane", () => newFeature("plane")],
        ];
  for (const [l, ic, run] of items) {
    const b = h("button", "sw-sb");
    b.innerHTML = ICONS[ic] ?? "";
    b.title = l;
    b.addEventListener("click", () => {
      closePopups();
      lastCmd = run;
      run();
      renderCommands();
    });
    box.appendChild(b);
  }
}
/** Space: görünüm yönü penceresi */
function openOrientation() {
  const box = popupAt(mouseXY[0] - 90, mouseXY[1] - 60, "sw-ctx");
  const v: [string, () => void][] = [
    ["Önden (Ctrl+1)", () => viewer.viewStd("front")],
    ["Arkadan (Ctrl+2)", () => viewer.viewStd("back")],
    ["Soldan (Ctrl+3)", () => viewer.viewStd("left")],
    ["Sağdan (Ctrl+4)", () => viewer.viewStd("right")],
    ["Üstten (Ctrl+5)", () => viewer.viewStd("top")],
    ["Alttan (Ctrl+6)", () => viewer.viewStd("bottom")],
    ["İzometrik (Ctrl+7)", () => viewer.viewStd("iso")],
    ["Normal (Ctrl+8)", () => normalTo()],
  ];
  for (const [l, run] of v) menuItem(box, l, run);
}
// sağ tuş: kısa tık = bağlam menüsü, sürükleme = fare hareketi kılavuzu
{
  const el = viewer.renderer.domElement;
  let g: { x: number; y: number; guide: HTMLElement | null; dir: string | null; id: number } | null = null;
  const dirOf = (dx: number, dy: number) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  el.addEventListener("pointerdown", (e) => {
    const penBtn = e.pointerType === "pen" && prefs.penButton && (e.button === 2 || (e.buttons & 2) !== 0);
    if (!(e.pointerType === "mouse" && e.button === 2) && !penBtn) return;
    e.stopPropagation();
    closePopups();
    g = { x: e.clientX, y: e.clientY, guide: null, dir: null, id: e.pointerId };
    try { el.setPointerCapture(e.pointerId); } catch {}
  });
  el.addEventListener("pointermove", (e) => {
    if (!g) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.guide && Math.hypot(dx, dy) > 12) {
      const items = gestureItems();
      const box = h("div", "sw-popup sw-gesture");
      box.style.left = g.x - 110 + "px";
      box.style.top = g.y - 110 + "px";
      for (const d of ["up", "right", "down", "left"] as const) {
        const it = items[d];
        if (!it) continue;
        const b = h("div", "sw-g sw-g-" + d);
        b.innerHTML = ICONS[it.icon] ?? "";
        b.appendChild(h("span", "", it.label));
        b.dataset.dir = d;
        box.appendChild(b);
      }
      document.body.appendChild(box);
      g.guide = box;
    }
    if (g.guide) {
      g.dir = Math.hypot(dx, dy) > 30 ? dirOf(dx, dy) : null;
      g.guide.querySelectorAll(".sw-g").forEach((x) => x.classList.toggle("on", (x as HTMLElement).dataset.dir === g!.dir));
    }
  });
  el.addEventListener("pointerup", (e) => {
    if (!g || e.pointerId !== g.id) return;
    const st = g;
    g = null;
    st.guide?.remove();
    if (st.guide) {
      const it = st.dir ? gestureItems()[st.dir as "up"] : null;
      if (it) {
        lastCmd = it.run;
        it.run();
        renderCommands();
      }
    } else openContextMenu(e.clientX, e.clientY);
  });
}
viewer.controls.addEventListener("fit", () => fitAll());

// =====================================================================
// Telefon / tablet: kalem ve parmak kontrolleri
// =====================================================================
const sketchDrawing = () => mode.k === "sketch" && mode.editor.tool !== "select";
viewer.touchDrawOk = () => sketchDrawing();
// çizim aracı açıkken kalem/parmak sabit tutulabilir (büyüteçle bakmak için): uzun basma menüsü yalnız seçimde
viewer.longPressOk = () => !sketchDrawing();
viewer.onLongPress = (x, y) => openContextMenu(x, y);
viewer.loupeOk = () => mode.k === "sketch" || mode.k === "pm";
viewer.onFingerTap = (n) => {
  if (n === 2) undo(), toast("Geri alındı");
  else if (n >= 3) redo(), toast("İleri alındı");
};

/** dokunmatikte tıklama gecikmesi olmadan anında çalışan düğme */
function onTap(el: HTMLElement, fn: () => void) {
  let down = -1;
  el.addEventListener("pointerdown", (e) => {
    down = e.pointerId;
    e.stopPropagation();
  });
  el.addEventListener("pointerup", (e) => {
    if (e.pointerId !== down) return;
    down = -1;
    e.preventDefault();
    fn();
  });
  // klavye ile (Enter / Boşluk) veya fare dışı tıklama
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    if (e.detail === 0) fn();
  });
}

/** araç listesi (S çubuğu ve dairesel menü ortak) */
function shortcutItems(): [string, string, () => void][] {
  return mode.k === "sketch"
    ? [
        ["Çizgi", "line", () => beginSketchCommand("line")],
        ["Daire", "circle", () => beginSketchCommand("circle")],
        ["Dikdörtgen", "rect", () => beginSketchCommand("rect")],
        ["Teğet Yay", "tarc", () => beginSketchCommand("tarc")],
        ["Akıllı Ölçü", "dim", () => beginSketchCommand("dim")],
        ["Kırp", "trim", () => beginSketchCommand("trim")],
        ["Ötele", "offset", () => beginSketchCommand("offset")],
        ["Seç", "select", () => beginSketchCommand("select")],
      ]
    : [
        ["Eskiz", "sketch", () => beginSketchCommand()],
        ["Ekstrüzyon", "extrude", () => newFeature("extrude")],
        ["Ekst. Kesme", "cutExtrude", () => newFeature("cutExtrude")],
        ["Döndürme", "revolve", () => newFeature("revolve")],
        ["Radyüs", "fillet", () => newFeature("fillet")],
        ["Pah", "chamfer", () => newFeature("chamfer")],
        ["Delik", "hole", () => newFeature("hole")],
        ["Kabuk", "shell", () => newFeature("shell")],
      ];
}
/** dairesel araç menüsü */
function openRadial(x: number, y: number) {
  closePopups();
  const items = shortcutItems();
  const R = 78;
  const box = h("div", "sw-popup sw-radial");
  const cx = Math.max(R + 34, Math.min(innerWidth - R - 34, x)), cy = Math.max(R + 34, Math.min(innerHeight - R - 34, y));
  box.style.left = cx + "px";
  box.style.top = cy + "px";
  items.forEach(([label, ic, run], i) => {
    const a = -Math.PI / 2 + (i / items.length) * Math.PI * 2;
    const b = h("button", "sw-rb");
    b.innerHTML = ICONS[ic] ?? "";
    b.appendChild(h("span", "", label));
    b.style.left = R * Math.cos(a) + "px";
    b.style.top = R * Math.sin(a) + "px";
    onTap(b, () => {
      closePopups();
      lastCmd = run;
      run();
      renderCommands();
    });
    box.appendChild(b);
  });
  const c = h("button", "sw-rb center", "✕");
  onTap(c, () => closePopups());
  box.appendChild(c);
  box.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  document.body.appendChild(box);
}

// ---------- ekran çubuğu (dokunmatik) ----------
const actbar = h("div", "actbar");
document.body.appendChild(actbar);
function actBarOn() {
  return prefs.actionBar === "on" || (prefs.actionBar === "auto" && isTouchDevice() && effectiveProfile() !== "mouse");
}
function renderActBar() {
  actbar.innerHTML = "";
  actbar.hidden = !actBarOn();
  actbar.classList.toggle("left", prefs.leftHanded);
  if (actbar.hidden) return;
  const b = (label: string, title: string, fn: () => void, cls = "") => {
    const x = h("button", cls, label);
    x.title = title;
    onTap(x, () => {
      fn();
      renderActBar();
    });
    actbar.appendChild(x);
    return x;
  };
  if (mode.k === "sketch") {
    const ed = mode.editor;
    b("✓", ed.isDrawing() ? "Bitir" : "Eskizden çık", () => (ed.isDrawing() ? ed.finishChain() : exitSketch(true)), "ok");
    b("✕", "İptal / Seç", () => escAction());
    if (ed.tool === "line") b("A", "Çizgi ↔ teğet yay", () => ed.toggleLineArc(), (ed as any).st?.arc ? "on" : "");
    if (["line", "centerline", "rect", "crect", "circle"].includes(ed.tool)) b("123", "Sayıyla gir", () => ed.numericEntry(), "small");
  } else if (mode.k === "pm") {
    b("✓", "Tamam", () => pmOk(), "ok");
    b("✕", "İptal", () => pmCancel());
  } else {
    b("✕", "Seçimi temizle", () => escAction());
    b(selFilter === "face" ? "Yüz" : selFilter === "edge" ? "Kenar" : "Tümü", "Seçim filtresi", () => {
      selFilter = selFilter === "all" ? "face" : selFilter === "face" ? "edge" : "all";
      toast("Seçim filtresi: " + (selFilter === "all" ? "tümü" : selFilter === "face" ? "yalnız yüz" : "yalnız kenar"));
    }, "small" + (selFilter !== "all" ? " on" : ""));
    b("✚", "Şekil sihirbazı", () => openWizard(), "small");
  }
  b("Ctrl", "Ctrl basılı (çoklu seçim / yakalamayı kapat)", () => {
    viewer.mods.ctrl = !viewer.mods.ctrl;
  }, viewer.mods.ctrl ? "on small" : "small");
  b("↶", "Geri al", () => undo());
  b("↷", "İleri al", () => redo());
  b("☰", "Araç menüsü", () => {
    const r = viewer.renderer.domElement.getBoundingClientRect();
    openRadial(r.left + r.width / 2, r.top + r.height / 2);
  });
  b("⤢", "Ekrana sığdır", () => fitAll());
}
setInterval(() => {
  // mod / araç değişince çubuğu güncelle (ucuz karşılaştırma)
  const key = [selFilter, mode.k, mode.k === "sketch" ? mode.editor.tool + mode.editor.isDrawing() + !!(mode.editor as any).st?.arc : "", viewer.mods.ctrl, actBarOn(), prefs.leftHanded].join("|");
  if (key !== (actbar as any)._k) {
    (actbar as any)._k = key;
    renderActBar();
  }
}, 250);

// ---------- tam ekran (telefonda tarayıcı çubuğunu gizler) ----------
{
  const fsBtn = h("button", "cmd fs-btn", "⛶");
  fsBtn.title = "Tam ekran";
  const fsOk = !!document.documentElement.requestFullscreen;
  const upd = () => (fsBtn.textContent = document.fullscreenElement ? "🗗" : "⛶");
  fsBtn.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" } as any);
        try {
          await (screen.orientation as any)?.lock?.("any");
        } catch {}
      }
    } catch {
      toast("Tarayıcı tam ekranı desteklemiyor. Menüden 'Ana ekrana ekle' ile kurarsanız tam ekran açılır.");
    }
  });
  document.addEventListener("fullscreenchange", upd);
  if (fsOk || isTouchDevice()) $("#globals").prepend(fsBtn);
}
addEventListener("resize", () => renderCommands());

// ---------- görünüm küpü ----------
const cubeBox = h("div", "vcube");
const cube = h("div", "cube");
cubeBox.appendChild(cube);
$("#view").appendChild(cubeBox);
// her yüz 3×3 bölge: orta = yüz görünümü, kenar = iki yüz arası (45°), köşe = izometrik
type V3 = [number, number, number];
const cubeFaces: { v: string; label: string; tr: string; n: V3; up: V3; right: V3 }[] = [
  { v: "front", label: "Ön", tr: "rotateY(0deg)", n: [0, 0, 1], up: [0, 1, 0], right: [1, 0, 0] },
  { v: "back", label: "Arka", tr: "rotateY(180deg)", n: [0, 0, -1], up: [0, 1, 0], right: [-1, 0, 0] },
  { v: "right", label: "Sağ", tr: "rotateY(90deg)", n: [1, 0, 0], up: [0, 1, 0], right: [0, 0, -1] },
  { v: "left", label: "Sol", tr: "rotateY(-90deg)", n: [-1, 0, 0], up: [0, 1, 0], right: [0, 0, 1] },
  { v: "top", label: "Üst", tr: "rotateX(90deg)", n: [0, 1, 0], up: [0, 0, -1], right: [1, 0, 0] },
  { v: "bottom", label: "Alt", tr: "rotateX(-90deg)", n: [0, -1, 0], up: [0, 0, 1], right: [1, 0, 0] },
];
const CUBE = 35; // yarı kenar (px)
for (const F of cubeFaces) {
  const f = h("div", "face");
  f.style.transform = `${F.tr} translateZ(${CUBE}px)`;
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      const kind = row === 1 && col === 1 ? "c" : row === 1 || col === 1 ? "e" : "k";
      const cell = h("div", "cell " + kind, kind === "c" ? F.label : "");
      const i = col - 1, j = 1 - row;
      const dir = new THREE.Vector3(...F.n).add(new THREE.Vector3(...F.right).multiplyScalar(i)).add(new THREE.Vector3(...F.up).multiplyScalar(j));
      cell.title = kind === "c" ? F.label : kind === "e" ? "Kenardan (45°)" : "İzometrik köşe";
      cell.addEventListener("click", () => {
        if (kind === "c") return viewer.viewStd(F.v as any);
        const d = dir.clone().normalize();
        const up = Math.abs(d.y) > 0.99 ? new THREE.Vector3(...F.up) : new THREE.Vector3(0, 1, 0);
        viewer.setView(d, up);
      });
      f.appendChild(cell);
    }
  cube.appendChild(f);
}
const isoB = h("button", "iso", "İzo");
isoB.addEventListener("click", () => viewer.viewStd("iso"));
cubeBox.appendChild(isoB);
{
  // küpü sürükleyerek döndür
  let d: { x: number; y: number; moved: boolean } | null = null;
  cube.addEventListener("pointerdown", (e) => {
    d = { x: e.clientX, y: e.clientY, moved: false };
  });
  cube.addEventListener("pointermove", (e) => {
    if (!d || !(e.buttons & 1 || e.pointerType === "touch")) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    // sürükleme başlayınca yakala (tıklamalar hücreye ulaşsın diye önceden değil)
    if (!d.moved) try { cube.setPointerCapture(e.pointerId); } catch {}
    d.moved = true;
    viewer.controls.rotate(dx * 2, dy * 2);
    d.x = e.clientX;
    d.y = e.clientY;
  });
  cube.addEventListener("pointerup", () => setTimeout(() => (d = null)));
  cube.addEventListener("click", (e) => {
    if (d?.moved) e.stopPropagation();
  }, true);
}
function cubeOn() {
  return prefs.viewCube !== "off";
}
viewer.onRender(() => {
  cubeBox.hidden = !cubeOn();
  document.body.classList.toggle("has-cube", !cubeBox.hidden);
  if (cubeBox.hidden) return;
  const e = viewer.camera.matrixWorldInverse.elements;
  const S = [1, -1, 1];
  const m: number[] = [];
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) m.push(r < 3 && c < 3 ? S[r] * e[c * 4 + r] * S[c] : r === c ? 1 : 0);
  cube.style.transform = `matrix3d(${m.map((v) => v.toFixed(5)).join(",")})`;
});

// ---------- alt paneli küçült (telefon) ----------
{
  const minBtn = h("button", "sheet-min", "▾");
  minBtn.title = "Paneli küçült / büyüt";
  minBtn.addEventListener("click", () => $("#side").classList.toggle("min"));
  $("#pm .pm-head").insertBefore(minBtn, $("#pm-ok"));
  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target === viewer.renderer.domElement && prefs.autoMinSheet && e.pointerType !== "mouse" && sketchDrawing() && innerWidth <= 820) $("#side").classList.add("min");
    },
    true,
  );
}

// ---------- giriş ayarları penceresi ----------
function openInputSettings() {
  const dlg = document.createElement("dialog");
  dlg.className = "input-dialog";
  const render = () => {
    dlg.innerHTML = "";
    dlg.appendChild(h("h2", "", "Kalem ve dokunmatik ayarları"));
    const eff = effectiveProfile();
    const det = [detected.pen && "kalem", detected.penHover && "havada imleç", detected.penButton && "yan tuş", detected.touch && "dokunmatik", detected.mouse && "fare"].filter(Boolean).join(", ");
    dlg.appendChild(h("p", "pm-hint", `Algılanan: ${det || "henüz yok — ekrana kalemle dokunun"} · Kullanılan: ${PROFILE_INFO[eff].name}`));
    dlg.appendChild(h("h3", "", "Kalem tipi"));
    for (const k of Object.keys(PROFILE_INFO) as PenProfile[]) {
      const row = h("label", "prof" + (prefs.profile === k ? " on" : ""));
      const r = document.createElement("input");
      r.type = "radio";
      r.name = "prof";
      r.checked = prefs.profile === k;
      r.addEventListener("change", () => (savePrefs({ profile: k }), render()));
      const t = h("div", "");
      t.appendChild(h("b", "", PROFILE_INFO[k].name));
      t.appendChild(h("div", "small", PROFILE_INFO[k].desc));
      row.append(r, t);
      dlg.appendChild(row);
    }
    dlg.appendChild(h("h3", "", "Çizim"));
    const chk = (label: string, key: keyof typeof prefs) => {
      const l = h("label", "pm-check");
      const c = document.createElement("input");
      c.type = "checkbox";
      c.checked = !!prefs[key];
      c.addEventListener("change", () => (savePrefs({ [key]: c.checked } as any), render()));
      l.append(c, document.createTextNode(" " + label));
      dlg.appendChild(l);
    };
    const sel = (label: string, key: keyof typeof prefs, opts: [any, string][]) => {
      const l = h("label", "pm-field");
      l.appendChild(h("span", "", label));
      const sl = document.createElement("select");
      sl.innerHTML = opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
      sl.value = String(prefs[key]);
      sl.addEventListener("change", () => {
        const o = opts.find(([v]) => String(v) === sl.value)!;
        savePrefs({ [key]: o[0] } as any);
        render();
      });
      l.appendChild(sl);
      dlg.appendChild(l);
    };
    chk("Dokun–ayarla–kaldırınca yerleştir", "placeOnLift");
    chk("Dokunmatik fare (parmak imleci yavaşça kaydırır, kısa dokunuş tıklar — parmakla en hassas yöntem)", "touchpad");
    chk("Büyüteç", "loupe");
    sel("Büyüteç büyütmesi", "loupeZoom", [[2, "2×"], [2.5, "2,5×"], [3, "3×"], [4, "4×"]]);
    sel("Yakalama yarıçapı", "snapSize", [[0.7, "Küçük"], [1, "Orta"], [1.4, "Büyük"], [1.8, "Çok büyük"]]);
    sel("Parmakla çizimde imleç kayması", "cursorOffset", [[0, "Yok"], [50, "Az (50 px)"], [70, "Orta (70 px)"], [100, "Çok (100 px)"]]);
    chk("Yakalamada kısa titreşim", "haptic");
    dlg.appendChild(h("h3", "", "Kalem ve parmak hareketleri"));
    chk("Avuç reddi (kalem yakınken parmak dokunuşlarını yok say)", "palmReject");
    chk("Kalem yan tuşu = sağ tuş (bağlam menüsü, fare hareketleri)", "penButton");
    chk("Uzun basma: bağlam menüsü", "longPress");
    chk("İki parmak dokunuşu geri al, üç parmak ileri al", "fingerUndo");
    chk("İki parmakla çevirerek yuvarla (3B)", "twistRoll");
    dlg.appendChild(h("h3", "", "Ekran"));
    sel("Ekran çubuğu", "actionBar", [["auto", "Otomatik (dokunmatikte)"], ["on", "Açık"], ["off", "Kapalı"]]);
    sel("Görünüm küpü", "viewCube", [["auto", "Açık"], ["off", "Kapalı"]]);
    chk("Solak kullanım (çubuk ve büyüteç sol tarafta)", "leftHanded");
    chk("Çizime başlayınca alt paneli küçült", "autoMinSheet");
    const bar = h("div", "cut-bar");
    const reset = h("button", "btn", "Varsayılanlar");
    reset.addEventListener("click", () => (savePrefs({ ...DEFAULTS }), render()));
    const close = h("button", "btn primary", "Kapat");
    close.addEventListener("click", () => dlg.close());
    bar.append(reset, close);
    dlg.appendChild(bar);
  };
  render();
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
}
// ---------- şekil sihirbazı ----------
function openWizard() {
  if (mode.k === "sketch") exitSketch(true);
  if (mode.k === "pm") cancelFeature();
  const dlg = document.createElement("dialog");
  dlg.className = "input-dialog";
  let cur = WIZARDS[0];
  const vals: Record<string, Record<string, any>> = {};
  const render = () => {
    dlg.innerHTML = "";
    dlg.appendChild(h("h2", "", "Şekil sihirbazı"));
    dlg.appendChild(h("p", "pm-hint", "Ölçüleri yazın; parça eskiz + ekstrüzyon olarak oluşur ve sonradan düzenlenebilir."));
    const grid = h("div", "wiz-types");
    for (const w of WIZARDS) {
      const b = h("button", "btn" + (w === cur ? " primary" : ""), w.name);
      b.addEventListener("click", () => ((cur = w), render()));
      grid.appendChild(b);
    }
    dlg.appendChild(grid);
    const v = (vals[cur.id] ??= Object.fromEntries(cur.fields.map((f) => [f.k, f.v])));
    for (const f of cur.fields) {
      const l = h("label", "pm-field");
      l.appendChild(h("span", "", f.label));
      const inp = document.createElement("input");
      if (typeof f.v === "number") inp.inputMode = "decimal";
      inp.value = String(v[f.k]);
      inp.addEventListener("input", () => (v[f.k] = typeof f.v === "number" ? evalNum(inp.value) ?? v[f.k] : inp.value));
      l.appendChild(inp);
      dlg.appendChild(l);
    }
    const bar = h("div", "cut-bar");
    const cancel = h("button", "btn", "Kapat");
    cancel.addEventListener("click", () => dlg.close());
    const ok = h("button", "btn primary", "Oluştur");
    ok.addEventListener("click", () => {
      const fs = cur.build(v, uid);
      if (!fs.length) return toast("Ölçüler okunamadı", true);
      dlg.close();
      commitDoc(() => doc.features.push(...fs));
      treeSel = null;
      viewer.viewStd("iso");
      firstBuild = true;
      toast(`${cur.name} oluşturuldu`);
    });
    bar.append(cancel, ok);
    dlg.appendChild(bar);
  };
  render();
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
}

// ---------- ilk açılış rehberi ----------
function openWelcome() {
  const dlg = document.createElement("dialog");
  dlg.className = "input-dialog";
  dlg.innerHTML = `<h2>İmaj CAD'e hoş geldiniz</h2><p class="pm-hint">Nasıl kullanacaksınız? (Sonra Dosya › Kalem ve dokunmatik ayarları'ndan değiştirebilirsiniz)</p>`;
  const opts: [string, Partial<typeof prefs>][] = [
    ["🖱 Fare ve klavye (SolidWorks gibi)", { profile: "mouse" }],
    ["✒ Kalem", { profile: "auto" }],
    ["☝ Parmak — imleç parmağın üstünde", { profile: "finger", touchpad: false }],
    ["☝ Parmak — dokunmatik fare (en hassas)", { profile: "finger", touchpad: true }],
  ];
  for (const [l, p] of opts) {
    const b = h("button", "btn wide", l);
    b.addEventListener("click", () => (savePrefs(p), dlg.querySelectorAll(".wide").forEach((x) => x.classList.remove("primary")), b.classList.add("primary")));
    dlg.appendChild(b);
  }
  dlg.appendChild(h("h3", "", "İlk parça: 5 adım"));
  const ol = document.createElement("ol");
  ol.className = "small";
  ol.innerHTML = "<li>Ağaçtan <b>Ön/Üst/Sağ Düzlem</b>'e dokunun → <b>Eskiz</b>.</li><li><b>Dikdörtgen</b> veya <b>Daire</b> çizin (ya da <b>123</b> ile ölçüyü yazın).</li><li><b>Akıllı Ölçü</b> ile ölçüleri düzeltin.</li><li>✓ ile eskizden çıkın → çıkan <b>Ekstrüzyon</b> önerisine dokunun.</li><li>Bir yüze dokunup <b>Delik Sihirbazı</b> veya yeni eskizle devam edin.</li>";
  dlg.appendChild(ol);
  const bar = h("div", "cut-bar");
  const wiz = h("button", "btn", "Hiç çizmeden: şekil sihirbazı");
  wiz.addEventListener("click", () => (dlg.close(), openWizard()));
  const go = h("button", "btn primary", "Başla");
  go.addEventListener("click", () => dlg.close());
  bar.append(wiz, go);
  dlg.appendChild(bar);
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => {
    dlg.remove();
    try {
      localStorage.setItem("imajcad.welcomed", "1");
    } catch {}
  });
  dlg.showModal();
}
try {
  if (!localStorage.getItem("imajcad.welcomed") && !(navigator as any).webdriver) setTimeout(openWelcome, 600);
} catch {}

// otomatik profilde kalem ilk algılandığında bilgi ver
{
  let told = "";
  onPrefs(() => {
    renderActBar();
    viewer.requestRender();
    const p = effectiveProfile();
    if (prefs.profile === "auto" && p !== told && (p === "hover" || p === "active")) {
      if (told) toast(`Kalem algılandı: ${PROFILE_INFO[p].name}. Ayarlardan değiştirebilirsiniz.`);
      told = p;
    }
  });
  told = effectiveProfile();
}

// =====================================================================
// Başlangıç
// =====================================================================
(async () => {
  try {
    await initSolver();
  } catch (e) {
    toast("Eskiz çözücüsü yüklenemedi: " + (e as Error).message, true);
  }
  kernel.ready.then(
    () => {},
    (e) => {
      setStatus("err", "Çekirdek yüklenemedi");
      toast("Geometri çekirdeği yüklenemedi: " + e.message, true);
    },
  );
  applyEquations();
  renderTree();
  renderCommands();
  updatePlanes();
  rebuild();
  if (!doc.features.length) hint("Başlamak için bir düzlem seçip Eskiz'e basın");
})();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

// Test ve hata ayıklama için
/** başlığı verilen komutun grubunu aç (testler ve kısayollar için) */
function showCmd(title: string) {
  const all = commands();
  let g = 0;
  for (const c of all) {
    if (c === "sep") g++;
    else if (c.label === title) {
      if (g > 0) groupSel[tab] = g;
      renderCommands();
      return true;
    }
  }
  return false;
}
(window as any).__app = {
  showCmd,
  get doc() { return doc; },
  get mode() { return mode; },
  viewer,
  /** testler için: belgeyi değiştir */
  setDoc(d: PartDoc) { treeSel = null; commitDoc(() => (doc = d)); },
  kernel,
};
