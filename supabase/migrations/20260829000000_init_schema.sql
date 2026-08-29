-- ============================================================================
-- MenuOS — Schéma initial (POUR VALIDATION — pas encore la migration finale)
-- Décisions actées :
--   - Tous les membres (parents + ados) ont leur propre compte Supabase Auth
--   - Pas de gestion de photos pour l'instant (colonne omise, ajoutable plus tard)
--   - Historique des plans conservé indéfiniment, avec statut brouillon/actif/archivé
--   - Décrémentation de l'inventaire via trigger PostgreSQL
--   - Rayons d'épicerie en table dédiée (ordre personnalisable par foyer)
--   - Soirs contraints en table dédiée, découplée du plan (prête pour import iCal)
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- unaccent() n'est pas IMMUTABLE par défaut -> wrapper pour l'utiliser dans une
-- colonne générée (nécessaire pour le fuzzy matching des ingrédients).
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
as $$
  select unaccent('public.unaccent', $1)
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- FOYER & MEMBRES
-- ============================================================================

create table households (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  created_at  timestamptz not null default now()
);

create table household_members (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id) on delete cascade,
  auth_user_id         uuid not null unique references auth.users(id) on delete cascade,
  nom                 text not null,
  est_adulte          boolean not null default false,
  cible_proteines_g   numeric(6,1),           -- cible quotidienne, utile pour les ados athlètes
  couleur_affichage   text not null default '#64748b',  -- code couleur pour le planner (drag & drop)
  actif               boolean not null default true,
  created_at          timestamptz not null default now()
);

create index household_members_household_id_idx on household_members(household_id);

-- Fonction d'appartenance, utilisée par toutes les policies RLS ci-dessous.
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from household_members hm
    where hm.household_id = p_household_id
      and hm.auth_user_id = auth.uid()
  )
$$;

-- ============================================================================
-- RAYONS D'ÉPICERIE (ordre personnalisable par foyer)
-- ============================================================================

create table store_sections (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  nom           text not null,
  ordre         integer not null,
  created_at    timestamptz not null default now(),
  unique (household_id, nom)
);

create index store_sections_household_id_idx on store_sections(household_id);

-- ============================================================================
-- UNITÉS & CONVERSIONS (référence globale, pas de household_id)
-- ============================================================================

create table unit_conversions (
  unite         text primary key,
  unite_base    text not null check (unite_base in ('g', 'ml', 'unite')),
  facteur       numeric not null check (facteur > 0)  -- quantité(unite) * facteur = quantité(unite_base)
);

insert into unit_conversions (unite, unite_base, facteur) values
  ('g',           'g',    1),
  ('kg',          'g',    1000),
  ('ml',          'ml',   1),
  ('l',           'ml',   1000),
  ('c_a_the',     'ml',   5),
  ('c_a_soupe',   'ml',   15),
  ('tasse',       'ml',   250),
  ('pincee',      'ml',   0.3),
  ('unite',       'unite', 1),
  ('tranche',     'unite', 1),
  ('gousse',      'unite', 1);

-- ============================================================================
-- INGRÉDIENTS
-- ============================================================================

create table ingredients (
  id                    uuid primary key default gen_random_uuid(),
  household_id           uuid not null references households(id) on delete cascade,
  nom                   text not null,
  nom_normalise          text generated always as (lower(public.immutable_unaccent(nom))) stored,
  rayon_id               uuid references store_sections(id) on delete set null,
  unite_base             text not null check (unite_base in ('g', 'ml', 'unite')),
  cout_unitaire_estime    numeric(8,2),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (household_id, nom_normalise)
);

create index ingredients_household_id_idx on ingredients(household_id);
create index ingredients_nom_trgm_idx on ingredients using gin (nom_normalise gin_trgm_ops);

create trigger ingredients_set_updated_at
  before update on ingredients
  for each row execute function public.set_updated_at();

-- ============================================================================
-- INVENTAIRE GARDE-MANGER
-- ============================================================================

