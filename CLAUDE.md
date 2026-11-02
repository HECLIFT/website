# Instructions pour un agent IA travaillant sur ce dépôt

Ce fichier vaut aussi comme `CLAUDE.md`. Lisez-le avant toute modification.

## Ce qu'est ce dépôt

La branche `gh-pages` **est** le site en ligne (GitHub Pages, build « legacy » :
les fichiers sont servis tels quels, aucun build côté GitHub en dehors de notre Action).
Il n'y a **pas** de Quarto. La branche `main` contient une source Quarto obsolète qui
ne reproduit pas le design actuel : **ne jamais la rendre ni la publier**.

## Règle numéro un

Le contenu éditorial vit dans `content/*.json` et les pages sont **générées**.
Ne modifiez jamais à la main : `membres.html`, `membres/*.html`, ni les compteurs de
membres et de publications de `index.html`. Modifiez le JSON, puis lancez :

```bash
python3 build/validate.py && python3 build/generate.py
```

**Pages assemblées et version anglaise (depuis le 2 novembre 2026, pilote sur l'accueil).**
Une page listée dans `content/pages.json` est assemblée par `build/generate.py` à partir de
`build/templates/base.html` (en-tête, menu, sélecteur FR | EN, pied de page, communs à toutes
ces pages), de son contenu de `<main>` (`content/pages/fr/<chemin>` et, si elle a une version
anglaise, `content/pages/en/<chemin>`) et de son bloc `<style>` propre
(`content/pages/head/<chemin>`). Les libellés de l'interface (menu, pied de page, recherche,
marque) sont dans `content/interface.json`, en français et en anglais. Ne modifiez jamais à la
main ces pages ni leur jumeau `en/<chemin>`, ni `sitemap.xml`, ni `en/search.json` : modifiez
les fragments ou le JSON, puis lancez le générateur. Les liens de la page anglaise vers une page
qui n'a pas encore de version anglaise mènent à la page française (réécrits automatiquement).
Une modification de structure du fragment français doit être reportée dans le fragment anglais :
`build/validate.py` refuse deux fragments dont les balises, `id` et classes diffèrent.
Seul l'accueil est assemblé pour l'instant ; les autres pages (publications, trackers,
à-propos, vues d'ensemble) s'éditent encore en HTML, avec précaution, voir ci-dessous.

## Pièges connus (vécus)

- **Ne jamais faire de rechercher-remplacer sur `mailto:`.** Cinq pages ont été cassées
  ainsi : l'adresse s'est insérée dans `new RegExp(/^mailto:/)` et dans un *template
  literal* du script de partage, ce qui produit une **erreur de syntaxe JavaScript** sur
  toute la page. Le générateur corrige ces pages ; ne réintroduisez pas le problème.
- **Vignettes** : illustration plate sur fond beige `#F0D99A`, 540×540, PNG.
  La palette exacte et la consigne de génération sont dans
  [`build/vignette-style.md`](build/vignette-style.md) — **s'y tenir à la lettre**, ne
  jamais inventer une couleur. Toujours en `.png`, jamais les vieux `.svg` de carte.
- **Rendu des vignettes** : carré, `object-fit: cover`, sans cadre gris ni padding,
  bordure fine + `border-radius: 6px`.
- **Photos de membre** : JPG carré 800×800, `images/membres/<id>.jpg` ; facultative : sans champ
  `photo`, le générateur met l'avatar par défaut `images/membres/anonyme.jpg`.
- **Co-auteurs externes** : en texte simple, jamais en lien — une page membre qui
  n'existe pas donne un 404.
- **Trackers** : les graphiques lisent les CSV dans le navigateur. Changer un CSV suffit ;
  garder noms de fichiers et de colonnes. Certains titres contiennent encore des années
  en dur dans `assets/js/*.js` — à vérifier quand la série s'allonge.
- **Mesure d'audience (GoatCounter, compte `heclift`)** : toute page HTML porte, juste avant
  `</head>`, le script GoatCounter ; une nouvelle page doit le reprendre, `build/validate.py`
  le vérifie. Pas de cookies, donc pas de bandeau de consentement. Les boutons PDF portent
  `data-goatcounter-click="pdf-<id>"` (posé par `build/generate.py`), y compris le bouton PDF
  de « Dernière publication » sur l'accueil, **à mettre à jour à la main** dans
  `content/pages/fr/index.html` et `content/pages/en/index.html` quand la publication mise en
  avant change (avec « Activité récente »). Une version anglaise (champ `pdf_en` de `content/publications.json`) a son propre
  bouton, compté sous `pdf-en-<id>` ; le PDF garde le nom de la version française suivi de `_en`. Les pages de `assets/maps/` (iframes) n'ont pas le script, pour ne pas
  compter deux fois une visite.
- **`data/pubs.json`** est un vestige orphelin : personne ne le lit. Ne pas s'y fier.

- **Bandeau et logos des partenaires** : la mention « Avec le soutien d’Accenture et Google »
  (ligne `line3` de la marque, en haut à gauche) et les logos du pied de page sont écrits en dur
  dans chaque page, dans `build/templates/` et dans `content/interface.json` (clé `marque.soutien`,
  « With the support of Accenture and Google » en anglais) : une modification se fait partout à la fois. Le logo
  Google pointe vers https://www.google.org/ (demande de Google, octobre 2026).

## Ne pas faire

- Ne pas supprimer de fichiers sans demander : ce dépôt **est** le site en production.
- Ne pas `git push --force` sur `gh-pages`.
- Ne pas committer de clés ou de fichiers de credentials (les pipelines des trackers en
  utilisent : ils passent par des *GitHub Secrets*, jamais par le dépôt).
- Ne pas ajouter de dépendances : le générateur n'utilise que la bibliothèque standard.

## Vérifier avant de publier

```bash
python3 build/validate.py     # contenu + données des trackers
python3 build/generate.py --check   # les pages sont-elles en phase avec content/ ?
```
