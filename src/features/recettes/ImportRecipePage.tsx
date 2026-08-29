import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentMember } from '../../lib/household'
import { supabase } from '../../lib/supabase'
import type { ImportedRecipe } from './types'

export function ImportRecipePage() {
  const navigate = useNavigate()
  const { data: member } = useCurrentMember()
  const [mode, setMode] = useState<'url' | 'texte'>('url')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim() || !member) return
    setLoading(true)
    setError(null)

    const { data, error: fnError } = await supabase.functions.invoke<ImportedRecipe>('import-recipe', {
      body: { household_id: member.household_id, source: mode, content: content.trim() },
    })

    setLoading(false)
    if (fnError || !data) {
      setError(fnError?.message ?? "L'import a échoué.")
      return
    }

    navigate('/recettes/nouvelle', { state: { imported: data } })
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <h1 className="text-lg font-semibold">Importer une recette</h1>
      <p className="text-sm text-neutral-500">
        Colle une URL ou le texte d'une recette. L'IA l'analyse et pré-remplit le formulaire — tu pourras tout
        vérifier et ajuster avant d'enregistrer.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-1 rounded-md bg-neutral-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`flex-1 rounded-md py-1.5 ${mode === 'url' ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
          >
            URL
          </button>
          <button
            type="button"
            onClick={() => setMode('texte')}
            className={`flex-1 rounded-md py-1.5 ${mode === 'texte' ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
          >
            Texte brut
          </button>
        </div>

        {mode === 'url' ? (
          <input
            type="url"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            required
          />
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Colle ici le texte complet de la recette (ingrédients + étapes)..."
            rows={10}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            required
          />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Analyse en cours...' : 'Analyser'}
        </button>
      </form>
    </div>
  )
}
