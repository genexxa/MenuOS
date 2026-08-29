import { supabase } from '../../lib/supabase'
import type { Emplacement, GroceryList, GroceryListItem, PantryItem, UnitConversion } from './types'

const PANTRY_SELECT = 'id, ingredient_id, quantite, unite, emplacement, date_peremption, ingredient:ingredients (id, nom, unite_base, rayon_id)'

export async function listPantry(householdId: string): Promise<PantryItem[]> {
  const { data, error } = await supabase
    .from('pantry_items')
    .select(PANTRY_SELECT)
    .eq('household_id', householdId)
    .order('date_peremption', { ascending: true, nullsFirst: false })

  if (error) throw error
  return data as unknown as PantryItem[]
}

export async function createPantryItem(
  householdId: string,
  values: { ingredient_id: string; quantite: number; unite: string; emplacement: Emplacement; date_peremption: string | null },
): Promise<void> {
  const { error } = await supabase.from('pantry_items').insert({ household_id: householdId, ...values })
  if (error) throw error
}

export async function updatePantryItem(
  id: string,
  values: { ingredient_id: string; quantite: number; unite: string; emplacement: Emplacement; date_peremption: string | null },
): Promise<void> {
  const { error } = await supabase.from('pantry_items').update(values).eq('id', id)
  if (error) throw error
}

export async function deletePantryItem(id: string): Promise<void> {
  const { error } = await supabase.from('pantry_items').delete().eq('id', id)
  if (error) throw error
}

export async function listUnitConversions(): Promise<UnitConversion[]> {
  const { data, error } = await supabase.from('unit_conversions').select('unite, unite_base, facteur')
  if (error) throw error
  return data as UnitConversion[]
}

const GROCERY_ITEM_SELECT =
  'id, grocery_list_id, ingredient_id, nom_libre, quantite, unite, rayon_id, coche, ajoute_manuellement, cout_estime, ' +
  'ingredient:ingredients (id, nom), rayon:store_sections (id, nom, ordre)'

export async function getOrCreateGroceryList(householdId: string, mealPlanId: string): Promise<GroceryList> {
  const { data: existing, error: selectError } = await supabase
    .from('grocery_lists')
    .select('id, household_id, meal_plan_id, statut')
    .eq('meal_plan_id', mealPlanId)
    .maybeSingle()

  if (selectError) throw selectError
  if (existing) return existing as GroceryList

  const { data: created, error: insertError } = await supabase
    .from('grocery_lists')
    .insert({ household_id: householdId, meal_plan_id: mealPlanId })
    .select('id, household_id, meal_plan_id, statut')
    .single()

  if (insertError) throw insertError
  return created as GroceryList
}

export async function listGroceryItems(groceryListId: string): Promise<GroceryListItem[]> {
  const { data, error } = await supabase
    .from('grocery_list_items')
    .select(GROCERY_ITEM_SELECT)
    .eq('grocery_list_id', groceryListId)

  if (error) throw error
  return data as unknown as GroceryListItem[]
}

interface RecipeIngredientRow {
  quantite: number
  unite: string
  ingredient_id: string
  ingredient: { id: string; nom: string; unite_base: string; rayon_id: string | null; cout_unitaire_estime: number | null }
}

function conversionFactor(conversions: UnitConversion[], unite: string): number {
  return conversions.find((c) => c.unite === unite)?.facteur ?? 1
}

/**
 * Génère (ou régénère) la liste d'épicerie d'un plan : somme des ingrédients
 * des recettes planifiées, converti dans l'unité de base de chaque
 * ingrédient, moins ce qui est déjà au garde-manger. Les items ajoutés
 * manuellement sont préservés ; seuls les items auto-générés sont remplacés.
 */
