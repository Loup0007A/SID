import type { IconName } from "@/components/icons/sidIcons";
import type { PermissionKey } from "@/types/database";

/**
 * Le tuto du Dossier Central (Lot 53) : tout le texte est ici.
 *
 *   CHAPTERS / TOUR  la visite guidée, page après page. `target` désigne un
 *                    élément de la page marqué data-tuto="…" ; s'il manque
 *                    (pas de quête ouverte, page réservée…), l'étape
 *                    s'affiche au centre avec `missing`.
 *   PAGE_TIPS        l'astuce de première visite de chaque page.
 *   STEPS            les premiers pas (vérifiés par la base : get_onboarding).
 *
 * Les chiffres (taux, limites…) viennent de la base, jamais écrits en dur :
 * voir `TutoNumbers`. Mise en forme des textes : **gras**, et une ligne vide
 * pour changer de paragraphe.
 */

export type TutoNumbers = {
  salary: number | null;
  bank_rate: number;
  debt_rate: number;
  max_debt: number;
  vat: number;
  wealth_tax: number;
  sim_per_day: number;
  injury_minutes: number;
  min_holding_minutes: number;
};

export const DEFAULT_NUMBERS: TutoNumbers = {
  salary: null,
  bank_rate: 0.01,
  debt_rate: 0.02,
  max_debt: 50000,
  vat: 0.05,
  wealth_tax: 0.02,
  sim_per_day: 10,
  injury_minutes: 60,
  min_holding_minutes: 30,
};

