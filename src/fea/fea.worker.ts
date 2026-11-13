// Sonlu eleman çözücüsü ayrı iş parçacığında
import { solveFea, type FeaInput } from "./fea";
self.onmessage = (e: MessageEvent<FeaInput>) => {
  try {
    const r = solveFea({ ...e.data, onProgress: (it, res) => (self as any).postMessage({ prog: [it, res] }) });
    (self as any).postMessage({ res: r }, [r.vm.buffer, r.u.buffer]);
  } catch (err: any) {
    (self as any).postMessage({ err: String(err?.message ?? err) });
  }
};
