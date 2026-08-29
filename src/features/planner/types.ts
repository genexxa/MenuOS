import type { Categorie } from '../recettes/types'

export type Moment = Categorie
export type EntryStatut = 'planifie' | 'cuisine' | 'saute'
export type PlanStatut = 'brouillon' | 'actif' | 'archive'

export const MOMENTS: { value: Moment; label: string }[] = [
  { value: 'dejeuner', label: 'Déjeuner' },
  { value: 'diner', label: 'Dîner' },
  { value: 'souper', label: 'Souper' },
  { value: 'collation', label: 'Collation' },
]

export const JOURS_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export interface MealPlan {
  id: string
  household_id: string
  semaine_debut: string
  statut: PlanStatut
}

export interface EntryRecipe {
  id: string
  nom: string
  portions_base: number
  transportable: boolean
}

export interface EntryLeftover {
  id: string
  portions_disponibles: number
  date_production: string
  recipe: { id: string; nom: string } | null
}

export interface EntryMembre {
  id: string
  nom: string
  couleur_affichage: string
}

export interface MealPlanEntry {
  id: string
  meal_plan_id: string
  date: string
  moment: Moment
  recipe_id: string | null
  leftover_id: string | null
  texte_libre: string | null
  membre_id: string | null
  portions_prevues: number
  convives: number | null
  statut: EntryStatut
  notes: string | null
  recipe: EntryRecipe | null
  leftover: EntryLeftover | null
  membre: EntryMembre | null
}

export type PrepTaskType = 'decongeler' | 'mariner' | 'tremper' | 'autre'
export type PrepTaskStatut = 'a_faire' | 'fait'

export const PREP_TASK_TYPES: { value: PrepTaskType; label: string }[] = [
  { value: 'decongeler', label: 'Décongeler' },
  { value: 'mariner', label: 'Mariner' },
  { value: 'tremper', label: 'Tremper' },
  { value: 'autre', label: 'Autre' },
]

export interface PrepTask {
  id: string
  household_id: string
  meal_plan_entry_id: string
  type: PrepTaskType
  date_a_faire: string
  statut: PrepTaskStatut
  note: string | null
}

export interface AvailableLeftover {
  id: string
  portions_disponibles: number
  date_production: string
  recipe: { id: string; nom: string } | null
}

export type EntryKind = 'recette' | 'reste' | 'libre'

export interface EntryFormValues {
  date: string
  moment: Moment
  kind: EntryKind
  recipe_id: string | null
  leftover_id: string | null
  texte_libre: string | null
  membre_id: string | null
  portions_prevues: number
  convives: number | null
  notes: string | null
}
