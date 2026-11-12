// Eskiz resmi: fotoğrafı eskiz düzlemine yerleştirir (üzerinden çizmek için).
import * as THREE from "three";
import type { Frame, SketchPicture } from "../doc/types";

const texCache = new Map<string, THREE.Texture>();

/** Resmi eskiz düzleminde dokulu bir dikdörtgen olarak oluşturur */
export function pictureMesh(pic: SketchPicture, frame: Frame, onLoad: () => void): THREE.Mesh {
  let tex = texCache.get(pic.src);
  if (!tex) {
    tex = new THREE.TextureLoader().load(pic.src, () => onLoad());
    tex.colorSpace = THREE.SRGBColorSpace;
    texCache.set(pic.src, tex);
    if (texCache.size > 8) texCache.delete(texCache.keys().next().value!);
  }
  const geo = new THREE.PlaneGeometry(pic.w, pic.w * pic.aspect);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: pic.op, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -10;
  const x = new THREE.Vector3(...frame.x), n = new THREE.Vector3(...frame.n);
  const y = new THREE.Vector3().crossVectors(n, x);
  const basis = new THREE.Matrix4().makeBasis(x, y, n);
  const rot = new THREE.Matrix4().makeRotationZ((pic.rot * Math.PI) / 180);
  const flip = new THREE.Matrix4().makeScale(pic.flip ? -1 : 1, 1, 1);
  // resim merkezi (eskiz koordinatı): sol alt köşe + yarım boyut (döndürülmüş)
  const cx = pic.x, cy = pic.y;
  const local = new THREE.Matrix4().makeTranslation(cx, cy, -0.05).multiply(rot).multiply(flip);
  const world = new THREE.Matrix4().makeTranslation(...frame.o).multiply(basis).multiply(local);
  m.matrixAutoUpdate = false;
  m.matrix.copy(world);
  return m;
}

/** Görüntüyü en fazla maxPx kenarla JPEG veri adresine küçültür */
export async function loadImageFile(file: File, maxPx = 1600): Promise<{ src: string; aspect: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("Resim okunamadı"));
      im.src = url;
    });
    const k = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return { src: c.toDataURL("image/jpeg", 0.82), aspect: h / w };
  } finally {
    URL.revokeObjectURL(url);
  }
}
