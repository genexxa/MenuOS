import { useMemo, useState } from 'react'
import { useCreateIngredient, useStoreSections } from '../hooks'
import type { Ingredient, UniteBase } from '../types'

export function IngredientCombobox({
  householdId,
  ingredients,
  value,
  onSelect,
  initialQuery,
}: {
  householdId: string | undefined
  ingredients: Ingredient[]
  value: Ingredient | null
  onSelect: (ingredient: Ingredient) => void
  /** Pré-remplit la recherche (ex : nom extrait par l'import IA) sans présélectionner d'ingrédient. */
  initialQuery?: string
}) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newUniteBase, setNewUniteBase] = useState<UniteBase>('g')
  const [newRayonId, setNewRayonId] = useState('')

  const { data: storeSections } = useStoreSections(householdId)
  const createIngredient = useCreateIngredient(householdId)

  const matches = useMemo(() => {
    if (!query.trim()) return ingredients.slice(0, 8)
    const q = query.toLowerCase()
    return ingredients.filter((i) => i.nom.toLowerCase().includes(q)).slice(0, 8)
  }, [ingredients, query])

  const exactMatch = ingredients.some((i) => i.nom.toLowerCase() === query.trim().toLowerCase())

  async function handleCreate() {
    const ingredient = await createIngredient.mutateAsync({
      nom: query.trim(),
      unite_base: newUniteBase,
      rayon_id: newRayonId || null,
    })
    onSelect(ingredient)
    setCreating(false)
    setOpen(false)
    setQuery('')
  }

  if (value && !open) {
    return (
      <button
        type="button"
        onClick={() => {
          setQuery(value.nom)
          setOpen(true)
        }}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-left text-sm"
      >
        {value.nom}
      </button>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Chercher un ingrédient..."
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-md">
          {matches.map((ingredient) => (
            <button
              key={ingredient.id}
              type="button"
              onClick={() => {
                onSelect(ingredient)
                setOpen(false)
                setQuery('')
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
            >
              {ingredient.nom}
            </button>
          ))}

          {query.trim() && !exactMatch && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="block w-full px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50"
            >
              + Créer « {query.trim()} »
            </button>
          )}

          {creating && (
            <div className="space-y-2 border-t border-neutral-100 p-3">
              <div className="flex gap-2">
                <select
                  value={newUniteBase}
                  onChange={(e) => setNewUniteBase(e.target.value as UniteBase)}
                  className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                >
                  <option value="g">Poids (g)</option>
                  <option value="ml">Volume (ml)</option>
                  <option value="unite">Compté (unité)</option>
                </select>
                <select
                  value={newRayonId}
                  onChange={(e) => setNewRayonId(e.target.value)}
                  className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                >
                  <option value="">Rayon...</option>
                  {storeSections?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleCreate}
                disabled={createIngredient.isPending}
                className="w-full rounded-md bg-neutral-900 px-2 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {createIngredient.isPending ? 'Création...' : 'Créer et sélectionner'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
