import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { IngredientCombobox } from '../../recettes/components/IngredientCombobox'
import { useIngredients } from '../../recettes/hooks'
import { UNITE_LABELS, UNITES } from '../../recettes/types'
import type { Ingredient } from '../../recettes/types'
import { useDeletePantryItem, useSavePantryItem } from '../hooks'
import { EMPLACEMENTS } from '../types'
import type { Emplacement, PantryItem } from '../types'

export function PantryItemDialog({
  open,
  onOpenChange,
  householdId,
  item,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string | undefined
  item: PantryItem | null
}) {
  const isEditing = !!item
  const { data: ingredients } = useIngredients(householdId)
  const saveItem = useSavePantryItem(householdId)
  const deleteItem = useDeletePantryItem(householdId)

  const [ingredient, setIngredient] = useState<Ingredient | null>(null)
  const [quantite, setQuantite] = useState(0)
  const [unite, setUnite] = useState<string>('g')
  const [emplacement, setEmplacement] = useState<Emplacement>('garde_manger')
  const [datePeremption, setDatePeremption] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (item) {
      setIngredient(item.ingredient)
      setQuantite(item.quantite)
      setUnite(item.unite)
      setEmplacement(item.emplacement)
      setDatePeremption(item.date_peremption ?? '')
    } else {
      setIngredient(null)
      setQuantite(0)
      setUnite('g')
      setEmplacement('garde_manger')
      setDatePeremption('')
    }
    setError(null)
  }, [open, item])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ingredient) {
      setError('Choisis un ingrédient.')
      return
    }
    try {
      await saveItem.mutateAsync({
        id: item?.id,
        ingredient_id: ingredient.id,
        quantite,
        unite,
        emplacement,
        date_peremption: datePeremption || null,
      })
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleDelete() {
    if (!item) return
    await deleteItem.mutateAsync(item.id)
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed inset-x-4 top-1/2 max-w-sm -translate-y-1/2 space-y-3 rounded-lg bg-white p-4 shadow-lg sm:mx-auto">
          <Dialog.Title className="font-medium">{isEditing ? "Modifier l'item" : 'Ajouter au garde-manger'}</Dialog.Title>
          <Dialog.Description className="sr-only">Quantité et emplacement d'un item d'inventaire.</Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-3">
            <IngredientCombobox
              householdId={householdId}
              ingredients={ingredients ?? []}
              value={ingredient}
              onSelect={setIngredient}
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Quantité"
                value={quantite || ''}
                onChange={(e) => setQuantite(Number(e.target.value))}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              <select
                value={unite}
                onChange={(e) => setUnite(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-2 py-2 text-sm"
              >
                {UNITES.map((u) => (
                  <option key={u} value={u}>
                    {UNITE_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={emplacement}
              onChange={(e) => setEmplacement(e.target.value as Emplacement)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              {EMPLACEMENTS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>

            <div className="space-y-1">
              <label className="text-xs text-neutral-500">Date de péremption (optionnel)</label>
              <input
                type="date"
                value={datePeremption}
                onChange={(e) => setDatePeremption(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between pt-1">
              {isEditing ? (
                <button type="button" onClick={handleDelete} className="text-sm text-red-600">
                  Supprimer
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={saveItem.isPending}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {saveItem.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
