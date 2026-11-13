// Sesle ölçü girişi: Türkçe konuşmayı sayıya çevirir (Web Speech API).
const ONES: Record<string, number> = { sıfır: 0, bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9 };
const TENS: Record<string, number> = { on: 10, yirmi: 20, otuz: 30, kırk: 40, elli: 50, altmış: 60, yetmiş: 70, seksen: 80, doksan: 90 };

/** Türkçe sayı sözcükleri (tam kısım) → sayı; tanınmazsa NaN */
function wordsInt(ws: string[]): number {
  if (!ws.length) return NaN;
  let total = 0, cur = 0, any = false;
  for (const w of ws) {
    if (w in ONES) (cur += ONES[w]), (any = true);
    else if (w in TENS) (cur += TENS[w]), (any = true);
    else if (w === "yüz") (cur = (cur || 1) * 100), (any = true);
    else if (w === "bin") (total += (cur || 1) * 1000), (cur = 0), (any = true);
    else if (/^\d+$/.test(w)) (cur += +w), (any = true);
    else return NaN;
  }
  return any ? total + cur : NaN;
}
/** ondalık kısım: "beş" → .5, "yirmi beş" → .25, "sıfır beş" → .05 */
function wordsFrac(ws: string[]): number {
  if (!ws.length) return NaN;
  if (ws.every((w) => /^\d+$/.test(w))) return +("0." + ws.join(""));
  let lead = "";
  while (ws.length > 1 && ws[0] === "sıfır") (lead += "0"), ws.shift();
  const n = wordsInt(ws);
  return isNaN(n) ? NaN : +("0." + lead + String(n));
}

/** Konuşma metnindeki tek sayıyı çözer: "on iki virgül beş" → 12.5, "25,4" → 25.4, "yirmi buçuk" → 20.5, "eksi on" → −10 */
export function parseSpokenNumber(text: string): number {
  let t = text.toLocaleLowerCase("tr").replace(/milimetre|mm|derece|°/g, " ").trim();
  // rakamlı biçim
  const m = t.replace(/\s/g, "").match(/^(-|eksi)?(\d+(?:[.,]\d+)?)$/);
  if (m) return (m[1] ? -1 : 1) * +m[2].replace(",", ".");
  let sign = 1;
  if (/^(eksi|-)\s*/.test(t)) (sign = -1), (t = t.replace(/^(eksi|-)\s*/, ""));
  let half = false;
  if (/\bbuçuk$/.test(t)) (half = true), (t = t.replace(/\s*buçuk$/, ""));
  const ws = t.split(/\s+/).filter(Boolean);
  const k = ws.findIndex((w) => w === "virgül" || w === "nokta");
  let v: number;
  if (k >= 0) {
    const a = wordsInt(ws.slice(0, k)), b = wordsFrac(ws.slice(k + 1));
    v = (isNaN(a) ? 0 : a) + (isNaN(b) ? NaN : b);
  } else {
    // "12.5" gibi karışık parçalar
    const j = ws.map((w) => w.replace(",", ".")).join(" ");
    const dm = j.match(/^(\d+(?:\.\d+)?)$/);
    v = dm ? +dm[1] : wordsInt(ws);
  }
  if (half && !isNaN(v)) v += 0.5;
  return sign * v;
}

/** Birden çok sayı: "yüz çarpı elli", "120 açı 30", "40 ve 25" → [..] */
export function parseSpokenNumbers(text: string): number[] {
  return text
    .toLocaleLowerCase("tr")
    .split(/\s*(?:çarpı|carpı|x|×|\*|ve|açı|uzunluk|;|\/)\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseSpokenNumber)
    .filter((v) => !isNaN(v));
}

export function voiceSupported() {
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

/** Bir kez dinler; sonuç metinlerini (alternatifler) döndürür */
export function listenOnce(): Promise<string[]> {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return Promise.reject(new Error("Bu tarayıcı sesle girişi desteklemiyor"));
  return new Promise((res, rej) => {
    const r = new SR();
    r.lang = "tr-TR";
    r.interimResults = false;
    r.maxAlternatives = 5;
    let done = false;
    r.onresult = (e: any) => {
      done = true;
      const alts: string[] = [];
      for (let i = 0; i < e.results[0].length; i++) alts.push(e.results[0][i].transcript);
      res(alts);
    };
    r.onerror = (e: any) => !done && ((done = true), rej(new Error(e.error === "not-allowed" ? "Mikrofon izni verilmedi" : "Ses anlaşılamadı")));
    r.onend = () => !done && ((done = true), rej(new Error("Ses anlaşılamadı")));
    r.start();
  });
}
