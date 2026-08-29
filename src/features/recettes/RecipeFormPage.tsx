import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useCurrentMember } from '../../lib/household'
import { IngredientCombobox } from './components/IngredientCombobox'
import { useCreateRecipe, useIngredients, useRecipe, useUpdateRecipe } from './hooks'
import { CATEGORIES, SAISONS, UNITE_LABELS, UNITES } from './types'
import type { ImportedRecipe, Ingredient, RecipeFormValues, Saison } from './types'

interface IngredientRow {
  key: string
  ingredient: Ingredient | null
  quantite: number
  unite: string
  optionnel: boolean
  note: string
  /** Nom extrait par l'import IA, affiché tant qu'aucun ingrédient n'est confirmé. */
  hintNom?: string
}

function emptyRow(): IngredientRow {
  return { key: crypto.randomUUID(), ingredient: null, quantite: 0, unite: 'g', optionnel: false, note: '' }
}

const EMPTY_FORM: RecipeFormValues = {
  nom: '',
  description: '',
  portions_base: 4,
  temps_prepa_minutes: 10,
  temps_cuisson_minutes: 15,
  categorie: 'souper',
  tags: [],
  etapes_preparation: [],
  transportable: false,
  batch_cooking_friendly: false,
  proteines_par_portion: null,
  calories_par_portion: null,
  saison: ['toute_annee'],
  cout_estime: null,
  source_url: null,
  ingredients: [],
}

