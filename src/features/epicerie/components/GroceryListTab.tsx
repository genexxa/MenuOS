import { useMemo, useState } from 'react'
import { useMealPlan } from '../../planner/hooks'
import { formatWeekRange, getWeekStart, shiftWeek } from '../../planner/utils'
import { useGenerateGroceryList, useGroceryItems, useGroceryList } from '../hooks'
import type { GroceryListItem } from '../types'
import { AddManualItemDialog } from './AddManualItemDialog'
import { GroceryItemRow } from './GroceryItemRow'

const SANS_RAYON = { id: '__sans_rayon__', nom: 'Non classé', ordre: 9999 }

export function GroceryListTab({ householdId }: { householdId: string | undefined }) {
  const [semaineDebut, setSemaineDebut] = useState(() => getWeekStart(new Date()))
  const { data: plan } = useMealPlan(householdId, semaineDebut)
  const { data: list } = useGroceryList(householdId, plan?.id)
  const { data: items } = useGroceryItems(list?.id)
  const generate = useGenerateGroceryList(householdId, plan?.id)
  const [addOpen, setAddOpen] = useState(false)

  const groups = useMemo(() => {
    const map = new Map<string, { rayon: { id: string; nom: string; ordre: number }; items: GroceryListItem[] }>()
    for (const item of items ?? []) {
      const rayon = item.rayon ?? SANS_RAYON
      if (!map.has(rayon.id)) map.set(rayon.id, { rayon, items: [] })
      map.get(rayon.id)!.items.push(item)
    }
    return [...map.values()].sort((a, b) => a.rayon.ordre - b.rayon.ordre)
  }, [items])

  const totalRestant = (items ?? [])
    .filter((i) => !i.coche && i.cout_estime != null)
    .reduce((sum, i) => sum + (i.cout_estime ?? 0), 0)

  const coches = (items ?? []).filter((i) => i.coche).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => setSemaineDebut((s) => shiftWeek(s, -1))}
          className="rounded-md border border-neutral-300 px-2 py-1"
        >
          ←
        </button>
        <span className="text-neutral-600">{formatWeekRange(semaineDebut)}</span>
        <button
          type="button"
          onClick={() => setSemaineDebut((s) => shiftWeek(s, 1))}
          className="rounded-md border border-neutral-300 px-2 py-1"
        >
          →
        </button>
      </div>

      <button
        type="button"
        onClick={() => generate.mutate()}
        disabled={generate.isPending || !plan}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {generate.isPending
          ? 'Génération...'
          : items && items.length > 0
            ? 'Régénérer la liste depuis le plan'
            : 'Générer la liste depuis le plan'}
      </button>

      {items && items.length > 0 && (
        <div className="flex items-center justify-between rounded-md bg-neutral-100 px-3 py-2 text-sm">
          <span className="text-neutral-500">
            {coches} / {items.length} cochés
          </span>
          <span className="font-medium">{totalRestant.toFixed(2)} $ restant estimé</span>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group) => (
          <section key={group.rayon.id}>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">{group.rayon.nom}</h3>
            <div className="space-y-1.5">
              {group.items.map((item) => (
                <GroceryItemRow key={item.id} item={item} groceryListId={list!.id} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {items && items.length === 0 && (
        <p className="text-sm text-neutral-500">
          Liste vide. Génère-la depuis le plan de la semaine ou ajoute un item manuellement.
        </p>
      )}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        disabled={!list}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 disabled:opacity-50"
      >
        + Ajouter un item hors plan
      </button>

      <AddManualItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        householdId={householdId}
        groceryListId={list?.id}
      />
    </div>
  )
}
