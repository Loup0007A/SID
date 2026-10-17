// ─────────────────────────────────────────────────────────────────────
// Conditions générales d'utilisation et politique de confidentialité du
// S.I.D. — texte COMMUN aux trois sites (Dossier Central, Cartographie,
// Wiki), qui partagent les mêmes comptes et la même base de données.
// Ce fichier est identique dans les trois dépôts : le modifier dans les
// trois, et changer TERMS_VERSION pour redemander l'acceptation à tous.
// ─────────────────────────────────────────────────────────────────────

export const TERMS_VERSION = "2026-10-17";
export const TERMS_DATE = "17 octobre 2026";

export type LegalSite = "quest" | "map" | "wiki";

export const SITE_NAMES: Record<LegalSite, string> = {
  quest: "Dossier Central (sid-quest)",
  map: "Cartographie (sid-map)",
  wiki: "Wiki du S.I.D.",
};

const QUEST_URL = "https://sid-quest.vercel.app";

/** Adresse de contact facultative (variable d'environnement NEXT_PUBLIC_CONTACT_EMAIL). */
function Contact() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <>
      par la messagerie du Dossier Central, en écrivant à un fondateur
      {email ? (
        <>
          , ou par email à <a href={`mailto:${email}`}>{email}</a>
        </>
      ) : null}
    </>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="legal-h2">{children}</h2>;
}

function Intro({ site, doc }: { site: LegalSite; doc: string }) {
  return (
    <p className="legal-meta">
      {doc} — version du {TERMS_DATE}. S&apos;applique aux trois sites du S.I.D. : le Dossier Central, la Cartographie et
      le Wiki (même compte, mêmes règles). Tu lis la version publiée sur le {SITE_NAMES[site]}.
    </p>
  );
}

