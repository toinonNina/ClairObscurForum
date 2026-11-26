# Paris Fracturé

Forum de **jeu de rôle par écrit (RPG)** francophone inspiré de **Clair Obscur : Expedition 33**, 100 % gratuit à héberger.

> La Fracture a fini par venir dans le monde réel : seule la ville de Paris a survécu. Peintres et Écrivains se disputent le monopole de la création du nouveau monde ; les Musiciens, neutres, sont divisés entre les deux camps.

- **Site** : fichiers statiques (HTML, CSS, JavaScript) publiés par **GitHub Pages**.
- **Base de données SQL** : **Supabase** (PostgreSQL), qui fournit aussi les comptes utilisateurs et la sécurité.
- Aucun serveur à gérer, aucune compilation, aucune carte bancaire.

## Fonctionnalités

### Jeu de rôle
- **Fiches de personnage** liées au compte du joueur (plusieurs personnages par joueur) : identité, origine, apparence, caractère, histoire, capacités, image, citation
- **Validation des fiches** par l'équipe : brouillon › en attente › validée / à retravailler (avec une note pour le joueur) › archivée
- **Zones RP et HRP** : dans les zones « en jeu », on poste **en incarnant un personnage validé** (choisi dans une liste) ; l'équipe peut poster en **Narrateur**. Dans les zones « hors-jeu », on parle en tant que joueur. Ces règles sont vérifiées par la base de données elle-même.
- **Galerie des personnages** filtrable par camp, page de chaque personnage avec ses dernières apparitions
- **Personnages prédéfinis** : rôles proposés par l'équipe ou demandés par les membres (validés par l'équipe), à réserver en un clic avec une fiche pré-remplie ; statut disponible, réservé ou pris
- **Pages « Univers »** (contexte, lieux, guide de création, règlement RP) que l'équipe rédige et modifie depuis le site
- **Factions** : Peintres, Écrivains, Musiciens (Healers, Dreamers, Discordants, sans culte) ou sans allégeance, chacune avec sa couleur et son blason sur les fiches, les messages et l'accueil (« Forces en présence »)
- **Territoires de Paris** comme zones RP : rues neutres, Montmartre, Quartier Latin, Catacombes, la Seine, zones de fracture ouverte, failles oniriques, chroniques (événements) ; plus 5 zones HRP. Toutes modifiables.

