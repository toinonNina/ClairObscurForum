# Les Chroniques de Lumière

Forum de **jeu de rôle par écrit (RPG)** francophone dans l'univers de **Clair Obscur : Expedition 33**, 100 % gratuit à héberger.

- **Site** : fichiers statiques (HTML, CSS, JavaScript) publiés par **GitHub Pages**.
- **Base de données SQL** : **Supabase** (PostgreSQL), qui fournit aussi les comptes utilisateurs et la sécurité.
- Aucun serveur à gérer, aucune compilation, aucune carte bancaire.

## Fonctionnalités

### Jeu de rôle
- **Fiches de personnage** liées au compte du joueur (plusieurs personnages par joueur) : identité, origine, apparence, caractère, histoire, capacités, image, citation
- **Validation des fiches** par l'équipe : brouillon › en attente › validée / à retravailler (avec une note pour le joueur) › archivée
- **Zones RP et HRP** : dans les zones « en jeu », on poste **en incarnant un personnage validé** (choisi dans une liste) ; l'équipe peut poster en **Narrateur**. Dans les zones « hors-jeu », on parle en tant que joueur. Ces règles sont vérifiées par la base de données elle-même.
- **Galerie des personnages** filtrable par camp, page de chaque personnage avec ses dernières apparitions
- **Pages « Univers »** (contexte, lieux, guide de création, règlement RP) que l'équipe rédige et modifie depuis le site
- 6 zones RP (Lumière, le Port, le Continent, le Camp, Souvenirs, Événements) et 5 zones HRP créées au départ, toutes modifiables

### Forum
- Catégories (salons) avec compteurs de sujets et de messages
- Sujets et réponses avec pagination, mise en forme Markdown, citations, aperçu
- Balises spoiler : `||texte caché||` (cliquer pour révéler)
- Applaudissements (likes) sur les messages
- Comptes : inscription, confirmation par e-mail, connexion, mot de passe oublié
- Profils : avatar, devise, présentation, statistiques, messages récents
- Liste des membres et de l'équipe
- Recherche dans les titres et les messages
- Modération : fiches à valider, épingler, verrouiller, déplacer, renommer, supprimer, signalements, bannissement
- Administration : rôles (membre, gardien, administrateur) et gestion des catégories (type RP ou HRP)
- Sécurité côté base de données (Row Level Security) : même en contournant le site, personne ne peut faire plus que ses droits
- Thème original « Belle Époque nocturne », adapté au mobile

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

### 5. Devenir administrateur

1. Inscrivez-vous sur votre forum et confirmez votre e-mail.
2. Dans Supabase › **SQL Editor**, exécutez (avec votre pseudo) :

```sql
update public.profiles set role = 'admin' where username = 'VotrePseudo';
```

3. Rechargez le forum : le menu **Modération** apparaît. Vous pouvez ensuite nommer des gardiens (modérateurs) depuis l'onglet **Membres** de ce menu.

### 6. Personnaliser l'univers

Menu **Univers** : complétez les pages **Le contexte** et **Les lieux** (époque du forum, nombre actuellement peint, personnages canons jouables ou non…) avec le bouton **Modifier**. Vous pouvez ajouter autant de pages que vous voulez.

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
```

---

Forum de fans non officiel. *Clair Obscur : Expedition 33* est une œuvre de Sandfall Interactive ; ce projet n'y est pas affilié et n'utilise aucun visuel du jeu. Pour les images de personnages, utilisez des créations dont vous avez les droits.
