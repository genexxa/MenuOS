import { addDays, format, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'

export function getWeekStart(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

export function shiftWeek(semaineDebut: string, weeks: number): string {
  const date = addDays(new Date(`${semaineDebut}T00:00:00`), weeks * 7)
  return format(date, 'yyyy-MM-dd')
}

export function weekDays(semaineDebut: string): string[] {
  const start = new Date(`${semaineDebut}T00:00:00`)
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'))
}

export function formatDayLabel(dateStr: string): { weekday: string; dayMonth: string } {
  const date = new Date(`${dateStr}T00:00:00`)
  return {
    weekday: format(date, 'EEEE', { locale: fr }),
    dayMonth: format(date, 'd MMM', { locale: fr }),
  }
}

export function formatWeekRange(semaineDebut: string): string {
  const start = new Date(`${semaineDebut}T00:00:00`)
  const end = addDays(start, 6)
  return `${format(start, 'd MMM', { locale: fr })} – ${format(end, 'd MMM yyyy', { locale: fr })}`
}
