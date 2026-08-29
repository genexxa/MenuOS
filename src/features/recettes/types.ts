export type Categorie = 'dejeuner' | 'diner' | 'souper' | 'collation'
export type Saison = 'printemps' | 'ete' | 'automne' | 'hiver' | 'toute_annee'
export type UniteBase = 'g' | 'ml' | 'unite'

export const CATEGORIES: { value: Categorie; label: string }[] = [
  { value: 'dejeuner', label: 'Déjeuner' },
  { value: 'diner', label: 'Dîner' },
  { value: 'souper', label: 'Souper' },
  { value: 'collation', label: 'Collation' },
]

export const SAISONS: { value: Saison; label: string }[] = [
  { value: 'toute_annee', label: 'Toute l’année' },
  { value: 'printemps', label: 'Printemps' },
  { value: 'ete', label: 'Été' },
  { value: 'automne', label: 'Automne' },
  { value: 'hiver', label: 'Hiver' },
]

export const UNITES = [
  'g',
  'kg',
  'ml',
  'l',
  'c_a_the',
  'c_a_soupe',
  'tasse',
  'pincee',
  'unite',
  'tranche',
  'gousse',
] as const

export const UNITE_LABELS: Record<string, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'L',
  c_a_the: 'c. à thé',
  c_a_soupe: 'c. à soupe',
  tasse: 'tasse',
  pincee: 'pincée',
  unite: 'unité',
  tranche: 'tranche',
  gousse: 'gousse',
}

export interface StoreSection {
  id: string
  nom: string
  ordre: number
}

export interface Ingredient {
  id: string
  nom: string
  unite_base: UniteBase
  rayon_id: string | null
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  ingredient_id: string
  quantite: number
  unite: string
  ordre: number
  optionnel: boolean
  note: string | null
  ingredient: Ingredient
}

export interface RecipeIngredientInput {
  ingredient_id: string
  quantite: number
  unite: string
  optionnel: boolean
  note: string | null
}

export interface Recipe {
  id: string
  household_id: string
  nom: string
  description: string | null
  portions_base: number
  temps_prepa_minutes: number
  temps_cuisson_minutes: number
  temps_total_minutes: number
  categorie: Categorie
  tags: string[]
  etapes_preparation: string[]
  transportable: boolean
  batch_cooking_friendly: boolean
  proteines_par_portion: number | null
  calories_par_portion: number | null
  saison: Saison[]
  cout_estime: number | null
  source_url: string | null
  actif: boolean
  created_at: string
  updated_at: string
}

export interface RecipeWithIngredients extends Recipe {
  recipe_ingredients: RecipeIngredient[]
}

export interface RecipeFormValues {
  nom: string
  description: string
  portions_base: number
  temps_prepa_minutes: number
  temps_cuisson_minutes: number
  categorie: Categorie
  tags: string[]
  etapes_preparation: string[]
  transportable: boolean
  batch_cooking_friendly: boolean
  proteines_par_portion: number | null
  calories_par_portion: number | null
  saison: Saison[]
  cout_estime: number | null
  source_url: string | null
  ingredients: RecipeIngredientInput[]
}

export interface RecipeFilters {
  search: string
  categorie: Categorie | 'toutes'
  transportable: boolean
}

export interface ImportedIngredient {
  nom: string
  quantite: number
  unite: string
  matched_ingredient_id: string | null
  matched_ingredient_nom: string | null
  matched_unite_base: UniteBase | null
}

export interface ImportedRecipe {
  nom: string
  description: string | null
  portions_base: number
  temps_prepa_minutes: number
  temps_cuisson_minutes: number
  categorie: Categorie
  tags: string[]
  etapes_preparation: string[]
  transportable: boolean
  batch_cooking_friendly: boolean
  proteines_par_portion: number | null
  calories_par_portion: number | null
  saison: Saison[]
  cout_estime: number | null
  source_url: string | null
  ingredients: ImportedIngredient[]
}
