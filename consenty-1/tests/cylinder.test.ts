import { describe, expect, it } from "vitest";
import { arcToX, ellipseArc } from "@/lib/mockup/cylinder";

describe("цилиндрический рендер", () => {
  it("периметр эллипса совпадает с формулой Рамануджана", () => {
    const a = 12.75, b = 7.25;
    const ramanujan = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    expect(ellipseArc(a, b).perimeter).toBeCloseTo(ramanujan, 1);
  });
  it("центр проецируется в 0, край — в полуширину", () => {
    const arc = ellipseArc(12.75, 7.25);
    expect(arcToX(arc, 12.75, 0)).toBeCloseTo(0, 6);
    expect(arcToX(arc, 12.75, arc.quarter)).toBeCloseTo(12.75, 3);
    // у края корпуса принт сжимается: 1 мм дуги даёт меньше 1 мм проекции
    const edge = arcToX(arc, 12.75, arc.quarter) - arcToX(arc, 12.75, arc.quarter - 1);
    expect(edge).toBeLessThan(0.5);
  });
});
