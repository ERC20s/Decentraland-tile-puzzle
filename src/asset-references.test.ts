import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Guards against the class of bug where source code points at a local asset
// (a .glb model, an .mp3 clip, a tile .png) that was moved, renamed or never
// committed. Those references only blow up at runtime in the Decentraland
// client or while packaging the scene, which is far too late.
//
// Scope on purpose:
//  - only STRING LITERALS whose path starts with one of the local asset
//    folders that actually exist in this repository (images/, models/,
//    music/, assets/),
//  - only production sources under src/ (*.test.ts / *.test.tsx are skipped so
//    that a test fixture naming a deliberately absent file cannot fail this),
//  - literals containing a template interpolation (`${...}`) are skipped,
//    because the real path is only known at runtime.

const REPO_ROOT = path.join(__dirname, '..')
const SRC_DIR = __dirname

const ASSET_FOLDERS = ['images', 'models', 'music', 'assets']

// e.g. 'models/grass/FloorBaseGrass_01.glb' in src/index.ts,
//      'music/champ2.mp3' in src/reward.ts,
//      'images/image1x1.png' … in src/ui.tsx
const ASSET_LITERAL_RE = new RegExp(
  '([\'"`])((?:' + ASSET_FOLDERS.join('|') + ')\\/[^\'"`\\n]+)\\1',
  'g'
)

type Reference = { asset: string; source: string }

function isSourceFile(name: string): boolean {
  if (!/\.(ts|tsx)$/.test(name)) return false
  if (/\.test\.(ts|tsx)$/.test(name)) return false
  if (/\.d\.ts$/.test(name)) return false
  return true
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      out.push(...listSourceFiles(full))
    } else if (entry.isFile() && isSourceFile(entry.name)) {
      out.push(full)
    }
  }
  return out.sort()
}

function collectAssetReferences(): Reference[] {
  const refs: Reference[] = []
  for (const file of listSourceFiles(SRC_DIR)) {
    const contents = fs.readFileSync(file, 'utf8')
    const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/')
    let match: RegExpExecArray | null
    ASSET_LITERAL_RE.lastIndex = 0
    while ((match = ASSET_LITERAL_RE.exec(contents)) !== null) {
      const asset = match[2].trim()
      if (asset.includes('${')) continue // built at runtime, cannot be checked statically
      refs.push({ asset, source: rel })
    }
  }
  return refs
}

describe('asset files referenced from src/ exist in the repository', () => {
  const references = collectAssetReferences()

  it('finds asset path literals to check (guards the scanner itself)', () => {
    // If this ever drops to zero the scanner has stopped matching and the
    // suite below would pass vacuously.
    expect(references.length).toBeGreaterThan(0)
  })

  it('every referenced images/, models/, music/ or assets/ file is present', () => {
    const missing: Reference[] = []
    const seen = new Set<string>()

    for (const ref of references) {
      const key = `${ref.asset}|${ref.source}`
      if (seen.has(key)) continue
      seen.add(key)

      const onDisk = path.join(REPO_ROOT, ...ref.asset.split('/'))
      if (!fs.existsSync(onDisk)) missing.push(ref)
    }

    if (missing.length > 0) {
      const lines = missing.map((m, i) => `${i + 1}) ${m.asset} — referenced from ${m.source}`)
      throw new Error(
        `Missing asset files referenced by source code:\n${lines.join('\n')}\n` +
          'Either add the file to the repository or fix the reference.'
      )
    }

    expect(missing).toEqual([])
  })
})
