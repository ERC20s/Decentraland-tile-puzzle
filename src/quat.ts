export interface Quat { x: number; y: number; z: number; w: number }

export function normalizeQuaternionOrIdentity(q: Quat): Quat {
  if (!q || typeof q.x !== 'number' || typeof q.y !== 'number' || typeof q.z !== 'number' || typeof q.w !== 'number') {
    return { x: 0, y: 0, z: 0, w: 1 }
  }
  const norm = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w)
  if (norm <= Number.EPSILON) {
    return { x: 0, y: 0, z: 0, w: 1 }
  }
  return { x: q.x / norm, y: q.y / norm, z: q.z / norm, w: q.w / norm }
}
