/**
 * LIFT — langue des trackers (français ou anglais).
 *
 * La langue vient de <html lang="..."> : les pages sous /en/ sont en anglais.
 * Chaque tracker crée son traducteur avec ses propres traductions :
 *
 *   const I18N = window.LIFT_I18N;
 *   const T = I18N.traducteur({ 'Texte français': 'English text' });
 *   T('Texte français')            // « English text » sur les pages anglaises
 *   T('{0} brevets', n)            // les {0}, {1}... sont remplacés par les arguments
 *
 * La clé est toujours le texte français affiché : un texte sans traduction reste
 * en français. Sur une page anglaise, la console liste les textes sans traduction :
 * taper LIFT_I18N.manquants dans la console du navigateur.
 *
 * Les noms de pays et les libellés communs à plusieurs trackers sont ci-dessous.
 */
(function () {
  'use strict';

  const lang = (document.documentElement.lang || 'fr').toLowerCase().indexOf('en') === 0 ? 'en' : 'fr';

  const COMMUN = {
    // Libellés d'interface
    'Pays': 'Country',
    'Année': 'Year',
    'Chargement...': 'Loading...',
    'Chargement des données...': 'Loading data...',
    'Impossible de charger les données. Veuillez rafraîchir la page.': 'Unable to load the data. Please refresh the page.',
    'Toutes les années': 'All years',
    'Total': 'Total',
    // Pays et zones
    'Allemagne': 'Germany',
    'Australie': 'Australia',
    'Autriche': 'Austria',
    'Belgique': 'Belgium',
    'Canada': 'Canada',
    'Chili': 'Chile',
    'Chine': 'China',
    'Corée du Sud': 'South Korea',
    'Danemark': 'Denmark',
    'Espagne': 'Spain',
    'Finlande': 'Finland',
    'France': 'France',
    'Grèce': 'Greece',
    'Hongrie': 'Hungary',
    'Inde': 'India',
    'Irlande': 'Ireland',
    'Israël': 'Israel',
    'Italie': 'Italy',
    'Japon': 'Japan',
    'Liechtenstein': 'Liechtenstein',
    'Luxembourg': 'Luxembourg',
    'Mexique': 'Mexico',
    'Norvège': 'Norway',
    'Nouvelle-Zélande': 'New Zealand',
    'Pays-Bas': 'Netherlands',
    'Pologne': 'Poland',
    'Portugal': 'Portugal',
    'Roumanie': 'Romania',
    'Royaume-Uni': 'United Kingdom',
    'Singapour': 'Singapore',
    'Slovaquie': 'Slovakia',
    'Slovénie': 'Slovenia',
    'Suisse': 'Switzerland',
    'Suède': 'Sweden',
    'Taïwan': 'Taiwan',
    'Tchéquie': 'Czechia',
    'Zone euro': 'Euro area',
    'États-Unis': 'United States',
    'Union européenne (UE-27)': 'European Union (EU-27)',
    'Europe (UE+NO/CH/UK)': 'Europe (EU+NO/CH/UK)',
    'Reste du monde': 'Rest of the world',
    'UE-27': 'EU-27',
    'Europe': 'Europe'
  };

  const manquants = new Set();

  function remplir(texte, args) {
    if (!args.length) return texte;
    return String(texte).replace(/\{(\d+)\}/g, (m, i) => (args[i] !== undefined ? args[i] : m));
  }

  function traducteur(dico) {
    dico = dico || {};
    return function T(texte, ...args) {
      if (lang !== 'en' || texte == null) return remplir(texte, args);
      let r = dico[texte];
      if (r === undefined) r = COMMUN[texte];
      if (r === undefined) {
        if (/[A-Za-zÀ-ÿ]{2}/.test(texte)) manquants.add(texte);
        r = texte;
      }
      return remplir(r, args);
    };
  }

  window.LIFT_I18N = {
    lang: lang,
    locale: lang === 'en' ? 'en-US' : 'fr-FR',
    traducteur: traducteur,
    manquants: manquants
  };
})();
