import { supabase, uniqueFileName, userStoragePath } from './supabase'

/**
 * Upload a photo/video file to an album (collection).
 * Returns the created photo record, or null on error.
 */
export async function uploadPhotoToAlbum(file, collectionId) {
  const path = await userStoragePath(collectionId, uniqueFileName(file))
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
  const path = await userStoragePath(projectId, uniqueFileName(file))

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
