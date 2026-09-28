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

  const [textBeforeDictation, setTextBeforeDictation] = useState("");

  useEffect(() => {
    if (isListening) {
      const base = textBeforeDictation;
      const combined = base ? `${base} ${transcript}` : transcript;
      setPointNote(combined.trim());
    }
  }, [transcript, isListening, textBeforeDictation, setPointNote]);

  const handleToggle = () => {
    if (isListening) {
      reset();
    } else {
      setTextBeforeDictation(pendingNote);
      toggle();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isListening) {
      reset();
    }
    setPointNote(e.target.value);
  };

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
          onChange={handleChange}
          placeholder="Quick note about this point…"
          className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
        />
        {isSupported && (
          <button
            onClick={handleToggle}
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

/** Expandable panel for point, game-level and match-level notes */
export function NotesPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"point" | "game" | "match">("point");
  const [gameNote, setGameNote] = useState("");
  const [matchNote, setMatchNote] = useState("");
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const pendingPointNote = useMatchStore((s) => s.pendingPointNote);
  const setPointNote = useMatchStore((s) => s.setPointNote);
  const saveGameNote = useMatchStore((s) => s.saveGameNote);
  const saveMatchNote = useMatchStore((s) => s.saveMatchNote);

  const { transcript, isListening, isSupported, toggle, reset } = useSpeechToText();
  const [textBeforeDictation, setTextBeforeDictation] = useState("");

  const currentText =
    activeTab === "point" ? pendingPointNote : activeTab === "game" ? gameNote : matchNote;

  const setCurrentText = useCallback(
    (text: string) => {
      if (activeTab === "point") setPointNote(text);
      else if (activeTab === "game") setGameNote(text);
      else setMatchNote(text);
    },
    [activeTab, setPointNote]
  );

  useEffect(() => {
    if (isListening) {
      const base = textBeforeDictation;
      const combined = base ? `${base} ${transcript}` : transcript;
      setCurrentText(combined.trim());
    }
  }, [transcript, isListening, textBeforeDictation, setCurrentText]);

  const handleToggle = () => {
    if (isListening) {
      reset();
    } else {
      setTextBeforeDictation(currentText);
      toggle();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isListening) {
      reset();
    }
    setCurrentText(e.target.value);
  };

  const handleTabChange = (nextTab: "point" | "game" | "match") => {
    if (nextTab === activeTab) return;

    const sourceText = currentText.trim();
    const targetText =
      nextTab === "point" ? pendingPointNote : nextTab === "game" ? gameNote : matchNote;

    // Fast-paced tennis auto-transfer: if user typed/dictated text in source tab and target is empty, transfer it over!
    if (sourceText && !targetText.trim()) {
      if (nextTab === "point") setPointNote(sourceText);
      else if (nextTab === "game") setGameNote(sourceText);
      else setMatchNote(sourceText);

      // Clear source text if it was gameNote or matchNote
      if (activeTab === "game") setGameNote("");
      else if (activeTab === "match") setMatchNote("");
      else if (activeTab === "point") setPointNote("");
    }

    if (isListening) {
      setTextBeforeDictation(sourceText);
    }
    setActiveTab(nextTab);
  };

  const handleSave = useCallback(async () => {
    if (activeTab === "point" && pendingPointNote.trim()) {
      setSavedFeedback("Point note attached for next point!");
    } else if (activeTab === "game" && gameNote.trim()) {
      await saveGameNote(gameNote);
      setGameNote("");
      setSavedFeedback("Game note saved!");
    } else if (activeTab === "match" && matchNote.trim()) {
      await saveMatchNote(matchNote);
      setMatchNote("");
      setSavedFeedback("Match note saved!");
    }
    setTimeout(() => setSavedFeedback(null), 2000);
  }, [activeTab, pendingPointNote, gameNote, matchNote, saveGameNote, saveMatchNote]);

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          <FileText size={13} />
          Point, Game &amp; Match Notes
        </span>
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-1 fade-in duration-200">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-slate-800/50 rounded-lg p-0.5">
            {(["point", "game", "match"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
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
              onChange={handleChange}
              placeholder={
                activeTab === "point"
                  ? "Point note (attached when point is recorded)…"
                  : activeTab === "game"
                  ? "Notes about this game…"
                  : "General match observations…"
              }
              rows={2}
              className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none"
            />
            {isSupported && (
              <button
                onClick={handleToggle}
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
            {activeTab !== "point" && (
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
            )}

            {activeTab === "point" && currentText.trim() && (
              <span className="text-xs text-blue-400">
                ✓ Attached to point (saved on point confirm)
              </span>
            )}

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