export const pct = (v: number) => `${(Math.round(v * 1000) / 10).toLocaleString("fr-FR")} %`;
export const zenis = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} z`;

type Text = string | ((n: TutoNumbers, nickname: string) => string);

export type TutoChapter = { n: number; title: string; icon: IconName };

export type TutoStep = {
  id: string;
  chapter: number;
  route: string;
  target?: string;
  icon: IconName;
  title: string;
  body: Text;
  /** Texte de remplacement quand l'élément n'est pas sur la page. */
  missing?: Text;
  /** Réservé aux membres qui ont l'une de ces permissions. */
  perm?: PermissionKey[];
};

export const CHAPTERS: TutoChapter[] = [
  { n: 1, title: "Le Dossier Central", icon: "home" },
  { n: 2, title: "Ton dossier", icon: "profile" },
  { n: 3, title: "Les quêtes", icon: "scroll" },
  { n: 4, title: "La carte", icon: "map" },
  { n: 5, title: "L'entraînement", icon: "brain" },
  { n: 6, title: "L'argent", icon: "coins" },
  { n: 7, title: "Les autres agents", icon: "people" },
  { n: 8, title: "Les secrets", icon: "padlock" },
];

export const TOUR: TutoStep[] = [
  // ------------------------------------------------------------ 1. Accueil
  {
    id: "bienvenue",
    chapter: 1,
    route: "/dashboard",
    icon: "idcard",
    title: "Bienvenue, agent",
    body: (_, nick) =>
      `Bienvenue au **S.I.D.**, le Système International Dictatorial. Ceci est son **Dossier Central** : ton QG. Quêtes, entraînement, argent, messages… tout part d'ici.\n\nDeux sites l'accompagnent : la **Cartographie** (le monde, ses routes, ses lieux) et le **Wiki** (lieux, armes, monstres, objets, compétences : à découvrir). Même compte partout.\n\nCette visite dure environ cinq minutes, ${nick}. Les flèches du clavier marchent aussi.`,
  },
  {
    id: "solde",
    chapter: 1,
    route: "/dashboard",
    target: "solde",
    icon: "coins",
    title: "Ton argent",
    body: (n) =>
      `Le S.I.D. paie en **zénis (z)**. Ils arrivent par ton salaire${n.salary ? ` (**${zenis(n.salary)}** par semaine pour toi)` : ""}, les récompenses de quêtes, tes ventes et tes placements.\n\nChaque semaine, un impôt de **${pct(n.wealth_tax)}** est prélevé sur ton solde positif. Toucher ce cadre ouvre la Banque.`,
  },
  {
    id: "a-faire",
    chapter: 1,
    route: "/dashboard",
    target: "a-faire",
    icon: "bell",
    title: "Ce qui t'attend",
    body: "Ici s'affiche ce qui demande ton attention **en ce moment** : missions en cours, notifications non lues (et, si tu as des responsabilités, candidatures ou alertes à traiter).\n\nQuand il n'y a rien, un raccourci t'emmène vers les quêtes ouvertes.",
  },
  {
    id: "tuiles",
    chapter: 1,
    route: "/dashboard",
    target: "groupe-espace",
    icon: "menu",
    title: "Toutes les pages",
    body: "L'accueil range chaque page en tuile, par rubrique : **Mon espace**, **Le S.I.D.**, **Entraînement**, **Économie** (et **Administration** si tu en as les droits).\n\nUne tuile rayée jaune et noir est en travaux ou suspendue. Où que tu sois, « ← Accueil » en haut te ramène ici.",
  },
  {
    id: "aide",
    chapter: 1,
    route: "/dashboard",
    target: "aide",
    icon: "question",
    title: "Perdu ? Ce bouton",
    body: "Le **?** en haut de chaque page relance cette visite, rouvre l'astuce de la page où tu es, ou ouvre le **Guide du S.I.D.** : le manuel complet, avec tes premiers pas et ta prime d'intégration.",
  },

  // ------------------------------------------------------------ 2. Dossier
  {
    id: "rang",
    chapter: 2,
    route: "/dashboard/profile",
    target: "profil-rang",
    icon: "rank",
    title: "Ton rang",
    body: "Chaque agent a un rang, de **E** à **S** (et, pour une poignée de légendes, **Divin**). Il pèse sur ce qu'on te confie.\n\nOn monte de rang par décision de l'état-major, ou en s'offrant une **Promotion** dans l'arbre technologique.",
  },
  {
    id: "fiche",
    chapter: 2,
    route: "/dashboard/profile",
    target: "profil-fiche",
    icon: "camera",
    title: "Ta fiche d'agent",
    body: "Ta photo, ton surnom, tes armes, ton équipement et ta présentation : c'est ce que les autres membres voient au trombinoscope et sur ton dossier.\n\nUne **photo** et une **présentation** d'au moins une ligne comptent dans tes premiers pas.",
  },
  {
    id: "notifs",
    chapter: 2,
    route: "/dashboard/profile",
    target: "profil-notifs",
    icon: "bell",
    title: "Être prévenu partout",
    body: "La cloche en haut du site garde tout ce qui t'arrive. Active ici les **notifications push** pour être prévenu même onglet fermé : message reçu, quête validée, appel à l'aide, arrivée à destination…\n\nSur iPhone, il faut d'abord ajouter le site à l'écran d'accueil (la marche à suivre est juste là).",
  },

  // ------------------------------------------------------------ 3. Quêtes
  {
    id: "types",
    chapter: 3,
    route: "/dashboard/quests",
    target: "quetes-types",
    icon: "scroll",
    title: "Le panneau des quêtes",
    body: "Les **quêtes** sont le cœur du jeu : des missions publiées par l'état-major ou par d'autres agents, payées en zénis et en **renommée**.\n\nChaque type de contrat a sa couleur : Tuer, Chasse, Raid, Espionnage, Politique, Collecte / Vol, Missions extérieures…",
  },
  {
    id: "quete",
    chapter: 3,
    route: "/dashboard/quests",
    target: "quete",
    icon: "clipboard",
    title: "Lire une fiche de mission",
    body: "Le **rang** (E à S) dit la difficulté. Puis viennent la récompense, la renommée, l'échéance et le nombre de places.\n\nCertaines missions exigent un niveau minimum (Intelligence, Puissance, Technique) : le bouton reste grisé tant que tu ne l'as pas. Sinon, **Prendre la mission**, et tu peux même choisir pour qui tu la prends (qui touchera l'argent).",
    missing: "Aucune quête n'est ouverte en ce moment : elles apparaîtront ici, en fiches de papier. Le rang (E à S) dit la difficulté, puis viennent la récompense, la renommée, l'échéance et les places.\n\n**Prendre la mission** t'y inscrit (le bouton reste grisé si un niveau minimum est exigé).",
  },
  {
    id: "renommee",
    chapter: 3,
    route: "/dashboard/quests",
    icon: "medal",
    title: "Réussir, échouer, la renommée",
    body: "Une mission est **validée** par son responsable, ou toute seule à l'échéance si assez d'agents y participent. Il en manque juste un ? Le créateur décide. Sinon, c'est l'échec.\n\nLa **renommée** se calcule comme aux échecs : réussir au-dessus de ton niveau rapporte gros, échouer une mission facile coûte cher. Elle compte au classement.",
  },

  // ------------------------------------------------------------ 4. Carte
  {
    id: "position",
    chapter: 4,
    route: "/dashboard/map",
    target: "carte-position",
    icon: "pin",
    title: "Où tu es",
    body: "Ton personnage est quelque part dans le monde. La **première fois**, tu choisis ton point de départ.\n\nEnsuite, on ne se téléporte plus : chaque changement de lieu est un **trajet chronométré**, qui continue même page fermée.",
  },
  {
    id: "trajet",
    chapter: 4,
    route: "/dashboard/map",
    target: "carte-trajet",
    icon: "road",
    title: "Voyager, et les quêtes sur place",
    body: "Choisis une destination : le plus court chemin est calculé, étape par étape. Une notification te prévient à l'arrivée.\n\nCertaines quêtes ont **un lieu** : va sur place (la fiche de la quête lance le trajet), puis reste-y **une heure** pour que ta présence soit confirmée.\n\nLa **Cartographie** (son propre site, même compte) ajoute montures, vols, plans des villes…",
    missing: "Une fois ta position posée, c'est ici que tu choisiras ta destination : le plus court chemin est calculé, étape par étape, et une notification te prévient à l'arrivée.\n\nCertaines quêtes ont **un lieu** : va sur place, puis reste-y **une heure** pour que ta présence soit confirmée.",
  },

  // ------------------------------------------------------------ 5. Entraînement
  {
    id: "facteurs",
    chapter: 5,
    route: "/dashboard",
    target: "groupe-entrainement",
    icon: "brain",
    title: "Trois facteurs, une puissance",
    body: "Ta force se mesure sur trois facteurs, de 0 à 100 :\n\n**Intelligence** (Potions, Énigmes, Problème), **Puissance** (Donjons) et **Technique** (Techniques).\n\nTa **puissance globale** est leur moyenne. Chaque simulation réussie fait monter son facteur d'un point.",
  },
  {
    id: "simulation",
    chapter: 5,
    route: "/dashboard/simulations/donjons",
    target: "sim-jeu",
    icon: "swords",
    title: "Une simulation",
    body: (n) =>
      `La simulation s'ouvre directement dans la page. Une réussite rapporte un point, un échec ne fait rien perdre. **${n.sim_per_day} résultats par jour** au plus.\n\nAux Donjons : à partir du niveau 50, une mort peut te coûter un membre (**${n.injury_minutes} min** sans Donjons). Face à un gardien trop fort, appelle à l'aide : les autres agents peuvent te rejoindre en **raid**.\n\nOn murmure qu'un **niveau 101** attend ceux qui ont tout fini…`,
  },
  {
    id: "techno",
    chapter: 5,
    route: "/dashboard/tech",
    target: "tech-arbre",
    icon: "tree",
    title: "L'arbre technologique",
    body: "Chaque simulation réussie te donne aussi **un point à dépenser** ici, pour des bonus permanents : primes de mission, salaire, intérêts, impôt et TVA réduits… et la **Promotion** d'un rang.\n\nDépenser des points ne fait jamais baisser tes facteurs.",
  },

  // ------------------------------------------------------------ 6. Argent
  {
    id: "epargne",
    chapter: 6,
    route: "/dashboard/bank",
    target: "banque-epargne",
    icon: "bank",
    title: "Épargner",
    body: (n) =>
      `L'argent déposé rapporte **${pct(n.bank_rate)} par jour**, intérêts composés, même quand tu n'es pas là.\n\nAttention : un nouveau dépôt relance le décompte. Mieux vaut déposer en une fois et laisser grossir.`,
  },
  {
    id: "emprunt",
    chapter: 6,
    route: "/dashboard/bank",
    target: "banque-emprunt",
    icon: "moneyFly",
    title: "Emprunter",
    body: (n) =>
      `Jusqu'à **${zenis(n.max_debt)}**, crédités tout de suite. Le prix : **${pct(n.debt_rate)} par jour** sur la somme empruntée.\n\nSi ces intérêts font passer ton solde sous zéro, la boutique t'est fermée jusqu'à ce qu'il remonte.`,
  },
  {
    id: "bourse",
    chapter: 6,
    route: "/dashboard/bank",
    target: "banque-bourse",
    icon: "chart",
    title: "La Bourse",
    body: (n) =>
      `Achète des **actions** des entreprises des agents. Leur cours suit la valeur de l'entreprise (fonds propres, bénéfices, dividendes), avec de la volatilité et parfois des actualités.\n\nUne action se garde au moins **${n.min_holding_minutes} min** avant revente. Les dividendes sont versés au prorata des actions.`,
  },
  {
    id: "boutique",
    chapter: 6,
    route: "/dashboard/shop",
    target: "boutique-vitrine",
    icon: "cart",
    title: "Le Comptoir",
    body: (n) =>
      `On y achète, et on y vend : chaque agent peut proposer ses objets. Le vendeur reverse **${pct(n.vat)} de TVA** à la caisse commune (l'acheteur paie le prix affiché).\n\nCertains objets ont un vrai effet, comme effacer d'un coup les délais d'attente des simulations.`,
    missing: (n) =>
      `La vitrine est vide pour l'instant. On y achète, et on y vend : chaque agent peut proposer ses objets. Le vendeur reverse **${pct(n.vat)} de TVA** à la caisse commune.`,
  },

  // ------------------------------------------------------------ 7. Agents
  {
    id: "messagerie",
    chapter: 7,
    route: "/dashboard/chat",
    target: "chat-liste",
    icon: "chat",
    title: "La messagerie",
    body: "Messages privés et **groupes** : « Nouvelle discussion », en haut de la liste. Gras, italique et couleur pour tes messages ; tu peux les modifier ou les supprimer.\n\nTes messages ne sont lus que par les participants de la discussion.",
  },
  {
    id: "classement",
    chapter: 7,
    route: "/dashboard/leaderboard",
    target: "classement-onglets",
    icon: "trophy",
    title: "Le classement",
    body: "Puissance, argent, renommée, quêtes accomplies : chaque onglet a son podium.\n\nLe **Trombinoscope** montre tous les agents, l'**Organigramme** la hiérarchie du S.I.D., et l'accueil te dit qui est **en ligne maintenant**.",
  },

  // ------------------------------------------------------------ 8. Secrets
  {
    id: "titres",
    chapter: 8,
    route: "/dashboard/titles",
    target: "titres-collection",
    icon: "masks",
    title: "Douze titres secrets",
    body: "Chaque titre s'obtient d'une façon **cachée** : tu ne vois qu'une énigme. Un titre équipé change ton dossier, et donne un **pouvoir de farce** à utiliser sur les autres agents (avec recharge, et quelques garde-fous).\n\nChaque grand événement de l'année a aussi son titre, à saisir pendant qu'il dure.",
  },
  {
    id: "fin",
    chapter: 8,
    route: "/dashboard/guide",
    target: "guide-premiers-pas",
    icon: "check",
    title: "Dossier complet",
    body: "C'est tout pour la visite, agent. Le reste, c'est à toi de le trouver… et le S.I.D. cache plus de choses qu'il n'en montre.\n\nVoici tes **premiers pas** : fais-en au moins cinq pour toucher ta **prime d'intégration**. Le **?** en haut de chaque page te ramène au Guide quand tu veux.",
  },
];

