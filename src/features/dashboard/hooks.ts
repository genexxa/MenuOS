import { useQuery } from '@tanstack/react-query'
import { computeAlerts } from './api'

export function useAlerts(householdId: string | undefined) {
  return useQuery({
    queryKey: ['alerts', householdId],
    queryFn: () => computeAlerts(householdId!),
    enabled: !!householdId,
    staleTime: 60_000,
  })
}
