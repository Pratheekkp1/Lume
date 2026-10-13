// Full-account backup and restore for everything that isn't a media file.
//
// A backup keeps every column and every id, so relationships (posts ↔
// campaigns, categories, pillars, variants, metrics…) survive a round trip.
// Restoring upserts by primary key: running it twice is harmless, and it can
// move a workspace into a new account or a fresh Supabase project.
//
// Photos, tracks and anything pointing at them are left out: their rows only
// make sense next to the files in Storage, which a JSON file can't carry.

export const BACKUP_APP = 'lume-studio'
export const BACKUP_VERSION = 1

// Restore order matters: parents before children so foreign keys resolve.
// `conflict` is the column list the upsert matches on.
export const BACKUP_TABLES = [
  { table: 'events',          conflict: 'id' },
  { table: 'categories',      conflict: 'id' },
  { table: 'content_pillars', conflict: 'id' },
  { table: 'collections',     conflict: 'id' },
  { table: 'audio_projects',  conflict: 'id' },
  { table: 'posts',           conflict: 'id' },
  { table: 'post_categories', conflict: 'post_id,category_id' },
  { table: 'post_variants',   conflict: 'id' },
  { table: 'post_metrics',    conflict: 'id' },
  { table: 'post_templates',  conflict: 'id' },
  { table: 'campaigns',       conflict: 'id' },
  { table: 'campaign_posts',  conflict: 'campaign_id,post_id' },
  { table: 'brand_kit',       conflict: 'user_id,key' },
  { table: 'hashtag_groups',  conflict: 'id' },
  { table: 'posting_goals',   conflict: 'id' },
  { table: 'ideas',           conflict: 'id' },
  { table: 'inspiration',     conflict: 'id' },
]

const PAGE_SIZE = 1000   // PostgREST's default row cap per request
const WRITE_CHUNK = 500

/** Rewrites a backup row so it can be written into the signed-in account. */
export function prepareRow(table, row) {
  // user_id defaults to auth.uid(); never carry another account's id across.
  const { user_id: _userId, ...rest } = row
  if (table === 'collections') {
    // Cover photos aren't in the backup, so the reference would dangle.
    return { ...rest, cover_photo_id: null }
  }
  if (table === 'brand_kit') {
    // Matched on (user, key) instead of id so a restore merges into an
    // account that already has brand settings.
    const { id: _id, ...withoutId } = rest
    return withoutId
  }
  return rest
}

/**
 * Validates the text of a backup file. Returns the parsed backup and a
 * per-table row count, or throws an Error with a message for the user.
 */
export function parseBackup(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("This file isn't valid JSON.")
  }
  if (!data || typeof data !== 'object' || data.app !== BACKUP_APP || !data.tables) {
    throw new Error("This doesn't look like a Lume backup. Use a file from Settings › Backup & Export › Full backup.")
  }
  if (data.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of Lume.')
  }
  const known = new Set(BACKUP_TABLES.map(t => t.table))
  const counts = {}
  for (const [table, rows] of Object.entries(data.tables)) {
    if (!known.has(table)) continue
    if (!Array.isArray(rows)) throw new Error(`The "${table}" section of this backup is damaged.`)
    counts[table] = rows.length
  }
  return { backup: data, counts }
}

async function fetchAllRows(client, table) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client.from(table).select('*').range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Couldn't read ${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

export async function createBackup(client) {
  const results = await Promise.all(BACKUP_TABLES.map(({ table }) => fetchAllRows(client, table)))
  const tables = {}
  BACKUP_TABLES.forEach(({ table }, i) => { tables[table] = results[i] })
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    tables,
  }
}

async function upsertChunks(client, table, conflict, rows) {
  for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
    const { error } = await client.from(table).upsert(rows.slice(i, i + WRITE_CHUNK), { onConflict: conflict })
    if (error) throw new Error(error.message)
  }
}

/**
 * Writes a parsed backup into the signed-in account. Keeps going past a
 * failing table so one problem doesn't block the rest, and reports what
 * happened per table. `onProgress(table)` fires before each table.
 */
export async function restoreBackup(client, backup, onProgress = () => {}) {
  const restored = {}
  const errors = []

  for (const { table, conflict } of BACKUP_TABLES) {
    const rows = (backup.tables[table] || []).map(r => prepareRow(table, r))
    if (rows.length === 0) continue
    onProgress(table)
    try {
      if (table === 'posts') {
        // A post can point at the post it was repurposed from. Write every
        // post without that link first, then add the links back, so the
        // order of rows (and chunk boundaries) can't break the foreign key.
        await upsertChunks(client, table, conflict, rows.map(r => ({ ...r, repurposed_from_post_id: null })))
        const linked = rows.filter(r => r.repurposed_from_post_id)
        if (linked.length) await upsertChunks(client, table, conflict, linked)
      } else {
        await upsertChunks(client, table, conflict, rows)
      }
      restored[table] = rows.length
    } catch (err) {
      errors.push({ table, message: err.message })
    }
  }

  return { restored, errors }
}