export function Cgu({ site }: { site: LegalSite }) {
  return (
    <div className="legal">
      <Intro site={site} doc="Conditions générales d'utilisation" />

      <H2>1. Le S.I.D., c&apos;est quoi</H2>
      <p>
        Le S.I.D. est une plateforme communautaire de jeu de rôle, gratuite et sans publicité. Elle regroupe le Dossier
        Central (dossiers des membres, quêtes, messagerie, économie fictive, simulations), la Cartographie (carte du
        monde, déplacements des personnages) et le Wiki (lieux, armes, monstres, objets, compétences). Certaines
        simulations et mini-jeux sont hébergés à part (GitHub Pages) et s&apos;affichent dans le Dossier Central.
      </p>

      <H2>2. Accepter ces conditions</H2>
      <p>
        En créant un compte ou en utilisant un des sites, tu acceptes ces conditions et la politique de
        confidentialité. Si elles changent, on te le signale et on te redemande ton accord ; tant que tu ne l&apos;as pas
        donné, un bandeau te le rappelle.
      </p>

      <H2>3. Ton compte</H2>
      <ul>
        <li>L&apos;inscription est une candidature : l&apos;équipe de recrutement peut l&apos;accepter ou la refuser.</li>
        <li>Un seul compte par personne. Les informations de ton dossier doivent être sincères (ton personnage, lui, est libre).</li>
        <li>
          Ton mot de passe est personnel : ne le partage pas. Si tu penses qu&apos;un autre l&apos;utilise, change-le
          (Mon dossier) et préviens l&apos;administration.
        </li>
        <li>
          Si tu as moins de 15 ans, l&apos;accord d&apos;un de tes parents (ou représentant légal) est nécessaire pour
          t&apos;inscrire.
        </li>
      </ul>

      <H2>4. Règles de conduite</H2>
      <ul>
        <li>Respect de tous : pas de harcèlement, d&apos;insultes, de menaces, de propos haineux ou discriminatoires.</li>
        <li>Pas de contenu illégal, pornographique ou choquant, ni de liens vers ce type de contenu.</li>
        <li>Pas de spam, de publicité, ni d&apos;usurpation de l&apos;identité d&apos;un autre membre.</li>
        <li>Ne publie pas d&apos;informations personnelles sur quelqu&apos;un (vrai nom, adresse, photo…) sans son accord.</li>
        <li>
          Pas de triche : n&apos;exploite pas les bugs (signale-les), n&apos;automatise pas les simulations, ne fais pas
          de comptes multiples pour t&apos;enrichir.
        </li>
      </ul>

      <H2>5. Ce que tu publies</H2>
      <p>
        Tu restes l&apos;auteur de tes textes, images et commentaires. Tu autorises le S.I.D. à les afficher aux autres
        membres sur les trois sites, le temps de leur publication. L&apos;administration peut retirer un contenu
        contraire à ces règles. N&apos;envoie que des images et fichiers que tu as le droit de partager.
      </p>

      <H2>6. Monnaie et objets du jeu</H2>
      <p>
        Les zénis, objets, rangs, caractéristiques et entreprises du S.I.D. sont fictifs : ils n&apos;ont aucune valeur
        réelle, ne s&apos;achètent pas et ne se revendent pas contre de l&apos;argent réel. En cas de bug ou d&apos;abus,
        l&apos;administration peut les corriger.
      </p>
      <p>
        Les titres et leurs pouvoirs de farce sont des effets d&apos;affichage temporaires et inoffensifs : ils durent
        quelques minutes et ne suppriment, ne saisissent ni ne modifient rien pour de vrai. Ils ne doivent pas servir à
        harceler quelqu&apos;un : l&apos;administration peut arrêter une farce, protéger un membre ou couper les farces
        pour tout le monde.
      </p>

      <H2>7. Messagerie et « espionnage » du jeu</H2>
      <p>
        Les messages privés à deux ne sont lus que par leurs deux participants. Un salon de groupe peut être marqué{" "}
        <em>espionnable</em> à sa création : dans ce cas seulement, des membres ayant le rôle d&apos;espion du jeu
        peuvent en obtenir des extraits. Un message privé à deux ne peut jamais l&apos;être.
      </p>

      <H2>8. Modération et sanctions</H2>
      <p>
        En cas de manquement, l&apos;administration peut donner un avertissement, rendre muet, geler un compte, infliger
        une amende de zénis ou bannir. Toutes les actions de l&apos;administration sont inscrites dans un journal
        d&apos;audit qu&apos;elle ne peut ni modifier ni effacer depuis le site. Pour contester une sanction, écris à un
        fondateur.
      </p>

      <H2>9. Administration et sécurité</H2>
      <p>
        Pour protéger la communauté, l&apos;administration (gestion des comptes) dispose d&apos;un journal d&apos;activité
        par membre et d&apos;alertes automatiques en cas d&apos;activité inhabituelle (gros mouvements de zénis, rafales
        de messages, simulations anormalement rapides, actions d&apos;administration en série…). Elle peut aussi créer
        des comptes de test temporaires pour vérifier le site ; ils sont invisibles et effacés à leur expiration. Le
        détail est dans la politique de confidentialité.
      </p>

      <H2>10. Disponibilité</H2>
      <p>
        Le S.I.D. est un projet communautaire fourni tel quel, sans garantie de disponibilité. Il peut évoluer, être
        suspendu ou s&apos;arrêter. Des sections peuvent être mises en maintenance temporairement.
      </p>

      <H2>11. Fermer ton compte</H2>
      <p>
        Tu peux demander la suppression de ton compte à tout moment depuis la page <em>Mes données</em> du Dossier
        Central. L&apos;administration peut fermer un compte qui enfreint gravement ces règles.
      </p>

      <H2>12. Contact et droit applicable</H2>
      <p>
        Pour toute question : <Contact />. Ces conditions sont régies par le droit français.
      </p>
    </div>
  );
}

