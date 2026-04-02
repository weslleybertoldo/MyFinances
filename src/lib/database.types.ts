export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          type?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          type?: string;
          created_at?: string;
        };
        Relationships: [];
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
          last_sync_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          bank?: string;
          balance?: number;
          color?: string;
          connected?: boolean;
          pluggy_item_id?: string | null;
          pluggy_account_id?: string | null;
          last_sync_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          category_id: string | null;
          description: string;
          amount: number;
          type: string;
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
          type: string;
          date?: string;
          pluggy_transaction_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          category_id?: string | null;
          description?: string;
          amount?: number;
          type?: string;
          date?: string;
          pluggy_transaction_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      future_launches: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          description: string;
          amount: number;
          type: string;
          due_date: string;
          recurring: boolean;
          paid: boolean;
          group_id: string | null;
          parcel_number: number | null;
          total_parcels: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          description: string;
          amount: number;
          type: string;
          due_date: string;
          recurring?: boolean;
          paid?: boolean;
          group_id?: string | null;
          parcel_number?: number | null;
          total_parcels?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          description?: string;
          amount?: number;
          type?: string;
          due_date?: string;
          recurring?: boolean;
          paid?: boolean;
          group_id?: string | null;
          parcel_number?: number | null;
          total_parcels?: number | null;
          created_at?: string;
        };
        Relationships: [];
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
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          pattern?: string;
          category_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
