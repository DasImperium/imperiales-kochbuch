export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_root: boolean
          name: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_root?: boolean
          name: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_root?: boolean
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          read_at: string | null
          recipient_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          recipe_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          recipe_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          recipe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          recipe_id: string
          requester_id: string
          resolved_at: string | null
          resolver_id: string | null
          resolver_note: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          recipe_id: string
          requester_id: string
          resolved_at?: string | null
          resolver_id?: string | null
          resolver_note?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          recipe_id?: string
          requester_id?: string
          resolved_at?: string | null
          resolver_id?: string | null
          resolver_note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_recipes: {
        Row: {
          created_at: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          min_stock: number
          name: string
          owner_id: string
          safety_stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          owner_id: string
          safety_stock?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          owner_id?: string
          safety_stock?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      list_shares: {
        Row: {
          created_at: string
          id: string
          list_kind: string
          owner_id: string
          shared_with: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_kind: string
          owner_id: string
          shared_with: string
        }
        Update: {
          created_at?: string
          id?: string
          list_kind?: string
          owner_id?: string
          shared_with?: string
        }
        Relationships: []
      }
      list_snapshots: {
        Row: {
          created_at: string
          data: Json
          id: string
          list_kind: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          list_kind: string
          owner_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          list_kind?: string
          owner_id?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          created_at: string
          default_servings: number
          id: string
          menu_id: string
          position: number
          recipe_id: string
        }
        Insert: {
          created_at?: string
          default_servings?: number
          id?: string
          menu_id: string
          position?: number
          recipe_id: string
        }
        Update: {
          created_at?: string
          default_servings?: number
          id?: string
          menu_id?: string
          position?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_scalings: {
        Row: {
          created_at: string
          id: string
          menu_id: string
          name: string
          servings_map: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_id: string
          name: string
          servings_map?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_id?: string
          name?: string
          servings_map?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_scalings_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          group_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          group_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          group_name?: string | null
          id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          recipe_id: string
          stars: number
          user_id: string
        }
        Insert: {
          created_at?: string
          recipe_id: string
          stars: number
          user_id: string
        }
        Update: {
          created_at?: string
          recipe_id?: string
          stars?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          author_id: string
          category_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by_tier: number | null
          deleted_by_user: string | null
          description: string | null
          forced_visible: boolean
          id: string
          image_url: string | null
          ingredients: string | null
          instructions: string | null
          is_draft: boolean
          parent_recipe_id: string | null
          protection_tier: number
          servings: number
          servings_unit: string
          tags: string[]
          time_required: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_tier?: number | null
          deleted_by_user?: string | null
          description?: string | null
          forced_visible?: boolean
          id?: string
          image_url?: string | null
          ingredients?: string | null
          instructions?: string | null
          is_draft?: boolean
          parent_recipe_id?: string | null
          protection_tier?: number
          servings?: number
          servings_unit?: string
          tags?: string[]
          time_required?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_tier?: number | null
          deleted_by_user?: string | null
          description?: string | null
          forced_visible?: boolean
          id?: string
          image_url?: string | null
          ingredients?: string | null
          instructions?: string | null
          is_draft?: boolean
          parent_recipe_id?: string | null
          protection_tier?: number
          servings?: number
          servings_unit?: string
          tags?: string[]
          time_required?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_parent_recipe_id_fkey"
            columns: ["parent_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          amount: number
          checked: boolean
          created_at: string
          id: string
          name: string
          owner_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          amount?: number
          checked?: boolean
          created_at?: string
          id?: string
          name: string
          owner_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          checked?: boolean
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_recipe_tag: {
        Args: { _recipe_id: string; _tag: string }
        Returns: undefined
      }
      group_member_ids: { Args: { _uid: string }; Returns: string[] }
      has_list_access: {
        Args: { _kind: string; _owner_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_superadmin_user: { Args: { _user_id: string }; Returns: boolean }
      remove_recipe_tag: {
        Args: { _recipe_id: string; _tag: string }
        Returns: undefined
      }
      role_tier: { Args: { _user_id: string }; Returns: number }
      same_group: { Args: { _a: string; _b: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "superadmin" | "imperator"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "superadmin", "imperator"],
    },
  },
} as const
