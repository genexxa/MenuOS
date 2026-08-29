import { useState } from 'react'
import { UNITE_LABELS } from '../../recettes/types'
import { usePantry } from '../hooks'
import { EMPLACEMENTS } from '../types'
import type { PantryItem } from '../types'
import { PantryItemDialog } from './PantryItemDialog'

function isExpiringSoon(date: string | null): boolean {
  if (!date) return false
  const diffDays = (new Date(`${date}T00:00:00`).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return diffDays <= 3
}

export function PantryTab({ householdId }: { householdId: string | undefined }) {
  const { data: items, isLoading } = usePantry(householdId)
  const [dialogItem, setDialogItem] = useState<PantryItem | null | undefined>(undefined)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-500">Garde-manger</h2>
        <button
          type="button"
          onClick={() => setDialogItem(null)}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          + Ajouter
        </button>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Chargement...</p>}

      {EMPLACEMENTS.map((emp) => {
        const empItems = items?.filter((i) => i.emplacement === emp.value) ?? []
        if (empItems.length === 0) return null
        return (
          <section key={emp.value}>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">{emp.label}</h3>
            <div className="space-y-1">
              {empItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDialogItem(item)}
                  className="flex w-full items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2 text-left text-sm"
                >
                  <span>{item.ingredient.nom}</span>
                  <span className="flex items-center gap-2 text-neutral-400">
                    {item.quantite} {UNITE_LABELS[item.unite] ?? item.unite}
                    {isExpiringSoon(item.date_peremption) && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        {item.date_peremption}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )
      })}

      {items && items.length === 0 && (
        <p className="text-sm text-neutral-500">Aucun item au garde-manger pour l'instant.</p>
      )}

      {dialogItem !== undefined && (
        <PantryItemDialog
          open={dialogItem !== undefined}
          onOpenChange={(open) => !open && setDialogItem(undefined)}
          householdId={householdId}
          item={dialogItem}
        />
      )}
    </div>
  )
}
