// Placeholder — à régénérer après avoir appliqué les migrations Supabase :
//   supabase gen types typescript --local > src/types/database.types.ts
// Ne pas éditer ce fichier à la main une fois régénéré.
//
// En attendant, une table générique (Row/Insert/Update en Record<string, any>)
// évite que le client Supabase infère `never` sur .insert()/.update() tout en
// gardant le reste de l'app en TypeScript strict.

type GenericTable = {
  Row: Record<string, any>
  Insert: Record<string, any>
  Update: Record<string, any>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      [key: string]: GenericTable
    }
    Views: {
      [key: string]: {
        Row: Record<string, any>
        Relationships: []
      }
    }
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