// ---------------------------------------------------------------- Premiers pas
export const STEPS: { key: string; label: string; detail: string; href: string; icon: IconName }[] = [
  { key: "dossier", label: "Compléter ton dossier", detail: "Une photo et une présentation d'au moins une ligne.", href: "/dashboard/profile", icon: "camera" },
  { key: "position", label: "Poser ta position", detail: "Choisir ton point de départ sur la carte.", href: "/dashboard/map", icon: "pin" },
  { key: "quete", label: "Prendre une mission", detail: "T'inscrire à une quête du panneau.", href: "/dashboard/quests", icon: "scroll" },
  { key: "simulation", label: "Réussir une simulation", detail: "Donjons, Intelligence ou Techniques.", href: "/dashboard/simulations/intelligence", icon: "brain" },
  { key: "techno", label: "Dépenser un point", detail: "Une amélioration dans l'arbre technologique.", href: "/dashboard/tech", icon: "tree" },
  { key: "message", label: "Envoyer un message", detail: "À un agent ou à un groupe.", href: "/dashboard/chat", icon: "chat" },
  { key: "argent", label: "Faire travailler ton argent", detail: "Épargner à la banque, ou acheter au Comptoir.", href: "/dashboard/bank", icon: "bank" },
];

// ---------------------------------------------------------------- Astuces de page
export type PageTip = { key: string; title: string; icon: IconName; points: Text[]; tourFrom?: string };

