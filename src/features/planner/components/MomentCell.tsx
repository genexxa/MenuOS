import { useDroppable } from '@dnd-kit/core'
import { EntryCard } from './EntryCard'
import type { MealPlanEntry, Moment } from '../types'

export function MomentCell({
  date,
  moment,
  entries,
  onAdd,
  onEditEntry,
}: {
  date: string
  moment: Moment
  entries: MealPlanEntry[]
  onAdd: () => void
  onEditEntry: (entry: MealPlanEntry) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${date}|${moment}` })

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[64px] space-y-1 rounded-md border border-dashed p-1.5 ${
        isOver ? 'border-neutral-400 bg-neutral-100' : 'border-neutral-200'
      }`}
    >
      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} onClick={() => onEditEntry(entry)} />
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="w-full rounded-md py-1 text-xs text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600"
      >
        + Ajouter
      </button>
    </div>
  )
}
