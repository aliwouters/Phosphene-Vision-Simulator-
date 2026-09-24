import { describe, it, expect } from "vitest"
import {
  gridCellToVisualField,
  visualFieldToCortex,
  gridCellToCortex,
  corticalDistanceMm,
  corticalMagnification,
  DEFAULT_MAX_ECCENTRICITY_DEG,
} from "./retinotopy"

/**
 * These tests verify the MATHEMATICAL behavior of the retinotopic model.
 * Passing them establishes internal consistency of the code, NOT biological
 * validity of the simplified model.
 */

const ROWS = 32
const COLS = 32

// Helpers to pick a cell in a given visual-field quadrant of a centered grid.
// With an even grid, columns [0..15] are left of center, [16..31] right.
// Rows [0..15] are the upper half of the image, [16..31] the lower half.
const LEFT_COL = 4
const RIGHT_COL = 27
const TOP_ROW = 4
const BOTTOM_ROW = 27

describe("gridCellToVisualField", () => {
  it("places the top-left image cell in the upper-left visual field", () => {
    const vf = gridCellToVisualField(TOP_ROW, LEFT_COL, ROWS, COLS)
    expect(vf.vfx).toBeLessThan(0) // left
    expect(vf.vfy).toBeGreaterThan(0) // upper
  })

  it("places the bottom-right image cell in the lower-right visual field", () => {
    const vf = gridCellToVisualField(BOTTOM_ROW, RIGHT_COL, ROWS, COLS)
    expect(vf.vfx).toBeGreaterThan(0) // right
    expect(vf.vfy).toBeLessThan(0) // lower
  })

  it("computes near-zero eccentricity at the image center for odd grids", () => {
    const vf = gridCellToVisualField(1, 1, 3, 3) // center cell of a 3x3 grid
    expect(vf.vfx).toBeCloseTo(0, 10)
    expect(vf.vfy).toBeCloseTo(0, 10)
    expect(vf.eccentricityDeg).toBeCloseTo(0, 10)
  })

  it("increases eccentricity toward the periphery", () => {
    const center = gridCellToVisualField(15, 15, ROWS, COLS)
    const corner = gridCellToVisualField(0, 0, ROWS, COLS)
    expect(corner.eccentricityDeg).toBeGreaterThan(center.eccentricityDeg)
  })

  it("computes polar angle correctly in each quadrant (degrees)", () => {
    const toDeg = (r: number) => (r * 180) / Math.PI
    // right + up  -> angle in (0, 90)
    const ur = gridCellToVisualField(TOP_ROW, RIGHT_COL, ROWS, COLS)
    expect(toDeg(ur.polarAngleRad)).toBeGreaterThan(0)
    expect(toDeg(ur.polarAngleRad)).toBeLessThan(90)
    // left + up   -> angle in (90, 180)
    const ul = gridCellToVisualField(TOP_ROW, LEFT_COL, ROWS, COLS)
    expect(toDeg(ul.polarAngleRad)).toBeGreaterThan(90)
    expect(toDeg(ul.polarAngleRad)).toBeLessThan(180)
    // left + down -> angle in (-180, -90)
    const dl = gridCellToVisualField(BOTTOM_ROW, LEFT_COL, ROWS, COLS)
    expect(toDeg(dl.polarAngleRad)).toBeLessThan(-90)
    expect(toDeg(dl.polarAngleRad)).toBeGreaterThan(-180)
    // right + down -> angle in (-90, 0)
    const dr = gridCellToVisualField(BOTTOM_ROW, RIGHT_COL, ROWS, COLS)
    expect(toDeg(dr.polarAngleRad)).toBeLessThan(0)
    expect(toDeg(dr.polarAngleRad)).toBeGreaterThan(-90)
  })
})

describe("visualFieldToCortex - contralateral hemispheres", () => {
  it("maps the LEFT visual field to the RIGHT hemisphere", () => {
    const vf = gridCellToVisualField(15, LEFT_COL, ROWS, COLS)
    expect(visualFieldToCortex(vf).hemisphere).toBe("right")
  })

  it("maps the RIGHT visual field to the LEFT hemisphere", () => {
    const vf = gridCellToVisualField(15, RIGHT_COL, ROWS, COLS)
    expect(visualFieldToCortex(vf).hemisphere).toBe("left")
  })
})

