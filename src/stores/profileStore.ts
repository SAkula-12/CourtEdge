import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PlayerProfile, ParentConsent } from '@/models/types';

/* ------------------------------------------------------------------ */
/*  Profile Store — persisted to localStorage (Phase 1b)              */
/* ------------------------------------------------------------------ */

interface ProfileState {
  profile: PlayerProfile | null;
  /** Has the user completed the onboarding wizard at least once? */
  hasCompletedOnboarding: boolean;

  /* Actions */
  setProfile: (profile: PlayerProfile) => void;
  updateGoals: (primaryGoal: string, subGoals: string[]) => void;
  updateWeaknesses: (weaknesses: string[]) => void;
  updateParentConsent: (consent: ParentConsent) => void;
  resetProfile: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: null,
      hasCompletedOnboarding: false,

      setProfile: (profile) =>
        set({
          profile: {
            ...profile,
            isMinor: profile.age !== undefined ? profile.age < 18 : undefined,
          },
          hasCompletedOnboarding: profile.onboardingComplete ?? false,
        }),

      updateGoals: (primaryGoal, subGoals) =>
        set((state) => ({
          profile: state.profile
            ? { ...state.profile, primaryGoal, subGoals }
            : state.profile,
        })),

      updateWeaknesses: (weaknesses) =>
        set((state) => ({
          profile: state.profile
            ? { ...state.profile, selfIdentifiedWeaknesses: weaknesses }
            : state.profile,
        })),

      updateParentConsent: (consent) =>
        set((state) => ({
          profile: state.profile
            ? { ...state.profile, parentConsent: consent }
            : state.profile,
        })),

      resetProfile: () =>
        set({ profile: null, hasCompletedOnboarding: false }),
    }),
    {
      name: 'courtedge-profile',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
