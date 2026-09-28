"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/* ------------------------------------------------------------------ */
/*  Web Speech API type shims (not all environments ship these)       */
/* ------------------------------------------------------------------ */

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

/**
 * Hook wrapping the browser-native Web Speech API (SpeechRecognition).
 * Returns a simple { transcript, isListening, toggle, reset } API.
 *
 * Falls back gracefully: `isSupported` will be false when the browser
 * lacks the API (e.g. Firefox on desktop, most mobile browsers other than Chrome).
 */
export function useSpeechToText() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    // Feature-detect — the API is prefixed in most browsers
    const win = window as unknown as Record<string, unknown>;
    const SpeechRecognition =
      (win.SpeechRecognition ?? win.webkitSpeechRecognition) as
        | SpeechRecognitionConstructor
        | undefined;

    if (SpeechRecognition) {
      setIsSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          finalTranscript += event.results[i][0].transcript;
        }
        setTranscript(finalTranscript);
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }

    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const toggle = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;

    if (isListening) {
      rec.stop();
      setIsListening(false);
    } else {
      // Reset transcript on each fresh dictation start
      setTranscript("");
      rec.start();
      setIsListening(true);
    }
  }, [isListening]);

  const reset = useCallback(() => {
    setTranscript("");
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
  }, [isListening]);

  return { transcript, isListening, isSupported, toggle, reset };
}
