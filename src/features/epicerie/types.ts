import type { Ingredient, StoreSection, UniteBase } from '../recettes/types'

export type Emplacement = 'frigo' | 'congelateur' | 'garde_manger'

export const EMPLACEMENTS: { value: Emplacement; label: string }[] = [
  { value: 'frigo', label: 'Frigo' },
  { value: 'congelateur', label: 'Congélateur' },
  { value: 'garde_manger', label: 'Garde-manger' },
]

export interface PantryItem {
  id: string
  ingredient_id: string
  ingredient: Ingredient
  quantite: number
  unite: string
  emplacement: Emplacement
  date_peremption: string | null
}

export interface UnitConversion {
  unite: string
  unite_base: UniteBase
  facteur: number
}

export type GroceryListStatut = 'brouillon' | 'en_cours' | 'complete'

export interface GroceryList {
  id: string
  household_id: string
  meal_plan_id: string | null
  statut: GroceryListStatut
}

export interface GroceryListItem {
  id: string
  grocery_list_id: string
  ingredient_id: string | null
  nom_libre: string | null
  quantite: number
  unite: string
  rayon_id: string | null
  coche: boolean
  ajoute_manuellement: boolean
  cout_estime: number | null
  ingredient: { id: string; nom: string } | null
  rayon: StoreSection | null
}
