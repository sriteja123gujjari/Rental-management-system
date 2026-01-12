
import { MonthlyRecord, Expense } from '../types';

const STORAGE_KEYS = {
  RECORDS: 'rms_monthly_records',
  USERS: 'rms_users',
};

export const db = {
  getRecordsByFamily: (familyId: string): MonthlyRecord[] => {
    const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
    const records: MonthlyRecord[] = data ? JSON.parse(data) : [];
    return records.filter(r => r.familyId === familyId);
  },

  getRecord: (familyId: string, month: string): MonthlyRecord | null => {
    const records = db.getRecordsByFamily(familyId);
    return records.find(r => r.month === month) || null;
  },

  saveRecord: (record: MonthlyRecord): void => {
    const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
    let records: MonthlyRecord[] = data ? JSON.parse(data) : [];
    
    const index = records.findIndex(r => r.familyId === record.familyId && r.month === record.month);
    if (index > -1) {
      records[index] = record;
    } else {
      records.push(record);
    }
    
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  },

  createInitialRecord: (familyId: string, month: string, userName: string): MonthlyRecord => {
    const newRecord: MonthlyRecord = {
      id: Math.random().toString(36).substr(2, 9),
      familyId,
      month,
      totalRent: 0,
      expenses: [],
      updatedBy: userName,
      updatedAt: new Date().toISOString(),
    };
    db.saveRecord(newRecord);
    return newRecord;
  }
};