### Vie du forum (nouveautés)
- **Notifications** (🔔 dans le menu) : quand quelqu'un répond à votre sujet RP (ou à un sujet RP où vous avez joué), vous cite avec le bouton « Citer », ou vous mentionne avec `@pseudo` ; aussi pour les liens, badges, fiches validées et fractures
- **Liens entre personnages** (famille, amitié, amour, alliance, rivalité, inimitié, mentor…) proposés depuis une fiche, acceptés par l'autre joueur, affichés sur les deux fiches
- **Chronologie de Paris** (menu *Univers*) : les grands événements depuis la Fracture, écrits par l'équipe, liables à un sujet RP
- **Carte interactive** (menu *Carte*) : survolez un territoire pour le découvrir, cliquez pour entrer dans son forum
- **Bottin des avatars** : champ « Visage » dans les fiches, page de recherche « ce visage est-il déjà pris ? »
- **Points RP et badges** : points gagnés en jouant (barème sur le *Tableau d'honneur*), badges automatiques ou décernés par l'équipe, affichés sur les profils
- **Zones de fracture aléatoires** : le Narrateur ouvre en un clic une fracture surprise (territoire et effet tirés au sort), avec bannière sur l'accueil et la carte, notification à tous et badge pour les participants

### Forum
- Catégories (salons) avec compteurs de sujets et de messages
- Sujets et réponses avec pagination, mise en forme Markdown, citations, aperçu
- Balises spoiler : `||texte caché||` (cliquer pour révéler)
- Applaudissements (likes) sur les messages
- Comptes : inscription, confirmation par e-mail, connexion, mot de passe oublié
- Profils : avatar, devise, présentation, statistiques, messages récents
- Liste des membres et de l'équipe
- Recherche dans les titres et les messages
- **Messagerie privée** : conversations à plusieurs, compteur de messages non lus dans le menu, messages de l'équipe à tous les membres
- Modération : fiches à valider, épingler, verrouiller, déplacer, renommer, supprimer, signalements, bannissement
- Administration : rôles (membre, gardien, administrateur) et gestion des catégories (type RP ou HRP)
- Sécurité côté base de données (Row Level Security) : même en contournant le site, personne ne peut faire plus que ses droits
- Deux thèmes au choix : **sombre** « Belle Époque nocturne » et **clair** « Parchemin & feuille d'or », bouton ☀ / ☾ dans l'en-tête, choix mémorisé (par défaut : réglage de l'appareil)
- Adapté au mobile

## Installation (environ 15 minutes)

### 1. Créer la base de données Supabase

1. Créez un compte gratuit sur <https://supabase.com> puis cliquez sur **New project**.
   Choisissez un nom, un mot de passe de base de données (gardez-le), et la région **Europe (Paris ou Francfort)**.
2. Quand le projet est prêt, ouvrez **SQL Editor** › **New query**.
3. Copiez tout le contenu de [`supabase/schema.sql`](supabase/schema.sql), collez-le, puis cliquez sur **Run**.
   Vous devez voir « Success ». Les tables, les règles de sécurité, les catégories RP / HRP et 5 pages d'univers de départ sont créées.
4. Allez dans **Project Settings** › **API** (ou le bouton **Connect**) et notez :
   - l'**URL du projet** (`https://xxxx.supabase.co`)
   - la clé **anon public** (ou **publishable**).
   ⚠️ Ne copiez jamais la clé `service_role` / `secret`.

### 2. Brancher le site

Ouvrez [`js/config.js`](js/config.js) et remplacez les deux valeurs :

```js
export const SUPABASE_URL = 'https://xxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';   // ou sb_publishable_...
```

Vous pouvez aussi y changer le nom du forum.

### 3. Publier sur GitHub Pages

1. Créez un dépôt sur GitHub (par exemple `forum-clair-obscur`) et envoyez-y tous les fichiers.
2. Dans le dépôt : **Settings** › **Pages** › *Source* : **Deploy from a branch**, branche **main**, dossier **/ (root)** › **Save**.
3. Après une minute, le forum est en ligne à l'adresse `https://VOTRE-PSEUDO.github.io/forum-clair-obscur/`.

### 4. Autoriser l'adresse du site dans Supabase

Dans Supabase : **Authentication** › **URL Configuration** :

- **Site URL** : l'adresse GitHub Pages ci-dessus.
- **Redirect URLs** : ajoutez la même adresse (et `http://localhost:8080/` si vous testez en local).

Sans cela, les liens de confirmation et de mot de passe oublié reçus par e-mail ne ramèneront pas sur le forum.

### Mise à jour : notifications, liens, chronologie, carte, bottin, points & badges, fractures

Si votre forum était déjà installé, exécutez une fois [`supabase/migration-nouveautes.sql`](supabase/migration-nouveautes.sql) dans le **SQL Editor** (rien n'est supprimé, le script peut être relancé). Il calcule aussi les points de tous les membres à partir des messages déjà écrits.

- **Fracture surprise** : *Univers › Zones de fracture* (ou *Modération › ⚡ Fractures*). Laissez « Au hasard » : le territoire et l'effet sont tirés au sort, un sujet épinglé est ouvert au nom du Narrateur et tous les membres sont prévenus. Elle se referme seule à la fin de la durée choisie.
- **Points & badges** : *Membres › Tableau d'honneur*. L'équipe crée des badges (manuels ou automatiques) et donne points ou badges depuis le profil d'un membre.
- **Chronologie** : l'équipe ajoute, modifie et ordonne les événements depuis la page elle-même.

### Mise à jour : personnages prédéfinis

Si votre forum était déjà installé, exécutez une fois [`supabase/migration-predefinis.sql`](supabase/migration-predefinis.sql) dans le **SQL Editor**. Rien n'est supprimé, et le script peut être relancé sans danger.

- **L'équipe** crée des prédéfinis (nom, faction, image, histoire, attentes) depuis *Personnages › Prédéfinis*.
- **Un membre** clique sur « Je veux le jouer » : une fiche pré-remplie est créée à son nom, il la complète et l'envoie en validation. Le prédéfini passe en **Réservé**, puis en **Pris** quand l'équipe valide la fiche. Si la fiche est supprimée avant validation, le prédéfini redevient disponible.
- **Un membre** peut aussi remplir une **demande de prédéfini** (par exemple un proche de son personnage). L'équipe la valide (elle est alors publiée avec le nom du demandeur) ou la refuse avec une note ; le membre peut corriger et renvoyer.

### Mise à jour : messagerie privée

Si votre forum était déjà installé, exécutez une fois [`supabase/migration-messagerie.sql`](supabase/migration-messagerie.sql) dans le **SQL Editor**. Il ajoute la messagerie privée : conversations entre un ou plusieurs membres (seuls les participants peuvent les lire), et messages de l'équipe à **tous les membres** (lisibles par tous, sans réponse possible). Rien n'est supprimé.

### Mise à jour : nouvelle page d'accueil

Si votre forum était déjà installé, exécutez une fois [`supabase/migration-accueil.sql`](supabase/migration-accueil.sql) dans le **SQL Editor** : il active la liste « Présents ces dernières 24 heures ». Sans lui, l'accueil fonctionne mais n'affiche pas cette liste.

### Mise à jour : univers « Paris après la Fracture »

Si votre forum était déjà installé avant cette version, exécutez une fois [`supabase/migration-paris.sql`](supabase/migration-paris.sql) dans le **SQL Editor**. Il renomme les anciennes zones RP en territoires de Paris (les sujets sont conservés), ajoute les nouveaux territoires, remplit les pages d'univers et passe les anciennes factions des personnages en « Sans allégeance ». Aucun sujet, message, membre ni personnage n'est supprimé.

### Mise à jour : envoi d'images

Si vous avez installé le forum avant l'ajout de l'envoi d'images, exécutez une fois [`supabase/avatars.sql`](supabase/avatars.sql) dans le **SQL Editor** (il est déjà inclus dans `schema.sql` pour une nouvelle installation). Les membres peuvent alors envoyer leur avatar et l'image de leurs personnages depuis leur ordinateur (2 Mo maximum, stockés gratuitement dans Supabase, 1 Go inclus).

### 5. Devenir administrateur

1. Inscrivez-vous sur votre forum et confirmez votre e-mail.
2. Dans Supabase › **SQL Editor**, exécutez (avec votre pseudo) :

```sql
update public.profiles set role = 'admin' where username = 'VotrePseudo';
```

3. Rechargez le forum : le menu **Modération** apparaît. Vous pouvez ensuite nommer des gardiens (modérateurs) depuis l'onglet **Membres** de ce menu.

### 6. Personnaliser l'univers

Menu **Univers** : les pages **La Fracture**, **Les factions** et **Paris aujourd'hui** sont déjà remplies. Modifiez-les ou ajoutez-en d'autres (personnages importants, chronologie…) avec les boutons **Modifier** et **+ Nouvelle page**.

## Le parcours d'un joueur

1. Il s'inscrit et se présente dans **Présentations** (hors-jeu).
2. Il crée sa fiche via **Personnages › Créer un personnage**, puis l'envoie en validation.
3. Un gardien la lit dans **Modération › Fiches à valider**, puis la valide ou la renvoie avec une note.
4. Une fois validée, le personnage apparaît dans la galerie et le joueur peut écrire dans les zones RP en le choisissant au moment de poster.

## Tester en local (facultatif)

Depuis le dossier du projet : `npx serve .` ou `python3 -m http.server 8080`, puis ouvrez <http://localhost:8080>.

## Limites de l'offre gratuite

- **Supabase** : 500 Mo de base de données (des centaines de milliers de messages), 50 000 utilisateurs actifs par mois.
  Un projet gratuit est mis en **pause après 7 jours sans aucune visite** : il suffit de le relancer d'un clic dans le tableau de bord.
- **E-mails** : le service d'e-mails intégré de Supabase est limité à quelques envois par heure. Pour un forum actif,
  branchez un fournisseur gratuit (Resend, Brevo…) dans **Authentication** › **Emails** › **SMTP Settings**,
  ou désactivez la confirmation d'e-mail dans **Authentication** › **Providers** › **Email**.
- **GitHub Pages** : gratuit pour les dépôts publics.

## Rôles

| Rôle | Nom affiché | Droits |
|---|---|---|
| `member` | Membre | Créer ses fiches, jouer ses personnages validés, poster en HRP, modifier/supprimer ses messages, applaudir, signaler |
| `moderator` | Gardien | + valider les fiches, poster en Narrateur, écrire les pages d'univers, épingler, verrouiller, déplacer, supprimer, signalements, bannir des membres |
| `admin` | Administrateur | + gérer les rôles et les catégories |

## Structure

```
index.html            page unique du forum
css/style.css         thème visuel
js/config.js          vos clés Supabase et le nom du forum
js/app.js             toute la logique (navigation, pages, appels à la base)
supabase/schema.sql   tables, règles de sécurité, catégories et pages d'univers de départ
supabase/migration-*.sql  mises à jour pour un forum déjà installé
```

---

Forum de fans non officiel. *Clair Obscur : Expedition 33* est une œuvre de Sandfall Interactive ; ce projet n'y est pas affilié et n'utilise aucun visuel du jeu. Pour les images de personnages, utilisez des créations dont vous avez les droits.
