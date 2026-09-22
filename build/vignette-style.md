# Style des vignettes (publications et trackers)

Toutes les vignettes du site forment **une seule famille visuelle**. Une nouvelle
vignette doit être indiscernable des dix existantes. Ce fichier est la référence :
une IA qui génère une vignette doit s'y tenir **à la lettre**, sans « améliorer » la
palette ni changer les proportions.

## Format

- **540 × 540 px**, carré, PNG.
- Publications → `images/pubs/<id>.png` · Trackers → `images/trackers/<id>.png`.
- Illustration **plate** (flat), style pictogramme : aplats de couleur, pas de dégradés,
  pas d'ombres portées, pas de 3D, pas de texture, pas de texte.
- Fabriquées en **écrivant du SVG**, converti en PNG (`cairosvg`) — pas par un modèle
  d'image. L'avantage : le résultat est reproductible et se corrige ligne par ligne.

## Palette — les seules couleurs autorisées

Relevées sur les vignettes existantes ; les pourcentages sont leur poids réel sur
l'ensemble des dix.

| Rôle | Hex | Poids | Usage |
|---|---|---|---|
| Fond beige | `#F0D99A` | 67,7 % | le fond, **toujours** ; remplit tout le carré |
| Beige clair | `#F1EBD9` | 4,1 % | second plan, surfaces claires |
| Rouge | `#C4392E` | 3,4 % | l'accent principal — présent sur 9 vignettes sur 10 |
| Vert olive | `#BBBD86` / `#AFB782` | 4,0 % | masses secondaires |
| Encre | `#171513` | 1,5 % | traits, contours, silhouettes |
| Bleu marine | `#1F3A5F` | 1,2 % | second accent |
| Jaune doré | `#EACB74` `#E8C566` `#E2B53C` | ~2 % | nuances du fond, détails |
| Vert foncé | `#2D5A3D` | rare | détails végétaux/verts |
| Orange | `#D97A3C` | rare | détail chaud, avec parcimonie |

**Interdits :** toute couleur hors de cette liste, un fond qui ne soit pas `#F0D99A`,
le blanc pur `#FFFFFF`, le noir pur `#000000`.

## Composition

- Le sujet occupe le centre, avec une marge visuelle d'environ 10 % sur les bords.
- Deux à quatre formes principales, lisibles à 120 px (taille d'affichage réelle).
- Le rouge `#C4392E` sert d'accent unique : une seule zone rouge, franche.
- Pas de bordure dessinée : le cadre arrondi est appliqué par le CSS du site.

## Affichage sur le site

Carré, `object-fit: cover`, **sans fond gris ni padding**, bordure fine +
`border-radius: 6px`. Classes concernées : `.pub-thumb`, `.tracker-thumb`,
`.innov-thumb`, `.member-pub .thumb img` (120 × 120).

## Consigne prête à l'emploi

> Génère une vignette carrée 540×540 en SVG, style illustration plate/pictogramme,
> sur le thème : « … ». Fond `#F0D99A` couvrant tout le carré. Utilise uniquement :
> `#F0D99A`, `#F1EBD9`, `#C4392E`, `#BBBD86`, `#AFB782`, `#171513`, `#1F3A5F`,
> `#EACB74`, `#E2B53C`, `#2D5A3D`, `#D97A3C`. Aucun dégradé, aucune ombre, aucun texte.
> Deux à quatre formes principales centrées, lisibles en petit, avec une seule zone
> d'accent en `#C4392E`. Convertis ensuite en PNG avec `cairosvg`.
