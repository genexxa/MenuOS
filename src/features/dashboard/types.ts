export type AlertSeverity = 'info' | 'warning' | 'urgent'

export interface Alert {
  id: string
  titre: string
  description: string
  severity: AlertSeverity
  actionLabel: string
  actionTo: string
}
