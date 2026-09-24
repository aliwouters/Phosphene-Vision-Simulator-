import { describe, it, expect } from "vitest"
import {
  lumaFromRgb,
  pixelLumaToNormalizedIntensity,
  toDisplayIntensity,
  fromDisplayIntensity,
  illustrativePhospheneRadiusFactor,
  INTENSITY_DISPLAY_MAX,
} from "./phosphene"

describe("lumaFromRgb (Rec. 601)", () => {
  it("returns 0 for black and 255 for white", () => {
    expect(lumaFromRgb(0, 0, 0)).toBe(0)
    expect(lumaFromRgb(255, 255, 255)).toBeCloseTo(255, 6)
  })

  it("weights green most heavily", () => {
    expect(lumaFromRgb(0, 255, 0)).toBeGreaterThan(lumaFromRgb(255, 0, 0))
    expect(lumaFromRgb(255, 0, 0)).toBeGreaterThan(lumaFromRgb(0, 0, 255))
  })
})

describe("normalized stimulation intensity", () => {
  it("stays within [0, 1] for all valid luma", () => {
    for (let luma = 0; luma <= 255; luma += 15) {
      const n = pixelLumaToNormalizedIntensity(luma)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(1)
    }
  })

  it("clamps out-of-range input", () => {
    expect(pixelLumaToNormalizedIntensity(-50)).toBe(0)
    expect(pixelLumaToNormalizedIntensity(999)).toBe(1)
  })

  it("maps black->0 and white->1", () => {
    expect(pixelLumaToNormalizedIntensity(0)).toBe(0)
    expect(pixelLumaToNormalizedIntensity(255)).toBe(1)
  })
})

describe("display intensity index", () => {
  it("stays within [0, 100]", () => {
    for (let luma = 0; luma <= 255; luma += 5) {
      const d = toDisplayIntensity(pixelLumaToNormalizedIntensity(luma))
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(INTENSITY_DISPLAY_MAX)
      expect(Number.isInteger(d)).toBe(true)
    }
  })

  it("round-trips through normalized within one display step", () => {
    for (let d = 0; d <= 100; d += 10) {
      const back = toDisplayIntensity(fromDisplayIntensity(d))
      expect(Math.abs(back - d)).toBeLessThanOrEqual(1)
    }
  })
})

describe("illustrative phosphene radius factor", () => {
  it("is monotonic and bounded in [0.3, 1]", () => {
    expect(illustrativePhospheneRadiusFactor(0)).toBeCloseTo(0.3, 6)
    expect(illustrativePhospheneRadiusFactor(1)).toBeCloseTo(1, 6)
    expect(illustrativePhospheneRadiusFactor(0.5)).toBeGreaterThan(
      illustrativePhospheneRadiusFactor(0.2),
    )
  })
})
