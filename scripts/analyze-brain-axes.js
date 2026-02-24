const url = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/full_brain_binary-0vuQ27s7jJqBMx7FCU8Wrp1GM2X8Di.glb';
const resp = await fetch(url);
const arrayBuf = await resp.arrayBuffer();
const buf = Buffer.from(arrayBuf);

// Parse GLB
const jsonChunkLength = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonChunkLength).toString('utf8');
const gltf = JSON.parse(jsonStr);

// Find binary chunk
const binOffset = 20 + jsonChunkLength + 8; // 8 bytes for bin chunk header
const binBuf = buf.slice(binOffset);

// Find position accessor
const posAccessorIdx = gltf.meshes[0].primitives[0].attributes.POSITION;
const posAccessor = gltf.accessors[posAccessorIdx];
const posBufferView = gltf.bufferViews[posAccessor.bufferView];

console.log('Position accessor:');
console.log('  count:', posAccessor.count);
console.log('  min:', JSON.stringify(posAccessor.min));
console.log('  max:', JSON.stringify(posAccessor.max));

// Read vertex positions
const dataOffset = (posBufferView.byteOffset || 0) + (posAccessor.byteOffset || 0);
const float32 = new Float32Array(binBuf.buffer, binBuf.byteOffset + dataOffset, posAccessor.count * 3);

// Find extreme vertices along each axis
const extremes = {
  minX: { val: Infinity, pos: null },
  maxX: { val: -Infinity, pos: null },
  minY: { val: Infinity, pos: null },
  maxY: { val: -Infinity, pos: null },
  minZ: { val: Infinity, pos: null },
  maxZ: { val: -Infinity, pos: null },
};

for (let i = 0; i < posAccessor.count; i++) {
  const x = float32[i * 3];
  const y = float32[i * 3 + 1];
  const z = float32[i * 3 + 2];
  if (x < extremes.minX.val) { extremes.minX.val = x; extremes.minX.pos = [x, y, z]; }
  if (x > extremes.maxX.val) { extremes.maxX.val = x; extremes.maxX.pos = [x, y, z]; }
  if (y < extremes.minY.val) { extremes.minY.val = y; extremes.minY.pos = [x, y, z]; }
  if (y > extremes.maxY.val) { extremes.maxY.val = y; extremes.maxY.pos = [x, y, z]; }
  if (z < extremes.minZ.val) { extremes.minZ.val = z; extremes.minZ.pos = [x, y, z]; }
  if (z > extremes.maxZ.val) { extremes.maxZ.val = z; extremes.maxZ.pos = [x, y, z]; }
}

console.log('\n--- EXTREME VERTICES ---');
console.log('Most -X vertex:', JSON.stringify(extremes.minX));
console.log('Most +X vertex:', JSON.stringify(extremes.maxX));
console.log('Most -Y vertex:', JSON.stringify(extremes.minY));
console.log('Most +Y vertex:', JSON.stringify(extremes.maxY));
console.log('Most -Z vertex:', JSON.stringify(extremes.minZ));
console.log('Most +Z vertex:', JSON.stringify(extremes.maxZ));

// Compute center of mass
let cx = 0, cy = 0, cz = 0;
for (let i = 0; i < posAccessor.count; i++) {
  cx += float32[i * 3];
  cy += float32[i * 3 + 1];
  cz += float32[i * 3 + 2];
}
cx /= posAccessor.count;
cy /= posAccessor.count;
cz /= posAccessor.count;
console.log('\nCenter of mass:', cx.toFixed(2), cy.toFixed(2), cz.toFixed(2));

