import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { STATUSES, SOUND_STATUSES } from "../lib/constants";
import AudioUploader from "../components/ui/AudioUploader";
import { recordOpen } from "../lib/recentOpens";
import useDebouncedSave from "../hooks/useDebouncedSave";
import { softDelete, softDeleteBulk, ENTITY_TYPES } from "../lib/trash";

function fmtTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function SoundView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [playingTrack, setPlayingTrack] = useState(null);
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("all");
  const [showUploader, setShowUploader] = useState(false);
  const [deletingTrack, setDeletingTrack] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Multi-select
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Categories
  const [categories, setCategories] = useState([]);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [deleteCatTarget, setDeleteCatTarget] = useState(null);
  const [linkedPosts, setLinkedPosts] = useState([]);

  // Playback
  const audioRef = useRef(null);
  const tracksRef = useRef([]);
  const selectedTrackRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  useEffect(() => {
    recordOpen('sound', projectId);
    fetchProject();
    fetchTracks();
    fetchCategories();
  }, [projectId]);

  // Wire audio events once
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      const all = tracksRef.current;
      const cur = selectedTrackRef.current;
      const idx = all.findIndex((t) => t.id === cur?.id);
      if (idx !== -1 && idx < all.length - 1) switchTrack(all[idx + 1]);
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // Load + autoplay when playing track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingTrack?.file_path) {
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    const url = supabase.storage.from("Audio").getPublicUrl(playingTrack.file_path).data.publicUrl;
    audio.src = url;
    audio.load();
    setCurrentTime(0);
    setDuration(0);
    audio.play().catch(() => {});
  }, [playingTrack?.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    if (!showSpeedMenu) return;
    function close() { setShowSpeedMenu(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showSpeedMenu]);

  // Spacebar toggle
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === " " && playingTrack?.file_path) {
        e.preventDefault();
        togglePlay();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playingTrack]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.paused ? audio.play().catch(() => {}) : audio.pause();
  }

  function seek(e) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  }

  function goPrev() {
    const all = tracksRef.current;
    const idx = all.findIndex((t) => t.id === selectedTrackRef.current?.id);
    if (idx > 0) switchTrack(all[idx - 1]);
  }

  function goNext() {
    const all = tracksRef.current;
    const idx = all.findIndex((t) => t.id === selectedTrackRef.current?.id);
    if (idx !== -1 && idx < all.length - 1) switchTrack(all[idx + 1]);
  }

  async function fetchProject() {
    const { data } = await supabase.from("audio_projects").select("*").eq("id", projectId).single();
    if (data) setProject(data);
  }

  async function fetchTracks() {
    const { data } = await supabase
      .from("audio_tracks")
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (data) setTracks(data);
    setLoading(false);
  }

  async function updateProjectStatus(status) {
    await supabase.from("audio_projects").update({ status }).eq("id", projectId);
    setProject(prev => ({ ...prev, status }));
  }

  async function fetchCategories() {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("type", "audio_track")
      .order("created_at", { ascending: true });
    setCategories(data || []);
  }

  async function createCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const { error } = await supabase.from("categories").insert({ name, color: "#a8a29e", type: "audio_track" });
    setNewCatName("");
    setShowNewCat(false);
    fetchCategories();
  }

  async function deleteCategory(catId) {
    await supabase.from("categories").delete().eq("id", catId);
    // Clear this category from all tracks in local state
    setTracks((prev) => prev.map((t) => t.category_id === catId ? { ...t, category_id: null } : t));
    if (selectedTrack?.category_id === catId) setSelectedTrack((p) => ({ ...p, category_id: null }));
    if (filter === catId) setFilter("all");
    fetchCategories();
  }

  async function assignCategory(catId) {
    if (!selectedTrack) return;
    const newVal = selectedTrack.category_id === catId ? null : catId;
    await supabase.from("audio_tracks").update({ category_id: newVal }).eq("id", selectedTrack.id);
    setTracks((prev) => prev.map((t) => t.id === selectedTrack.id ? { ...t, category_id: newVal } : t));
    setSelectedTrack((prev) => ({ ...prev, category_id: newVal }));
    if (playingTrack?.id === selectedTrack.id) setPlayingTrack((p) => ({ ...p, category_id: newVal }));
  }

  async function fetchLinkedPosts(trackId) {
    const { data } = await supabase
      .from("post_linked_tracks")
      .select("post:posts(id, title)")
      .eq("track_id", trackId);
    setLinkedPosts((data || []).map(d => d.post).filter(Boolean));
  }

  function loadTrack(track) {
    flushNotes();
    selectedTrackRef.current = track;
    setPlayingTrack(track);
    setSelectedTrack(track);
    setNotes(track.notes || "");
    setConfirmDelete(false);
    fetchLinkedPosts(track.id);
  }

  function switchTrack(track) {
    flushNotes();
    selectedTrackRef.current = track;
    setPlayingTrack(track);
    setSelectedTrack((prev) => {
      if (!prev) return null;
      setNotes(track.notes || "");
      setConfirmDelete(false);
      fetchLinkedPosts(track.id);
      return track;
    });
  }

  function closeDetail() {
    flushNotes();
    setSelectedTrack(null);
    setNotes("");
    setLinkedPosts([]);
  }

  async function toggleFavorite(track, e) {
    e?.stopPropagation();
    const newVal = !track.is_favorite;
    await supabase.from("audio_tracks").update({ is_favorite: newVal }).eq("id", track.id);
    setTracks((prev) => prev.map((t) => t.id === track.id ? { ...t, is_favorite: newVal } : t));
    if (selectedTrack?.id === track.id) setSelectedTrack((prev) => ({ ...prev, is_favorite: newVal }));
    if (playingTrack?.id === track.id) setPlayingTrack((prev) => ({ ...prev, is_favorite: newVal }));
  }

  const notesSaveFn = useCallback(async (val) => {
    if (!selectedTrack) return;
    await supabase.from("audio_tracks").update({ notes: val }).eq("id", selectedTrack.id);
    setTracks((prev) => prev.map((t) => t.id === selectedTrack.id ? { ...t, notes: val } : t));
  }, [selectedTrack?.id]);

  const { saved: notesSaved, triggerSave: triggerNotesSave, flush: flushNotes } = useDebouncedSave(notesSaveFn);

  async function updateStatus(status) {
    await supabase.from("audio_tracks").update({ status }).eq("id", selectedTrack.id);
    setTracks((prev) => prev.map((t) => t.id === selectedTrack.id ? { ...t, status } : t));
    setSelectedTrack((prev) => ({ ...prev, status }));
  }

  async function deleteTrack() {
    if (!selectedTrack) return;
    const track = selectedTrack;
    setTracks((prev) => prev.filter((t) => t.id !== track.id));
    if (playingTrack?.id === track.id) {
      audioRef.current?.pause();
      selectedTrackRef.current = null;
      setPlayingTrack(null);
    }
    setSelectedTrack(null);
    setNotes("");
    setConfirmDelete(false);
    setDeletingTrack(false);
    await softDelete(ENTITY_TYPES.AUDIO_TRACK, track.id, track.name);
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
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
    const ids = [...selectedIds];
    await supabase.from("audio_tracks").update({ status }).in("id", ids);
    setTracks(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, status } : t));
    if (selectedTrack && selectedIds.has(selectedTrack.id)) setSelectedTrack(prev => ({ ...prev, status }));
  }

  async function bulkAssignCategory(catId) {
    const ids = [...selectedIds];
    await supabase.from("audio_tracks").update({ category_id: catId }).in("id", ids);
    setTracks(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, category_id: catId } : t));
    if (selectedTrack && selectedIds.has(selectedTrack.id)) setSelectedTrack(prev => ({ ...prev, category_id: catId }));
    if (playingTrack && selectedIds.has(playingTrack.id)) setPlayingTrack(prev => ({ ...prev, category_id: catId }));
  }

  async function bulkDeleteTracks() {
    setBulkProcessing(true);
    const ids = [...selectedIds];
    if (playingTrack && selectedIds.has(playingTrack.id)) {
      audioRef.current?.pause();
      selectedTrackRef.current = null;
      setPlayingTrack(null);
    }
    if (selectedTrack && selectedIds.has(selectedTrack.id)) {
      setSelectedTrack(null);
      setNotes("");
    }
    setTracks(prev => prev.filter(t => !selectedIds.has(t.id)));
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
    setBulkProcessing(false);
    await softDeleteBulk(ENTITY_TYPES.AUDIO_TRACK, ids, `${ids.length} track${ids.length !== 1 ? 's' : ''}`);
  }

  const anySelected = selectedIds.size > 0;

  const filtered =
    filter === "all" ? tracks
    : filter === "favorites" ? tracks.filter((t) => t.is_favorite)
    : tracks.filter((t) => t.category_id === filter);
  tracksRef.current = filtered;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const curIdx = playingTrack ? filtered.findIndex((t) => t.id === playingTrack.id) : -1;
  const hasPrev = curIdx > 0;
  const hasNext = curIdx !== -1 && curIdx < filtered.length - 1;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <audio ref={audioRef} preload="metadata" />

      <div className="flex flex-1 overflow-hidden">

        {/* Track list */}
        <div className="flex-1 overflow-y-auto p-7">

          {/* Header */}
          <div className="flex items-end justify-between mb-5">
            <div>
              <button
                onClick={() => navigate("/library")}
                className="text-xs text-stone-400 hover:text-stone-600 mb-2 flex items-center gap-1 transition-colors"
              >
                ← Library
              </button>
              <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Sound Project</p>
              <h1 className="font-serif text-3xl text-stone-800">{project?.name || "..."}</h1>
              <p className="text-xs text-stone-400 mt-1">
                {tracks.length} track{tracks.length !== 1 ? "s" : ""}
                {project?.event_date && ` · ${new Date(project.event_date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
                {project?.location && ` · ${project.location}`}
              </p>
              {project && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(SOUND_STATUSES).map(([key, s]) => (
                    <button
                      key={key}
                      onClick={() => updateProjectStatus(key)}
                      className="px-2.5 py-1 rounded-full text-xs border transition-colors"
                      style={project.status === key
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
            <div className="flex items-center gap-2">
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
              <button
                onClick={() => setShowUploader(true)}
                className="bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors"
              >
                + Add Tracks
              </button>
            </div>
          </div>

          {/* Filter / category pills */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {/* Built-in: All */}
            <button
              onClick={() => setFilter("all")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                filter === "all"
                  ? "bg-stone-800 border-stone-800 text-white"
                  : "border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-600"
              }`}
            >
              All
            </button>

            {/* Built-in: Favorites — cannot be deleted */}
            <button
              onClick={() => setFilter("favorites")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                filter === "favorites"
                  ? "bg-teal-500 border-teal-500 text-white"
                  : "border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-600"
              }`}
            >
              ★ Favorites
            </button>

            {/* User-created categories */}
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-0.5">
                <button
                  onClick={() => setFilter(cat.id)}
                  className={`text-xs px-3 py-1.5 rounded-l-full border-y border-l transition-all ${
                    filter === cat.id
                      ? "bg-stone-800 border-stone-800 text-white"
                      : "border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-600"
                  }`}
                >
                  {cat.name}
                  <span className="ml-1 opacity-50">{tracks.filter((t) => t.category_id === cat.id).length}</span>
                </button>
                {deleteCatTarget === cat.id ? (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => { deleteCategory(cat.id); setDeleteCatTarget(null); }}
                      className="text-[10px] px-2 py-1.5 rounded-full border border-red-200 text-red-500 hover:bg-red-50 font-medium transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteCatTarget(null)}
                      className="text-[10px] px-2 py-1.5 rounded-full border border-stone-200 text-stone-400 hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteCatTarget(cat.id)}
                    className={`text-xs px-1.5 py-1.5 rounded-r-full border-y border-r transition-all ${
                      filter === cat.id
                        ? "bg-stone-800 border-stone-800 text-white hover:bg-stone-700"
                        : "border-stone-200 text-stone-300 hover:text-red-400 hover:border-stone-300"
                    }`}
                    title="Delete category"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            {/* New category inline input */}
            {showNewCat ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createCategory();
                    if (e.key === "Escape") { setShowNewCat(false); setNewCatName(""); }
                  }}
                  placeholder="Name…"
                  className="text-xs border border-stone-300 rounded-full px-3 py-1.5 w-28 outline-none focus:border-stone-500 transition-colors"
                />
                <button
                  onClick={createCategory}
                  className="text-xs text-stone-400 hover:text-stone-700 px-1 transition-colors"
                >
                  ✓
                </button>
                <button
                  onClick={() => { setShowNewCat(false); setNewCatName(""); }}
                  className="text-xs text-stone-300 hover:text-stone-500 px-1 transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewCat(true)}
                className="text-xs text-stone-400 hover:text-stone-600 border border-dashed border-stone-300 hover:border-stone-400 px-3 py-1.5 rounded-full transition-all"
              >
                + New
              </button>
            )}
          </div>

          {/* Bulk action bar */}
          {anySelected && (
            <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-xs">
              <span className="text-stone-600 font-medium">{selectedIds.size} track{selectedIds.size !== 1 ? 's' : ''} selected</span>
              <button onClick={deselectAll} className="text-stone-400 hover:text-stone-600 transition-colors">Deselect all</button>
              <div className="ml-auto flex items-center gap-2">
                {confirmBulkDelete ? (
                  <>
                    <span className="text-stone-500">Delete {selectedIds.size} track{selectedIds.size !== 1 ? 's' : ''}?</span>
                    <button onClick={() => setConfirmBulkDelete(false)} className="text-stone-400 hover:text-stone-600 px-2 py-1 border border-stone-200 rounded transition-colors">Cancel</button>
                    <button onClick={bulkDeleteTracks} disabled={bulkProcessing} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 disabled:opacity-40 transition-colors">
                      {bulkProcessing ? 'Deleting…' : 'Confirm Delete'}
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
                    {categories.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) => { if (e.target.value) { bulkAssignCategory(e.target.value); e.target.value = ''; } }}
                        className="text-xs border border-stone-200 text-stone-600 bg-white px-2 py-1 rounded outline-none cursor-pointer"
                      >
                        <option value="" disabled>Set category…</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    )}
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

          {/* Tracks */}
          {loading ? (
            <p className="text-stone-400 text-sm">Loading...</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-stone-400 text-sm">
                {tracks.length === 0 ? "No tracks yet — add some to get started" : "No tracks match this filter"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map((track, i) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={i + 1}
                  selected={selectedTrack?.id === track.id}
                  isPlaying={isPlaying && playingTrack?.id === track.id}
                  onClick={() => selectMode ? toggleSelect(track.id) : loadTrack(track)}
                  onFavorite={(e) => toggleFavorite(track, e)}
                  selectMode={selectMode}
                  checked={selectedIds.has(track.id)}
                  anySelected={anySelected}
                  onCheck={(e) => { e.stopPropagation(); toggleSelect(track.id); }}
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
                  <h2 className="text-base font-medium text-stone-800">Add Tracks</h2>
                  <button onClick={() => setShowUploader(false)} className="text-stone-400 hover:text-stone-600 text-sm">✕</button>
                </div>
                <AudioUploader
                  projectId={projectId}
                  onUploadComplete={() => { fetchTracks(); setShowUploader(false); }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedTrack && (
          <div className="w-64 border-l border-stone-200 bg-stone-50 flex flex-col flex-shrink-0 overflow-y-auto">
            <div className="p-4 flex flex-col gap-4">

              {/* Track header */}
              <div className="flex items-start gap-2 pt-1">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-stone-700 truncate">{selectedTrack.name}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {selectedTrack.file_size ? `${(selectedTrack.file_size / 1024 / 1024).toFixed(1)} MB` : "Size unknown"}
                  </p>
                </div>
                <button
                  onClick={closeDetail}
                  className="w-5 h-5 text-stone-300 hover:text-stone-500 flex items-center justify-center text-xs flex-shrink-0 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Delete */}
              <div className="flex flex-col gap-2">
                {confirmDelete ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 border border-stone-200 text-stone-400 text-xs py-1.5 rounded-md hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={deleteTrack}
                      disabled={deletingTrack}
                      className="flex-1 bg-red-500 text-white text-xs font-medium py-1.5 rounded-md hover:bg-red-600 disabled:opacity-40 transition-colors"
                    >
                      {deletingTrack ? "Deleting..." : "Confirm"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full border border-red-200 text-red-400 text-xs font-medium py-1.5 rounded-md hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors"
                  >
                    Delete Track
                  </button>
                )}
              </div>

              {/* Category */}
              {categories.length > 0 && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-400 mb-2 block">Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat) => {
                      const active = selectedTrack.category_id === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => assignCategory(cat.id)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                            active
                              ? "bg-stone-800 border-stone-800 text-white"
                              : "border-stone-200 text-stone-400 hover:border-stone-400 hover:text-stone-600"
                          }`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Status</label>
                <select
                  value={selectedTrack.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  className="w-full border border-stone-200 rounded-md px-3 py-2 text-xs text-stone-700 outline-none bg-white focus:border-stone-400 transition-colors"
                >
                  {Object.entries(STATUSES).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="flex flex-col flex-1">
                <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); triggerNotesSave(e.target.value); }}
                  placeholder="Add notes — mix feedback, edit points, reminders…"
                  rows={5}
                  className="w-full border border-stone-200 rounded-md px-3 py-2 text-xs text-stone-600 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors resize-none leading-relaxed"
                />
                <p className={`mt-1.5 text-[10px] text-green-600 text-center transition-opacity duration-300 ${notesSaved ? 'opacity-100' : 'opacity-0'}`}>Saved</p>
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
        )}
      </div>

      {/* Bottom playback bar */}
      {playingTrack && (
        <div className="flex-shrink-0 border-t border-stone-200 bg-white px-6 pt-3 pb-4">
          <div className="flex items-center mb-3">

            {/* Left: track name + prev/next */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="min-w-0">
                <p className="text-xs font-medium text-stone-700 truncate">{playingTrack.name}</p>
                <p className="text-[10px] text-stone-400 truncate">{project?.name}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={goPrev}
                  disabled={!hasPrev}
                  className="text-stone-400 hover:text-stone-800 disabled:opacity-25 transition-colors p-1"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="8.5,2 3.5,6.5 8.5,11" />
                  </svg>
                </button>
                <button
                  onClick={goNext}
                  disabled={!hasNext}
                  className="text-stone-400 hover:text-stone-800 disabled:opacity-25 transition-colors p-1"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4.5,2 9.5,6.5 4.5,11" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Center: play/pause */}
            <div className="flex-shrink-0">
              <button
                onClick={togglePlay}
                disabled={!playingTrack.file_path}
                className="w-9 h-9 rounded-full bg-stone-900 text-white flex items-center justify-center hover:bg-stone-700 disabled:opacity-40 transition-colors"
              >
                {isPlaying ? (
                  <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor">
                    <rect x="0.5" y="0.5" width="2.5" height="9" rx="1" />
                    <rect x="6" y="0.5" width="2.5" height="9" rx="1" />
                  </svg>
                ) : (
                  <svg width="9" height="11" viewBox="0 0 9 11" fill="currentColor" style={{ marginLeft: 1 }}>
                    <path d="M1 1L8 5.5L1 10V1z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Right: speed + time */}
            <div className="flex items-center gap-3 flex-1 justify-end">
              <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setShowSpeedMenu((p) => !p)}
                  className="text-xs text-stone-400 hover:text-stone-700 border border-stone-200 rounded px-2 py-1 transition-colors min-w-[40px] text-center"
                >
                  {speed}×
                </button>
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 6px)",
                    right: 0,
                    opacity: showSpeedMenu ? 1 : 0,
                    transform: showSpeedMenu ? "translateY(0) scale(1)" : "translateY(4px) scale(0.97)",
                    pointerEvents: showSpeedMenu ? "auto" : "none",
                    transition: "opacity 140ms ease, transform 140ms ease",
                    transformOrigin: "bottom right",
                    background: "white",
                    border: "1px solid #e7e5e4",
                    borderRadius: 10,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    overflow: "hidden",
                    minWidth: 64,
                    zIndex: 20,
                  }}
                >
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSpeed(s); setShowSpeedMenu(false); }}
                      className={`block w-full px-4 py-1.5 text-xs text-left transition-colors ${
                        speed === s ? "bg-stone-100 text-stone-900 font-medium" : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-stone-400 tabular-nums flex-shrink-0 w-20 text-right">
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-stone-200 rounded-full cursor-pointer group" onClick={seek}>
            <div
              className="h-full bg-stone-900 rounded-full relative transition-none"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-stone-900 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackRow({ track, index, selected, isPlaying, onClick, onFavorite, selectMode, checked, anySelected, onCheck }) {
  const status = STATUSES[track.status] || STATUSES.unedited;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all group ${
        checked
          ? "bg-teal-50 border border-teal-300"
          : selected
          ? "bg-stone-100 border border-stone-300"
          : "border border-transparent hover:bg-stone-50 hover:border-stone-200"
      }`}
    >
      {(selectMode || anySelected) ? (
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          onClick={e => e.stopPropagation()}
          className="accent-teal-500 flex-shrink-0"
        />
      ) : (
        <span className="text-xs text-stone-300 w-5 text-right flex-shrink-0 font-mono">
          {isPlaying ? <span className="text-teal-500">▶</span> : index}
        </span>
      )}
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: status.color }} />
      <p className="text-sm text-stone-700 truncate flex-1">{track.name}</p>
      {track.file_size && (
        <span className="text-xs text-stone-300 flex-shrink-0">
          {(track.file_size / 1024 / 1024).toFixed(1)}MB
        </span>
      )}
      <button
        onClick={onFavorite}
        className="flex-shrink-0 ml-1 flex items-end justify-center opacity-40 hover:opacity-100 transition-opacity"
        style={{ width: 14, height: 20 }}
        title={track.is_favorite ? "Remove from favorites" : "Add to favorites"}
      >
        <svg width="11" height="16" viewBox="0 0 11 16" fill="none">
          <path
            d="M1 1h9v14l-4.5-3.5L1 15V1z"
            fill={track.is_favorite ? "#14b8a6" : "none"}
            stroke={track.is_favorite ? "#14b8a6" : "#a8a29e"}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
