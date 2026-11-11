import "./style.css";
import { Viewer } from "./viewer";
import { Kernel } from "./kernel";
import { Sketcher, profileLabel, type SketchTool } from "./sketch";
import type { ExtrudeFeature, Feature, Operation, Profile } from "./types";

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const STORE_KEY = "imajcad.features.v1";

// ---------- Durum ----------
let features: Feature[] = load();
const undoStack: Feature[][] = [];
const redoStack: Feature[][] = [];
let errors = new Map<string, string>();

function load(): Feature[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(features));
  } catch {
    /* depolama kullanılamıyor olabilir */
  }
}
function commit(next: Feature[]) {
  undoStack.push(features);
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
  features = next;
  afterChange();
}
function afterChange() {
  save();
  renderTree();
  updateUndoButtons();
  rebuild();
}

// ---------- Bileşenler ----------
const viewer = new Viewer($("#view"));
const kernel = new Kernel();
const sketcher = new Sketcher(viewer);

// ---------- Durum çubuğu ve bildirim ----------
function setStatus(kind: "ok" | "busy" | "err" | "load", text: string) {
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
  toastTimer = window.setTimeout(() => (t.hidden = true), isErr ? 5000 : 2500);
}

// ---------- Model hesaplama ----------
let building = false;
let dirty = false;
let firstBuild = true;
async function rebuild() {
  if (building) {
    dirty = true;
    return;
  }
  building = true;
  setStatus("busy", "Hesaplanıyor…");
  try {
    const t0 = performance.now();
    const res = await kernel.build(features);
    viewer.setModel(res.mesh);
    errors = new Map(res.errors.map((e) => [e.featureId, e.message]));
    renderTree();
    if (firstBuild && res.mesh) viewer.fit();
    firstBuild = false;
    const ms = Math.round(performance.now() - t0);
    if (res.errors.length) {
      setStatus("err", `${res.errors.length} adımda hata`);
      toast(res.errors[0].message, true);
    } else setStatus("ok", features.length ? `Hazır · ${ms} ms` : "Hazır");
  } catch (e) {
    setStatus("err", "Çekirdek hatası");
    toast(String((e as Error).message), true);
  } finally {
    building = false;
    if (dirty) {
      dirty = false;
      rebuild();
    }
  }
}

kernel.ready.then(
  () => setStatus("ok", "Hazır"),
  (e) => {
    setStatus("err", "Çekirdek yüklenemedi");
    toast("Geometri çekirdeği yüklenemedi: " + e.message, true);
  },
);
rebuild();

// ---------- Araçlar ----------
const HINTS: Record<string, string> = {
  rect: "Köşeden köşeye sürükleyin · Katının üst yüzeyine de çizebilirsiniz",
  circle: "Merkezden dışarı sürükleyin",
  poly: "Noktalara dokunun · İlk noktaya dokunarak kapatın",
  orbit: "",
};
let currentTool: SketchTool | "orbit" = "orbit";
function setTool(t: SketchTool | "orbit") {
  currentTool = t;
  document.querySelectorAll<HTMLButtonElement>("#tools button").forEach((b) => b.classList.toggle("active", b.dataset.tool === t));
  $("#hint").textContent = HINTS[t] ?? "";
  if (t === "orbit") {
    sketcher.setTool(null);
    viewer.setRotateEnabled(true);
  } else {
    closePanel(false);
    sketcher.setTool(t);
    viewer.setRotateEnabled(false);
    viewer.viewTop();
  }
}
document.querySelectorAll<HTMLButtonElement>("#tools button").forEach((b) =>
  b.addEventListener("click", () => setTool(b.dataset.tool as any)),
);

sketcher.onPolyChange = (n) => {
  $("#poly-actions").hidden = n === 0;
  ($("#poly-close") as HTMLButtonElement).disabled = n < 3;
};
$("#poly-close").addEventListener("click", () => sketcher.closePoly());
$("#poly-undo").addEventListener("click", () => sketcher.undoPolyPoint());

sketcher.onComplete = (profile, z) => {
  $("#hint").textContent = "";
  const op: Operation = z > 0 ? "cut" : "add";
  openPanel({
    id: "f" + Date.now().toString(36),
    type: "extrude",
    profile,
    z,
    depth: op === "cut" ? -throughDepth(z) : 20,
    op,
  });
};

/** Z'den modelin altına kadar olan mesafe (boydan boya delik için) */
function throughDepth(z: number) {
  const minZ = viewer.bbox ? viewer.bbox.min.z : 0;
  return Math.max(1, Math.round((z - minZ) * 1000) / 1000);
}

// ---------- Görünüşler ----------
$("#v-top").addEventListener("click", () => viewer.viewTop());
$("#v-front").addEventListener("click", () => viewer.viewFront());
$("#v-iso").addEventListener("click", () => {
  if (currentTool !== "orbit") setTool("orbit");
  viewer.viewIso();
});
$("#v-fit").addEventListener("click", () => viewer.fit());

