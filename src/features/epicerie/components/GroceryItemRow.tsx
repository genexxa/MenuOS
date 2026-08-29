import { UNITE_LABELS } from '../../recettes/types'
import { useDeleteGroceryItem, useToggleItemChecked } from '../hooks'
import type { GroceryListItem } from '../types'

export function GroceryItemRow({ item, groceryListId }: { item: GroceryListItem; groceryListId: string }) {
  const toggle = useToggleItemChecked(groceryListId)
  const deleteItem = useDeleteGroceryItem(groceryListId)

  const nom = item.ingredient?.nom ?? item.nom_libre ?? '—'

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-3 ${
        item.coche ? 'border-neutral-100 bg-neutral-50' : 'border-neutral-200 bg-white'
      }`}
    >
      <button
        type="button"
        onClick={() => toggle.mutate({ id: item.id, coche: !item.coche })}
        aria-pressed={item.coche}
        aria-label={item.coche ? 'Décocher' : 'Cocher'}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 ${
          item.coche ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-neutral-300'
        }`}
      >
        {item.coche && '✓'}
      </button>

      <div className={`flex-1 ${item.coche ? 'text-neutral-400 line-through' : ''}`}>
        <div className="text-sm font-medium">{nom}</div>
        <div className="text-xs text-neutral-400">
          {item.quantite} {UNITE_LABELS[item.unite] ?? item.unite}
          {item.ajoute_manuellement && ' · ajouté manuellement'}
        </div>
      </div>

      {item.cout_estime != null && (
        <div className="text-sm text-neutral-500">{item.cout_estime.toFixed(2)} $</div>
      )}

      <button
        type="button"
        onClick={() => deleteItem.mutate(item.id)}
        className="px-1 text-neutral-300"
        aria-label="Retirer"
      >
        ✕
      </button>
    </div>
  )
}
