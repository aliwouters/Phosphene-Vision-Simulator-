/**
 * Simplified, explicitly cited model of primary visual cortex (V1) retinotopy.
 *
 * This module is the single source of truth for how a camera grid cell is
 * converted into a visual-field location and then into a schematic V1
 * ("cortical") location. Every visualization that needs this mapping imports
 * from here so that the same visual-field location is treated consistently.
 *
 * =====================================================================
 * COORDINATE CONVENTIONS (read this before changing anything)
 * =====================================================================
 *
 * Camera matrix:
 *   - `matrix[row][col]`
 *   - row 0   = TOP of the raw camera image
 *   - col 0   = LEFT of the raw camera image
 *
 * Visual field (what the eye/camera is "looking at"):
 *   - The camera feed is shown as a horizontally mirrored ("selfie") view, and
 *     the brightness matrix is sampled from that SAME mirrored frame, so matrix
 *     columns match exactly what the user sees on screen. We map matrix columns
 *     left->right to visual-field left->right, and matrix rows top->bottom to
 *     visual-field up->down. Because the pipeline is mirrored consistently,
 *     moving to your right keeps you on the right of the image, i.e. the RIGHT
 *     visual field, which (correctly, contralaterally) projects to the LEFT
 *     hemisphere.
 *   - vfx > 0 : RIGHT visual field ; vfx < 0 : LEFT visual field
 *   - vfy > 0 : UPPER visual field ; vfy < 0 : LOWER visual field
 *   - The origin (0, 0) is the fovea / point of fixation (image center).
 *
 * These are simplifying assumptions of a 2D model. A real visual prosthesis
 * user's percept depends on gaze, individual cortical folding, electrode
 * placement, and many factors not modeled here. See LIMITATIONS at the bottom.
 *
 * =====================================================================
 * CORTICAL MAGNIFICATION MODEL
 * =====================================================================
 *
 * We use the human cortical magnification function reported by
 * Horton & Hoyt (1991), who revised the classic Holmes map using MRI/visual
 * field correlation:
 *
 *     M(E) = K / (E + E2)                        [mm of cortex per degree]
 *
 * with K = 17.3 mm.deg and E2 = 0.75 deg (Horton & Hoyt, 1991).
 *
 * Integrating M(E) from the fovea gives the linear cortical distance from the
 * occipital pole to the representation of eccentricity E:
 *
 *     d(E) = K * ln(1 + E / E2)                  [mm]
 *
 * This is the logarithmic form of the log-polar mapping analysed by
 * Schwartz (1977). It reproduces the two facts we care about: central vision
 * occupies a disproportionately large area of cortex, and the periphery is
 * compressed toward anterior V1.
 *
 * IMPORTANT: d(E) is a distance ALONG the (unfolded) calcarine axis. It is not
 * a 2D screen coordinate and does not reproduce any individual's folded
 * anatomy. Visualizations that use it must be labeled as schematic.
 */

export const CORTICAL_MAGNIFICATION_K = 17.3 // mm.deg  (Horton & Hoyt, 1991)
export const CORTICAL_MAGNIFICATION_E2 = 0.75 // deg     (Horton & Hoyt, 1991)

/**
 * Default assumed half-extent of the camera field of view, in degrees of
 * visual angle, measured from the image center to the middle of an edge.
 * This is an ASSUMPTION for the simulation, not a measured device value.
 */
export const DEFAULT_MAX_ECCENTRICITY_DEG = 40

export type Hemisphere = "left" | "right"
export type CorticalBank = "dorsal" | "ventral"

export interface VisualFieldPoint {
  /** Normalized horizontal position, -1 (left) .. +1 (right). */
  vfx: number
  /** Normalized vertical position, -1 (down) .. +1 (up). */
  vfy: number
  /** Eccentricity in degrees of visual angle from fixation. */
  eccentricityDeg: number
  /** Polar angle in radians, measured CCW from the positive (rightward) axis. */
  polarAngleRad: number
}

