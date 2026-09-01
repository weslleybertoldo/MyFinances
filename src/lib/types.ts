export interface BankAccount {
  id: string;
  name: string;
  bank: string;
  balance: number;
  color: string;
}

export interface Transaction {
  id: string;
  /** Nome ORIGINAL (do extrato importado ou o digitado na criacao). Nunca sobrescrito. */
  description: string;
  /** Nome escolhido pelo usuario; null = usa o original. */
  customName: string | null;
  /** O que a lista mostra: customName ?? description. */
  displayName: string;
  /** Observacao livre do usuario. */
  notes: string | null;
  amount: number;
  date: string;
  category: string;
  categoryColor: string;
  categoryId: string | null;
  accountId: string;
  type: "income" | "expense";
  /** Detalhe da importacao (null em transacao manual). */
  importSource: "manual" | "email" | null;
  importMemo: string | null;
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
