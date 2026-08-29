// Edge Function : generate-weekly-plan
// Propose des repas pour les cases vides (jour × moment) du plan hebdomadaire
// d'un foyer, à partir des recettes existantes et des règles de variété,
// rotation, batch cooking et contraintes de temps.
//
// Ne modifie rien en base — retourne une liste d'entrées proposées que le
// frontend affiche pour validation avant application (toujours éditable).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.32'
import { corsHeaders } from '../_shared/cors.ts'

const MOMENTS = ['dejeuner', 'diner', 'souper', 'collation']

const PLAN_TOOL = {
  name: 'proposer_plan',
  description: 'Propose des repas pour les cases vides du plan hebdomadaire.',
  input_schema: {
    type: 'object',
    properties: {
      entrees: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Format YYYY-MM-DD' },
            moment: { type: 'string', enum: MOMENTS },
            recipe_id: { type: 'string', description: 'Doit être un id présent dans recettes_disponibles' },
            membre_id: { type: ['string', 'null'], description: 'null = repas commun à toute la famille' },
            portions_prevues: { type: 'number' },
            convives: { type: ['number', 'null'], description: 'Si inférieur à portions_prevues, génère des restes' },
            raison: { type: 'string', description: 'Courte justification (rotation, variété, batch, restes...)' },
          },
          required: ['date', 'moment', 'recipe_id', 'portions_prevues'],
        },
      },
    },
    required: ['entrees'],
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { household_id, semaine_debut } = await req.json()
    if (!household_id || !semaine_debut) throw new Error('household_id et semaine_debut sont requis.')

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    })

    const semaineDebutDate = new Date(`${semaine_debut}T00:00:00Z`)
    const semaineFinDate = new Date(semaineDebutDate)
    semaineFinDate.setUTCDate(semaineFinDate.getUTCDate() + 6)
    const troisSemainesAvant = new Date(semaineDebutDate)
    troisSemainesAvant.setUTCDate(troisSemainesAvant.getUTCDate() - 21)

    const [membresRes, recettesRes, contraintesRes, planExistantRes, historiqueRes] = await Promise.all([
      supabase.from('household_members').select('id, nom, est_adulte, cible_proteines_g').eq('household_id', household_id),
      supabase
        .from('recipes')
        .select(
          'id, nom, categorie, portions_base, temps_total_minutes, transportable, batch_cooking_friendly, proteines_par_portion, tags, saison',
        )
        .eq('household_id', household_id)
        .eq('actif', true),
      supabase
        .from('constrained_evenings')
        .select('date, temps_max_minutes, raison')
        .eq('household_id', household_id)
        .gte('date', semaine_debut)
        .lte('date', semaineFinDate.toISOString().slice(0, 10)),
      supabase
        .from('meal_plans')
        .select('id, meal_plan_entries (date, moment, recipe_id, membre_id)')
        .eq('household_id', household_id)
        .eq('semaine_debut', semaine_debut)
        .maybeSingle(),
      supabase
        .from('meal_plans')
        .select('meal_plan_entries (recipe_id)')
        .eq('household_id', household_id)
        .gte('semaine_debut', troisSemainesAvant.toISOString().slice(0, 10))
        .lt('semaine_debut', semaine_debut),
    ])

    for (const r of [membresRes, recettesRes, contraintesRes, planExistantRes, historiqueRes]) {
      if (r.error) throw r.error
    }

    // deno-lint-ignore no-explicit-any
    const entreesExistantes = new Set(
      // deno-lint-ignore no-explicit-any
      (planExistantRes.data?.meal_plan_entries ?? []).map((e: any) => `${e.date}|${e.moment}`),
    )

    const recettesRecentes = [
      ...new Set(
        (historiqueRes.data ?? [])
          // deno-lint-ignore no-explicit-any
          .flatMap((p: any) => p.meal_plan_entries ?? [])
          // deno-lint-ignore no-explicit-any
          .map((e: any) => e.recipe_id)
          .filter(Boolean),
      ),
    ]

    const casesVides: { date: string; moment: string }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(semaineDebutDate)
      d.setUTCDate(d.getUTCDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      for (const moment of MOMENTS) {
        if (!entreesExistantes.has(`${dateStr}|${moment}`)) casesVides.push({ date: dateStr, moment })
      }
    }

    if (casesVides.length === 0) {
      return new Response(JSON.stringify({ entrees: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const contexte = {
      cases_a_remplir: casesVides,
      membres: membresRes.data,
      recettes_disponibles: recettesRes.data,
      recettes_a_eviter_recemment: recettesRecentes,
      soirs_contraints: contraintesRes.data,
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 8192,
      tools: [PLAN_TOOL],
      tool_choice: { type: 'tool', name: 'proposer_plan' },
      messages: [
        {
          role: 'user',
          content: `Propose un repas pour chacune des cases listées dans "cases_a_remplir", en respectant ces règles :
- Varier les protéines : éviter la même protéine principale (déductible du nom/tags de la recette) deux jours de suite.
- Éviter autant que possible les recipe_id listés dans "recettes_a_eviter_recemment" (vus dans les 3 dernières semaines).
- Pour le souper du dimanche (s'il est dans les cases à remplir), privilégier une recette "batch_cooking_friendly" avec plus de portions que de convives, pour générer des restes utilisables en lunch les jours suivants (mets alors convives < portions_prevues).
- Pour les repas "diner" (lunchs), privilégier des recettes "transportable".
- Pour un soir listé dans "soirs_contraints", choisir une recette dont temps_total_minutes ne dépasse pas temps_max_minutes.
- Pour les membres avec une cible_proteines_g élevée (ados athlètes), privilégier sur leurs repas des recettes riches en protéines.
- N'utiliser que des recipe_id présents dans "recettes_disponibles" — n'invente jamais d'id.
- membre_id à null pour un repas commun ; un membre_id précis seulement si le repas est individuel (typiquement un lunch).
- Si aucune recette ne convient bien pour une case, choisis quand même la moins mauvaise option disponible plutôt que d'omettre la case.

Contexte (JSON) :
${JSON.stringify(contexte)}`,
        },
      ],
    })

    const toolUse = message.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error("L'IA n'a pas pu générer de proposition.")
    }

    return new Response(JSON.stringify(toolUse.input), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
