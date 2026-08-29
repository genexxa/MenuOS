import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { useRecipes } from '../../recettes/hooks'
import { useApplyGeneratedEntries, useGenerateWeeklyPlan } from '../hooks'
import { MOMENTS } from '../types'
import type { GeneratedEntry } from '../api'
import { formatDayLabel } from '../utils'

const NO_FILTER = { search: '', categorie: 'toutes' as const, transportable: false }

export function GeneratePlanDialog({
  open,
  onOpenChange,
  householdId,
  mealPlanId,
  semaineDebut,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string | undefined
  mealPlanId: string | undefined
  semaineDebut: string
}) {
  const { data: recipes } = useRecipes(householdId, NO_FILTER)
  const generate = useGenerateWeeklyPlan(householdId, semaineDebut)
  const apply = useApplyGeneratedEntries(mealPlanId, householdId)

  const [proposal, setProposal] = useState<GeneratedEntry[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setProposal([])
    setError(null)
    generate
      .mutateAsync()
      .then((entries) => {
        setProposal(entries)
        setSelected(new Set(entries.map((_, i) => i)))
      })
      .catch((err) => setError((err as Error).message))
    // Ne relance la génération qu'à l'ouverture du dialogue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function handleApply() {
    const chosen = proposal.filter((_, i) => selected.has(i))
    try {
      await apply.mutateAsync(chosen)
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const recipeName = (id: string) => recipes?.find((r) => r.id === id)?.nom ?? 'Recette inconnue'

  const groupedByDate = proposal.reduce<Record<string, { entry: GeneratedEntry; index: number }[]>>((acc, entry, index) => {
    ;(acc[entry.date] ??= []).push({ entry, index })
    return acc
  }, {})

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed inset-x-4 top-1/2 max-h-[85vh] max-w-lg -translate-y-1/2 overflow-y-auto rounded-lg bg-white p-4 shadow-lg sm:mx-auto">
          <Dialog.Title className="font-medium">Plan proposé par l'IA</Dialog.Title>
          <Dialog.Description className="text-sm text-neutral-500">
            Décoche ce que tu ne veux pas garder, puis applique la sélection. Rien n'est enregistré tant que tu n'as
            pas cliqué sur « Appliquer ».
          </Dialog.Description>

          <div className="mt-3 space-y-4">
            {generate.isPending && <p className="text-sm text-neutral-500">Génération en cours...</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {!generate.isPending && proposal.length === 0 && !error && (
              <p className="text-sm text-neutral-500">
                Aucune case vide à remplir cette semaine — le plan est déjà complet.
              </p>
            )}

            {Object.entries(groupedByDate).map(([date, items]) => {
              const { weekday, dayMonth } = formatDayLabel(date)
              return (
                <div key={date}>
                  <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
                    {weekday} {dayMonth}
                  </h3>
                  <div className="space-y-1.5">
                    {items.map(({ entry, index }) => (
                      <label
                        key={index}
                        className="flex items-start gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(index)}
                          onChange={() => toggle(index)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium">{MOMENTS.find((m) => m.value === entry.moment)?.label}</span>{' '}
                          — {recipeName(entry.recipe_id)} ({entry.portions_prevues} portions)
                          {entry.raison && <span className="block text-xs text-neutral-400">{entry.raison}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {proposal.length > 0 && (
            <button
              type="button"
              onClick={handleApply}
              disabled={apply.isPending || selected.size === 0}
              className="mt-4 w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {apply.isPending ? 'Application...' : `Appliquer (${selected.size})`}
            </button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
