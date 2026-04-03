export interface BankAccount {
  id: string;
  name: string;
  bank: string;
  balance: number;
  color: string;
  connected: boolean;
  pluggyItemId: string | null;
  pluggyAccountId: string | null;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  categoryColor: string;
  categoryId: string | null;
  accountId: string;
  type: "income" | "expense";
}

export interface FutureLaunch {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  category: string;
  categoryColor: string;
  categoryId: string | null;
  type: "income" | "expense";
  recurring: boolean;
  paid: boolean;
  groupId: string | null;
  parcelNumber: number | null;
  totalParcels: number | null;
  cardId: string | null;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  type: "income" | "expense" | "both";
}

export interface CreditCard {
  id: string;
  name: string;
  closingDay: number;
  dueDay: number;
  color: string;
  limit: number;
}
