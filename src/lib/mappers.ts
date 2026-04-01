import type { Database } from "./database.types";
import type { BankAccount, Transaction, FutureLaunch, Category } from "./types";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type FutureLaunchRow = Database["public"]["Tables"]["future_launches"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export type CategoryMap = Map<string, { name: string; color: string }>;

export function buildCategoryMap(categories: CategoryRow[]): CategoryMap {
  const map = new Map<string, { name: string; color: string }>();
  for (const c of categories) {
    map.set(c.id, { name: c.name, color: c.color });
  }
  return map;
}

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    type: row.type as "income" | "expense" | "both",
  };
}

export function mapAccount(row: AccountRow): BankAccount {
  return {
    id: row.id,
    name: row.name,
    bank: row.bank,
    balance: Number(row.balance),
    color: row.color,
    connected: row.connected,
  };
}

export function mapTransaction(row: TransactionRow, catMap: CategoryMap): Transaction {
  const cat = row.category_id ? catMap.get(row.category_id) : null;
  const amount = Number(row.amount);
  return {
    id: row.id,
    description: row.description,
    amount: row.type === "expense" ? -Math.abs(amount) : Math.abs(amount),
    date: row.date,
    category: cat?.name ?? "Sem categoria",
    categoryColor: cat?.color ?? "#6B7280",
    categoryId: row.category_id,
    accountId: row.account_id,
    type: row.type as "income" | "expense",
  };
}

export function mapFutureLaunch(row: FutureLaunchRow, catMap: CategoryMap): FutureLaunch {
  const cat = row.category_id ? catMap.get(row.category_id) : null;
  const amount = Number(row.amount);
  return {
    id: row.id,
    description: row.description,
    amount: row.type === "expense" ? -Math.abs(amount) : Math.abs(amount),
    dueDate: row.due_date,
    category: cat?.name ?? "Sem categoria",
    categoryColor: cat?.color ?? "#6B7280",
    categoryId: row.category_id,
    type: row.type as "income" | "expense",
    recurring: row.recurring,
    paid: row.paid,
  };
}
