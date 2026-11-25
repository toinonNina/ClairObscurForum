-- =====================================================================
--  Forum RPG « Clair Obscur » — schéma de base de données (Supabase / PostgreSQL)
--  À coller en entier dans : Supabase > SQL Editor > New query > Run
--  Le script peut être relancé sans danger sur une base vide.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique
              check (char_length(username) between 3 and 24 and username ~ '^[A-Za-z0-9_.-]+$'),
  title       text check (char_length(title) <= 60),          -- devise / titre affiché sous le pseudo
  bio         text check (char_length(bio) <= 2000),
  avatar_url  text check (avatar_url is null or avatar_url ~ '^https://'),
  role        text not null default 'member' check (role in ('member', 'moderator', 'admin')),
  banned      boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.categories (
  id          int generated always as identity primary key,
  name        text not null check (char_length(name) between 2 and 60),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description text check (char_length(description) <= 300),
  icon        text default '✦',
  position    int not null default 0,
  staff_only  boolean not null default false,   -- seuls modérateurs/admins peuvent y ouvrir un sujet
  kind        text not null default 'hrp' check (kind in ('hrp', 'rp')),  -- hrp = hors-jeu, rp = en jeu (on poste en personnage)
  created_at  timestamptz not null default now()
);

-- Fiches de personnage
create table if not exists public.characters (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  name         text not null check (char_length(name) between 2 and 60),
  age          int check (age between 0 and 1000),
  faction      text not null default 'Habitant de Lumière' check (char_length(faction) <= 60),
  occupation   text check (char_length(occupation) <= 80),
  avatar_url   text check (avatar_url is null or avatar_url ~ '^https://'),
  quote        text check (char_length(quote) <= 200),
  appearance   text check (char_length(appearance) <= 6000),
  personality  text check (char_length(personality) <= 6000),
  history      text check (char_length(history) <= 20000),
  abilities    text check (char_length(abilities) <= 6000),
  status       text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected', 'archived')),
  mod_note     text check (char_length(mod_note) <= 2000),
  validated_by uuid references public.profiles (id) on delete set null,
  validated_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists characters_owner_idx  on public.characters (owner_id);
create index if not exists characters_status_idx on public.characters (status, name);

-- Pages d'univers (wiki) : contexte, lieux, guide, règlement…
create table if not exists public.wiki_pages (
  id          int generated always as identity primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title       text not null check (char_length(title) between 2 and 100),
  section     text not null default 'Univers' check (char_length(section) <= 60),
  content     text not null default '' check (char_length(content) <= 60000),
  position    int not null default 0,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.topics (
  id               bigint generated always as identity primary key,
  category_id      int not null references public.categories (id) on delete cascade,
  author_id        uuid references public.profiles (id) on delete set null,
  title            text not null check (char_length(title) between 3 and 120),
  pinned           boolean not null default false,
  locked           boolean not null default false,
  post_count       int not null default 0,
  view_count       int not null default 0,
  created_at       timestamptz not null default now(),
  last_post_at     timestamptz not null default now(),
  last_post_author uuid references public.profiles (id) on delete set null
);

create table if not exists public.posts (
  id          bigint generated always as identity primary key,
  topic_id    bigint not null references public.topics (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  character_id bigint references public.characters (id) on delete set null,  -- personnage incarné (zones RP)
  content     text not null check (char_length(content) between 1 and 20000),
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);

create table if not exists public.post_likes (
  post_id     bigint not null references public.posts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  post_id     bigint not null references public.posts (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason      text not null check (char_length(reason) between 3 and 500),
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  handled_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Mise à niveau d'une base créée avec la première version du script
alter table public.categories add column if not exists kind text not null default 'hrp' check (kind in ('hrp', 'rp'));
alter table public.posts add column if not exists character_id bigint references public.characters (id) on delete set null;

create index if not exists posts_character_idx on public.posts (character_id, created_at desc);
create index if not exists topics_category_idx on public.topics (category_id, pinned desc, last_post_at desc);
create index if not exists topics_last_idx     on public.topics (last_post_at desc);
create index if not exists posts_topic_idx     on public.posts (topic_id, created_at);
create index if not exists posts_author_idx    on public.posts (author_id, created_at desc);
create index if not exists reports_status_idx  on public.reports (status, created_at desc);

-- ---------------------------------------------------------------------
-- 2. FONCTIONS UTILITAIRES (rôles)
-- ---------------------------------------------------------------------

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('moderator', 'admin') and not banned);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and not banned);
$$;

create or replace function public.is_active_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and not banned);
$$;

-- ---------------------------------------------------------------------
-- 3. DÉCLENCHEURS (triggers)
-- ---------------------------------------------------------------------

-- 3a. Création automatique du profil à l'inscription
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base  text;
  final text;
begin
  base := regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^A-Za-z0-9_.-]', '', 'g');
  if char_length(base) < 3 then base := 'expeditionnaire'; end if;
  base  := left(base, 18);
  final := base;
  while exists (select 1 from profiles where lower(username) = lower(final)) loop
    final := base || '_' || floor(random() * 10000)::int;
  end loop;
  insert into profiles (id, username) values (new.id, final);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3b. Protection des champs sensibles du profil (rôle, bannissement)
create or replace function public.protect_profile() returns trigger
language plpgsql set search_path = public as $$  -- security invoker : current_user = rôle réel de l'appelant
begin
  -- Le SQL Editor de Supabase (rôle postgres) peut tout faire
  if current_user not in ('authenticated', 'anon') then return new; end if;
  new.id := old.id;
  new.created_at := old.created_at;
  if public.is_admin() then return new; end if;

  if new.role is distinct from old.role then
    raise exception 'Seul un administrateur peut changer les rôles.';
  end if;

  if old.id = auth.uid() then
    if new.banned is distinct from old.banned then
      raise exception 'Vous ne pouvez pas modifier votre propre statut.';
    end if;
  else
    -- Un modérateur agit sur un autre membre : uniquement le bannissement
    if not public.is_staff() then raise exception 'Action non autorisée.'; end if;
    if old.role <> 'member' then
      raise exception 'Un modérateur ne peut pas sanctionner un membre de l''équipe.';
    end if;
    if (new.username, new.title, new.bio, new.avatar_url)
       is distinct from (old.username, old.title, old.bio, old.avatar_url) then
      raise exception 'Un modérateur ne peut modifier que le statut de bannissement.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- 3c. Protection des sujets : un auteur ne peut modifier que le titre
create or replace function public.protect_topic() returns trigger
language plpgsql set search_path = public as $$  -- security invoker : current_user = rôle réel de l'appelant
begin
  if current_user not in ('authenticated', 'anon') or public.is_staff() then return new; end if;
  if (new.category_id, new.author_id, new.pinned, new.locked, new.post_count, new.view_count,
      new.created_at, new.last_post_at, new.last_post_author)
     is distinct from
     (old.category_id, old.author_id, old.pinned, old.locked, old.post_count, old.view_count,
      old.created_at, old.last_post_at, old.last_post_author) then
    raise exception 'Seule l''équipe de modération peut modifier ces informations.';
  end if;
  return new;
end $$;

drop trigger if exists protect_topic on public.topics;
create trigger protect_topic before update on public.topics
  for each row execute function public.protect_topic();

-- 3d. Messages : champs immuables + date d'édition
create or replace function public.protect_post() returns trigger
language plpgsql as $$
begin
  new.topic_id   := old.topic_id;
  new.author_id  := old.author_id;
  new.character_id := old.character_id;
  new.created_at := old.created_at;
  if new.content is distinct from old.content then new.edited_at := now(); end if;
  return new;
end $$;

drop trigger if exists protect_post on public.posts;
create trigger protect_post before update on public.posts
  for each row execute function public.protect_post();

-- 3e. Compteurs du sujet (nombre de messages, dernier message)
create or replace function public.on_post_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update topics
       set post_count = post_count + 1,
           last_post_at = new.created_at,
           last_post_author = new.author_id
     where id = new.topic_id;
  elsif tg_op = 'DELETE' then
    update topics t
       set post_count = greatest(t.post_count - 1, 0),
           last_post_at = coalesce((select max(p.created_at) from posts p where p.topic_id = t.id), t.created_at),
           last_post_author = (select p.author_id from posts p where p.topic_id = t.id order by p.created_at desc limit 1)
     where t.id = old.topic_id;
  end if;
  return null;
end $$;

drop trigger if exists on_post_change on public.posts;
create trigger on_post_change after insert or delete on public.posts
  for each row execute function public.on_post_change();

-- 3f. Fiches : seul le staff valide ; le joueur peut brouillon <-> en attente
create or replace function public.protect_character() returns trigger
language plpgsql set search_path = public as $$  -- security invoker
begin
  new.updated_at := now();
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    if new.status not in ('draft', 'pending') then new.status := 'draft'; end if;
    new.mod_note := null; new.validated_by := null; new.validated_at := null;
    return new;
  end if;
  new.id := old.id; new.owner_id := old.owner_id; new.created_at := old.created_at;
  if public.is_staff() then
    if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
      new.validated_by := auth.uid(); new.validated_at := now();
    end if;
    return new;
  end if;
  -- joueur
  new.mod_note := old.mod_note; new.validated_by := old.validated_by; new.validated_at := old.validated_at;
  if new.status is distinct from old.status then
    if old.status in ('approved', 'archived') or new.status not in ('draft', 'pending') then
      raise exception 'Seule l''équipe peut valider, refuser ou archiver une fiche.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_character on public.characters;
create trigger protect_character before insert or update on public.characters
  for each row execute function public.protect_character();

-- Vérifie l'identité utilisée pour poster :
--   zone HRP : pas de personnage ; zone RP : un personnage validé du joueur (ou « Narrateur » pour l'équipe)
create or replace function public.post_identity_ok(p_topic bigint, p_character bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when (select c.kind from topics t join categories c on c.id = t.category_id where t.id = p_topic) = 'rp' then
      (p_character is null and public.is_staff())
      or exists (select 1 from characters ch
                  where ch.id = p_character and ch.owner_id = auth.uid() and ch.status = 'approved')
    else p_character is null
  end;
$$;

-- ---------------------------------------------------------------------
-- 4. FONCTIONS APPELÉES PAR LE SITE (RPC)
-- ---------------------------------------------------------------------

-- Crée un sujet et son premier message d'un seul coup (soumis aux règles de sécurité)
drop function if exists public.create_topic(int, text, text);
create or replace function public.create_topic(p_category int, p_title text, p_content text, p_character bigint default null)
returns bigint language plpgsql security invoker set search_path = public as $$
declare tid bigint;
begin
  insert into topics (category_id, author_id, title)
       values (p_category, auth.uid(), trim(p_title))
    returning id into tid;
  insert into posts (topic_id, author_id, character_id, content) values (tid, auth.uid(), p_character, p_content);
  return tid;
end $$;

-- Compteur de vues
create or replace function public.increment_views(p_topic bigint) returns void
language sql security definer set search_path = public as $$
  update topics set view_count = view_count + 1 where id = p_topic;
$$;

-- Statistiques des catégories
drop view if exists public.category_stats;
create view public.category_stats with (security_invoker = true) as
select c.*,
       (select count(*) from topics t where t.category_id = c.id)                       as topic_count,
       (select coalesce(sum(t.post_count), 0) from topics t where t.category_id = c.id) as message_count,
       (select max(t.last_post_at) from topics t where t.category_id = c.id)            as last_activity
  from categories c;

-- ---------------------------------------------------------------------
-- 5. SÉCURITÉ AU NIVEAU DES LIGNES (Row Level Security)
-- ---------------------------------------------------------------------

alter table public.profiles   enable row level security;
alter table public.categories enable row level security;
alter table public.topics     enable row level security;
alter table public.posts      enable row level security;
alter table public.post_likes enable row level security;
alter table public.reports    enable row level security;
alter table public.characters enable row level security;
alter table public.wiki_pages enable row level security;

-- Profils
drop policy if exists "profils lisibles"   on public.profiles;
drop policy if exists "profil modifiable"  on public.profiles;
create policy "profils lisibles"  on public.profiles for select using (true);
create policy "profil modifiable" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_staff());

-- Catégories
drop policy if exists "categories lisibles" on public.categories;
drop policy if exists "categories admin"    on public.categories;
create policy "categories lisibles" on public.categories for select using (true);
create policy "categories admin"    on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Sujets
drop policy if exists "sujets lisibles"   on public.topics;
drop policy if exists "sujets creation"   on public.topics;
drop policy if exists "sujets modif"      on public.topics;
drop policy if exists "sujets suppr"      on public.topics;
create policy "sujets lisibles" on public.topics for select using (true);
create policy "sujets creation" on public.topics for insert to authenticated
  with check (
    author_id = auth.uid() and public.is_active_member()
    and exists (select 1 from public.categories c
                 where c.id = category_id and (not c.staff_only or public.is_staff()))
  );
create policy "sujets modif" on public.topics for update to authenticated
  using ((author_id = auth.uid() and public.is_active_member()) or public.is_staff());
create policy "sujets suppr" on public.topics for delete to authenticated
  using (public.is_staff());

-- Messages
drop policy if exists "messages lisibles" on public.posts;
drop policy if exists "messages creation" on public.posts;
drop policy if exists "messages modif"    on public.posts;
drop policy if exists "messages suppr"    on public.posts;
create policy "messages lisibles" on public.posts for select using (true);
create policy "messages creation" on public.posts for insert to authenticated
  with check (
    author_id = auth.uid() and public.is_active_member()
    and exists (select 1 from public.topics t
                 where t.id = topic_id and (not t.locked or public.is_staff()))
    and public.post_identity_ok(topic_id, character_id)
  );
create policy "messages modif" on public.posts for update to authenticated
  using ((author_id = auth.uid() and public.is_active_member()) or public.is_staff());
create policy "messages suppr" on public.posts for delete to authenticated
  using (author_id = auth.uid() or public.is_staff());

-- Applaudissements (likes)
drop policy if exists "likes lisibles" on public.post_likes;
drop policy if exists "likes ajout"    on public.post_likes;
drop policy if exists "likes retrait"  on public.post_likes;
create policy "likes lisibles" on public.post_likes for select using (true);
create policy "likes ajout"    on public.post_likes for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_member());
create policy "likes retrait"  on public.post_likes for delete to authenticated
  using (user_id = auth.uid());

-- Signalements
drop policy if exists "signalement creation" on public.reports;
drop policy if exists "signalement lecture"  on public.reports;
drop policy if exists "signalement gestion"  on public.reports;
create policy "signalement creation" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_active_member());
create policy "signalement lecture"  on public.reports for select to authenticated
  using (public.is_staff() or reporter_id = auth.uid());
