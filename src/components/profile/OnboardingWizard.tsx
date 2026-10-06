'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertTriangle,
  User,
  Target,
  Zap,
  Shield,
} from 'lucide-react';
import { useProfileStore } from '@/stores/profileStore';
import type { PlayerProfile, ParentConsent, LocationData } from '@/models/types';
import GlobalCitySearch from '@/components/profile/GlobalCitySearch';

/* ------------------------------------------------------------------ */
/*  Pre-set chip options                                               */
/* ------------------------------------------------------------------ */

const PRIMARY_GOALS = [
  'Reach Target UTR',
  'Make School Team',
  'Prepare for College Tennis',
  'Improve Competitive Results',
];

const SUB_GOALS = [
  'Improve Second Serve',
  'Reduce Unforced Errors',
  'Better Backhand Positioning',
  'Compete More Frequently',
  'Improve Net Play',
  'Better Mental Toughness',
  'Serve Consistency',
  'Return of Serve',
];

const WEAKNESSES = [
  'High Backhand Balls',
  'Second Serve Under Pressure',
  'Volley Technique',
  'Net Approaches',
  'Overhead Smash',
  'Drop Shot Defense',
  'Tiebreak Composure',
  'First Serve Percentage',
];

/* ------------------------------------------------------------------ */
/*  Step config                                                        */
/* ------------------------------------------------------------------ */

const STEPS = [
  { label: 'Personal', icon: User },
  { label: 'Player', icon: Target },
  { label: 'Goals', icon: Zap },
  { label: 'Weaknesses', icon: Shield },
] as const;

