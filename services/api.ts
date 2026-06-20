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
    const { data: existing } = await supabase
      .from('shops')
      .select('id')
      .eq('month', month)
      .eq('name', shop.name)
      .eq('family_id', familyId)
      .maybeSingle();

    if (existing) {
      return;
    }
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
  },

  // --- GOOGLE OAUTH ---
  async signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  },

  // --- SETTLE UP ---
  async settleUp(month: string, familyId: string) {
    // Mark all rent records for this month as settled
    await supabase
      .from('rent_records')
      .update({ is_settled: true })
      .eq('month', month)
      .eq('family_id', familyId);
    // Mark all expenses for this month as settled
    await supabase
      .from('expenses')
      .update({ is_settled: true })
      .eq('month', month)
      .eq('family_id', familyId);
  },

  // --- UPDATE SHOP ---
  async updateShop(month: string, shopId: string, shop: { name: string; baseRent: number }, familyId: string) {
    await supabase
      .from('shops')
      .update({ name: shop.name, base_rent: shop.baseRent })
      .eq('id', shopId)
      .eq('month', month)
      .eq('family_id', familyId);
  },

  // ============================================================
  // USER PREFERENCES (Setup Upgrade)
  // ============================================================

  /**
   * Fetch user setup preferences.
   * Returns the preferences object or null if not found.
   */
  async getUserSetup(userId: string, familyId: string) {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('family_id', familyId)
      .single();

    // PGRST116 = "no rows returned" — normal for first-time users
    if (error && error.code !== 'PGRST116') {
      console.error('getUserSetup error:', error);
    }

    return data || null;
  },

  /**
   * Save (upsert) user setup preferences.
   * Works for both initial creation and subsequent updates.
   */
  async saveUserSetup(
    userId: string,
    familyId: string,
    prefs: { members: string[]; predefinedExpenses: string[]; setupComplete: boolean; memberUpiIds?: Record<string, string> }
  ) {
    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: userId,
          family_id: familyId,
          members: prefs.members,
          predefined_expenses: prefs.predefinedExpenses,
          setup_complete: prefs.setupComplete,
          member_upi_ids: prefs.memberUpiIds ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,family_id' }
      );

    if (error) {
      console.error('saveUserSetup error:', error);
      throw error;
    }
  },

  /**
   * Fetch the merged member→UPI ID map for a family.
   * Scans all user_preferences rows for this family_id and merges
   * member_upi_ids, so any admin who ran setup contributes their saved map.
   */
  async getMemberUpiIds(familyId: string): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('member_upi_ids')
      .eq('family_id', familyId);

    if (error) {
      console.error('getMemberUpiIds error:', error);
      return {};
    }

    // Merge all rows — later rows overwrite earlier ones for the same member key
    const merged: Record<string, string> = {};
    (data || []).forEach((row) => {
      if (row.member_upi_ids && typeof row.member_upi_ids === 'object') {
        Object.assign(merged, row.member_upi_ids);
      }
    });
    return merged;
  },

  /**
   * Update the logged-in user's own UPI ID in user_preferences.
   * Also patches their entry inside the shared member_upi_ids map.
   */
  async saveUserUpiId(
    userId: string,
    familyId: string,
    memberName: string,
    upiId: string
  ) {
    // First read the existing map so we can patch just one key
    const existing = await this.getMemberUpiIds(familyId);
    const updatedMap = { ...existing, [memberName]: upiId };

    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: userId,
          family_id: familyId,
          upi_id: upiId,
          member_upi_ids: updatedMap,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,family_id' }
      );

    if (error) {
      console.error('saveUserUpiId error:', error);
      throw error;
    }
    return updatedMap;
  },

  /**
   * Check if a family already has shop data in the database.
   * Used to determine if an existing user should be auto-migrated
   * (skip SetupPage) vs shown the SetupPage for fresh setup.
   */
  async checkExistingFamilyData(familyId: string) {
    const { count, error } = await supabase
      .from('shops')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', familyId);

    if (error) {
      console.error('checkExistingFamilyData error:', error);
      return false;
    }
    // If any shops exist for this family, they are an existing user
    return count !== null && count > 0;
  },

  /**
   * Fetch the shops from the most recent month that has shop configurations.
   * @param excludeMonth - optional month to exclude (prevents self-referential seeding)
   */
  async getLatestShops(familyId: string, excludeMonth?: string) {
    let query = supabase
      .from('shops')
      .select('month')
      .eq('family_id', familyId)
      .order('month', { ascending: false })
      .limit(1);

    if (excludeMonth) {
      query = query.neq('month', excludeMonth);
    }

    const { data: latestRecords, error: err1 } = await query;

    if (err1 || !latestRecords || latestRecords.length === 0) {
      if (err1) console.error('Error fetching latest shop month:', err1);
      return [];
    }

    const latestMonth = latestRecords[0].month;

    const { data: shops, error: err2 } = await supabase
      .from('shops')
      .select('*')
      .eq('month', latestMonth)
      .eq('family_id', familyId);

    if (err2) {
      console.error('Error fetching shops for latest month:', err2);
      return [];
    }

    return shops || [];
  },
};
