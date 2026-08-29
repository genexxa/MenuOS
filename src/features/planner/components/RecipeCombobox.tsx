import { useState } from 'react'
import { useRecipes } from '../../recettes/hooks'
import type { Recipe } from '../../recettes/types'

const NO_FILTER = { search: '', categorie: 'toutes' as const, transportable: false }

export function RecipeCombobox({
  householdId,
  value,
  onSelect,
}: {
  householdId: string | undefined
  value: { id: string; nom: string } | null
  onSelect: (recipe: Recipe) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const { data: recipes } = useRecipes(householdId, { ...NO_FILTER, search: query })

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
        placeholder="Chercher une recette..."
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      {open && recipes && recipes.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-md">
          {recipes.map((recipe) => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => {
                onSelect(recipe)
                setOpen(false)
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
            >
              {recipe.nom}
              <span className="ml-1 text-xs text-neutral-400">{recipe.portions_base} portions</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
