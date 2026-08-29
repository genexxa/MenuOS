import { useQuery } from '@tanstack/react-query'
import { useAuth } from './auth'
import { supabase } from './supabase'

export interface HouseholdMember {
  id: string
  household_id: string
  nom: string
  est_adulte: boolean
  couleur_affichage: string
}

async function fetchCurrentMember(authUserId: string): Promise<HouseholdMember> {
  const { data, error } = await supabase
    .from('household_members')
    .select('id, household_id, nom, est_adulte, couleur_affichage')
    .eq('auth_user_id', authUserId)
    .single()

  if (error) throw error
  return data
}

export function useCurrentMember() {
  const { session } = useAuth()
  const authUserId = session?.user.id

  return useQuery({
    queryKey: ['current-member', authUserId],
    queryFn: () => fetchCurrentMember(authUserId!),
    enabled: !!authUserId,
  })
}

export function useHouseholdMembers(householdId: string | undefined) {
  return useQuery({
    queryKey: ['household-members', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('household_members')
        .select('id, household_id, nom, est_adulte, couleur_affichage')
        .eq('household_id', householdId!)
        .order('est_adulte', { ascending: false })
      if (error) throw error
      return data as HouseholdMember[]
    },
    enabled: !!householdId,
  })
}
