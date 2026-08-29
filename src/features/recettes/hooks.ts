import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import type { Ingredient, RecipeFilters, RecipeFormValues } from './types'

export function useRecipes(householdId: string | undefined, filters: RecipeFilters) {
  return useQuery({
    queryKey: ['recipes', householdId, filters],
    queryFn: () => api.listRecipes(householdId!, filters),
    enabled: !!householdId,
  })
}

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.getRecipe(id!),
    enabled: !!id,
  })
}

export function useIngredients(householdId: string | undefined) {
  return useQuery({
    queryKey: ['ingredients', householdId],
    queryFn: () => api.listIngredients(householdId!),
    enabled: !!householdId,
  })
}

export function useStoreSections(householdId: string | undefined) {
  return useQuery({
    queryKey: ['store-sections', householdId],
    queryFn: () => api.listStoreSections(householdId!),
    enabled: !!householdId,
  })
}

export function useCreateRecipe(householdId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: RecipeFormValues) => api.createRecipe(householdId!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', householdId] })
    },
  })
}

export function useUpdateRecipe(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: RecipeFormValues) => api.updateRecipe(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', id] })
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
    },
  })
}

export function useArchiveRecipe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.archiveRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
    },
  })
}

export function useCreateIngredient(householdId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { nom: string; unite_base: Ingredient['unite_base']; rayon_id: string | null }) =>
      api.createIngredient(householdId!, input.nom, input.unite_base, input.rayon_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients', householdId] })
    },
  })
}