create table pantry_items (
  id                uuid primary key default gen_random_uuid(),
  household_id       uuid not null references households(id) on delete cascade,
  ingredient_id       uuid not null references ingredients(id) on delete cascade,
  quantite          numeric not null check (quantite >= 0),
  unite             text not null references unit_conversions(unite),
  emplacement       text not null check (emplacement in ('frigo', 'congelateur', 'garde_manger')),
  date_peremption    date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index pantry_items_household_id_idx on pantry_items(household_id);
create index pantry_items_ingredient_id_idx on pantry_items(ingredient_id);
create index pantry_items_peremption_idx on pantry_items(household_id, date_peremption);

create trigger pantry_items_set_updated_at
  before update on pantry_items
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RECETTES
-- ============================================================================

create table recipes (
  id                      uuid primary key default gen_random_uuid(),
  household_id             uuid not null references households(id) on delete cascade,
  nom                     text not null,
  description             text,
  portions_base            integer not null check (portions_base > 0),
  temps_prepa_minutes       integer not null default 0 check (temps_prepa_minutes >= 0),
  temps_cuisson_minutes     integer not null default 0 check (temps_cuisson_minutes >= 0),
  temps_total_minutes       integer generated always as (temps_prepa_minutes + temps_cuisson_minutes) stored,
  categorie               text not null check (categorie in ('dejeuner', 'diner', 'souper', 'collation')),
  tags                    text[] not null default '{}',
  etapes_preparation       text[] not null default '{}',
  transportable           boolean not null default false,
  batch_cooking_friendly    boolean not null default false,
  proteines_par_portion     numeric(6,1),
  calories_par_portion      numeric(6,1),
  saison                  text[] not null default '{toute_annee}'
                            check (saison <@ array['printemps','ete','automne','hiver','toute_annee']::text[]),
  cout_estime              numeric(8,2),
  source_url               text,
  actif                   boolean not null default true,
  created_by               uuid references household_members(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index recipes_household_id_idx on recipes(household_id);
create index recipes_categorie_idx on recipes(household_id, categorie);
create index recipes_tags_idx on recipes using gin (tags);

create trigger recipes_set_updated_at
  before update on recipes
  for each row execute function public.set_updated_at();

create table recipe_ingredients (
  id            uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null references recipes(id) on delete cascade,
  ingredient_id   uuid not null references ingredients(id) on delete restrict,
  quantite      numeric not null check (quantite > 0),
  unite         text not null references unit_conversions(unite),
  ordre         integer not null default 0,
  optionnel     boolean not null default false,
  note          text
);

create index recipe_ingredients_recipe_id_idx on recipe_ingredients(recipe_id);
create index recipe_ingredients_ingredient_id_idx on recipe_ingredients(ingredient_id);

-- ============================================================================
-- SOIRS CONTRAINTS (manuel ou import iCal — Phase 2)
-- ============================================================================

create table constrained_evenings (
  id                  uuid primary key default gen_random_uuid(),
  household_id         uuid not null references households(id) on delete cascade,
  date                date not null,
  temps_max_minutes     integer check (temps_max_minutes > 0),
  raison              text,
  source              text not null default 'manuel' check (source in ('manuel', 'ical')),
  created_at          timestamptz not null default now(),
  unique (household_id, date)
);

create index constrained_evenings_household_id_idx on constrained_evenings(household_id);

-- ============================================================================
-- PLANS DE REPAS
-- ============================================================================

create table meal_plans (
  id                uuid primary key default gen_random_uuid(),
  household_id       uuid not null references households(id) on delete cascade,
  semaine_debut      date not null,  -- toujours un lundi
  statut            text not null default 'brouillon' check (statut in ('brouillon', 'actif', 'archive')),
  genere_par_ia      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (household_id, semaine_debut)
);

create index meal_plans_household_id_idx on meal_plans(household_id, semaine_debut desc);

create trigger meal_plans_set_updated_at
  before update on meal_plans
  for each row execute function public.set_updated_at();

create table leftovers (
  id                    uuid primary key default gen_random_uuid(),
  household_id           uuid not null references households(id) on delete cascade,
  recipe_id              uuid references recipes(id) on delete set null,
  meal_plan_entry_id_source uuid,  -- FK ajoutée après meal_plan_entries (dépendance circulaire)
  portions_disponibles     numeric not null check (portions_disponibles > 0),
  date_production          date not null default current_date,
  date_peremption          date,
  statut                  text not null default 'disponible' check (statut in ('disponible', 'utilise', 'perime')),
  created_at              timestamptz not null default now()
);

create index leftovers_household_id_idx on leftovers(household_id, statut);

create table meal_plan_entries (
  id                uuid primary key default gen_random_uuid(),
  meal_plan_id       uuid not null references meal_plans(id) on delete cascade,
  date              date not null,
  moment            text not null check (moment in ('dejeuner', 'diner', 'souper', 'collation')),
  recipe_id          uuid references recipes(id) on delete set null,
  leftover_id        uuid references leftovers(id) on delete set null,
  texte_libre        text,  -- ex: "resto", "chez grand-maman" — sans recette
  membre_id          uuid references household_members(id) on delete set null,  -- null = repas commun
  portions_prevues    numeric not null default 1 check (portions_prevues > 0),
  statut            text not null default 'planifie' check (statut in ('planifie', 'cuisine', 'saute')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint meal_plan_entry_has_content check (
    (recipe_id is not null)::int + (leftover_id is not null)::int + (texte_libre is not null)::int >= 1
  )
);

create index meal_plan_entries_meal_plan_id_idx on meal_plan_entries(meal_plan_id, date);
create index meal_plan_entries_recipe_id_idx on meal_plan_entries(recipe_id);
create index meal_plan_entries_membre_id_idx on meal_plan_entries(membre_id);

create trigger meal_plan_entries_set_updated_at
  before update on meal_plan_entries
  for each row execute function public.set_updated_at();

alter table leftovers
  add constraint leftovers_meal_plan_entry_id_source_fkey
  foreign key (meal_plan_entry_id_source) references meal_plan_entries(id) on delete set null;

-- ============================================================================
-- ALERTES DE RUPTURE DE STOCK
-- Créée par le trigger de décrémentation quand le garde-manger ne suffit pas
-- à couvrir un repas marqué "cuisiné". Alimente le tableau de bord (Phase 5).
-- ============================================================================

create table stock_shortage_alerts (
  id                  uuid primary key default gen_random_uuid(),
  household_id         uuid not null references households(id) on delete cascade,
  ingredient_id         uuid not null references ingredients(id) on delete cascade,
  meal_plan_entry_id     uuid not null references meal_plan_entries(id) on delete cascade,
  quantite_manquante     numeric not null check (quantite_manquante > 0),
  unite_base            text not null check (unite_base in ('g', 'ml', 'unite')),
  resolu               boolean not null default false,
  created_at           timestamptz not null default now()
);

create index stock_shortage_alerts_household_id_idx on stock_shortage_alerts(household_id, resolu);

-- ============================================================================
-- TÂCHES DE PRÉPARATION (décongeler, mariner, tremper...)
-- ============================================================================

create table prep_tasks (
  id                  uuid primary key default gen_random_uuid(),
  household_id         uuid not null references households(id) on delete cascade,
  meal_plan_entry_id     uuid not null references meal_plan_entries(id) on delete cascade,
  type                text not null check (type in ('decongeler', 'mariner', 'tremper', 'autre')),
  date_a_faire         date not null,
  statut              text not null default 'a_faire' check (statut in ('a_faire', 'fait')),
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index prep_tasks_household_id_idx on prep_tasks(household_id, date_a_faire);
create index prep_tasks_meal_plan_entry_id_idx on prep_tasks(meal_plan_entry_id);

create trigger prep_tasks_set_updated_at
  before update on prep_tasks
  for each row execute function public.set_updated_at();

-- ============================================================================
-- LISTE D'ÉPICERIE
-- ============================================================================

create table grocery_lists (
  id              uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  meal_plan_id      uuid references meal_plans(id) on delete set null,
  statut          text not null default 'brouillon' check (statut in ('brouillon', 'en_cours', 'complete')),
  total_estime      numeric(8,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index grocery_lists_household_id_idx on grocery_lists(household_id, created_at desc);

create trigger grocery_lists_set_updated_at
  before update on grocery_lists
  for each row execute function public.set_updated_at();

create table grocery_list_items (
  id                    uuid primary key default gen_random_uuid(),
  grocery_list_id         uuid not null references grocery_lists(id) on delete cascade,
  ingredient_id           uuid references ingredients(id) on delete set null,
  nom_libre               text,  -- item ajouté manuellement, hors table ingredients
  quantite               numeric not null check (quantite > 0),
  unite                  text not null references unit_conversions(unite),
  rayon_id                uuid references store_sections(id) on delete set null,  -- copie au moment de la génération
  coche                  boolean not null default false,
  ajoute_manuellement      boolean not null default false,
  cout_estime             numeric(8,2),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint grocery_list_item_has_name check (ingredient_id is not null or nom_libre is not null)
);

create index grocery_list_items_grocery_list_id_idx on grocery_list_items(grocery_list_id, rayon_id);

create trigger grocery_list_items_set_updated_at
  before update on grocery_list_items
  for each row execute function public.set_updated_at();

-- ============================================================================
-- TRIGGER : décrémentation automatique de l'inventaire
-- Se déclenche quand une entrée de plan passe au statut 'cuisine'.
-- Consomme le garde-manger en FIFO (péremption la plus proche en premier),
-- converti dans l'unité de base de l'ingrédient. Ne descend jamais sous zéro :
-- si le stock est insuffisant, on consomme ce qui existe et on logue le
-- manquant dans stock_shortage_alerts pour qu'il remonte au tableau de bord.
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
    return new;  -- restes ou texte libre : rien à décrémenter
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

create trigger meal_plan_entries_decrement_pantry
  after update on meal_plan_entries
  for each row execute function public.decrement_pantry_on_cook();

-- ============================================================================
-- RLS
-- ============================================================================

alter table households enable row level security;
alter table household_members enable row level security;
alter table store_sections enable row level security;
alter table ingredients enable row level security;
alter table pantry_items enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table constrained_evenings enable row level security;
alter table meal_plans enable row level security;
alter table meal_plan_entries enable row level security;
alter table leftovers enable row level security;
alter table stock_shortage_alerts enable row level security;
alter table prep_tasks enable row level security;
alter table grocery_lists enable row level security;
alter table grocery_list_items enable row level security;

-- households : lecture/écriture réservées aux membres ; création ouverte aux
-- utilisateurs authentifiés (flux d'onboarding : créer le foyer puis s'y lier).
create policy households_select on households for select
  using (is_household_member(id));
create policy households_insert on households for insert
  with check (auth.uid() is not null);
create policy households_update on households for update
  using (is_household_member(id));

-- household_members : visible par les membres du même foyer.
create policy household_members_select on household_members for select
  using (is_household_member(household_id));
create policy household_members_insert on household_members for insert
  with check (auth_user_id = auth.uid() or is_household_member(household_id));
create policy household_members_update on household_members for update
  using (is_household_member(household_id));
create policy household_members_delete on household_members for delete
  using (is_household_member(household_id));

-- Tables household_id-direct : policy générique select/insert/update/delete.
create policy store_sections_all on store_sections for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy ingredients_all on ingredients for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy pantry_items_all on pantry_items for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy recipes_all on recipes for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy constrained_evenings_all on constrained_evenings for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy meal_plans_all on meal_plans for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy leftovers_all on leftovers for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy stock_shortage_alerts_all on stock_shortage_alerts for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy prep_tasks_all on prep_tasks for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy grocery_lists_all on grocery_lists for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

-- Tables sans household_id direct : policy via jointure au parent.
create policy recipe_ingredients_all on recipe_ingredients for all
  using (exists (select 1 from recipes r where r.id = recipe_id and is_household_member(r.household_id)))
  with check (exists (select 1 from recipes r where r.id = recipe_id and is_household_member(r.household_id)));

create policy meal_plan_entries_all on meal_plan_entries for all
  using (exists (select 1 from meal_plans mp where mp.id = meal_plan_id and is_household_member(mp.household_id)))
  with check (exists (select 1 from meal_plans mp where mp.id = meal_plan_id and is_household_member(mp.household_id)));

create policy grocery_list_items_all on grocery_list_items for all
  using (exists (select 1 from grocery_lists gl where gl.id = grocery_list_id and is_household_member(gl.household_id)))
  with check (exists (select 1 from grocery_lists gl where gl.id = grocery_list_id and is_household_member(gl.household_id)));

-- unit_conversions : lecture globale pour tout utilisateur authentifié (référence, pas de household_id).
alter table unit_conversions enable row level security;
create policy unit_conversions_select on unit_conversions for select
  using (auth.uid() is not null);
