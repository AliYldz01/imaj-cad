// Montaj çalışma alanı: bileşen görüntüleme, seçim, sürükleme, eşleşme paneli, ağaç, komutlar.
import * as THREE from "three";
import type { Viewer, InputHandler } from "../viewer";
import type { Kernel } from "../kernel";
import type { MeshData, Vec3 } from "../doc/types";
import { compile } from "../doc/compile";
import { h, numField, checkField, selectField, group, button } from "../ui/dom";
import { type AsmDoc, type AsmComp, type AsmPart, type Mate, type MateEnt, type MateType, MATE_NAMES, newAsm, solve, dofOf, bom, cylAxis, loadLib, saveToLib, removeFromLib, worldEnt } from "./assembly";

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
}
type Cmd = { id: string; label: string; icon: string; run: () => void; active?: () => boolean } | "sep";

const COLORS = [0x9fb4cc, 0xd4a373, 0x8fbc8f, 0xc9a0dc, 0xe5c07b, 0x88c0d0, 0xd08770, 0xa3be8c];
const KEY = "imajcad.asm";
const uid = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export class AsmUI {
  on = false;
  doc: AsmDoc;
  private group = new THREE.Group();
  private meshes = new Map<string, MeshData | null>();
  private objs = new Map<string, THREE.Group>();
  sel: string | null = null;
  private mateDraft: { ents: MateEnt[]; type: MateType; v: number; flip: boolean } | null = null;
  private press: { x: number; y: number; comp: string | null; moved: boolean } | null = null;
  explode = 0;
  private prevHandler: InputHandler | null = null;

  constructor(private ctx: AsmCtx) {
    try {
      this.doc = JSON.parse(localStorage.getItem(KEY) || "null") ?? newAsm();
    } catch {
      this.doc = newAsm();
    }
    ctx.viewer.scene.add(this.group);
    this.group.visible = false;
  }
  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.doc));
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
    await this.refresh();
    this.ctx.viewer.fit();
  }
  leave() {
    if (!this.on) return;
    this.on = false;
    this.cancelMate();
    this.group.visible = false;
    this.ctx.viewer.handler = this.prevHandler;
    this.ctx.onLeave();
  }

  /** bileşen ağlarını kur (önbellekli) ve sahneyi yenile */
  async refresh() {
    const v = this.ctx.viewer;
    for (const c of this.doc.comps) {
      const key = c.id + ":" + JSON.stringify(c.part.features).length + ":" + hash(JSON.stringify(c.part.features));
      if ((this as any)["k_" + c.id] === key && this.meshes.has(c.id)) continue;
      this.ctx.setStatus("busy", `Bileşen kuruluyor: ${c.name}`);
      try {
        const { kfeats } = compile(c.part.features, c.part.profiles ?? {});
        const r = await this.ctx.kernel.build(kfeats);
        this.meshes.set(c.id, r.mesh);
      } catch {
        this.meshes.set(c.id, null);
      }
      (this as any)["k_" + c.id] = key;
    }
    this.ctx.setStatus("ok", `Montaj · ${this.doc.comps.length} bileşen`);
    this.draw();
    v.requestRender();
  }

  /** sahne nesnelerini oluştur / konumla */
  draw() {
    for (const o of [...this.group.children]) this.group.remove(o);
    this.objs.clear();
    const center = this.asmCenter();
    this.doc.comps.forEach((c, i) => {
      const m = this.meshes.get(c.id);
      if (!m || c.hidden) return;
      const g = new THREE.Group();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(m.vertices, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(m.normals, 3));
      geo.setIndex(new THREE.BufferAttribute(m.triangles, 1));
      const selC = this.sel === c.id;
      const mat = new THREE.MeshStandardMaterial({ color: COLORS[i % COLORS.length], metalness: 0.1, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, emissive: selC ? 0x1c4fd8 : 0x000000, emissiveIntensity: 0.35 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.comp = c.id;
      const eg = new THREE.BufferGeometry();
      eg.setAttribute("position", new THREE.BufferAttribute(m.lines, 3));
      g.add(mesh, new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x1f2a37 })));
      g.quaternion.set(...c.q);
      g.position.set(...c.p);
      if (this.explode > 0) {
        const cc = this.compCenter(c);
        g.position.add(cc.sub(center).multiplyScalar(this.explode));
      }
      this.group.add(g);
      this.objs.set(c.id, g);
    });
    // görüntü sınırı (ekrana sığdır için)
    const box = new THREE.Box3().setFromObject(this.group);
    this.ctx.viewer.bbox = box.isEmpty() ? null : box;
    this.ctx.viewer.requestRender();
  }
  private compCenter(c: AsmComp) {
    const m = this.meshes.get(c.id);
    const b = m?.bbox;
    const lc = b ? new THREE.Vector3((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2) : new THREE.Vector3();
    return lc.applyQuaternion(new THREE.Quaternion(...c.q)).add(new THREE.Vector3(...c.p));
  }
  private asmCenter() {
    const cs = this.doc.comps.map((c) => this.compCenter(c));
    const s = new THREE.Vector3();
    cs.forEach((v) => s.add(v));
    return cs.length ? s.multiplyScalar(1 / cs.length) : s;
  }

  // ---------- seçim ----------
  private pick(x: number, y: number): { comp: string; ent: MateEnt | null } | null {
    const rc = this.ctx.viewer.ray(x, y);
    const meshes: THREE.Mesh[] = [];
    this.group.traverse((o) => (o as any).isMesh && meshes.push(o as THREE.Mesh));
    const hit = rc.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    const id = hit.object.userData.comp as string;
    const md = this.meshes.get(id);
    if (!md || hit.faceIndex == null) return { comp: id, ent: null };
    const tri = hit.faceIndex * 3;
    let fi = -1;
    for (let i = 0; i < md.faceGroups.length; i += 3) if (tri >= md.faceGroups[i] && tri < md.faceGroups[i] + md.faceGroups[i + 1]) fi = md.faceGroups[i + 2];
    const f = md.faces[fi];
    if (!f) return { comp: id, ent: null };
    if (f.n) return { comp: id, ent: { comp: id, kind: "plane", c: f.c, n: f.n, label: "Düz yüz" } };
    const ax = cylAxis(md, fi);
    if (ax && f.r) return { comp: id, ent: { comp: id, kind: "cyl", c: f.c, n: ax, r: f.r, label: `Silindir Ø${(f.r * 2).toFixed(1)}` } };
    return { comp: id, ent: null };
  }

  input: InputHandler = {
    down: (e) => {
      const p = this.pick(e.clientX, e.clientY);
      this.press = { x: e.clientX, y: e.clientY, comp: p?.comp ?? null, moved: false };
    },
    move: (e) => {
      const pr = this.press;
      if (!pr || !pr.comp || this.mateDraft) return;
      const c = this.doc.comps.find((x) => x.id === pr.comp);
      if (!c || c.fixed) return;
      const dx = e.clientX - pr.x, dy = e.clientY - pr.y;
      if (!pr.moved && Math.hypot(dx, dy) < 6) return;
      pr.moved = true;
      // SolidWorks: bileşeni sürükleyerek taşı (ekran düzleminde)
      const cam = this.ctx.viewer.camera;
      const k = this.ctx.viewer.worldPerPixel();
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const d = right.multiplyScalar(dx * k).add(up.multiplyScalar(-dy * k));
      c.p = [c.p[0] + d.x, c.p[1] + d.y, c.p[2] + d.z];
      pr.x = e.clientX;
      pr.y = e.clientY;
      this.draw();
    },
    up: (e) => {
      const pr = this.press;
      this.press = null;
      if (pr?.moved) {
        // sürükleme bitti: eşleşmeleri yeniden uygula
        solve(this.doc);
        this.save();
        this.draw();
        this.renderTree();
        return;
      }
      this.click(e.clientX, e.clientY);
    },
    tap: (e) => this.click(e.clientX, e.clientY),
  };

  private click(x: number, y: number) {
    const p = this.pick(x, y);
    if (this.mateDraft) {
      if (!p?.ent) return this.ctx.toast("Düz yüz veya silindirik yüz seçin", true);
      const d = this.mateDraft;
      if (d.ents.length === 1 && d.ents[0].comp === p.ent.comp) return this.ctx.toast("İkinci seçim başka bir bileşenden olmalı", true);
      d.ents = [...d.ents, p.ent].slice(-2);
      if (d.ents.length === 2) d.type = this.suggest(d.ents[0], d.ents[1]);
      this.renderMatePM();
      return;
    }
    this.sel = p?.comp ?? null;
    this.draw();
    this.renderTree();
  }

  // ---------- eşleşme ----------
  private suggest(a: MateEnt, b: MateEnt): MateType {
    if (a.kind === "cyl" && b.kind === "cyl") return "concentric";
    return "coincident";
  }
  startMate() {
    if (this.doc.comps.length < 2) return this.ctx.toast("Eşleşme için en az iki bileşen gerekir", true);
    this.mateDraft = { ents: [], type: "coincident", v: 10, flip: false };
    this.ctx.showPM("Eşleşme", () => this.commitMate(), () => this.cancelMate());
    this.renderMatePM();
  }
  private cancelMate() {
    if (!this.mateDraft) return;
    this.mateDraft = null;
    this.ctx.hidePM();
    this.ctx.hint("");
  }
  private renderMatePM() {
    const d = this.mateDraft;
    if (!d) return;
    const body = document.getElementById("pm-body")!;
    body.innerHTML = "";
    const name = (e: MateEnt) => `${this.doc.comps.find((c) => c.id === e.comp)?.name ?? "?"} · ${e.label ?? e.kind}`;
    body.appendChild(group("Eşleşme seçimleri", h("div", "pm-picks", d.ents.length ? d.ents.map(name).join(" ↔ ") : "İki bileşenden birer yüz seçin"), ...(d.ents.length ? [button("Seçimi temizle", () => ((d.ents = []), this.renderMatePM()))] : [])));
    const both = d.ents.length === 2 ? d.ents.map((e) => e.kind).join("-") : "";
    const types: MateType[] = both === "cyl-cyl" ? ["concentric", "parallel", "perpendicular", "lock"] : both === "plane-plane" ? ["coincident", "parallel", "perpendicular", "distance", "angle", "lock"] : both ? ["lock"] : ["coincident", "parallel", "perpendicular", "distance", "angle", "concentric", "lock"];
    if (!types.includes(d.type)) d.type = types[0];
    body.appendChild(
      group(
        "Standart eşleşmeler",
        selectField("Tür", types.map((t) => ({ v: t, t: MATE_NAMES[t] })), d.type, (v) => ((d.type = v), this.renderMatePM())),
        ...(d.type === "distance" ? [numField("Mesafe", d.v, (v) => (d.v = v), { unit: "mm" })] : []),
        ...(d.type === "angle" ? [numField("Açı", d.v, (v) => (d.v = v), { unit: "°" })] : []),
        checkField("Hizalamayı çevir (hizalı / ters hizalı)", d.flip, (v) => (d.flip = v)),
      ),
    );
    if (both === "plane-cyl" || both === "cyl-plane") body.appendChild(h("p", "pm-hint", "Düz yüz ile silindir arasında yalnız kilit desteklenir; teğet eşleşme sonraki sürümde."));
    this.ctx.hint(d.ents.length < 2 ? "Eşleştirilecek yüzlere dokunun (iki farklı bileşen)" : "Türü seçip ✓ ile onaylayın");
  }
  private commitMate() {
    const d = this.mateDraft;
    if (!d || d.ents.length < 2) return this.ctx.toast("İki yüz seçin", true);
    const m: Mate = { id: uid(), type: d.type, a: d.ents[0], b: d.ents[1], v: d.type === "distance" || d.type === "angle" ? d.v : undefined, flip: d.flip || undefined };
    this.doc.mates.push(m);
    const r = solve(this.doc);
    if (!r.ok) this.ctx.toast("Bazı eşleşmeler çözülemedi (en az bir bileşen sabit olmalı)", true);
    this.mateDraft = null;
    this.ctx.hidePM();
    this.ctx.hint("");
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
  openAddDialog() {
    const dlg = document.createElement("dialog");
    dlg.className = "input-dialog";
    dlg.appendChild(h("h2", "", "Bileşen ekle"));
    const lib = loadLib();
    const cur = this.ctx.currentPart();
    const add = (p: AsmPart) => (dlg.close(), this.addComp(p));
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
    dlg.appendChild(button("Kapat", () => dlg.close()));
    document.body.appendChild(dlg);
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
  }
  private comp() {
    return this.doc.comps.find((c) => c.id === this.sel) ?? null;
  }
  openMove() {
    const c = this.comp();
    if (!c) return this.ctx.toast("Önce bir bileşen seçin", true);
    if (c.fixed) return this.ctx.toast("Sabit bileşen taşınamaz (önce 'Serbest bırak')", true);
    const st = { dx: 0, dy: 0, dz: 0 };
    this.ctx.showPM("Bileşeni taşı / döndür", () => this.ctx.hidePM(), () => this.ctx.hidePM());
    const body = document.getElementById("pm-body")!;
    body.innerHTML = "";
    const apply = () => {
      c.p = [c.p[0] + st.dx, c.p[1] + st.dy, c.p[2] + st.dz];
      st.dx = st.dy = st.dz = 0;
      this.save();
      this.draw();
    };
    const rot = (ax: Vec3, deg: number) => {
      const r = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...ax), (deg * Math.PI) / 180);
      const q = r.multiply(new THREE.Quaternion(...c.q));
      c.q = [q.x, q.y, q.z, q.w];
      this.save();
      this.draw();
    };
    body.appendChild(group("Öteleme (Δ)", numField("ΔX", 0, (v) => (st.dx = v), { unit: "mm" }), numField("ΔY", 0, (v) => (st.dy = v), { unit: "mm" }), numField("ΔZ", 0, (v) => (st.dz = v), { unit: "mm" }), button("Uygula", apply, "btn primary")));
    body.appendChild(group("Döndür (90°)", button("X ekseni", () => rot([1, 0, 0], 90)), button("Y ekseni", () => rot([0, 1, 0], 90)), button("Z ekseni", () => rot([0, 0, 1], 90))));
    body.appendChild(h("p", "pm-hint", "Bileşeni modelde fareyle/parmakla sürükleyerek de taşıyabilirsiniz; eşleşmeler bırakınca yeniden uygulanır."));
  }
  async interference() {
    const parts = this.doc.comps.filter((c) => !c.hidden).map((c) => ({ features: compile(c.part.features, c.part.profiles ?? {}).kfeats, q: c.q, p: c.p, name: c.name }));
    this.ctx.setStatus("busy", "Girişim hesaplanıyor…");
    const r = await this.ctx.kernel.asm("interfere", parts);
    this.meshes.clear();
    await this.refresh();
    const vis = this.doc.comps.filter((c) => !c.hidden);
    const pr = r.pairs ?? [];
    this.ctx.toast(pr.length ? "Girişim: " + pr.map((x) => `${vis[x.a].name} ↔ ${vis[x.b].name} (${x.vol.toFixed(1)} mm³)`).join(" · ") : "Girişim yok ✓", pr.length > 0);
  }
  async exportStep() {
    const parts = this.doc.comps.filter((c) => !c.hidden).map((c) => ({ features: compile(c.part.features, c.part.profiles ?? {}).kfeats, q: c.q, p: c.p, name: c.name }));
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

  // ---------- ağaç ----------
  renderTree() {
    const ul = document.getElementById("tree")!;
    const acts = document.getElementById("tree-actions")!;
    (document.getElementById("part-name") as HTMLElement).textContent = this.doc.name + " (montaj)";
    ul.innerHTML = "";
    acts.innerHTML = "";
    for (const c of this.doc.comps) {
      const dof = dofOf(this.doc, c.id);
      const li = h("li", (this.sel === c.id ? "sel " : "") + (c.hidden ? "off" : ""));
      li.appendChild(h("span", "", `${c.fixed ? "(f) " : dof > 0 ? "(-) " : ""}${c.name}`));
      li.title = c.fixed ? "Sabit" : dof > 0 ? `${dof} serbestlik derecesi kaldı` : "Tam tanımlı";
      li.addEventListener("click", () => ((this.sel = this.sel === c.id ? null : c.id), this.draw(), this.renderTree()));
      ul.appendChild(li);
    }
    if (this.doc.mates.length) {
      ul.appendChild(h("li", "rollbar", `Eşleşmeler (${this.doc.mates.length})`));
      for (const m of this.doc.mates) {
        const nm = (e: MateEnt) => this.doc.comps.find((c) => c.id === e.comp)?.name ?? "?";
        const li = h("li", "child" + (m.off ? " off" : ""), `${MATE_NAMES[m.type]}${m.v !== undefined ? " " + m.v : ""} (${nm(m.a)}, ${nm(m.b)})`);
        li.addEventListener("click", () => {
          if (confirm(`"${MATE_NAMES[m.type]}" eşleşmesi silinsin mi? (İptal = bastır/etkinleştir)`)) this.doc.mates = this.doc.mates.filter((x) => x !== m);
          else m.off = !m.off;
          solve(this.doc);
          this.save();
          this.draw();
          this.renderTree();
        });
        ul.appendChild(li);
      }
    }
    const c = this.comp();
    if (!c) return;
    const add = (t: string, fn: () => void, cls = "btn") => acts.appendChild(button(t, fn, cls));
    add(c.fixed ? "Serbest bırak" : "Sabitle", () => ((c.fixed = !c.fixed), solve(this.doc), this.save(), this.draw(), this.renderTree()));
    add(c.hidden ? "Göster" : "Gizle", () => ((c.hidden = !c.hidden), this.save(), this.draw(), this.renderTree()));
    add("Taşı / döndür", () => this.openMove());
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
      this.doc.mates = this.doc.mates.filter((m) => m.a.comp !== c.id && m.b.comp !== c.id);
      this.sel = null;
      this.save();
      this.draw();
      this.renderTree();
    }, "btn danger");
  }

  // ---------- komutlar ----------
  commands(): Cmd[] {
    if (!this.on)
      return [
        { id: "asmOpen", label: "Montajı Aç", icon: "file", run: () => this.enter() },
        { id: "libSave", label: "Kütüphaneye Kaydet", icon: "file", run: () => (saveToLib(this.ctx.currentPart()), this.ctx.toast(`"${this.ctx.currentPart().name}" kütüphaneye kaydedildi`)) },
      ];
    return [
      { id: "addComp", label: "Bileşen Ekle", icon: "extrude", run: () => this.openAddDialog() },
      { id: "mate", label: "Eşleşme", icon: "normal", run: () => this.startMate(), active: () => !!this.mateDraft },
      { id: "move", label: "Taşı / Döndür", icon: "move", run: () => this.openMove() },
      "sep",
      { id: "interf", label: "Girişim", icon: "measure", run: () => this.interference() },
      {
        id: "explode",
        label: this.explode ? "Patlatmayı Kapat" : "Patlat",
        icon: "lpattern",
        run: () => {
          this.explode = this.explode ? 0 : 0.8;
          this.draw();
        },
        active: () => this.explode > 0,
      },
      { id: "bom", label: "Malzeme Listesi", icon: "cutlist", run: () => this.showBom() },
      { id: "step", label: "STEP (montaj)", icon: "file", run: () => this.exportStep() },
      "sep",
      {
        id: "rename",
        label: "Montaj Adı",
        icon: "file",
        run: () => {
          const n = prompt("Montaj adı", this.doc.name)?.trim();
          if (n) (this.doc.name = n), this.save(), this.renderTree();
        },
      },
      { id: "saveAsm", label: "Montajı Kaydet", icon: "file", run: () => this.ctx.download(new Blob([JSON.stringify(this.doc)], { type: "application/json" }), `${this.doc.name}.icasm`) },
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
              this.meshes.clear();
              this.save();
              await this.refresh();
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
void worldEnt;
