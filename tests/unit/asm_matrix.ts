// Montaj eşleşme matrisi: tüm varlık çifti × eşleşme türü, rastgele döndürülmüş başlangıç, gerçek ölçek (x10).
// Çalıştır: npx esbuild tests/unit/asm_matrix.ts --bundle --platform=node --outfile=/tmp/am.js && node /tmp/am.js  → "TOPLAM BAŞARISIZ: 0" beklenir
import { solveAll, wEnt, dofAll, mateRes } from "../../src/asm/solver";
import { mateTypesFor } from "../../src/asm/assembly";
import * as THREE from "three";
const rnd = (s: number) => { let x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
const S = 10;
const comp = (id: string, fixed: boolean, p: any = [0,0,0], q: any = [0,0,0,1]) => ({ id, name: id, part: {} as any, p, q, fixed, _L: 30*S, _lc: [0,10*S,0] } as any);
const EA: Record<string, any> = {
  plane: { comp: "A", kind: "plane", c: [0,10*S,0], n: [0,1,0] }, cyl: { comp: "A", kind: "cyl", c: [0,5*S,0], n: [0,1,0], r: 5*S },
  line: { comp: "A", kind: "line", c: [0,10*S,50*S], n: [1,0,0] }, circle: { comp: "A", kind: "circle", c: [0,10*S,0], n: [0,1,0], r: 5*S }, point: { comp: "A", kind: "point", c: [50*S,10*S,50*S], n: [0,0,1] } };
const EB: Record<string, any> = {
  plane: { comp: "B", kind: "plane", c: [0,0,0], n: [0,-1,0] }, cyl: { comp: "B", kind: "cyl", c: [0,20*S,0], n: [0,1,0], r: 5*S },
  line: { comp: "B", kind: "line", c: [0,0,20*S], n: [1,0,0] }, circle: { comp: "B", kind: "circle", c: [0,0,0], n: [0,1,0], r: 5*S }, point: { comp: "B", kind: "point", c: [20*S,0,20*S], n: [0,0,1] } };
const ALIGN = new Set(["coincident","parallel","distance","angle","concentric","tangent","limit","limitAngle"]);
const out: string[] = [];
let totalFail = 0;
for (const ka of Object.keys(EA)) for (const kb of Object.keys(EB)) {
  const types = mateTypesFor([EA[ka], EB[kb]]) as string[];
  for (const t of types) {
    let fail = 0, dofs = new Set<number>();
    for (let i = 0; i < 25; i++) {
      const ax = new THREE.Vector3(rnd(i)-.5, rnd(i+1)-.5, rnd(i+2)-.5).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(ax, rnd(i+3) * Math.PI * 2);
      const doc: any = { kind: "asm", name: "t", comps: [comp("A", true), comp("B", false, [(rnd(i+4)*200-100)*S, 60*S, (rnd(i+5)*200-100)*S], [q.x,q.y,q.z,q.w])], mates: [] };
      const cm = new Map(doc.comps.map((c: any) => [c.id, c]));
      const dd = wEnt(EA[ka], cm.get("A") as any).N.dot(wEnt(EB[kb], cm.get("B") as any).N);
      const flip = ALIGN.has(t) && t !== "tangent" ? (t === "coincident" && ka === "plane" && kb === "plane" ? dd > 0.7 : dd > 0) : false;
      const m: any = { id: "m", type: t, a: EA[ka], b: EB[kb], flip: flip || undefined, v: t === "angle" ? 30 : t === "distance" ? 15*S : t === "limit" ? 0 : undefined, vmax: t === "limit" ? 20*S : undefined };
      if (t === "lock") m.ref = { pa: doc.comps[0].p, qa: doc.comps[0].q, pb: doc.comps[1].p, qb: doc.comps[1].q };
      if (t === "distance" || t === "limit") { const r = mateRes({ ...m, type: "distance", v: 0 }, cm as any).r; m.flipD = r[r.length-1] < 0 || undefined; }
      doc.mates.push(m);
      const r = solveAll(doc);
      if (!r.ok) fail++;
      else dofs.add(dofAll(doc).get("B")!);
    }
    totalFail += fail;
    out.push(`${ka}-${kb} ${t}: ${fail ? "✗ " + fail + "/25" : "✓"} kalan serbestlik ${[...dofs].join("/")}`);
  }
}
console.log(out.join("\n")); console.log("TOPLAM BAŞARISIZ:", totalFail);