export interface CorticalPoint {
  /** Which hemisphere represents this point (contralateral to the field). */
  hemisphere: Hemisphere
  /** Dorsal (lower field) or ventral (upper field) bank of the calcarine sulcus. */
  bank: CorticalBank
  /** Cortical distance from the occipital pole along the calcarine axis, in mm. */
  corticalDistanceMm: number
  /**
   * Schematic 2D coordinates for a per-hemisphere flatmap, both in [0, 1]:
   *  - flatX: 0 = occipital pole (fovea), 1 = anterior V1 (far periphery)
   *  - flatY: 0.5 = calcarine fissure (horizontal meridian);
   *           < 0.5 = dorsal bank, > 0.5 = ventral bank;
   *           0 and 1 = the dorsal/ventral lips (vertical meridian)
   */
  flatX: number
  flatY: number
}

/**
 * Convert a camera grid cell (row, col) into a visual-field point.
 * Uses cell centers so that the mapping is symmetric about the image center.
 */
export function gridCellToVisualField(
  row: number,
  col: number,
  rows: number,
  cols: number,
  maxEccentricityDeg: number = DEFAULT_MAX_ECCENTRICITY_DEG,
): VisualFieldPoint {
  // Cell center in [0, 1], then remapped to [-1, 1].
  const nx = ((col + 0.5) / cols) * 2 - 1
  const ny = ((row + 0.5) / rows) * 2 - 1

  const vfx = nx // image left->right == field left->right
  const vfy = -ny // image top->bottom == field up->down (invert sign)

  const radius = Math.sqrt(vfx * vfx + vfy * vfy)
  const eccentricityDeg = radius * maxEccentricityDeg
  const polarAngleRad = Math.atan2(vfy, vfx)

  return { vfx, vfy, eccentricityDeg, polarAngleRad }
}

/**
 * Linear cortical distance from the occipital pole to the representation of a
 * given eccentricity, following Horton & Hoyt (1991): d(E) = K * ln(1 + E/E2).
 */
export function corticalDistanceMm(
  eccentricityDeg: number,
  k: number = CORTICAL_MAGNIFICATION_K,
  e2: number = CORTICAL_MAGNIFICATION_E2,
): number {
  const e = Math.max(0, eccentricityDeg)
  return k * Math.log(1 + e / e2)
}

/**
 * Cortical magnification factor M(E) = K / (E + E2), in mm of cortex per degree
 * of visual angle (Horton & Hoyt, 1991).
 */
export function corticalMagnification(
  eccentricityDeg: number,
  k: number = CORTICAL_MAGNIFICATION_K,
  e2: number = CORTICAL_MAGNIFICATION_E2,
): number {
  const e = Math.max(0, eccentricityDeg)
  return k / (e + e2)
}

/**
 * Map a visual-field point to a schematic V1 location, applying the three
 * well-established organizing principles:
 *   1. Contralateral representation: left field -> right hemisphere.
 *   2. Vertical inversion about the calcarine: upper field -> ventral bank.
 *   3. Cortical magnification: eccentricity -> distance via Horton & Hoyt.
 */
export function visualFieldToCortex(
  point: VisualFieldPoint,
  maxEccentricityDeg: number = DEFAULT_MAX_ECCENTRICITY_DEG,
): CorticalPoint {
  const { vfx, vfy, eccentricityDeg } = point

  // 1. Contralateral hemisphere. Points exactly on the vertical meridian
  //    (vfx === 0) are represented at the V1 border of both hemispheres; we
  //    assign them to "left" deterministically for a stable, testable result.
  const hemisphere: Hemisphere = vfx < 0 ? "right" : "left"

  // 2. Dorsal/ventral bank. Upper field -> ventral, lower field -> dorsal.
  //    Points on the horizontal meridian (vfy === 0) sit on the fissure; we
  //    assign them to "dorsal" deterministically.
  const bank: CorticalBank = vfy > 0 ? "ventral" : "dorsal"

  // 3. Cortical distance from the pole (fovea) via Horton & Hoyt (1991).
  const dMm = corticalDistanceMm(eccentricityDeg, CORTICAL_MAGNIFICATION_K, CORTICAL_MAGNIFICATION_E2)
  const dMaxMm = corticalDistanceMm(maxEccentricityDeg)
  const flatX = dMaxMm > 0 ? Math.min(1, dMm / dMaxMm) : 0

  // Vertical placement: distance from the horizontal meridian (calcarine).
  // beta = angle within the quadrant, 0 at horizontal meridian, PI/2 at the
  // vertical meridian (the dorsal/ventral lip of V1).
  const beta = Math.atan2(Math.abs(vfy), Math.abs(vfx)) // 0 .. PI/2
  const offset = (beta / (Math.PI / 2)) * 0.5 // 0 .. 0.5
  const flatY = bank === "ventral" ? 0.5 + offset : 0.5 - offset

  return { hemisphere, bank, corticalDistanceMm: dMm, flatX, flatY }
}

