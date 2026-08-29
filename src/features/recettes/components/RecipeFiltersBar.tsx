import { CATEGORIES } from '../types'
import type { RecipeFilters } from '../types'

export function RecipeFiltersBar({
  filters,
  onChange,
}: {
  filters: RecipeFilters
  onChange: (filters: RecipeFilters) => void
}) {
  return (
    <div className="space-y-2">
      <input
        type="search"
        placeholder="Rechercher une recette..."
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap gap-2">
        <select
          value={filters.categorie}
          onChange={(e) => onChange({ ...filters, categorie: e.target.value as RecipeFilters['categorie'] })}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="toutes">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onChange({ ...filters, transportable: !filters.transportable })}
          className={`rounded-md border px-2 py-1.5 text-sm ${
            filters.transportable
              ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
              : 'border-neutral-300 text-neutral-600'
          }`}
        >
          Transportable
        </button>
      </div>
    </div>
  )
}
