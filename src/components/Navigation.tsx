"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, BarChart2, PlayCircle, User } from "lucide-react";

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
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">CourtEdge</h1>
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
