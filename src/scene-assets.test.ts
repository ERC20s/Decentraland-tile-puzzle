import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

function isNumber(v: any): boolean {
  return typeof v === 'number' && Number.isFinite(v)
}

function looksLikeQuat(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    Object.prototype.hasOwnProperty.call(obj, 'x') &&
    Object.prototype.hasOwnProperty.call(obj, 'y') &&
    Object.prototype.hasOwnProperty.call(obj, 'z') &&
    Object.prototype.hasOwnProperty.call(obj, 'w')
  )
}

function scanForQuats(value: any, pathSoFar: string[], found: Array<{ q: any; path: string }>) {
  if (!value || typeof value !== 'object') return

  if (looksLikeQuat(value)) {
    found.push({ q: value, path: pathSoFar.join('.') })
    return
  }

  if (Array.isArray(value)) {
    value.forEach((v, i) => scanForQuats(v, pathSoFar.concat(`[${i}]`), found))
  } else {
    Object.keys(value).forEach((k) => scanForQuats(value[k], pathSoFar.concat(k), found))
  }
}

describe('scene composite assets should not contain all-zero or non-finite quaternions', () => {
  it('assets/scene/main.composite contains no invalid quaternions', () => {
    const compPath = path.join(__dirname, '..', 'assets', 'scene', 'main.composite')
    const raw = fs.readFileSync(compPath, 'utf8')
    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      // If the composite is not valid JSON, let other tests fail; this test only checks quaternions
      return
    }

    const found: Array<{ q: any; path: string }> = []
    scanForQuats(parsed, [], found)

    const invalids: Array<{ q: any; path: string; reason: string }> = []

    for (const entry of found) {
      const q = entry.q
      const pathStr = entry.path || '<root>'

      if (!isNumber(q.x) || !isNumber(q.y) || !isNumber(q.z) || !isNumber(q.w)) {
        invalids.push({ q, path: pathStr, reason: 'non-finite component or non-number' })
        continue
      }

      const normSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w
      const norm = Math.sqrt(normSq)
      if (!Number.isFinite(norm) || norm <= Number.EPSILON) {
        invalids.push({ q, path: pathStr, reason: 'zero-length quaternion (all-zero) or non-finite norm' })
      }
    }

    if (invalids.length > 0) {
      const msgLines = invalids.map((iv, i) => `${i + 1}) path=${iv.path} reason=${iv.reason} q=${JSON.stringify(iv.q)}`)
      throw new Error(`Found invalid quaternions in composite:\n${msgLines.join('\n')}`)
    }
  })
})
