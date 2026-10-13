import { describe, it, expect } from 'vitest'
import { GOTO_KEYS, SHORTCUTS, isTypingTarget } from './shortcuts'

describe('isTypingTarget', () => {
  it.each(['INPUT', 'TEXTAREA', 'SELECT'])('is true for %s', tagName => {
    expect(isTypingTarget({ tagName })).toBe(true)
  })

  it('is true for contenteditable elements', () => {
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
  })

  it('is false for other elements and for no element', () => {
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('GOTO_KEYS', () => {
  it('uses single lowercase keys pointing at app paths', () => {
    for (const [key, { path, label }] of Object.entries(GOTO_KEYS)) {
      expect(key).toHaveLength(1)
      expect(key).toBe(key.toLowerCase())
      expect(path.startsWith('/')).toBe(true)
      expect(label).toBeTruthy()
    }
  })

  it('maps each key to a different page', () => {
    const paths = Object.values(GOTO_KEYS).map(g => g.path)
    expect(new Set(paths).size).toBe(paths.length)
  })
})

describe('SHORTCUTS', () => {
  it('documents every "go to" key', () => {
    const goTo = SHORTCUTS.find(g => g.group === 'Go to')
    expect(goTo.items).toHaveLength(Object.keys(GOTO_KEYS).length)
  })

  it('has unique labels within each group (they are used as React keys)', () => {
    for (const group of SHORTCUTS) {
      const labels = group.items.map(i => i.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })
})
