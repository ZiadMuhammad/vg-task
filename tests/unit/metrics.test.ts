import { describe, expect, it } from "vitest";
import { percentage } from "@/lib/campaigns/metrics";
describe("honest reporting", () => {
  it("does not invent a rate when no sends exist", () =>
    expect(percentage(0, 0)).toBe("—"));
  it("does not hide inconsistent source numbers by clamping", () =>
    expect(percentage(120, 100)).toBe("120.0%"));
  it("uses the stated denominator", () =>
    expect(percentage(9, 12)).toBe("75.0%"));
});
