export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          type: "income" | "expense" | "both";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          type?: "income" | "expense" | "both";
          created_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
          type?: "income" | "expense" | "both";
        };
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          bank: string;
          balance: number;
          color: string;
          connected: boolean;
          pluggy_item_id: string | null;
          pluggy_account_id: string | null;
          last_sync_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          bank: string;
          balance?: number;
          color?: string;
          connected?: boolean;
          pluggy_item_id?: string | null;
          pluggy_account_id?: string | null;
        };
        Update: {
          name?: string;
          bank?: string;
          balance?: number;
          color?: string;
          connected?: boolean;
          pluggy_item_id?: string | null;
          pluggy_account_id?: string | null;
          last_sync_at?: string | null;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          category_id: string | null;
          description: string;
          amount: number;
          type: "income" | "expense";
          date: string;
          pluggy_transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          category_id?: string | null;
          description: string;
          amount: number;
          type: "income" | "expense";
          date?: string;
          pluggy_transaction_id?: string | null;
        };
        Update: {
          category_id?: string | null;
          description?: string;
          amount?: number;
          type?: "income" | "expense";
          date?: string;
        };
      };
      future_launches: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          description: string;
          amount: number;
          type: "income" | "expense";
          due_date: string;
          recurring: boolean;
          paid: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          description: string;
          amount: number;
          type: "income" | "expense";
          due_date: string;
          recurring?: boolean;
          paid?: boolean;
        };
        Update: {
          category_id?: string | null;
          description?: string;
          amount?: number;
          type?: "income" | "expense";
          due_date?: string;
          recurring?: boolean;
          paid?: boolean;
        };
      };
      category_rules: {
        Row: {
          id: string;
          user_id: string;
          pattern: string;
          category_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pattern: string;
          category_id: string;
        };
        Update: {
          pattern?: string;
          category_id?: string;
        };
      };
    };
  };
}
