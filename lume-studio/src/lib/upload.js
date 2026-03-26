import { supabase } from './supabase'

/**
 * Upload a photo/video file to an album (collection).
 * Returns the created photo record, or null on error.
 */
export async function uploadPhotoToAlbum(file, collectionId) {
  const ext = file.name.split('.').pop()
  const path = `${collectionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const media_type = file.type.startsWith('video/') ? 'video' : 'photo'

  const { error: uploadError } = await supabase.storage.from('Photos').upload(path, file)
  if (uploadError) return null

  const { data, error: dbError } = await supabase.from('photos').insert({
    collection_id: collectionId,
    name: file.name,
    file_path: path,
    file_size: file.size,
    status: 'unedited',
    media_type,
  }).select().single()

  return dbError ? null : data
}

/**
 * Upload an audio file to a sound project.
 * Returns the created track record, or null on error.
 */
export async function uploadTrackToProject(file, projectId) {
  const ext = file.name.split('.').pop()
  const path = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage.from('Audio').upload(path, file)
  if (uploadError) return null

  const { data, error: dbError } = await supabase.from('audio_tracks').insert({
    project_id: projectId,
    name: file.name,
    file_path: path,
    file_size: file.size,
    status: 'unedited',
  }).select().single()

  return dbError ? null : data
}
