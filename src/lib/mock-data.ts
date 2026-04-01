export interface BankAccount {
  id: string;
  name: string;
  bank: string;
  balance: number;
  color: string;
  connected: boolean;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  categoryColor: string;
  accountId: string;
  type: "income" | "expense";
}

export interface FutureLaunch {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  category: string;
  type: "income" | "expense";
  recurring: boolean;
  paid: boolean;
}

export const categories = [
  { name: "Alimentação", color: "hsl(25, 95%, 53%)" },
  { name: "Transporte", color: "hsl(217, 91%, 60%)" },
  { name: "Moradia", color: "hsl(142, 76%, 36%)" },
  { name: "Saúde", color: "hsl(0, 84%, 60%)" },
  { name: "Educação", color: "hsl(262, 83%, 58%)" },
  { name: "Lazer", color: "hsl(330, 81%, 60%)" },
  { name: "Salário", color: "hsl(142, 76%, 36%)" },
  { name: "Freelance", color: "hsl(199, 89%, 48%)" },
  { name: "Investimentos", color: "hsl(47, 96%, 53%)" },
  { name: "Outros", color: "hsl(215, 16%, 47%)" },
];

export const mockAccounts: BankAccount[] = [
  { id: "1", name: "Conta Corrente", bank: "Nubank", balance: 4523.87, color: "hsl(280, 100%, 40%)", connected: true },
  { id: "2", name: "Conta Corrente", bank: "Itaú", balance: 12840.50, color: "hsl(25, 95%, 53%)", connected: true },
  { id: "3", name: "Poupança", bank: "Caixa", balance: 8200.00, color: "hsl(217, 91%, 60%)", connected: false },
];

export const mockTransactions: Transaction[] = [
  { id: "1", description: "Supermercado Extra", amount: -342.56, date: "2026-03-31", category: "Alimentação", categoryColor: "hsl(25, 95%, 53%)", accountId: "1", type: "expense" },
  { id: "2", description: "Uber", amount: -28.90, date: "2026-03-31", category: "Transporte", categoryColor: "hsl(217, 91%, 60%)", accountId: "1", type: "expense" },
  { id: "3", description: "Salário", amount: 8500.00, date: "2026-03-28", category: "Salário", categoryColor: "hsl(142, 76%, 36%)", accountId: "2", type: "income" },
  { id: "4", description: "Aluguel", amount: -2200.00, date: "2026-03-27", category: "Moradia", categoryColor: "hsl(142, 76%, 36%)", accountId: "2", type: "expense" },
  { id: "5", description: "Farmácia", amount: -89.90, date: "2026-03-26", category: "Saúde", categoryColor: "hsl(0, 84%, 60%)", accountId: "1", type: "expense" },
  { id: "6", description: "Netflix", amount: -55.90, date: "2026-03-25", category: "Lazer", categoryColor: "hsl(330, 81%, 60%)", accountId: "1", type: "expense" },
  { id: "7", description: "iFood", amount: -67.80, date: "2026-03-25", category: "Alimentação", categoryColor: "hsl(25, 95%, 53%)", accountId: "1", type: "expense" },
  { id: "8", description: "Freelance Design", amount: 2500.00, date: "2026-03-22", category: "Freelance", categoryColor: "hsl(199, 89%, 48%)", accountId: "1", type: "income" },
  { id: "9", description: "Gasolina", amount: -250.00, date: "2026-03-20", category: "Transporte", categoryColor: "hsl(217, 91%, 60%)", accountId: "2", type: "expense" },
  { id: "10", description: "Curso Udemy", amount: -47.90, date: "2026-03-19", category: "Educação", categoryColor: "hsl(262, 83%, 58%)", accountId: "1", type: "expense" },
];

export const mockFutureLaunches: FutureLaunch[] = [
  { id: "1", description: "Aluguel", amount: -2200, dueDate: "2026-04-05", category: "Moradia", type: "expense", recurring: true, paid: false },
  { id: "2", description: "Salário", amount: 8500, dueDate: "2026-04-28", category: "Salário", type: "income", recurring: true, paid: false },
  { id: "3", description: "Internet", amount: -119.90, dueDate: "2026-04-10", category: "Moradia", type: "expense", recurring: true, paid: false },
  { id: "4", description: "Seguro Carro", amount: -380, dueDate: "2026-04-15", category: "Transporte", type: "expense", recurring: true, paid: false },
  { id: "5", description: "Plano de Saúde", amount: -650, dueDate: "2026-04-12", category: "Saúde", type: "expense", recurring: true, paid: false },
  { id: "6", description: "Freelance Projeto X", amount: 3000, dueDate: "2026-04-20", category: "Freelance", type: "income", recurring: false, paid: false },
];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(dateStr));
}
