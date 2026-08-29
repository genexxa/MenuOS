import { Link } from 'react-router-dom'
import { useAlerts } from '../hooks'
import type { Alert } from '../types'

const SEVERITY_STYLES: Record<Alert['severity'], string> = {
  urgent: 'border-red-200 bg-red-50',
  warning: 'border-amber-200 bg-amber-50',
  info: 'border-neutral-200 bg-white',
}

const SEVERITY_DOT: Record<Alert['severity'], string> = {
  urgent: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-neutral-400',
}

export function AlertsPanel({ householdId }: { householdId: string | undefined }) {
  const { data: alerts, isLoading } = useAlerts(householdId)

  if (isLoading) {
    return <p className="text-sm text-neutral-500">Vérification en cours...</p>
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
        Rien à signaler — tout est sous contrôle.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <Link
          key={alert.id}
          to={alert.actionTo}
          className={`block rounded-lg border p-3 ${SEVERITY_STYLES[alert.severity]}`}
        >
          <div className="flex items-start gap-2">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[alert.severity]}`} />
            <div className="flex-1">
              <p className="text-sm font-medium">{alert.titre}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{alert.description}</p>
              <p className="mt-1 text-xs font-medium text-neutral-700">{alert.actionLabel} →</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
