/**
 * Image-processing and phosphene helpers.
 *
 * This module keeps four distinct quantities clearly separated. They are NOT
 * interchangeable, and conflating them is a common source of misleading claims
 * in phosphene simulators:
 *
 *   1. Camera pixel intensity        - a luminance value in [0, 255] read from
 *                                       the RGB camera frame (Rec. 601 luma).
 *   2. Normalized stimulation        - a unitless value in [0, 1] (shown as a
 *      intensity                        0-100 index in the UI). This is what the
 *                                       simulator computes and displays.
 *   3. Electrical current (uA)       - the physical current a real device would
 *                                       deliver. This simulator does NOT model
 *                                       it, because the mapping from image
 *                                       brightness to safe current is device-,
 *                                       electrode-, and subject-specific and is
 *                                       not established by published data.
 *   4. Perceived phosphene brightness- what a user would actually see. Not
 *                                       modeled; phosphene brightness saturates
 *                                       with current (Bosking et al., 2017) and
 *                                       is not a linear function of image pixels.
 *
 * The dot size and glow used for display are ILLUSTRATIVE choices to make the
 * output legible, not calibrated predictions of phosphene appearance.
 */

/** Display scale for the normalized intensity index shown in the UI. */
export const INTENSITY_DISPLAY_MAX = 100

/**
 * Rec. 601 luma from 8-bit RGB. This is a standard perceptual approximation of
 * brightness, not a photometric luminance measurement.
 */
export function lumaFromRgb(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114
}

/**
 * Convert an average camera pixel luma in [0, 255] to a normalized stimulation
 * intensity in [0, 1]. This is a linear, illustrative mapping; real encoders
 * apply device-specific gamma, contrast, and gain.
 */
export function pixelLumaToNormalizedIntensity(avgLuma: number): number {
  return clamp01(avgLuma / 255)
}

/** Normalized intensity in [0, 1] -> integer display index in [0, 100]. */
export function toDisplayIntensity(normalized: number): number {
  return Math.round(clamp01(normalized) * INTENSITY_DISPLAY_MAX)
}

/** Integer display index in [0, 100] -> normalized intensity in [0, 1]. */
export function fromDisplayIntensity(display: number): number {
  return clamp01(display / INTENSITY_DISPLAY_MAX)
}

/**
 * Illustrative phosphene radius factor in [0, 1] as a function of normalized
 * intensity. Brighter cells render slightly larger. This is a legibility
 * choice, NOT a model of how current relates to phosphene size.
 */
export function illustrativePhospheneRadiusFactor(normalized: number): number {
  return 0.3 + clamp01(normalized) * 0.7
}

export function clamp01(v: number): number {
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}
