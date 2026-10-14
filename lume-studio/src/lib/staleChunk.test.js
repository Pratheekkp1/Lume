import { describe, it, expect } from 'vitest'
import { isStaleChunkError } from './staleChunk'

describe('isStaleChunkError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/Posts-abc.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/index.css',
  ])('recognises "%s"', msg => {
    expect(isStaleChunkError(new Error(msg))).toBe(true)
  })

  it('ignores ordinary errors', () => {
    expect(isStaleChunkError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false)
    expect(isStaleChunkError(null)).toBe(false)
  })
})
