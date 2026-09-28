"use client";

import { Sparkles } from "lucide-react";

export function AIAssistantButton() {
  return (
    <button
      className="fixed bottom-20 md:bottom-8 right-4 md:right-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-full shadow-xl shadow-blue-500/40 hover:shadow-2xl hover:scale-110 transition-all duration-300 z-50 flex items-center justify-center group"
      aria-label="AI Assistant"
    >
      <Sparkles size={24} className="group-hover:animate-pulse" />
    </button>
  );
}
