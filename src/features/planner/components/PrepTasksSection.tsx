import { useState } from 'react'
import { useCreatePrepTask, useDeletePrepTask, usePrepTasksForEntry, useTogglePrepTaskDone } from '../hooks'
import { PREP_TASK_TYPES } from '../types'
import type { PrepTaskType } from '../types'

export function PrepTasksSection({
  householdId,
  mealPlanEntryId,
  entryDate,
}: {
  householdId: string | undefined
  mealPlanEntryId: string
  entryDate: string
}) {
  const { data: tasks } = usePrepTasksForEntry(mealPlanEntryId)
  const createTask = useCreatePrepTask(householdId, mealPlanEntryId)
  const toggleDone = useTogglePrepTaskDone(mealPlanEntryId)
  const deleteTask = useDeletePrepTask(mealPlanEntryId)

  const veille = new Date(`${entryDate}T00:00:00`)
  veille.setDate(veille.getDate() - 1)
  const veilleStr = veille.toISOString().slice(0, 10)

  const [adding, setAdding] = useState(false)
  const [type, setType] = useState<PrepTaskType>('decongeler')
  const [dateAFaire, setDateAFaire] = useState(veilleStr)

  async function handleAdd() {
    await createTask.mutateAsync({ type, date_a_faire: dateAFaire, note: null })
    setAdding(false)
    setType('decongeler')
    setDateAFaire(veilleStr)
  }

  return (
    <div className="space-y-2 border-t border-neutral-100 pt-3">
      <p className="text-xs font-medium text-neutral-500">Tâches de prépa</p>

      {tasks?.map((task) => (
        <div key={task.id} className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => toggleDone.mutate({ id: task.id, statut: task.statut === 'fait' ? 'a_faire' : 'fait' })}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-xs ${
              task.statut === 'fait' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-neutral-300'
            }`}
          >
            {task.statut === 'fait' && '✓'}
          </button>
          <span className={task.statut === 'fait' ? 'text-neutral-400 line-through' : ''}>
            {PREP_TASK_TYPES.find((t) => t.value === task.type)?.label} — {task.date_a_faire}
          </span>
          <button type="button" onClick={() => deleteTask.mutate(task.id)} className="ml-auto text-neutral-300">
            ✕
          </button>
        </div>
      ))}

      {adding ? (
        <div className="flex items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PrepTaskType)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          >
            {PREP_TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateAFaire}
            onChange={(e) => setDateAFaire(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={createTask.isPending}
            className="rounded-md bg-neutral-900 px-2 py-1 text-sm text-white disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="text-sm text-neutral-500 underline">
          + Tâche de prépa
        </button>
      )}
    </div>
  )
}