export function Privacy({ site }: { site: LegalSite }) {
  return (
    <div className="legal">
      <Intro site={site} doc="Politique de confidentialité" />

      <H2>1. En bref</H2>
      <ul>
        <li>On ne garde que ce qui sert au jeu et à la sécurité de la communauté.</li>
        <li>Pas de publicité, pas de revente de données, pas d&apos;outil de pistage ni de mesure d&apos;audience.</li>
        <li>
          Tu peux tout voir et tout télécharger depuis <em>Mes données</em> (Dossier Central), corriger ton dossier, en
          masquer une partie, rendre ton compte invisible, ou demander sa suppression.
        </li>
      </ul>

      <H2>2. Qui est responsable</H2>
      <p>
        L&apos;équipe fondatrice du S.I.D. est responsable de ces données. Pour toute question ou demande : <Contact />.
      </p>

      <H2>3. Les données que nous gardons</H2>
      <ul>
        <li>
          <strong>Compte :</strong> ton adresse email et ton mot de passe (chiffré, géré par notre fournisseur
          d&apos;authentification : personne ne peut le lire).
        </li>
        <li>
          <strong>Dossier :</strong> surnom, prénom et nom, âge, photo, description, armes, équipement, rôle souhaité,
          date d&apos;inscription, rang, rôles, titres. Si tu le renseignes, ton anniversaire (jour et mois seulement,
          jamais montré aux autres). Tu choisis ce que tu montres aux autres (Mon dossier → Confidentialité).
        </li>
        <li>
          <strong>Jeu :</strong> quêtes, zénis et mouvements, achats, banque, entreprises et actions, caractéristiques,
          simulations jouées (résultat, durée, progression), arbre technologique, raids, classement, titres obtenus,
          farces lancées ou subies.
        </li>
        <li>
          <strong>Messagerie :</strong> tes salons et les messages que tu envoies, la date de dernière lecture de chaque
          salon.
        </li>
        <li>
          <strong>Carte :</strong> la position de ton personnage, ses trajets, montures louées, achats et ventes au marché
          noir, commentaires sur les lieux.
        </li>
        <li>
          <strong>Wiki :</strong> tes commentaires, favoris, notes personnelles et signalements. La liste des fiches
          récemment consultées reste dans ton navigateur et n&apos;est pas envoyée.
        </li>
        <li>
          <strong>Activité :</strong> date de ta dernière visite et nombre de visites par jour (pas d&apos;historique des
          pages vues), notifications reçues, et, si tu les actives, l&apos;abonnement aux notifications push de ton
          appareil. Pour le tableau « En ligne maintenant » : la page du Dossier Central où tu te trouves en ce moment
          (sans identifiant), si tu es absent, et depuis quand tu es en ligne — une seule ligne, remplacée à chaque
          page, jamais d&apos;historique.
        </li>
        <li>
          <strong>Administration :</strong> sanctions, actions de l&apos;administration te concernant (journal
          d&apos;audit), alertes d&apos;activité inhabituelle, demandes liées à tes données.
        </li>
      </ul>
      <p>
        Le site n&apos;enregistre pas ton adresse IP. Nos hébergeurs, eux, gardent des journaux techniques (adresse IP,
        navigateur) pendant une courte durée pour faire fonctionner et sécuriser le service.
      </p>

      <H2>4. Pourquoi, et sur quelle base</H2>
      <ul>
        <li>Faire fonctionner le jeu et ton compte (exécution des conditions d&apos;utilisation).</li>
        <li>
          Protéger la communauté : modération, journal d&apos;audit, journal d&apos;activité par membre et alertes
          automatiques (intérêt légitime de la communauté à prévenir la triche, les abus et le piratage de comptes).
        </li>
        <li>Notifications push et informations facultatives du dossier (ton consentement, que tu peux retirer).</li>
      </ul>

      <H2>5. Qui peut voir quoi</H2>
      <ul>
        <li>
          <strong>Les autres membres</strong> voient ton dossier public (sans les champs que tu as masqués), ton rang, ta
          place au classement, ta position sur la carte si tu la partages, et ce que tu publies. En mode{" "}
          <em>compte invisible</em>, tu n&apos;apparais plus dans les listes, le classement, la carte ni
          l&apos;organigramme. Ils voient aussi si tu es en ligne et ce que tu fais (« À la banque », « En plein
          donjon »…), sauf si tu masques ton activité ou ta présence (Mon dossier → Présence en ligne).
        </li>
        <li>
          <strong>La gestion des comptes</strong> (administration) voit tout ton dossier, y compris les champs masqués, et
          un journal de ton activité : mouvements de zénis, achats, quêtes, simulations, visites, sanctions, et le{" "}
          <em>nombre</em> de messages envoyés par jour — jamais leur contenu. Elle reçoit les alertes d&apos;activité
          inhabituelle.
        </li>
        <li>
          <strong>Les messages privés</strong> ne sont visibles dans le site que par leurs participants. Exception du
          jeu : les extraits de salons de groupe marqués « espionnable » (voir les conditions d&apos;utilisation).
        </li>
        <li>
          Les personnes qui administrent techniquement la base de données peuvent y accéder pour la maintenance ; elles
          s&apos;engagent à ne pas consulter les contenus privés sans nécessité.
        </li>
      </ul>

      <H2>6. Où sont les données (sous-traitants)</H2>
      <ul>
        <li>
          <strong>Supabase</strong> : base de données, comptes et photos de profil.
        </li>
        <li>
          <strong>Vercel</strong> : hébergement des sites.
        </li>
        <li>
          <strong>GitHub Pages</strong> : simulations et mini-jeux affichés dans le Dossier Central (leurs sauvegardes
          restent dans ton navigateur et sont synchronisées avec ton compte).
        </li>
        <li>
          <strong>Services push</strong> de ton navigateur (Google, Apple, Mozilla…), seulement si tu actives les
          notifications push.
        </li>
      </ul>
      <p>
        Certains de ces prestataires sont situés hors de l&apos;Union européenne ; les transferts sont encadrés par leurs
        garanties contractuelles (clauses types de la Commission européenne ou cadre de protection des données UE–États-Unis).
        Les polices de caractères sont servies par nos propres sites (aucun appel à Google Fonts).
      </p>

      <H2>7. Combien de temps</H2>
      <ul>
        <li>Ton compte et ce qui s&apos;y rattache : tant que ton compte existe.</li>
        <li>Après une demande de suppression : effacement sous 30 jours au plus.</li>
        <li>Visites par jour : 13 mois. Notifications lues : 6 mois. Alertes traitées : 12 mois.</li>
        <li>Présence en ligne (page en cours) : effacée un jour après ta dernière visite.</li>
        <li>Journal d&apos;audit de l&apos;administration : 3 ans (pour pouvoir traiter une contestation).</li>
        <li>Comptes de test de l&apos;administration : effacés à leur expiration.</li>
      </ul>

      <H2>8. Tes droits</H2>
      <p>
        Tu peux accéder à tes données et les télécharger (<em>Mes données</em> → export), les corriger (<em>Mon dossier</em>),
        t&apos;opposer à leur affichage (champs masqués, compte invisible), retirer ton consentement aux notifications
        push, et demander l&apos;effacement de ton compte (<em>Mes données</em>). Pour toute autre demande : <Contact />.
        Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL (cnil.fr).
      </p>

      <H2>9. Cookies et stockage dans le navigateur</H2>
      <p>
        Le S.I.D. n&apos;utilise que des cookies nécessaires : ceux de ta session de connexion. Il range aussi dans ton
        navigateur quelques préférences (apparence, dernières fiches vues du wiki, sauvegardes des simulations).
        Aucun cookie publicitaire ni de mesure d&apos;audience : aucun bandeau de consentement n&apos;est donc nécessaire.
      </p>

      <H2>10. Sécurité</H2>
      <p>
        Connexions chiffrées (HTTPS), mots de passe chiffrés, accès aux données contrôlé ligne par ligne dans la base,
        journal d&apos;audit des actions d&apos;administration et alertes en cas d&apos;activité inhabituelle.
      </p>

      <H2>11. Mineurs</H2>
      <p>
        Si tu as moins de 15 ans, l&apos;accord d&apos;un parent est nécessaire pour t&apos;inscrire. Un parent peut
        exercer tes droits pour toi en nous contactant.
      </p>

      <H2>12. Modifications</H2>
      <p>
        Si cette politique change, la date en haut de page est mise à jour et ton accord est redemandé. Les versions
        sont publiées sur les trois sites ; la référence est celle du{" "}
        <a href={`${QUEST_URL}/confidentialite`}>Dossier Central</a>.
      </p>
    </div>
  );
}
