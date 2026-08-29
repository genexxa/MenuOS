import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { CATEGORIES, UNITE_LABELS } from './types'
import { useArchiveRecipe, useRecipe } from './hooks'
import { PortionScaler } from './components/PortionScaler'
import { scaleQuantity } from './scaling'

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: recipe, isLoading, error } = useRecipe(id)
  const archiveRecipe = useArchiveRecipe()
  const [portions, setPortions] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (isLoading) return <p className="px-4 py-4 text-sm text-neutral-500">Chargement...</p>
  if (error) return <p className="px-4 py-4 text-sm text-red-600">Erreur : {(error as Error).message}</p>
  if (!recipe) return null

  const portionsCible = portions ?? recipe.portions_base
  const categorieLabel = CATEGORIES.find((c) => c.value === recipe.categorie)?.label

  async function handleArchive() {
    await archiveRecipe.mutateAsync(recipe!.id)
    navigate('/recettes')
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{recipe.nom}</h1>
          <p className="text-sm text-neutral-500">
            {categorieLabel} · {recipe.temps_total_minutes} min
            {recipe.transportable ? ' · Transportable' : ''}
          </p>
        </div>
        <Link
          to={`/recettes/${recipe.id}/modifier`}
          className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        >
          Modifier
        </Link>
      </div>

      {recipe.description && <p className="text-sm text-neutral-700">{recipe.description}</p>}

      <PortionScaler portions={portionsCible} onChange={setPortions} />

      <section>
        <h2 className="mb-2 text-sm font-semibold">Ingrédients</h2>
        <ul className="space-y-1">
          {recipe.recipe_ingredients
            .sort((a, b) => a.ordre - b.ordre)
            .map((ri) => (
              <li key={ri.id} className="flex justify-between text-sm">
                <span>
                  {ri.ingredient.nom}
                  {ri.optionnel && <span className="text-neutral-400"> (optionnel)</span>}
                </span>
                <span className="text-neutral-500">
                  {scaleQuantity(ri.quantite, recipe.portions_base, portionsCible)} {UNITE_LABELS[ri.unite] ?? ri.unite}
                </span>
              </li>
            ))}
        </ul>
      </section>

      {recipe.etapes_preparation.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Préparation</h2>
          <ol className="list-decimal space-y-2 pl-4">
            {recipe.etapes_preparation.map((etape, i) => (
              <li key={i} className="text-sm text-neutral-700">
                {etape}
              </li>
            ))}
          </ol>
        </section>
      )}

      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {recipe.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
              {tag}
            </span>
          ))}
        </div>
      )}

      <button type="button" onClick={() => setConfirmOpen(true)} className="text-sm text-red-600">
        Retirer cette recette
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Retirer cette recette ?"
        description={`« ${recipe.nom} » ne sera plus proposée dans le planificateur, mais reste liée à l'historique des plans passés.`}
        confirmLabel="Retirer"
        destructive
        onConfirm={handleArchive}
      />
    </div>
  )
}
