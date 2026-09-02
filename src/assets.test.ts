import { describe, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('referenced local asset files should exist in the repository', () => {
  it('checks that images, audio and model files referenced by the scene are present', () => {
    const expectedPaths = [
      // the 25 numbered tile images used by src/ui.tsx
      'images/image1x1.png', 'images/image2x1.png', 'images/image3x1.png', 'images/image4x1.png', 'images/image5x1.png',
      'images/image1x2.png', 'images/image2x2.png', 'images/image3x2.png', 'images/image4x2.png', 'images/image5x2.png',
      'images/image1x3.png', 'images/image2x3.png', 'images/image3x3.png', 'images/image4x3.png', 'images/image5x3.png',
      'images/image1x4.png', 'images/image2x4.png', 'images/image3x4.png', 'images/image4x4.png', 'images/image5x4.png',
      'images/image1x5.png', 'images/image2x5.png', 'images/image3x5.png', 'images/image4x5.png', 'images/image5x5.png',

      // win audio referenced in src/reward.ts
      'music/champ2.mp3',

      // models referenced in src/reward.ts and README
      'models/machine.glb',
      'models/grass/FloorBaseGrass_01.glb',
    ]

    const missing: string[] = []
    for (const rel of expectedPaths) {
      const full = path.join(__dirname, '..', rel)
      if (!fs.existsSync(full)) missing.push(rel)
    }

    if (missing.length > 0) {
      const lines = missing.map((m, i) => `${i + 1}) ${m}`)
      throw new Error(`Missing referenced asset files (${missing.length}):\n${lines.join('\n')}`)
    }
  })
})
