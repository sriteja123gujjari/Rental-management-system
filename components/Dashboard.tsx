import React, { useState, useEffect, useMemo } from 'react';
import { Building2, Receipt, Wallet, Users, Download, Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp, LogOut, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { generatePDF } from '../services/pdf';

// REVERTED: Hardcoded partners[cite: 1]
const MEMBERS = ['Srinivas', 'Anjaneyulu', 'Goutham'];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
};

const Dashboard = ({ user, onLogout }: any) => {
  const familyId = user?.user_metadata?.family_id || 'Gujjari';
  const [shops, setShops] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [arrears, setArrears] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Form states
  const [newShopName, setNewShopName] = useState('');
  const [newShopRent, setNewShopRent] = useState('');
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpensePayer, setNewExpensePayer] = useState(MEMBERS[0]);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [data, arrearsData] = await Promise.all([
        api.fetchMonthData(currentMonth, familyId),
        api.fetchArrears(currentMonth, familyId)
      ]);
      setShops(data.shops);
      setRecords(data.rentRecords);
      setExpenses(data.expenses);
      setArrears(arrearsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshData(); }, [currentMonth]);

  const monthlyData = useMemo(() => {
    const received = records.reduce((sum, r) => sum + Number(r.amount_paid), 0);
    const totalExp = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const net = received - totalExp;
    const split = net / MEMBERS.length;

    const memberBalances: any = {};
    MEMBERS.forEach(m => {
      const collected = records.filter(r => r.collected_by === m).reduce((sum, r) => sum + Number(r.amount_paid), 0);
      const paid = expenses.filter(e => e.paid_by === m).reduce((sum, e) => sum + Number(e.amount), 0);
      memberBalances[m] = collected - paid - split;
    });

    return { received, totalExp, net, split, memberBalances };
  }, [records, expenses]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Building2 className="text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-800">{familyId}'s Management</h1>
          </div>
          <div className="flex items-center gap-4 bg-slate-100 rounded-lg p-1">
            <button onClick={() => {
              const [y, m] = currentMonth.split('-').map(Number);
              setCurrentMonth(new Date(y, m - 2).toISOString().slice(0, 7));
            }}><ChevronLeft size={20}/></button>
            <span className="font-bold w-24 text-center">{currentMonth}</span>
            <button onClick={() => {
              const [y, m] = currentMonth.split('-').map(Number);
              setCurrentMonth(new Date(y, m).toISOString().slice(0, 7));
            }}><ChevronRight size={20}/></button>
          </div>
          <button onClick={onLogout} className="text-slate-500 hover:text-rose-600"><LogOut /></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Received" value={monthlyData.received} icon={<TrendingUp />} color="text-emerald-600" />
          <StatCard title="Expenses" value={monthlyData.totalExp} icon={<Receipt />} color="text-rose-600" />
          <StatCard title="Net" value={monthlyData.net} icon={<Wallet />} color="text-indigo-600" />
          <StatCard title="Each Share" value={monthlyData.split} icon={<Users />} color="text-amber-600" />
        </div>

        {/* Shop List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
          <div className="p-4 bg-slate-50 border-b font-bold">Properties / Shops</div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-slate-400 uppercase">
                <th className="p-4">Name</th>
                <th className="p-4">Rent</th>
                <th className="p-4">Arrears</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {shops.map(shop => {
                const record = records.find(r => r.shop_id === shop.id);
                return (
                  <tr key={shop.id} className="border-t">
                    <td className="p-4 font-medium">{shop.name}</td>
                    <td className="p-4">₹{formatCurrency(shop.base_rent)}</td>
                    <td className="p-4 text-rose-500">₹{formatCurrency(arrears[shop.name] || 0)}</td>
                    <td className="p-4">
                      {record ? (
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">Paid to {record.collected_by}</span>
                      ) : (
                        <div className="flex gap-1">
                          {MEMBERS.map(m => (
                            <button key={m} onClick={() => api.toggleRent(currentMonth, shop.id, shop.base_rent, m, familyId).then(refreshData)}
                              className="bg-slate-100 hover:bg-indigo-600 hover:text-white px-2 py-1 rounded text-[10px] transition-colors">{m}</button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => api.deleteShop(currentMonth, shop.id, familyId).then(refreshData)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="p-4 bg-slate-50 border-t flex gap-2">
            <input placeholder="New Shop" className="border rounded px-3 py-2 flex-1" value={newShopName} onChange={e => setNewShopName(e.target.value)} />
            <input type="number" placeholder="Rent" className="border rounded px-3 py-2 w-32" value={newShopRent} onChange={e => setNewShopRent(e.target.value)} />
            <button onClick={() => api.addShop(currentMonth, { name: newShopName, baseRent: newShopRent }, familyId).then(() => { setNewShopName(''); setNewShopRent(''); refreshData(); })}
              className="bg-indigo-600 text-white px-4 py-2 rounded font-bold hover:bg-indigo-700">Add</button>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 bg-slate-50 border-b font-bold">Monthly Expenses</div>
          <div className="p-4 space-y-2">
            {expenses.map(exp => (
              <div key={exp.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <div>
                  <div className="font-bold">{exp.description}</div>
                  <div className="text-xs text-slate-400">Paid by {exp.paid_by}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-rose-500">₹{formatCurrency(exp.amount)}</span>
                  <button onClick={() => api.deleteExpense(currentMonth, exp.id, familyId).then(refreshData)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-slate-50 border-t grid grid-cols-1 md:grid-cols-4 gap-2">
            <input placeholder="Description" className="border rounded px-3 py-2" value={newExpenseDesc} onChange={e => setNewExpenseDesc(e.target.value)} />
            <input type="number" placeholder="Amount" className="border rounded px-3 py-2" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value)} />
            <select className="border rounded px-3 py-2" value={newExpensePayer} onChange={e => setNewExpensePayer(e.target.value)}>
              {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={() => api.addExpense(currentMonth, { description: newExpenseDesc, amount: newExpenseAmount, paidBy: newExpensePayer }, familyId).then(() => { setNewExpenseDesc(''); setNewExpenseAmount(''); refreshData(); })}
              className="bg-slate-800 text-white px-4 py-2 rounded font-bold">Add Expense</button>
          </div>
        </div>

        <button onClick={() => generatePDF(shops, records, expenses, currentMonth, monthlyData, 'download')}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-indigo-700 transition-all">
          <Download /> Download Report (PDF)
        </button>
      </main>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: any) => (
  <div className="bg-white p-5 rounded-xl border shadow-sm flex justify-between items-center">
    <div>
      <div className="text-xs font-bold text-slate-400 uppercase mb-1">{title}</div>
      <div className={`text-2xl font-bold ${color}`}>₹{formatCurrency(value)}</div>
    </div>
    <div className={`p-3 rounded-lg bg-slate-50 ${color}`}>{icon}</div>
  </div>
);

export default Dashboard;
