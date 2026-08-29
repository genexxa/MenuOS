import { useDraggable } from '@dnd-kit/core'
import type { MealPlanEntry } from '../types'

export function EntryCard({ entry, onClick }: { entry: MealPlanEntry; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: entry.id })

  const label = entry.recipe?.nom ?? entry.leftover?.recipe?.nom ?? entry.texte_libre ?? '—'
  const isReste = !!entry.leftover_id

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      type="button"
      onClick={onClick}
      className={`w-full rounded-md border px-2 py-1.5 text-left text-xs shadow-sm ${
        entry.statut === 'cuisine' ? 'border-emerald-300 bg-emerald-50' : 'border-neutral-200 bg-white'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-1">
        {entry.membre && (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.membre.couleur_affichage }}
          />
        )}
        <span className="truncate font-medium">{label}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-neutral-400">
        {isReste && <span>Reste</span>}
        <span>· {entry.portions_prevues} portion{entry.portions_prevues > 1 ? 's' : ''}</span>
        {entry.statut === 'cuisine' && <span className="text-emerald-600">· Cuisiné</span>}
      </div>
    </button>
  )
}
