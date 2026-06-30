import type { Metadata } from 'next';

/**
 * Cluster de landing pages SEO (AMO local/régional/national + pages métier).
 * Chaque entrée porte un contenu UNIQUE (contexte, FAQ) pour éviter les
 * « doorway pages » dupliquées pénalisées par Google. Un seul template
 * (components/LandingPage.tsx) consomme ces données.
 *
 * Pages volontairement hors menu : découvrables via sitemap + maillage interne.
 */

export const SITE = 'https://www.tenderwise.fr';

export interface LandingFaq { q: string; a: string }
export interface LandingSection { h2: string; body: string } // body = HTML de confiance (auteur interne)
export interface LandingArea { type: 'City' | 'AdministrativeArea' | 'Country'; name: string }
export interface LandingLink { href: string; label: string }

export interface LandingContent {
  slug: string;
  kind: 'geo' | 'service';
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  breadcrumbLabel: string;
  eyebrow: string;
  h1: string;
  heroIntro: string;        // HTML
  ctaLabel: string;
  sections: LandingSection[];
  serviceType: string;
  serviceName: string;
  areaServed: LandingArea[];
  faqs: LandingFaq[];
  related: LandingLink[];
}

// ── FAQ communes (variantes de formulation par page pour limiter le duplicate) ──
const FAQ_AMO_MOE: LandingFaq = {
  q: 'Quelle différence entre un AMO et un maître d\'œuvre ?',
  a: 'L\'AMO (assistance à maîtrise d\'ouvrage) représente et conseille le maître d\'ouvrage — vous, le propriétaire : il définit vos besoins, défend vos intérêts, pilote et contrôle l\'opération. Le maître d\'œuvre (architecte, bureau d\'études) conçoit et réalise techniquement les travaux. L\'AMO ne construit pas : il garantit que ce qui est construit correspond à vos objectifs de coût, qualité et délai.',
};

const FAQ_INDEPENDANCE: LandingFaq = {
  q: 'Qu\'apporte un AMO réellement indépendant ?',
  a: 'TenderWise n\'a aucun lien capitalistique avec des entreprises de travaux, fournisseurs ou bureaux d\'études. Nos recommandations ne servent qu\'un objectif : la réussite de votre opération. Cette indépendance garantit des choix objectifs, des budgets sincères et une négociation menée dans votre seul intérêt.',
};

