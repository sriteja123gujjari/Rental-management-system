import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) { throw new Error('Missing Supabase URL or Key'); }

export const supabase = createClient(supabaseUrl, supabaseKey);

const getPreviousMonth = (currentMonth: string) => {
  const [yearStr, monthStr] = currentMonth.split('-');
  let year = parseInt(yearStr);
  let month = parseInt(monthStr) - 1;
  if (month === 0) { month = 12; year -= 1; }
  return `${year}-${String(month).padStart(2, '0')}`;
};

export const api = {
  // --- AUTHENTICATION ---
  async register(userData: { email: string; password: string; name: string; familyId: string }) {
    if (!userData.email || !userData.password || !userData.familyId) throw new Error("Missing data");
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: { data: { full_name: userData.name, family_id: userData.familyId } }
    });
    if (error) throw error;
    return data;
  },

  async login(credentials: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: credentials.email, password: credentials.password });
    if (error) throw error;
    return { ...data.user, familyId: data.user?.user_metadata?.family_id };
  },

  async logout() { await supabase.auth.signOut(); },

  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin, 
      },
    });
    if (error) throw error;
    return data;
  },

  // --- CUSTOM DYNAMIC PARTNERS / MEMBERS ACTIONS ---
  async fetchMembers(familyId: string) {
    const { data, error } = await supabase
      .from('members')
      .select('name')
      .eq('family_id', familyId);
    
    if (error) throw error;
    return data.map(m => m.name);
  },

  async addMember(name: string, familyId: string) {
    const { error } = await supabase
      .from('members')
      .insert([{ name, family_id: familyId }]);
    
    if (error) throw error;
  },

  async deleteMember(name: string, familyId: string) {
    const { error } = await supabase
      .from('members')
      .delete()
      .eq('family_id', familyId)
      .eq('name', name);
    
    if (error) throw error;
  },

  // --- DATA FETCHING (FIXED GHOST SHOPS) ---
  async fetchMonthData(month: string, familyId: string) {
    const [recordsRes, expensesRes] = await Promise.all([
      supabase.from('rent_records').select('*').eq('month', month).eq('family_id', familyId),
      supabase.from('expenses').select('*').eq('month', month).eq('family_id', familyId)
    ]);

    const rentRecords = recordsRes.data || [];
    const expenses = expensesRes.data || [];

    const { data: monthlyShops } = await supabase.from('shops').select('*').eq('month', month).eq('family_id', familyId);
    
    let allShops = monthlyShops || [];

    if (rentRecords.length > 0) {
        const recordShopIds = rentRecords.map(r => r.shop_id);
        const currentShopIds = new Set(allShops.map(s => s.id));
        
        const missingIds = recordShopIds.filter(id => !currentShopIds.has(id));
        
        if (missingIds.length > 0) {
            const { data: ghostShops } = await supabase.from('shops').select('*').in('id', missingIds);
            if (ghostShops) {
                const existingNames = new Set(allShops.map(s => s.name));
                const uniqueGhosts = ghostShops.filter(g => !existingNames.has(g.name));
                allShops = [...allShops, ...uniqueGhosts];
            }
        }
    }

    allShops.sort((a, b) => a.name.localeCompare(b.name));

    return { 
      shops: allShops, 
      rentRecords, 
      expenses 
    };
  },

  async fetchArrears(currentMonth: string, familyId: string) {
      try {
        const { data: pastShops } = await supabase
          .from('shops')
          .select('id, name, base_rent, month')
          .eq('family_id', familyId)
          .lt('month', currentMonth);

        const { data: pastPayments } = await supabase
          .from('rent_records')
          .select('shop_id, amount_paid, month')
          .eq('family_id', familyId)
          .lt('month', currentMonth);

        if (!pastShops || !pastPayments) return {};

        const arrearsMap: Record<string, number> = {};

        pastShops.forEach((shop) => {
            if (!arrearsMap[shop.name]) arrearsMap[shop.name] = 0;
            arrearsMap[shop.name] += Number(shop.base_rent);
        });

        pastPayments.forEach((payment) => {
            const originalShop = pastShops.find(s => s.id === payment.shop_id);
            if (originalShop && originalShop.name) {
                arrearsMap[originalShop.name] -= Number(payment.amount_paid);
            }
        });

        Object.keys(arrearsMap).forEach(key => {
            if (arrearsMap[key] <= 0) delete arrearsMap[key];
        });

        return arrearsMap;
      } catch (err) {
        console.error("Error calculating arrears:", err);
        return {};
      }
    },

  // --- SETTLEMENT ACTION ---
  async settleUp(month: string, familyId: string) {
    await supabase.from('rent_records').update({ is_settled: true }).eq('month', month).eq('family_id', familyId).eq('is_settled', false);
    await supabase.from('expenses').update({ is_settled: true }).eq('month', month).eq('family_id', familyId).eq('is_settled', false);
  },

  // --- STANDARD ACTIONS ---
  async toggleRent(month: string, shopId: string, amount: number, collector: string, familyId: string) {
    const { data: existing } = await supabase.from('rent_records').select('*').eq('month', month).eq('shop_id', shopId).eq('family_id', familyId).single();

    if (amount <= 0 && existing) {
      await supabase.from('rent_records').delete().eq('id', existing.id);
    } else if (existing) {
      await supabase.from('rent_records').update({ amount_paid: amount, collected_by: collector, is_settled: false }).eq('id', existing.id);
    } else if (amount > 0) {
      await supabase.from('rent_records').insert([{ month, shop_id: shopId, amount_paid: amount, collected_by: collector, status: 'Paid', family_id: familyId, is_settled: false }]);
    }
    const { data: rentRecords } = await supabase.from('rent_records').select('*').eq('month', month).eq('family_id', familyId);
    return { rentRecords: rentRecords || [] };
  },

  async addShop(month: string, shop: { name: string; baseRent: number }, familyId: string) {
    await supabase.from('shops').insert([{ month, name: shop.name, base_rent: shop.baseRent, family_id: familyId }]);
  },

  async updateShop(month: string, id: string, updates: { name: string; baseRent: number }, familyId: string) {
    await supabase.from('shops').update({ name: updates.name, base_rent: updates.baseRent }).eq('month', month).eq('id', id).eq('family_id', familyId);
  },

  async deleteShop(month: string, id: string, familyId: string) {
    await supabase.from('rent_records').delete().eq('month', month).eq('shop_id', id).eq('family_id', familyId);
    await supabase.from('shops').delete().eq('month', month).eq('id', id).eq('family_id', familyId);
  },

  async addExpense(month: string, expense: any, familyId: string) {
    await supabase.from('expenses').insert([{ month, description: expense.description, amount: expense.amount, paid_by: expense.paidBy, family_id: familyId, is_settled: false }]);
  },

  async deleteExpense(month: string, id: string, familyId: string) {
    await supabase.from('expenses').delete().eq('month', month).eq('id', id).eq('family_id', familyId);
  }
};
