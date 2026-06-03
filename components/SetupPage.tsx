import React, { useState } from 'react';
import {
  Users, Building2, Receipt, ArrowRight, ArrowLeft, Plus, Trash2,
  Check, Loader2, Sparkles, UserPlus, Store, ClipboardList,
} from 'lucide-react';
import { api, supabase } from '../services/api';

// ============================================================
// TYPES
// ============================================================
interface SetupPageProps {
  user: any;
  familyId: string; // may be empty if Google OAuth user
  onSetupComplete: (members: string[], expenses: string[], familyId: string) => void;
}

interface ShopEntry {
  name: string;
  baseRent: string;
}

// ============================================================
// DEFAULT EXPENSE SUGGESTIONS
// ============================================================
const EXPENSE_SUGGESTIONS = [
  'House Electrical', 'Internet Bill', 'Water Bill', 'Bore',
  'Worker Salary', 'Maintenance', 'Insurance', 'Property Tax',
];

// ============================================================
// SETUP PAGE COMPONENT
// ============================================================
const SetupPage = ({ user, familyId: initialFamilyId, onSetupComplete }: SetupPageProps) => {
  // --- STEP STATE ---
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  // --- STEP 1: GROUP NAME + MEMBERS ---
  const [groupName, setGroupName] = useState(initialFamilyId || '');
  const needsGroupName = !initialFamilyId; // Google OAuth users won't have familyId
  const [members, setMembers] = useState<string[]>(['', '']);

  // --- STEP 2: SHOPS ---
  const [shops, setShops] = useState<ShopEntry[]>([{ name: '', baseRent: '' }]);

  // --- STEP 3: EXPENSES ---
  const [expenses, setExpenses] = useState<string[]>([]);
  const [customExpense, setCustomExpense] = useState('');

  // --- UI STATE ---
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ============================================================
  // MEMBER HANDLERS
  // ============================================================
  const addMember = () => setMembers([...members, '']);
  const removeMember = (index: number) => {
    if (members.length <= 2) return; // minimum 2 members
    setMembers(members.filter((_, i) => i !== index));
  };
  const updateMember = (index: number, value: string) => {
    const updated = [...members];
    updated[index] = value;
    setMembers(updated);
  };

  // ============================================================
  // SHOP HANDLERS
  // ============================================================
  const addShop = () => setShops([...shops, { name: '', baseRent: '' }]);
  const removeShop = (index: number) => {
    if (shops.length <= 1) return; // minimum 1 shop
    setShops(shops.filter((_, i) => i !== index));
  };
  const updateShop = (index: number, field: keyof ShopEntry, value: string) => {
    const updated = [...shops];
    updated[index] = { ...updated[index], [field]: value };
    setShops(updated);
  };

  // ============================================================
  // EXPENSE HANDLERS
  // ============================================================
  const toggleExpense = (exp: string) => {
    setExpenses(prev =>
      prev.includes(exp) ? prev.filter(e => e !== exp) : [...prev, exp]
    );
  };
  const addCustomExpense = () => {
    const trimmed = customExpense.trim();
    if (trimmed && !expenses.includes(trimmed)) {
      setExpenses([...expenses, trimmed]);
      setCustomExpense('');
    }
  };
  const removeExpense = (exp: string) => {
    setExpenses(expenses.filter(e => e !== exp));
  };

  // ============================================================
  // VALIDATION
  // ============================================================
  const validMembers = members.filter(m => m.trim().length > 0);
  const validShops = shops.filter(s => s.name.trim() && Number(s.baseRent) > 0);

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return validMembers.length >= 2 && (!needsGroupName || groupName.trim().length > 0);
      case 2:
        return validShops.length >= 1;
      case 3:
        return expenses.length >= 1;
      default:
        return false;
    }
  };

  // ============================================================
  // NAVIGATION
  // ============================================================
  const goNext = () => {
    setError('');
    if (!canProceed()) {
      if (currentStep === 1) setError('Please add at least 2 members' + (needsGroupName ? ' and a group name' : ''));
      else if (currentStep === 2) setError('Please add at least 1 shop with a valid rent');
      else if (currentStep === 3) setError('Please select or add at least 1 expense category');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, totalSteps));
  };

  const goBack = () => {
    setError('');
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // ============================================================
  // SUBMIT — COMPLETE SETUP
  // ============================================================
  const handleCompleteSetup = async () => {
    if (!canProceed()) return;
    setSubmitting(true);
    setError('');
    try {
      const finalFamilyId = needsGroupName ? groupName.trim() : initialFamilyId;
      const finalMembers = validMembers;
      const finalExpenses = [...expenses];

      // 1. Save user preferences to user_preferences table
      await api.saveUserSetup(user.id, finalFamilyId, {
        members: finalMembers,
        predefinedExpenses: finalExpenses,
        setupComplete: true,
      });

      // 2. Seed initial shops to shops table for the current month
      const currentMonth = new Date().toISOString().slice(0, 7);
      for (const shop of validShops) {
        await api.addShop(currentMonth, {
          name: shop.name.trim(),
          baseRent: Number(shop.baseRent),
        }, finalFamilyId);
      }

      // 3. If Google OAuth user, update their user_metadata with family_id
      if (needsGroupName) {
        await supabase.auth.updateUser({
          data: { family_id: finalFamilyId },
        });
      }

      // 4. Notify parent
      onSetupComplete(finalMembers, finalExpenses, finalFamilyId);
    } catch (err: any) {
      console.error('Setup failed:', err);
      setError(err.message || 'Setup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // RENDER: PROGRESS BAR
  // ============================================================
  const renderProgressBar = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3].map(step => (
        <React.Fragment key={step}>
          <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm transition-all duration-500 ${
            step < currentStep
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
              : step === currentStep
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110'
                : 'bg-slate-100 text-slate-400 border border-slate-200'
          }`}>
            {step < currentStep ? <Check size={18} strokeWidth={3} /> : step}
          </div>
          {step < 3 && (
            <div className={`w-12 sm:w-20 h-1 rounded-full transition-all duration-500 ${
              step < currentStep ? 'bg-emerald-400' : 'bg-slate-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // ============================================================
  // RENDER: STEP 1 — MEMBERS
  // ============================================================
  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center mb-6">
        <div className="inline-flex p-3 bg-indigo-100 rounded-2xl mb-4">
          <UserPlus size={28} className="text-indigo-600" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Add Group Members</h2>
        <p className="text-slate-500 text-sm mt-1">Who shares the rental income? Add at least 2 members.</p>
      </div>

      {/* Group Name — only for Google OAuth users without familyId */}
      {needsGroupName && (
        <div className="mb-6">
          <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 block mb-2 tracking-widest">Group Name</label>
          <div className="relative group">
            <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
            <input
              type="text"
              placeholder="e.g. Gujjari, Smith Family"
              className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="space-y-3">
        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 block tracking-widest">Members</label>
        {members.map((member, idx) => (
          <div key={idx} className="flex gap-2 items-center animate-in fade-in zoom-in duration-200">
            <div className="flex-1 relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-sm">{idx + 1}</span>
              <input
                type="text"
                placeholder={`Member ${idx + 1} name`}
                className="w-full h-14 pl-10 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400"
                value={member}
                onChange={(e) => updateMember(idx, e.target.value)}
              />
            </div>
            {members.length > 2 && (
              <button
                onClick={() => removeMember(idx)}
                className="p-3 bg-rose-50 text-rose-400 hover:text-rose-600 rounded-xl transition-colors border border-rose-100"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addMember}
        className="w-full h-12 border-2 border-dashed border-slate-200 hover:border-indigo-300 text-slate-400 hover:text-indigo-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:bg-indigo-50/50"
      >
        <Plus size={18} /> Add Another Member
      </button>
    </div>
  );

  // ============================================================
  // RENDER: STEP 2 — SHOPS
  // ============================================================
  const renderStep2 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center mb-6">
        <div className="inline-flex p-3 bg-violet-100 rounded-2xl mb-4">
          <Store size={28} className="text-violet-600" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Add Your Shops</h2>
        <p className="text-slate-500 text-sm mt-1">Add the rental properties you manage. At least 1 required.</p>
      </div>

      <div className="space-y-4">
        {shops.map((shop, idx) => (
          <div key={idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shop {idx + 1}</span>
              {shops.length > 1 && (
                <button
                  onClick={() => removeShop(idx)}
                  className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex-[2]">
                <input
                  type="text"
                  placeholder="Shop Name"
                  className="w-full h-12 px-4 bg-white border-2 border-slate-100 rounded-xl outline-none focus:border-violet-500 font-bold text-slate-700 transition-all placeholder:text-slate-400 text-sm"
                  value={shop.name}
                  onChange={(e) => updateShop(idx, 'name', e.target.value)}
                />
              </div>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  placeholder="Rent"
                  className="w-full h-12 pl-8 pr-3 bg-white border-2 border-slate-100 rounded-xl outline-none focus:border-violet-500 font-bold text-slate-700 transition-all placeholder:text-slate-400 text-sm"
                  value={shop.baseRent}
                  onChange={(e) => updateShop(idx, 'baseRent', e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addShop}
        className="w-full h-12 border-2 border-dashed border-slate-200 hover:border-violet-300 text-slate-400 hover:text-violet-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:bg-violet-50/50"
      >
        <Plus size={18} /> Add Another Shop
      </button>
    </div>
  );

  // ============================================================
  // RENDER: STEP 3 — EXPENSES
  // ============================================================
  const renderStep3 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center mb-6">
        <div className="inline-flex p-3 bg-emerald-100 rounded-2xl mb-4">
          <ClipboardList size={28} className="text-emerald-600" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Expense Categories</h2>
        <p className="text-slate-500 text-sm mt-1">Pick or create your common expense categories.</p>
      </div>

      {/* Suggestions */}
      <div>
        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 block mb-3 tracking-widest">Suggestions — tap to add</label>
        <div className="flex flex-wrap gap-2">
          {EXPENSE_SUGGESTIONS.map(exp => {
            const selected = expenses.includes(exp);
            return (
              <button
                key={exp}
                onClick={() => toggleExpense(exp)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  selected
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {selected ? <span className="mr-1">✓</span> : <span className="mr-1 opacity-50">+</span>}
                {exp}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom expense input */}
      <div>
        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 block mb-2 tracking-widest">Add Custom</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Security Guard, Pest Control"
            className="flex-1 h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:bg-white focus:border-emerald-500 font-bold text-slate-700 transition-all placeholder:text-slate-400 text-sm"
            value={customExpense}
            onChange={(e) => setCustomExpense(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomExpense())}
          />
          <button
            onClick={addCustomExpense}
            disabled={!customExpense.trim()}
            className="h-12 px-5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all disabled:opacity-40 flex items-center gap-1"
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {/* Selected expenses */}
      {expenses.length > 0 && (
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 block mb-2 tracking-widest">
            Selected ({expenses.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {expenses.map(exp => (
              <div
                key={exp}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold border border-indigo-100"
              >
                {exp}
                <button onClick={() => removeExpense(exp)} className="ml-1 text-indigo-400 hover:text-rose-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUMMARY PREVIEW */}
      <div className="bg-slate-900 rounded-2xl p-5 text-white mt-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
          <Sparkles size={14} className="text-amber-400" /> Setup Summary
        </h3>
        <div className="space-y-3 text-sm">
          {needsGroupName && (
            <div className="flex justify-between">
              <span className="text-slate-400">Group</span>
              <span className="font-bold">{groupName || '—'}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-400">Members</span>
            <span className="font-bold">{validMembers.join(', ') || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Shops</span>
            <span className="font-bold">{validShops.map(s => s.name.trim()).join(', ') || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Expenses</span>
            <span className="font-bold">{expenses.join(', ') || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900 p-4">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'); body { font-family: 'Plus Jakarta Sans', sans-serif; }`}</style>

      {/* Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-emerald-500/5 rounded-full blur-[80px]" />
      </div>

      <div className="bg-white w-full max-w-[540px] rounded-[2.5rem] shadow-2xl shadow-indigo-100/60 border border-white/50 relative z-10 overflow-hidden backdrop-blur-sm">
        {/* Header */}
        <div className="text-center pt-8 pb-4 px-8 bg-gradient-to-b from-white to-slate-50/50">
          <div className="inline-flex p-3 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl text-white shadow-lg shadow-indigo-500/30 mb-4 ring-4 ring-indigo-50">
            <Building2 size={28} strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mb-1">Set Up Your Rental Group</h1>
          <p className="text-slate-400 text-xs font-medium">Step {currentStep} of {totalSteps}</p>
        </div>

        <div className="px-6 sm:px-8 pb-8">
          {renderProgressBar()}

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm font-bold animate-in fade-in zoom-in duration-200">
              {error}
            </div>
          )}

          {/* Step content */}
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-8">
            {currentStep > 1 && (
              <button
                onClick={goBack}
                className="flex-1 h-14 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <ArrowLeft size={18} /> Back
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                onClick={goNext}
                disabled={!canProceed()}
                className="flex-[2] h-14 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ArrowRight size={18} />
              </button>
            ) : (
              <button
                onClick={handleCompleteSetup}
                disabled={submitting || !canProceed()}
                className="flex-[2] h-14 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-xl shadow-indigo-300/40 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <><Loader2 size={20} className="animate-spin" /> Setting up...</>
                ) : (
                  <><Sparkles size={20} /> Complete Setup</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
