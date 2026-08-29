import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { IngredientCombobox } from '../../recettes/components/IngredientCombobox'
import { useIngredients, useStoreSections } from '../../recettes/hooks'
import { UNITE_LABELS, UNITES } from '../../recettes/types'
import type { Ingredient } from '../../recettes/types'
import { useAddManualItem } from '../hooks'

export function AddManualItemDialog({
  open,
  onOpenChange,
  householdId,
  groceryListId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string | undefined
  groceryListId: string | undefined
}) {
  const { data: ingredients } = useIngredients(householdId)
  const { data: storeSections } = useStoreSections(householdId)
  const addItem = useAddManualItem(groceryListId)

  const [mode, setMode] = useState<'ingredient' | 'libre'>('ingredient')
  const [ingredient, setIngredient] = useState<Ingredient | null>(null)
  const [nomLibre, setNomLibre] = useState('')
  const [quantite, setQuantite] = useState(1)
  const [unite, setUnite] = useState('unite')
  const [rayonId, setRayonId] = useState('')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setMode('ingredient')
    setIngredient(null)
    setNomLibre('')
    setQuantite(1)
    setUnite('unite')
    setRayonId('')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'ingredient' && !ingredient) {
      setError('Choisis un ingrédient ou passe en mode texte libre.')
      return
    }
    if (mode === 'libre' && !nomLibre.trim()) {
      setError('Décris cet item.')
      return
    }
    try {
      await addItem.mutateAsync({
        ingredient_id: mode === 'ingredient' ? ingredient!.id : null,
        nom_libre: mode === 'libre' ? nomLibre.trim() : null,
        quantite,
        unite,
        rayon_id: rayonId || null,
      })
      reset()
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed inset-x-4 top-1/2 max-w-sm -translate-y-1/2 space-y-3 rounded-lg bg-white p-4 shadow-lg sm:mx-auto">
          <Dialog.Title className="font-medium">Ajouter un item</Dialog.Title>
          <Dialog.Description className="sr-only">Ajouter un item hors plan à la liste d'épicerie.</Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-1 rounded-md bg-neutral-100 p-1 text-sm">
              <button
                type="button"
                onClick={() => setMode('ingredient')}
                className={`flex-1 rounded-md py-1 ${mode === 'ingredient' ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
              >
                Ingrédient
              </button>
              <button
                type="button"
                onClick={() => setMode('libre')}
                className={`flex-1 rounded-md py-1 ${mode === 'libre' ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
              >
                Texte libre
              </button>
            </div>

            {mode === 'ingredient' ? (
              <IngredientCombobox
                householdId={householdId}
                ingredients={ingredients ?? []}
                value={ingredient}
                onSelect={setIngredient}
              />
            ) : (
              <input
                type="text"
                value={nomLibre}
                onChange={(e) => setNomLibre(e.target.value)}
                placeholder="Ex : sacs à lunch, papier essuie-tout..."
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                min={0.01}
                value={quantite}
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
              value={rayonId}
              onChange={(e) => setRayonId(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">Rayon...</option>
              {storeSections?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={addItem.isPending}
              className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {addItem.isPending ? 'Ajout...' : 'Ajouter'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
