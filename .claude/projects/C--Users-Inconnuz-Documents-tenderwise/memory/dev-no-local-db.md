---
name: dev-no-local-db
description: Le dev server TenderWise plante (500) sans MySQL local — vérification navigateur impossible hors prod
metadata:
  type: project
---

Le projet TenderWise (Next.js 16, App Router) lit ses réglages depuis MySQL dès le `RootLayout` via `getAllSettings()` (lib/settings.ts → lib/db.ts). `.env.local` pointe vers `localhost:3306`, mais aucune base MySQL ne tourne dans l'environnement de dev local : `npm run dev` démarre mais **toute page renvoie 500** (`ECONNREFUSED 127.0.0.1:3306`).

**Conséquence :** impossible de vérifier un rendu via preview/navigateur en local. Vérifier par typecheck (`npx tsc --noEmit`) + `npx eslint`, et tester le visuel sur l'hébergement o2switch (base distante) après déploiement.

La base réelle est `duvu8164_tenderwise_next` (user `duvu8164_romuald`) côté o2switch.
