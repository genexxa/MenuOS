import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { getWeekStart, shiftWeek, weekDays } from '../planner/utils'
import type { Alert } from './types'

interface EntryLite {
  date: string
  moment: string
  membre_id: string | null
}

interface MemberLite {
  id: string
  nom: string
  est_adulte: boolean
}

async function fetchWeekEntries(householdId: string, semaineDebut: string): Promise<EntryLite[]> {
  const { data: plan } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('household_id', householdId)
    .eq('semaine_debut', semaineDebut)
    .maybeSingle()

  if (!plan) return []

  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select('date, moment, membre_id')
    .eq('meal_plan_id', plan.id)

  if (error) throw error
  return data as EntryLite[]
}

function jourLabel(dateStr: string): string {
  return format(new Date(`${dateStr}T00:00:00`), 'EEEE d MMM', { locale: fr })
}

export async function computeAlerts(householdId: string): Promise<Alert[]> {
  const alerts: Alert[] = []
  const now = new Date()
  const todayStr = format(now, 'yyyy-MM-dd')
  const semaineDebut = getWeekStart(now)
  const semaineSuivante = shiftWeek(semaineDebut, 1)

  const [entriesCetteSemaine, entriesSemaineSuivante, membres] = await Promise.all([
    fetchWeekEntries(householdId, semaineDebut),
    fetchWeekEntries(householdId, semaineSuivante),
    supabase
      .from('household_members')
      .select('id, nom, est_adulte')
      .eq('household_id', householdId)
      .then(({ data, error }) => {
        if (error) throw error
        return data as MemberLite[]
      }),
  ])

  // 1. Jours à venir sans repas planifié (reste de la semaine courante)
  const joursRestants = weekDays(semaineDebut).filter((d) => d >= todayStr)
  const joursVides = joursRestants.filter((d) => !entriesCetteSemaine.some((e) => e.date === d))
  if (joursVides.length > 0) {
    alerts.push({
      id: 'jours-vides',
      titre: `${joursVides.length} jour${joursVides.length > 1 ? 's' : ''} sans repas planifié`,
      description: joursVides.map(jourLabel).join(', '),
      severity: 'warning',
      actionLabel: 'Planifier',
      actionTo: '/planificateur',
    })
  }

  // 2. Lunchs non assignés pour demain, à partir de 18h la veille
  if (now.getHours() >= 18) {
    const demain = format(addDays(now, 1), 'yyyy-MM-dd')
    const toutesEntrees = demain >= semaineSuivante ? entriesSemaineSuivante : entriesCetteSemaine
    const dinersDemain = toutesEntrees.filter((e) => e.date === demain && e.moment === 'diner')
    const commun = dinersDemain.some((e) => e.membre_id === null)

    if (!commun) {
      const enfants = membres.filter((m) => !m.est_adulte)
      const nonCouverts = enfants.filter((enfant) => !dinersDemain.some((e) => e.membre_id === enfant.id))
      if (nonCouverts.length > 0) {
        alerts.push({
          id: 'lunchs-non-assignes',
          titre: 'Lunch de demain non assigné',
          description: `${nonCouverts.map((m) => m.nom).join(', ')} — rien de prévu pour le dîner de demain.`,
          severity: 'urgent',
          actionLabel: 'Assigner',
          actionTo: '/planificateur',
        })
      }
    }
  }

  // 3. Items périmés ou proches de la péremption (≤ 3 jours)
  const dansTroisJours = format(addDays(now, 3), 'yyyy-MM-dd')
  const { data: pantryExpirant, error: pantryError } = await supabase
    .from('pantry_items')
    .select('id, quantite, unite, date_peremption, ingredient:ingredients (id, nom)')
    .eq('household_id', householdId)
    .not('date_peremption', 'is', null)
    .lte('date_peremption', dansTroisJours)
    .order('date_peremption')

  if (pantryError) throw pantryError

  if (pantryExpirant && pantryExpirant.length > 0) {
    // deno-lint-ignore no-explicit-any
    const items = pantryExpirant as any[]
    const ingredientIds = items.map((i) => i.ingredient.id)
    const { data: suggestions } = await supabase
      .from('recipe_ingredients')
      .select('ingredient_id, recipe:recipes!inner (id, nom, actif)')
      .in('ingredient_id', ingredientIds)
      .eq('recipe.actif', true)

    const suggestionParIngredient = new Map<string, string>()
    // deno-lint-ignore no-explicit-any
    for (const s of (suggestions ?? []) as any[]) {
      if (!suggestionParIngredient.has(s.ingredient_id)) suggestionParIngredient.set(s.ingredient_id, s.recipe.nom)
    }

    const perime = items.filter((i) => i.date_peremption < todayStr)

    const description = items
      .map((i) => {
        const suggestion = suggestionParIngredient.get(i.ingredient.id)
        const statut = i.date_peremption < todayStr ? 'périmé' : `expire le ${i.date_peremption}`
        return suggestion ? `${i.ingredient.nom} (${statut}, essaie « ${suggestion} »)` : `${i.ingredient.nom} (${statut})`
      })
      .join(' · ')

    const pluriel = items.length > 1
    const titre =
      perime.length > 0
        ? `${items.length} item${pluriel ? 's' : ''} périmé${pluriel ? 's' : ''} ou bientôt périmé${pluriel ? 's' : ''}`
        : `${items.length} item${pluriel ? 's' : ''} bientôt périmé${pluriel ? 's' : ''}`

    alerts.push({
      id: 'peremption',
      titre,
      description,
      severity: perime.length > 0 ? 'urgent' : 'warning',
      actionLabel: 'Voir le garde-manger',
      actionTo: '/epicerie',
    })
  }

  // 3b. Ingrédients requis par le plan de la semaine mais absents du garde-manger ET de la liste
  const { data: planCourant } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('household_id', householdId)
    .eq('semaine_debut', semaineDebut)
    .maybeSingle()

  if (planCourant) {
    const { data: liste } = await supabase
      .from('grocery_lists')
      .select('id')
      .eq('meal_plan_id', planCourant.id)
      .maybeSingle()

    // Seulement pertinent si une liste existe déjà mais est possiblement désynchronisée du plan
    // (sinon l'alerte "liste non générée" couvre déjà le cas racine).
    if (liste) {
      const [{ data: entriesAvecRecette }, { data: conversions }, { data: pantry }, { data: itemsListe }] =
        await Promise.all([
          supabase
            .from('meal_plan_entries')
            .select('portions_prevues, recipe:recipes (id, portions_base)')
            .eq('meal_plan_id', planCourant.id)
            .not('recipe_id', 'is', null),
          supabase.from('unit_conversions').select('unite, facteur'),
          supabase.from('pantry_items').select('ingredient_id, quantite, unite').eq('household_id', householdId),
          supabase.from('grocery_list_items').select('ingredient_id').eq('grocery_list_id', liste.id),
        ])

      const facteur = (unite: string) => conversions?.find((c) => c.unite === unite)?.facteur ?? 1
      const recipeScales = new Map<string, number>()
      // deno-lint-ignore no-explicit-any
      for (const e of (entriesAvecRecette ?? []) as any[]) {
        if (!e.recipe) continue
        const scale = e.portions_prevues / e.recipe.portions_base
        recipeScales.set(e.recipe.id, (recipeScales.get(e.recipe.id) ?? 0) + scale)
      }

      const recipeIds = [...recipeScales.keys()]
      const manquants: string[] = []

      if (recipeIds.length > 0) {
        const { data: recipeIngredients } = await supabase
          .from('recipe_ingredients')
          .select('recipe_id, quantite, unite, ingredient_id, ingredient:ingredients (nom)')
          .in('recipe_id', recipeIds)

        const besoinParIngredient = new Map<string, number>()
        const nomParIngredient = new Map<string, string>()
        // deno-lint-ignore no-explicit-any
        for (const ri of (recipeIngredients ?? []) as any[]) {
          const scale = recipeScales.get(ri.recipe_id) ?? 0
          if (scale <= 0) continue
          const base = ri.quantite * scale * facteur(ri.unite)
          besoinParIngredient.set(ri.ingredient_id, (besoinParIngredient.get(ri.ingredient_id) ?? 0) + base)
          nomParIngredient.set(ri.ingredient_id, ri.ingredient.nom)
        }

        const pantryParIngredient = new Map<string, number>()
        for (const p of pantry ?? []) {
          pantryParIngredient.set(p.ingredient_id, (pantryParIngredient.get(p.ingredient_id) ?? 0) + p.quantite * facteur(p.unite))
        }

        const idsDansListe = new Set((itemsListe ?? []).map((i) => i.ingredient_id).filter(Boolean))

        for (const [ingredientId, besoin] of besoinParIngredient) {
          const restant = besoin - (pantryParIngredient.get(ingredientId) ?? 0)
          if (restant > 0.01 && !idsDansListe.has(ingredientId)) {
            manquants.push(nomParIngredient.get(ingredientId) ?? 'Ingrédient')
          }
        }
      }

      if (manquants.length > 0) {
        alerts.push({
          id: 'ingredients-manquants',
          titre: `${manquants.length} ingrédient${manquants.length > 1 ? 's' : ''} manquant${manquants.length > 1 ? 's' : ''} à la liste`,
          description: `${manquants.join(', ')} — requis par le plan, ni au garde-manger ni sur la liste d'épicerie.`,
          severity: 'warning',
          actionLabel: "Mettre à jour la liste",
          actionTo: '/epicerie',
        })
      }
    }
  }

  // 4. Tâches de prépa à faire aujourd'hui
  const { data: taches, error: tachesError } = await supabase
    .from('prep_tasks')
    .select('id, type, date_a_faire')
    .eq('household_id', householdId)
    .eq('date_a_faire', todayStr)
    .eq('statut', 'a_faire')

  if (tachesError) throw tachesError

  if (taches && taches.length > 0) {
    alerts.push({
      id: 'taches-prepa',
      titre: `${taches.length} tâche${taches.length > 1 ? 's' : ''} de prépa aujourd'hui`,
      description: 'Décongeler, mariner ou tremper quelque chose pour demain.',
      severity: 'info',
      actionLabel: 'Voir le plan',
      actionTo: '/planificateur',
    })
  }

  // 5. Liste d'épicerie non générée alors que la semaine prochaine commence dans ≤ 2 jours
  const joursAvantSemaineSuivante = Math.round(
    (new Date(`${semaineSuivante}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime()) /
      (1000 * 60 * 60 * 24),
  )
  if (joursAvantSemaineSuivante >= 0 && joursAvantSemaineSuivante <= 2 && entriesSemaineSuivante.length > 0) {
    const { data: planSuivant } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('household_id', householdId)
      .eq('semaine_debut', semaineSuivante)
      .maybeSingle()

    let aListe = false
    if (planSuivant) {
      const { data: liste } = await supabase
        .from('grocery_lists')
        .select('id, grocery_list_items (id)')
        .eq('meal_plan_id', planSuivant.id)
        .maybeSingle()
      aListe = !!liste && (liste.grocery_list_items?.length ?? 0) > 0
    }

    if (!aListe) {
      alerts.push({
        id: 'liste-non-generee',
        titre: "Liste d'épicerie pas prête pour la semaine prochaine",
        description: `La semaine du ${jourLabel(semaineSuivante)} commence bientôt et le plan n'a pas encore de liste générée.`,
        severity: 'warning',
        actionLabel: "Générer la liste",
        actionTo: '/epicerie',
      })
    }
  }

  return alerts
}
