"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, BarChart2, PlayCircle, User, Cloud, CloudOff, Wifi, WifiOff } from "lucide-react";

/* ---------- Offline Sync Indicator (Specification 4) ---------- */

function OfflineSyncIndicator() {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!mounted) {
    // Render a matching placeholder during SSR to prevent hydration mismatches
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 opacity-0">
        <div className="w-4 h-4" />
      </div>
    );
  }

  if (isOnline) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20" title="Connected — data syncing">
        <div className="relative">
          <Cloud size={16} className="text-emerald-400" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-900" />
        </div>
        <span className="text-[11px] font-medium text-emerald-400 hidden lg:inline">Online</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-pulse" title="Offline — saved locally, waiting for connection">
      <div className="relative">
        <CloudOff size={16} className="text-amber-400" />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full border border-slate-900" />
      </div>
      <span className="text-[11px] font-medium text-amber-400 hidden lg:inline">Offline</span>
    </div>
  );
}

/* ---------- Main Navigation ---------- */

export function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Learn", href: "/learn", icon: BookOpen },
    { name: "My Tennis", href: "/data", icon: BarChart2 },
    { name: "Gametime", href: "/gametime", icon: PlayCircle },
    { name: "Profile", href: "/profile", icon: User },
  ];

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex flex-col w-64 bg-slate-900 text-white h-screen fixed top-0 left-0 border-r border-slate-800 z-40">
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">CourtEdge</h1>
          <OfflineSyncIndicator />
        </div>
        <div className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 pb-safe z-40">
        {/* Mobile offline indicator — thin bar above the nav */}
        <MobileOfflineBar />
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  isActive ? "text-blue-400" : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/* ---------- Mobile Offline Bar ---------- */

function MobileOfflineBar() {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!mounted || isOnline) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-1.5 bg-amber-500/15 border-b border-amber-500/20">
      <CloudOff size={12} className="text-amber-400" />
      <span className="text-[10px] font-semibold text-amber-400 tracking-wide uppercase">Saved Locally — Waiting for Connection</span>
    </div>
  );
}