create policy "signalement gestion"  on public.reports for update to authenticated
  using (public.is_staff());

-- Fiches de personnage
drop policy if exists "fiches lisibles" on public.characters;
drop policy if exists "fiches creation" on public.characters;
drop policy if exists "fiches modif"    on public.characters;
drop policy if exists "fiches suppr"    on public.characters;
create policy "fiches lisibles" on public.characters for select
  using (status in ('approved', 'archived') or owner_id = auth.uid() or public.is_staff());
create policy "fiches creation" on public.characters for insert to authenticated
  with check (owner_id = auth.uid() and public.is_active_member());
create policy "fiches modif" on public.characters for update to authenticated
  using ((owner_id = auth.uid() and public.is_active_member()) or public.is_staff());
create policy "fiches suppr" on public.characters for delete to authenticated
  using ((owner_id = auth.uid() and status <> 'approved') or public.is_staff());

-- Pages d'univers
drop policy if exists "wiki lisible" on public.wiki_pages;
drop policy if exists "wiki equipe"  on public.wiki_pages;
create policy "wiki lisible" on public.wiki_pages for select using (true);
create policy "wiki equipe"  on public.wiki_pages for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Droits d'accès de base (la sécurité fine est assurée par les règles ci-dessus)
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on public.profiles, public.categories, public.topics,
      public.posts, public.post_likes, public.reports, public.characters, public.wiki_pages to authenticated;
