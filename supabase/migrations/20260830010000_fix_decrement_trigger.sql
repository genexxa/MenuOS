-- ============================================================================
-- MenuOS — Correctif : decrement_pantry_on_cook()
-- Le nom de variable de boucle `ri` entrait en collision avec l'alias de
-- table `ri` (recipe_ingredients) utilisé dans sa propre requête, ce qui
-- provoquait l'erreur PL/pgSQL "record ri is not assigned yet" dès qu'un
-- repas était marqué "cuisiné". Variables renommées en v_ri / v_pi.
-- ============================================================================

create or replace function public.decrement_pantry_on_cook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_scale numeric;
  v_ri record;
  v_needed_base numeric;
  v_pi record;
  v_take_base numeric;
  v_take_unite numeric;
begin
  if new.statut <> 'cuisine' or old.statut = 'cuisine' then
    return new;
  end if;

  if new.recipe_id is null then
    return new;
  end if;

  select mp.household_id into v_household_id
  from meal_plans mp where mp.id = new.meal_plan_id;

  select portions_base into v_scale from recipes where id = new.recipe_id;
  v_scale := new.portions_prevues / nullif(v_scale, 0);

  for v_ri in
    select ri.ingredient_id, ri.quantite, ri.unite, ing.unite_base
    from recipe_ingredients ri
    join ingredients ing on ing.id = ri.ingredient_id
    where ri.recipe_id = new.recipe_id
  loop
    v_needed_base := v_ri.quantite * v_scale *
      (select facteur from unit_conversions where unite = v_ri.unite);

    for v_pi in
      select id, quantite, unite
      from pantry_items
      where household_id = v_household_id
        and ingredient_id = v_ri.ingredient_id
        and quantite > 0
      order by date_peremption nulls last, created_at
      for update
    loop
      exit when v_needed_base <= 0;

      v_take_base := least(
        v_needed_base,
        v_pi.quantite * (select facteur from unit_conversions where unite = v_pi.unite)
      );
      v_take_unite := v_take_base / (select facteur from unit_conversions where unite = v_pi.unite);

      update pantry_items
        set quantite = quantite - v_take_unite
        where id = v_pi.id;

      v_needed_base := v_needed_base - v_take_base;
    end loop;

    if v_needed_base > 0 then
      insert into stock_shortage_alerts
        (household_id, ingredient_id, meal_plan_entry_id, quantite_manquante, unite_base)
      values
        (v_household_id, v_ri.ingredient_id, new.id, v_needed_base, v_ri.unite_base);
    end if;
  end loop;

  delete from pantry_items where quantite <= 0;

  return new;
end;
$$;
