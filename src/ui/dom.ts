// Panel formları için küçük DOM yardımcıları.
import { evalNum, fmtNum, hasVars } from "../doc/math";

/** Denklem bağlantısı: alan anahtarına ifade kaydeder */
let eqHook: { get(key: string): string | undefined; set(key: string, expr: string | null): void } | null = null;
export function setEqHook(h: typeof eqHook) {
  eqHook = h;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}

export function numField(label: string, val: number, onChange: (v: number) => void, opts: { min?: number; unit?: string; int?: boolean; key?: string } = {}) {
  const l = h("label", "pm-field", label + (opts.unit ? ` (${opts.unit})` : ""));
  const inp = h("input");
  inp.autocomplete = "off";
  const ex = opts.key ? eqHook?.get(opts.key) : undefined;
  inp.value = ex ? "=" + ex : fmtNum(val, 4);
  if (ex) inp.classList.add("eq");
  inp.title = "Sayı, işlem (100/2) veya değişkenli denklem (=L/2) yazabilirsiniz";
  inp.addEventListener("input", () => {
    let v = evalNum(inp.value);
    if (v !== null && opts.int) v = Math.round(v);
    const ok = v !== null && (opts.min === undefined || v >= opts.min);
    inp.classList.toggle("bad", !ok);
    if (!ok) return;
    if (opts.key && eqHook) {
      const isEq = hasVars(inp.value);
      eqHook.set(opts.key, isEq ? inp.value.trim().replace(/^=/, "") : null);
      inp.classList.toggle("eq", isEq);
    }
    onChange(v!);
  });
  inp.addEventListener("keydown", (e) => e.stopPropagation());
  l.appendChild(inp);
  return l;
}

export function checkField(label: string, val: boolean, onChange: (v: boolean) => void) {
  const l = h("label", "pm-check");
  const c = h("input");
  c.type = "checkbox";
  c.checked = val;
  c.addEventListener("change", () => onChange(c.checked));
  l.append(c, document.createTextNode(label));
  return l;
}

export function selectField<T extends string>(label: string, options: { v: T; t: string }[], val: T, onChange: (v: T) => void) {
  const l = h("label", "pm-field", label);
  const s = h("select");
  for (const o of options) {
    const op = h("option", "", o.t);
    op.value = o.v;
    if (o.v === val) op.selected = true;
    s.appendChild(op);
  }
  s.addEventListener("change", () => onChange(s.value as T));
  l.appendChild(s);
  return l;
}

export function segField<T extends string>(options: { v: T; t: string }[], val: T, onChange: (v: T) => void) {
  const wrap = h("div", "seg");
  for (const o of options) {
    const b = h("button", o.v === val ? "active" : "", o.t);
    b.type = "button";
    b.addEventListener("click", () => {
      wrap.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      onChange(o.v);
    });
    wrap.appendChild(b);
  }
  return wrap;
}

export function group(title: string, ...children: HTMLElement[]) {
  const g = h("div", "pm-group");
  g.appendChild(h("div", "pm-sub", title));
  children.forEach((c) => g.appendChild(c));
  return g;
}

export function button(text: string, onClick: () => void, cls = "btn") {
  const b = h("button", cls, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}
