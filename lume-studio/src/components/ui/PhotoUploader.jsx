import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "../../lib/supabase";

export default function PhotoUploader({ collectionId, onUploadComplete }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pdfConfirmFiles, setPdfConfirmFiles] = useState(null);

  async function doUpload(file) {
    const ext = file.name.split(".").pop();
    const path = `${collectionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const media_type = file.type.startsWith("video/") ? "video" : "photo";

    const { error: uploadError } = await supabase.storage.from("Photos").upload(path, file);
    if (uploadError) return "error";

    const { error: dbError } = await supabase.from("photos").insert({
      collection_id: collectionId,
      name: file.name,
      file_path: path,
      file_size: file.size,
      status: "unedited",
      media_type,
    });
    return dbError ? "error" : "done";
  }

  async function processUpload(acceptedFiles) {
    setBusy(true);

    const { data: existing } = await supabase
      .from("photos")
      .select("name")
      .eq("collection_id", collectionId)
      .in("name", acceptedFiles.map((f) => f.name));

    const existingNames = new Set((existing || []).map((p) => p.name));

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
  }

  const onDrop = useCallback(
    (acceptedFiles) => {
      const hasPdf = acceptedFiles.some((f) => f.name.toLowerCase().endsWith(".pdf"));
      if (hasPdf) {
        setPdfConfirmFiles(acceptedFiles);
      } else {
        processUpload(acceptedFiles);
      }
    },
    [collectionId, onUploadComplete]
  );

  function confirmPdfs() {
    const files = pdfConfirmFiles;
    setPdfConfirmFiles(null);
    processUpload(files);
  }

  function cancelPdfs() {
    const nonPdfs = (pdfConfirmFiles || []).filter(
      (f) => !f.name.toLowerCase().endsWith(".pdf")
    );
    setPdfConfirmFiles(null);
    if (nonPdfs.length > 0) processUpload(nonPdfs);
  }

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

  const dropDisabled = busy || !!pdfConfirmFiles || items.some((it) => it.status === "duplicate" || it.status === "uploading");

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".tiff", ".raw", ".cr2", ".nef", ".arw"],
      "video/*": [".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v"],
      "application/pdf": [".pdf"],
    },
    disabled: dropDisabled,
  });

  const pdfCount = (pdfConfirmFiles || []).filter((f) => f.name.toLowerCase().endsWith(".pdf")).length;

  return (
    <div className="p-6">
      {pdfConfirmFiles && (
        <div className="mb-4 border border-teal-200 bg-teal-50 rounded-xl px-4 py-3.5">
          <div className="flex items-start gap-2.5 mb-3">
            <span className="w-5 h-5 rounded-full bg-teal-400 flex items-center justify-center text-white text-[10px] flex-shrink-0 mt-0.5 font-bold">!</span>
            <div>
              <p className="text-sm font-medium text-stone-700 mb-1">
                {pdfCount === 1 ? "1 PDF included" : `${pdfCount} PDFs included`}
              </p>
              <p className="text-xs text-stone-500 leading-relaxed">
                PDFs can be stored and viewed, but they won't show a preview in the grid — you'll see a placeholder card instead. PDFs also can't be used as the collection cover image.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={cancelPdfs}
              className="flex-1 text-xs py-1.5 border border-stone-200 text-stone-500 rounded-lg hover:bg-stone-100 transition-colors"
            >
              {pdfCount < (pdfConfirmFiles?.length ?? 0) ? "Skip PDFs" : "Cancel"}
            </button>
            <button
              onClick={confirmPdfs}
              className="flex-1 text-xs py-1.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
            >
              Add anyway
            </button>
          </div>
        </div>
      )}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition ${
          dropDisabled ? "pointer-events-none opacity-50" : "cursor-pointer"
        } ${
          isDragActive
            ? "border-stone-500 bg-stone-50"
            : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-3xl mb-3 text-stone-300">↑</div>
        {isDragActive ? (
          <p className="text-sm text-stone-600">Drop photos here...</p>
        ) : (
          <>
            <p className="text-sm font-medium text-stone-600 mb-1">Drag & drop photos or videos here</p>
            <p className="text-xs text-stone-400">or click to browse · JPG, PNG, WEBP, RAW · MP4, MOV, WEBM · PDF</p>
          </>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {items.map((item, i) => (
            <div key={i}>
              {item.status === "duplicate" ? (
                <div className="border border-teal-200 bg-teal-50 rounded-lg px-3 py-2.5">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="w-4 h-4 rounded-full bg-teal-400 flex items-center justify-center text-white text-[10px] flex-shrink-0 mt-0.5">!</span>
                    <div className="min-w-0">
                      <p className="text-xs text-stone-700 font-medium truncate">{item.name}</p>
                      <p className="text-xs text-teal-600 mt-0.5">Already in this collection — add again?</p>
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
                      className="flex-1 text-xs py-1 bg-teal-500 text-white rounded hover:bg-teal-600 transition-colors"
                    >
                      Add anyway
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
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
                  {item.name.toLowerCase().endsWith('.pdf') && item.status === "done" && (
                    <div className="flex items-start gap-1.5 ml-7 text-xs text-stone-400">
                      <span className="flex-shrink-0 mt-px">ℹ</span>
                      <span>PDF display in collections can be a bit limited — previews won't show in the grid, but you can view the full file when you open it.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