export const landings: LandingContent[] = [
  // ════════════════════════════════ HUB NATIONAL ════════════════════════════
  {
    slug: 'amo-france',
    kind: 'geo',
    metaTitle: 'AMO en France — Pilotage de projets immobiliers partout',
    metaDescription: 'Vous cherchez un AMO pour piloter votre projet immobilier partout en France ? TenderWise, expert indépendant, conduit vos opérations multi-sites de la faisabilité à la livraison.',
    keywords: 'AMO France, assistance maîtrise ouvrage national, pilotage projet immobilier France, AMO multi-sites, conduite opération national',
    breadcrumbLabel: 'AMO en France',
    eyebrow: 'Couverture nationale',
    h1: 'AMO en France : un pilote unique pour vos projets immobiliers',
    heroIntro: 'Investisseurs, foncières, enseignes multi-sites : vous cherchez <strong>un interlocuteur unique capable de piloter vos opérations partout en France</strong> ? TenderWise centralise la conduite de vos projets — construction, réhabilitation, exploitation — avec la même exigence sur chaque site, où qu\'il se trouve.',
    ctaLabel: 'Confier mon projet national',
    sections: [
      { h2: 'Un AMO national pour des opérations multi-sites', body: '<p>Gérer un parc réparti sur plusieurs régions multiplie les interlocuteurs, les standards et les risques de dérive. En tant qu\'AMO national, nous devenons votre <strong>point de contact unique</strong> : un reporting consolidé, des process homogènes et un pilotage centralisé de tous vos sites, du Nord à la Méditerranée.</p>' },
      { h2: 'Comment se pilote un projet à distance', body: '<p>La conduite d\'opération moderne combine déplacements ciblés sur les jalons critiques (lancement, points d\'arrêt, réception) et pilotage à distance outillé : visites documentées, suivi budgétaire en temps réel, comptes-rendus structurés. Vous gardez une visibilité totale sans avoir à être sur place.</p>' },
      { h2: 'Notre ancrage, votre portée', body: '<p>Basés à Lyon, nous opérons sur l\'ensemble du territoire, avec une forte présence en Auvergne-Rhône-Alpes et en Île-de-France. Découvrez nos implantations locales : <a href="/amo-lyon">Lyon</a>, <a href="/amo-paris">Paris</a>, <a href="/amo-auvergne-rhone-alpes">toute la région AURA</a>.</p>' },
    ],
    serviceType: 'Assistance à Maîtrise d\'Ouvrage (AMO)',
    serviceName: 'AMO national — TenderWise',
    areaServed: [{ type: 'Country', name: 'France' }],
    faqs: [
      FAQ_AMO_MOE,
      { q: 'Un AMO peut-il piloter des projets dans plusieurs régions à la fois ?', a: 'Oui, c\'est précisément l\'intérêt d\'un AMO national : un pilotage centralisé pour des sites dispersés, avec des méthodes et un reporting unifiés. Vous évitez la multiplication des prestataires locaux et les écarts de qualité d\'un site à l\'autre.' },
      { q: 'Comment garantissez-vous le suivi sur des sites éloignés ?', a: 'Par une combinaison de déplacements sur les jalons décisifs et d\'un pilotage à distance rigoureux : comptes-rendus de visite documentés, suivi budgétaire et planning partagés, et une remontée d\'alerte immédiate en cas de dérive. La distance ne réduit pas le niveau de contrôle.' },
      FAQ_INDEPENDANCE,
    ],
    related: [
      { href: '/amo-auvergne-rhone-alpes', label: 'AMO en Auvergne-Rhône-Alpes' },
      { href: '/amo-lyon', label: 'AMO à Lyon' },
      { href: '/amo-paris', label: 'AMO à Paris' },
      { href: '/facility-management', label: 'Facility Management' },
    ],
  },

  // ════════════════════════════════ RÉGION AURA ═════════════════════════════
  {
    slug: 'amo-auvergne-rhone-alpes',
    kind: 'geo',
    metaTitle: 'AMO en Auvergne-Rhône-Alpes — Expert immobilier régional',
    metaDescription: 'AMO indépendant en Auvergne-Rhône-Alpes : Lyon, Grenoble, Saint-Étienne, Clermont-Ferrand, Annecy. TenderWise pilote vos projets de construction et réhabilitation dans toute la région.',
    keywords: 'AMO Auvergne-Rhône-Alpes, AMO AURA, assistance maîtrise ouvrage région lyonnaise, conduite opération Rhône-Alpes',
    breadcrumbLabel: 'AMO en Auvergne-Rhône-Alpes',
    eyebrow: 'Couverture régionale',
    h1: 'AMO en Auvergne-Rhône-Alpes',
    heroIntro: 'Deuxième région économique de France, l\'Auvergne-Rhône-Alpes conjugue métropoles dynamiques, tissu industriel dense et patrimoine à requalifier. TenderWise y pilote vos opérations immobilières avec une <strong>connaissance fine des acteurs et des marchés locaux</strong>.',
    ctaLabel: 'Discuter de mon projet régional',
    sections: [
      { h2: 'Une région, des marchés très différents', body: '<p>Le tertiaire lyonnais, l\'industrie et la recherche grenobloises, la reconversion stéphanoise, l\'attractivité d\'Annecy ou le pôle auvergnat : chaque territoire a ses logiques. Nous adaptons notre pilotage à la réalité de chaque bassin plutôt que d\'appliquer une recette unique.</p>' },
      { h2: 'Nos implantations en AURA', body: '<p>Retrouvez nos pages dédiées : <a href="/amo-lyon">Lyon</a>, <a href="/amo-grenoble">Grenoble</a>, <a href="/amo-saint-etienne">Saint-Étienne</a>, <a href="/amo-clermont-ferrand">Clermont-Ferrand</a> et <a href="/amo-annecy">Annecy</a>. Pour les projets hors région, voir notre <a href="/amo-france">offre nationale</a>.</p>' },
    ],
    serviceType: 'Assistance à Maîtrise d\'Ouvrage (AMO)',
    serviceName: 'AMO en Auvergne-Rhône-Alpes — TenderWise',
    areaServed: [
      { type: 'AdministrativeArea', name: 'Auvergne-Rhône-Alpes' },
      { type: 'City', name: 'Lyon' }, { type: 'City', name: 'Grenoble' }, { type: 'City', name: 'Saint-Étienne' },
      { type: 'City', name: 'Clermont-Ferrand' }, { type: 'City', name: 'Annecy' },
    ],
    faqs: [
      { q: 'Sur quels départements intervenez-vous en AURA ?', a: 'Nous intervenons sur l\'ensemble des douze départements de la région : Rhône, Isère, Loire, Ain, Drôme, Ardèche, Savoie, Haute-Savoie, Puy-de-Dôme, Cantal, Allier et Haute-Loire, avec une présence renforcée autour de Lyon et de l\'axe métropolitain.' },
      FAQ_AMO_MOE,
      FAQ_INDEPENDANCE,
    ],
    related: [
      { href: '/amo-france', label: 'AMO partout en France' },
      { href: '/amo-lyon', label: 'AMO à Lyon' },
      { href: '/amo-grenoble', label: 'AMO à Grenoble' },
      { href: '/amo-rehabilitation', label: 'AMO réhabilitation' },
    ],
  },

  // ════════════════════════════════ LYON ════════════════════════════════════
  {
    slug: 'amo-lyon',
    kind: 'geo',
    metaTitle: 'AMO à Lyon — Assistance à Maîtrise d\'Ouvrage',
    metaDescription: 'AMO indépendant à Lyon : faisabilité, conduite d\'opération, réhabilitation et conformité Décret Tertiaire. TenderWise défend vos intérêts de maître d\'ouvrage de A à Z.',
    keywords: 'AMO Lyon, assistance maîtrise ouvrage Lyon, AMO immobilier, conduite opération Lyon, AMO réhabilitation, décret tertiaire, Villeurbanne, Rhône',
    breadcrumbLabel: 'AMO à Lyon',
    eyebrow: 'Expert indépendant',
    h1: 'Assistance à Maîtrise d\'Ouvrage (AMO) à Lyon',
    heroIntro: 'Investisseurs et propriétaires immobiliers : TenderWise pilote vos projets de construction, de réhabilitation et d\'exploitation en défendant <strong>vos seuls intérêts</strong>, sur Lyon, Villeurbanne et toute la Métropole.',
    ctaLabel: 'Parler de mon projet',
    sections: [
      { h2: 'Qu\'est-ce qu\'un AMO et à quoi sert-il ?', body: '<p>L\'assistance à maîtrise d\'ouvrage est une mission de conseil et de pilotage menée <strong>pour le compte du maître d\'ouvrage</strong> — vous. L\'AMO traduit vos objectifs en programme, sélectionne et coordonne les intervenants, contrôle coûts, qualité et délais, et vous remet une opération conforme à ce qui était prévu. Contrairement au maître d\'œuvre, il ne construit pas : il est votre <strong>bras droit technique</strong>. Voir notre <a href="/expertise">expertise complète</a>.</p>' },
      { h2: 'Un marché lyonnais exigeant', body: '<p>Entre la densification de la Part-Dieu, la mutation de la Confluence et la requalification du parc tertiaire ancien, Lyon impose des opérations techniques où la maîtrise du coût et du calendrier est décisive. Nous connaissons les acteurs locaux et les contraintes de la Métropole.</p>' },
      { h2: 'Zone d\'intervention', body: '<p>Basés à Villeurbanne, nous intervenons sur Lyon, Villeurbanne, la Métropole de Lyon et l\'ensemble du Rhône, et plus largement en <a href="/amo-auvergne-rhone-alpes">Auvergne-Rhône-Alpes</a>.</p>' },
    ],
    serviceType: 'Assistance à Maîtrise d\'Ouvrage (AMO)',
    serviceName: 'AMO à Lyon — TenderWise',
    areaServed: [
      { type: 'City', name: 'Lyon' }, { type: 'City', name: 'Villeurbanne' },
      { type: 'AdministrativeArea', name: 'Métropole de Lyon' }, { type: 'AdministrativeArea', name: 'Rhône' },
    ],
    faqs: [
      FAQ_AMO_MOE,
      { q: 'À quel moment faut-il faire appel à un AMO ?', a: 'Le plus tôt possible, idéalement dès la faisabilité, avant tout engagement financier : c\'est là que l\'AMO sécurise le plus de valeur (validation du potentiel, programmation, budget réaliste). Il peut aussi reprendre une opération en cours ou intervenir en phase d\'exploitation.' },
      { q: 'L\'AMO est-il obligatoire ?', a: 'Non, recourir à un AMO n\'est pas une obligation légale pour un maître d\'ouvrage privé : c\'est une démarche volontaire de sécurisation. En revanche certaines missions connexes (coordination sécurité, contrôle technique) peuvent être réglementairement obligatoires selon le projet ; l\'AMO vous aide à les identifier et les coordonner.' },
      { q: 'Suis-je concerné par le Décret Tertiaire ?', a: 'Le dispositif Éco Énergie Tertiaire s\'applique aux bâtiments tertiaires d\'au moins 1 000 m². Il impose une réduction progressive des consommations à horizon 2030, 2040 et 2050, avec déclaration annuelle sur la plateforme OPERAT de l\'ADEME. Un audit énergétique permet de bâtir un plan d\'actions conforme.' },
    ],
    related: [
      { href: '/amo-auvergne-rhone-alpes', label: 'AMO en Auvergne-Rhône-Alpes' },
      { href: '/realisations', label: 'Nos réalisations' },
      { href: '/amo-rehabilitation', label: 'AMO réhabilitation' },
      { href: '/facility-management', label: 'Facility Management' },
    ],
  },

  // ════════════════════════════════ PARIS ═══════════════════════════════════
  {
    slug: 'amo-paris',
    kind: 'geo',
    metaTitle: 'AMO à Paris & Île-de-France — Maîtrise d\'Ouvrage',
    metaDescription: 'AMO indépendant à Paris et en Île-de-France : tertiaire, réhabilitation lourde, restructuration. TenderWise pilote vos opérations immobilières franciliennes avec exigence.',
    keywords: 'AMO Paris, assistance maîtrise ouvrage Paris, AMO Île-de-France, conduite opération Paris, réhabilitation tertiaire Paris',
    breadcrumbLabel: 'AMO à Paris',
    eyebrow: 'Présence francilienne',
    h1: 'AMO à Paris et en Île-de-France',
    heroIntro: 'Le marché parisien est le plus tendu de France : foncier rare, réhabilitations lourdes en site occupé, exigences patrimoniales et réglementaires fortes. TenderWise y apporte un <strong>pilotage rigoureux et indépendant</strong> pour sécuriser vos opérations franciliennes.',
    ctaLabel: 'Piloter mon projet francilien',
    sections: [
      { h2: 'Des opérations parmi les plus complexes', body: '<p>À Paris, la transformation de bureaux, la restructuration d\'immeubles haussmanniens ou la mise aux normes d\'actifs tertiaires se font rarement sur table rase. Contraintes ABF, mitoyenneté, logistique de chantier en milieu dense : chaque opération exige une anticipation que seul un pilotage expérimenté garantit.</p>' },
      { h2: 'Valoriser plutôt que subir', body: '<p>Obsolescence du parc tertiaire, Décret Tertiaire, attentes ESG des investisseurs : la pression sur la valeur des actifs franciliens est forte. Nous transformons ces contraintes en plan d\'actions concret de valorisation et de mise en conformité.</p>' },
      { h2: 'Un pilotage depuis Lyon, une présence à Paris', body: '<p>Notre organisation associe déplacements réguliers et pilotage outillé pour assurer une présence efficace sur vos chantiers parisiens. Pour les groupes multi-régions, voir notre <a href="/amo-france">offre nationale</a>.</p>' },
    ],
    serviceType: 'Assistance à Maîtrise d\'Ouvrage (AMO)',
    serviceName: 'AMO à Paris — TenderWise',
    areaServed: [
      { type: 'City', name: 'Paris' }, { type: 'AdministrativeArea', name: 'Île-de-France' },
    ],
    faqs: [
      { q: 'Intervenez-vous sur des réhabilitations de bureaux en site occupé à Paris ?', a: 'Oui. La réhabilitation en site occupé est l\'un des cas les plus exigeants : phasage des travaux, maintien d\'activité, sécurité des occupants. Notre rôle d\'AMO est précisément d\'anticiper ces contraintes pour éviter les surcoûts et les interruptions.' },
      { q: 'Un AMO basé à Lyon peut-il vraiment suivre un chantier parisien ?', a: 'Oui : la conduite d\'opération combine présence sur les jalons critiques et pilotage à distance rigoureux. L\'essentiel n\'est pas d\'être présent en permanence, mais d\'être présent aux bons moments et de tenir un contrôle continu du budget, du planning et de la qualité.' },
      FAQ_INDEPENDANCE,
    ],
    related: [
      { href: '/amo-france', label: 'AMO partout en France' },
      { href: '/amo-rehabilitation', label: 'AMO réhabilitation' },
      { href: '/conduite-operation', label: 'Conduite d\'opération' },
      { href: '/amo-lyon', label: 'AMO à Lyon' },
    ],
  },

  // ════════════════════════════════ GRENOBLE ════════════════════════════════
  {
    slug: 'amo-grenoble',
    kind: 'geo',
    metaTitle: 'AMO à Grenoble — Assistance à Maîtrise d\'Ouvrage',
    metaDescription: 'AMO indépendant à Grenoble : tertiaire, recherche, industrie et rénovation énergétique. TenderWise pilote vos projets immobiliers dans la cuvette grenobloise.',
    keywords: 'AMO Grenoble, assistance maîtrise ouvrage Grenoble, conduite opération Isère, rénovation énergétique Grenoble',
    breadcrumbLabel: 'AMO à Grenoble',
    eyebrow: 'Isère',
    h1: 'AMO à Grenoble',
    heroIntro: 'Pôle européen de la recherche et de la microélectronique, Grenoble concentre des bâtiments techniques exigeants et un parc à rénover. TenderWise y pilote vos opérations avec la <strong>rigueur qu\'imposent ces actifs spécifiques</strong>.',
    ctaLabel: 'Échanger sur mon projet grenoblois',
    sections: [
      { h2: 'Des bâtiments techniques exigeants', body: '<p>Laboratoires, locaux d\'activité, sièges tertiaires high-tech : le tissu grenoblois compte de nombreux bâtiments à forte technicité où les lots fluides, sûreté et énergie sont déterminants. Notre pilotage AMO sécurise ces opérations où l\'aléa technique coûte cher.</p>' },
      { h2: 'Rénovation énergétique, un enjeu local fort', body: '<p>Climat de cuvette, parc des années 1960-1980, objectifs bas-carbone du territoire : la rénovation énergétique est centrale à Grenoble. Nous intégrons l\'audit énergétique et la trajectoire <a href="/amo-rehabilitation">de réhabilitation</a> dès la programmation.</p>' },
    ],
    serviceType: 'Assistance à Maîtrise d\'Ouvrage (AMO)',
    serviceName: 'AMO à Grenoble — TenderWise',
    areaServed: [{ type: 'City', name: 'Grenoble' }, { type: 'AdministrativeArea', name: 'Isère' }],
    faqs: [
      FAQ_AMO_MOE,
      { q: 'Accompagnez-vous la rénovation énergétique d\'un bâtiment à Grenoble ?', a: 'Oui : audit énergétique, scénarios de travaux, chiffrage et pilotage de l\'opération. Si le bâtiment fait plus de 1 000 m² de tertiaire, nous intégrons aussi la trajectoire du Décret Tertiaire et la déclaration OPERAT.' },
      FAQ_INDEPENDANCE,
    ],
    related: [
      { href: '/amo-auvergne-rhone-alpes', label: 'AMO en Auvergne-Rhône-Alpes' },
      { href: '/amo-lyon', label: 'AMO à Lyon' },
      { href: '/amo-rehabilitation', label: 'AMO réhabilitation' },
    ],
  },

  // ════════════════════════════════ SAINT-ÉTIENNE ═══════════════════════════
  {
    slug: 'amo-saint-etienne',
    kind: 'geo',
    metaTitle: 'AMO à Saint-Étienne — Maîtrise d\'Ouvrage & Réhabilitation',
    metaDescription: 'AMO indépendant à Saint-Étienne : reconversion de patrimoine industriel, réhabilitation et valorisation d\'actifs. TenderWise pilote la transformation de vos bâtiments.',
    keywords: 'AMO Saint-Étienne, assistance maîtrise ouvrage Saint-Étienne, réhabilitation industrielle Loire, reconversion friche',
    breadcrumbLabel: 'AMO à Saint-Étienne',
    eyebrow: 'Loire',
    h1: 'AMO à Saint-Étienne',
    heroIntro: 'Ville de reconversion par excellence, Saint-Étienne offre un patrimoine industriel à réinventer et des opportunités de valorisation que peu de marchés présentent. TenderWise pilote ces <strong>transformations à fort potentiel</strong>.',
    ctaLabel: 'Parler de mon projet stéphanois',
    sections: [
      { h2: 'Reconvertir le patrimoine industriel', body: '<p>Anciennes manufactures, locaux d\'activité, immeubles à requalifier : la reconversion stéphanoise cumule diagnostics de l\'existant, dépollution éventuelle et changement d\'usage. Autant d\'aléas qu\'un AMO anticipe pour sécuriser le budget et le calendrier.</p>' },
      { h2: 'Un effet de levier sur la valeur', body: '<p>Avec un foncier accessible, la marge de création de valeur par la réhabilitation est réelle à Saint-Étienne — à condition de maîtriser les coûts cachés. C\'est tout l\'enjeu d\'une <a href="/amo-rehabilitation">mission AMO en réhabilitation</a> menée dès l\'amont.</p>' },
    ],
    serviceType: 'Assistance à Maîtrise d\'Ouvrage (AMO)',
    serviceName: 'AMO à Saint-Étienne — TenderWise',
    areaServed: [{ type: 'City', name: 'Saint-Étienne' }, { type: 'AdministrativeArea', name: 'Loire' }],
    faqs: [
      { q: 'Pouvez-vous piloter la reconversion d\'une friche ou d\'un bâtiment industriel ?', a: 'Oui : c\'est un cas typique de mission AMO. Nous cadrons les diagnostics (structure, amiante/plomb, pollution des sols), le changement d\'usage et l\'estimation des travaux avant tout engagement, pour éviter les mauvaises surprises en cours de chantier.' },
      FAQ_AMO_MOE,
      FAQ_INDEPENDANCE,
    ],
    related: [
      { href: '/amo-auvergne-rhone-alpes', label: 'AMO en Auvergne-Rhône-Alpes' },
      { href: '/amo-rehabilitation', label: 'AMO réhabilitation' },
      { href: '/amo-lyon', label: 'AMO à Lyon' },
    ],
  },

  // ════════════════════════════════ CLERMONT-FERRAND ════════════════════════
  {
    slug: 'amo-clermont-ferrand',
    kind: 'geo',
    metaTitle: 'AMO à Clermont-Ferrand — Assistance Maîtrise d\'Ouvrage',
    metaDescription: 'AMO indépendant à Clermont-Ferrand et en Auvergne : tertiaire, industrie et valorisation de patrimoine. TenderWise pilote vos projets immobiliers du Puy-de-Dôme.',
    keywords: 'AMO Clermont-Ferrand, assistance maîtrise ouvrage Auvergne, conduite opération Puy-de-Dôme',
    breadcrumbLabel: 'AMO à Clermont-Ferrand',
    eyebrow: 'Puy-de-Dôme',
    h1: 'AMO à Clermont-Ferrand',
    heroIntro: 'Capitale auvergnate au tissu industriel et tertiaire solide, Clermont-Ferrand voit son parc immobilier se moderniser. TenderWise y étend sa couverture régionale avec un <strong>pilotage AMO indépendant et exigeant</strong>.',
    ctaLabel: 'Discuter de mon projet auvergnat',
    sections: [
      { h2: 'Étendre la couverture à l\'ouest de la région', body: '<p>Clermont-Ferrand ancre notre présence sur l\'Auvergne et complète notre maillage <a href="/amo-auvergne-rhone-alpes">Auvergne-Rhône-Alpes</a>. Tertiaire, sites industriels, équipements : nous adaptons notre pilotage à la réalité du marché local.</p>' },
      { h2: 'Moderniser et valoriser le parc existant', body: '<p>Modernisation de sièges, mise en conformité énergétique, restructuration : nous sécurisons ces opérations de la faisabilité à la réception, en gardant le cap sur le coût et le délai.</p>' },
    ],
    serviceType: 'Assistance à Maîtrise d\'Ouvrage (AMO)',
    serviceName: 'AMO à Clermont-Ferrand — TenderWise',
    areaServed: [{ type: 'City', name: 'Clermont-Ferrand' }, { type: 'AdministrativeArea', name: 'Puy-de-Dôme' }],
    faqs: [
      FAQ_AMO_MOE,
      { q: 'Intervenez-vous sur toute l\'Auvergne depuis Clermont-Ferrand ?', a: 'Oui, Clermont-Ferrand sert de point d\'appui pour le Puy-de-Dôme, l\'Allier, le Cantal et la Haute-Loire, dans le cadre de notre couverture de toute la région Auvergne-Rhône-Alpes.' },
      FAQ_INDEPENDANCE,
    ],
    related: [
      { href: '/amo-auvergne-rhone-alpes', label: 'AMO en Auvergne-Rhône-Alpes' },
      { href: '/amo-france', label: 'AMO partout en France' },
      { href: '/conduite-operation', label: 'Conduite d\'opération' },
    ],
  },

  // ════════════════════════════════ ANNECY ══════════════════════════════════
  {
    slug: 'amo-annecy',
    kind: 'geo',
    metaTitle: 'AMO à Annecy — Maîtrise d\'Ouvrage Haute-Savoie',
    metaDescription: 'AMO indépendant à Annecy et en Haute-Savoie : tertiaire premium, hôtellerie et résidentiel haut de gamme. TenderWise pilote vos projets sur un marché exigeant.',
    keywords: 'AMO Annecy, assistance maîtrise ouvrage Haute-Savoie, conduite opération Annecy, hôtellerie tertiaire premium',
    breadcrumbLabel: 'AMO à Annecy',
    eyebrow: 'Haute-Savoie',
    h1: 'AMO à Annecy',
    heroIntro: 'Marché immobilier parmi les plus chers de France hors Paris, Annecy exige un niveau de finition et une maîtrise des coûts irréprochables. TenderWise y pilote vos opérations avec l\'<strong>exigence qu\'attend un marché premium</strong>.',
    ctaLabel: 'Parler de mon projet annécien',
    sections: [
      { h2: 'Un marché premium, peu d\'erreurs permises', body: '<p>Tertiaire haut de gamme, hôtellerie, résidentiel de standing : à Annecy, la valeur des actifs et les attentes de qualité laissent peu de place à l\'approximation. Notre pilotage AMO sécurise la qualité d\'exécution autant que le budget.</p>' },
      { h2: 'Concilier exigence environnementale et performance', body: '<p>Cadre lacustre préservé, contraintes paysagères, attentes ESG : les projets annéciens conjuguent performance et insertion environnementale. Nous intégrons ces exigences dès la programmation.</p>' },
    ],
    serviceType: 'Assistance à Maîtrise d\'Ouvrage (AMO)',
    serviceName: 'AMO à Annecy — TenderWise',
    areaServed: [{ type: 'City', name: 'Annecy' }, { type: 'AdministrativeArea', name: 'Haute-Savoie' }],
    faqs: [
      FAQ_AMO_MOE,
      { q: 'Accompagnez-vous des projets hôteliers ou tertiaires haut de gamme ?', a: 'Oui : ces projets se distinguent par un niveau de finition élevé et des lots techniques exigeants (CVC, domotique, acoustique). L\'AMO y veille à ce que la qualité visée soit tenue sans dérive de coût ni de délai.' },
      FAQ_INDEPENDANCE,
    ],
    related: [
      { href: '/amo-auvergne-rhone-alpes', label: 'AMO en Auvergne-Rhône-Alpes' },
      { href: '/amo-lyon', label: 'AMO à Lyon' },
      { href: '/facility-management', label: 'Facility Management' },
    ],
  },

  // ════════════════════════════ SERVICE : FACILITY MANAGEMENT ═══════════════
  {
    slug: 'facility-management',
    kind: 'service',
    metaTitle: 'Facility Management — Pilotage d\'exploitation indépendant',
    metaDescription: 'Pilotage de Facility Management indépendant : contrats multitechniques, maintenance réglementaire, réduction des charges. TenderWise optimise l\'exploitation de vos bâtiments.',
    keywords: 'facility management, FM, pilotage contrats maintenance, maintenance multitechnique, exploitation bâtiment, réduction charges',
    breadcrumbLabel: 'Facility Management',
    eyebrow: 'Exploitation & maintenance',
    h1: 'Facility Management : piloter l\'exploitation de vos bâtiments',
    heroIntro: 'Une fois le bâtiment livré, l\'essentiel du coût se joue sur sa durée de vie. TenderWise pilote votre Facility Management en <strong>défenseur de vos intérêts face aux prestataires</strong> : contrats maîtrisés, conformité assurée, charges optimisées.',
    ctaLabel: 'Optimiser mon exploitation',
    sections: [
      { h2: 'Reprendre la main sur vos contrats', body: '<p>Contrats de maintenance reconduits sans contrôle, prestations payées mais non rendues, périmètres flous : la dérive des coûts d\'exploitation est fréquente. Nous auditons vos contrats multitechniques et rétablissons un pilotage rigoureux, indicateurs à l\'appui.</p>' },
      { h2: 'Garantir la conformité réglementaire', body: '<p>Contrôles périodiques obligatoires, registres de sécurité, maintenance réglementaire des installations : un défaut de conformité expose votre responsabilité. Nous assurons le suivi des obligations et la traçabilité des interventions.</p>' },
      { h2: 'Réduire les charges sans dégrader le service', body: '<p>Renégociation des contrats, rationalisation des interventions, plan pluriannuel de maintenance : nous réduisons vos charges d\'exploitation tout en préservant — voire en améliorant — la qualité de service et la valeur de l\'actif.</p>' },
    ],
    serviceType: 'Facility Management',
    serviceName: 'Pilotage de Facility Management — TenderWise',
    areaServed: [{ type: 'Country', name: 'France' }],
    faqs: [
      { q: 'Quelle différence entre un facility manager et un AMO ?', a: 'L\'AMO pilote un projet (construction, réhabilitation) sur une durée limitée ; le Facility Management pilote l\'exploitation du bâtiment dans la durée. TenderWise intervient sur les deux, ce qui assure une continuité entre la livraison et la vie de l\'actif.' },
      { q: 'Êtes-vous prestataire de maintenance ou pilote indépendant ?', a: 'Nous ne réalisons pas la maintenance : nous pilotons et contrôlons les prestataires pour votre compte, en toute indépendance. Cela garantit que les contrats servent votre intérêt et non celui du mainteneur.' },
      { q: 'Pouvez-vous auditer un contrat de maintenance existant ?', a: 'Oui. L\'audit de contrats existants est souvent notre point de départ : il révèle les prestations surfacturées, les manques de conformité et les leviers d\'économie immédiats.' },
    ],
    related: [
      { href: '/amo-lyon', label: 'AMO à Lyon' },
      { href: '/conduite-operation', label: 'Conduite d\'opération' },
      { href: '/expertise', label: 'Notre expertise' },
    ],
  },

  // ═══════════════════════ SERVICE : MAÎTRISE D'OUVRAGE DÉLÉGUÉE ═════════════
  {
    slug: 'maitrise-ouvrage-deleguee',
    kind: 'service',
    metaTitle: 'Maîtrise d\'Ouvrage Déléguée (MOD) — Mandataire de confiance',
    metaDescription: 'Maîtrise d\'ouvrage déléguée (MOD) : TenderWise agit en votre nom et pour votre compte pour porter et piloter votre opération immobilière, avec une délégation claire et encadrée.',
    keywords: 'maîtrise ouvrage déléguée, MOD, mandataire maître ouvrage, délégation pilotage projet immobilier',
    breadcrumbLabel: 'Maîtrise d\'ouvrage déléguée',
    eyebrow: 'Mandat & délégation',
    h1: 'Maîtrise d\'Ouvrage Déléguée (MOD)',
    heroIntro: 'Vous n\'avez ni le temps ni la structure interne pour porter votre opération ? La maîtrise d\'ouvrage déléguée confie à TenderWise le soin <strong>d\'agir en votre nom et pour votre compte</strong>, dans un cadre de délégation clair et maîtrisé.',
    ctaLabel: 'Déléguer mon opération',
    sections: [
      { h2: 'MOD ou AMO : quelle différence ?', body: '<p>En <a href="/amo-lyon">AMO</a>, nous conseillons et pilotons, mais vous gardez la décision et la signature. En MOD, vous nous déléguez une partie de vos prérogatives de maître d\'ouvrage : nous agissons en votre nom, dans les limites du mandat. La MOD convient quand vous voulez vous décharger de la conduite tout en gardant le contrôle stratégique.</p>' },
      { h2: 'Une délégation encadrée et transparente', body: '<p>Le périmètre du mandat, les seuils de décision, le reporting et la reddition de comptes sont définis contractuellement. Vous conservez la maîtrise des arbitrages majeurs ; nous portons l\'exécution opérationnelle au quotidien.</p>' },
    ],
    serviceType: 'Maîtrise d\'ouvrage déléguée',
    serviceName: 'Maîtrise d\'ouvrage déléguée — TenderWise',
    areaServed: [{ type: 'Country', name: 'France' }],
    faqs: [
      { q: 'Le maître d\'ouvrage perd-il le contrôle en MOD ?', a: 'Non. La délégation est encadrée par un mandat précis : seuils de décision, arbitrages réservés au maître d\'ouvrage, reporting régulier et reddition de comptes. Vous déléguez l\'exécution, pas la stratégie.' },
      { q: 'Quand choisir la MOD plutôt que l\'AMO ?', a: 'La MOD s\'impose quand vous manquez de temps ou de structure interne pour porter l\'opération et que vous souhaitez qu\'un tiers agisse en votre nom. L\'AMO suffit quand vous voulez être conseillé et assisté tout en gardant la main sur chaque décision.' },
      FAQ_INDEPENDANCE,
    ],
    related: [
      { href: '/amo-lyon', label: 'AMO à Lyon' },
      { href: '/conduite-operation', label: 'Conduite d\'opération' },
      { href: '/amo-france', label: 'AMO partout en France' },
    ],
  },

  // ═══════════════════════ SERVICE : CONDUITE D'OPÉRATION ════════════════════
  {
    slug: 'conduite-operation',
    kind: 'service',
    metaTitle: 'Conduite d\'opération — Pilotage de chantier de A à Z',
    metaDescription: 'Conduite d\'opération : TenderWise pilote votre projet de construction ou de rénovation de la sélection des intervenants à la réception, en maîtrisant coûts, qualité et délais.',
    keywords: 'conduite opération, pilotage chantier, suivi travaux, maîtrise coût délai, réception travaux, AMO construction',
    breadcrumbLabel: 'Conduite d\'opération',
    eyebrow: 'Pilotage de projet',
    h1: 'Conduite d\'opération : maîtriser votre chantier de A à Z',
    heroIntro: 'Un chantier mal piloté dérive en coût, en délai et en qualité. TenderWise prend en main la conduite de votre opération — neuf ou rénovation — pour vous livrer <strong>ce qui était prévu, au prix prévu, dans les temps</strong>.',
    ctaLabel: 'Sécuriser mon chantier',
    sections: [
      { h2: 'De la sélection des intervenants à la réception', body: '<p>Choix de la maîtrise d\'œuvre et des entreprises, mise au point des marchés, suivi administratif et financier, pilotage du chantier, gestion des aléas, réception et levée des réserves : nous tenons le fil de l\'opération à chaque étape.</p>' },
      { h2: 'Tenir le triptyque coût – qualité – délai', body: '<p>Notre valeur se mesure à votre tranquillité : un budget tenu, un planning respecté et une qualité conforme. Nous anticipons les dérives plutôt que de les constater, grâce à un suivi rigoureux et des points d\'arrêt formalisés.</p>' },
    ],
    serviceType: 'Conduite d\'opération',
    serviceName: 'Conduite d\'opération — TenderWise',
    areaServed: [{ type: 'Country', name: 'France' }],
    faqs: [
      FAQ_AMO_MOE,
      { q: 'Pouvez-vous reprendre une opération déjà lancée ?', a: 'Oui. Il est fréquent qu\'un maître d\'ouvrage fasse appel à nous en cours de route, lorsqu\'une opération dérive. Nous réalisons un état des lieux, sécurisons le budget restant et reprenons le pilotage jusqu\'à la réception.' },
      { q: 'Que couvre la réception des travaux ?', a: 'La réception est l\'acte par lequel vous acceptez l\'ouvrage, avec ou sans réserves. Nous vous y assistons : vérification de la conformité, formalisation des réserves, suivi de leur levée, et contrôle des garanties (parfait achèvement, biennale, décennale).' },
    ],
    related: [
      { href: '/amo-lyon', label: 'AMO à Lyon' },
      { href: '/amo-rehabilitation', label: 'AMO réhabilitation' },
      { href: '/maitrise-ouvrage-deleguee', label: 'Maîtrise d\'ouvrage déléguée' },
    ],
  },

  // ═══════════════════════ SERVICE : AMO RÉHABILITATION ══════════════════════
  {
    slug: 'amo-rehabilitation',
    kind: 'service',
    metaTitle: 'AMO Réhabilitation — Rénover et restructurer sans surprise',
    metaDescription: 'AMO spécialisé en réhabilitation : diagnostics de l\'existant, site occupé, aléas de chantier. TenderWise sécurise vos rénovations et restructurations de bâtiments existants.',
    keywords: 'AMO réhabilitation, rénovation bâtiment, restructuration, diagnostic existant, site occupé, rénovation énergétique',
    breadcrumbLabel: 'AMO réhabilitation',
    eyebrow: 'Rénovation & restructuration',
    h1: 'AMO réhabilitation : rénover sans mauvaise surprise',
    heroIntro: 'La réhabilitation cumule des aléas que le neuf ignore. TenderWise sécurise vos opérations de rénovation et de restructuration en <strong>anticipant les risques de l\'existant</strong> plutôt qu\'en les subissant.',
    ctaLabel: 'Sécuriser ma réhabilitation',
    sections: [
      { h2: 'Les pièges propres à l\'existant', body: '<p>Diagnostics amiante et plomb, état réel de la structure, réseaux non répertoriés, site souvent occupé pendant les travaux, découvertes en cours de chantier : autant de risques qui font dérailler un budget de réhabilitation mal préparé.</p>' },
      { h2: 'Anticiper plutôt que subir', body: '<p>Notre méthode : des audits préalables sérieux, des provisions budgétaires calibrées sur le risque réel, un phasage qui préserve l\'activité, et un pilotage réactif des imprévus. C\'est ainsi qu\'on transforme un bâtiment ancien en actif valorisé.</p>' },
      { h2: 'Réhabilitation et performance énergétique', body: '<p>La rénovation est aussi l\'occasion de mettre l\'actif en conformité (Décret Tertiaire) et d\'en améliorer la performance. Nous intégrons l\'audit énergétique à la stratégie de réhabilitation pour conjuguer valeur et conformité.</p>' },
    ],
    serviceType: 'AMO Réhabilitation',
    serviceName: 'AMO réhabilitation — TenderWise',
    areaServed: [{ type: 'Country', name: 'France' }],
    faqs: [
      { q: 'Pourquoi un AMO est-il particulièrement utile en réhabilitation ?', a: 'Parce que la réhabilitation concentre les aléas : on intervient sur un bâtiment dont on ne connaît jamais parfaitement l\'état. L\'AMO anticipe ces risques par des diagnostics et des provisions adaptées, ce qui évite les surcoûts en cours de chantier.' },
      { q: 'Peut-on rénover un bâtiment tout en maintenant l\'activité ?', a: 'Oui, c\'est la réhabilitation en site occupé. Elle exige un phasage précis, des mesures de sécurité pour les occupants et une coordination fine. C\'est l\'un des cas où le pilotage AMO apporte le plus de valeur.' },
      FAQ_INDEPENDANCE,
    ],
    related: [
      { href: '/amo-lyon', label: 'AMO à Lyon' },
      { href: '/conduite-operation', label: 'Conduite d\'opération' },
      { href: '/facility-management', label: 'Facility Management' },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────
export const landingSlugs = landings.map((l) => l.slug);

export function getLanding(slug: string): LandingContent | undefined {
  return landings.find((l) => l.slug === slug);
}

export function landingMetadata(slug: string): Metadata {
  const l = getLanding(slug);
  if (!l) return {};
  const url = `${SITE}/${l.slug}`;
  return {
    title: l.metaTitle,
    description: l.metaDescription,
    keywords: l.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      siteName: 'TenderWise',
      url,
      title: l.metaTitle,
      description: l.metaDescription,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `TenderWise — ${l.breadcrumbLabel}` }],
    },
  };
}

export function buildLandingSchema(l: LandingContent) {
  const url = `${SITE}/${l.slug}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': `${url}/#service`,
        serviceType: l.serviceType,
        name: l.serviceName,
        description: l.metaDescription,
        url,
        provider: { '@type': 'Organization', name: 'TenderWise', url: SITE },
        areaServed: l.areaServed.map((a) => ({ '@type': a.type, name: a.name })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Expertise', item: `${SITE}/expertise` },
          { '@type': 'ListItem', position: 3, name: l.breadcrumbLabel, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: l.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}
