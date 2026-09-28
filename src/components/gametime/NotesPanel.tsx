"use client";

import { useState, useEffect, useCallback } from "react";
import { useMatchStore } from "@/stores/matchStore";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import {
  MessageSquare,
  Mic,
  MicOff,
  ChevronDown,
  ChevronUp,
  FileText,
  Save,
} from "lucide-react";

/** Collapsible panel for point-level note + voice dictation */
function PointNoteInput() {
  const pendingNote = useMatchStore((s) => s.pendingPointNote);
  const setPointNote = useMatchStore((s) => s.setPointNote);
  const { transcript, isListening, isSupported, toggle, reset } =
    useSpeechToText();

  // Append dictated text into the note field
  useEffect(() => {
    if (transcript) {
      setPointNote(pendingNote ? `${pendingNote} ${transcript}` : transcript);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <MessageSquare size={12} />
        <span>Point Note</span>
      </div>
      <div className="relative">
        <input
          type="text"
          value={pendingNote}
          onChange={(e) => setPointNote(e.target.value)}
          placeholder="Quick note about this point…"
          className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
        />
        {isSupported && (
          <button
            onClick={() => {
              if (!isListening) reset();
              toggle();
            }}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all ${
              isListening
                ? "text-red-400 bg-red-500/10 animate-pulse"
                : "text-slate-500 hover:text-blue-400 hover:bg-blue-500/10"
            }`}
            title={isListening ? "Stop dictation" : "Start voice dictation"}
          >
            {isListening ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
        )}
      </div>
      {isListening && (
        <p className="text-[10px] text-red-400 flex items-center gap-1 animate-pulse">
          <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
          Listening…
        </p>
      )}
    </div>
  );
}

/** Expandable panel for game-level and match-level notes */
export function NotesPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"game" | "match">("game");
  const [gameNote, setGameNote] = useState("");
  const [matchNote, setMatchNote] = useState("");
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const saveGameNote = useMatchStore((s) => s.saveGameNote);
  const saveMatchNote = useMatchStore((s) => s.saveMatchNote);

  const { transcript, isListening, isSupported, toggle, reset } =
    useSpeechToText();

  // Append dictated text to the active tab's note
  useEffect(() => {
    if (transcript) {
      if (activeTab === "game") {
        setGameNote((prev) => (prev ? `${prev} ${transcript}` : transcript));
      } else {
        setMatchNote((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  const handleSave = useCallback(async () => {
    if (activeTab === "game" && gameNote.trim()) {
      await saveGameNote(gameNote);
      setGameNote("");
      setSavedFeedback("Game note saved!");
    } else if (activeTab === "match" && matchNote.trim()) {
      await saveMatchNote(matchNote);
      setMatchNote("");
      setSavedFeedback("Match note saved!");
    }
    setTimeout(() => setSavedFeedback(null), 2000);
  }, [activeTab, gameNote, matchNote, saveGameNote, saveMatchNote]);

  const currentText = activeTab === "game" ? gameNote : matchNote;
  const setCurrentText = activeTab === "game" ? setGameNote : setMatchNote;

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          <FileText size={13} />
          Game &amp; Match Notes
        </span>
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-1 fade-in duration-200">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-slate-800/50 rounded-lg p-0.5">
            {(["game", "match"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all capitalize ${
                  activeTab === tab
                    ? "bg-slate-700 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab} Note
              </button>
            ))}
          </div>

          {/* Text area with voice */}
          <div className="relative">
            <textarea
              value={currentText}
              onChange={(e) => setCurrentText(e.target.value)}
              placeholder={
                activeTab === "game"
                  ? "Notes about this game…"
                  : "General match observations…"
              }
              rows={2}
              className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none"
            />
            {isSupported && (
              <button
                onClick={() => {
                  if (!isListening) reset();
                  toggle();
                }}
                className={`absolute right-2 top-2 p-1 rounded-md transition-all ${
                  isListening
                    ? "text-red-400 bg-red-500/10 animate-pulse"
                    : "text-slate-500 hover:text-blue-400 hover:bg-blue-500/10"
                }`}
                title={
                  isListening ? "Stop dictation" : "Start voice dictation"
                }
              >
                {isListening ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            )}
          </div>

          {isListening && (
            <p className="text-[10px] text-red-400 flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
              Listening…
            </p>
          )}

          {/* Save button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!currentText.trim()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentText.trim()
                  ? "bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/20"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Save size={12} />
              Save
            </button>
            {savedFeedback && (
              <span className="text-xs text-emerald-400 animate-in fade-in duration-300">
                ✓ {savedFeedback}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { PointNoteInput };