describe("visualFieldToCortex - dorsal/ventral inversion", () => {
  it("maps the UPPER visual field to the VENTRAL bank", () => {
    const vf = gridCellToVisualField(TOP_ROW, RIGHT_COL, ROWS, COLS)
    const cortex = visualFieldToCortex(vf)
    expect(cortex.bank).toBe("ventral")
    expect(cortex.flatY).toBeGreaterThan(0.5)
  })

  it("maps the LOWER visual field to the DORSAL bank", () => {
    const vf = gridCellToVisualField(BOTTOM_ROW, RIGHT_COL, ROWS, COLS)
    const cortex = visualFieldToCortex(vf)
    expect(cortex.bank).toBe("dorsal")
    expect(cortex.flatY).toBeLessThan(0.5)
  })
})

describe("all four quadrants map to the expected hemisphere + bank", () => {
  const cases: Array<{ row: number; col: number; hemi: string; bank: string }> = [
    { row: TOP_ROW, col: RIGHT_COL, hemi: "left", bank: "ventral" }, // upper-right
    { row: TOP_ROW, col: LEFT_COL, hemi: "right", bank: "ventral" }, // upper-left
    { row: BOTTOM_ROW, col: RIGHT_COL, hemi: "left", bank: "dorsal" }, // lower-right
    { row: BOTTOM_ROW, col: LEFT_COL, hemi: "right", bank: "dorsal" }, // lower-left
  ]
  for (const c of cases) {
    it(`cell (row ${c.row}, col ${c.col}) -> ${c.hemi}/${c.bank}`, () => {
      const cortex = gridCellToCortex(c.row, c.col, ROWS, COLS)
      expect(cortex.hemisphere).toBe(c.hemi)
      expect(cortex.bank).toBe(c.bank)
    })
  }
})

describe("cortical magnification (Horton & Hoyt, 1991)", () => {
  it("distance from the pole increases monotonically with eccentricity", () => {
    let prev = -1
    for (let e = 0; e <= 40; e += 1) {
      const d = corticalDistanceMm(e)
      expect(d).toBeGreaterThanOrEqual(prev)
      prev = d
    }
  })

  it("central vision occupies more cortex per degree than the periphery", () => {
    // mm of cortex spanned by the first degree vs. a peripheral degree
    const foveaSpan = corticalDistanceMm(1) - corticalDistanceMm(0)
    const peripherySpan = corticalDistanceMm(21) - corticalDistanceMm(20)
    expect(foveaSpan).toBeGreaterThan(peripherySpan)
  })

  it("magnification factor decreases with eccentricity", () => {
    expect(corticalMagnification(1)).toBeGreaterThan(corticalMagnification(20))
  })

  it("matches the published foveal magnification factor K/E2", () => {
    // M(0) = 17.3 / 0.75 ~= 23.07 mm/deg
    expect(corticalMagnification(0)).toBeCloseTo(17.3 / 0.75, 6)
  })

  it("flatX stays within [0, 1] across the field", () => {
    for (let e = 0; e <= DEFAULT_MAX_ECCENTRICITY_DEG; e += 5) {
      const cortex = visualFieldToCortex({
        vfx: e / DEFAULT_MAX_ECCENTRICITY_DEG,
        vfy: 0,
        eccentricityDeg: e,
        polarAngleRad: 0,
      })
      expect(cortex.flatX).toBeGreaterThanOrEqual(0)
      expect(cortex.flatX).toBeLessThanOrEqual(1)
    }
  })
})

describe("grid-resolution changes keep coordinates in range", () => {
  const sizes: Array<[number, number]> = [
    [8, 8],
    [12, 12],
    [16, 16],
    [24, 24],
    [32, 32],
    [6, 10],
    [19, 19],
    [25, 40],
  ]
  for (const [rows, cols] of sizes) {
    it(`every cell of a ${rows}x${cols} grid maps to valid coordinates`, () => {
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const cortex = gridCellToCortex(r, col, rows, cols)
          expect(cortex.flatX).toBeGreaterThanOrEqual(0)
          expect(cortex.flatX).toBeLessThanOrEqual(1)
          expect(cortex.flatY).toBeGreaterThanOrEqual(0)
          expect(cortex.flatY).toBeLessThanOrEqual(1)
          expect(["left", "right"]).toContain(cortex.hemisphere)
          expect(["dorsal", "ventral"]).toContain(cortex.bank)
        }
      }
    })
  }
})
