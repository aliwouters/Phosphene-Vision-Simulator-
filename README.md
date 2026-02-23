## The Core Idea: Retinotopic Mapping

The retina has a direct, organized mapping onto the primary visual cortex (area V1) in the occipital lobe. This means neighboring points in your visual field activate neighboring neurons in V1. This is called **retinotopy**, and it was first systematically mapped by Daniel and Whitteridge (1961) using electrophysiology in cats and monkeys.

## How the Code Maps Grid Cells to the Brain

The camera feed is divided into a grid. Each cell has a position (row, column) relative to the center of the image. The code converts that position into two values:

1. **Eccentricity** -- how far the cell is from the center of the image (the fixation point). Center = fovea, edges = periphery.
2. **Polar angle** -- whether the cell is above, below, left, or right of center.


These two values are then placed onto V1 using three well-established rules from the literature:

- **Log-polar compression** (Schwartz, 1977): The fovea (center of gaze) takes up a disproportionately large area of V1 compared to the periphery. The code uses an exponential function (`Math.exp((1 - u) / logScale)`) to simulate this - the posterior tip of V1 (back of the brain) represents central vision with high resolution, while the anterior part represents the periphery in a compressed way.
- **Calcarine sulcus split** (Holmes, 1918; Horton & Hoyt, 1991): The upper visual field maps to the **ventral** bank (below the calcarine sulcus) and the lower visual field maps to the **dorsal** bank (above it). The code uses the polar angle mapped to `(v - 0.5) * PI * 0.85` to place grid rows above or below the sulcus line accordingly.
- **Left-right crossing**: In reality, the left visual field maps to the right hemisphere and vice versa. Since we're only drawing one hemisphere, the code maps the full field onto a single medial view for simplicity.


### The Heat Color

Once a grid cell is mapped to a pixel location on the V1 region of the brain drawing, its brightness value (2-77) determines the color using a cold-to-hot scale: dark blue (low stimulus) through cyan, green, yellow, to white (high stimulus). This is a standard scientific heatmap colorscale.

### Key References

- **Schwartz, E.L. (1977)** - Established the log-polar model of V1 retinotopy
- **Daniel & Whitteridge (1961)** - First quantitative measurements of cortical magnification factor
- **Horton & Hoyt (1991)** - Revised the classic Holmes map of human V1 retinotopy using MRI–visual field correlations
- **Wandell, Dumoulin & Brewer (2007)** - Modern fMRI-based retinotopic mapping confirming these principles


The mapping is a simplified simulation. A real V1 map would account for individual cortical folding, the cortical magnification factor varying by individual, and the precise geometry of the calcarine sulcus. But the core principles (log-polar compression, dorsal/ventral split, foveal over-representation at the posterior pole) are faithful to the literature.

