// Saha özellikleri: modele fotoğraf notu ekleme ve kumpas (Bluetooth / klavye kumpası) ile ölçü girişi.
import type { Vec3 } from "../doc/types";
import { loadImageFile } from "../sketch/picture";

export interface PhotoNote { id: string; src: string; note?: string; p?: Vec3; t: number }

export interface FieldCtx {
  viewer: { toScreen(p: Vec3): [number, number]; onRender(fn: () => void): void; requestRender(): void };
  view: HTMLElement;
  toast(m: string, err?: boolean): void;
  hint(m: string): void;
  photos(): PhotoNote[] | undefined;
  commit(fn: (list: PhotoNote[]) => void): void;
  download(b: Blob, name: string): void;
  partMode(): boolean;
  /** kumpas değeri → etkin ölçü alanına */
  fill(v: number, src: string): boolean;
}

const h = <K extends keyof HTMLElementTagNameMap>(t: K, cls = "", txt = "") => {
  const e = document.createElement(t);
  if (cls) e.className = cls;
  if (txt) e.textContent = txt;
  return e;
};

// ---------------- Fotoğraf notları ----------------
export class Photos {
  pending: PhotoNote | null = null;
  show = (() => {
    try {
      return localStorage.getItem("imajcad.pins") !== "0";
    } catch {
      return true;
    }
  })();
  private layer: HTMLElement;
  constructor(private c: FieldCtx) {
    this.layer = h("div", "photo-pins");
    c.view.appendChild(this.layer);
    c.viewer.onRender(() => this.place());
  }
  /** fotoğraf seç / çek; sonra modele dokunarak konum (ya da konumsuz) */
  pick(file?: File, relocate?: PhotoNote) {
    if (relocate) {
      this.pending = relocate;
      this.c.hint("Fotoğrafın yeni konumu: modelde bir noktaya dokunun (Esc: vazgeç)");
      return;
    }
    const go = async (f: File) => {
      try {
        const { src } = await loadImageFile(f, 1280);
        this.pending = { id: "ph" + Date.now().toString(36), src, t: Date.now() };
        this.c.hint("Fotoğrafı bağlamak için modelde bir noktaya dokunun · boşluğa dokunmak = konumsuz ekle · Esc: vazgeç");
      } catch (e: any) {
        this.c.toast(String(e?.message ?? e), true);
      }
    };
    if (file) return void go(file);
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.addEventListener("change", () => inp.files?.[0] && go(inp.files[0]));
    inp.click();
  }
  cancel() {
    if (!this.pending) return false;
    this.pending = null;
    this.c.hint("");
    return true;
  }
  /** bekleyen fotoğrafı tıklanan noktaya bağla; true = tıklama tüketildi */
  place3d(point: Vec3 | null): boolean {
    const ph = this.pending;
    if (!ph) return false;
    this.pending = null;
    this.c.hint("");
    const isNew = !this.c.photos()?.some((q) => q.id === ph.id);
    this.c.commit((list) => {
      const q = isNew ? ph : list.find((x) => x.id === ph.id)!;
      if (point) q.p = point.map((v) => +v.toFixed(3)) as Vec3;
      else delete q.p;
      if (isNew) list.push(q);
    });
    this.c.toast(point ? "Fotoğraf modele bağlandı 📷" : "Fotoğraf eklendi (konumsuz)");
    this.c.viewer.requestRender();
    return true;
  }
  setShow(v: boolean) {
    this.show = v;
    try {
      localStorage.setItem("imajcad.pins", v ? "1" : "0");
    } catch {}
    this.c.viewer.requestRender();
  }
  place() {
    const list = (this.c.photos() ?? []).filter((q) => q.p);
    const on = this.show && this.c.partMode();
    this.layer.hidden = !on;
    if (!on) return;
    const els = this.layer.children;
    while (els.length > list.length) els[els.length - 1].remove();
    list.forEach((q, i) => {
      let b = els[i] as HTMLButtonElement | undefined;
      if (!b) {
        b = h("button", "photo-pin", "📷");
        b.addEventListener("click", (e) => (e.stopPropagation(), this.open(b!.dataset.id!)));
        b.addEventListener("pointerdown", (e) => e.stopPropagation());
        this.layer.appendChild(b);
      }
      b.dataset.id = q.id;
      b.title = q.note || "Fotoğraf";
      const s = this.c.viewer.toScreen(q.p!);
      b.style.left = s[0] + "px";
      b.style.top = s[1] + "px";
    });
  }
  /** tek fotoğraf penceresi */
  open(id: string) {
    const q = this.c.photos()?.find((x) => x.id === id);
    if (!q) return;
    document.querySelector("dialog.photo-dlg")?.remove();
    const d = h("dialog", "input-dialog photo-dlg") as HTMLDialogElement;
    const img = h("img") as HTMLImageElement;
    img.src = q.src;
    const ta = h("textarea") as HTMLTextAreaElement;
    ta.placeholder = "Not (ör. ölçülen yer, tarih, makine)…";
    ta.value = q.note ?? "";
    const meta = h("p", "small", new Date(q.t).toLocaleString("tr-TR") + (q.p ? ` · konum ${q.p.map((v) => v.toFixed(1)).join(", ")}` : " · konumsuz"));
    const row = h("div", "pm-buttons");
    const btn = (t: string, fn: () => void, cls = "btn") => {
      const b = h("button", cls, t);
      b.addEventListener("click", fn);
      row.appendChild(b);
      return b;
    };
    const saveNote = () => (ta.value !== (q.note ?? "") ? this.c.commit((l) => (l.find((x) => x.id === id)!.note = ta.value || undefined)) : undefined);
    btn("Kapat", () => (saveNote(), d.close(), d.remove()), "btn primary");
    btn("Konumu değiştir", () => (saveNote(), d.close(), d.remove(), this.pick(undefined, { ...q })));
    btn("İndir", () => fetch(q.src).then((r) => r.blob()).then((b) => this.c.download(b, `foto_${id}.jpg`)));
    btn("Sil", () => {
      d.close();
      d.remove();
      this.c.commit((l) => l.splice(l.findIndex((x) => x.id === id), 1));
      this.c.viewer.requestRender();
    }, "btn danger");
    d.append(img, ta, meta, row);
    document.body.appendChild(d);
    d.showModal();
  }
  /** galeri */
  gallery() {
    document.querySelector("dialog.photo-gal")?.remove();
    const d = h("dialog", "input-dialog photo-gal") as HTMLDialogElement;
    const list = this.c.photos() ?? [];
    d.appendChild(h("h3", "", `Fotoğraflar (${list.length})`));
    const grid = h("div", "photo-grid");
    for (const q of list) {
      const t = h("button", "photo-th");
      const im = h("img") as HTMLImageElement;
      im.src = q.src;
      t.append(im, h("span", "small", (q.p ? "📍 " : "") + (q.note || new Date(q.t).toLocaleDateString("tr-TR"))));
      t.addEventListener("click", () => (d.close(), d.remove(), this.open(q.id)));
      grid.appendChild(t);
    }
    if (!list.length) grid.appendChild(h("p", "pm-hint", "Henüz fotoğraf yok. Ölçtüğünüz parçanın fotoğrafını çekip modelin ilgili yerine bağlayabilirsiniz."));
    const row = h("div", "pm-buttons");
    const add = h("button", "btn primary", "📷 Fotoğraf ekle / çek");
    add.addEventListener("click", () => (d.close(), d.remove(), this.pick()));
    const tg = h("button", "btn", this.show ? "İşaretleri gizle" : "İşaretleri göster");
    tg.addEventListener("click", () => (this.setShow(!this.show), (tg.textContent = this.show ? "İşaretleri gizle" : "İşaretleri göster")));
    const cl = h("button", "btn", "Kapat");
    cl.addEventListener("click", () => (d.close(), d.remove()));
    row.append(add, tg, cl);
    d.append(grid, row);
    document.body.appendChild(d);
    d.showModal();
  }
}

