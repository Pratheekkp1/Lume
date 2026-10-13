import { describe, it, expect } from 'vitest'
import {
  BACKUP_APP, BACKUP_VERSION, BACKUP_TABLES,
  parseBackup, prepareRow, createBackup, restoreBackup,
} from './backup'

// A stand-in for the supabase-js client that records every call. `tables`
// holds the rows `select` returns; `failOn` makes upserts to a table fail.
function fakeClient({ tables = {}, failOn = [] } = {}) {
  const calls = []
  return {
    calls,
    from(table) {
      return {
        select() {
          return {
            range(from, to) {
              calls.push({ op: 'select', table, from, to })
              const rows = tables[table] || []
              return Promise.resolve({ data: rows.slice(from, to + 1), error: null })
            },
          }
        },
        upsert(rows, opts) {
          calls.push({ op: 'upsert', table, rows, onConflict: opts?.onConflict })
          const error = failOn.includes(table) ? { message: `${table} exploded` } : null
          return Promise.resolve({ error })
        },
      }
    },
  }
}

function backupText(tables, extra = {}) {
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exported_at: '2026-01-01T00:00:00Z', tables, ...extra })
}

describe('parseBackup', () => {
  it('counts rows per known table and ignores unknown ones', () => {
    const { counts } = parseBackup(backupText({ posts: [{ id: 'a' }, { id: 'b' }], photos: [{ id: 'p' }] }))
    expect(counts).toEqual({ posts: 2 })
  })

  it('rejects text that is not JSON', () => {
    expect(() => parseBackup('not json')).toThrow(/valid JSON/)
  })

  it('rejects the old lossy export format', () => {
    const legacy = JSON.stringify({ exported_at: 'x', posts: [], ideas: [] })
    expect(() => parseBackup(legacy)).toThrow(/doesn't look like a Lume backup/)
  })

  it('rejects backups from a newer version', () => {
    expect(() => parseBackup(backupText({}, { version: BACKUP_VERSION + 1 }))).toThrow(/newer version/)
  })

  it('rejects a damaged table section', () => {
    expect(() => parseBackup(backupText({ posts: { id: 'a' } }))).toThrow(/"posts" section/)
  })
})

describe('prepareRow', () => {
  it('never carries user_id across accounts', () => {
    expect(prepareRow('posts', { id: 'a', user_id: 'someone-else', title: 'T' })).toEqual({ id: 'a', title: 'T' })
  })

  it('drops album cover photos because photos are not in the backup', () => {
    expect(prepareRow('collections', { id: 'c', user_id: 'u', cover_photo_id: 'p' })).toEqual({ id: 'c', cover_photo_id: null })
  })

  it('matches brand kit rows by key, not id', () => {
    expect(prepareRow('brand_kit', { id: 'b', user_id: 'u', key: 'colors', value: [] })).toEqual({ key: 'colors', value: [] })
  })
})

describe('createBackup', () => {
  it('pages past the 1,000-row limit and includes every table', async () => {
    const posts = Array.from({ length: 2500 }, (_, i) => ({ id: `p${i}` }))
    const client = fakeClient({ tables: { posts } })
    const backup = await createBackup(client)

    expect(backup.app).toBe(BACKUP_APP)
    expect(backup.version).toBe(BACKUP_VERSION)
    expect(Object.keys(backup.tables)).toEqual(BACKUP_TABLES.map(t => t.table))
    expect(backup.tables.posts).toHaveLength(2500)
    expect(client.calls.filter(c => c.table === 'posts')).toHaveLength(3)
  })
})

describe('restoreBackup', () => {
  it('writes parents before children', async () => {
    const client = fakeClient()
    const tables = Object.fromEntries(BACKUP_TABLES.map(({ table }) => [table, [{ id: `${table}-1`, key: 'k' }]]))
    await restoreBackup(client, { tables })

    const order = [...new Set(client.calls.map(c => c.table))]
    const before = (a, b) => expect(order.indexOf(a)).toBeLessThan(order.indexOf(b))
    before('content_pillars', 'posts')
    before('categories', 'post_categories')
    before('posts', 'post_categories')
    before('posts', 'campaign_posts')
    before('campaigns', 'campaign_posts')
    before('posts', 'ideas')
  })

  it('uses composite keys for join tables', async () => {
    const client = fakeClient()
    await restoreBackup(client, { tables: { campaign_posts: [{ campaign_id: 'c', post_id: 'p' }] } })
    expect(client.calls[0].onConflict).toBe('campaign_id,post_id')
  })

  it('restores repurpose links in a second pass', async () => {
    const client = fakeClient()
    const posts = [
      { id: 'copy', repurposed_from_post_id: 'original' },
      { id: 'original', repurposed_from_post_id: null },
    ]
    await restoreBackup(client, { tables: { posts } })

    const [first, second] = client.calls
    expect(first.rows.every(r => r.repurposed_from_post_id === null)).toBe(true)
    expect(second.rows).toEqual([{ id: 'copy', repurposed_from_post_id: 'original' }])
  })

  it('writes large tables in chunks', async () => {
    const client = fakeClient()
    const ideas = Array.from({ length: 1200 }, (_, i) => ({ id: `i${i}` }))
    const { restored } = await restoreBackup(client, { tables: { ideas } })
    expect(client.calls.map(c => c.rows.length)).toEqual([500, 500, 200])
    expect(restored.ideas).toBe(1200)
  })

  it('keeps going after a table fails and reports it', async () => {
    const client = fakeClient({ failOn: ['campaigns'] })
    const progress = []
    const result = await restoreBackup(
      client,
      { tables: { posts: [{ id: 'p' }], campaigns: [{ id: 'c' }], ideas: [{ id: 'i' }] } },
      table => progress.push(table),
    )
    expect(result.restored).toEqual({ posts: 1, ideas: 1 })
    expect(result.errors).toEqual([{ table: 'campaigns', message: 'campaigns exploded' }])
    expect(progress).toEqual(['posts', 'campaigns', 'ideas'])
  })

  it('skips empty tables', async () => {
    const client = fakeClient()
    const result = await restoreBackup(client, { tables: { posts: [] } })
    expect(client.calls).toHaveLength(0)
    expect(result).toEqual({ restored: {}, errors: [] })
  })
})
