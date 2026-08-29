import { useCurrentMember } from '../../lib/household'
import { supabase } from '../../lib/supabase'
import { AlertsPanel } from './components/AlertsPanel'

export function DashboardPage() {
  const { data: member } = useCurrentMember()

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">MenuOS</h1>
          {member && <p className="text-sm text-neutral-500">Bonjour {member.nom}</p>}
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="text-sm text-neutral-500 underline"
        >
          Déconnexion
        </button>
      </div>

      <AlertsPanel householdId={member?.household_id} />
    </div>
  )
}
