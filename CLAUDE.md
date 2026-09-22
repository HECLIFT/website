# Instructions pour un agent IA travaillant sur ce dépôt

Ce fichier vaut aussi comme `CLAUDE.md`. Lisez-le avant toute modification.

## Ce qu'est ce dépôt

La branche `gh-pages` **est** le site en ligne (GitHub Pages, build « legacy » :
les fichiers sont servis tels quels, aucun build côté GitHub en dehors de notre Action).
Il n'y a **pas** de Quarto. La branche `main` contient une source Quarto obsolète qui
ne reproduit pas le design actuel : **ne jamais la rendre ni la publier**.

## Règle numéro un

Le contenu éditorial vit dans `content/*.json` et les pages sont **générées**.
Ne modifiez jamais à la main : `membres.html`, `membres/*.html`, ni le compteur de
membres de `index.html`. Modifiez le JSON, puis lancez :

```bash
python3 build/validate.py && python3 build/generate.py
```

Les pages non encore générées (publications, trackers, à-propos, accueil hors compteur)
s'éditent encore en HTML — avec précaution, voir ci-dessous.

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
- **Photos de membre** : JPG carré 800×800, `images/membres/<id>.jpg`.
- **Co-auteurs externes** : en texte simple, jamais en lien — une page membre qui
  n'existe pas donne un 404.
- **Trackers** : les graphiques lisent les CSV dans le navigateur. Changer un CSV suffit ;
  garder noms de fichiers et de colonnes. Certains titres contiennent encore des années
  en dur dans `assets/js/*.js` — à vérifier quand la série s'allonge.
- **`data/pubs.json`** est un vestige orphelin : personne ne le lit. Ne pas s'y fier.

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
