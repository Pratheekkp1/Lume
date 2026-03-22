import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function fmt(secs) {
  if (!isFinite(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const AudioPlayer = forwardRef(function AudioPlayer({ src, autoPlay = false }, ref) {
  const audioRef = useRef(null);
  const speedBtnRef = useRef(null);
  const shouldAutoPlay = useRef(autoPlay);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showSpeeds, setShowSpeeds] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  // Reset when src changes
  useEffect(() => {
    shouldAutoPlay.current = autoPlay;
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setSpeed(1);
    setShowSpeeds(false);
  }, [src]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  }

  useImperativeHandle(ref, () => ({ toggle }));

  function onTimeUpdate() {
    setCurrent(audioRef.current?.currentTime || 0);
  }

  function onLoadedMetadata() {
    setDuration(audioRef.current?.duration || 0);
    if (shouldAutoPlay.current) {
      shouldAutoPlay.current = false;
      audioRef.current?.play().then(() => setPlaying(true)).catch(() => {});
    }
  }

  function onEnded() {
    setPlaying(false);
    setCurrent(0);
  }

  function seek(e) {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    a.currentTime = ratio * duration;
  }

  function openSpeeds() {
    const btn = speedBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    // Menu width ~56px; position above the button, right-aligned
    setMenuPos({ top: rect.top, right: window.innerWidth - rect.right });
    setShowSpeeds(true);
  }

  function setPlaybackSpeed(s) {
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
    setShowSpeeds(false);
  }

  const progress = duration ? (current / duration) * 100 : 0;

  return (
    <div className="bg-stone-200/60 rounded-lg px-3 py-2.5 flex flex-col gap-2">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        preload="metadata"
      />

      {/* Progress bar */}
      <div
        className="w-full h-1 bg-stone-300 rounded-full cursor-pointer relative"
        onClick={seek}
      >
        <div
          className="h-full bg-stone-600 rounded-full transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2">
        {/* Play/pause */}
        <button
          onClick={toggle}
          className="w-6 h-6 rounded-full bg-stone-700 text-white flex items-center justify-center flex-shrink-0 hover:bg-stone-800 transition-colors"
        >
          {playing ? (
            <span className="flex gap-0.5">
              <span className="w-0.5 h-2.5 bg-white rounded-sm" />
              <span className="w-0.5 h-2.5 bg-white rounded-sm" />
            </span>
          ) : (
            <span
              className="ml-0.5"
              style={{
                width: 0, height: 0,
                borderTop: "4px solid transparent",
                borderBottom: "4px solid transparent",
                borderLeft: "7px solid white",
              }}
            />
          )}
        </button>

        {/* Time */}
        <span className="text-xs text-stone-500 tabular-nums flex-1">
          {fmt(current)} / {fmt(duration)}
        </span>

        {/* Speed picker — portal-rendered so no overflow clipping */}
        <button
          ref={speedBtnRef}
          onClick={openSpeeds}
          className="text-xs text-stone-500 hover:text-stone-700 transition-colors px-1 py-0.5 rounded hover:bg-stone-300/60"
        >
          {speed === 1 ? "1×" : `${speed}×`}
        </button>
      </div>

      {showSpeeds && createPortal(
        <>
          <style>{`@keyframes speed-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setShowSpeeds(false)}
          />
          <div
            className="fixed z-[9999] bg-white border border-stone-100 rounded-lg shadow-md py-1 overflow-hidden"
            style={{
              bottom: window.innerHeight - menuPos.top + 6,
              right: menuPos.right,
              width: 52,
              animation: "speed-in 0.12s ease-out",
            }}
          >
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                className={`w-full text-center py-1 text-xs transition-colors ${
                  speed === s
                    ? "text-stone-800 font-semibold bg-stone-50"
                    : "text-stone-400 hover:text-stone-700 hover:bg-stone-50"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
});

export default AudioPlayer;

