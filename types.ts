
export interface User {
  id: string;
  name: string;
  email: string;
  familyId: string; // The collective group ID
  familyMemberIndex: number; // 1, 2, or 3 (The specific family within the group)
  role: 'admin' | 'member';
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  createdAt: string;
}

export interface MonthlyRecord {
  id: string;
  familyId: string;
  month: string; // YYYY-MM
  totalRent: number;
  expenses: Expense[];
  updatedBy: string; // User name
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
}

export interface FamilyBreakdown {
  familyIndex: number;
  rentShare: number;
  expenseShare: number;
  total: number;
}
