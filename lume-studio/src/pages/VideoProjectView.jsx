import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { STATUSES } from "../lib/constants";
import VideoUploader from "../components/ui/VideoUploader";
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
        checked
          ? "bg-stone-800 border-stone-800"
          : "border-stone-300 bg-white hover:border-stone-500"
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

export default function VideoProjectView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClip, setSelectedClip] = useState(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [filter, setFilter] = useState("all");
  const [showUploader, setShowUploader] = useState(false);
  const [deletingClip, setDeletingClip] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Multi-select
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Sort
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    recordOpen('video', projectId);
    fetchProject();
    fetchClips();
  }, [projectId]);

  async function fetchProject() {
    const { data } = await supabase
      .from("video_projects")
      .select("*")
      .eq("id", projectId)
      .single();
    if (data) setProject(data);
  }

  async function fetchClips() {
    const { data } = await supabase
      .from("video_clips")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (data) setClips(data);
    setLoading(false);
  }

  function openClip(clip) {
    setSelectedClip(clip);
    setNotes(clip.notes || "");
    setConfirmDelete(false);
    setRenaming(false);
  }

  function closeDetail() {
    setSelectedClip(null);
    setNotes("");
    setRenaming(false);
  }

  async function saveNotes() {
    if (!selectedClip) return;
    setSavingNotes(true);
    await supabase.from("video_clips").update({ notes }).eq("id", selectedClip.id);
    setClips((prev) =>
      prev.map((c) => (c.id === selectedClip.id ? { ...c, notes } : c))
    );
    setSavingNotes(false);
  }

  async function updateStatus(status) {
    await supabase.from("video_clips").update({ status }).eq("id", selectedClip.id);
    setClips((prev) =>
      prev.map((c) => (c.id === selectedClip.id ? { ...c, status } : c))
    );
    setSelectedClip((prev) => ({ ...prev, status }));
  }

  async function saveRename() {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === selectedClip.name) { setRenaming(false); return; }
    await supabase.from("video_clips").update({ name: trimmed }).eq("id", selectedClip.id);
    setClips((prev) =>
      prev.map((c) => (c.id === selectedClip.id ? { ...c, name: trimmed } : c))
    );
    setSelectedClip((prev) => ({ ...prev, name: trimmed }));
    setRenaming(false);
  }

  async function deleteClip() {
    if (!selectedClip) return;
    setDeletingClip(true);
    await supabase.storage.from("Videos").remove([selectedClip.file_path]);
    await supabase.from("video_clips").delete().eq("id", selectedClip.id);
    if (project?.cover_clip_id === selectedClip.id) {
      await supabase.from("video_projects").update({ cover_clip_id: null }).eq("id", projectId);
      setProject((prev) => ({ ...prev, cover_clip_id: null }));
    }
    setClips((prev) => prev.filter((c) => c.id !== selectedClip.id));
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(selectedClip.id); return s; });
    setSelectedClip(null);
    setNotes("");
    setConfirmDelete(false);
    setDeletingClip(false);
  }

  async function setCoverClip() {
    if (!selectedClip) return;
    await supabase.from("video_projects").update({ cover_clip_id: selectedClip.id }).eq("id", projectId);
    setProject((prev) => ({ ...prev, cover_clip_id: selectedClip.id }));
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filtered.map((c) => c.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
  }

  async function bulkUpdateStatus(status) {
    await supabase.from("video_clips").update({ status }).in("id", [...selectedIds]);
    setClips((prev) => prev.map((c) => selectedIds.has(c.id) ? { ...c, status } : c));
    if (selectedClip && selectedIds.has(selectedClip.id)) setSelectedClip((prev) => ({ ...prev, status }));
  }

  async function bulkDelete() {
    setBulkProcessing(true);
    const toDelete = clips.filter((c) => selectedIds.has(c.id));
    await Promise.all(
      toDelete.map((c) => supabase.storage.from("Videos").remove([c.file_path]))
    );
    await supabase.from("video_clips").delete().in("id", [...selectedIds]);
    // Clear cover if it was deleted
    if (project?.cover_clip_id && selectedIds.has(project.cover_clip_id)) {
      await supabase.from("video_projects").update({ cover_clip_id: null }).eq("id", projectId);
      setProject((prev) => ({ ...prev, cover_clip_id: null }));
    }
    if (selectedClip && selectedIds.has(selectedClip.id)) closeDetail();
    setClips((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
    setBulkProcessing(false);
  }

  const filtered = filter === "all" ? clips : clips.filter((c) => c.status === filter);
  const sorted = applySort(filtered, sort);
  const anySelected = selectedIds.size > 0;

  const currentIndex = selectedClip ? sorted.findIndex((c) => c.id === selectedClip.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < sorted.length - 1;

  useEffect(() => {
    function handleKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (showUploader) { setShowUploader(false); return; }
        if (selectedClip) { closeDetail(); return; }
      }
      if (!selectedClip) return;
      if (e.key === 'ArrowLeft' && hasPrev) { e.preventDefault(); openClip(sorted[currentIndex - 1]); }
      if (e.key === 'ArrowRight' && hasNext) { e.preventDefault(); openClip(sorted[currentIndex + 1]); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedClip, showUploader, hasPrev, hasNext, currentIndex, sorted]);

  return (
    <div className="flex flex-1 overflow-hidden h-full">

      {/* Main area */}
      <div className="flex-1 overflow-y-auto p-7">

        {/* Header */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <button
              onClick={() => navigate("/video")}
              className="text-xs text-stone-400 hover:text-stone-600 mb-2 flex items-center gap-1 transition-colors"
            >
              ← Video Projects
            </button>
            <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Project</p>
            <h1 className="font-serif text-3xl text-stone-800">{project?.name || "..."}</h1>
            <p className="text-xs text-stone-400 mt-1">
              {clips.length} clip{clips.length !== 1 ? "s" : ""}
              {project?.event_date &&
                ` · ${new Date(project.event_date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
              {project?.location && ` · ${project.location}`}
            </p>
          </div>
          <button
            onClick={() => setShowUploader(true)}
            className="bg-stone-800 text-white text-xs font-medium px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
          >
            + Add Clips
          </button>
        </div>

        {/* Filter pills + sort */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {["all", ...Object.keys(STATUSES)].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                filter === f
                  ? "bg-stone-800 border-stone-800 text-white"
                  : "border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-600"
              }`}
            >
              {f === "all" ? "All" : STATUSES[f].label}
              {f !== "all" && (
                <span className="ml-1 opacity-60">
                  {clips.filter((c) => c.status === f).length}
                </span>
              )}
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
            <option value="size_asc">Size ↑</option>
            <option value="size_desc">Size ↓</option>
          </select>
        </div>

        {/* Bulk action bar */}
        {anySelected && (
          <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-xs">
            <span className="text-stone-600 font-medium">{selectedIds.size} clip{selectedIds.size !== 1 ? "s" : ""} selected</span>
            <button onClick={deselectAll} className="text-stone-400 hover:text-stone-600 transition-colors">Deselect all</button>
            <div className="ml-auto flex items-center gap-2">
              {confirmBulkDelete ? (
                <>
                  <span className="text-stone-500">Delete {selectedIds.size} clip{selectedIds.size !== 1 ? "s" : ""}?</span>
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

        {/* Clips grid */}
        {loading ? (
          <p className="text-stone-400 text-sm">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-stone-400 text-sm">
              {clips.length === 0
                ? "No clips yet — add some to get started"
                : "No clips match this filter"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {sorted.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                selected={selectedClip?.id === clip.id}
                checked={selectedIds.has(clip.id)}
                anySelected={anySelected}
                onCheck={(e) => { e.stopPropagation(); toggleSelect(clip.id); }}
                onClick={() => openClip(clip)}
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
                <h2 className="text-base font-medium text-stone-800">Add Clips</h2>
                <button onClick={() => setShowUploader(false)} className="text-stone-400 hover:text-stone-600 text-sm">✕</button>
              </div>
              <VideoUploader
                projectId={projectId}
                onUploadComplete={() => { fetchClips(); setShowUploader(false); }}
              />
            </div>
          </div>
        )}

      </div>

      {/* Detail panel */}
      {selectedClip && (
        <div className="w-64 border-l border-stone-200 bg-stone-50 flex flex-col flex-shrink-0 overflow-y-auto">
          {/* Video preview */}
          <div className="aspect-[4/3] bg-stone-900 flex items-center justify-center relative flex-shrink-0 border-b border-stone-200">
            {selectedClip.file_path ? (
              <video
                key={selectedClip.id}
                src={supabase.storage.from("Videos").getPublicUrl(selectedClip.file_path).data.publicUrl}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-3xl text-stone-600">▷</span>
            )}
            <button
              onClick={closeDetail}
              className="absolute top-2 right-2 w-6 h-6 bg-black/40 hover:bg-black/60 text-white rounded flex items-center justify-center text-xs transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="p-4 flex flex-col gap-4">
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
                <button
                  onClick={() => { setRenaming(true); setRenameValue(selectedClip.name); }}
                  className="font-medium text-stone-700 text-sm truncate w-full text-left hover:text-stone-500 transition-colors group flex items-center gap-1"
                  title="Click to rename"
                >
                  <span className="truncate">{selectedClip.name}</span>
                  <span className="text-stone-300 group-hover:text-stone-400 text-xs flex-shrink-0 transition-colors">✎</span>
                </button>
                <p className="text-xs text-stone-400 mt-0.5">
                  {selectedClip.file_size
                    ? `${(selectedClip.file_size / 1024 / 1024).toFixed(1)} MB`
                    : "Size unknown"}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setRenaming(true); setRenameValue(selectedClip.name); }}
                className="w-full border border-stone-200 text-stone-500 text-xs font-medium py-1.5 rounded-md hover:bg-stone-100 transition-colors"
              >
                Rename
              </button>
              <button
                onClick={setCoverClip}
                disabled={project?.cover_clip_id === selectedClip.id}
                className="w-full border border-stone-200 text-stone-500 text-xs font-medium py-1.5 rounded-md hover:bg-stone-100 disabled:opacity-40 disabled:cursor-default transition-colors"
              >
                {project?.cover_clip_id === selectedClip.id ? "✓ Cover Clip" : "Set as Cover"}
              </button>
              {confirmDelete ? (
                <div className="flex gap-1.5">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 border border-stone-200 text-stone-400 text-xs py-1.5 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
                  <button onClick={deleteClip} disabled={deletingClip} className="flex-1 bg-red-500 text-white text-xs font-medium py-1.5 rounded-md hover:bg-red-600 disabled:opacity-40 transition-colors">
                    {deletingClip ? "Deleting..." : "Confirm"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full border border-red-200 text-red-400 text-xs font-medium py-1.5 rounded-md hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors"
                >
                  Delete Clip
                </button>
              )}
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Status</label>
              <select
                value={selectedClip.status}
                onChange={(e) => updateStatus(e.target.value)}
                className="w-full border border-stone-200 rounded-md px-3 py-2 text-xs text-stone-700 outline-none bg-white focus:border-stone-400 transition-colors"
              >
                {Object.entries(STATUSES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col flex-1">
              <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes — edit decisions, client feedback, reminders…"
                rows={5}
                className="w-full border border-stone-200 rounded-md px-3 py-2 text-xs text-stone-600 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors resize-none leading-relaxed"
              />
              <button
                onClick={saveNotes}
                disabled={savingNotes || notes === (selectedClip.notes || "")}
                className="mt-2 w-full bg-stone-800 text-white text-xs font-medium py-2 rounded-md hover:opacity-90 disabled:opacity-30 transition-opacity"
              >
                {savingNotes ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function ClipCard({ clip, selected, checked, anySelected, onCheck, onClick }) {
  const status = STATUSES[clip.status] || STATUSES.unedited;
  const publicUrl = clip.file_path
    ? supabase.storage.from("Videos").getPublicUrl(clip.file_path).data.publicUrl
    : null;

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
      <div className="aspect-[4/3] bg-stone-900 flex items-center justify-center relative">
        {publicUrl ? (
          <video src={publicUrl} className="w-full h-full object-cover" muted preload="metadata" />
        ) : (
          <span className="text-2xl text-stone-600">▷</span>
        )}
        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <span style={{ width: 0, height: 0, borderTop: "7px solid transparent", borderBottom: "7px solid transparent", borderLeft: "12px solid white", marginLeft: 2 }} />
          </div>
        </div>
        {/* Checkbox */}
        <div
          className={`absolute top-2 left-2 transition-opacity ${anySelected || checked ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          onClick={onCheck}
        >
          <Checkbox checked={checked} onChange={onCheck} />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: status.color }} />
      </div>
      <div className="px-2 py-1.5 bg-white">
        <p className="text-xs text-stone-600 truncate">{clip.name}</p>
      </div>
    </div>
  );
}
