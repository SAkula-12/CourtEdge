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

const TENNIS_VOCAB: Record<string, string> = {
  'juice': 'deuce',
  'add out': 'ad-out',
  'ad out': 'ad-out',
  'add in': 'ad-in',
  'ad in': 'ad-in',
  'four hand': 'forehand',
  'for hand': 'forehand',
  'back hand': 'backhand',
  'unforced error': 'unforced error',
  'un forced error': 'unforced error',
  'four hand slice': 'forehand slice',
  'for hand slice': 'forehand slice',
  'double fault': 'double fault',
  'brick point': 'break point',
  'set point': 'set point',
  'match point': 'match point',
  'ace': 'ace',
  'let': 'let',
  'net': 'net',
  'love': 'love',
};

function processTranscript(text: string) {
  let processed = text;
  for (const [wrong, right] of Object.entries(TENNIS_VOCAB)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    processed = processed.replace(regex, right);
  }
  return processed;
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

  const shouldListenRef = useRef(false);
  const accumulatedRef = useRef("");
  const latestTranscriptRef = useRef("");

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
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        
        const combined = accumulatedRef.current 
          ? accumulatedRef.current + " " + currentTranscript
          : currentTranscript;
          
        const newText = processTranscript(combined.trim());
        latestTranscriptRef.current = newText;
        setTranscript(newText);
      };

      rec.onerror = (event: Event) => {
        // Some errors might just mean no speech detected, we can ignore or let it stop
        console.warn("Speech recognition error", event);
      };

      rec.onend = () => {
        if (shouldListenRef.current) {
          // Keep listening even if it stops due to silence pause
          accumulatedRef.current = latestTranscriptRef.current;
          try {
            recognitionRef.current?.start();
          } catch (e) {
            console.error("Failed to restart speech recognition", e);
            setIsListening(false);
            shouldListenRef.current = false;
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = rec;
    }

    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.abort();
    };
  }, []);

  const toggle = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;

    if (shouldListenRef.current) {
      shouldListenRef.current = false;
      rec.stop();
      setIsListening(false);
    } else {
      shouldListenRef.current = true;
      accumulatedRef.current = "";
      latestTranscriptRef.current = "";
      setTranscript("");
      try {
        rec.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const reset = useCallback(() => {
    shouldListenRef.current = false;
    accumulatedRef.current = "";
    latestTranscriptRef.current = "";
    setTranscript("");
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
  }, [isListening]);

  return { transcript, isListening, isSupported, toggle, reset };
}

