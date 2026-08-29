import { supabase } from '../../lib/supabase'
import type { Ingredient, Recipe, RecipeFilters, RecipeFormValues, RecipeWithIngredients, StoreSection } from './types'

const RECIPE_WITH_INGREDIENTS_SELECT = `*, recipe_ingredients (
  id, recipe_id, ingredient_id, quantite, unite, ordre, optionnel, note,
  ingredient:ingredients (id, nom, unite_base, rayon_id)
)`

export async function listRecipes(householdId: string, filters: RecipeFilters): Promise<Recipe[]> {
  let query = supabase
    .from('recipes')
    .select('*')
    .eq('household_id', householdId)
    .eq('actif', true)
    .order('nom')

  if (filters.categorie !== 'toutes') {
    query = query.eq('categorie', filters.categorie)
  }
  if (filters.transportable) {
    query = query.eq('transportable', true)
  }
  if (filters.search.trim()) {
    query = query.ilike('nom', `%${filters.search.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Recipe[]
}

export async function getRecipe(id: string): Promise<RecipeWithIngredients> {
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_WITH_INGREDIENTS_SELECT)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as unknown as RecipeWithIngredients
}

export async function createRecipe(householdId: string, values: RecipeFormValues): Promise<string> {
  const { ingredients, ...recipeFields } = values

  const { data: recipe, error } = await supabase
    .from('recipes')
    .insert({ ...recipeFields, household_id: householdId })
    .select('id')
    .single()

  if (error) throw error

  if (ingredients.length > 0) {
    const { error: ingredientsError } = await supabase.from('recipe_ingredients').insert(
      ingredients.map((ing, index) => ({
        recipe_id: recipe.id,
        ordre: index,
        ...ing,
      })),
    )
    if (ingredientsError) throw ingredientsError
  }

  return recipe.id as string
}

export async function updateRecipe(id: string, values: RecipeFormValues): Promise<void> {
  const { ingredients, ...recipeFields } = values

  const { error } = await supabase.from('recipes').update(recipeFields).eq('id', id)
  if (error) throw error

  const { error: deleteError } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', id)
  if (deleteError) throw deleteError

  if (ingredients.length > 0) {
    const { error: insertError } = await supabase.from('recipe_ingredients').insert(
      ingredients.map((ing, index) => ({
        recipe_id: id,
        ordre: index,
        ...ing,
      })),
    )
    if (insertError) throw insertError
  }
}

/** Archivage plutôt que suppression : préserve l’historique des plans passés qui référencent cette recette. */
export async function archiveRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipes').update({ actif: false }).eq('id', id)
  if (error) throw error
}

export async function listIngredients(householdId: string): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, nom, unite_base, rayon_id')
    .eq('household_id', householdId)
    .order('nom')

  if (error) throw error
  return data as Ingredient[]
}

export async function createIngredient(
  householdId: string,
  nom: string,
  uniteBase: Ingredient['unite_base'],
  rayonId: string | null,
): Promise<Ingredient> {
  const { data, error } = await supabase
    .from('ingredients')
    .insert({ household_id: householdId, nom, unite_base: uniteBase, rayon_id: rayonId })
    .select('id, nom, unite_base, rayon_id')
    .single()

  if (error) throw error
  return data as Ingredient
}

export async function listStoreSections(householdId: string): Promise<StoreSection[]> {
  const { data, error } = await supabase
    .from('store_sections')
    .select('id, nom, ordre')
    .eq('household_id', householdId)
    .order('ordre')

  if (error) throw error
  return data as StoreSection[]
}
