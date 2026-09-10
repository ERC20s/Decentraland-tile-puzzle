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
  // Use a small, practical floor rather than Number.EPSILON (~2.2e-16).
  // Number.EPSILON is so small that dividing by norms near that value can
  // produce huge components or unstable rounding on some runtimes; a
  // defensible threshold avoids those pathological results while preserving
  // valid rotations. 1e-12 is chosen as a conservative practical floor.
  const MIN_NORM = 1e-12
  // Compare squared norms to avoid taking a square root of a tiny/subnormal
  // value before deciding to bail. If the squared norm is non-finite or
  // below the squared threshold, return the identity quaternion.
  if (!Number.isFinite(normSq) || normSq <= MIN_NORM * MIN_NORM) {
    return { x: 0, y: 0, z: 0, w: 1 }
  }

  const inv = 1 / Math.sqrt(normSq)
  return { x: q.x * inv, y: q.y * inv, z: q.z * inv, w: q.w * inv }
}
