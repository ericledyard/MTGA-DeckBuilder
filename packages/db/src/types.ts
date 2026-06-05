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
      card_legalities: {
        Row: {
          format: Database["public"]["Enums"]["mtg_format"]
          oracle_id: string
          status: Database["public"]["Enums"]["legality_status"]
        }
        Insert: {
          format: Database["public"]["Enums"]["mtg_format"]
          oracle_id: string
          status: Database["public"]["Enums"]["legality_status"]
        }
        Update: {
          format?: Database["public"]["Enums"]["mtg_format"]
          oracle_id?: string
          status?: Database["public"]["Enums"]["legality_status"]
        }
        Relationships: []
      }
      card_rulings: {
        Row: {
          comment: string
          id: string
          oracle_id: string
          published_at: string | null
          source: string
        }
        Insert: {
          comment: string
          id?: string
          oracle_id: string
          published_at?: string | null
          source: string
        }
        Update: {
          comment?: string
          id?: string
          oracle_id?: string
          published_at?: string | null
          source?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          artist: string | null
          available_on_arena: boolean
          cmc: number
          collector_number: string
          color_identity: string[]
          colors: string[]
          digital: boolean
          flavor_text: string | null
          id: string
          image_uri_art_crop: string | null
          image_uri_large: string | null
          image_uri_normal: string | null
          is_alchemy: boolean
          keywords: string[]
          loyalty: string | null
          mana_cost: string | null
          name: string
          oracle_id: string
          oracle_text: string | null
          power: string | null
          rarity: Database["public"]["Enums"]["card_rarity"]
          scryfall_id: string
          scryfall_uri: string
          set_code: string
          set_name: string
          toughness: string | null
          type_line: string
          updated_at: string
        }
        Insert: {
          artist?: string | null
          available_on_arena?: boolean
          cmc?: number
          collector_number: string
          color_identity?: string[]
          colors?: string[]
          digital?: boolean
          flavor_text?: string | null
          id?: string
          image_uri_art_crop?: string | null
          image_uri_large?: string | null
          image_uri_normal?: string | null
          is_alchemy?: boolean
          keywords?: string[]
          loyalty?: string | null
          mana_cost?: string | null
          name: string
          oracle_id: string
          oracle_text?: string | null
          power?: string | null
          rarity: Database["public"]["Enums"]["card_rarity"]
          scryfall_id: string
          scryfall_uri: string
          set_code: string
          set_name: string
          toughness?: string | null
          type_line: string
          updated_at?: string
        }
        Update: {
          artist?: string | null
          available_on_arena?: boolean
          cmc?: number
          collector_number?: string
          color_identity?: string[]
          colors?: string[]
          digital?: boolean
          flavor_text?: string | null
          id?: string
          image_uri_art_crop?: string | null
          image_uri_large?: string | null
          image_uri_normal?: string | null
          is_alchemy?: boolean
          keywords?: string[]
          loyalty?: string | null
          mana_cost?: string | null
          name?: string
          oracle_id?: string
          oracle_text?: string | null
          power?: string | null
          rarity?: Database["public"]["Enums"]["card_rarity"]
          scryfall_id?: string
          scryfall_uri?: string
          set_code?: string
          set_name?: string
          toughness?: string | null
          type_line?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_set_code_fkey"
            columns: ["set_code"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["code"]
          },
        ]
      }
      deck_cards: {
        Row: {
          deck_id: string
          is_commander: boolean
          is_companion: boolean
          is_sideboard: boolean
          oracle_id: string
          quantity: number
        }
        Insert: {
          deck_id: string
          is_commander?: boolean
          is_companion?: boolean
          is_sideboard?: boolean
          oracle_id: string
          quantity?: number
        }
        Update: {
          deck_id?: string
          is_commander?: boolean
          is_companion?: boolean
          is_sideboard?: boolean
          oracle_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "deck_cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          cover_card_id: string | null
          created_at: string
          description: string | null
          format: Database["public"]["Enums"]["mtg_format"]
          id: string
          is_public: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_card_id?: string | null
          created_at?: string
          description?: string | null
          format: Database["public"]["Enums"]["mtg_format"]
          id?: string
          is_public?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_card_id?: string | null
          created_at?: string
          description?: string | null
          format?: Database["public"]["Enums"]["mtg_format"]
          id?: string
          is_public?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decks_cover_card_id_fkey"
            columns: ["cover_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      format_banlists: {
        Row: {
          card_name: string
          effective_date: string | null
          format: Database["public"]["Enums"]["mtg_format"]
          oracle_id: string
          restriction_type: Database["public"]["Enums"]["restriction_type"]
        }
        Insert: {
          card_name: string
          effective_date?: string | null
          format: Database["public"]["Enums"]["mtg_format"]
          oracle_id: string
          restriction_type: Database["public"]["Enums"]["restriction_type"]
        }
        Update: {
          card_name?: string
          effective_date?: string | null
          format?: Database["public"]["Enums"]["mtg_format"]
          oracle_id?: string
          restriction_type?: Database["public"]["Enums"]["restriction_type"]
        }
        Relationships: []
      }
      rules_documents: {
        Row: {
          checksum: string
          content_text: string
          document_type: Database["public"]["Enums"]["rules_doc_type"]
          effective_date: string | null
          fetched_at: string
          format: Database["public"]["Enums"]["mtg_format"] | null
          id: string
          source_url: string
        }
        Insert: {
          checksum: string
          content_text: string
          document_type: Database["public"]["Enums"]["rules_doc_type"]
          effective_date?: string | null
          fetched_at?: string
          format?: Database["public"]["Enums"]["mtg_format"] | null
          id?: string
          source_url: string
        }
        Update: {
          checksum?: string
          content_text?: string
          document_type?: Database["public"]["Enums"]["rules_doc_type"]
          effective_date?: string | null
          fetched_at?: string
          format?: Database["public"]["Enums"]["mtg_format"] | null
          id?: string
          source_url?: string
        }
        Relationships: []
      }
      sets: {
        Row: {
          available_on_arena: boolean
          card_count: number | null
          code: string
          icon_svg_uri: string | null
          name: string
          released_at: string | null
          set_type: string
          updated_at: string
        }
        Insert: {
          available_on_arena?: boolean
          card_count?: number | null
          code: string
          icon_svg_uri?: string | null
          name: string
          released_at?: string | null
          set_type: string
          updated_at?: string
        }
        Update: {
          available_on_arena?: boolean
          card_count?: number | null
          code?: string
          icon_svg_uri?: string | null
          name?: string
          released_at?: string | null
          set_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_collections: {
        Row: {
          id: string
          imported_at: string
          imported_from: Database["public"]["Enums"]["import_source"]
          oracle_id: string
          quantity_foil: number
          quantity_regular: number
          user_id: string
        }
        Insert: {
          id?: string
          imported_at?: string
          imported_from?: Database["public"]["Enums"]["import_source"]
          oracle_id: string
          quantity_foil?: number
          quantity_regular?: number
          user_id: string
        }
        Update: {
          id?: string
          imported_at?: string
          imported_from?: Database["public"]["Enums"]["import_source"]
          oracle_id?: string
          quantity_foil?: number
          quantity_regular?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_cards_by_oracle_ids: {
        Args: { p_oracle_ids: string[] }
        Returns: {
          cmc: number
          collector_number: string
          colors: string[]
          image_uri_normal: string
          mana_cost: string
          name: string
          oracle_id: string
          rarity: string
          set_code: string
          type_line: string
        }[]
      }
      lookup_cards_by_names: {
        Args: { p_names: string[] }
        Returns: {
          available_on_arena: boolean
          cmc: number
          colors: string[]
          id: string
          image_uri_normal: string
          mana_cost: string
          name: string
          oracle_id: string
          rarity: Database["public"]["Enums"]["card_rarity"]
          type_line: string
        }[]
      }
      lookup_cards_by_set_collector: {
        Args: { p_collector_numbers: string[]; p_set_codes: string[] }
        Returns: {
          available_on_arena: boolean
          cmc: number
          collector_number: string
          colors: string[]
          id: string
          image_uri_normal: string
          mana_cost: string
          name: string
          oracle_id: string
          rarity: string
          set_code: string
          type_line: string
        }[]
      }
      search_cards: {
        Args: {
          p_arena_only?: boolean
          p_cmc_values?: number[]
          p_colors?: string[]
          p_format?: string
          p_limit?: number
          p_query?: string
          p_rarities?: string[]
          p_set_codes?: string[]
          p_text_query?: string
          p_types?: string[]
        }
        Returns: {
          available_on_arena: boolean
          id: string
          image_uri_art_crop: string
          image_uri_normal: string
          is_alchemy: boolean
          mana_cost: string
          name: string
          oracle_id: string
          rarity: Database["public"]["Enums"]["card_rarity"]
          set_code: string
          set_name: string
          type_line: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      card_rarity:
        | "common"
        | "uncommon"
        | "rare"
        | "mythic"
        | "special"
        | "bonus"
      import_source: "untapped" | "manual" | "scan"
      legality_status:
        | "legal"
        | "not_legal"
        | "banned"
        | "restricted"
        | "suspended"
      mtg_format:
        | "standard"
        | "alchemy"
        | "historic"
        | "brawl"
        | "timeless"
        | "pioneer"
        | "modern"
        | "legacy"
        | "vintage"
        | "commander"
        | "pauper"
      restriction_type: "banned" | "restricted" | "suspended"
      rules_doc_type: "comprehensive" | "banned_list"
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
      card_rarity: ["common", "uncommon", "rare", "mythic", "special", "bonus"],
      import_source: ["untapped", "manual", "scan"],
      legality_status: [
        "legal",
        "not_legal",
        "banned",
        "restricted",
        "suspended",
      ],
      mtg_format: [
        "standard",
        "alchemy",
        "historic",
        "brawl",
        "timeless",
        "pioneer",
        "modern",
        "legacy",
        "vintage",
        "commander",
        "pauper",
      ],
      restriction_type: ["banned", "restricted", "suspended"],
      rules_doc_type: ["comprehensive", "banned_list"],
    },
  },
} as const
