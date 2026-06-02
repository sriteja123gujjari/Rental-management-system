import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const api = {
  // --- AUTH ---
  async register(userData: any) {
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          full_name: userData.name,
          family_id: userData.familyId,
        },
      },
    });
    if (error) throw error;
    return data;
  },

  async login(credentials: any) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (error) throw error;
    return data.user;
  },

  async logout() {
    await supabase.auth.signOut();
  },

  // --- DATA FETCHING ---
  async fetchMonthData(month: string, familyId: string) {
    const [recordsRes, expensesRes, shopsRes] = await Promise.all([
      supabase.from('rent_records').select('*').eq('month', month).eq('family_id', familyId),
      supabase.from('expenses').select('*').eq('month', month).eq('family_id', familyId),
      supabase.from('shops').select('*').eq('month', month).eq('family_id', familyId)
    ]);

    return {
      shops: shopsRes.data || [],
      rentRecords: recordsRes.data || [],
      expenses: expensesRes.data || []
    };
  },

  async fetchArrears(currentMonth: string, familyId: string) {
    try {
      const { data: pastShops } = await supabase.from('shops').select('*').eq('family_id', familyId).lt('month', currentMonth);
      const { data: pastPayments } = await supabase.from('rent_records').select('*').eq('family_id', familyId).lt('month', currentMonth);
      
      if (!pastShops || !pastPayments) return {};

      const arrearsMap: Record<string, number> = {};
      pastShops.forEach((shop) => {
        if (!arrearsMap[shop.name]) arrearsMap[shop.name] = 0;
        arrearsMap[shop.name] += Number(shop.base_rent);
      });

      pastPayments.forEach((payment) => {
        const shop = pastShops.find(s => s.id === payment.shop_id);
        if (shop) arrearsMap[shop.name] -= Number(payment.amount_paid);
      });

      return arrearsMap;
    } catch (err) {
      return {};
    }
  },

  // --- ACTIONS ---
  async toggleRent(month: string, shopId: string, amount: number, collector: string, familyId: string) {
    const { data: existing } = await supabase.from('rent_records')
      .select('*').eq('month', month).eq('shop_id', shopId).eq('family_id', familyId).single();

    if (amount <= 0 && existing) {
      await supabase.from('rent_records').delete().eq('id', existing.id);
    } else if (existing) {
      await supabase.from('rent_records').update({ amount_paid: amount, collected_by: collector }).eq('id', existing.id);
    } else {
      await supabase.from('rent_records').insert([{
        month, shop_id: shopId, amount_paid: amount, collected_by: collector, status: 'Paid', family_id: familyId
      }]);
    }
    const { data } = await supabase.from('rent_records').select('*').eq('month', month).eq('family_id', familyId);
    return { rentRecords: data || [] };
  },

  async addShop(month: string, shop: any, familyId: string) {
    await supabase.from('shops').insert([{ month, name: shop.name, base_rent: shop.baseRent, family_id: familyId }]);
  },

  async deleteShop(month: string, id: string, familyId: string) {
    await supabase.from('shops').delete().eq('month', month).eq('id', id).eq('family_id', familyId);
  },

  async addExpense(month: string, expense: any, familyId: string) {
    await supabase.from('expenses').insert([{
      month, description: expense.description, amount: expense.amount, paid_by: expense.paidBy, family_id: familyId
    }]);
  },

  async deleteExpense(month: string, id: string, familyId: string) {
    await supabase.from('expenses').delete().eq('month', month).eq('id', id).eq('family_id', familyId);
  }
};