// ---------------- Kumpas ----------------
/** bilinen BLE servisleri: Sylvac, Nordic UART (çoğu BLE kumpas adaptörü), HM-10 / FFE0 seri köprü */
export const CALIPER_SERVICES = ["00005000-0000-1000-8000-00805f9b34fb", "6e400001-b5a3-f393-e0a9-e50e24dcca9e", 0xffe0, 0xfff0];

/** kumpas paketini sayıya çevirir: ASCII ("12.34", "+012,34 mm", "-1.50\r") ya da 4 bayt int32 (µm) */
export function decodeCaliper(bytes: Uint8Array): number | null {
  if (!bytes.length) return null;
  const printable = [...bytes].every((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127));
  if (printable) {
    const s = new TextDecoder().decode(bytes);
    const m = s.replace(/\s+/g, "").match(/([+-]?\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    let v = +m[1].replace(",", ".");
    if (/in(ch)?|"/i.test(s)) v *= 25.4;
    return v;
  }
  if (bytes.length === 4 || bytes.length === 3) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const raw = bytes.length === 4 ? dv.getInt32(0, true) : ((bytes[0] | (bytes[1] << 8) | (bytes[2] << 16)) << 8) >> 8;
    return raw / 1000;
  }
  return null;
}

export class Caliper {
  dev: any = null;
  last: number | null = null;
  auto = true;
  hid = (() => {
    try {
      return localStorage.getItem("imajcad.hidcal") === "1";
    } catch {
      return false;
    }
  })();
  private buf = "";
  private bufT = 0;
  private badge: HTMLElement;
  constructor(private c: FieldCtx) {
    this.badge = h("button", "cal-badge");
    this.badge.hidden = true;
    this.badge.addEventListener("click", () => this.dialog());
    document.body.appendChild(this.badge);
    // klavye (HID) kumpas: hızlı yazılan sayı + Enter, alan odakta değilken yakalanır
    addEventListener(
      "keydown",
      (e: KeyboardEvent) => {
        if (!this.hid) return;
        const t = e.target as HTMLElement;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        const now = performance.now();
        if (now - this.bufT > 250) this.buf = "";
        this.bufT = now;
        if (/^[0-9.,+-]$/.test(e.key)) {
          this.buf += e.key;
          e.preventDefault();
          e.stopImmediatePropagation();
        } else if ((e.key === "Enter" || e.key === "Tab") && this.buf) {
          const v = +this.buf.replace(",", ".");
          this.buf = "";
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!isNaN(v)) this.reading(v, "klavye kumpası");
        }
      },
      true,
    );
  }
  get supported() {
    return !!(navigator as any).bluetooth;
  }
  setHid(v: boolean) {
    this.hid = v;
    try {
      localStorage.setItem("imajcad.hidcal", v ? "1" : "0");
    } catch {}
    this.updBadge();
  }
  /** okunan değer (test ve BLE) */
  reading(v: number, src = "kumpas") {
    this.last = v;
    this.updBadge();
    const lv = document.querySelector(".cal-dlg .cal-last");
    if (lv) lv.textContent = v.toFixed(3) + " mm";
    if (this.auto && !this.c.fill(v, src)) this.c.toast(`📏 ${v.toFixed(2)} mm — yazmak için bir ölçü alanına dokunun`);
  }
  private updBadge() {
    const on = !!this.dev || this.hid;
    this.badge.hidden = !on;
    this.badge.textContent = "📏 " + (this.last != null ? this.last.toFixed(2) : this.dev ? "bağlı" : "HID");
  }
  async connect() {
    const bt = (navigator as any).bluetooth;
    if (!bt) return this.c.toast("Bu tarayıcı Bluetooth desteklemiyor (Android Chrome ya da masaüstü Chrome / Edge kullanın)", true);
    try {
      const dev = await bt.requestDevice({ acceptAllDevices: true, optionalServices: CALIPER_SERVICES });
      const gatt = await dev.gatt.connect();
      let n = 0;
      const services = await gatt.getPrimaryServices().catch(() => []);
      for (const s of services) {
        const chars = await s.getCharacteristics().catch(() => []);
        for (const ch of chars) {
          if (!ch.properties.notify && !ch.properties.indicate) continue;
          await ch.startNotifications().catch(() => null);
          ch.addEventListener("characteristicvaluechanged", (ev: any) => {
            const v = decodeCaliper(new Uint8Array(ev.target.value.buffer));
            if (v != null) this.reading(v, dev.name || "Bluetooth kumpas");
          });
          n++;
        }
      }
      if (!n) {
        gatt.disconnect();
        return this.c.toast("Cihazda ölçü gönderen özellik bulunamadı — kumpas modelini bildirin", true);
      }
      this.dev = dev;
      dev.addEventListener("gattserverdisconnected", () => {
        this.dev = null;
        this.updBadge();
        this.c.toast("Kumpas bağlantısı koptu");
      });
      this.updBadge();
      this.c.toast(`Kumpas bağlandı: ${dev.name || "cihaz"} — kumpastaki gönder düğmesine basın`);
    } catch (e: any) {
      if (e?.name !== "NotFoundError") this.c.toast("Bağlanılamadı: " + (e?.message ?? e), true);
    }
  }
  disconnect() {
    try {
      this.dev?.gatt?.disconnect();
    } catch {}
    this.dev = null;
    this.updBadge();
  }
  dialog() {
    document.querySelector("dialog.cal-dlg")?.remove();
    const d = h("dialog", "input-dialog cal-dlg") as HTMLDialogElement;
    d.appendChild(h("h3", "", "Kumpas"));
    d.appendChild(h("p", "small", this.dev ? `Bağlı: ${this.dev.name || "cihaz"}` : "Bağlı değil"));
    const lv = h("p", "cal-last", this.last != null ? this.last.toFixed(3) + " mm" : "—");
    d.appendChild(lv);
    const row = h("div", "pm-buttons");
    const btn = (t: string, fn: () => void, cls = "btn") => {
      const b = h("button", cls, t);
      b.addEventListener("click", fn);
      row.appendChild(b);
      return b;
    };
    if (this.dev) btn("Bağlantıyı kes", () => (this.disconnect(), d.close(), d.remove()));
    else btn("Bluetooth ile bağlan", () => (d.close(), d.remove(), void this.connect()), "btn primary");
    btn("Son okumayı yaz", () => this.last != null && (this.c.fill(this.last, "kumpas") || this.c.toast("Önce bir ölçü alanına dokunun")));
    btn("Kapat", () => (d.close(), d.remove()));
    const chk = (t: string, v: boolean, fn: (v: boolean) => void) => {
      const l = h("label", "pm-check");
      const c = h("input") as HTMLInputElement;
      c.type = "checkbox";
      c.checked = v;
      c.addEventListener("change", () => fn(c.checked));
      l.append(c, document.createTextNode(" " + t));
      d.appendChild(l);
    };
    chk("Okunan değeri etkin ölçü alanına otomatik yaz", this.auto, (v) => (this.auto = v));
    chk("Klavye (HID) kumpası: alan seçili değilken gelen sayı + Enter ölçü sayılır", this.hid, (v) => this.setHid(v));
    d.appendChild(
      h("p", "pm-hint", "Desteklenen: Sylvac Bluetooth, Nordic UART ya da HM-10 (FFE0) seri köprülü kumpas adaptörleri (metin ya da µm tamsayı gönderen). Klavye gibi davranan kumpaslar her ölçü alanına doğrudan yazar. Ölçü alanına dokunun (ya da Akıllı Ölçü'yü açın), sonra kumpasın gönder düğmesine basın."),
    );
    d.appendChild(row);
    document.body.appendChild(d);
    d.showModal();
  }
}
