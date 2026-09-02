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
          last_sync_at: string | null;
          ofx_bank_id: string | null;
          ofx_acct_id: string | null;
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
          last_sync_at?: string | null;
          ofx_bank_id?: string | null;
          ofx_acct_id?: string | null;
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
          last_sync_at?: string | null;
          ofx_bank_id?: string | null;
          ofx_acct_id?: string | null;
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
          import_key: string | null;
          import_source: string | null;
          import_memo: string | null;
          custom_name: string | null;
          notes: string | null;
          ofx_fitid: string | null;
          bank_import_id: string | null;
          statement_seq: number | null;
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
          import_key?: string | null;
          import_source?: string | null;
          import_memo?: string | null;
          custom_name?: string | null;
          notes?: string | null;
          ofx_fitid?: string | null;
          bank_import_id?: string | null;
          statement_seq?: number | null;
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
          import_key?: string | null;
          import_source?: string | null;
          import_memo?: string | null;
          custom_name?: string | null;
          notes?: string | null;
          ofx_fitid?: string | null;
          bank_import_id?: string | null;
          statement_seq?: number | null;
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
          card_id: string | null;
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
          card_id?: string | null;
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
          card_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      card_invoice_payments: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          month: string;
          amount: number;
          paid_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          month: string;
          amount: number;
          paid_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          card_id?: string;
          month?: string;
          amount?: number;
          paid_at?: string;
        };
        Relationships: [];
      };
      credit_cards: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          closing_day: number;
          due_day: number;
          color: string;
          card_limit: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          closing_day?: number;
          due_day?: number;
          color?: string;
          card_limit?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          closing_day?: number;
          due_day?: number;
          color?: string;
          card_limit?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      bank_imports: {
        Row: {
          id: string;
          user_id: string;
          account_id: string | null;
          source: string;
          file_name: string | null;
          period_start: string | null;
          period_end: string | null;
          tx_total: number;
          tx_imported: number;
          tx_skipped: number;
          balance: number | null;
          gmail_message_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id?: string | null;
          source: string;
          file_name?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          tx_total?: number;
          tx_imported?: number;
          tx_skipped?: number;
          balance?: number | null;
          gmail_message_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string | null;
          source?: string;
          file_name?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          tx_total?: number;
          tx_imported?: number;
          tx_skipped?: number;
          balance?: number | null;
          gmail_message_id?: string | null;
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
      investment_assets: {
        Row: {
          id: string;
          user_id: string;
          ticker: string;
          name: string | null;
          asset_class: string;
          score: number;
          tesouro_tipo: string | null;
          tesouro_vencimento: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ticker: string;
          name?: string | null;
          asset_class: string;
          score?: number;
          tesouro_tipo?: string | null;
          tesouro_vencimento?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          ticker?: string;
          name?: string | null;
          asset_class?: string;
          score?: number;
          tesouro_tipo?: string | null;
          tesouro_vencimento?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      investment_transactions: {
        Row: {
          id: string;
          user_id: string;
          asset_id: string;
          kind: string;
          date: string;
          quantity: number;
          unit_price: number;
          total: number;
          notes: string | null;
          source: string;
          external_key: string | null;
          ignored: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          asset_id: string;
          kind: string;
          date: string;
          quantity?: number;
          unit_price?: number;
          total: number;
          notes?: string | null;
          source?: string;
          external_key?: string | null;
          ignored?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          asset_id?: string;
          kind?: string;
          date?: string;
          quantity?: number;
          unit_price?: number;
          total?: number;
          notes?: string | null;
          source?: string;
          external_key?: string | null;
          ignored?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      investment_quotes: {
        Row: {
          ticker: string;
          asset_class: string | null;
          name: string | null;
          price: number | null;
          price_at: string | null;
          change_pct: number | null;
          source: string | null;
          history: Json;
          dividends: Json;
          error: string | null;
          updated_at: string;
        };
        Insert: {
          ticker: string;
          asset_class?: string | null;
          name?: string | null;
          price?: number | null;
          price_at?: string | null;
          change_pct?: number | null;
          source?: string | null;
          history?: Json;
          dividends?: Json;
          error?: string | null;
          updated_at?: string;
        };
        Update: {
          ticker?: string;
          asset_class?: string | null;
          name?: string | null;
          price?: number | null;
          price_at?: string | null;
          change_pct?: number | null;
          source?: string | null;
          history?: Json;
          dividends?: Json;
          error?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      investment_class_targets: {
        Row: {
          user_id: string;
          asset_class: string;
          target_pct: number;
        };
        Insert: {
          user_id: string;
          asset_class: string;
          target_pct?: number;
        };
        Update: {
          user_id?: string;
          asset_class?: string;
          target_pct?: number;
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
