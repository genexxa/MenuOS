import { supabase } from '../../lib/supabase'
import type { AvailableLeftover, EntryFormValues, MealPlan, MealPlanEntry, Moment, PrepTask, PrepTaskType } from './types'

const ENTRY_SELECT =
  'id, meal_plan_id, date, moment, recipe_id, leftover_id, texte_libre, membre_id, ' +
  'portions_prevues, convives, statut, notes, ' +
  'recipe:recipes (id, nom, portions_base, transportable), ' +
  'leftover:leftovers!meal_plan_entries_leftover_id_fkey (id, portions_disponibles, date_production, recipe:recipes (id, nom)), ' +
  'membre:household_members (id, nom, couleur_affichage)'

export async function getOrCreateMealPlan(householdId: string, semaineDebut: string): Promise<MealPlan> {
  const { data: existing, error: selectError } = await supabase
    .from('meal_plans')
    .select('id, household_id, semaine_debut, statut')
    .eq('household_id', householdId)
    .eq('semaine_debut', semaineDebut)
    .maybeSingle()

  if (selectError) throw selectError
  if (existing) return existing as MealPlan

  const { data: created, error: insertError } = await supabase
    .from('meal_plans')
    .insert({ household_id: householdId, semaine_debut: semaineDebut })
    .select('id, household_id, semaine_debut, statut')
    .single()

  if (insertError) throw insertError
  return created as MealPlan
}

export async function listEntries(mealPlanId: string): Promise<MealPlanEntry[]> {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select(ENTRY_SELECT)
    .eq('meal_plan_id', mealPlanId)
    .order('date')

  if (error) throw error
  return data as unknown as MealPlanEntry[]
}

function toRow(mealPlanId: string, values: EntryFormValues) {
  return {
    meal_plan_id: mealPlanId,
    date: values.date,
    moment: values.moment,
    recipe_id: values.kind === 'recette' ? values.recipe_id : null,
    leftover_id: values.kind === 'reste' ? values.leftover_id : null,
    texte_libre: values.kind === 'libre' ? values.texte_libre : null,
    membre_id: values.membre_id,
    portions_prevues: values.portions_prevues,
    convives: values.convives,
    notes: values.notes,
  }
}

export async function createEntry(mealPlanId: string, values: EntryFormValues): Promise<void> {
  const { error } = await supabase.from('meal_plan_entries').insert(toRow(mealPlanId, values))
  if (error) throw error

  if (values.kind === 'reste' && values.leftover_id) {
    await supabase.from('leftovers').update({ statut: 'utilise' }).eq('id', values.leftover_id)
  }
}

export async function updateEntry(
  id: string,
  values: EntryFormValues,
  previousLeftoverId: string | null,
): Promise<void> {
  const { error } = await supabase.from('meal_plan_entries').update(toRow('', values)).eq('id', id)
  if (error) throw error

  if (previousLeftoverId && previousLeftoverId !== values.leftover_id) {
    await supabase.from('leftovers').update({ statut: 'disponible' }).eq('id', previousLeftoverId)
  }
  if (values.kind === 'reste' && values.leftover_id && values.leftover_id !== previousLeftoverId) {
    await supabase.from('leftovers').update({ statut: 'utilise' }).eq('id', values.leftover_id)
  }
}

export async function deleteEntry(id: string, leftoverId: string | null): Promise<void> {
  const { error } = await supabase.from('meal_plan_entries').delete().eq('id', id)
  if (error) throw error

  if (leftoverId) {
    await supabase.from('leftovers').update({ statut: 'disponible' }).eq('id', leftoverId)
  }
}

export async function moveEntry(id: string, date: string, moment: Moment): Promise<void> {
  const { error } = await supabase.from('meal_plan_entries').update({ date, moment }).eq('id', id)
  if (error) throw error
}

export async function markCooked(id: string): Promise<void> {
  const { error } = await supabase.from('meal_plan_entries').update({ statut: 'cuisine' }).eq('id', id)
  if (error) throw error
}

export interface GeneratedEntry {
  date: string
  moment: Moment
  recipe_id: string
  membre_id: string | null
  portions_prevues: number
  convives: number | null
  raison?: string
}

export async function generateWeeklyPlan(householdId: string, semaineDebut: string): Promise<GeneratedEntry[]> {
  const { data, error } = await supabase.functions.invoke<{ entrees: GeneratedEntry[] }>('generate-weekly-plan', {
    body: { household_id: householdId, semaine_debut: semaineDebut },
  })
  if (error) throw error
  return data?.entrees ?? []
}

export async function applyGeneratedEntries(mealPlanId: string, entries: GeneratedEntry[]): Promise<void> {
  if (entries.length === 0) return
  const { error } = await supabase.from('meal_plan_entries').insert(
    entries.map((e) => ({
      meal_plan_id: mealPlanId,
      date: e.date,
      moment: e.moment,
      recipe_id: e.recipe_id,
      membre_id: e.membre_id,
      portions_prevues: e.portions_prevues,
      convives: e.convives,
    })),
  )
  if (error) throw error
}

export async function listAvailableLeftovers(householdId: string): Promise<AvailableLeftover[]> {
  const { data, error } = await supabase
    .from('leftovers')
    .select('id, portions_disponibles, date_production, recipe:recipes (id, nom)')
    .eq('household_id', householdId)
    .eq('statut', 'disponible')
    .order('date_production')

  if (error) throw error
  return data as unknown as AvailableLeftover[]
}

export async function listPrepTasksForEntry(mealPlanEntryId: string): Promise<PrepTask[]> {
  const { data, error } = await supabase
    .from('prep_tasks')
    .select('id, household_id, meal_plan_entry_id, type, date_a_faire, statut, note')
    .eq('meal_plan_entry_id', mealPlanEntryId)
    .order('date_a_faire')

  if (error) throw error
  return data as PrepTask[]
}

export async function createPrepTask(
  householdId: string,
  mealPlanEntryId: string,
  values: { type: PrepTaskType; date_a_faire: string; note: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('prep_tasks')
    .insert({ household_id: householdId, meal_plan_entry_id: mealPlanEntryId, ...values })
  if (error) throw error
}

export async function togglePrepTaskDone(id: string, statut: 'a_faire' | 'fait'): Promise<void> {
  const { error } = await supabase.from('prep_tasks').update({ statut }).eq('id', id)
  if (error) throw error
}

export async function deletePrepTask(id: string): Promise<void> {
  const { error } = await supabase.from('prep_tasks').delete().eq('id', id)
  if (error) throw error
}
