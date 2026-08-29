import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import { useCurrentMember } from '../../lib/household'
import { EntryDialog } from './components/EntryDialog'
import { GeneratePlanDialog } from './components/GeneratePlanDialog'
import { MomentCell } from './components/MomentCell'
import { useEntries, useMealPlan, useMoveEntry } from './hooks'
import { JOURS_LABELS, MOMENTS } from './types'
import type { MealPlanEntry, Moment } from './types'
import { formatDayLabel, formatWeekRange, getWeekStart, shiftWeek, weekDays } from './utils'

export function PlannerPage() {
  const { data: member } = useCurrentMember()
  const [semaineDebut, setSemaineDebut] = useState(() => getWeekStart(new Date()))
  const { data: plan } = useMealPlan(member?.household_id, semaineDebut)
  const { data: entries } = useEntries(plan?.id)
  const moveEntry = useMoveEntry(plan?.id, member?.household_id)
  const [generateOpen, setGenerateOpen] = useState(false)

  const [dialogTarget, setDialogTarget] = useState<{ date: string; moment: Moment; entry: MealPlanEntry | null } | null>(
    null,
  )

  const days = useMemo(() => weekDays(semaineDebut), [semaineDebut])

  const entriesByCell = useMemo(() => {
    const map = new Map<string, MealPlanEntry[]>()
    for (const entry of entries ?? []) {
      const key = `${entry.date}|${entry.moment}`
      map.set(key, [...(map.get(key) ?? []), entry])
    }
    return map
  }, [entries])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const [date, moment] = String(over.id).split('|') as [string, Moment]
    moveEntry.mutate({ id: String(active.id), date, moment })
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Planificateur</h1>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setSemaineDebut((s) => shiftWeek(s, -1))}
            className="rounded-md border border-neutral-300 px-2 py-1"
          >
            ←
          </button>
          <span className="text-neutral-600">{formatWeekRange(semaineDebut)}</span>
          <button
            type="button"
            onClick={() => setSemaineDebut((s) => shiftWeek(s, 1))}
            className="rounded-md border border-neutral-300 px-2 py-1"
          >
            →
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setGenerateOpen(true)}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
      >
        Générer la semaine avec l'IA
      </button>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-cols-7 gap-2" style={{ minWidth: '980px' }}>
            {days.map((date, i) => {
              const { weekday, dayMonth } = formatDayLabel(date)
              return (
                <div key={date} className="space-y-2">
                  <div className="text-center">
                    <div className="text-xs font-medium capitalize">{JOURS_LABELS[i]}</div>
                    <div className="text-xs text-neutral-400">{dayMonth}</div>
                    <span className="sr-only">{weekday}</span>
                  </div>
                  {MOMENTS.map((m) => (
                    <MomentCell
                      key={m.value}
                      date={date}
                      moment={m.value}
                      entries={entriesByCell.get(`${date}|${m.value}`) ?? []}
                      onAdd={() => setDialogTarget({ date, moment: m.value, entry: null })}
                      onEditEntry={(entry) => setDialogTarget({ date, moment: m.value, entry })}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </DndContext>

      <div className="flex gap-3 text-xs text-neutral-400">
        {MOMENTS.map((m) => (
          <span key={m.value}>{m.label}</span>
        ))}
      </div>

      {dialogTarget && (
        <EntryDialog
          open={!!dialogTarget}
          onOpenChange={(open) => !open && setDialogTarget(null)}
          householdId={member?.household_id}
          mealPlanId={plan?.id}
          date={dialogTarget.date}
          moment={dialogTarget.moment}
          entry={dialogTarget.entry}
        />
      )}

      <GeneratePlanDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        householdId={member?.household_id}
        mealPlanId={plan?.id}
        semaineDebut={semaineDebut}
      />
    </div>
  )
}
