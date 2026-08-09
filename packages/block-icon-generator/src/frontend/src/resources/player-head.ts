import { fill } from 'es-toolkit'

export function stripSecondHeadLayer(texturePixels: number[]) {
  // sanity check
  if (texturePixels.length !== 64 * 64 * 4) {
    throw new Error('Invalid texturePixels array length')
  }

  const arr = texturePixels.slice()

  for (let y = 0; y < 16; y++) {
    const start = y * 64 + 32
    const end = y * 64 + 64

    fill(arr, 0, start * 4, end * 4) // fill all rgba value to zero
  }

  return arr
}