/* ------------------------------------------------------------------ */
/*  Chip component                                                     */
/* ------------------------------------------------------------------ */

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border cursor-pointer ${
        selected
          ? 'bg-blue-500/20 border-blue-400/60 text-blue-300 shadow-md shadow-blue-500/10'
          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-300 hover:border-slate-600/60'
      }`}
    >
      {selected && <Check size={14} className="text-blue-400" />}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle button pair                                                 */
/* ------------------------------------------------------------------ */

function TogglePair({
  label,
  optionA,
  optionB,
  value,
  onChange,
}: {
  label: string;
  optionA: { label: string; value: string };
  optionB: { label: string; value: string };
  value: string | undefined;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-2">
        {[optionA, optionB].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border cursor-pointer ${
              value === opt.value
                ? 'bg-blue-500/20 border-blue-400/50 text-blue-300 shadow-lg shadow-blue-500/10'
                : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  OnboardingWizard                                                   */
/* ------------------------------------------------------------------ */

interface OnboardingWizardProps {
  onClose: () => void;
  existingProfile?: PlayerProfile | null;
}

export default function OnboardingWizard({
  onClose,
  existingProfile,
}: OnboardingWizardProps) {
  const setProfile = useProfileStore((s) => s.setProfile);
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = STEPS.length;

  /* ---------- form state ---------- */
  const [name, setName] = useState(existingProfile?.name ?? '');
  const [age, setAge] = useState<number | ''>(existingProfile?.age ?? '');
  const [location, setLocation] = useState<LocationData | undefined>(existingProfile?.location);
  const [utr, setUtr] = useState<number | ''>(existingProfile?.utr ?? '');
  const [dominantHand, setDominantHand] = useState<string | undefined>(
    existingProfile?.dominantHand
  );
  const [backhandType, setBackhandType] = useState<string | undefined>(
    existingProfile?.backhandType
  );
  const [yearsPlaying, setYearsPlaying] = useState<number | ''>(
    existingProfile?.yearsPlaying ?? ''
  );
  const [competitiveStatus, setCompetitiveStatus] = useState<string | undefined>(
    existingProfile?.competitiveStatus
  );
  const [primaryGoal, setPrimaryGoal] = useState(
    existingProfile?.primaryGoal ?? ''
  );
  const [customGoal, setCustomGoal] = useState('');
  const [subGoals, setSubGoals] = useState<string[]>(
    existingProfile?.subGoals ?? []
  );
  const [weaknesses, setWeaknesses] = useState<string[]>(
    existingProfile?.selfIdentifiedWeaknesses ?? []
  );
  const [customWeakness, setCustomWeakness] = useState('');

  /* Junior / parent consent */
  const isMinor = typeof age === 'number' && age < 18;
  const [parentEmail, setParentEmail] = useState(
    existingProfile?.parentConsent?.parentEmail ?? ''
  );

  /* ---------- step validation ---------- */
  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 0:
        if (name.trim().length < 2 || typeof age !== 'number' || age <= 0 || !location) return false;
        if (isMinor && (!parentEmail || parentEmail.trim().length === 0)) return false;
        return true;
      case 1:
        return !!dominantHand && !!backhandType;
      case 2:
        return primaryGoal.trim().length > 0;
      case 3:
        return true; // weaknesses are optional
      default:
        return true;
    }
  }, [currentStep, name, age, dominantHand, backhandType, primaryGoal]);

  /* ---------- chip toggles ---------- */
  const toggleSubGoal = (goal: string) => {
    setSubGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const toggleWeakness = (w: string) => {
    setWeaknesses((prev) =>
      prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]
    );
  };

  const addCustomWeakness = () => {
    const trimmed = customWeakness.trim();
    if (trimmed && !weaknesses.includes(trimmed)) {
      setWeaknesses((prev) => [...prev, trimmed]);
      setCustomWeakness('');
    }
  };

  /* ---------- submit ---------- */
  const handleFinish = () => {
    const resolvedGoal = primaryGoal === '__custom__' ? customGoal : primaryGoal;

    const parentConsent: ParentConsent = {
      parentEmail: parentEmail || undefined,
      status: 'PENDING',
      permissions: {
        publicNameDisplay: true,
        matchDataSharing: true,
        locationProcessing: true,
        recruitingDiscoverability: true,
      }
    };

    const profile: PlayerProfile = {
      id: existingProfile?.id ?? crypto.randomUUID(),
      userId: existingProfile?.userId ?? 'local-user',
      name: name.trim(),
      age: typeof age === 'number' ? age : undefined,
      location: location,
      utr: typeof utr === 'number' ? utr : undefined,
      dominantHand: dominantHand as 'LEFT' | 'RIGHT',
      backhandType: backhandType as 'ONE_HANDED' | 'TWO_HANDED',
      yearsPlaying: typeof yearsPlaying === 'number' ? yearsPlaying : undefined,
      competitiveStatus: competitiveStatus as 'COMPETITIVE' | 'RECREATIONAL' | undefined,
      primaryGoal: resolvedGoal,
      subGoals,
      selfIdentifiedWeaknesses: weaknesses,
      isMinor,
      parentConsent: isMinor ? parentConsent : undefined,
      onboardingComplete: true,
      createdAt: existingProfile?.createdAt ?? new Date(),
    };

    setProfile(profile);
    onClose();
  };

  /* ---------- prevent background scroll ---------- */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl shadow-black/40">
        {/* --- Header --- */}
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/60 px-6 pt-5 pb-4 rounded-t-3xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">
              {existingProfile?.onboardingComplete
                ? 'Edit Profile'
                : 'Set Up Your Profile'}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isActive = i === currentStep;
              const isCompleted = i < currentStep;
              return (
                <div key={step.label} className="flex items-center gap-2 flex-1">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                        : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-500 border border-slate-700/50'
                    }`}
                  >
                    {isCompleted ? <Check size={14} /> : <Icon size={14} />}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 rounded-full transition-all duration-300 ${
                        isCompleted ? 'bg-emerald-500/40' : 'bg-slate-800'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((step, i) => (
              <span
                key={step.label}
                className={`text-[10px] font-medium ${
                  i === currentStep ? 'text-blue-400' : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>
            ))}
          </div>
        </div>

        {/* --- Step content --- */}
        <div className="px-6 py-6 space-y-5">
          {/* ===== STEP 1: Personal Basics ===== */}
          {currentStep === 0 && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Alex Rivera"
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Age <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) =>
                      setAge(e.target.value ? parseInt(e.target.value) : '')
                    }
                    placeholder="16"
                    min={5}
                    max={99}
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
                  />
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    We ask for your age to find the best tournaments for your specific age division (e.g., U14, U16, U18, or Adult leagues) and provide relevant development benchmarks.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    UTR{' '}
                    <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="number"
                    value={utr}
                    onChange={(e) =>
                      setUtr(e.target.value ? parseFloat(e.target.value) : '')
                    }
                    placeholder="6.5"
                    step={0.1}
                    min={1}
                    max={16}
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Location <span className="text-red-400">*</span>
                </label>
                <GlobalCitySearch 
                  value={location} 
                  onChange={setLocation} 
                  error={!location && location !== undefined} 
                />
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  We ask for your location to recommend the closest tournaments, public courts, and playing opportunities near you.
                </p>
              </div>

              {/* Junior safety callout (PRD Section 49) */}
              {isMinor && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      size={20}
                      className="text-amber-400 mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="text-sm font-semibold text-amber-300">
                        Junior Player Detected
                      </p>
                      <p className="text-xs text-amber-400/80 mt-0.5">
                        Players under 18 require parent/guardian consent per our
                        safety policy. An approval link will be sent.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-amber-300/80 mb-1.5">
                      Parent / Guardian Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder="parent@email.com"
                      className="w-full bg-slate-900/60 border border-amber-500/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== STEP 2: Player Characteristics ===== */}
          {currentStep === 1 && (
            <>
              <TogglePair
                label="Dominant Hand"
                optionA={{ label: '🫲 Left-Handed', value: 'LEFT' }}
                optionB={{ label: '🫱 Right-Handed', value: 'RIGHT' }}
                value={dominantHand}
                onChange={setDominantHand}
              />

              <TogglePair
                label="Backhand Style"
                optionA={{ label: 'Two-Handed', value: 'TWO_HANDED' }}
                optionB={{ label: 'One-Handed', value: 'ONE_HANDED' }}
                value={backhandType}
                onChange={setBackhandType}
              />

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Years Playing
                </label>
                <input
                  type="number"
                  value={yearsPlaying}
                  onChange={(e) =>
                    setYearsPlaying(
                      e.target.value ? parseInt(e.target.value) : ''
                    )
                  }
                  placeholder="3"
                  min={0}
                  max={60}
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
                />
              </div>

              <TogglePair
                label="Play Style"
                optionA={{ label: '🏆 Competitive', value: 'COMPETITIVE' }}
                optionB={{ label: '🎾 Recreational', value: 'RECREATIONAL' }}
                value={competitiveStatus}
                onChange={setCompetitiveStatus}
              />
            </>
          )}

          {/* ===== STEP 3: Goals & Sub-Goals (PRD Section 9) ===== */}
          {currentStep === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Primary Goal <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRIMARY_GOALS.map((goal) => (
                    <Chip
                      key={goal}
                      label={goal}
                      selected={primaryGoal === goal}
                      onClick={() => setPrimaryGoal(goal)}
                    />
                  ))}
                  <Chip
                    label="Custom Goal…"
                    selected={primaryGoal === '__custom__'}
                    onClick={() => setPrimaryGoal('__custom__')}
                  />
                </div>
                {primaryGoal === '__custom__' && (
                  <input
                    type="text"
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    placeholder="Describe your primary goal…"
                    className="mt-3 w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
                    autoFocus
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Sub-Goals{' '}
                  <span className="text-slate-500 font-normal">
                    (select all that apply)
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUB_GOALS.map((goal) => (
                    <Chip
                      key={goal}
                      label={goal}
                      selected={subGoals.includes(goal)}
                      onClick={() => toggleSubGoal(goal)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ===== STEP 4: Self-Identified Weaknesses ===== */}
          {currentStep === 3 && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Areas of Weakness{' '}
                  <span className="text-slate-500 font-normal">
                    (these feed into AI recommendations)
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {WEAKNESSES.map((w) => (
                    <Chip
                      key={w}
                      label={w}
                      selected={weaknesses.includes(w)}
                      onClick={() => toggleWeakness(w)}
                    />
                  ))}
                  {/* Show custom-added chips */}
                  {weaknesses
                    .filter((w) => !WEAKNESSES.includes(w))
                    .map((w) => (
                      <Chip
                        key={w}
                        label={w}
                        selected={true}
                        onClick={() => toggleWeakness(w)}
                      />
                    ))}
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customWeakness}
                  onChange={(e) => setCustomWeakness(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomWeakness()}
                  placeholder="Add a custom weakness…"
                  className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
                />
                <button
                  type="button"
                  onClick={addCustomWeakness}
                  disabled={!customWeakness.trim()}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700/50 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  Add
                </button>
              </div>
            </>
          )}
        </div>

        {/* --- Footer --- */}
        <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/60 px-6 py-4 flex items-center justify-between rounded-b-3xl">
          <button
            type="button"
            onClick={() => (currentStep === 0 ? onClose() : setCurrentStep((s) => s - 1))}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <ChevronLeft size={16} />
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </button>

          {currentStep < totalSteps - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
            >
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Check size={16} />
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
