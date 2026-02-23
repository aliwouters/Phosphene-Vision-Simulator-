import { readFileSync } from 'fs';

const buf = readFileSync('/vercel/share/v0-project/public/models/full_brain_binary.glb');

// GLB header: magic(4) + version(4) + length(4) + chunkLength(4) + chunkType(4) + JSON...
const magic = buf.readUInt32LE(0);
console.log('Magic:', magic === 0x46546C67 ? 'Valid glTF' : 'Invalid');
console.log('Version:', buf.readUInt32LE(4));
console.log('Total length:', buf.readUInt32LE(8), 'bytes');

const jsonChunkLength = buf.readUInt32LE(12);
const jsonChunkType = buf.readUInt32LE(16);
console.log('JSON chunk length:', jsonChunkLength);
console.log('JSON chunk type:', jsonChunkType === 0x4E4F534A ? 'JSON' : 'Unknown');

const jsonStr = buf.slice(20, 20 + jsonChunkLength).toString('utf8');
const gltf = JSON.parse(jsonStr);

console.log('\n--- SCENES ---');
console.log(JSON.stringify(gltf.scenes, null, 2));

console.log('\n--- NODES ---');
if (gltf.nodes) {
  gltf.nodes.forEach((node, i) => {
    console.log(`  Node ${i}: name="${node.name || '(unnamed)'}", mesh=${node.mesh ?? 'none'}, children=${JSON.stringify(node.children || [])}`);
    if (node.translation) console.log(`    translation: ${node.translation}`);
    if (node.rotation) console.log(`    rotation: ${node.rotation}`);
    if (node.scale) console.log(`    scale: ${node.scale}`);
  });
}

console.log('\n--- MESHES ---');
if (gltf.meshes) {
  gltf.meshes.forEach((mesh, i) => {
    console.log(`  Mesh ${i}: name="${mesh.name || '(unnamed)'}", primitives=${mesh.primitives.length}`);
    mesh.primitives.forEach((prim, j) => {
      console.log(`    Primitive ${j}: mode=${prim.mode ?? 4}, material=${prim.material ?? 'none'}`);
      console.log(`      attributes: ${JSON.stringify(prim.attributes)}`);
      if (prim.indices !== undefined) console.log(`      indices accessor: ${prim.indices}`);
    });
  });
}

console.log('\n--- MATERIALS ---');
if (gltf.materials) {
  gltf.materials.forEach((mat, i) => {
    console.log(`  Material ${i}: name="${mat.name || '(unnamed)'}"`);
    if (mat.pbrMetallicRoughness) {
      const pbr = mat.pbrMetallicRoughness;
      console.log(`    baseColorFactor: ${JSON.stringify(pbr.baseColorFactor)}`);
    }
  });
}

console.log('\n--- ACCESSORS (first few) ---');
if (gltf.accessors) {
  const posAccessors = gltf.accessors.filter(a => a.type === 'VEC3');
  posAccessors.forEach((acc, i) => {
    console.log(`  Accessor: type=${acc.type}, count=${acc.count}, componentType=${acc.componentType}`);
    if (acc.min) console.log(`    min: ${JSON.stringify(acc.min)}`);
    if (acc.max) console.log(`    max: ${JSON.stringify(acc.max)}`);
  });
}

console.log('\n--- BUFFER VIEWS ---');
console.log(`  Total buffer views: ${gltf.bufferViews?.length || 0}`);
console.log(`  Total buffers: ${gltf.buffers?.length || 0}`);
if (gltf.buffers) {
  gltf.buffers.forEach((b, i) => console.log(`  Buffer ${i}: byteLength=${b.byteLength}`));
}
