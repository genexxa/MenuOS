import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentMember } from '../../lib/household'
import { RecipeCard } from './components/RecipeCard'
import { RecipeFiltersBar } from './components/RecipeFiltersBar'
import { useRecipes } from './hooks'
import type { RecipeFilters } from './types'

const DEFAULT_FILTERS: RecipeFilters = { search: '', categorie: 'toutes', transportable: false }

export function RecipesListPage() {
  const { data: member } = useCurrentMember()
  const [filters, setFilters] = useState<RecipeFilters>(DEFAULT_FILTERS)
  const { data: recipes, isLoading, error } = useRecipes(member?.household_id, filters)

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Recettes</h1>
        <div className="flex gap-2">
          <Link
            to="/recettes/importer"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700"
          >
            Importer
          </Link>
          <Link
            to="/recettes/nouvelle"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            + Nouvelle
          </Link>
        </div>
      </div>

      <RecipeFiltersBar filters={filters} onChange={setFilters} />

      {isLoading && <p className="text-sm text-neutral-500">Chargement...</p>}
      {error && <p className="text-sm text-red-600">Erreur : {(error as Error).message}</p>}
      {recipes && recipes.length === 0 && (
        <p className="text-sm text-neutral-500">Aucune recette ne correspond à ces critères.</p>
      )}

      <div className="space-y-2">
        {recipes?.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </div>
  )
}
