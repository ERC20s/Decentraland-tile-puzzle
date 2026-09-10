export interface Quat { x: number; y: number; z: number; w: number }

export function normalizeQuaternionOrIdentity(q: Quat): Quat {
  if (
    !q ||
    typeof q.x !== 'number' ||
    typeof q.y !== 'number' ||
    typeof q.z !== 'number' ||
    typeof q.w !== 'number' ||
    !Number.isFinite(q.x) ||
    !Number.isFinite(q.y) ||
    !Number.isFinite(q.z) ||
    !Number.isFinite(q.w)
  ) {
    return { x: 0, y: 0, z: 0, w: 1 }
  }

  const normSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w
  const norm = Math.sqrt(normSq)
  // Use a small, practical floor rather than Number.EPSILON (~2.2e-16).
  // Number.EPSILON is so small that dividing by norms near that value can
  // produce huge components or unstable rounding on some runtimes; a
  // defensible threshold avoids those pathological results while preserving
  // valid rotations. 1e-12 is chosen as a conservative practical floor.
  const MIN_NORM = 1e-12
  if (!Number.isFinite(norm) || norm <= MIN_NORM) {
    return { x: 0, y: 0, z: 0, w: 1 }
  }

  return { x: q.x / norm, y: q.y / norm, z: q.z / norm, w: q.w / norm }
}
