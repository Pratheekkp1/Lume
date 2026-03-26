import { supabase } from './supabase'

export const ENTITY_TYPES = {
  POST: { table: 'posts', label: 'Post', event: 'lume-posts-updated' },
  COLLECTION: { table: 'collections', label: 'Album', event: 'lume-media-updated' },
  AUDIO_PROJECT: { table: 'audio_projects', label: 'Sound Project', event: 'lume-sounds-updated' },
  PHOTO: { table: 'photos', label: 'Photo', event: 'lume-media-updated' },
  AUDIO_TRACK: { table: 'audio_tracks', label: 'Track', event: 'lume-sounds-updated' },
}

export async function softDelete(entityType, id, displayName) {
  const now = new Date().toISOString()
  const { error } = await supabase.from(entityType.table).update({ deleted_at: now }).eq('id', id)
  if (error) return false

  // If deleting a collection, also soft-delete its photos
  if (entityType === ENTITY_TYPES.COLLECTION) {
    await supabase.from('photos').update({ deleted_at: now }).eq('collection_id', id).is('deleted_at', null)
  }
  // If deleting an audio project, also soft-delete its tracks
  if (entityType === ENTITY_TYPES.AUDIO_PROJECT) {
    await supabase.from('audio_tracks').update({ deleted_at: now }).eq('project_id', id).is('deleted_at', null)
  }

  window.dispatchEvent(new CustomEvent(entityType.event))
  window.dispatchEvent(new CustomEvent('lume-toast', {
    detail: {
      message: `"${displayName}" moved to trash`,
      undoFn: async () => {
        await restoreItem(entityType, id, now)
        window.dispatchEvent(new CustomEvent(entityType.event))
      },
    },
  }))
  return true
}

export async function softDeleteBulk(entityType, ids, displayName) {
  const now = new Date().toISOString()
  const { error } = await supabase.from(entityType.table).update({ deleted_at: now }).in('id', ids)
  if (error) return false

  window.dispatchEvent(new CustomEvent(entityType.event))
  window.dispatchEvent(new CustomEvent('lume-toast', {
    detail: {
      message: `${displayName} moved to trash`,
      undoFn: async () => {
        await supabase.from(entityType.table).update({ deleted_at: null }).in('id', ids)
        window.dispatchEvent(new CustomEvent(entityType.event))
      },
    },
  }))
  return true
}

export async function restoreItem(entityType, id, deletedAt) {
  await supabase.from(entityType.table).update({ deleted_at: null }).eq('id', id)

  // Restore children that were deleted at the same time
  if (entityType === ENTITY_TYPES.COLLECTION && deletedAt) {
    await supabase.from('photos').update({ deleted_at: null }).eq('collection_id', id).eq('deleted_at', deletedAt)
  }
  if (entityType === ENTITY_TYPES.AUDIO_PROJECT && deletedAt) {
    await supabase.from('audio_tracks').update({ deleted_at: null }).eq('project_id', id).eq('deleted_at', deletedAt)
  }
}

export async function permanentDelete(entityType, id) {
  if (entityType === ENTITY_TYPES.POST) {
    // Clean up junction tables
    await supabase.from('post_categories').delete().eq('post_id', id)
    await supabase.from('post_linked_photos').delete().eq('post_id', id)
    await supabase.from('post_linked_tracks').delete().eq('post_id', id)
    // Clean up post assets (with storage)
    const { data: assets } = await supabase.from('post_assets').select('id, file_path').eq('post_id', id)
    if (assets?.length > 0) {
      await supabase.storage.from('Photos').remove(assets.map(a => a.file_path))
      await supabase.from('post_assets').delete().eq('post_id', id)
    }
    await supabase.from('posts').delete().eq('id', id)
  } else if (entityType === ENTITY_TYPES.COLLECTION) {
    // Delete child photos first
    const { data: photos } = await supabase.from('photos').select('id, file_path').eq('collection_id', id)
    if (photos?.length > 0) {
      await supabase.storage.from('Photos').remove(photos.map(p => p.file_path))
      const photoIds = photos.map(p => p.id)
      await supabase.from('photo_categories').delete().in('photo_id', photoIds)
      await supabase.from('post_linked_photos').delete().in('photo_id', photoIds)
      await supabase.from('photos').delete().eq('collection_id', id)
    }
    await supabase.from('collections').delete().eq('id', id)
  } else if (entityType === ENTITY_TYPES.AUDIO_PROJECT) {
    const { data: tracks } = await supabase.from('audio_tracks').select('id, file_path').eq('project_id', id)
    if (tracks?.length > 0) {
      await supabase.storage.from('Audio').remove(tracks.map(t => t.file_path))
      const trackIds = tracks.map(t => t.id)
      await supabase.from('audio_categories').delete().in('track_id', trackIds)
      await supabase.from('post_linked_tracks').delete().in('track_id', trackIds)
      await supabase.from('audio_tracks').delete().eq('project_id', id)
    }
    await supabase.from('audio_projects').delete().eq('id', id)
  } else if (entityType === ENTITY_TYPES.PHOTO) {
    const { data: photo } = await supabase.from('photos').select('file_path, collection_id').eq('id', id).single()
    if (photo) {
      await supabase.storage.from('Photos').remove([photo.file_path])
      await supabase.from('photo_categories').delete().eq('photo_id', id)
      await supabase.from('post_linked_photos').delete().eq('photo_id', id)
      // Clear cover photo if needed
      await supabase.from('collections').update({ cover_photo_id: null }).eq('cover_photo_id', id)
    }
    await supabase.from('photos').delete().eq('id', id)
  } else if (entityType === ENTITY_TYPES.AUDIO_TRACK) {
    const { data: track } = await supabase.from('audio_tracks').select('file_path').eq('id', id).single()
    if (track) {
      await supabase.storage.from('Audio').remove([track.file_path])
      await supabase.from('audio_categories').delete().eq('track_id', id)
      await supabase.from('post_linked_tracks').delete().eq('track_id', id)
    }
    await supabase.from('audio_tracks').delete().eq('id', id)
  }
}

export async function fetchTrashed() {
  const [posts, collections, projects, photos, tracks] = await Promise.all([
    supabase.from('posts').select('id, title, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('collections').select('id, name, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('audio_projects').select('id, name, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('photos').select('id, name, deleted_at, collection_id').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('audio_tracks').select('id, name, deleted_at, project_id').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
  ])
  return {
    posts: posts.data || [],
    collections: collections.data || [],
    audioProjects: projects.data || [],
    photos: photos.data || [],
    audioTracks: tracks.data || [],
  }
}

export async function purgeExpired() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const tables = [
    { type: ENTITY_TYPES.POST, table: 'posts', nameField: 'id' },
    { type: ENTITY_TYPES.COLLECTION, table: 'collections', nameField: 'id' },
    { type: ENTITY_TYPES.AUDIO_PROJECT, table: 'audio_projects', nameField: 'id' },
    { type: ENTITY_TYPES.PHOTO, table: 'photos', nameField: 'id' },
    { type: ENTITY_TYPES.AUDIO_TRACK, table: 'audio_tracks', nameField: 'id' },
  ]
  for (const { type, table } of tables) {
    const { data } = await supabase.from(table).select('id').not('deleted_at', 'is', null).lt('deleted_at', cutoff)
    if (data?.length > 0) {
      for (const item of data) {
        await permanentDelete(type, item.id)
      }
    }
  }
}
