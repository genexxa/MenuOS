import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import type { Emplacement } from './types'

export function usePantry(householdId: string | undefined) {
  return useQuery({
    queryKey: ['pantry', householdId],
    queryFn: () => api.listPantry(householdId!),
    enabled: !!householdId,
  })
}

export function useUnitConversions() {
  return useQuery({
    queryKey: ['unit-conversions'],
    queryFn: api.listUnitConversions,
    staleTime: Infinity,
  })
}

export function useSavePantryItem(householdId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      id?: string
      ingredient_id: string
      quantite: number
      unite: string
      emplacement: Emplacement
      date_peremption: string | null
    }) => {
      const { id, ...values } = input
      return id ? api.updatePantryItem(id, values) : api.createPantryItem(householdId!, values)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pantry', householdId] }),
  })
}

export function useDeletePantryItem(householdId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deletePantryItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pantry', householdId] }),
  })
}

export function useGroceryList(householdId: string | undefined, mealPlanId: string | undefined) {
  return useQuery({
    queryKey: ['grocery-list', mealPlanId],
    queryFn: () => api.getOrCreateGroceryList(householdId!, mealPlanId!),
    enabled: !!householdId && !!mealPlanId,
  })
}

export function useGroceryItems(groceryListId: string | undefined) {
  return useQuery({
    queryKey: ['grocery-items', groceryListId],
    queryFn: () => api.listGroceryItems(groceryListId!),
    enabled: !!groceryListId,
  })
}

export function useGenerateGroceryList(householdId: string | undefined, mealPlanId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.generateGroceryList(householdId!, mealPlanId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-list', mealPlanId] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
    },
  })
}

export function useToggleItemChecked(groceryListId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, coche }: { id: string; coche: boolean }) => api.toggleItemChecked(id, coche),
    onMutate: async ({ id, coche }) => {
      const key = ['grocery-items', groceryListId]
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, (old: Awaited<ReturnType<typeof api.listGroceryItems>> | undefined) =>
        old?.map((item) => (item.id === id ? { ...item, coche } : item)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['grocery-items', groceryListId], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['grocery-items', groceryListId] }),
  })
}

export function useAddManualItem(groceryListId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: { ingredient_id: string | null; nom_libre: string | null; quantite: number; unite: string; rayon_id: string | null }) =>
      api.addManualItem(groceryListId!, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grocery-items', groceryListId] }),
  })
}

export function useDeleteGroceryItem(groceryListId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteGroceryItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grocery-items', groceryListId] }),
  })
}
