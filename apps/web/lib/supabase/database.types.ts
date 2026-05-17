// ============================================
// Auto-generated TypeScript types matching Supabase schema
// Run `supabase gen types typescript` to regenerate
// ============================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          slug: string;
          tax_id: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          logo_url: string | null;
          subscription_plan: "free" | "starter" | "professional" | "enterprise";
          subscription_expires_at: string | null;
          max_users: number;
          settings: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["companies"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["companies"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          company_id: string;
          full_name: string;
          role: "admin" | "manager" | "warehouse_staff" | "viewer";
          avatar_url: string | null;
          phone: string | null;
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      categories: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          parent_id: string | null;
          color: string | null;
          icon: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["categories"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      products: {
        Row: {
          id: string;
          company_id: string;
          category_id: string | null;
          name: string;
          sku: string;
          barcode: string | null;
          description: string | null;
          unit: string;
          min_stock: number;
          max_stock: number;
          purchase_price: number;
          sale_price: number;
          tax_rate: number;
          weight: number | null;
          dimensions: string | null;
          image_url: string | null;
          is_perishable: boolean;
          default_expiry_days: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["products"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      warehouses: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          address: string | null;
          manager_id: string | null;
          phone: string | null;
          email: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["warehouses"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["warehouses"]["Insert"]>;
      };
      inventory: {
        Row: {
          id: string;
          company_id: string;
          product_id: string;
          warehouse_id: string;
          location_id: string | null;
          lot_number: string | null;
          expiry_date: string | null;
          quantity: number;
          reserved_quantity: number;
          unit_cost: number;
          received_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["inventory"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory"]["Insert"]>;
      };
      stock_movements: {
        Row: {
          id: string;
          company_id: string;
          product_id: string;
          movement_type: "in" | "out" | "transfer" | "adjustment" | "return";
          quantity: number;
          from_warehouse_id: string | null;
          to_warehouse_id: string | null;
          lot_number: string | null;
          expiry_date: string | null;
          unit_cost: number | null;
          reason: string | null;
          reference_number: string | null;
          reference_type: string | null;
          notes: string | null;
          user_id: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["stock_movements"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stock_movements"]["Insert"]>;
      };
      suppliers: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          contact_person: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          tax_id: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["suppliers"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
      };
      customers: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          contact_person: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          tax_id: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["customers"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          company_id: string;
          user_id: string | null;
          type: "low_stock" | "expiry_warning" | "expiry_expired" | "order_update" | "system";
          title: string;
          message: string;
          metadata: Json;
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["notifications"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
    };
    Views: {
      product_stock_summary: {
        Row: {
          product_id: string;
          company_id: string;
          name: string;
          sku: string;
          barcode: string | null;
          category_id: string | null;
          category_name: string | null;
          unit: string;
          min_stock: number;
          max_stock: number;
          purchase_price: number;
          sale_price: number;
          is_active: boolean;
          current_stock: number;
          reserved_stock: number;
          stock_status: "ok" | "low" | "critical" | "overstock" | "out_of_stock";
          created_at: string;
          updated_at: string;
        };
      };
      expiring_lots: {
        Row: {
          id: string;
          company_id: string;
          product_id: string;
          product_name: string;
          product_sku: string;
          lot_number: string | null;
          quantity: number;
          expiry_date: string;
          warehouse_id: string;
          warehouse_name: string;
          received_at: string;
          days_left: number;
        };
      };
    };
  };
}

// Convenience types
export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"];
