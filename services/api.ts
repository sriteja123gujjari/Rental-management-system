
/**
 * MOCK API SERVICE
 * Simulates a Node.js/Express backend using localStorage.
 * This ensures the application is functional in a frontend-only environment
 * while preserving the "Full Stack" shared-data logic.
 */

const STORAGE_KEYS = {
  USERS: 'rms_mock_users',
  MONTHLY_DATA: 'rms_mock_monthly_data'
};

// Helper to simulate network delay
const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

const getDb = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
const saveDb = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

export const api = {
  login: async (email, password) => {
    await delay();
    const users = getDb(STORAGE_KEYS.USERS);
    const user = users.find(u => u.email === email);
    
    // In a real backend, we'd use bcrypt. Here we just check the string.
    if (!user || user.password !== password) {
      throw new Error('Invalid email or password');
    }

    const mockToken = `mock-jwt-token-${user.id}`;
    return { 
      token: mockToken, 
      user: { id: user.id, name: user.name, familyId: user.familyId } 
    };
  },

  register: async (userData) => {
    await delay();
    const users = getDb(STORAGE_KEYS.USERS);
    
    if (users.find(u => u.email === userData.email)) {
      throw new Error('Email already registered');
    }

    const newUser = {
      ...userData,
      id: Math.random().toString(36).substr(2, 9),
      familyId: userData.familyId.toUpperCase(),
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveDb(STORAGE_KEYS.USERS, users);
    return { message: 'Registration successful' };
  },

  fetchMonthData: async (month) => {
    await delay(300);
    const auth = JSON.parse(localStorage.getItem('rentManager_auth') || '{}');
    const familyId = auth.user?.familyId;
    if (!familyId) throw new Error('Unauthorized');

    const allData = getDb(STORAGE_KEYS.MONTHLY_DATA);
    let data = allData.find(d => d.familyId === familyId && d.month === month);

    if (!data) {
      // Logic from server.js: Copy shops from latest month if available
      const prevData = allData
        .filter(d => d.familyId === familyId)
        .sort((a, b) => b.month.localeCompare(a.month))[0];

      data = {
        familyId,
        month,
        shops: prevData ? prevData.shops : [],
        rentRecords: [],
        expenses: [],
        updatedAt: new Date().toISOString()
      };
      allData.push(data);
      saveDb(STORAGE_KEYS.MONTHLY_DATA, allData);
    }
    return data;
  },

  addShop: async (month, shop) => {
    await delay(200);
    const auth = JSON.parse(localStorage.getItem('rentManager_auth') || '{}');
    const familyId = auth.user?.familyId;
    
    const allData = getDb(STORAGE_KEYS.MONTHLY_DATA);
    const index = allData.findIndex(d => d.familyId === familyId && d.month === month);
    
    if (index > -1) {
      allData[index].shops.push(shop);
      allData[index].updatedAt = new Date().toISOString();
      saveDb(STORAGE_KEYS.MONTHLY_DATA, allData);
    }
    return { message: 'Shop added' };
  },

  updateShop: async (month, shopId, update) => {
    await delay(200);
    const auth = JSON.parse(localStorage.getItem('rentManager_auth') || '{}');
    const familyId = auth.user?.familyId;
    
    const allData = getDb(STORAGE_KEYS.MONTHLY_DATA);
    const data = allData.find(d => d.familyId === familyId && d.month === month);
    
    if (data) {
      const shop = data.shops.find(s => s.id === shopId);
      if (shop) {
        Object.assign(shop, update);
        data.updatedAt = new Date().toISOString();
        saveDb(STORAGE_KEYS.MONTHLY_DATA, allData);
      }
    }
    return { message: 'Shop updated' };
  },

  deleteShop: async (month, shopId) => {
    await delay(200);
    const auth = JSON.parse(localStorage.getItem('rentManager_auth') || '{}');
    const familyId = auth.user?.familyId;
    
    const allData = getDb(STORAGE_KEYS.MONTHLY_DATA);
    const data = allData.find(d => d.familyId === familyId && d.month === month);
    
    if (data) {
      data.shops = data.shops.filter(s => s.id !== shopId);
      data.updatedAt = new Date().toISOString();
      saveDb(STORAGE_KEYS.MONTHLY_DATA, allData);
    }
    return { message: 'Shop deleted' };
  },

  toggleRent: async (month, shopId, baseRent, member) => {
    await delay(200);
    const auth = JSON.parse(localStorage.getItem('rentManager_auth') || '{}');
    const familyId = auth.user?.familyId;
    
    const allData = getDb(STORAGE_KEYS.MONTHLY_DATA);
    const data = allData.find(d => d.familyId === familyId && d.month === month);
    
    if (data) {
      const existingIndex = data.rentRecords.findIndex(r => r.shopId === shopId);
      if (existingIndex > -1) {
        const isPaid = data.rentRecords[existingIndex].status === 'Paid';
        if (isPaid) {
          data.rentRecords.splice(existingIndex, 1);
        } else {
          data.rentRecords[existingIndex].status = 'Paid';
          data.rentRecords[existingIndex].amountPaid = baseRent;
          data.rentRecords[existingIndex].collectedBy = member;
        }
      } else {
        data.rentRecords.push({
          shopId,
          status: 'Paid',
          amountPaid: baseRent,
          collectedBy: member,
          timestamp: new Date().toISOString()
        });
      }
      data.updatedAt = new Date().toISOString();
      saveDb(STORAGE_KEYS.MONTHLY_DATA, allData);
      return data;
    }
    throw new Error('Data not found');
  },

  addExpense: async (month, expense) => {
    await delay(200);
    const auth = JSON.parse(localStorage.getItem('rentManager_auth') || '{}');
    const familyId = auth.user?.familyId;
    
    const allData = getDb(STORAGE_KEYS.MONTHLY_DATA);
    const data = allData.find(d => d.familyId === familyId && d.month === month);
    
    if (data) {
      data.expenses.push(expense);
      data.updatedAt = new Date().toISOString();
      saveDb(STORAGE_KEYS.MONTHLY_DATA, allData);
    }
    return { message: 'Expense added' };
  },

  deleteExpense: async (month, expId) => {
    await delay(200);
    const auth = JSON.parse(localStorage.getItem('rentManager_auth') || '{}');
    const familyId = auth.user?.familyId;
    
    const allData = getDb(STORAGE_KEYS.MONTHLY_DATA);
    const data = allData.find(d => d.familyId === familyId && d.month === month);
    
    if (data) {
      data.expenses = data.expenses.filter(e => e.id !== expId);
      data.updatedAt = new Date().toISOString();
      saveDb(STORAGE_KEYS.MONTHLY_DATA, allData);
    }
    return { message: 'Expense deleted' };
  }
};
