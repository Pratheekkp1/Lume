import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "../../lib/supabase";

export default function VideoUploader({ projectId, onUploadComplete }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  async function doUpload(file) {
    const ext = file.name.split(".").pop();
    const path = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("Videos").upload(path, file);
    if (uploadError) return "error";

    const { error: dbError } = await supabase.from("video_clips").insert({
      project_id: projectId,
      name: file.name,
      file_path: path,
      file_size: file.size,
      status: "unedited",
    });
    return dbError ? "error" : "done";
  }

  const onDrop = useCallback(
    async (acceptedFiles) => {
      setBusy(true);

      const { data: existing } = await supabase
        .from("video_clips")
        .select("name")
        .eq("project_id", projectId)
        .in("name", acceptedFiles.map((f) => f.name));

      const existingNames = new Set((existing || []).map((c) => c.name));

      const newItems = acceptedFiles.map((f) => ({
        file: f,
        name: f.name,
        status: existingNames.has(f.name) ? "duplicate" : "uploading",
      }));
      setItems(newItems);

      await Promise.all(
        newItems.map(async (item, i) => {
          if (item.status !== "uploading") return;
          const result = await doUpload(item.file);
          setItems((prev) => prev.map((p, j) => (j === i ? { ...p, status: result } : p)));
        })
      );

      setBusy(false);

      if (!newItems.some((it) => it.status === "duplicate")) {
        onUploadComplete();
      }
    },
    [projectId, onUploadComplete]
  );

  async function resolveDuplicate(i, addAnyway) {
    if (addAnyway) {
      setItems((prev) => prev.map((p, j) => (j === i ? { ...p, status: "uploading" } : p)));
      const result = await doUpload(items[i].file);
      setItems((prev) => {
        const updated = prev.map((p, j) => (j === i ? { ...p, status: result } : p));
        if (!updated.some((it) => it.status === "duplicate")) onUploadComplete();
        return updated;
      });
    } else {
      setItems((prev) => {
        const updated = prev.map((p, j) => (j === i ? { ...p, status: "skipped" } : p));
        if (!updated.some((it) => it.status === "duplicate")) onUploadComplete();
        return updated;
      });
    }
  }

  const dropDisabled = busy || items.some((it) => it.status === "duplicate" || it.status === "uploading");

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".mov", ".avi", ".mkv", ".webm", ".mxf", ".r3d", ".braw"],
    },
    disabled: dropDisabled,
  });

  return (
    <div className="p-6">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
          dropDisabled ? "pointer-events-none opacity-50" : "cursor-pointer"
        } ${
          isDragActive
            ? "border-stone-500 bg-stone-50"
            : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-3xl mb-3 text-stone-300">▷</div>
        {isDragActive ? (
          <p className="text-sm text-stone-600">Drop clips here...</p>
        ) : (
          <>
            <p className="text-sm font-medium text-stone-600 mb-1">Drag & drop video clips here</p>
            <p className="text-xs text-stone-400">or click to browse · MP4, MOV, AVI, MKV, MXF, R3D, BRAW</p>
          </>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {items.map((item, i) => (
            <div key={i}>
              {item.status === "duplicate" ? (
                <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2.5">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-white text-[10px] flex-shrink-0 mt-0.5">!</span>
                    <div className="min-w-0">
                      <p className="text-xs text-stone-700 font-medium truncate">{item.name}</p>
                      <p className="text-xs text-amber-600 mt-0.5">Already in this project — add again?</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => resolveDuplicate(i, false)}
                      className="flex-1 text-xs py-1 border border-stone-200 text-stone-500 rounded hover:bg-stone-100 transition-colors"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => resolveDuplicate(i, true)}
                      className="flex-1 text-xs py-1 bg-stone-700 text-white rounded hover:bg-stone-800 transition-colors"
                    >
                      Add anyway
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-xs">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white flex-shrink-0 ${
                    item.status === "done" ? "bg-green-400"
                    : item.status === "error" ? "bg-red-400"
                    : item.status === "skipped" ? "bg-stone-300"
                    : "bg-stone-300 animate-pulse"
                  }`}>
                    {item.status === "done" ? "✓" : item.status === "error" ? "✕" : item.status === "skipped" ? "–" : "·"}
                  </span>
                  <span className="text-stone-500 truncate flex-1">{item.name}</span>
                  <span className={`flex-shrink-0 ${
                    item.status === "done" ? "text-green-500"
                    : item.status === "error" ? "text-red-400"
                    : item.status === "skipped" ? "text-stone-300"
                    : "text-stone-400"
                  }`}>
                    {item.status === "done" ? "Done"
                     : item.status === "error" ? "Failed"
                     : item.status === "skipped" ? "Skipped"
                     : "Uploading..."}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