grant execute on function public.create_topic(int, text, text, bigint) to authenticated;
grant execute on function public.increment_views(bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. CATÉGORIES DE DÉPART (modifiables ensuite depuis le panneau de modération)
-- ---------------------------------------------------------------------

insert into public.categories (name, slug, description, icon, position, staff_only, kind) values
  -- Hors-jeu (HRP) : on parle en tant que joueur
  ('Annonces & Règlement',     'annonces',      'Nouvelles du forum, règlement et décisions de l''équipe.',             '📜', 1,  true,  'hrp'),
  ('Présentations',            'presentations', 'Présentez-vous, vous le joueur, derrière vos personnages.',             '🤝', 2,  false, 'hrp'),
  ('Recherche de partenaires', 'partenaires',   'Proposez des intrigues, cherchez des liens et des compagnons de jeu.',  '🔗', 3,  false, 'hrp'),
  ('Questions & Suggestions',  'questions',     'Une question sur l''univers ou le fonctionnement ? C''est ici.',        '🧭', 4,  false, 'hrp'),
  ('La Taverne',               'taverne',       'Discussions libres, le jeu vidéo, fan art, détente.',                   '🍷', 5,  false, 'hrp'),
  -- En jeu (RP) : on poste en incarnant un personnage validé
  ('Lumière — la Cité',        'lumiere',       'Ruelles, ateliers, cafés et quais de la dernière cité. La vie avant le départ.', '🏛️', 10, false, 'rp'),
  ('Le Port & la Traversée',   'port',          'Préparatifs, adieux et traversée de la mer vers le Continent.',         '⚓', 11, false, 'rp'),
  ('Le Continent',             'continent',     'Terres étranges et peintes au-delà des flots. Les expéditions y progressent.', '🗺️', 12, false, 'rp'),
  ('Le Camp',                  'camp',          'Bivouacs, feux de camp, confidences entre deux combats.',               '🔥', 13, false, 'rp'),
  ('Souvenirs & Rêves',        'souvenirs',     'Flash-backs, rêves et récits hors du temps.',                           '🕯️', 14, false, 'rp'),
  ('Événements',               'evenements',    'Intrigues globales menées par l''équipe (Narrateur).',                  '🎭', 15, true,  'rp')
on conflict (slug) do nothing;

insert into public.wiki_pages (slug, title, section, position, content) values
('bienvenue', 'Bienvenue, voyageur', 'Commencer', 1,
'Bienvenue sur ce forum de **jeu de rôle par écrit** inspiré de l''univers de *Clair Obscur : Expedition 33*.

## Comment jouer ?
1. **Inscrivez-vous**, puis présentez-vous dans la zone hors-jeu.
2. Lisez le **contexte** et le **règlement RP**.
3. Rédigez la **fiche de votre personnage** (menu *Personnages*) et envoyez-la en validation.
4. Une fois la fiche **validée** par l''équipe, vous pouvez poster dans les zones **RP** en l''incarnant.

Vous pouvez avoir plusieurs personnages ; chacun a sa propre fiche.'),
('contexte', 'Le contexte', 'Univers', 2,
'*Page à personnaliser par l''équipe.*

Chaque année, sur un monolithe lointain, la Peintresse se réveille et peint un nombre. Tous ceux qui ont cet âge disparaissent : c''est le **Gommage**. Et chaque année, le nombre diminue.

Depuis la cité de **Lumière**, une expédition part chaque année vers le **Continent** pour tenter de briser ce cycle. Aucune n''est revenue.

> Précisez ici l''époque où se déroule le forum (avant, pendant ou après les événements du jeu, ou dans une version alternative), le nombre actuellement peint, et ce que vos joueurs doivent savoir.'),
('lieux', 'Les lieux', 'Univers', 3,
'*Page à personnaliser par l''équipe.*

- **Lumière** : la dernière cité, sur son île.
- **Le Port** : point de départ des expéditions.
- **Le Continent** : terres mystérieuses, peuplées de créatures étranges.
- **Le Monolithe** : là où la Peintresse inscrit son nombre.'),
('creer-un-personnage', 'Créer son personnage', 'Commencer', 4,
'## La fiche
- **Identité** : nom, âge, origine (habitant de Lumière, expéditionnaire, créature du Continent…), métier.
- **Apparence** et **caractère** : quelques paragraphes suffisent.
- **Histoire** : d''où vient votre personnage, qu''a-t-il perdu à cause du Gommage, pourquoi part-il (ou reste-t-il) ?
- **Capacités** : armes, talents, faiblesses. Restez mesurés : pas de personnage invincible.

## La validation
Envoyez la fiche « en validation ». L''équipe la relit, la **valide** ou vous laisse une **note** pour l''améliorer.

## Personnages canons
Les personnages principaux du jeu ne sont pas jouables sauf décision de l''équipe (à préciser ici).'),
('reglement-rp', 'Règlement RP', 'Commencer', 5,
'1. **Écrivez à la troisième personne** ou à la première, mais restez cohérent dans un même sujet.
2. **Pas de *powergaming*** : ne décidez pas des actions ou des réactions des personnages des autres.
3. **Pas de *métagaming*** : votre personnage ne sait que ce qu''il a appris en jeu.
4. **Longueur** : visez au moins un paragraphe consistant par réponse.
5. **Respectez l''ordre de passage** convenu dans un sujet à plusieurs.
6. **Mort d''un personnage** : uniquement avec l''accord de son joueur.
7. **Hors-jeu** : les remarques de joueur vont entre parenthèses, ou dans la zone hors-jeu.')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 7. DEVENIR ADMINISTRATEUR (à faire UNE fois, après votre inscription sur le site)
--    Remplacez VotrePseudo puis exécutez uniquement cette ligne :
--
--    update public.profiles set role = 'admin' where username = 'VotrePseudo';
-- ---------------------------------------------------------------------
