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
  FlatResult,
} from "./doc/types";
import { lastSheetBase, sheetParamsBefore, bendAllowance } from "./sheet/sheet";
import { flatToDxf } from "./sheet/dxf";
import { holeDefaults, MATERIALS, sizesFor, threadMajor, threadLabel } from "./doc/standards";
import * as THREE from "three";
import { ICONS } from "./ui/icons";
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
    const live = !["fillet", "chamfer", "shell", "draft"].includes(d.type) && !((d.type === "edgeflange" || d.type === "hem") && !(d as any)._preview);
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
    const { kfeats, errors } = compile(feats);
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
    const col = treeSel === f.id ? 0x0ca5e9 : 0x1f2a37;
    if (segs.length) sketchGroup.push(viewer.fatLines(segs, col, 1.6));
    if (cons.length) sketchGroup.push(viewer.fatLines(cons, 0x6b7686, 1, true));
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
    if (m && (d.type === "edgeflange" || d.type === "hem") && !(d as any)._preview) sel.edges = d.edges.map((r) => nearestEdge(r)).filter((i) => i >= 0);
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
    const d = dist3(f.c, r.c);
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
function pickWant() {
  if (mode.k === "pickSketchPlane") return { face: true, plane: true };
  if (mode.k === "pm") {
    const t = mode.draft.type;
    if (t === "fillet" && mode.draft.type === "fillet" && mode.draft.kind === "full") return { face: true };
    if (t === "fillet" || t === "chamfer") return { edge: true, face: true };
    if (t === "edgeflange" || t === "hem") return (mode.draft as any)._preview ? {} : { edge: true };
    if (t === "shell" || t === "draft" || t === "hole" || t === "dome" || t === "wrap") return { face: true };
    if (t === "axis") return { edge: true };
    if (t === "point" || t === "csys") return { edge: true, face: true };
    if (t === "extrude") return mode.draft.type === "extrude" && (mode.draft.end === "surface" || mode.draft.end === "offset") ? { face: true } : {};
    if (t === "mirror" || t === "plane") return { face: true, plane: true };
    return {};
  }
  if (mode.k === "measure") return { face: true, edge: true };
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
  // normal seçim
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
  return { c: f.c, n: f.n };
}
function patternable(before = insertAt()) {
  return doc.features.slice(0, before).filter((f) => (f.type === "extrude" || f.type === "revolve") && !f.off);
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
  if ((draft.type === "edgeflange" || draft.type === "hem") && !draft.edges.length) return toast("Flanş eklenecek kenarı seçin", true);
  delete (draft as any)._origin;
  if ((draft.type === "edgeflange" || draft.type === "hem") && (draft as any)._preview) {
    delete (draft as any)._preview;
    if (draftError) return toast(draftError, true);
  } else delete (draft as any)._preview;
  if (draft.type === "extrude" && (draft.end === "surface" || draft.end === "offset") && !draft.face) return toast("Hedef yüzü seçin", true);
  if (draftError && !["fillet", "chamfer", "shell", "draft", "edgeflange", "hem"].includes(draft.type)) return toast(draftError, true);
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
  } else if ((d.type === "edgeflange" || d.type === "hem") && hit.kind === "edge" && m) {
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
let tab: "features" | "sketch" | "evaluate" | "sheet" = "features";
function setTab(t: "features" | "sketch" | "evaluate" | "sheet") {
  tab = t;
  document.querySelectorAll<HTMLButtonElement>("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
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
      { id: "lpattern", label: "Doğrusal Çoğ.", icon: "lpattern", run: () => newFeature("lpattern") },
      { id: "cpattern", label: "Dairesel Çoğ.", icon: "cpattern", run: () => newFeature("cpattern") },
      { id: "mirror", label: "Ayna", icon: "mirror", run: () => newFeature("mirror") },
      "sep",
      { id: "plane", label: "Ref. Düzlem", icon: "plane", run: () => newFeature("plane") },
      { id: "axis", label: "Ref. Eksen", icon: "axisf", run: () => newFeature("axis") },
      { id: "point", label: "Ref. Nokta", icon: "pointf", run: () => newFeature("point") },
      { id: "csys", label: "Koord. Sist.", icon: "csysf", run: () => newFeature("csys") },
      { id: "sketch", label: "Eskiz", icon: "sketch", run: () => beginSketchCommand() },
    ];
  if (tab === "sheet")
    return [
      { id: "sheetbase", label: "Taban Flanş", icon: "sheetbase", run: () => newFeature("sheetbase") },
      { id: "edgeflange", label: "Kenar Flanş", icon: "edgeflange", run: () => newFeature("edgeflange") },
      { id: "hem", label: "Kenet", icon: "hem", run: () => newFeature("hem") },
      { id: "sketchbend", label: "Çizgiden Büküm", icon: "sketchbend", run: () => newFeature("sketchbend") },
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

function renderCommands() {
  const box = $("#cmds");
  box.innerHTML = "";
  for (const c of commands()) {
    if (c === "sep") {
      box.appendChild(h("div", "cmd-sep"));
      continue;
    }
    const b = h("button", "cmd" + (c.active?.() ? " active" : ""));
    b.innerHTML = ICONS[c.icon] ?? "";
    b.appendChild(h("span", "lbl", c.label));
    b.title = c.label;
    b.addEventListener("click", () => {
      c.run();
      renderCommands();
    });
    box.appendChild(b);
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
    const b = h("button", active ? "active" : "");
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
    if (mode.k === "sketch") exitSketch(true);
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
window.addEventListener("keydown", (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "z") {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  } else if ((e.ctrlKey || e.metaKey) && k === "y") {
    e.preventDefault();
    redo();
  } else if (e.key === "Escape") {
    if (mode.k === "sketch") {
      if (mode.editor.tool !== "select") mode.editor.setTool("select");
      else mode.editor.sel.clear(), mode.editor.render(), mode.editor.renderPanel();
      renderCommands();
    } else if (mode.k === "pickSketchPlane") cancelPick();
    else if (mode.k === "pm") cancelFeature();
    else if (mode.k === "measure" || mode.k === "section") endAux(), renderCommands();
    else {
      clearPartSel();
      treeSel = null;
      renderTree();
      refreshHighlight();
    }
  } else if (e.key === "Delete" || e.key === "Backspace") {
    if (mode.k === "sketch") mode.editor.deleteSelection();
    else if (mode.k === "part") deleteSelectedPart();
  } else if (e.key === "Enter" && mode.k === "sketch") mode.editor.finishChain();
  else if (mode.k === "sketch" && !e.ctrlKey && !e.metaKey) {
    const map: Record<string, SkTool> = { l: "line", r: "rect", c: "circle", d: "dim", s: "select", t: "trim", a: "tarc", p: "point" };
    if (map[k]) {
      mode.editor.setTool(map[k]);
      renderCommands();
    }
  }
});

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
(window as any).__app = {
  get doc() { return doc; },
  get mode() { return mode; },
  viewer,
  /** testler için: belgeyi değiştir */
  setDoc(d: PartDoc) { treeSel = null; commitDoc(() => (doc = d)); },
  kernel,
};
