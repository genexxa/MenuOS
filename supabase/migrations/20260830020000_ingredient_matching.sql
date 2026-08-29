-- ============================================================================
-- MenuOS — Phase 4 : fuzzy matching des ingrédients pour l'import IA
-- Utilisée par l'Edge Function import-recipe pour proposer un ingrédient
-- existant plutôt que d'en créer un doublon. `security invoker` (par défaut) :
-- s'exécute avec les droits de l'appelant, donc la RLS de `ingredients`
-- s'applique normalement.
-- ============================================================================

create or replace function public.match_ingredient(p_household_id uuid, p_nom text)
returns table (id uuid, nom text, unite_base text, similarite real)
language sql
stable
as $$
  select id, nom, unite_base, similarity(nom_normalise, lower(public.immutable_unaccent(p_nom))) as similarite
  from ingredients
  where household_id = p_household_id
  order by similarite desc
  limit 1
$$;
