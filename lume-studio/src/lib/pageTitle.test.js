import { describe, it, expect } from 'vitest'
import { titleForPath } from './pageTitle'

describe('titleForPath', () => {
  it.each([
    ['/posts', '', 'Posts · Lume'],
    ['/posts', '?view=calendar', 'Calendar · Lume'],
    ['/posts/abc', '', 'Post · Lume'],
    ['/campaigns/xyz', '', 'Campaign · Lume'],
    ['/media/1', '', 'Album · Lume'],
    ['/nowhere', '', 'Lume Studio'],
    ['/', '', 'Lume Studio'],
  ])('%s%s → %s', (path, search, title) => {
    expect(titleForPath(path, search)).toBe(title)
  })
})
