import { supabase } from './supabase';

export const api = {
  // --- AUTHENTICATION ---
  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error("Login failed");

    return { 
      user: {
        id: data.user.id,
        email: data.user.email,
        familyId: data.user.user_metadata.familyId,
        name: data.user.user_metadata.name
      }, 
      token: data.session.access_token 
    };
  },

  register: async ({ email, password, name, familyId }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, familyId: familyId.toUpperCase() } }
    });
    if (error) throw error;
    return data;
  },

  // --- DATA FETCHING (SPEED OPTIMIZED) ---
  fetchMonthData: async (month) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found");
    const familyId = user.user_metadata.familyId;

    // PERFORMANCE FIX: Fetch all 3 tables in PARALLEL (At the same time)
    const [shopsRes, rentsRes, expensesRes] = await Promise.all([
      supabase.from('shops').select('*').eq('family_id', familyId).eq('month', month),
      supabase.from('rent_records').select('*').eq('family_id', familyId).eq('month', month),
      supabase.from('expenses').select('*').eq('family_id', familyId).eq('month', month)
    ]);

    // Check errors
    if (shopsRes.error) console.error("Error shops:", shopsRes.error);
    if (rentsRes.error) console.error("Error rents:", rentsRes.error);
    if (expensesRes.error) console.error("Error expenses:", expensesRes.error);

    return {
      // Logic unchanged: Map DB snake_case to Frontend camelCase
      shops: shopsRes.data?.map(s => ({ ...s, baseRent: s.base_rent })) || [],
      
      rentRecords: rentsRes.data?.map(r => ({
        ...r, 
        shopId: r.shop_id, 
        amountPaid: r.amount_paid, 
        collectedBy: r.collected_by 
      })) || [], 
      
      expenses: expensesRes.data?.map(e => ({ ...e, paidBy: e.paid_by })) || []
    };
  },

  // --- ADD / EDIT DATA ---
  addShop: async (month, shop) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('shops').insert({
      month,
      family_id: user?.user_metadata.familyId,
      name: shop.name,
      base_rent: shop.baseRent
    });
  },

  updateShop: async (month, shopId, update) => {
    const dbUpdate: any = {};
    if (update.name) dbUpdate.name = update.name;
    if (update.baseRent) dbUpdate.base_rent = update.baseRent;

    // 1. Update Shop
    const { error } = await supabase.from('shops').update(dbUpdate).eq('id', shopId);
    if (error) throw error;

    // 2. Logic Sync: Update rent record if base rent changed
    if (update.baseRent) {
        await supabase
            .from('rent_records')
            .update({ amount_paid: update.baseRent })
            .eq('shop_id', shopId)
            .eq('month', month);
    }
  },

  deleteShop: async (month, shopId) => {
    await supabase.from('shops').delete().eq('id', shopId);
  },

  // --- TOGGLE RENT ---
  toggleRent: async (month, shopId, baseRent, member) => {
    const { data: { user } } = await supabase.auth.getUser();
    const familyId = user?.user_metadata.familyId;

    const { data: existing } = await supabase
        .from('rent_records')
        .select('*')
        .eq('shop_id', shopId)
        .eq('month', month)
        .maybeSingle(); 

    if (existing) {
        await supabase.from('rent_records').delete().eq('id', existing.id);
    } else {
        await supabase.from('rent_records').insert({
            shop_id: shopId,
            month,
            family_id: familyId,
            status: 'Paid',
            amount_paid: baseRent,
            collected_by: member
        });
    }

    return api.fetchMonthData(month);
  },

  // --- UPDATE RENT RECORD ---
  updateRentRecord: async (month, shopId, update) => {
    const dbUpdate: any = {};
    if (update.collectedBy) dbUpdate.collected_by = update.collectedBy;
    if (update.amountPaid) dbUpdate.amount_paid = update.amountPaid;

    const { error } = await supabase
      .from('rent_records')
      .update(dbUpdate)
      .eq('shop_id', shopId)
      .eq('month', month);

    if (error) throw error;

    return api.fetchMonthData(month);
  },

  addExpense: async (month, expense) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('expenses').insert({
      month,
      family_id: user?.user_metadata.familyId,
      description: expense.description,
      amount: expense.amount,
      paid_by: expense.paidBy
    });
  },

  deleteExpense: async (month, expId) => {
    await supabase.from('expenses').delete().eq('id', expId);
  }
};