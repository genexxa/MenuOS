-- ============================================================================
-- MenuOS — Phase 2 : gestion des restes
-- Ajoute le nombre de convives sur une entrée de plan (nécessaire pour savoir
-- si un souper produit un surplus) et un trigger qui crée automatiquement une
-- entrée dans `leftovers` quand une entrée est marquée "cuisine" avec
-- convives < portions_prevues.
-- ============================================================================

alter table meal_plan_entries
  add column convives integer check (convives >= 0);

create or replace function public.create_leftover_on_cook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_convives numeric;
  v_surplus numeric;
begin
  if new.statut <> 'cuisine' or old.statut = 'cuisine' then
    return new;
  end if;

  if new.recipe_id is null then
    return new;
  end if;

  select mp.household_id into v_household_id
  from meal_plans mp where mp.id = new.meal_plan_id;

  v_convives := coalesce(new.convives, new.portions_prevues);
  v_surplus := new.portions_prevues - v_convives;

  if v_surplus > 0 then
    insert into leftovers (household_id, recipe_id, meal_plan_entry_id_source, portions_disponibles, date_production)
    values (v_household_id, new.recipe_id, new.id, v_surplus, new.date);
  end if;

  return new;
end;
$$;

create trigger meal_plan_entries_create_leftover
  after update on meal_plan_entries
  for each row execute function public.create_leftover_on_cook();
