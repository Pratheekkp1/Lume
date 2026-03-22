import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { STATUSES } from "../lib/constants";
import PhotoUploader from "../components/ui/PhotoUploader";
import { recordOpen } from "../lib/recentOpens";

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

export default function CollectionView() {
  const { collectionId } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [filter, setFilter] = useState("all");
  const [showUploader, setShowUploader] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [coverError, setCoverError] = useState(false);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Sort
  const [sort, setSort] = useState('newest');

  // Categories
  const [allCategories, setAllCategories] = useState([]);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [linkedPosts, setLinkedPosts] = useState([]);

  useEffect(() => {
    recordOpen('collection', collectionId);
    fetchCollection();
    fetchPhotos();
    fetchAllCategories();
  }, [collectionId]);

  async function fetchCollection() {
    const { data } = await supabase.from("collections").select("*").eq("id", collectionId).single();
    if (data) setCollection(data);
  }

  async function fetchPhotos() {
    const { data } = await supabase
      .from("photos")
      .select("*, photo_categories(category:categories(id,name,color))")
      .eq("collection_id", collectionId)
      .order("created_at", { ascending: true });
    if (data) setPhotos(data);
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
    setSelectedPhoto(photo);
    setNotes(photo.notes || "");
    setConfirmDelete(false);
    setRenaming(false);
    setCoverError(false);
    fetchLinkedPosts(photo.id);
  }

  function closeDetail() {
    setSelectedPhoto(null);
    setNotes("");
    setRenaming(false);
    setLinkedPosts([]);
  }

  async function saveNotes() {
    if (!selectedPhoto) return;
    setSavingNotes(true);
    await supabase.from("photos").update({ notes }).eq("id", selectedPhoto.id);
    setPhotos((prev) => prev.map((p) => (p.id === selectedPhoto.id ? { ...p, notes } : p)));
    setSavingNotes(false);
  }

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
    setDeletingPhoto(true);
    await supabase.storage.from("Photos").remove([selectedPhoto.file_path]);
    await supabase.from("photos").delete().eq("id", selectedPhoto.id);
    if (collection?.cover_photo_id === selectedPhoto.id) {
      await supabase.from("collections").update({ cover_photo_id: null }).eq("id", collectionId);
      setCollection((prev) => ({ ...prev, cover_photo_id: null }));
    }
    setPhotos((prev) => prev.filter((p) => p.id !== selectedPhoto.id));
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(selectedPhoto.id); return s; });
    setSelectedPhoto(null);
    setNotes("");
    setConfirmDelete(false);
    setDeletingPhoto(false);
  }

  async function setCoverPhoto() {
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
    setConfirmBulkDelete(false);
  }

  async function bulkUpdateStatus(status) {
    await supabase.from("photos").update({ status }).in("id", [...selectedIds]);
    setPhotos((prev) => prev.map((p) => selectedIds.has(p.id) ? { ...p, status } : p));
    if (selectedPhoto && selectedIds.has(selectedPhoto.id)) setSelectedPhoto((prev) => ({ ...prev, status }));
  }

  async function bulkDelete() {
    setBulkProcessing(true);
    const toDelete = photos.filter((p) => selectedIds.has(p.id));
    await Promise.all(toDelete.map((p) => supabase.storage.from("Photos").remove([p.file_path])));
    await supabase.from("photos").delete().in("id", [...selectedIds]);
    if (collection?.cover_photo_id && selectedIds.has(collection.cover_photo_id)) {
      await supabase.from("collections").update({ cover_photo_id: null }).eq("id", collectionId);
      setCollection((prev) => ({ ...prev, cover_photo_id: null }));
    }
    if (selectedPhoto && selectedIds.has(selectedPhoto.id)) closeDetail();
    setPhotos((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
    setBulkProcessing(false);
  }

  const filtered = filter === "all" ? photos : photos.filter((p) => p.status === filter);
  const sorted = applySort(filtered, sort);
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
            onClick={() => navigate("/collections")}
            className="text-xs text-stone-400 hover:text-stone-600 mb-2 flex items-center gap-1 transition-colors"
          >
            ← All Collections
          </button>
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Collection</p>
          <h1 className="font-serif text-3xl text-stone-800">{collection?.name || "..."}</h1>
          <p className="text-xs text-stone-400 mt-1">
            {photos.length} photo{photos.length !== 1 ? "s" : ""}
            {collection?.event_date && ` · ${new Date(collection.event_date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
            {collection?.location && ` · ${collection.location}`}
          </p>
        </div>
        <button
          onClick={() => setShowUploader(true)}
          className="bg-stone-800 text-white text-xs font-medium px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          + Add Photos
        </button>
      </div>

      {/* Filter pills + sort */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {["all", ...Object.keys(STATUSES)].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              filter === f ? "bg-stone-800 border-stone-800 text-white" : "border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-600"
            }`}
          >
            {f === "all" ? "All" : STATUSES[f].label}
            {f !== "all" && <span className="ml-1 opacity-60">{photos.filter((p) => p.status === f).length}</span>}
          </button>
        ))}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="ml-auto text-xs border border-stone-200 rounded-md px-2 py-1.5 text-stone-500 bg-white outline-none focus:border-stone-400 transition-colors cursor-pointer"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name_az">Name A→Z</option>
          <option value="name_za">Name Z→A</option>
        </select>
      </div>

      {/* Bulk action bar */}
      {anySelected && (
        <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-xs">
          <span className="text-stone-600 font-medium">{selectedIds.size} photo{selectedIds.size !== 1 ? "s" : ""} selected</span>
          <button onClick={deselectAll} className="text-stone-400 hover:text-stone-600 transition-colors">Deselect all</button>
          <div className="ml-auto flex items-center gap-2">
            {confirmBulkDelete ? (
              <>
                <span className="text-stone-500">Delete {selectedIds.size} photo{selectedIds.size !== 1 ? "s" : ""}?</span>
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
            {photos.length === 0 ? "No photos yet — add some to get started" : "No photos match this filter"}
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
              anySelected={anySelected}
              onCheck={(e) => { e.stopPropagation(); toggleSelect(photo.id); }}
              onClick={() => openPhoto(photo)}
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
              <h2 className="text-base font-medium text-stone-800">Add Photos</h2>
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
              isPdf(selectedPhoto.file_path) ? (
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
                    <button onClick={saveRename} className="flex-1 text-xs bg-stone-800 text-white py-1 rounded hover:opacity-90 transition-opacity">Save</button>
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
                  onClick={() => {
                    if (isPdf(selectedPhoto.file_path)) { setCoverError(true); setTimeout(() => setCoverError(false), 3000); return; }
                    setCoverPhoto();
                  }}
                  className={`w-full border text-xs font-medium py-1.5 rounded-md transition-colors ${
                    collection?.cover_photo_id === selectedPhoto.id
                      ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
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
                    Delete Photo
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
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes — editing ideas, client feedback, reminders…"
                  rows={6}
                  className="w-full border border-stone-200 rounded-md px-3 py-2 text-xs text-stone-600 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors resize-none leading-relaxed"
                />
                <button
                  onClick={saveNotes}
                  disabled={savingNotes || notes === (selectedPhoto.notes || "")}
                  className="mt-2 w-full bg-stone-800 text-white text-xs font-medium py-2 rounded-md hover:opacity-90 disabled:opacity-30 transition-opacity"
                >
                  {savingNotes ? "Saving..." : "Save Notes"}
                </button>
              </div>

              {/* Categories */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs uppercase tracking-widest text-stone-400">Categories</label>
                  <button
                    onClick={() => setShowCategoryPanel(p => !p)}
                    className="text-[10px] text-stone-400 hover:text-amber-700 transition-colors"
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

    </div>
  );
}

function PhotoCard({ photo, selected, checked, anySelected, onCheck, onClick }) {
  const status = STATUSES[photo.status] || STATUSES.unedited;
  const cats = (photo.photo_categories || []).map(pc => pc.category).filter(Boolean);

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-lg overflow-hidden border transition-all duration-150 group relative ${
        selected
          ? "border-stone-600 shadow-md ring-1 ring-stone-400"
          : checked
          ? "border-stone-400 shadow-sm"
          : "border-stone-200 hover:border-stone-300 hover:shadow-sm"
      }`}
    >
      <div className="aspect-[4/3] bg-stone-100 flex items-center justify-center relative">
        {photo.file_path ? (
          isPdf(photo.file_path) ? (
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
          className={`absolute top-2 left-2 transition-opacity ${anySelected || checked ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          onClick={onCheck}
        >
          <Checkbox checked={checked} onChange={onCheck} />
        </div>
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
              <button onClick={() => onDelete(cat.id)} className="text-stone-200 hover:text-red-400 text-xs transition-colors hidden group-hover:block">✕</button>
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
              className="bg-stone-800 text-white text-xs px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity">
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