// ---------- Geri al / yinele ----------
function updateUndoButtons() {
  ($("#undo") as HTMLButtonElement).disabled = undoStack.length === 0;
  ($("#redo") as HTMLButtonElement).disabled = redoStack.length === 0;
}
$("#undo").addEventListener("click", () => {
  const prev = undoStack.pop();
  if (!prev) return;
  redoStack.push(features);
  features = prev;
  closePanel(false);
  afterChange();
});
$("#redo").addEventListener("click", () => {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push(features);
  features = next;
  closePanel(false);
  afterChange();
});
updateUndoButtons();

// ---------- Özellik ağacı ----------
const KIND_NAME = { rect: "Dikdörtgen", circle: "Daire", poly: "Çokgen" } as const;
const fmt = (v: number) => (Math.round(v * 1000) / 1000).toString().replace(".", ",");
function renderTree() {
  const ol = $("#tree-list");
  ol.innerHTML = "";
  if (!features.length) {
    ol.innerHTML = '<li class="muted">Henüz adım yok. Bir şekil çizerek başlayın.</li>';
    return;
  }
  features.forEach((f) => {
    const li = document.createElement("li");
    const err = errors.get(f.id);
    if (err) li.classList.add("err");
    li.innerHTML = `<b>${KIND_NAME[f.profile.kind]}</b> ${profileLabel(f.profile)} · h ${fmt(f.depth)}${f.z ? ` · Z ${fmt(f.z)}` : ""}
      <span class="op ${f.op}">${f.op === "add" ? "Ekle" : "Çıkar"}</span>${err ? `<span class="err-msg"></span>` : ""}`;
    if (err) li.querySelector(".err-msg")!.textContent = err;
    li.addEventListener("click", () => {
      $("#tree").hidden = true;
      setTool("orbit");
      openPanel(structuredClone(f), true);
    });
    ol.appendChild(li);
  });
}
$("#tree-btn").addEventListener("click", () => {
  $("#tree").hidden = !$("#tree").hidden;
  $("#export-menu").hidden = true;
});
$("#tree-close").addEventListener("click", () => ($("#tree").hidden = true));
renderTree();

// ---------- Ölçü paneli ----------
let draft: ExtrudeFeature | null = null;
let editing = false;

