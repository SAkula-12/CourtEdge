'use client';

import { useState, useEffect } from 'react';
import { Shield, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { useProfileStore } from '@/stores/profileStore';

export default function ParentApprovalPage() {
  const profile = useProfileStore((s) => s.profile);
  const updateParentConsent = useProfileStore((s) => s.updateParentConsent);
  
  const [mounted, setMounted] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const [permissions, setPermissions] = useState({
    publicNameDisplay: true,
    matchDataSharing: true,
    locationProcessing: true,
    recruitingDiscoverability: true,
  });

  useEffect(() => {
    setMounted(true);
    if (profile?.parentConsent?.status === 'APPROVED') {
      setIsApproved(true);
      setPermissions(profile.parentConsent.permissions);
    }
  }, [profile]);

  if (!mounted || !profile || !profile.isMinor) {
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse space-y-4 text-center">
          <div className="h-12 w-12 bg-slate-800 rounded-full mx-auto" />
          <div className="h-4 w-48 bg-slate-800 rounded-full mx-auto" />
        </div>
      </div>
    );
  }

  const handleApprove = () => {
    if (profile.parentConsent) {
      updateParentConsent({
        ...profile.parentConsent,
        status: 'APPROVED',
        permissions,
      });
      setIsApproved(true);
    }
  };

  const Toggle = ({ label, description, checked, onChange }: any) => (
    <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{description}</p>
      </div>
      <label className="flex items-center cursor-pointer shrink-0">
        <div className="relative">
          <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
          <div className={`block w-12 h-6 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`} />
          <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
        </div>
      </label>
    </div>
  );

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-4 mb-10 mt-8">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto border border-violet-500/20">
          <Shield size={32} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Parent/Guardian Approval</h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            {profile.name} is creating an account on CourtEdge. As they are under 18, we require your approval and privacy preferences.
          </p>
        </div>
      </div>

      {isApproved ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 size={24} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-emerald-400 mb-1">Account Approved</h2>
            <p className="text-sm text-emerald-500/80">You have successfully configured permissions for {profile.name}.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
              <Lock size={18} className="text-slate-400" />
              Privacy & Data Permissions
            </h2>
            
            <div className="space-y-3">
              <Toggle 
                label="Public Name Display" 
                description="Display child's full name publicly. If disabled, defaults to First Name, Last Initial."
                checked={permissions.publicNameDisplay}
                onChange={(v: boolean) => setPermissions({ ...permissions, publicNameDisplay: v })}
              />
              <Toggle 
                label="Match Data Sharing" 
                description="Allow match scores, stats, and historical analytics to be viewed by approved coaches and the public."
                checked={permissions.matchDataSharing}
                onChange={(v: boolean) => setPermissions({ ...permissions, matchDataSharing: v })}
              />
              <Toggle 
                label="Location Processing" 
                description="Allow app to use child's approximate location to suggest nearby tournaments and courts."
                checked={permissions.locationProcessing}
                onChange={(v: boolean) => setPermissions({ ...permissions, locationProcessing: v })}
              />
              <Toggle 
                label="Recruiting Discoverability" 
                description="Allow child's profile to appear in searches by verified college recruiters."
                checked={permissions.recruitingDiscoverability}
                onChange={(v: boolean) => setPermissions({ ...permissions, recruitingDiscoverability: v })}
              />
            </div>
          </div>

          <button 
            onClick={handleApprove}
            className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
          >
            <ShieldCheck size={18} />
            Confirm & Approve Account
          </button>
        </div>
      )}
    </div>
  );
}