export const PAGE_TIPS: Record<string, PageTip> = {
  "/dashboard/profile": {
    key: "profile",
    title: "Mon dossier",
    icon: "profile",
    points: [
      "Ta photo et ta présentation sont visibles par tous les agents.",
      "Anniversaire facultatif : le jour J, un gâteau apparaît à côté de ton nom (la date n'est jamais montrée).",
      "Compte invisible et présence en ligne : tu choisis ce que les autres voient de toi.",
    ],
    tourFrom: "rang",
  },
  "/dashboard/chat": {
    key: "chat",
    title: "Messagerie",
    icon: "chat",
    points: ["« Nouvelle discussion » : un agent, ou plusieurs pour un groupe.", "Survole (ou touche) un de tes messages pour le modifier ou le supprimer.", "Gras, italique, couleur : la barre est juste au-dessus du champ."],
    tourFrom: "messagerie",
  },
  "/dashboard/notifications": {
    key: "notifications",
    title: "Notifications",
    icon: "bell",
    points: ["Tout ce qui t'est arrivé : argent reçu, quêtes, messages, arrivées, titres…", "Pour être prévenu onglet fermé : Mon dossier → Notifications push."],
  },
  "/dashboard/titles": {
    key: "titles",
    title: "Titres",
    icon: "medal",
    points: ["Chaque titre verrouillé n'affiche qu'une énigme : à toi de comprendre.", "Un pouvoir de farce ne marche qu'avec son titre équipé, et se recharge.", "Les titres d'événement ne s'obtiennent que pendant l'événement, mais se gardent."],
    tourFrom: "titres",
  },
  "/dashboard/settings": {
    key: "settings",
    title: "Réglages",
    icon: "gear",
    points: ["Habille ta carte, ta ligne de classement et ta fiche, sans écrire de code (ou en CSS, si tu préfères).", "Ton style ne s'applique qu'à toi, jamais au reste de la page."],
  },
  "/dashboard/privacy": {
    key: "privacy",
    title: "Mes données",
    icon: "padlock",
    points: ["Tout ce que le S.I.D. garde sur toi, à télécharger en un fichier.", "Tu peux aussi demander la suppression de ton compte."],
  },
  "/dashboard/quests": {
    key: "quests",
    title: "Quêtes",
    icon: "scroll",
    points: ["Le rang (E à S) dit la difficulté ; la couleur, le type de contrat.", "Réussir au-dessus de ton niveau rapporte beaucoup de renommée.", "Une quête avec un lieu : va sur place et restes-y une heure."],
    tourFrom: "types",
  },
  "/dashboard/tech": {
    key: "tech",
    title: "Arbre technologique",
    icon: "tree",
    points: ["Un point par simulation réussie.", "Les bonus tombent tout seuls, avec une ligne « Arbre techno » dans ton historique.", "La Promotion te fait monter d'un rang (jusqu'à S)."],
    tourFrom: "techno",
  },
  "/dashboard/map": {
    key: "map",
    title: "Carte",
    icon: "map",
    points: ["Point de départ : à poser une seule fois.", "Ensuite, chaque déplacement est un trajet chronométré, qui continue page fermée.", "Montures, vols et plans des villes : sur la Cartographie."],
    tourFrom: "position",
  },
  "/dashboard/leaderboard": {
    key: "leaderboard",
    title: "Classement",
    icon: "trophy",
    points: ["Puissance globale = moyenne de l'Intelligence, de la Puissance et de la Technique.", "La renommée se gagne (et se perd) dans les quêtes."],
    tourFrom: "classement",
  },
  "/dashboard/org-chart": {
    key: "org-chart",
    title: "Organigramme",
    icon: "orgchart",
    points: ["La hiérarchie du S.I.D. : qui dirige quoi.", "Touche un agent pour ouvrir son dossier."],
  },
  "/dashboard/members": {
    key: "members",
    title: "Trombinoscope",
    icon: "people",
    points: ["Tous les agents, avec leur rang, leur titre équipé et leur style.", "Touche une carte pour ouvrir le dossier."],
  },
  "/dashboard/simulations/donjons": {
    key: "donjons",
    title: "Donjons",
    icon: "swords",
    points: [
      "Chaque île terminée : +1 Puissance.",
      (n) => `Niveau 50 et plus : une mort peut te coûter un membre (${n.injury_minutes} min de repos forcé).`,
      "Gardien trop fort ? « Demander de l'aide » ouvre un raid que les autres peuvent rejoindre.",
    ],
    tourFrom: "simulation",
  },
  "/dashboard/simulations/intelligence": {
    key: "intelligence",
    title: "Intelligence",
    icon: "brain",
    points: ["Trois épreuves : Potions, Énigmes, Problème.", "Ton Intelligence est la moyenne des trois.", (n) => `Au plus ${n.sim_per_day} résultats par jour.`],
    tourFrom: "facteurs",
  },
  "/dashboard/simulations/techniques": {
    key: "techniques",
    title: "Techniques",
    icon: "tools",
    points: ["Chaque réussite : +1 Technique.", (n) => `Au plus ${n.sim_per_day} résultats par jour.`],
    tourFrom: "facteurs",
  },
  "/dashboard/shop": {
    key: "shop",
    title: "Comptoir",
    icon: "cart",
    points: ["Achète, ou mets tes objets en vente.", (n) => `Le vendeur reverse ${pct(n.vat)} de TVA.`, "Solde négatif = achats bloqués jusqu'à ce qu'il remonte."],
    tourFrom: "boutique",
  },
  "/dashboard/bank": {
    key: "bank",
    title: "Banque",
    icon: "bank",
    points: [
      (n) => `Épargne : ${pct(n.bank_rate)} par jour, mais un nouveau dépôt relance le décompte.`,
      (n) => `Emprunt : ${pct(n.debt_rate)} par jour, jusqu'à ${zenis(n.max_debt)}.`,
      "Bourse : des actions des entreprises des agents, cours mis à jour toutes les heures.",
    ],
    tourFrom: "epargne",
  },
  "/dashboard/business": {
    key: "business",
    title: "Entreprise",
    icon: "office",
    points: ["Ta mise de départ crée la trésorerie et fixe le cours de l'action.", "Les actions vendues remplissent ta trésorerie ; quand elles partent vite, l'entreprise en émet de nouvelles.", "Dividendes : partagés au prorata des actions."],
  },
  "/dashboard/admin/applications": { key: "a-applications", title: "Recrutement", icon: "clipboard", points: ["Les candidatures en attente : accepter fait entrer l'agent au S.I.D."] },
  "/dashboard/admin/roles": { key: "a-roles", title: "Rôles & équipes", icon: "rank", points: ["Un rôle regroupe des permissions ; une équipe regroupe des agents.", "Le rang (E à S, Divin) se règle ici aussi."] },
  "/dashboard/admin/economy": { key: "a-economy", title: "Économie", icon: "coins", points: ["Soldes, salaires, renommée et niveaux des agents.", "Chaque correction est inscrite au journal d'audit."] },
  "/dashboard/admin/simulation": { key: "a-simulation", title: "Simulation", icon: "dna", points: ["La population simulée qui achète, investit et fait vivre l'économie."] },
  "/dashboard/admin/stats": { key: "a-stats", title: "Statistiques", icon: "chart", points: ["Visites, membres actifs, activité par jour."] },
  "/dashboard/admin/users": { key: "a-users", title: "Comptes", icon: "shieldUser", points: ["La fiche complète de chaque agent : bannir, muter, geler, réinitialiser un mot de passe."] },
  "/dashboard/admin/alerts": { key: "a-alerts", title: "Alertes", icon: "siren", points: ["Activité inhabituelle détectée automatiquement, et demandes de suppression de compte."] },
  "/dashboard/admin/moderation": { key: "a-moderation", title: "Modération", icon: "scales", points: ["Annonces, maintenance d'une rubrique, sanctions.", "Les décors des fêtes s'allument d'ici aussi."] },
  "/dashboard/admin/titles": { key: "a-titles", title: "Titres & farces", icon: "masks", points: ["Qui porte quoi, les farces en cours, et les boucliers anti-farce."] },
  "/dashboard/admin/sandbox": { key: "a-sandbox", title: "Bac à sable", icon: "bucket", points: ["Un compte temporaire pour tester le site comme un agent ordinaire."] },
  "/dashboard/admin/audit": { key: "a-audit", title: "Journal d'audit", icon: "magnifier", points: ["Qui a fait quoi, et quand : chaque action sensible y est inscrite."] },
};

export function tipForPath(pathname: string): PageTip | null {
  return PAGE_TIPS[pathname] ?? null;
}

export function resolveText(t: Text, n: TutoNumbers, nickname: string): string {
  return typeof t === "function" ? t(n, nickname) : t;
}
