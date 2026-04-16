import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { STATUSES, POST_TYPES, PLATFORMS } from "../lib/constants";
import PhotoUploader from "../components/ui/PhotoUploader";
import { recordOpen } from "../lib/recentOpens";
import useDebouncedSave from "../hooks/useDebouncedSave";
import { softDelete, softDeleteBulk, ENTITY_TYPES } from "../lib/trash";

function applySort(items, sort) {
  const arr = [...items];
  switch (sort) {
    case 'name_az': return arr.sort((a, b) => a.name.localeCompare(b.name));
    case 'name_za': return arr.sort((a, b) => b.name.localeCompare(a.name));
    case 'oldest': return arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    case 'size_asc': return arr.sort((a, b) => (a.file_size || 0) - (b.file_size || 0));
    case 'size_desc': return arr.sort((a, b) => (b.file_size || 0) - (a.file_size || 0));
    default: return arr;
  }
}

function Checkbox({ checked, onChange }) {
  return (
    <div
      onClick={onChange}
      className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${
        checked ? "bg-stone-800 border-stone-800" : "border-stone-300 bg-white hover:border-stone-500"
      }`}
    >
      {checked && (
        <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-none stroke-white stroke-[1.5]">
          <polyline points="1,4 3.5,6.5 9,1" />
        </svg>
      )}
    </div>
  );
}

function isPdf(filePath) {
  return filePath?.toLowerCase().endsWith('.pdf');
}

function isVideo(item) {
  return item?.media_type === 'video';
}

export default function AlbumView() {
  const { albumId: collectionId } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("all");
  const [showUploader, setShowUploader] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [coverError, setCoverError] = useState(false);

  // Multi-select
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Sort
  const [sort, setSort] = useState('newest');

  // Never-used filter
  const [showUnusedOnly, setShowUnusedOnly] = useState(false);
  const [usedPhotoIds, setUsedPhotoIds] = useState(new Set());

  // Favorites filter
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Creator features
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showAddToPost, setShowAddToPost] = useState(false);
  const [recentPostsList, setRecentPostsList] = useState([]);
  const [addedMessage, setAddedMessage] = useState('');

  // Categories
  const [allCategories, setAllCategories] = useState([]);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [linkedPosts, setLinkedPosts] = useState([]);

  useEffect(() => {
    recordOpen('album', collectionId);
    fetchCollection();
    fetchPhotos();
    fetchAllCategories();
  }, [collectionId]);

  async function fetchCollection() {
    const { data } = await supabase.from("collections").select("*").eq("id", collectionId).single();
    if (data) setCollection(data);
  }

  async function updateCollectionStatus(status) {
    await supabase.from("collections").update({ status }).eq("id", collectionId);
    setCollection(prev => ({ ...prev, status }));
  }

  async function fetchPhotos() {
    const { data } = await supabase
      .from("photos")
      .select("*, photo_categories(category:categories(id,name,color))")
      .eq("collection_id", collectionId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (data) {
      setPhotos(data);
      if (data.length > 0) {
        const { data: links } = await supabase
          .from("post_linked_photos")
          .select("photo_id")
          .in("photo_id", data.map(p => p.id));
        setUsedPhotoIds(new Set((links || []).map(l => l.photo_id)));
      }
    }
    setLoading(false);
  }

  async function fetchAllCategories() {
    const { data } = await supabase.from("categories").select("*").eq("type", "photo").order("name");
    setAllCategories(data || []);
  }

  async function toggleCategory(cat) {
    if (!selectedPhoto) return;
    const photoCats = selectedPhoto.photo_categories || [];
    const has = photoCats.some(pc => pc.category?.id === cat.id);
    if (has) {
      await supabase.from("photo_categories").delete().eq("photo_id", selectedPhoto.id).eq("category_id", cat.id);
      const updated = { ...selectedPhoto, photo_categories: photoCats.filter(pc => pc.category?.id !== cat.id) };
      setSelectedPhoto(updated);
      setPhotos(prev => prev.map(p => p.id === selectedPhoto.id ? updated : p));
    } else {
      await supabase.from("photo_categories").insert({ photo_id: selectedPhoto.id, category_id: cat.id });
      const updated = { ...selectedPhoto, photo_categories: [...photoCats, { category: cat }] };
      setSelectedPhoto(updated);
      setPhotos(prev => prev.map(p => p.id === selectedPhoto.id ? updated : p));
    }
  }

  async function createCategory(name, color) {
    const { data, error } = await supabase.from("categories").insert({ name, color, type: "photo" }).select().single();
    if (!error && data) {
      setAllCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      if (selectedPhoto) {
        await supabase.from("photo_categories").insert({ photo_id: selectedPhoto.id, category_id: data.id });
        const updated = { ...selectedPhoto, photo_categories: [...(selectedPhoto.photo_categories || []), { category: data }] };
        setSelectedPhoto(updated);
        setPhotos(prev => prev.map(p => p.id === selectedPhoto.id ? updated : p));
      }
    }
  }

  async function deleteCategory(catId) {
    await supabase.from("categories").delete().eq("id", catId);
    setAllCategories(prev => prev.filter(c => c.id !== catId));
    if (selectedPhoto) {
      const updated = { ...selectedPhoto, photo_categories: (selectedPhoto.photo_categories || []).filter(pc => pc.category?.id !== catId) };
      setSelectedPhoto(updated);
      setPhotos(prev => prev.map(p => p.id === selectedPhoto.id ? updated : p));
    }
  }

  async function fetchLinkedPosts(photoId) {
    const { data } = await supabase
      .from("post_linked_photos")
      .select("post:posts(id, title)")
      .eq("photo_id", photoId);
    setLinkedPosts((data || []).map(d => d.post).filter(Boolean));
  }

  function openPhoto(photo) {
    flushNotes();
    setSelectedPhoto(photo);
    setNotes(photo.notes || "");
    setConfirmDelete(false);
    setRenaming(false);
    setCoverError(false);
    fetchLinkedPosts(photo.id);
  }

  function closeDetail() {
    flushNotes();
    setSelectedPhoto(null);
    setNotes("");
    setRenaming(false);
    setLinkedPosts([]);
  }

  const notesSaveFn = useCallback(async (val) => {
    if (!selectedPhoto) return;
    await supabase.from("photos").update({ notes: val }).eq("id", selectedPhoto.id);
    setPhotos((prev) => prev.map((p) => (p.id === selectedPhoto.id ? { ...p, notes: val } : p)));
  }, [selectedPhoto?.id]);

  const { saved: notesSaved, triggerSave: triggerNotesSave, flush: flushNotes } = useDebouncedSave(notesSaveFn);

  async function saveRename() {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === selectedPhoto.name) { setRenaming(false); return; }
    await supabase.from("photos").update({ name: trimmed }).eq("id", selectedPhoto.id);
    setPhotos((prev) => prev.map((p) => (p.id === selectedPhoto.id ? { ...p, name: trimmed } : p)));
    setSelectedPhoto((prev) => ({ ...prev, name: trimmed }));
    setRenaming(false);
  }

  async function deletePhoto() {
    if (!selectedPhoto) return;
    const photo = selectedPhoto;
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(photo.id); return s; });
    setSelectedPhoto(null);
    setNotes("");
    setConfirmDelete(false);
    setDeletingPhoto(false);
    await softDelete(ENTITY_TYPES.PHOTO, photo.id, photo.name);
  }

  async function setCoverPhoto(photoId) {
    await supabase.from('collections').update({ cover_photo_id: photoId }).eq('id', collectionId);
    setCollection(prev => ({ ...prev, cover_photo_id: photoId }));
  }

  async function toggleCoverPhoto() {
    if (!selectedPhoto) return;
    const isCurrent = collection?.cover_photo_id === selectedPhoto.id;
    const newId = isCurrent ? null : selectedPhoto.id;
    await supabase.from("collections").update({ cover_photo_id: newId }).eq("id", collectionId);
    setCollection((prev) => ({ ...prev, cover_photo_id: newId }));
  }

  async function updateStatus(status) {
    await supabase.from("photos").update({ status }).eq("id", selectedPhoto.id);
    setPhotos((prev) => prev.map((p) => (p.id === selectedPhoto.id ? { ...p, status } : p)));
    setSelectedPhoto((prev) => ({ ...prev, status }));
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function deselectAll() {
    setSelectedIds(new Set());
    setSelectMode(false);
    setConfirmBulkDelete(false);
  }

  async function bulkUpdateStatus(status) {
    await supabase.from("photos").update({ status }).in("id", [...selectedIds]);
    setPhotos((prev) => prev.map((p) => selectedIds.has(p.id) ? { ...p, status } : p));
    if (selectedPhoto && selectedIds.has(selectedPhoto.id)) setSelectedPhoto((prev) => ({ ...prev, status }));
  }

  async function bulkToggleFavorite(value) {
    const ids = [...selectedIds];
    await supabase.from('photos').update({ is_favorite: value }).in('id', ids);
    setPhotos(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, is_favorite: value } : p));
    if (selectedPhoto && selectedIds.has(selectedPhoto.id)) setSelectedPhoto(prev => ({ ...prev, is_favorite: value }));
  }

  async function bulkDelete() {
    setBulkProcessing(true);
    const ids = [...selectedIds];
    if (selectedPhoto && selectedIds.has(selectedPhoto.id)) closeDetail();
    setPhotos((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
    setBulkProcessing(false);
    await softDeleteBulk(ENTITY_TYPES.PHOTO, ids, `${ids.length} photo${ids.length !== 1 ? 's' : ''}`);
  }

  const filtered = photos
    .filter(p => filter === "all" || p.status === filter)
    .filter(p => !showUnusedOnly || !usedPhotoIds.has(p.id))
    .filter(p => !showFavoritesOnly || p.is_favorite);
  const sorted = applySort(filtered, sort);
  const unusedCount = photos.filter(p => !usedPhotoIds.has(p.id)).length;
  const anySelected = selectedIds.size > 0;

  const currentIndex = selectedPhoto ? sorted.findIndex((p) => p.id === selectedPhoto.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < sorted.length - 1;

  function goPrev() { if (hasPrev) openPhoto(sorted[currentIndex - 1]); }
  function goNext() { if (hasNext) openPhoto(sorted[currentIndex + 1]); }

  useEffect(() => {
    function handleKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (showUploader) { setShowUploader(false); return; }
        if (selectedPhoto) { closeDetail(); return; }
      }
      if (!selectedPhoto) return;
      if (e.key === 'ArrowLeft' && hasPrev) { e.preventDefault(); goPrev(); }
      if (e.key === 'ArrowRight' && hasNext) { e.preventDefault(); goNext(); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedPhoto, showUploader, hasPrev, hasNext, currentIndex, sorted]);

  return (
    <div className="p-7">

      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <button
            onClick={() => navigate("/library")}
            className="text-xs text-stone-400 hover:text-stone-600 mb-2 flex items-center gap-1 transition-colors"
          >
            ← Library
          </button>
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Album</p>
          <h1 className="font-serif text-3xl text-stone-800">{collection?.name || "..."}</h1>
          <p className="text-xs text-stone-400 mt-1">
            {photos.filter(p => !isVideo(p)).length} photo{photos.filter(p => !isVideo(p)).length !== 1 ? "s" : ""}
            {photos.some(p => isVideo(p)) && ` · ${photos.filter(p => isVideo(p)).length} video${photos.filter(p => isVideo(p)).length !== 1 ? "s" : ""}`}
            {collection?.event_date && ` · ${new Date(collection.event_date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
            {collection?.location && ` · ${collection.location}`}
          </p>
          {collection && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(STATUSES).map(([key, s]) => (
                <button
                  key={key}
                  onClick={() => updateCollectionStatus(key)}
                  className="px-2.5 py-1 rounded-full text-xs border transition-colors"
                  style={collection.status === key
                    ? { backgroundColor: s.color, color: '#fff', borderColor: s.color }
                    : { borderColor: '#e7e5e4', color: '#78716c' }
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowUploader(true)}
          className="bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors"
        >
          + Add Media
        </button>
      </div>

      {/* Filter pills + sort */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {["all", ...Object.keys(STATUSES)].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filter === f ? "bg-stone-800 border-stone-800 text-white" : "border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-600"
            }`}
          >
            {f === "all" ? "All" : STATUSES[f].label}
            {f !== "all" && <span className="ml-1 opacity-60">{photos.filter((p) => p.status === f).length}</span>}
          </button>
        ))}
        {photos.some(p => p.is_favorite) && (
          <button
            onClick={() => setShowFavoritesOnly(p => !p)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showFavoritesOnly
                ? 'bg-amber-400 border-amber-400 text-white'
                : 'border-stone-200 text-stone-400 hover:border-stone-300'
            }`}
          >
            ★ Favorites ({photos.filter(p => p.is_favorite).length})
          </button>
        )}
        {unusedCount > 0 && (
          <button
            onClick={() => setShowUnusedOnly(p => !p)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showUnusedOnly
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'border-amber-200 text-amber-600 hover:border-amber-400'
            }`}
          >
            Unused ({unusedCount})
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setSelectMode(!selectMode); if (selectMode) deselectAll(); }}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              selectMode
                ? 'bg-teal-500 text-white border-teal-500'
                : 'border-stone-200 text-stone-500 hover:border-stone-300'
            }`}
          >
            {selectMode ? 'Done' : 'Select'}
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-xs border border-stone-200 rounded-md px-2 py-1.5 text-stone-500 bg-white outline-none focus:border-stone-400 transition-colors cursor-pointer"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name_az">Name A→Z</option>
            <option value="name_za">Name Z→A</option>
          </select>
        </div>
      </div>

      {/* Bulk action bar */}
      {anySelected && (
        <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-xs">
          <span className="text-stone-600 font-medium">{selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""} selected</span>
          <button onClick={deselectAll} className="text-stone-400 hover:text-stone-600 transition-colors">Deselect all</button>
          <div className="ml-auto flex items-center gap-2">
            {confirmBulkDelete ? (
              <>
                <span className="text-stone-500">Delete {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""}?</span>
                <button onClick={() => setConfirmBulkDelete(false)} className="text-stone-400 hover:text-stone-600 px-2 py-1 border border-stone-200 rounded transition-colors">Cancel</button>
                <button onClick={bulkDelete} disabled={bulkProcessing} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 disabled:opacity-40 transition-colors">
                  {bulkProcessing ? "Deleting…" : "Confirm Delete"}
                </button>
              </>
            ) : (
              <>
                <select
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) { bulkUpdateStatus(e.target.value); e.target.value = ''; } }}
                  className="text-xs border border-stone-200 text-stone-600 bg-white px-2 py-1 rounded outline-none cursor-pointer"
                >
                  <option value="" disabled>Set status…</option>
                  {Object.entries(STATUSES).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="border border-teal-200 text-teal-700 px-3 py-1 rounded hover:bg-teal-50 transition-colors"
                >
                  Create Post
                </button>
                <button
                  onClick={async () => {
                    const { data } = await supabase.from('posts').select('id, title, status').order('updated_at', { ascending: false }).limit(10);
                    setRecentPostsList(data || []);
                    setShowAddToPost(true);
                  }}
                  className="border border-stone-200 text-stone-600 px-3 py-1 rounded hover:bg-stone-50 transition-colors"
                >
                  Add to Post
                </button>
                <button
                  onClick={() => bulkToggleFavorite(true)}
                  className="border border-amber-200 text-amber-600 px-3 py-1 rounded hover:bg-amber-50 transition-colors"
                >
                  ★ Star
                </button>
                <button
                  onClick={() => bulkToggleFavorite(false)}
                  className="border border-stone-200 text-stone-500 px-3 py-1 rounded hover:bg-stone-50 transition-colors"
                >
                  ☆ Unstar
                </button>
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  className="border border-red-200 text-red-400 px-3 py-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Photos grid */}
      {loading ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-stone-400 text-sm">
            {photos.length === 0 ? "No media yet — add photos or videos to get started" : "No items match this filter"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {sorted.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              selected={selectedPhoto?.id === photo.id}
              checked={selectedIds.has(photo.id)}
              selectMode={selectMode}
              anySelected={anySelected}
              collection={collection}
              onSetCover={setCoverPhoto}
              onCheck={(e) => { e.stopPropagation(); toggleSelect(photo.id); }}
              onClick={() => selectMode ? toggleSelect(photo.id) : openPhoto(photo)}
            />
          ))}
        </div>
      )}

      {/* Upload modal */}
      {showUploader && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={(e) => e.target === e.currentTarget && setShowUploader(false)}
        >
          <div className="bg-white rounded-xl w-[480px] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-0">
              <h2 className="text-base font-medium text-stone-800">Add Media</h2>
              <button onClick={() => setShowUploader(false)} className="text-stone-400 hover:text-stone-600 text-sm">✕</button>
            </div>
            <PhotoUploader
              collectionId={collectionId}
              onUploadComplete={() => { fetchPhotos(); setShowUploader(false); }}
            />
          </div>
        </div>
      )}

      {/* Fullscreen lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex"
          style={{ animation: "lb-in 0.18s ease-out" }}
        >
          <style>{`
            @keyframes lb-in { from { opacity: 0 } to { opacity: 1 } }
            @keyframes lb-panel { from { opacity: 0; transform: translateX(12px) } to { opacity: 1; transform: translateX(0) } }
            @keyframes lb-img { from { opacity: 0; transform: scale(0.97) } to { opacity: 1; transform: scale(1) } }
          `}</style>

          {/* Image / PDF area */}
          <div className="flex-1 bg-stone-900/25 backdrop-blur-md flex items-center justify-center relative overflow-hidden">

            {/* Close */}
            <button
              onClick={closeDetail}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center text-sm transition-colors"
            >
              ✕
            </button>

            {/* Counter */}
            <div className="absolute top-4 left-4 z-10 text-xs text-white/50 tabular-nums">
              {currentIndex + 1} / {sorted.length}
            </div>

            {/* Prev */}
            <button
              onClick={goPrev}
              disabled={!hasPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center disabled:opacity-20 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2L4 6l4 4" />
              </svg>
            </button>

            {/* Next */}
            <button
              onClick={goNext}
              disabled={!hasNext}
              className="absolute right-[calc(320px+16px)] top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center disabled:opacity-20 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 2l4 4-4 4" />
              </svg>
            </button>

            {/* Content */}
            {selectedPhoto.file_path ? (
              isVideo(selectedPhoto) ? (
                <video
                  key={selectedPhoto.id}
                  src={supabase.storage.from("Photos").getPublicUrl(selectedPhoto.file_path).data.publicUrl}
                  controls
                  className="max-w-full max-h-full"
                  style={{ maxHeight: '100vh', animation: "lb-img 0.22s ease-out" }}
                />
              ) : isPdf(selectedPhoto.file_path) ? (
                <iframe
                  key={selectedPhoto.id}
                  src={supabase.storage.from("Photos").getPublicUrl(selectedPhoto.file_path).data.publicUrl}
                  className="w-full h-full"
                  title={selectedPhoto.name}
                />
              ) : (
                <img
                  key={selectedPhoto.id}
                  src={supabase.storage.from("Photos").getPublicUrl(selectedPhoto.file_path).data.publicUrl}
                  alt={selectedPhoto.name}
                  className="max-w-full max-h-full object-contain"
                  style={{ maxHeight: '100vh', animation: "lb-img 0.22s ease-out" }}
                />
              )
            ) : (
              <span className="text-4xl text-white/20">◻</span>
            )}

            {/* File name bar at bottom */}
            <div className="absolute bottom-0 left-0 right-0 px-5 py-3 bg-gradient-to-t from-black/60 to-transparent">
              <p className="text-sm text-white/80 truncate">{selectedPhoto.name}</p>
            </div>
          </div>

          {/* Detail panel */}
          <div className="w-80 bg-white flex flex-col flex-shrink-0 overflow-y-auto border-l border-stone-200" style={{ animation: "lb-panel 0.22s ease-out" }}>

            <div className="p-5 border-b border-stone-100 flex-shrink-0">
              {/* Name / rename */}
              {renaming ? (
                <div className="flex flex-col gap-1.5">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") setRenaming(false);
                    }}
                    className="w-full border border-stone-300 rounded px-2 py-1 text-sm text-stone-700 outline-none focus:border-stone-500 transition-colors"
                  />
                  <div className="flex gap-1.5">
                    <button onClick={() => setRenaming(false)} className="flex-1 text-xs border border-stone-200 text-stone-400 py-1 rounded hover:bg-stone-50 transition-colors">Cancel</button>
                    <button onClick={saveRename} className="flex-1 text-xs bg-teal-500 text-white py-1 rounded hover:bg-teal-600 transition-colors">Save</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-stone-800 text-sm truncate">{selectedPhoto.name}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {selectedPhoto.file_size ? `${(selectedPhoto.file_size / 1024 / 1024).toFixed(1)} MB · ` : ""}
                    {selectedPhoto.taken_at ? new Date(selectedPhoto.taken_at).toLocaleDateString() : "Date unknown"}
                  </p>
                </div>
              )}
            </div>

            <div className="p-5 flex flex-col gap-3">

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setRenaming(true); setRenameValue(selectedPhoto.name); }}
                  className="w-full border border-stone-200 text-stone-500 text-xs font-medium py-1.5 rounded-md hover:bg-stone-100 transition-colors"
                >
                  Rename
                </button>
                <button
                  onClick={async () => {
                    const newVal = !selectedPhoto.is_favorite;
                    await supabase.from('photos').update({ is_favorite: newVal }).eq('id', selectedPhoto.id);
                    setPhotos(prev => prev.map(p => p.id === selectedPhoto.id ? { ...p, is_favorite: newVal } : p));
                    setSelectedPhoto(prev => ({ ...prev, is_favorite: newVal }));
                  }}
                  className={`w-full border text-xs font-medium py-1.5 rounded-md transition-colors ${
                    selectedPhoto.is_favorite
                      ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : 'border-stone-200 text-stone-500 hover:bg-stone-100'
                  }`}
                >
                  {selectedPhoto.is_favorite ? '★ Favorited' : '☆ Add to Favorites'}
                </button>
                {!isVideo(selectedPhoto) && (
                  <>
                    <button
                      onClick={() => {
                        if (isPdf(selectedPhoto.file_path)) { setCoverError(true); setTimeout(() => setCoverError(false), 3000); return; }
                        toggleCoverPhoto();
                      }}
                      className={`w-full border text-xs font-medium py-1.5 rounded-md transition-colors ${
                        collection?.cover_photo_id === selectedPhoto.id
                          ? "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100"
                          : "border-stone-200 text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      {collection?.cover_photo_id === selectedPhoto.id ? "✓ Cover Photo" : "Set as Cover"}
                    </button>
                    {coverError && (
                      <div className="flex items-start gap-1.5 text-xs text-red-500">
                        <span className="flex-shrink-0 mt-px">✕</span>
                        <span>PDFs can't be used as collection covers — use an image instead.</span>
                      </div>
                    )}
                  </>
                )}
                {confirmDelete ? (
                  <div className="flex gap-1.5">
                    <button onClick={() => setConfirmDelete(false)} className="flex-1 border border-stone-200 text-stone-400 text-xs py-1.5 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
                    <button onClick={deletePhoto} disabled={deletingPhoto} className="flex-1 bg-red-500 text-white text-xs font-medium py-1.5 rounded-md hover:bg-red-600 disabled:opacity-40 transition-colors">
                      {deletingPhoto ? "Deleting..." : "Confirm"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full border border-red-200 text-red-400 text-xs font-medium py-1.5 rounded-md hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors"
                  >
                    Delete {isVideo(selectedPhoto) ? "Video" : "Photo"}
                  </button>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Status</label>
                <select
                  value={selectedPhoto.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  className="w-full border border-stone-200 rounded-md px-3 py-2 text-xs text-stone-700 outline-none bg-white focus:border-stone-400 transition-colors"
                >
                  {Object.entries(STATUSES).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="flex flex-col">
                <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); triggerNotesSave(e.target.value); }}
                  placeholder="Add notes — editing ideas, client feedback, reminders…"
                  rows={6}
                  className="w-full border border-stone-200 rounded-md px-3 py-2 text-xs text-stone-600 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors resize-none leading-relaxed"
                />
                <p className={`mt-1.5 text-[10px] text-green-600 text-center transition-opacity duration-300 ${notesSaved ? 'opacity-100' : 'opacity-0'}`}>Saved</p>
              </div>

              {/* Categories */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs uppercase tracking-widest text-stone-400">Categories</label>
                  <button
                    onClick={() => setShowCategoryPanel(p => !p)}
                    className="text-[10px] text-stone-400 hover:text-teal-700 transition-colors"
                  >
                    Manage
                  </button>
                </div>
                {allCategories.length === 0 ? (
                  <p className="text-xs text-stone-300 italic">No categories yet</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {allCategories.map(cat => {
                      const active = (selectedPhoto.photo_categories || []).some(pc => pc.category?.id === cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => toggleCategory(cat)}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${active ? "bg-stone-100" : "hover:bg-stone-50"}`}
                        >
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="flex-1 text-left text-stone-600">{cat.name}</span>
                          {active && <span className="text-stone-400">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Used in Posts */}
              {linkedPosts.length > 0 && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Used in Posts</label>
                  <div className="flex flex-col gap-1">
                    {linkedPosts.map(post => (
                      <button
                        key={post.id}
                        onClick={() => navigate(`/posts/${post.id}`)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-stone-600 hover:bg-stone-50 transition-colors text-left"
                      >
                        <span className="w-4 text-center text-stone-300">▷</span>
                        <span className="truncate">{post.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Category manage panel */}
      {showCategoryPanel && (
        <CategoryPanel
          categories={allCategories}
          onClose={() => setShowCategoryPanel(false)}
          onCreate={createCategory}
          onDelete={deleteCategory}
        />
      )}

      {/* Create Post from selection */}
      {showCreatePost && (
        <CreatePostModal
          photoIds={Array.from(selectedIds)}
          onClose={() => setShowCreatePost(false)}
          onCreated={(postId) => {
            setShowCreatePost(false);
            setSelectedIds(new Set());
            window.dispatchEvent(new CustomEvent('lume-posts-updated'));
            navigate(`/posts/${postId}`);
          }}
        />
      )}

      {/* Add to existing post */}
      {showAddToPost && (
        <AddToPostModal
          posts={recentPostsList}
          photoIds={Array.from(selectedIds)}
          onClose={() => { setShowAddToPost(false); setAddedMessage(''); }}
          onAdded={(msg) => {
            setAddedMessage(msg);
            setSelectedIds(new Set());
            setTimeout(() => { setShowAddToPost(false); setAddedMessage(''); }, 1500);
          }}
        />
      )}

      {/* Added confirmation toast */}
      {addedMessage && !showAddToPost && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg z-50">
          {addedMessage}
        </div>
      )}

    </div>
  );
}

function CreatePostModal({ photoIds, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [platform, setPlatform] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('posts')
      .insert({ title: title.trim(), type: type || null, platform: platform || null, status: 'idea' })
      .select('id')
      .single();
    if (!error && data) {
      await supabase.from('post_linked_photos').insert(photoIds.map(id => ({ post_id: data.id, photo_id: id })));
      onCreated(data.id);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-serif text-xl text-stone-800 mb-1">Create Post</h2>
        <p className="text-xs text-stone-400 mb-5">{photoIds.length} photo{photoIds.length !== 1 ? 's' : ''} will be linked</p>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Beach sunset reel"
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {POST_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setType(type === t ? '' : t)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${type === t ? 'bg-teal-500 text-white border-teal-500' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Platform</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(p => (
                <button key={p} type="button" onClick={() => setPlatform(platform === p ? '' : p)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${platform === p ? 'bg-teal-500 text-white border-teal-500' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
            <button type="submit" disabled={!title.trim() || saving} className="flex-1 bg-teal-500 text-white text-sm py-2 rounded-md hover:bg-teal-600 disabled:opacity-40 transition-colors">
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddToPostModal({ posts, photoIds, onClose, onAdded }) {
  const [linking, setLinking] = useState(false);

  async function linkToPost(post) {
    setLinking(true);
    await supabase.from('post_linked_photos').insert(photoIds.map(id => ({ post_id: post.id, photo_id: id })));
    onAdded(`${photoIds.length} photo${photoIds.length !== 1 ? 's' : ''} added to "${post.title}"`);
    setLinking(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 max-h-[60vh] flex flex-col">
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="font-serif text-xl text-stone-800">Add to Post</h2>
            <p className="text-xs text-stone-400 mt-0.5">{photoIds.length} photo{photoIds.length !== 1 ? 's' : ''} selected</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-sm transition-colors">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {posts.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-6">No posts yet. Create one first.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {posts.map(post => (
                <button
                  key={post.id}
                  onClick={() => !linking && linkToPost(post)}
                  disabled={linking}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-left hover:bg-stone-50 transition-colors disabled:opacity-40"
                >
                  <span className="w-6 h-6 rounded bg-stone-100 flex items-center justify-center text-xs text-stone-400 flex-shrink-0">▷</span>
                  <span className="flex-1 text-sm text-stone-700 truncate">{post.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PhotoCard({ photo, selected, checked, selectMode, anySelected, collection, onSetCover, onCheck, onClick }) {
  const status = STATUSES[photo.status] || STATUSES.unedited;
  const cats = (photo.photo_categories || []).map(pc => pc.category).filter(Boolean);
  const isCover = collection?.cover_photo_id === photo.id;

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-lg overflow-hidden border transition duration-150 group relative ${
        selected
          ? "border-stone-600 shadow-md ring-1 ring-stone-400"
          : checked
          ? "border-stone-400 shadow-sm"
          : "border-stone-200 hover:border-stone-300 hover:shadow-sm"
      }`}
    >
      <div className="aspect-[4/3] bg-stone-100 flex items-center justify-center relative">
        {photo.file_path ? (
          isVideo(photo) ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-stone-800 gap-1.5">
              <span className="text-3xl text-white/40">▶</span>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Video</span>
            </div>
          ) : isPdf(photo.file_path) ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-stone-50 gap-1.5 px-3 text-center">
              <span className="text-3xl font-bold text-stone-300 tracking-wider">PDF</span>
              <span className="text-[10px] text-stone-400 leading-snug">Can't preview in card view — click to open</span>
            </div>
          ) : (
            <img
              src={supabase.storage.from("Photos").getPublicUrl(photo.file_path).data.publicUrl}
              alt={photo.name}
              className="w-full h-full object-cover"
            />
          )
        ) : (
          <span className="text-2xl text-stone-200">◻</span>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        <div
          className={`absolute top-2 left-2 transition-opacity ${selectMode || anySelected || checked ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          onClick={onCheck}
        >
          <Checkbox checked={checked} onChange={onCheck} />
        </div>
        {!isVideo(photo) && !isCover && (
          <button
            onClick={e => { e.stopPropagation(); onSetCover(photo.id); }}
            className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded transition-opacity"
          >
            Set cover
          </button>
        )}
        {isCover && (
          <div className="absolute bottom-1 left-1 text-[10px] bg-teal-500 text-white px-1.5 py-0.5 rounded">
            Cover
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: status.color }} />
      </div>
      <div className="px-2 py-1.5 bg-white">
        <p className="text-xs text-stone-600 truncate">{photo.name}</p>
        {cats.length > 0 && (
          <div className="flex gap-1 mt-1">
            {cats.slice(0, 6).map(cat => (
              <span key={cat.id} className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const PRESET_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#78716c'];

function CategoryPanel({ categories, onClose, onCreate, onDelete }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim(), color);
    setName('');
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-xl text-stone-800">Photo Categories</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-sm transition-colors">✕</button>
        </div>
        <div className="flex flex-col gap-1 mb-5 max-h-48 overflow-y-auto">
          {categories.length === 0 ? (
            <p className="text-xs text-stone-300 italic text-center py-3">No categories yet</p>
          ) : categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-stone-50 group">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="flex-1 text-sm text-stone-600">{cat.name}</span>
              {deleteTarget === cat.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { onDelete(cat.id); setDeleteTarget(null); }}
                    className="text-[10px] text-red-500 hover:text-red-600 font-medium transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setDeleteTarget(cat.id)} className="text-stone-200 hover:text-red-400 text-xs transition-colors hidden group-hover:block">✕</button>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={handleCreate} className="border-t border-stone-100 pt-4">
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-3">New Category</p>
          <div className="flex gap-2 mb-3">
            {PRESET_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className="w-5 h-5 rounded-full flex-shrink-0 transition-transform hover:scale-110"
                style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
            ))}
          </div>
          <div className="flex gap-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Category name"
              className="flex-1 border border-stone-200 rounded-md px-3 py-1.5 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors" />
            <button type="submit" disabled={!name.trim() || saving}
              className="bg-teal-500 text-white text-xs px-3 py-1.5 rounded-md hover:bg-teal-600 disabled:opacity-40 transition-colors">
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