/** "100/2", "40+12,5" gibi basit ifadeleri hesaplar */
function evalNum(s: string): number | null {
  const t = s.trim().replace(/,/g, ".");
  if (!t) return null;
  if (!/^[0-9+\-*/(). ]+$/.test(t)) return null;
  try {
    const v = Function(`"use strict";return (${t});`)();
    return typeof v === "number" && isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

type FieldDef = { key: string; label: string; get: (p: Profile) => number; set: (p: Profile, v: number) => void; min?: number };
function fieldDefs(p: Profile): FieldDef[] {
  if (p.kind === "rect")
    return [
      { key: "w", label: "Genişlik (X)", get: (p: any) => p.w, set: (p: any, v) => (p.w = v), min: 0 },
      { key: "h", label: "Boy (Y)", get: (p: any) => p.h, set: (p: any, v) => (p.h = v), min: 0 },
      { key: "x", label: "Köşe X", get: (p: any) => p.x, set: (p: any, v) => (p.x = v) },
      { key: "y", label: "Köşe Y", get: (p: any) => p.y, set: (p: any, v) => (p.y = v) },
    ];
  if (p.kind === "circle")
    return [
      { key: "d", label: "Çap", get: (p: any) => p.r * 2, set: (p: any, v) => (p.r = v / 2), min: 0 },
      { key: "cx", label: "Merkez X", get: (p: any) => p.cx, set: (p: any, v) => (p.cx = v) },
      { key: "cy", label: "Merkez Y", get: (p: any) => p.cy, set: (p: any, v) => (p.cy = v) },
    ];
  return [];
}

function openPanel(f: ExtrudeFeature, isEdit = false) {
  draft = f;
  editing = isEdit;
  $("#panel-title").textContent = `${KIND_NAME[f.profile.kind]}${isEdit ? " — düzenle" : ""}`;
  const box = $("#panel-fields");
  box.innerHTML = "";
  for (const d of fieldDefs(f.profile)) {
    const label = document.createElement("label");
    label.textContent = d.label;
    const inp = document.createElement("input");
    inp.inputMode = "decimal";
    inp.autocomplete = "off";
    inp.value = fmt(d.get(f.profile));
    inp.addEventListener("input", () => {
      const v = evalNum(inp.value);
      const ok = v !== null && (d.min === undefined || v > d.min);
      inp.classList.toggle("bad", !ok);
      if (ok && draft) {
        d.set(draft.profile, v!);
        sketcher.showProfile(draft.profile, draft.z);
      }
    });
    label.appendChild(inp);
    box.appendChild(label);
  }
  if (f.profile.kind === "poly") {
    box.innerHTML = `<p class="muted small" style="grid-column:1/-1;margin:0">${f.profile.pts.length} noktalı çokgen. Kenar ölçülerini düzenleme sonraki sürümde gelecek.</p>`;
  }
  ($("#f-z") as HTMLInputElement).value = fmt(f.z);
  ($("#f-depth") as HTMLInputElement).value = fmt(f.depth);
  setOpButtons(f.op);
  $("#panel-ok").textContent = isEdit ? "Güncelle" : "Katı Yap";
  $("#panel-delete").hidden = !isEdit;
  $("#panel").hidden = false;
  sketcher.showProfile(f.profile, f.z);
}

function setOpButtons(op: Operation) {
  document.querySelectorAll<HTMLButtonElement>("#f-op button").forEach((b) => b.classList.toggle("active", b.dataset.op === op));
}
document.querySelectorAll<HTMLButtonElement>("#f-op button").forEach((b) =>
  b.addEventListener("click", () => {
    if (!draft) return;
    const op = b.dataset.op as Operation;
    if (op === draft.op) return;
    draft.op = op;
    setOpButtons(op);
    // Çıkar seçilince, üst yüzeye çizildiyse varsayılan olarak boydan boya delik öner.
    const dInp = $("#f-depth") as HTMLInputElement;
    const z = evalNum(($("#f-z") as HTMLInputElement).value) ?? draft.z;
    if (op === "cut" && z > (viewer.bbox?.min.z ?? 0)) dInp.value = fmt(-throughDepth(z));
    else if (op === "add" && (evalNum(dInp.value) ?? 0) < 0) dInp.value = fmt(20);
  }),
);
($("#f-z") as HTMLInputElement).addEventListener("input", () => {
  const z = evalNum(($("#f-z") as HTMLInputElement).value);
  if (z !== null && draft) sketcher.showProfile(draft.profile, z);
});

function closePanel(clear = true) {
  $("#panel").hidden = true;
  draft = null;
  if (clear) sketcher.clearPreview();
  else sketcher.clearPreview();
}

$("#panel-cancel").addEventListener("click", () => {
  closePanel();
  if (currentTool !== "orbit") $("#hint").textContent = HINTS[currentTool];
});
$("#panel-delete").addEventListener("click", () => {
  if (!draft) return;
  const id = draft.id;
  closePanel();
  commit(features.filter((f) => f.id !== id));
  toast("Adım silindi");
});
$("#panel-ok").addEventListener("click", () => {
  if (!draft) return;
  const z = evalNum(($("#f-z") as HTMLInputElement).value);
  const depth = evalNum(($("#f-depth") as HTMLInputElement).value);
  if (z === null || depth === null || depth === 0) {
    toast("Yükseklik ve Z geçerli bir sayı olmalı (yükseklik 0 olamaz)", true);
    return;
  }
  if (document.querySelector("#panel-fields input.bad")) {
    toast("Kırmızı işaretli ölçüleri düzeltin", true);
    return;
  }
  const f: ExtrudeFeature = { ...draft, z, depth };
  const next = editing ? features.map((x) => (x.id === f.id ? f : x)) : [...features, f];
  closePanel();
  commit(next);
  if (!editing) {
    setTool("orbit");
    viewer.viewIso();
    if (next.length === 1) setTimeout(() => viewer.fit(), 50);
  }
});

// ---------- Dışa aktarma ----------
$("#export-btn").addEventListener("click", () => {
  $("#export-menu").hidden = !$("#export-menu").hidden;
  $("#tree").hidden = true;
});
document.querySelectorAll<HTMLButtonElement>("#export-menu button").forEach((b) =>
  b.addEventListener("click", async () => {
    $("#export-menu").hidden = true;
    const fmtName = b.dataset.fmt as "step" | "stl";
    if (!features.length) return toast("Önce bir katı oluşturun", true);
    setStatus("busy", "Dışa aktarılıyor…");
    const r = await kernel.export(fmtName);
    setStatus("ok", "Hazır");
    if (!r.blob) return toast(r.message ?? "Dışa aktarılamadı", true);
    download(r.blob, `imaj-cad-parca.${fmtName}`);
  }),
);

async function download(blob: Blob, name: string) {
  const file = new File([blob], name, { type: "application/octet-stream" });
  // Telefonda paylaşım menüsü (WhatsApp, Drive, e-posta…) daha kullanışlı.
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

// ---------- Yeni / Yardım ----------
$("#new-btn").addEventListener("click", () => {
  if (!features.length) return;
  if (!confirm("Mevcut model silinsin mi? (Geri al ile geri getirebilirsiniz)")) return;
  closePanel();
  commit([]);
});
$("#help-btn").addEventListener("click", () => ($("#help") as HTMLDialogElement).showModal());

// Açık menüleri dışarı dokununca kapat
$("#view").addEventListener("pointerdown", () => {
  $("#export-menu").hidden = true;
});

// Klavye kısayolları (bilgisayar)
window.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).tagName === "INPUT") {
    if (e.key === "Enter") $("#panel-ok").click();
    if (e.key === "Escape") $("#panel-cancel").click();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    $(e.shiftKey ? "#redo" : "#undo").click();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
    e.preventDefault();
    $("#redo").click();
  } else if (e.key === "Escape") {
    if (!$("#panel").hidden) $("#panel-cancel").click();
    else setTool("orbit");
  } else if (e.key === "Enter" && currentTool === "poly") sketcher.closePoly();
});

// ---------- Çevrimdışı çalışma (PWA) ----------
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

setTool("orbit");
