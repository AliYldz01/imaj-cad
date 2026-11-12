import "./style.css";
import { Viewer, type InputHandler, type PickHit } from "./viewer";
import { Kernel } from "./kernel";
import { initSolver } from "./sketch/solver";
import { SketchEditor, TOOL_NAMES, type SkTool } from "./sketch/editor";
import { newSketch } from "./sketch/model";
import { pointPos } from "./sketch/profile";
import { compile, resolveFrame, sketchUsers } from "./doc/compile";
import { STD_FRAMES, STD_NAMES, dist3, fmtNum, frameFromNormal, toWorld, toLocal } from "./doc/math";
import type {
  EdgeRef, Feature, FaceRef, PartDoc, PlaneRef, SketchFeature, StdPlane, Vec3, ExtrudeFeature, RevolveFeature, HoleFeature, MeasureItem, Vec2,
} from "./doc/types";
import { HOLE_SIZES, holeDefaults, MATERIALS } from "./doc/standards";
import * as THREE from "three";
import { ICONS } from "./ui/icons";
import { h, numField, checkField, selectField, segField, group, button } from "./ui/dom";

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
  renderTree();
  updatePlanes();
  rebuild();
  updateUndo();
}
const FEAT_NAMES: Record<string, string> = {
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
};
function nextName(key: string) {
  doc.seq[key] = (doc.seq[key] ?? 0) + 1;
  return `${FEAT_NAMES[key] ?? key}${doc.seq[key]}`;
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
  | { k: "section" };
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
  const all = doc.features;
  if (mode.k === "sketch" && !mode.isNew) return { feats: all.slice(0, featIndex(mode.featId)) };
  if (mode.k === "pm") {
    const d = mode.draft;
    const live = !["fillet", "chamfer", "shell", "draft"].includes(d.type);
    const base = mode.editingId ? all.slice(0, featIndex(mode.editingId)) : all;
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
    else if (mode.k !== "sketch") setStatus("ok", `Hazır · ${Math.round(performance.now() - t0)} ms`);
    if (firstBuild && res.mesh) viewer.fit();
    firstBuild = false;
    clearPartSel();
    renderTree();
    drawSketches();
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
    if (t === "fillet" || t === "chamfer") return { edge: true, face: true };
    if (t === "shell" || t === "draft" || t === "hole") return { face: true };
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
  doc.features.push(f);
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
  if (!keep) {
    if (isNew) doc.features = doc.features.filter((x) => x.id !== featId);
    else f.data = JSON.parse(orig);
    undoStack.pop();
  } else if (isNew && !f.data.ents.length) {
    doc.features = doc.features.filter((x) => x.id !== featId);
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

function lastFreeSketch(before = doc.features.length): SketchFeature | undefined {
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
      draft = { id, type: "hole", name: "", htype: "simple", size: "M8", ...holeDefaults("simple", "M8"), through: true, plane: pl && pl.k === "face" ? pl : null, pts: [] } as HoleFeature;
      break;
    }
    case "draft":
      draft = { id, type: "draft", name: "", angle: 3, plane: planeRefFromSelection() ?? { k: "std", n: "top" }, faces: [...psel.faces].map((i) => faceRef(i)), rev: false };
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
function patternable(before = doc.features.length) {
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
  if (draft.type === "extrude" && (draft.end === "surface" || draft.end === "offset") && !draft.face) return toast("Hedef yüzü seçin", true);
  if (draftError && !["fillet", "chamfer", "shell", "draft"].includes(draft.type)) return toast(draftError, true);
  mode = { k: "part" };
  hidePM();
  commitDoc(() => {
    if (editingId) doc.features = doc.features.map((f) => (f.id === editingId ? draft : f));
    else {
      nextName(kind);
      doc.features.push(draft);
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
      if (e.end === "blind" || e.end === "mid") g1.appendChild(numField("Derinlik", e.d1, (v) => ((e.d1 = v), upd()), { min: 0.001, unit: "mm" }));
      if (e.end === "surface" || e.end === "offset") {
        g1.appendChild(h("div", "pm-picks", e.face ? "Hedef yüz seçili" : "Hedef yüze dokunun (eskize paralel düz yüz)"));
        if (e.end === "offset") g1.appendChild(numField("Öteleme mesafesi", e.offd ?? 0, (v) => ((e.offd = v), upd()), { unit: "mm" }));
      }
      g1.appendChild(checkField("Yönü ters çevir", e.rev, (v) => ((e.rev = v), upd())));
      if (e.end !== "through" && e.end !== "mid") {
        g1.appendChild(checkField("Koniklik", !!e.draft, (v) => ((e.draft = v ? 3 : 0), renderFeaturePM(kind), upd())));
        if (e.draft) {
          g1.appendChild(numField("Koniklik açısı", e.draft, (v) => ((e.draft = v), upd()), { min: 0.01, unit: "°" }));
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
          if (e.end2 === "blind") g2.appendChild(numField("Derinlik", e.d2, (v) => ((e.d2 = v), upd()), { min: 0.001, unit: "mm" }));
        }
        body.appendChild(g2);
      }
      body.appendChild(
        segField([{ v: "boss", t: "Malzeme ekle" }, { v: "cut", t: "Kes" }], e.cut ? "cut" : "boss", (v) => {
          e.cut = v === "cut";
          upd();
        }),
      );
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
      const g = group("Açı", numField("Açı", r.angle, (v) => ((r.angle = v), upd()), { min: 0.01, unit: "°" }));
      g.appendChild(checkField("Orta düzlem", r.mid, (v) => ((r.mid = v), upd())));
      g.appendChild(checkField("Yönü ters çevir", r.rev, (v) => ((r.rev = v), upd())));
      body.appendChild(g);
      body.appendChild(segField([{ v: "boss", t: "Malzeme ekle" }, { v: "cut", t: "Kes" }], r.cut ? "cut" : "boss", (v) => ((r.cut = v === "cut"), upd())));
      break;
    }
    case "fillet":
    case "chamfer": {
      const isF = d.type === "fillet";
      body.appendChild(
        group(
          isF ? "Radyüs parametreleri" : "Pah parametreleri",
          numField(isF ? "Yarıçap" : "Mesafe", isF ? d.r : d.d, (v) => (isF ? (d.r = v) : (d.d = v)), { min: 0.001, unit: "mm" }),
        ),
      );
      const nf = (d.faces ?? []).length;
      const picks = h("div", "pm-picks", d.edges.length || nf ? `${d.edges.length} kenar, ${nf} yüz seçili` : "Kenarlara veya yüzlere dokunun");
      const g = group("Kenarlar ve yüzler", picks, h("p", "pm-hint", "Bir yüz seçmek o yüzün tüm kenarlarını seçer."));
      if (d.edges.length || nf) g.appendChild(button("Seçimi temizle", () => ((d.edges = []), (d.faces = []), renderFeaturePM(kind), refreshHighlight())));
      body.appendChild(g);
      hint(isF ? "Yuvarlatılacak kenarlara veya yüzlere dokunun" : "Pah kırılacak kenarlara veya yüzlere dokunun");
      break;
    }
    case "shell": {
      body.appendChild(group("Parametreler", numField("Kalınlık", d.t, (v) => (d.t = v), { min: 0.001, unit: "mm" })));
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
        numField("Aralık", d.spacing, (v) => ((d.spacing = v), upd()), { min: 0.001, unit: "mm" }),
        numField("Adet", d.count, (v) => ((d.count = v), upd()), { min: 1, int: true }),
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
          numField(d.equal ? "Toplam açı" : "Aralık açısı", d.angle, (v) => ((d.angle = v), upd()), { min: 0.01, unit: "°" }),
          numField("Adet", d.count, (v) => ((d.count = v), upd()), { min: 2, int: true }),
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
      body.appendChild(group("Seçenekler", checkField("Düz yüzeyli (ruled)", d.ruled, (v) => ((d.ruled = v), upd()))));
      body.appendChild(segField([{ v: "boss", t: "Malzeme ekle" }, { v: "cut", t: "Kes" }], d.cut ? "cut" : "boss", (v) => ((d.cut = v === "cut"), upd())));
      break;
    }
    case "hole": {
      const hf = d as HoleFeature;
      const setStd = () => {
        if (hf.size !== "custom") Object.assign(hf, holeDefaults(hf.htype, hf.size));
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
          selectField("Boyut", [...Object.keys(HOLE_SIZES).map((k) => ({ v: k, t: k })), { v: "custom", t: "Özel" }], hf.size, (v) => {
            hf.size = v;
            setStd();
            renderFeaturePM(kind);
            upd();
          }),
        ),
      );
      const g = group(
        "Ölçüler",
        numField(hf.htype === "tap" ? "Matkap çapı" : "Delik çapı", hf.d, (v) => ((hf.d = v), (hf.size = "custom"), upd()), { min: 0.01, unit: "mm" }),
        checkField("Tümünden geçen", hf.through, (v) => ((hf.through = v), renderFeaturePM(kind), upd())),
      );
      if (!hf.through) g.appendChild(numField("Derinlik", hf.depth, (v) => ((hf.depth = v), upd()), { min: 0.01, unit: "mm" }));
      if (hf.htype === "cbore") {
        g.appendChild(numField("Havşa çapı", hf.cd, (v) => ((hf.cd = v), upd()), { min: 0.01, unit: "mm" }));
        g.appendChild(numField("Havşa derinliği", hf.cdepth, (v) => ((hf.cdepth = v), upd()), { min: 0.01, unit: "mm" }));
      }
      if (hf.htype === "csink") {
        g.appendChild(numField("Konik havşa çapı", hf.cd, (v) => ((hf.cd = v), upd()), { min: 0.01, unit: "mm" }));
        g.appendChild(numField("Havşa açısı", hf.cangle, (v) => ((hf.cangle = v), upd()), { min: 1, unit: "°" }));
      }
      if (hf.htype === "tap") g.appendChild(h("p", "pm-hint", `Kılavuz için matkap çapı. Diş: ${hf.size !== "custom" ? hf.size : "özel"}`));
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
    case "plane": {
      body.appendChild(group("Referans", planeField("Temel düzlem / yüz", () => d.base, (r) => (d.base = r))));
      body.appendChild(
        group(
          "Öteleme",
          numField("Mesafe", d.offset, (v) => ((d.offset = v), updatePlanePreview()), { unit: "mm" }),
          checkField("Ters çevir", d.flip, (v) => ((d.flip = v), updatePlanePreview())),
        ),
      );
      updatePlanePreview();
      break;
    }
  }
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
};

function renderTree() {
  $("#part-name").textContent = doc.name;
  const ul = $("#tree");
  ul.innerHTML = "";
  const rollIdx = mode.k === "sketch" && !mode.isNew ? featIndex(mode.featId) : mode.k === "pm" && mode.editingId ? featIndex(mode.editingId) : Infinity;
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
  doc.features.forEach((f, i) => {
    if (f.type === "sketch" && consumerOf(f.id)) return;
    const err = featureErrors.get(f.id);
    const cls = [err ? "err" : "", f.off ? "off" : "", i >= rollIdx ? "rolled" : ""].join(" ");
    const li = row(f.id, f.name, FEAT_ICON[kindOf(f)] ?? "file", cls);
    if (err) li.title = err;
    const kids = f.type === "extrude" || f.type === "revolve" ? [f.sketch] : f.type === "sweep" ? [f.sketch, f.path] : f.type === "loft" ? f.sketches : [];
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
let tab: "features" | "sketch" | "evaluate" = "features";
function setTab(t: "features" | "sketch" | "evaluate") {
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
      "sep",
      { id: "lpattern", label: "Doğrusal Çoğ.", icon: "lpattern", run: () => newFeature("lpattern") },
      { id: "cpattern", label: "Dairesel Çoğ.", icon: "cpattern", run: () => newFeature("cpattern") },
      { id: "mirror", label: "Ayna", icon: "mirror", run: () => newFeature("mirror") },
      "sep",
      { id: "plane", label: "Ref. Düzlem", icon: "plane", run: () => newFeature("plane") },
      { id: "sketch", label: "Eskiz", icon: "sketch", run: () => beginSketchCommand() },
    ];
  if (tab === "evaluate")
    return [
      { id: "measure", label: "Ölç", icon: "measure", run: () => startMeasure(), active: () => mode.k === "measure" },
      { id: "mass", label: "Kütle Özell.", icon: "mass", run: () => showMassProps() },
      { id: "section", label: "Kesit", icon: "section", run: () => openSection(), active: () => !!section },
      { id: "material", label: "Malzeme", icon: "material", run: () => chooseMaterial() },
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
    "sep",
    skTool("fillet", "sfillet", "Eskiz Radyüs"),
    skTool("schamfer", "schamfer", "Eskiz Pahı"),
    skTool("trim", "trim"),
    skTool("extend", "extend"),
    skTool("offset", "offset", "Ötele"),
    skTool("convert", "convert", "Dönüştür"),
    skTool("mirror", "smirror", "Aynala"),
    skTool("spat", "spat", "Doğrusal Çoğ."),
    skTool("scpat", "scpat", "Dairesel Çoğ."),
    skTool("move", "move", "Taşı/Kopyala"),
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
(window as any).__app = { get doc() { return doc; }, get mode() { return mode; }, viewer };
