import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { useHouseholdMembers } from '../../../lib/household'
import { useAvailableLeftovers, useCreateEntry, useDeleteEntry, useMarkCooked, useUpdateEntry } from '../hooks'
import { MOMENTS } from '../types'
import type { EntryFormValues, EntryKind, MealPlanEntry, Moment } from '../types'
import { PrepTasksSection } from './PrepTasksSection'
import { RecipeCombobox } from './RecipeCombobox'

function blankValues(date: string, moment: Moment): EntryFormValues {
  return {
    date,
    moment,
    kind: 'recette',
    recipe_id: null,
    leftover_id: null,
    texte_libre: null,
    membre_id: null,
    portions_prevues: 4,
    convives: null,
    notes: null,
  }
}

export function EntryDialog({
  open,
  onOpenChange,
  householdId,
  mealPlanId,
  date,
  moment,
  entry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string | undefined
  mealPlanId: string | undefined
  date: string
  moment: Moment
  entry: MealPlanEntry | null
}) {
  const isEditing = !!entry
  const { data: members } = useHouseholdMembers(householdId)
  const { data: leftovers } = useAvailableLeftovers(householdId)
  const createEntry = useCreateEntry(mealPlanId, householdId)
  const updateEntry = useUpdateEntry(mealPlanId, householdId)
  const deleteEntry = useDeleteEntry(mealPlanId, householdId)
  const markCooked = useMarkCooked(mealPlanId, householdId)

  const [selectedRecipe, setSelectedRecipe] = useState<{ id: string; nom: string; portions_base: number } | null>(
    null,
  )
  const [values, setValues] = useState<EntryFormValues>(blankValues(date, moment))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (entry) {
      setValues({
        date: entry.date,
        moment: entry.moment,
        kind: entry.leftover_id ? 'reste' : entry.recipe_id ? 'recette' : 'libre',
        recipe_id: entry.recipe_id,
        leftover_id: entry.leftover_id,
        texte_libre: entry.texte_libre,
        membre_id: entry.membre_id,
        portions_prevues: entry.portions_prevues,
        convives: entry.convives,
        notes: entry.notes,
      })
      setSelectedRecipe(entry.recipe)
    } else {
      setValues(blankValues(date, moment))
      setSelectedRecipe(null)
    }
    setError(null)
  }, [open, entry, date, moment])

  const saving = createEntry.isPending || updateEntry.isPending
  const surplus =
    values.kind === 'recette' && values.convives != null ? values.portions_prevues - values.convives : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (values.kind === 'recette' && !values.recipe_id) {
      setError('Choisis une recette.')
      return
    }
    if (values.kind === 'reste' && !values.leftover_id) {
      setError('Choisis un reste disponible.')
      return
    }
    if (values.kind === 'libre' && !values.texte_libre?.trim()) {
      setError('Décris ce repas.')
      return
    }

    try {
      if (isEditing) {
        await updateEntry.mutateAsync({ id: entry.id, values, previousLeftoverId: entry.leftover_id })
      } else {
        await createEntry.mutateAsync(values)
      }
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleDelete() {
    if (!entry) return
    await deleteEntry.mutateAsync({ id: entry.id, leftoverId: entry.leftover_id })
    onOpenChange(false)
  }

  async function handleMarkCooked() {
    if (!entry) return
    await markCooked.mutateAsync(entry.id)
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed inset-x-4 top-1/2 max-h-[85vh] max-w-md -translate-y-1/2 overflow-y-auto rounded-lg bg-white p-4 shadow-lg sm:mx-auto">
          <Dialog.Title className="font-medium">
            {isEditing ? 'Modifier le repas' : 'Ajouter un repas'}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Choisir une recette, un reste ou une description libre pour ce moment du plan.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={values.date}
                onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
                className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <select
                value={values.moment}
                onChange={(e) => setValues((v) => ({ ...v, moment: e.target.value as Moment }))}
                className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              >
                {MOMENTS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-1 rounded-md bg-neutral-100 p-1 text-sm">
              {(['recette', 'reste', 'libre'] as EntryKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, kind: k }))}
                  className={`flex-1 rounded-md py-1 ${values.kind === k ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
                >
                  {k === 'recette' ? 'Recette' : k === 'reste' ? 'Reste' : 'Libre'}
                </button>
              ))}
            </div>

            {values.kind === 'recette' && (
              <>
                <RecipeCombobox
                  householdId={householdId}
                  value={selectedRecipe}
                  onSelect={(recipe) => {
                    setSelectedRecipe(recipe)
                    setValues((v) => ({ ...v, recipe_id: recipe.id, portions_prevues: recipe.portions_base }))
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-500">Portions faites</label>
                    <input
                      type="number"
                      min={1}
                      value={values.portions_prevues}
                      onChange={(e) => setValues((v) => ({ ...v, portions_prevues: Number(e.target.value) }))}
                      className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-500">Convives (optionnel)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="= portions"
                      value={values.convives ?? ''}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, convives: e.target.value ? Number(e.target.value) : null }))
                      }
                      className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                {surplus > 0 && (
                  <p className="text-xs text-emerald-700">
                    {surplus} portion{surplus > 1 ? 's' : ''} de restes seront disponibles une fois ce repas marqué cuisiné.
                  </p>
                )}
              </>
            )}

            {values.kind === 'reste' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-500">Reste disponible</label>
                  <select
                    value={values.leftover_id ?? ''}
                    onChange={(e) => {
                      const leftover = leftovers?.find((l) => l.id === e.target.value)
                      setValues((v) => ({
                        ...v,
                        leftover_id: e.target.value || null,
                        portions_prevues: leftover?.portions_disponibles ?? v.portions_prevues,
                      }))
                    }}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="">Choisir...</option>
                    {leftovers?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.recipe?.nom ?? 'Reste'} — {l.portions_disponibles} portion(s)
                      </option>
                    ))}
                  </select>
                </div>
                {values.leftover_id && (
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-500">Portions utilisées</label>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      max={leftovers?.find((l) => l.id === values.leftover_id)?.portions_disponibles}
                      value={values.portions_prevues}
                      onChange={(e) => setValues((v) => ({ ...v, portions_prevues: Number(e.target.value) }))}
                      className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                )}
              </>
            )}

            {values.kind === 'libre' && (
              <div className="space-y-1">
                <label className="text-xs text-neutral-500">Description</label>
                <input
                  type="text"
                  value={values.texte_libre ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, texte_libre: e.target.value }))}
                  placeholder="Ex : resto, chez grand-maman..."
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-neutral-500">Assigné à</label>
              <select
                value={values.membre_id ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, membre_id: e.target.value || null }))}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="">Toute la famille</option>
                {members?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nom}
                  </option>
                ))}
              </select>
            </div>

            {isEditing && values.kind === 'recette' && (
              <PrepTasksSection householdId={householdId} mealPlanEntryId={entry.id} entryDate={entry.date} />
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex gap-2">
                {isEditing && (
                  <button type="button" onClick={handleDelete} className="text-sm text-red-600">
                    Supprimer
                  </button>
                )}
                {isEditing && values.kind === 'recette' && entry.statut !== 'cuisine' && (
                  <button type="button" onClick={handleMarkCooked} className="text-sm text-emerald-700">
                    Marquer cuisiné
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
