// Klavye kısayolları ve fare hareketleri kayıt sistemi (SolidWorks Araçlar > Özelleştir gibi)
export type Act = { id: string; label: string; cat: string; run: () => void; def?: string; icon?: string };

export const DIRS8 = ["up", "upright", "right", "downright", "down", "downleft", "left", "upleft"] as const;
export type Dir = (typeof DIRS8)[number];
export type GestCfg = { n: 4 | 8; part: Partial<Record<Dir, string>>; sketch: Partial<Record<Dir, string>> };

const K_KEYS = "imajcad.keys";
const K_GEST = "imajcad.gest";

/** Klavye olayını "Ctrl+Shift+Z" biçimine çevirir (düzenden bağımsız: e.code) */
export function comboOf(e: KeyboardEvent): string {
  const c = e.code || "";
  let k = "";
  if (/^Key[A-Z]$/.test(c)) k = c.slice(3);
  else if (/^Digit[0-9]$/.test(c)) k = c.slice(5);
  else if (/^Numpad[0-9]$/.test(c)) k = c.slice(6);
  else if (/^F[0-9]{1,2}$/.test(e.key)) k = e.key;
  else {
    const m: Record<string, string> = { " ": "Space", ArrowLeft: "Left", ArrowRight: "Right", ArrowUp: "Up", ArrowDown: "Down", Delete: "Delete", Enter: "Enter", Escape: "Escape", Tab: "Tab", Backspace: "Backspace", Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", Insert: "Insert" };
    k = m[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : "");
  }
  if (!k || ["Control", "Shift", "Alt", "Meta"].includes(e.key)) return "";
  return (e.ctrlKey || e.metaKey ? "Ctrl+" : "") + (e.altKey ? "Alt+" : "") + (e.shiftKey ? "Shift+" : "") + k;
}

function load<T>(key: string, def: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? { ...def, ...JSON.parse(s) } : def;
  } catch {
    return def;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

/** Kullanıcı değişiklikleri: eylem kimliği → kısayol ("" = kaldırıldı) */
let overrides: Record<string, string> = load(K_KEYS, {});
export function keyOf(a: Act): string {
  return a.id in overrides ? overrides[a.id] : a.def ?? "";
}
export function setKey(id: string, combo: string) {
  overrides[id] = combo;
  save(K_KEYS, overrides);
}
export function resetKeys() {
  overrides = {};
  save(K_KEYS, overrides);
}
/** Kısayol → eylem eşlemesi */
export function keyMap(acts: Act[]): Map<string, Act> {
  const m = new Map<string, Act>();
  for (const a of acts) {
    const k = keyOf(a);
    if (k && !m.has(k)) m.set(k, a);
  }
  return m;
}

export const GEST_DEF: GestCfg = {
  n: 4,
  part: { up: "v.top", right: "v.right", down: "v.bottom", left: "v.left", upright: "v.iso", upleft: "v.normal", downright: "v.fit", downleft: "v.prev" },
  sketch: { up: "sk.dim", right: "sk.circle", down: "sk.rect", left: "sk.line", upright: "sk.carc", upleft: "sk.trim", downright: "sk.fillet", downleft: "sk.exit" },
};
let gest: GestCfg = load(K_GEST, GEST_DEF);
export function gestCfg(): GestCfg {
  return gest;
}
export function setGest(g: GestCfg) {
  gest = g;
  save(K_GEST, g);
}
/** Sürükleme vektörü → yön (4 ya da 8) */
export function dirOf(dx: number, dy: number, n: 4 | 8): Dir {
  const a = Math.atan2(dy, dx); // 0 = sağ, +π/2 = aşağı
  if (n === 4) return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  const order: Dir[] = ["right", "downright", "down", "downleft", "left", "upleft", "up", "upright"];
  return order[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Yazdırılabilir kısayol listesi (yeni pencerede) */
export function printList(acts: Act[]) {
  const cats = [...new Set(acts.map((a) => a.cat))];
  const g = gest;
  const byId = new Map(acts.map((a) => [a.id, a]));
  const dn: Record<string, string> = { up: "Yukarı", upright: "Sağ üst", right: "Sağ", downright: "Sağ alt", down: "Aşağı", downleft: "Sol alt", left: "Sol", upleft: "Sol üst" };
  const dirs = g.n === 4 ? ["up", "right", "down", "left"] : [...DIRS8];
  let html = `<!doctype html><meta charset="utf-8"><title>İmaj CAD kısayolları</title><style>body{font:12px system-ui;margin:16px}h1{font-size:18px}h2{font-size:14px;margin:14px 0 4px}table{border-collapse:collapse;width:100%;max-width:640px}td{border-bottom:1px solid #ddd;padding:3px 6px}td:last-child{text-align:right;font-family:monospace}.cols{columns:2;column-gap:28px}.cols>div{break-inside:avoid}</style><h1>İmaj CAD — Klavye ve fare kısayolları</h1><div class="cols">`;
  for (const c of cats) {
    const rows = acts.filter((a) => a.cat === c && keyOf(a));
    if (!rows.length) continue;
    html += `<div><h2>${esc(c)}</h2><table>${rows.map((a) => `<tr><td>${esc(a.label)}</td><td>${esc(keyOf(a))}</td></tr>`).join("")}</table></div>`;
  }
  for (const [nm, m] of [["Fare hareketleri — parça", g.part], ["Fare hareketleri — eskiz", g.sketch]] as const)
    html += `<div><h2>${nm} (sağ tuşla sürükle)</h2><table>${dirs.map((d) => `<tr><td>${dn[d]}</td><td>${esc(byId.get((m as any)[d])?.label ?? "—")}</td></tr>`).join("")}</table></div>`;
  html += `<div><h2>Fare</h2><table><tr><td>Döndür</td><td>Orta tuş sürükle</td></tr><tr><td>Kaydır</td><td>Ctrl + orta tuş</td></tr><tr><td>Yakınlaştır</td><td>Tekerlek / Shift + orta tuş</td></tr><tr><td>Sığdır</td><td>Orta tuşa çift tık</td></tr><tr><td>Yuvarla</td><td>Alt + orta tuş</td></tr><tr><td>Çoklu seçim</td><td>Ctrl + tık</td></tr><tr><td>Bağlam menüsü</td><td>Sağ tık</td></tr></table></div></div><script>print()<\/script>`;
  const w = window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
  return !!w;
}

/** Özelleştir penceresi: Klavye ve Fare Hareketleri sekmeleri */
export function openCustomize(acts: Act[], onChange: () => void, toast: (m: string) => void) {
  document.getElementById("cust-dlg")?.remove();
  const dlg = document.createElement("dialog");
  dlg.id = "cust-dlg";
  dlg.className = "cust-dlg";
  dlg.innerHTML = `<div class="cust-head"><strong>Özelleştir</strong><span class="spacer"></span><button class="cust-x" title="Kapat">✕</button></div>
  <div class="cust-tabs"><button data-t="k" class="on">Klavye</button><button data-t="g">Fare Hareketleri</button></div>
  <div class="cust-body"></div>
  <div class="cust-foot"><button class="btn" data-a="print">Listeyi yazdır</button><button class="btn" data-a="reset">Varsayılanlara dön</button><span class="spacer"></span><button class="btn primary" data-a="close">Tamam</button></div>`;
  document.body.appendChild(dlg);
  const body = dlg.querySelector(".cust-body") as HTMLElement;
  let tabK = true;
  let filter = "";
  const byId = new Map(acts.map((a) => [a.id, a]));
  const renderK = () => {
    body.innerHTML = "";
    const top = document.createElement("div");
    top.className = "cust-top";
    const q = document.createElement("input");
    q.placeholder = "Komut ara…";
    q.value = filter;
    q.className = "cust-q";
    q.addEventListener("input", () => {
      filter = q.value;
      renderList();
    });
    top.appendChild(q);
    const note = document.createElement("span");
    note.className = "small";
    note.textContent = "Kısayol hücresine tıklayıp tuşlara basın · Del/Backspace = kaldır";
    top.appendChild(note);
    body.appendChild(top);
    const list = document.createElement("div");
    list.className = "cust-list";
    body.appendChild(list);
    const renderList = () => {
      list.innerHTML = "";
      const f = filter.toLocaleLowerCase("tr");
      const conflicts = new Map<string, number>();
      for (const a of acts) {
        const k = keyOf(a);
        if (k) conflicts.set(k, (conflicts.get(k) ?? 0) + 1);
      }
      let cat = "";
      for (const a of acts) {
        if (f && !(a.label.toLocaleLowerCase("tr").includes(f) || a.cat.toLocaleLowerCase("tr").includes(f) || keyOf(a).toLowerCase().includes(f))) continue;
        if (a.cat !== cat) {
          cat = a.cat;
          const hd = document.createElement("div");
          hd.className = "cust-cat";
          hd.textContent = cat;
          list.appendChild(hd);
        }
        const row = document.createElement("div");
        row.className = "cust-row";
        const l = document.createElement("span");
        l.textContent = a.label;
        const kb = document.createElement("button");
        const k = keyOf(a);
        kb.className = "cust-key" + (k && (conflicts.get(k) ?? 0) > 1 ? " dup" : "");
        kb.textContent = k || "—";
        kb.title = k && (conflicts.get(k) ?? 0) > 1 ? "Bu kısayol birden çok komuta atanmış" : "Değiştirmek için tıklayın";
        kb.addEventListener("click", () => {
          kb.textContent = "Tuşa basın…";
          kb.classList.add("rec");
          const on = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === "Escape") return finish(null);
            if (e.key === "Delete" || e.key === "Backspace") return finish("");
            const c = comboOf(e);
            if (c) finish(c);
          };
          const finish = (c: string | null) => {
            window.removeEventListener("keydown", on, true);
            if (c !== null) {
              const other = c ? acts.find((x) => x.id !== a.id && keyOf(x) === c) : null;
              if (other && !confirm(`${c} şu an "${other.label}" komutunda. Oradan kaldırılıp buraya atansın mı?`)) return renderList();
              if (other) setKey(other.id, "");
              setKey(a.id, c);
              onChange();
            }
            renderList();
          };
          window.addEventListener("keydown", on, true);
        });
        row.append(l, kb);
        list.appendChild(row);
      }
    };
    renderList();
  };
  const renderG = () => {
    body.innerHTML = "";
    const g: GestCfg = JSON.parse(JSON.stringify(gest));
    const top = document.createElement("div");
    top.className = "cust-top";
    const sel = document.createElement("select");
    sel.innerHTML = `<option value="4">4 yön</option><option value="8">8 yön</option>`;
    sel.value = String(g.n);
    sel.addEventListener("change", () => {
      g.n = +sel.value as 4 | 8;
      setGest(g);
      renderG();
    });
    const lb = document.createElement("label");
    lb.textContent = "Hareket sayısı: ";
    lb.appendChild(sel);
    top.appendChild(lb);
    const note = document.createElement("span");
    note.className = "small";
    note.textContent = "Grafik alanda sağ tuşu basılı tutup sürükleyin";
    top.appendChild(note);
    body.appendChild(top);
    const dn: Record<string, string> = { up: "↑", upright: "↗", right: "→", downright: "↘", down: "↓", downleft: "↙", left: "←", upleft: "↖" };
    const dirs: Dir[] = g.n === 4 ? ["up", "right", "down", "left"] : [...DIRS8];
    const wrap = document.createElement("div");
    wrap.className = "cust-gw";
    for (const ctx of ["part", "sketch"] as const) {
      const col = document.createElement("div");
      col.className = "cust-gcol";
      col.innerHTML = `<div class="cust-cat">${ctx === "part" ? "Parça / montaj" : "Eskiz"}</div>`;
      for (const d of dirs) {
        const row = document.createElement("div");
        row.className = "cust-row";
        const l = document.createElement("span");
        l.textContent = dn[d];
        l.className = "cust-dir";
        const s = document.createElement("select");
        s.innerHTML = `<option value="">—</option>` + acts.map((a) => `<option value="${esc(a.id)}">${esc(a.cat + " › " + a.label)}</option>`).join("");
        s.value = (g[ctx] as any)[d] ?? "";
        s.addEventListener("change", () => {
          (g[ctx] as any)[d] = s.value;
          setGest(g);
        });
        row.append(l, s);
        col.appendChild(row);
      }
      wrap.appendChild(col);
    }
    body.appendChild(wrap);
    void byId;
  };
  const render = () => {
    dlg.querySelectorAll<HTMLButtonElement>(".cust-tabs button").forEach((b) => b.classList.toggle("on", (b.dataset.t === "k") === tabK));
    tabK ? renderK() : renderG();
  };
  dlg.querySelectorAll<HTMLButtonElement>(".cust-tabs button").forEach((b) => b.addEventListener("click", () => ((tabK = b.dataset.t === "k"), render())));
  const close = () => (dlg.close(), dlg.remove());
  dlg.querySelector(".cust-x")!.addEventListener("click", close);
  dlg.querySelector('[data-a="close"]')!.addEventListener("click", close);
  dlg.querySelector('[data-a="print"]')!.addEventListener("click", () => {
    if (!printList(acts)) toast("Açılır pencere engellendi");
  });
  dlg.querySelector('[data-a="reset"]')!.addEventListener("click", () => {
    if (!confirm(tabK ? "Tüm klavye kısayolları varsayılana dönsün mü?" : "Fare hareketleri varsayılana dönsün mü?")) return;
    if (tabK) resetKeys();
    else setGest(JSON.parse(JSON.stringify(GEST_DEF)));
    onChange();
    render();
  });
  dlg.addEventListener("keydown", (e) => e.stopPropagation());
  render();
  dlg.showModal();
  return dlg;
}
