import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import type { EntryFormValues, Moment } from './types'

export function useMealPlan(householdId: string | undefined, semaineDebut: string) {
  return useQuery({
    queryKey: ['meal-plan', householdId, semaineDebut],
    queryFn: () => api.getOrCreateMealPlan(householdId!, semaineDebut),
    enabled: !!householdId,
  })
}

export function useEntries(mealPlanId: string | undefined) {
  return useQuery({
    queryKey: ['meal-plan-entries', mealPlanId],
    queryFn: () => api.listEntries(mealPlanId!),
    enabled: !!mealPlanId,
  })
}

export function useAvailableLeftovers(householdId: string | undefined) {
  return useQuery({
    queryKey: ['available-leftovers', householdId],
    queryFn: () => api.listAvailableLeftovers(householdId!),
    enabled: !!householdId,
  })
}

function useInvalidateEntries(mealPlanId: string | undefined, householdId: string | undefined) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['meal-plan-entries', mealPlanId] })
    queryClient.invalidateQueries({ queryKey: ['available-leftovers', householdId] })
    queryClient.invalidateQueries({ queryKey: ['pantry'] })
  }
}

export function useCreateEntry(mealPlanId: string | undefined, householdId: string | undefined) {
  const invalidate = useInvalidateEntries(mealPlanId, householdId)
  return useMutation({
    mutationFn: (values: EntryFormValues) => api.createEntry(mealPlanId!, values),
    onSuccess: invalidate,
  })
}

export function useUpdateEntry(mealPlanId: string | undefined, householdId: string | undefined) {
  const invalidate = useInvalidateEntries(mealPlanId, householdId)
  return useMutation({
    mutationFn: ({
      id,
      values,
      previousLeftoverId,
    }: {
      id: string
      values: EntryFormValues
      previousLeftoverId: string | null
    }) => api.updateEntry(id, values, previousLeftoverId),
    onSuccess: invalidate,
  })
}

export function useDeleteEntry(mealPlanId: string | undefined, householdId: string | undefined) {
  const invalidate = useInvalidateEntries(mealPlanId, householdId)
  return useMutation({
    mutationFn: ({ id, leftoverId }: { id: string; leftoverId: string | null }) => api.deleteEntry(id, leftoverId),
    onSuccess: invalidate,
  })
}

export function useMoveEntry(mealPlanId: string | undefined, householdId: string | undefined) {
  const invalidate = useInvalidateEntries(mealPlanId, householdId)
  return useMutation({
    mutationFn: ({ id, date, moment }: { id: string; date: string; moment: Moment }) =>
      api.moveEntry(id, date, moment),
    onSuccess: invalidate,
  })
}

export function useMarkCooked(mealPlanId: string | undefined, householdId: string | undefined) {
  const invalidate = useInvalidateEntries(mealPlanId, householdId)
  return useMutation({
    mutationFn: (id: string) => api.markCooked(id),
    onSuccess: invalidate,
  })
}

export function useGenerateWeeklyPlan(householdId: string | undefined, semaineDebut: string) {
  return useMutation({
    mutationFn: () => api.generateWeeklyPlan(householdId!, semaineDebut),
  })
}

export function useApplyGeneratedEntries(mealPlanId: string | undefined, householdId: string | undefined) {
  const invalidate = useInvalidateEntries(mealPlanId, householdId)
  return useMutation({
    mutationFn: (entries: api.GeneratedEntry[]) => api.applyGeneratedEntries(mealPlanId!, entries),
    onSuccess: invalidate,
  })
}

export function usePrepTasksForEntry(mealPlanEntryId: string | undefined) {
  return useQuery({
    queryKey: ['prep-tasks', mealPlanEntryId],
    queryFn: () => api.listPrepTasksForEntry(mealPlanEntryId!),
    enabled: !!mealPlanEntryId,
  })
}

export function useCreatePrepTask(householdId: string | undefined, mealPlanEntryId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: { type: import('./types').PrepTaskType; date_a_faire: string; note: string | null }) =>
      api.createPrepTask(householdId!, mealPlanEntryId!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prep-tasks', mealPlanEntryId] })
      queryClient.invalidateQueries({ queryKey: ['prep-tasks-today'] })
    },
  })
}

export function useTogglePrepTaskDone(mealPlanEntryId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: 'a_faire' | 'fait' }) => api.togglePrepTaskDone(id, statut),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prep-tasks', mealPlanEntryId] })
      queryClient.invalidateQueries({ queryKey: ['prep-tasks-today'] })
    },
  })
}

export function useDeletePrepTask(mealPlanEntryId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deletePrepTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prep-tasks', mealPlanEntryId] })
      queryClient.invalidateQueries({ queryKey: ['prep-tasks-today'] })
    },
  })
}
