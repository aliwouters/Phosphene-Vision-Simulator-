# Phosphene Vision Simulator

An **educational** web simulation of how a camera-driven visual prosthesis could turn a
scene into a pattern of stimulation, and how that pattern maps onto primary visual cortex
(V1). It runs entirely in the browser using your device camera as a stand-in for the
camera on a pair of prosthesis glasses.

> **This is a teaching tool, not a medical or engineering instrument.** It does **not**
> predict what any individual prosthesis user perceives, and it does **not** compute safe
> or effective electrical stimulation parameters. Every quantitative claim below is either
> derived from a cited source or explicitly labeled as an assumption.

## What each panel means

Every panel carries a label describing how literally it should be taken:

| Label | Meaning |
| --- | --- |
| `approximation` | Backed by an explicit equation or measurement, with simplifying assumptions. |
| `schematic` | Structurally faithful to published organizing principles, but conceptual in layout. |
| `illustrative` | Chosen for legibility, not a quantitative claim. |

### 1. Camera feed (`illustrative`)
Your camera stands in for the glasses-mounted camera used by head-mounted prostheses. The
frame is divided into a grid; the grid resolution echoes a device's electrode/pixel count
(see presets). The image is mirrored for a natural selfie view — this mirror is cosmetic
and is deliberately excluded from the scientific model.

### 2. Stimulation intensity (`approximation`)
Each grid cell's average brightness becomes one **normalized stimulation intensity** in
`0–100`. This is a **unitless index**, not a physical measurement.

The simulator deliberately keeps four distinct quantities separate and only models the
first mapping:

1. Camera pixel brightness (Rec. 601 luma).
2. Normalized stimulation intensity `0–1` (what we compute).
3. Electrical current in microamperes (µA) a real device would deliver.
4. Perceived phosphene brightness.

We map **(1) → (2)** only. We intentionally do **not** assign microampere values, because
the relationship between image brightness and a safe, effective current is device-,
electrode-, and subject-specific and is not established by a single published formula.
Perceived brightness also **saturates** with current rather than rising linearly
(Bosking et al., 2017), so a linear "brightness = current" claim would be misleading.

### 3. Phosphene map (`illustrative`)
A simple sketch of the discrete, punctate quality of prosthetic vision: one dot per cell,
brighter/larger where intensity is higher. Cortical prosthesis users describe artificial
vision as separate points of light rather than a continuous image (Brindley & Lewin, 1968;
Fernández et al., 2021). This grid keeps the camera layout for recognizability and does
**not** apply cortical magnification or hemifield mapping; real phosphenes vary in size,
shape, and color, overlap, and do not fall on a tidy grid.

### 4. V1 retinotopic map (`schematic`)
A forward projection of every grid cell onto a flattened, per-hemisphere map of V1 using
three well-established organizing principles:

- **Contralateral representation** — the left visual field is represented in the right
  hemisphere and vice versa (Holmes, 1918; Horton & Hoyt, 1991).
- **Dorsal/ventral inversion about the calcarine sulcus** — the upper visual field maps to
  the ventral bank, the lower field to the dorsal bank.
- **Cortical magnification** — central vision occupies disproportionately more cortex than
  the periphery.

## The model (see `lib/retinotopy.ts` and `lib/phosphene.ts`)

**Cortical magnification** uses the human function reported by Horton & Hoyt (1991), who
revised the classic Holmes map using MRI/visual-field correlation:

$$M(E) = \frac{K}{E + E_2}, \quad K = 17.3\ \text{mm·deg}, \quad E_2 = 0.75\ \text{deg}$$

Integrating from the fovea gives the cortical distance from the occipital pole to the
representation of eccentricity $$E$$:

$$d(E) = K \cdot \ln\!\left(1 + \frac{E}{E_2}\right)$$

This is the logarithmic form of the log-polar mapping analyzed by Schwartz (1977). Both
functions, the visual-field mapping, and the brightness→intensity transfer are unit-tested
in `lib/*.test.ts`.

### Assumptions and limitations
- The model is 2D. It does **not** reproduce an individual's folded cortical anatomy, the
  exact calcarine geometry, or the foveal confluence across hemispheres. The two
  hemispheres are drawn side by side for clarity; real V1 sits on the medial walls of both
  occipital lobes.
