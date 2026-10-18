/** Билинейная интерполяция внутри четырёхугольника: (u, v) ∈ [0,1]². */
export function quadPoint(q: number[][], u: number, v: number): [number, number] {
  const [a, b, c, d] = q;
  const top = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const bot = [d[0] + (c[0] - d[0]) * u, d[1] + (c[1] - d[1]) * u];
  return [top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v];
}

/** Область печати внутри панели корпуса: панель bodyMm, печать trimMm со смещением offsetMm. */
export function insetQuad(body: number[][], bodyMm: number[], trimMm: number[], offsetMm: number[]): number[][] {
  const u0 = offsetMm[0] / bodyMm[0], v0 = offsetMm[1] / bodyMm[1];
  const u1 = (offsetMm[0] + trimMm[0]) / bodyMm[0], v1 = (offsetMm[1] + trimMm[1]) / bodyMm[1];
  return [quadPoint(body, u0, v0), quadPoint(body, u1, v0), quadPoint(body, u1, v1), quadPoint(body, u0, v1)];
}
