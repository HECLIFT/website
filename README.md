# Site du LIFT

Site du Laboratoire de l'Innovation et du Futur du Travail (HEC Paris) —
**https://heclift.github.io/website/**

Cette branche (`gh-pages`) **est** le site : GitHub Pages sert ces fichiers tels quels.
Il n'y a pas de Quarto, pas de Next.js, rien à installer.

## Comment ça marche

```
content/*.json  ──►  build/generate.py  ──►  les pages HTML  ──►  site en ligne
data/*.csv      ──────────────────────────►  graphiques des trackers (lus par le navigateur)
```

Vous modifiez `content/` ou `data/` depuis GitHub, et une **GitHub Action** régénère
les pages et publie. Vous n'avez rien à lancer sur votre ordinateur.

## Les trois choses qu'on fait le plus souvent

### Ajouter ou modifier un membre
1. Ouvrir [`content/members.json`](content/members.json) → ✏️ → ajouter un bloc :
   ```json
   {
     "id": "cdupont",
     "nom": "Camille Dupont",
     "section": "Chargés d'étude",
     "role": "Chargée d'étude",
     "photo": "images/membres/cdupont.jpg",
     "email": "camille.dupont@hec.edu"
   }
   ```
2. Déposer la photo dans `images/membres/` sous le nom indiqué (JPG carré, 800×800).
3. « Commit ». Une minute plus tard : sa page existe, elle apparaît dans la bonne
   section, le compteur de la page d'accueil est à jour.

Champs facultatifs : `bio` (texte sur sa page), `bio_courte` (texte dans la liste),
`page_perso`, `email`, `x`, `linkedin`. Les autres sont obligatoires.

**Ses publications, on ne les écrit pas ici** : sa page liste automatiquement toute
publication dont il est auteur dans `publications.json`. Rien à tenir à jour en double.

### Ajouter une publication
1. Ajouter un bloc dans [`content/publications.json`](content/publications.json) :
   ```json
   {
     "id": "ia-competences",
     "titre": "IA et compétences : ce que change l'automatisation",
     "type": "pb",
     "type_label": "Note de politique",
     "date": "Octobre 2026",
     "auteurs": ["Antonin Bergeaud", "Gabriela Terra"],
     "auteurs_liens": [
       {"membre": "abergeaud", "nom": "Antonin Bergeaud"},
       {"membre": "golterra",  "nom": "Gabriela Terra"}
     ],
     "venue": "Policy Note HEC — Octobre 2026",
     "tags": ["IA", "Compétences", "France"],
     "resume": "Deux ou trois phrases.",
     "thumb": "images/pubs/ia-competences.png",
     "pdf": "files/papers/ia-competences.pdf"
   }
   ```
   `type` vaut `pb` (note de politique) ou `wp` (working paper). Un auteur externe
   s'écrit `{"nom": "Camille Frouard"}` — sans `membre`, donc sans lien.
2. Déposer le PDF dans `files/papers/` et la vignette dans `images/pubs/`
   (style imposé : [`build/vignette-style.md`](build/vignette-style.md)).
3. « Commit ». La page de la publication, l'entrée dans la liste **et le lien depuis la
   page de chaque auteur membre** sont créés automatiquement : rien d'autre à modifier.

### Mettre à jour un tracker
Remplacer le ou les CSV dans `data/…` **en gardant le même nom et les mêmes colonnes**.
Les graphiques sont dessinés dans le navigateur à partir de ces fichiers : rien d'autre
à faire. Si un fichier est mal formé, l'Action échoue avec un message et le site en
ligne n'est pas touché.

| Tracker | Dossier de données | Fréquence |
|---|---|---|
| Diffusion IA — emploi | `data/ai-trackers/diffusion-emploi/` | Trimestriel |
| Diffusion IA — science | `data/ai-trackers/diffusion-science/` | Annuel |
| Productivité | `data/innovation-data/productivite/` | Annuel |
| Innovation high-tech | `data/innovation-data/innovation-hightech/` | Semestriel |
| Innovation de rupture | `data/innovation-data/breakthrough/` | Semestriel |

D'où viennent ces CSV : voir [`tracker_manifest.json`](tracker_manifest.json).

## Si vous préférez ne pas toucher aux fichiers

Ouvrez une **issue** avec un des modèles (« Ajouter un membre », « Ajouter une
publication », « Mettre à jour un tracker ») : remplissez le formulaire, joignez la
photo ou les CSV, quelqu'un s'en charge.

## Ce qui est généré et ce qui ne l'est pas

| Page | Comment on la modifie |
|---|---|
| Liste des membres, page de chaque membre, compteur de l'accueil | **générées** depuis `content/members.json` — ne pas les éditer à la main |
| Liste des publications, page de chaque publication | **générées** depuis `content/publications.json` |
| Graphiques des trackers | **données** : remplacer les CSV dans `data/` |
| Page d'accueil (hors compteur), « À propos », textes des pages de trackers | encore en HTML, à modifier directement — avec précaution |

## Pour les curieux

| Dossier | Contenu |
|---|---|
| `content/` | le contenu éditorial (membres, publications) |
| `data/` | les données des trackers (CSV/JSON lus par le navigateur) |
| `build/` | le générateur (`generate.py`) et le validateur (`validate.py`) |
| `assets/js/` | le code des graphiques |
| `images/`, `files/` | photos, vignettes, PDF |

En local, si vraiment besoin : `python3 build/validate.py` puis `python3 build/generate.py`
(Python 3.12, aucune dépendance).

> La branche `main` contient une ancienne source Quarto **qui ne reproduit plus ce site**.
> Ne la rendez pas, ne la publiez pas par-dessus `gh-pages`.