- `K` and `E₂` are population averages; magnification varies between individuals.
- The camera field of view (`DEFAULT_MAX_ECCENTRICITY_DEG = 40°`) is a simulation choice,
  not a measured device value.
- Device presets change **only the grid resolution** to echo an electrode/pixel count.
  They do **not** reproduce any device's electrode layout, stimulation strategy, or the
  vision it produces. Argus II and PRIMA are retinal implants; the Utah-array preset and
  the V1 map concern the visual cortex — they are placed in one tool for comparison, not
  to imply they produce the same percept.

## Device presets

| Preset | Grid | Inspired by |
| --- | --- | --- |
| Argus II | 6×10 (60) | 60-electrode epiretinal array (da Cruz et al., 2016). Retinal. |
| PRIMA | 19×19 (~361) | ~378-pixel photovoltaic subretinal implant (Palanker et al., 2020), grid approximation. Retinal. |
| Utah 96ch | 10×10 (~96) | 96-channel intracortical array in V1 (Fernández et al., 2021). Cortical. |

## Tech stack
- Next.js (App Router) + React + TypeScript
- Tailwind CSS v4
- HTML5 `getUserMedia` camera capture and `<canvas>` rendering
- Vitest for the unit-tested scientific core

## Running locally
```bash
pnpm install
pnpm dev      # start the dev server
pnpm test     # run the model unit tests
```
Camera access requires a secure context (HTTPS or `localhost`) and user permission. No
video ever leaves the browser.

## References
1. Holmes, G. (1918). Disturbances of vision by cerebral lesions. *British Journal of
   Ophthalmology*, 2(7), 353–384. https://doi.org/10.1136/bjo.2.7.353
2. Daniel, P. M., & Whitteridge, D. (1961). The representation of the visual field on the
   cerebral cortex in monkeys. *The Journal of Physiology*, 159(2), 203–221.
   https://doi.org/10.1113/jphysiol.1961.sp006803
3. Brindley, G. S., & Lewin, W. S. (1968). The sensations produced by electrical
   stimulation of the visual cortex. *The Journal of Physiology*, 196(2), 479–493.
   https://doi.org/10.1113/jphysiol.1968.sp008519
4. Schwartz, E. L. (1977). Spatial mapping in the primate sensory projection: analytic
   structure and relevance to perception. *Biological Cybernetics*, 25(4), 181–194.
   https://doi.org/10.1007/BF01885636
5. Horton, J. C., & Hoyt, W. F. (1991). The representation of the visual field in human
   striate cortex: a revision of the classic Holmes map. *Archives of Ophthalmology*,
   109(6), 816–824. https://doi.org/10.1001/archopht.1991.01080060080030
6. da Cruz, L., et al. (2016). Five-year safety and performance results from the Argus II
   Retinal Prosthesis System clinical trial. *Ophthalmology*, 123(10), 2248–2254.
   https://doi.org/10.1016/j.ophtha.2016.06.049
7. Bosking, W. H., Sun, P., Ozker, M., Pei, X., Foster, B. L., Beauchamp, M. S., &
   Yoshor, D. (2017). Saturation in phosphene size with increasing current levels
   delivered to human visual cortex. *The Journal of Neuroscience*, 37(30), 7188–7197.
   https://doi.org/10.1523/JNEUROSCI.2896-16.2017
8. Palanker, D., Le Mer, Y., Mohand-Said, S., Muqit, M., & Sahel, J. A. (2020).
   Photovoltaic restoration of central vision in atrophic age-related macular
   degeneration. *Ophthalmology*, 127(8), 1097–1104.
   https://doi.org/10.1016/j.ophtha.2020.02.024
9. Fernández, E., et al. (2021). Visual percepts evoked with an intracortical 96-channel
   microelectrode array inserted in human occipital cortex. *The Journal of Clinical
   Investigation*, 131(23), e151331. https://doi.org/10.1172/JCI151331

*References were selected to support specific modeling choices; DOIs were verified against
Crossref. This project is for education and public understanding of science.*
