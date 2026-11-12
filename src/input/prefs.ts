// Telefon / tablet giriş ayarları: kalem tipi profilleri ve kişisel tercihler.
// Profil "otomatik" ise ilk kalem olaylarından kalem tipi algılanır.

export type PenProfile = "auto" | "hover" | "active" | "capacitive" | "finger" | "mouse";

export interface InputPrefs {
  profile: PenProfile;
  /** dokunarak ayarla, kaldırınca yerleştir (kalem / parmak) */
  placeOnLift: boolean;
  /** kalem ucunun yanında büyüteç */
  loupe: boolean;
  loupeZoom: number;
  /** parmakla çizimde imleci parmağın üstüne kaydır (px) */
  cursorOffset: number;
  /** kalem yakınken parmak/avuç dokunuşlarını yok say */
  palmReject: boolean;
  /** kalem yan tuşu: sağ tuş gibi (bağlam menüsü / fare hareketleri) */
  penButton: boolean;
  /** iki parmak dokunuşu geri al, üç parmak ileri al */
  fingerUndo: boolean;
  /** uzun basma: bağlam menüsü */
  longPress: boolean;
  /** iki parmakla çevirerek yuvarlama (3B) */
  twistRoll: boolean;
  /** yakalama yarıçapı çarpanı */
  snapSize: number;
  /** yakalamada kısa titreşim */
  haptic: boolean;
  /** ekran çubuğu: otomatik (dokunmatikte), açık, kapalı */
  actionBar: "auto" | "on" | "off";
  /** görünüm küpü */
  viewCube: "auto" | "on" | "off";
  /** solak: çubuk ve büyüteç ters tarafta */
  leftHanded: boolean;
  /** çizime başlayınca alt paneli küçült */
  autoMinSheet: boolean;
  /** dokunmatik fare: parmak imleci göreli kaydırır, dokunuş tıklar */
  touchpad: boolean;
}

const KEY = "imajcad.input";

export const DEFAULTS: InputPrefs = {
  profile: "auto",
  placeOnLift: true,
  loupe: true,
  loupeZoom: 2.5,
  cursorOffset: 70,
  palmReject: true,
  penButton: true,
  fingerUndo: true,
  longPress: true,
  twistRoll: true,
  snapSize: 1,
  haptic: true,
  actionBar: "auto",
  viewCube: "auto",
  leftHanded: false,
  autoMinSheet: true,
  touchpad: false,
};

export const PROFILE_INFO: Record<PenProfile, { name: string; desc: string }> = {
  auto: { name: "Otomatik", desc: "Kullandığınız kalem ilk dokunuşlarda algılanır." },
  hover: {
    name: "Aktif kalem (havada imleç + tuş)",
    desc: "Samsung S Pen, Apple Pencil (hover), Surface/Wacom/USI kalemler. Kalem ekrana değmeden önizleme ve yakalama görünür, yan tuş sağ tuş gibi çalışır. Parmak yalnızca görünümü yönetir.",
  },
  active: {
    name: "Aktif kalem (havada imleç yok)",
    desc: "Basınca duyarlı ama ekrana değmeden imleç göstermeyen kalemler (ör. Apple Pencil 1, bazı USI kalemler). Dokununca önizleme başlar, kaldırınca nokta konur.",
  },
  capacitive: {
    name: "Basit (kapasitif / lastik uçlu) kalem",
    desc: "Telefon bunu parmak gibi görür. Tek dokunuş çizer; görünüm için iki parmak kullanılır. İmleç kaymaz, büyüteç açıktır.",
  },
  finger: {
    name: "Yalnız parmak",
    desc: "Tek parmak çizer; imleç parmağın biraz üstünde durur ki nokta görünsün. Görünüm için iki parmak kullanılır.",
  },
  mouse: { name: "Fare ve klavye", desc: "Bilgisayar kullanımı (SolidWorks ile aynı)." },
};

function load(): InputPrefs {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...DEFAULTS, ...s };
  } catch {
    return { ...DEFAULTS };
  }
}

export const prefs: InputPrefs = load();
const listeners = new Set<() => void>();

export function savePrefs(p: Partial<InputPrefs>) {
  Object.assign(prefs, p);
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
  listeners.forEach((f) => f());
}
export function onPrefs(f: () => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

// ---------- algılama ----------
export const detected = {
  pen: false,
  penHover: false,
  penButton: false,
  touch: false,
  mouse: false,
};
const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

/** pointer olaylarını izleyip kalem tipini algılar */
export function observe(e: PointerEvent) {
  let ch = false;
  const set = (k: keyof typeof detected) => {
    if (!detected[k]) {
      detected[k] = true;
      ch = true;
    }
  };
  if (e.pointerType === "pen") {
    set("pen");
    if (e.type === "pointermove" && e.buttons === 0) set("penHover");
    if ((e.buttons & 2) !== 0 || e.button === 2) set("penButton");
  } else if (e.pointerType === "touch") set("touch");
  else if (e.pointerType === "mouse" && e.type === "pointermove" && e.movementX !== undefined) set("mouse");
  if (ch && prefs.profile === "auto") listeners.forEach((f) => f());
}

/** geçerli profil (otomatik ise algılanan) */
export function effectiveProfile(): Exclude<PenProfile, "auto"> {
  if (prefs.profile !== "auto") return prefs.profile;
  if (detected.pen) return detected.penHover ? "hover" : "active";
  if (detected.touch || coarse) return "finger";
  return "mouse";
}

/** tek parmak çizer mi (kalem yoksa) */
export function touchDraws() {
  const p = effectiveProfile();
  return p === "capacitive" || p === "finger";
}
export function isTouchDevice() {
  return coarse || detected.touch || detected.pen;
}
/** parmakla çizimde imleç kayması */
export function touchOffset() {
  return effectiveProfile() === "finger" ? prefs.cursorOffset : 0;
}
