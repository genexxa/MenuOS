import { Link } from 'react-router-dom'
import { CATEGORIES } from '../types'
import type { Recipe } from '../types'

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const categorieLabel = CATEGORIES.find((c) => c.value === recipe.categorie)?.label

  return (
    <Link
      to={`/recettes/${recipe.id}`}
      className="block rounded-lg border border-neutral-200 bg-white p-4 shadow-sm active:bg-neutral-50"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium">{recipe.nom}</h3>
        {recipe.transportable && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
            Transportable
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        {categorieLabel} · {recipe.temps_total_minutes} min · {recipe.portions_base} portions
      </p>
      {recipe.proteines_par_portion != null && (
        <p className="mt-1 text-xs text-neutral-400">{recipe.proteines_par_portion} g protéines / portion</p>
      )}
    </Link>
  )
}
