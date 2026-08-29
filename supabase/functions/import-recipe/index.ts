// Edge Function : import-recipe
// Reçoit une URL ou un texte brut, demande à Claude d'en extraire une recette
// structurée, puis propose un rapprochement (fuzzy match) avec les
// ingrédients déjà existants du foyer pour éviter les doublons.
//
// Ne modifie rien en base — retourne une proposition que le frontend affiche
// dans le formulaire de recette pour validation avant sauvegarde.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.32'
import { corsHeaders } from '../_shared/cors.ts'

const RECIPE_TOOL = {
  name: 'extraire_recette',
  description: "Extrait une recette structurée à partir d'un texte ou d'une page web.",
  input_schema: {
    type: 'object',
    properties: {
      nom: { type: 'string' },
      description: { type: 'string' },
      portions_base: { type: 'integer' },
      temps_prepa_minutes: { type: 'integer' },
      temps_cuisson_minutes: { type: 'integer' },
      categorie: { type: 'string', enum: ['dejeuner', 'diner', 'souper', 'collation'] },
      tags: { type: 'array', items: { type: 'string' } },
      etapes_preparation: { type: 'array', items: { type: 'string' } },
      transportable: { type: 'boolean' },
      batch_cooking_friendly: { type: 'boolean' },
      proteines_par_portion: { type: ['number', 'null'] },
      calories_par_portion: { type: ['number', 'null'] },
      saison: {
        type: 'array',
        items: { type: 'string', enum: ['printemps', 'ete', 'automne', 'hiver', 'toute_annee'] },
      },
      cout_estime: { type: ['number', 'null'] },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nom: { type: 'string' },
            quantite: { type: 'number' },
            unite: {
              type: 'string',
              enum: ['g', 'kg', 'ml', 'l', 'c_a_the', 'c_a_soupe', 'tasse', 'pincee', 'unite', 'tranche', 'gousse'],
            },
          },
          required: ['nom', 'quantite', 'unite'],
        },
      },
    },
    required: ['nom', 'portions_base', 'categorie', 'etapes_preparation', 'ingredients'],
  },
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15000)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { household_id, source, content } = await req.json()
    if (!household_id || !content) throw new Error('household_id et content sont requis.')

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    })

    let texte = content
    if (source === 'url') {
      const pageResp = await fetch(content)
      if (!pageResp.ok) throw new Error(`Impossible de récupérer la page (${pageResp.status}).`)
      texte = htmlToText(await pageResp.text())
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      tools: [RECIPE_TOOL],
      tool_choice: { type: 'tool', name: 'extraire_recette' },
      messages: [
        {
          role: 'user',
          content:
            'Extrait la recette suivante en français québécois, avec des unités métriques. ' +
            "Si une information n'est pas présente dans le texte, fais une estimation raisonnable plutôt que de l'omettre. " +
            `Texte source :\n\n${texte}`,
        },
      ],
    })

    const toolUse = message.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error("L'IA n'a pas pu extraire de recette de ce contenu.")
    }
    // deno-lint-ignore no-explicit-any
    const extracted = toolUse.input as any

    const ingredientsAvecMatch = await Promise.all(
      // deno-lint-ignore no-explicit-any
      (extracted.ingredients ?? []).map(async (ing: any) => {
        const { data } = await supabase.rpc('match_ingredient', {
          p_household_id: household_id,
          p_nom: ing.nom,
        })
        const best = data?.[0]
        const isMatch = best && best.similarite > 0.35
        return {
          ...ing,
          matched_ingredient_id: isMatch ? best.id : null,
          matched_ingredient_nom: isMatch ? best.nom : null,
          matched_unite_base: isMatch ? best.unite_base : null,
        }
      }),
    )

    return new Response(
      JSON.stringify({
        ...extracted,
        ingredients: ingredientsAvecMatch,
        source_url: source === 'url' ? content : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
