'use client';

import { useState, useEffect } from 'react';
import {
  Edit3,
  MapPin,
  Award,
  Hand,
  Clock,
  Target,
  Zap,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Trophy,
  RotateCcw,
  ChevronRight,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useProfileStore } from '@/stores/profileStore';
import OnboardingWizard from '@/components/profile/OnboardingWizard';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function InitialBadge({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/20 border-2 border-blue-400/30">
      <span className="text-2xl font-bold text-white tracking-tight">
        {initials}
      </span>
    </div>
  );
}

function StatBadge({
  icon: Icon,
  label,
  value,
  accent = 'blue',
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  accent?: 'blue' | 'emerald' | 'amber' | 'indigo';
}) {
  const colorMap = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center border ${colorMap[accent]}`}
      >
        <Icon size={16} />
      </div>
      <div>
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Profile Page                                                       */
/* ------------------------------------------------------------------ */

export default function ProfilePage() {
  const profile = useProfileStore((s) => s.profile);
  const hasCompletedOnboarding = useProfileStore((s) => s.hasCompletedOnboarding);
  const resetProfile = useProfileStore((s) => s.resetProfile);

  const [showWizard, setShowWizard] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch — profile comes from localStorage
  useEffect(() => setMounted(true), []);

  // Auto-open wizard for first-time users
  useEffect(() => {
    if (mounted && !hasCompletedOnboarding) {
      setShowWizard(true);
    }
  }, [mounted, hasCompletedOnboarding]);

  /* Skeleton / loading state before hydration */
  if (!mounted) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-40 bg-slate-800/50 rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-48 bg-slate-800/50 rounded-2xl" />
            <div className="h-48 bg-slate-800/50 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  /* ========== Empty state — show CTA ========== */
  if (!profile || !hasCompletedOnboarding) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 max-w-md w-full space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center border border-blue-500/20">
              <Sparkles size={28} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">Welcome to CourtEdge</h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Set up your player profile so we can personalize your coaching
                experience and track your development journey.
              </p>
            </div>
            <button
              onClick={() => setShowWizard(true)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
            >
              Get Started
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {showWizard && (
          <OnboardingWizard
            onClose={() => setShowWizard(false)}
            existingProfile={profile}
          />
        )}
      </>
    );
  }

  /* ========== Full profile dashboard ========== */
  return (
    <>
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
        {/* ---------- Header Banner ---------- */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800/70 rounded-3xl p-6 md:p-8 overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-500/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-indigo-500/6 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <InitialBadge name={profile.name} />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white truncate">
                {profile.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                {profile.location && (
                  <span className="flex items-center gap-1 text-sm text-slate-400">
                    <MapPin size={14} className="text-slate-500" />
                    {profile.location}
                  </span>
                )}
                {profile.utr !== undefined && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                    <Award size={12} />
                    UTR {profile.utr}
                  </span>
                )}
                {profile.isMinor && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-500/15 text-violet-400 border border-violet-500/25">
                    Junior
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-sm font-medium text-slate-300 hover:bg-slate-700/80 hover:text-white transition-all cursor-pointer shrink-0"
            >
              <Edit3 size={14} />
              Edit Profile
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ---------- Tennis Attributes Card ---------- */}
          <div className="bg-slate-900/70 border border-slate-800/60 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Trophy size={14} className="text-blue-400" />
              </div>
              <h2 className="text-base font-semibold text-white">
                Tennis Attributes
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatBadge
                icon={Hand}
                label="Dominant Hand"
                value={
                  profile.dominantHand === 'LEFT'
                    ? 'Left-Handed'
                    : 'Right-Handed'
                }
                accent="blue"
              />
              <StatBadge
                icon={() => (
                  <span className="text-xs font-bold">BH</span>
                )}
                label="Backhand"
                value={
                  profile.backhandType === 'ONE_HANDED'
                    ? 'One-Handed'
                    : 'Two-Handed'
                }
                accent="indigo"
              />
              <StatBadge
                icon={Clock}
                label="Experience"
                value={
                  profile.yearsPlaying
                    ? `${profile.yearsPlaying} yr${profile.yearsPlaying !== 1 ? 's' : ''}`
                    : 'Not set'
                }
                accent="emerald"
              />
              <StatBadge
                icon={Target}
                label="Play Style"
                value={
                  profile.competitiveStatus === 'COMPETITIVE'
                    ? 'Competitive'
                    : profile.competitiveStatus === 'RECREATIONAL'
                    ? 'Recreational'
                    : 'Not set'
                }
                accent="amber"
              />
            </div>
          </div>

          {/* ---------- Active Goals Card (PRD Section 9) ---------- */}
          <div className="bg-slate-900/70 border border-slate-800/60 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <Zap size={14} className="text-emerald-400" />
              </div>
              <h2 className="text-base font-semibold text-white">
                Active Goals
              </h2>
            </div>

            {/* Primary goal */}
            {profile.primaryGoal && (
              <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-1">
                  Primary Goal
                </p>
                <p className="text-sm font-bold text-emerald-300">
                  {profile.primaryGoal}
                </p>
                <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: '15%' }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Just getting started — play matches and track progress to advance
                </p>
              </div>
            )}

            {/* Sub-goals */}
            {profile.subGoals && profile.subGoals.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Sub-Goals
                </p>
                {profile.subGoals.map((goal) => (
                  <div
                    key={goal}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/30"
                  >
                    <Circle size={14} className="text-slate-600 shrink-0" />
                    <span className="text-sm text-slate-300">{goal}</span>
                  </div>
                ))}
              </div>
            )}

            {!profile.primaryGoal && (
              <p className="text-sm text-slate-500 italic">
                No goals set yet. Edit your profile to get started.
              </p>
            )}
          </div>

          {/* ---------- Weaknesses & Areas of Focus ---------- */}
          <div className="bg-slate-900/70 border border-slate-800/60 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-500/15 flex items-center justify-center">
                <Shield size={14} className="text-rose-400" />
              </div>
              <h2 className="text-base font-semibold text-white">
                Areas of Focus
              </h2>
            </div>

            {profile.selfIdentifiedWeaknesses &&
            profile.selfIdentifiedWeaknesses.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.selfIdentifiedWeaknesses.map((w) => (
                  <span
                    key={w}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  >
                    <AlertTriangle size={11} />
                    {w}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">
                No weaknesses identified yet.
              </p>
            )}

            <p className="text-[11px] text-slate-600 leading-relaxed">
              These areas feed into AI-powered recommendations for drills,
              lessons, and match analysis focus points.
            </p>
          </div>

          {/* ---------- Parent & Privacy Controls (PRD Section 49) ---------- */}
          <div className="bg-slate-900/70 border border-slate-800/60 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <Lock size={14} className="text-violet-400" />
              </div>
              <h2 className="text-base font-semibold text-white">
                Privacy & Safety
              </h2>
            </div>

            {/* Junior status */}
            {profile.isMinor ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <AlertTriangle size={14} className="text-violet-400 shrink-0" />
                  <span className="text-sm text-violet-300 font-medium">
                    Junior Player (under 18)
                  </span>
                </div>

                {/* Parent consent status */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30">
                    <span className="text-sm text-slate-300">
                      Parent Consent
                    </span>
                    {profile.parentConsent?.isApproved ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                        <CheckCircle2 size={13} />
                        Approved
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-400">
                        <Clock size={13} />
                        Pending
                      </span>
                    )}
                  </div>

                  {profile.parentConsent?.parentEmail && (
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30">
                      <span className="text-sm text-slate-300">
                        Guardian Email
                      </span>
                      <span className="text-xs text-slate-400">
                        {profile.parentConsent.parentEmail}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30">
                    <span className="text-sm text-slate-300">
                      Coach Data Sharing
                    </span>
                    {profile.parentConsent?.dataSharingAllowed ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                        <Eye size={13} />
                        Enabled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                        <EyeOff size={13} />
                        Disabled
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span className="text-sm text-emerald-300 font-medium">
                    Adult Player
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  No parental consent required. You have full control over your
                  data sharing and privacy settings.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ---------- Reset / Danger Zone ---------- */}
        <div className="pt-4 border-t border-slate-800/60">
          <button
            onClick={() => {
              if (window.confirm('Are you sure? This will erase your profile.')) {
                resetProfile();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            <RotateCcw size={13} />
            Reset Profile
          </button>
        </div>
      </div>

      {/* Wizard modal */}
      {showWizard && (
        <OnboardingWizard
          onClose={() => setShowWizard(false)}
          existingProfile={profile}
        />
      )}
    </>
  );
}