export async function generateGroceryList(householdId: string, mealPlanId: string): Promise<string> {
  const [{ data: entries, error: entriesError }, conversions, pantry] = await Promise.all([
    supabase
      .from('meal_plan_entries')
      .select('portions_prevues, recipe:recipes (id, portions_base)')
      .eq('meal_plan_id', mealPlanId)
      .not('recipe_id', 'is', null),
    listUnitConversions(),
    listPantry(householdId),
  ])
  if (entriesError) throw entriesError

  const recipeScales = new Map<string, number>()
  for (const entry of entries as unknown as { portions_prevues: number; recipe: { id: string; portions_base: number } | null }[]) {
    if (!entry.recipe) continue
    const scale = entry.portions_prevues / entry.recipe.portions_base
    recipeScales.set(entry.recipe.id, (recipeScales.get(entry.recipe.id) ?? 0) + scale)
  }

  const recipeIds = [...recipeScales.keys()]
  const needed = new Map<string, { quantiteBase: number; uniteBase: string; rayonId: string | null; nom: string; coutUnitaire: number | null }>()

  if (recipeIds.length > 0) {
    const { data: recipeIngredients, error: riError } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id, quantite, unite, ingredient_id, ingredient:ingredients (id, nom, unite_base, rayon_id, cout_unitaire_estime)')
      .in('recipe_id', recipeIds)

    if (riError) throw riError

    for (const ri of recipeIngredients as unknown as (RecipeIngredientRow & { recipe_id: string })[]) {
      const scale = recipeScales.get(ri.recipe_id) ?? 0
      if (scale <= 0) continue
      const quantiteBase = ri.quantite * scale * conversionFactor(conversions, ri.unite)
      const prev = needed.get(ri.ingredient_id)
      needed.set(ri.ingredient_id, {
        quantiteBase: (prev?.quantiteBase ?? 0) + quantiteBase,
        uniteBase: ri.ingredient.unite_base,
        rayonId: ri.ingredient.rayon_id,
        nom: ri.ingredient.nom,
        coutUnitaire: ri.ingredient.cout_unitaire_estime,
      })
    }
  }

  const pantryTotals = new Map<string, number>()
  for (const item of pantry) {
    const base = item.quantite * conversionFactor(conversions, item.unite)
    pantryTotals.set(item.ingredient_id, (pantryTotals.get(item.ingredient_id) ?? 0) + base)
  }

  const list = await getOrCreateGroceryList(householdId, mealPlanId)

  const { error: deleteError } = await supabase
    .from('grocery_list_items')
    .delete()
    .eq('grocery_list_id', list.id)
    .eq('ajoute_manuellement', false)
  if (deleteError) throw deleteError

  const rows = [...needed.entries()]
    .map(([ingredientId, v]) => {
      const remaining = v.quantiteBase - (pantryTotals.get(ingredientId) ?? 0)
      return { ingredientId, remaining, v }
    })
    .filter(({ remaining }) => remaining > 0.01)
    .map(({ ingredientId, remaining, v }) => ({
      grocery_list_id: list.id,
      ingredient_id: ingredientId,
      quantite: Math.round(remaining * 100) / 100,
      unite: v.uniteBase,
      rayon_id: v.rayonId,
      cout_estime: v.coutUnitaire != null ? Math.round(v.coutUnitaire * remaining * 100) / 100 : null,
      ajoute_manuellement: false,
    }))

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('grocery_list_items').insert(rows)
    if (insertError) throw insertError
  }

  return list.id
}

export async function toggleItemChecked(id: string, coche: boolean): Promise<void> {
  const { error } = await supabase.from('grocery_list_items').update({ coche }).eq('id', id)
  if (error) throw error
}

export async function addManualItem(
  groceryListId: string,
  values: { ingredient_id: string | null; nom_libre: string | null; quantite: number; unite: string; rayon_id: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('grocery_list_items')
    .insert({ grocery_list_id: groceryListId, ajoute_manuellement: true, ...values })
  if (error) throw error
}

export async function deleteGroceryItem(id: string): Promise<void> {
  const { error } = await supabase.from('grocery_list_items').delete().eq('id', id)
  if (error) throw error
}