// The brain should be roughly symmetric. Find the axis of symmetry.
// Typical MRI coordinates: X = left-right, Y = posterior-anterior, Z = inferior-superior
// But the model may be rotated. Let's check which axis has the most symmetry.
const ranges = {
  x: extremes.maxX.val - extremes.minX.val,
  y: extremes.maxY.val - extremes.minY.val,
  z: extremes.maxZ.val - extremes.minZ.val
};
console.log('\nAxis ranges:');
console.log('  X range:', ranges.x.toFixed(2), '(', extremes.minX.val.toFixed(2), 'to', extremes.maxX.val.toFixed(2), ')');
console.log('  Y range:', ranges.y.toFixed(2), '(', extremes.minY.val.toFixed(2), 'to', extremes.maxY.val.toFixed(2), ')');
console.log('  Z range:', ranges.z.toFixed(2), '(', extremes.minZ.val.toFixed(2), 'to', extremes.maxZ.val.toFixed(2), ')');

// Check how symmetric the center of mass is along each axis
const midX = (extremes.minX.val + extremes.maxX.val) / 2;
const midY = (extremes.minY.val + extremes.maxY.val) / 2;
const midZ = (extremes.minZ.val + extremes.maxZ.val) / 2;
console.log('\nGeometric center:', midX.toFixed(2), midY.toFixed(2), midZ.toFixed(2));
console.log('Center of mass offset from geometric center:');
console.log('  X offset:', (cx - midX).toFixed(2), '(small = symmetric in X = left-right axis)');
console.log('  Y offset:', (cy - midY).toFixed(2), '(small = symmetric in Y)');
console.log('  Z offset:', (cz - midZ).toFixed(2), '(small = symmetric in Z)');

// The axis that is MOST symmetric (smallest offset) is likely left-right
// The LONGEST axis is likely anterior-posterior
// Let's identify them
const offsets = [
  { axis: 'X', offset: Math.abs(cx - midX), range: ranges.x },
  { axis: 'Y', offset: Math.abs(cy - midY), range: ranges.y },
  { axis: 'Z', offset: Math.abs(cz - midZ), range: ranges.z },
];
offsets.sort((a, b) => a.offset - b.offset);
console.log('\nAxis identification (by symmetry):');
console.log('  Most symmetric (likely Left-Right):', offsets[0].axis, 'offset:', offsets[0].offset.toFixed(3));
console.log('  Middle (likely Sup-Inf):', offsets[1].axis, 'offset:', offsets[1].offset.toFixed(3));
console.log('  Least symmetric (likely Ant-Post):', offsets[2].axis, 'offset:', offsets[2].offset.toFixed(3));

// Sample vertices near the user-provided target (-66.89, 8.88, -6.95)
console.log('\n--- VERTICES NEAR USER TARGET (-66.89, 8.88, -6.95) ---');
let nearTarget = [];
for (let i = 0; i < posAccessor.count; i++) {
  const x = float32[i * 3];
  const y = float32[i * 3 + 1];
  const z = float32[i * 3 + 2];
  const d = Math.sqrt((x+66.89)**2 + (y-8.88)**2 + (z+6.95)**2);
  if (d < 5.0) nearTarget.push({ x: x.toFixed(2), y: y.toFixed(2), z: z.toFixed(2), d: d.toFixed(2) });
}
console.log('Vertices within 5 units:', nearTarget.length);
if (nearTarget.length > 0) console.log('Sample:', nearTarget.slice(0, 5));

// Check: what does model-viewer treat as "up" and "front"?
// model-viewer uses Y-up, Z-forward convention (like glTF spec)
// So in glTF: +Y is up, +Z comes toward the viewer, -Z goes away
console.log('\n--- glTF CONVENTION ---');
console.log('glTF uses Y-up, Z-forward convention');
console.log('Most +Y vertex (top of brain):', JSON.stringify(extremes.maxY.pos?.map(v => v.toFixed(2))));
console.log('Most -Y vertex (bottom of brain):', JSON.stringify(extremes.minY.pos?.map(v => v.toFixed(2))));
console.log('Most -Z vertex (back of brain - occipital):', JSON.stringify(extremes.minZ.pos?.map(v => v.toFixed(2))));
console.log('Most +Z vertex (front of brain - frontal):', JSON.stringify(extremes.maxZ.pos?.map(v => v.toFixed(2))));
