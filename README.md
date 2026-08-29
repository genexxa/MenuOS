# MenuOS

Application personnelle de gestion des repas et lunchs familiaux — planification,
liste d'épicerie automatisée, et filet de sécurité pour ne rien oublier.

## Stack

- **Frontend** : React 18 + Vite + TypeScript (strict) + Tailwind CSS 4 + Radix UI
- **Backend/DB** : Supabase (Postgres + Auth + RLS + Edge Functions)
- **État serveur** : TanStack Query
- **IA** : API Anthropic (Edge Functions uniquement — jamais de clé côté frontend)
- **Déploiement** : Render (site statique)

## Structure

```
src/
  components/     primitives UI partagées
  features/       recettes / planner / epicerie / dashboard
  lib/            client Supabase, TanStack Query
  types/          types générés depuis Supabase
supabase/
  migrations/     migrations SQL (schéma + RLS)
  seed.sql        données de développement local
```

## Démarrage

### 1. Frontend

```bash
npm install
cp .env.example .env.local   # remplir avec les valeurs du projet Supabase
npm run dev
```

### 2. Base de données Supabase

**Option locale (Docker requis)** — via la CLI Supabase (`npx supabase`, pas
d'installation globale nécessaire) :

```bash
npx supabase start          # démarre Postgres + Auth + Studio en local
```

Crée ensuite les 4 comptes de test (voir ci-dessous) via Studio local avant de lancer :

```bash
npx supabase db reset       # applique les migrations, PUIS lance seed.sql
npx supabase gen types typescript --local > src/types/database.types.ts
```

`supabase start` affiche l'URL et la clé anon locales à mettre dans `.env.local`.

**Option hébergée** (si Docker n'est pas disponible) — créer un projet gratuit sur
[supabase.com](https://supabase.com), puis dans le SQL Editor : coller et exécuter
`supabase/migrations/20260829000000_init_schema.sql`, créer les 4 comptes de test
(étape ci-dessous), puis coller et exécuter `supabase/seed.sql`. L'URL et la clé
anon sont dans Project Settings > API.

### Comptes de test

À créer manuellement **avant** de lancer `seed.sql` (Studio local ou Dashboard
hébergé > Authentication > Add user, avec « Auto Confirm User » coché) :
`simon@menuos.local`, `marie@menuos.local`, `felix@menuos.local`, `lea@menuos.local`
— mot de passe au choix. `seed.sql` relie ensuite chaque `household_member` au bon
compte par email (voir le commentaire en tête du fichier). Créer les comptes via
l'interface plutôt que par SQL brut garantit qu'ils peuvent réellement se connecter,
peu importe la version exacte du schéma d'auth.

### 3. Edge Functions (Phase 4 — automatisation IA)

Deux Edge Functions sous `supabase/functions/` :
- `import-recipe` : extrait une recette structurée (Claude) depuis une URL ou
  un texte, et rapproche chaque ingrédient des ingrédients existants du foyer
  via une recherche floue Postgres (`match_ingredient`, pg_trgm).
- `generate-weekly-plan` : propose un repas pour chaque case vide du plan
  hebdomadaire, en respectant variété, rotation (3 dernières semaines), batch
  cooking, restes, transportabilité des lunchs et contraintes de temps.

Ni l'une ni l'autre n'écrit en base — elles renvoient une proposition que le
frontend affiche pour validation avant sauvegarde/application.

Déploiement (nécessite un [Personal Access Token Supabase](https://supabase.com/dashboard/account/tokens)) :

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
npx supabase link --project-ref <ref-du-projet>
npx supabase db push                     # applique les migrations manquantes
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy import-recipe
npx supabase functions deploy generate-weekly-plan
```

`functions deploy` fonctionne sans Docker sur un projet hébergé (juste un
avertissement, pas un blocage). Modèle utilisé : `claude-sonnet-5` — la spec
initiale mentionnait `claude-sonnet-4-6`, qui ne correspond à aucun ID de
modèle Anthropic valide.

Si tu ajoutes une migration après avoir déjà appliqué les précédentes à la
main (SQL Editor), répare l'historique de la CLI avant de pousser la nouvelle :

```bash
npx supabase migration list                            # voir ce qui manque côté "remote"
npx supabase migration repair --status applied <version...>  # pour les migrations déjà appliquées manuellement
npx supabase db push                                    # applique seulement les nouvelles
```

## État actuel — Phase 5 (les 5 phases sont complétées)

Les 5 modules du plan initial sont fonctionnels de bout en bout, testés en
direct contre un projet Supabase hébergé :

- **Recettes** : CRUD, recherche/filtres, mise à l'échelle des portions
- **Planificateur** : grille hebdomadaire, drag & drop, gestion des restes,
  tâches de prépa par repas
- **Épicerie** : génération depuis le plan avec agrégation/conversion
  d'unités et soustraction de l'inventaire, mode magasin, garde-manger
- **Automatisation IA** : import de recette (URL/texte) avec rapprochement
  d'ingrédients, génération de plan hebdomadaire avec application sélective
- **Tableau de bord d'alertes** : jours sans repas planifié, lunchs non
  assignés (J-1 18h), ingrédients manquants (plan vs inventaire vs liste),
  péremptions à J-3 avec suggestion de recette, tâches de prépa du jour,
  liste d'épicerie non générée pour la semaine suivante — chaque alerte
  pointe directement vers l'écran qui règle le problème

Pistes d'amélioration non couvertes par le scope initial : rayons/règles de
génération non configurables depuis l'UI (valeurs fixes raisonnables),
optimistic UI de la liste d'épicerie non résilient hors-ligne au sens strict
(pas de service worker / queue de sync), code-splitting du bundle frontend
(actuellement ~650 kB, un seul chunk).