export function RecipeFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const location = useLocation()
  const imported = (location.state as { imported?: ImportedRecipe } | null)?.imported
  const { data: member } = useCurrentMember()
  const { data: existing } = useRecipe(id)
  const { data: ingredientsCatalog } = useIngredients(member?.household_id)

  const createRecipe = useCreateRecipe(member?.household_id)
  const updateRecipe = useUpdateRecipe(id ?? '')

  const [form, setForm] = useState<RecipeFormValues>(EMPTY_FORM)
  const [rows, setRows] = useState<IngredientRow[]>([emptyRow()])
  const [etapeInput, setEtapeInput] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!existing) return
    setForm({
      nom: existing.nom,
      description: existing.description ?? '',
      portions_base: existing.portions_base,
      temps_prepa_minutes: existing.temps_prepa_minutes,
      temps_cuisson_minutes: existing.temps_cuisson_minutes,
      categorie: existing.categorie,
      tags: existing.tags,
      etapes_preparation: existing.etapes_preparation,
      transportable: existing.transportable,
      batch_cooking_friendly: existing.batch_cooking_friendly,
      proteines_par_portion: existing.proteines_par_portion,
      calories_par_portion: existing.calories_par_portion,
      saison: existing.saison,
      cout_estime: existing.cout_estime,
      source_url: existing.source_url,
      ingredients: [],
    })
    setRows(
      existing.recipe_ingredients.length > 0
        ? existing.recipe_ingredients
            .sort((a, b) => a.ordre - b.ordre)
            .map((ri) => ({
              key: ri.id,
              ingredient: ri.ingredient,
              quantite: ri.quantite,
              unite: ri.unite,
              optionnel: ri.optionnel,
              note: ri.note ?? '',
            }))
        : [emptyRow()],
    )
  }, [existing])

  useEffect(() => {
    if (!imported || isEditing) return
    setForm({
      nom: imported.nom,
      description: imported.description ?? '',
      portions_base: imported.portions_base,
      temps_prepa_minutes: imported.temps_prepa_minutes,
      temps_cuisson_minutes: imported.temps_cuisson_minutes,
      categorie: imported.categorie,
      tags: imported.tags,
      etapes_preparation: imported.etapes_preparation,
      transportable: imported.transportable,
      batch_cooking_friendly: imported.batch_cooking_friendly,
      proteines_par_portion: imported.proteines_par_portion,
      calories_par_portion: imported.calories_par_portion,
      saison: imported.saison,
      cout_estime: imported.cout_estime,
      source_url: imported.source_url,
      ingredients: [],
    })
    setRows(
      imported.ingredients.map((ing) => ({
        key: crypto.randomUUID(),
        ingredient: ing.matched_ingredient_id
          ? { id: ing.matched_ingredient_id, nom: ing.matched_ingredient_nom!, unite_base: ing.matched_unite_base!, rayon_id: null }
          : null,
        quantite: ing.quantite,
        unite: ing.unite,
        optionnel: false,
        note: '',
        hintNom: ing.matched_ingredient_id ? undefined : ing.nom,
      })),
    )
    // Ne réagit qu'à l'arrivée initiale des données importées, pas à isEditing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imported])

  function updateRow(key: string, patch: Partial<IngredientRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  function addEtape() {
    if (!etapeInput.trim()) return
    setForm((f) => ({ ...f, etapes_preparation: [...f.etapes_preparation, etapeInput.trim()] }))
    setEtapeInput('')
  }

  function removeEtape(index: number) {
    setForm((f) => ({ ...f, etapes_preparation: f.etapes_preparation.filter((_, i) => i !== index) }))
  }

  function addTag() {
    if (!tagInput.trim() || form.tags.includes(tagInput.trim())) return
    setForm((f) => ({ ...f, tags: [...f.tags, tagInput.trim()] }))
    setTagInput('')
  }

  function removeTag(tag: string) {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))
  }

  function toggleSaison(s: Saison) {
    setForm((f) => {
      const has = f.saison.includes(s)
      const next = has ? f.saison.filter((x) => x !== s) : [...f.saison, s]
      return { ...f, saison: next.length > 0 ? next : ['toute_annee'] }
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.nom.trim()) {
      setError('Le nom de la recette est requis.')
      return
    }

    const validRows = rows.filter((r) => r.ingredient && r.quantite > 0)
    const values: RecipeFormValues = {
      ...form,
      ingredients: validRows.map((r) => ({
        ingredient_id: r.ingredient!.id,
        quantite: r.quantite,
        unite: r.unite,
        optionnel: r.optionnel,
        note: r.note.trim() || null,
      })),
    }

    try {
      if (isEditing) {
        await updateRecipe.mutateAsync(values)
        navigate(`/recettes/${id}`)
      } else {
        const newId = await createRecipe.mutateAsync(values)
        navigate(`/recettes/${newId}`)
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const saving = createRecipe.isPending || updateRecipe.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-5 px-4 py-4">
      <h1 className="text-lg font-semibold">{isEditing ? 'Modifier la recette' : 'Nouvelle recette'}</h1>

      <div className="space-y-1">
        <label className="text-sm font-medium">Nom</label>
        <input
          value={form.nom}
          onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Portions</label>
          <input
            type="number"
            min={1}
            value={form.portions_base}
            onChange={(e) => setForm((f) => ({ ...f, portions_base: Number(e.target.value) }))}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Prépa (min)</label>
          <input
            type="number"
            min={0}
            value={form.temps_prepa_minutes}
            onChange={(e) => setForm((f) => ({ ...f, temps_prepa_minutes: Number(e.target.value) }))}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Cuisson (min)</label>
          <input
            type="number"
            min={0}
            value={form.temps_cuisson_minutes}
            onChange={(e) => setForm((f) => ({ ...f, temps_cuisson_minutes: Number(e.target.value) }))}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Catégorie</label>
        <select
          value={form.categorie}
          onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value as typeof f.categorie }))}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.transportable}
            onChange={(e) => setForm((f) => ({ ...f, transportable: e.target.checked }))}
          />
          Transportable
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.batch_cooking_friendly}
            onChange={(e) => setForm((f) => ({ ...f, batch_cooking_friendly: e.target.checked }))}
          />
          Batch cooking
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Protéines (g)</label>
          <input
            type="number"
            value={form.proteines_par_portion ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, proteines_par_portion: e.target.value ? Number(e.target.value) : null }))
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Calories</label>
          <input
            type="number"
            value={form.calories_par_portion ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, calories_par_portion: e.target.value ? Number(e.target.value) : null }))
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Coût estimé ($)</label>
          <input
            type="number"
            step="0.01"
            value={form.cout_estime ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, cout_estime: e.target.value ? Number(e.target.value) : null }))}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Saison</label>
        <div className="flex flex-wrap gap-2">
          {SAISONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => toggleSaison(s.value)}
              className={`rounded-full border px-3 py-1 text-xs ${
                form.saison.includes(s.value)
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-300 text-neutral-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <section className="space-y-2">
        <label className="text-sm font-medium">Ingrédients</label>
        {rows.map((row) => (
          <div key={row.key} className="space-y-1">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <IngredientCombobox
                  householdId={member?.household_id}
                  ingredients={ingredientsCatalog ?? []}
                  value={row.ingredient}
                  onSelect={(ingredient) => updateRow(row.key, { ingredient, hintNom: undefined })}
                  initialQuery={row.hintNom}
                />
              </div>
              <input
                type="number"
                step="0.01"
                placeholder="Qté"
                value={row.quantite || ''}
                onChange={(e) => updateRow(row.key, { quantite: Number(e.target.value) })}
                className="w-16 rounded-md border border-neutral-300 px-2 py-2 text-sm"
              />
              <select
                value={row.unite}
                onChange={(e) => updateRow(row.key, { unite: e.target.value })}
                className="w-24 rounded-md border border-neutral-300 px-1 py-2 text-sm"
              >
                {UNITES.map((u) => (
                  <option key={u} value={u}>
                    {UNITE_LABELS[u]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="px-2 py-2 text-sm text-red-600"
                aria-label="Retirer l’ingrédient"
              >
                ✕
              </button>
            </div>
            {row.hintNom && !row.ingredient && (
              <p className="pl-1 text-xs text-amber-700">
                Suggéré par l'IA : « {row.hintNom} » — choisis une correspondance ou crée l'ingrédient.
              </p>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
          className="text-sm text-neutral-600 underline"
        >
          + Ajouter un ingrédient
        </button>
      </section>

      <section className="space-y-2">
        <label className="text-sm font-medium">Étapes de préparation</label>
        <ol className="list-decimal space-y-1 pl-4">
          {form.etapes_preparation.map((etape, i) => (
            <li key={i} className="flex items-start justify-between gap-2 text-sm">
              <span>{etape}</span>
              <button type="button" onClick={() => removeEtape(i)} className="shrink-0 text-red-600">
                ✕
              </button>
            </li>
          ))}
        </ol>
        <div className="flex gap-2">
          <input
            value={etapeInput}
            onChange={(e) => setEtapeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addEtape()
              }
            }}
            placeholder="Décrire une étape..."
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button type="button" onClick={addEtape} className="rounded-md border border-neutral-300 px-3 text-sm">
            Ajouter
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <label className="text-sm font-medium">Tags</label>
        <div className="flex flex-wrap gap-1">
          {form.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
            >
              {tag} ✕
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
            placeholder="Ajouter un tag..."
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button type="button" onClick={addTag} className="rounded-md border border-neutral-300 px-3 text-sm">
            Ajouter
          </button>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? 'Enregistrement...' : isEditing ? 'Enregistrer les modifications' : 'Créer la recette'}
      </button>
    </form>
  )
}