/**
 * Inverse of {@link visualFieldToCortex}: given a schematic cortical location
 * (flatX, flatY on a per-hemisphere flatmap) recover the visual-field point it
 * represents. This is what lets us sample the visual field UNIFORMLY IN CORTICAL
 * SPACE: stepping evenly across (flatX, flatY) yields visual-field locations
 * that are dense near the fovea and sparse in the periphery, in proportion to
 * cortical magnification. That is the log-polar / cortical-sampling model
 * (Schwartz, 1977) and it is why central vision is sampled at higher resolution.
 *
 *   flatX: 0 = occipital pole (fovea) .. 1 = anterior V1 (far periphery)
 *   flatY: 0.5 = calcarine (horizontal meridian); <0.5 dorsal/lower field,
 *          >0.5 ventral/upper field; 0 and 1 = the vertical-meridian lips.
 */
export function cortexToVisualField(
  flatX: number,
  flatY: number,
  hemisphere: Hemisphere,
  maxEccentricityDeg: number = DEFAULT_MAX_ECCENTRICITY_DEG,
): VisualFieldPoint {
  const fx = Math.max(0, Math.min(1, flatX))
  const fy = Math.max(0, Math.min(1, flatY))

  // Invert d(E) = K * ln(1 + E/E2)  ->  E = E2 * (exp(d/K) - 1).
  const dMax = corticalDistanceMm(maxEccentricityDeg)
  const dMm = fx * dMax
  const eRaw = CORTICAL_MAGNIFICATION_E2 * (Math.exp(dMm / CORTICAL_MAGNIFICATION_K) - 1)
  const eccentricityDeg = Math.max(0, Math.min(maxEccentricityDeg, eRaw))
  const rNorm = eccentricityDeg / maxEccentricityDeg

  // Recover the polar angle within the quadrant from the vertical offset.
  const beta = (Math.abs(fy - 0.5) / 0.5) * (Math.PI / 2) // 0 .. PI/2
  const magX = rNorm * Math.cos(beta)
  const magY = rNorm * Math.sin(beta)

  // Hemisphere fixes the horizontal sign (left hemi <-> right field), the bank
  // (flatY) fixes the vertical sign (ventral/upper vs dorsal/lower).
  const vfx = hemisphere === "left" ? magX : -magX
  const vfy = fy > 0.5 ? magY : -magY

  return { vfx, vfy, eccentricityDeg, polarAngleRad: Math.atan2(vfy, vfx) }
}

/** Convenience: grid cell straight through to a cortical point. */
export function gridCellToCortex(
  row: number,
  col: number,
  rows: number,
  cols: number,
  maxEccentricityDeg: number = DEFAULT_MAX_ECCENTRICITY_DEG,
): CorticalPoint {
  const vf = gridCellToVisualField(row, col, rows, cols, maxEccentricityDeg)
  return visualFieldToCortex(vf, maxEccentricityDeg)
}

/**
 * =====================================================================
 * LIMITATIONS
 * =====================================================================
 * - This is a 2D approximation. It does NOT reproduce an individual's folded
 *   cortical anatomy, the exact geometry of the calcarine sulcus, or the
 *   confluence of foveal representations across hemispheres.
 * - K and E2 are population averages; cortical magnification varies between
 *   individuals.
 * - The field-of-view (maxEccentricityDeg) is an assumption of the simulator.
 * - The model says nothing about what a prosthesis user would actually perceive.
 */
