# Plan d'Assurance Qualité & Matrice de Tests (Phases 0 à 32)
## ERP Pesage 2000 — Validation Pré-Livraison Client

Ce document détaille la stratégie et la matrice complète de couverture fonctionnelle, technique et de sécurité pour la validation finale de l'application ERP Pesage 2000.

---

## 📑 Sommaire des Phases de Test

| Phase | Domaine / Module | Objectif Principal | Statut |
|---|---|---|---|
| **Phase 0** | Inventaire Fonctionnel | Cartographie complète des modules backend, frontend, BD et routes | **VALIDÉ** |
| **Phase 1** | Environnement & Infrastructure | Vérification PostgreSQL, FastAPI, CORS, health checks, docs OpenAPI | **VALIDÉ** |
| **Phase 2** | Base de données & Migrations | Alembic `current`, `heads`, `check`, intégrité des clés étrangères | **VALIDÉ** |
| **Phase 3** | Authentification & Sessions | Login admin, JWT, rotation refresh tokens, logout, protection routes | **VALIDÉ** |
| **Phase 4** | RBAC / Gestion des Rôles | Contrôle d'accès granulaire aux API (GET, POST, PUT, DELETE) | **VALIDÉ** |
| **Phase 5** | Catalogue Produits & Types | CRUD, unicité SKU, gestion `track_stock=true/false`, TVA, prix | **VALIDÉ** |
| **Phase 6** | Partenaires (Clients/Fournisseurs) | Génération automatique des codes (`CLI-YYYY-XXXX`, `FOU-YYYY-XXXX`) | **VALIDÉ** |
| **Phase 7** | Stock & Multi-Entrepôts | Solde strict `(product_id, warehouse_id)`, transferts atomiques | **VALIDÉ** |
| **Phase 8** | Workflow Achats Fournisseurs | BC -> Réception -> Incrémentation Stock Dépôt -> Facture -> Paiement | **VALIDÉ** |
| **Phase 9** | Workflow Ventes Clients | Devis -> Vente -> Déduction Stock Dépôt -> BL -> Facture -> Règlement | **VALIDÉ** |
| **Phase 10** | Bons de Livraison (BL) | Génération à partir de vente, intégrité stock (aucune double déduction) | **VALIDÉ** |
| **Phase 11** | Factures Clients (Ventes) | Type `CUSTOMER`, calculs HT/TVA/TTC, acomptes, reste à payer, retards | **VALIDÉ** |
| **Phase 12** | Factures Fournisseurs (Achats) | Type `SUPPLIER`, isolation stricte backend vs factures clients | **VALIDÉ** |
| **Phase 13** | Règlements & Paiements | Espèces, Virement, Chèque, cohérence mathématique solde restant | **VALIDÉ** |
| **Phase 14** | Avoirs & Notes de Crédit | Avoirs partiels/totaux, plafond facturé, réintégration stock `CUSTOMER_RETURN` | **VALIDÉ** |
| **Phase 15** | Dépenses & Trésorerie | Dépenses ponctuelles/récurrentes, `/expenses/stats` sur données nulles | **VALIDÉ** |
| **Phase 16** | Filtrage par Période / Dates | Aujourd'hui, Semaine, Mois, Année, intervalles fermés/ouverts | **VALIDÉ** |
| **Phase 17** | Filtres Avancés Multicritères | Combinaison Statut + Client/Fournisseur + Date + Montant | **VALIDÉ** |
| **Phase 18** | Personnel & Employés | Fiche employé, matricule, coordonnées, poste, statut actif | **VALIDÉ** |
| **Phase 19** | Parc Automobile & Flotte | Véhicules, documents (assurance, visite), entretiens, carburant | **VALIDÉ** |
| **Phase 20** | Exports Excel (openpyxl) | Génération des fichiers `.xlsx`, respect des filtres, non-fuite de secrets | **VALIDÉ** |
| **Phase 21** | Tableau de Bord & KPIs | Calcul en direct des indicateurs réels (zéro chiffre factice) | **VALIDÉ** |
| **Phase 22** | Notifications & Alertes | Échéances de factures, alerte J-7, idempotence des rappels | **VALIDÉ** |
| **Phase 23** | UI/UX & Cohérence Visuelle | Lisibilité des boutons, modales, thèmes sombre/clair, pagination | **VALIDÉ** |
| **Phase 24** | Régression d'Erreurs API | Non-reproduction des erreurs 400 (CORS), 422 (stats), 500 (invoices) | **VALIDÉ** |
| **Phase 25** | Audit des Collisions de Routes | Découplage des routes fixes (`/stats`, `/export`) des routes dynamiques (`/{id}`) | **VALIDÉ** |
| **Phase 26** | Suite de Tests Automatisés | Implémentation pytest par domaine et scénarios client E2E | **VALIDÉ** |
| **Phase 27** | Validation Build Frontend | Compilation TypeScript (`tsc -b`), bundler Vite (`pnpm build`) | **VALIDÉ** |
| **Phase 28** | Exécution des Suites Complètes | Lancement exhaustif pytest + alembic + frontend build | **VALIDÉ** |
| **Phase 29** | Correction des Anomalies | Diagnostic, correctifs ciblés, validation par tests de régression | **VALIDÉ** |
| **Phase 30** | Scénarios Métier Réels (A à E) | Exécution des flux de bout en bout simulant une utilisation réelle | **VALIDÉ** |
| **Phase 31** | Sécurité & Désanitisation | Audit des payloads JSON et exports (zéro hachage ou token exposé) | **VALIDÉ** |
| **Phase 32** | Rapport Final de Recette | Documentation complète pour livraison client | **VALIDÉ** |

---

## 🔬 Détail des Scénarios Client Réels (Phase 30)

### Scénario A : Workflow Achat Complet
1. Création du fournisseur (`FOU-YYYY-XXXX`).
2. Création de l'article avec suivi de stock activé (`track_stock=true`).
3. Création du Bon de Commande Achat (statut `DRAFT` puis `ORDERED`). Vérification : stock physique inchangé (= 0).
4. Création et confirmation du Bon de Réception dans le Dépôt Principal (ex: +50 unités). Vérification : stock = 50.
5. Création de la Facture Fournisseur (`SUPPLIER`).
6. Enregistrement d'un règlement bancaire (ex: 50 000 MAD). Vérification : recalcul automatique du reste à payer.

### Scénario B : Workflow Vente & Logistique
1. Création du client (`CLI-YYYY-XXXX`).
2. Création d'un article et alimentation initiale du stock dans le Dépôt A (100 unités) et Dépôt B (50 unités).
3. Création de la commande de vente de 20 unités avec source explicitement affectée au Dépôt A.
4. Confirmation de la vente. Vérification : Dépôt A passe à 80 unités ; Dépôt B reste strictement à 50 unités.
5. Création du Bon de Livraison. Vérification : aucune double déduction de stock.
6. Émission de la Facture Client (`CUSTOMER`).
7. Enregistrement d'un paiement partiel (ex: 20 000 MAD / 48 000 MAD TTC). Vérification : reste à payer = 28 000 MAD, statut `PARTIALLY_PAID`.

### Scénario C : Workflow Avoir & Retour Marchandise
1. Sélection d'une facture client émise.
2. Création d'un avoir partiel avec `return_to_stock=true` (ex: retour de 5 unités sur 20).
3. Vérification : le stock du Dépôt A est récrédité de +5 unités (80 -> 85) via un mouvement `CUSTOMER_RETURN`.
4. Vérification : tentative d'avoir pour un montant supérieur à la facture rejetée avec code 400.
5. Vérification : la facture d'origine reste intacte dans l'historique comptable.

### Scénario D : Dépenses & Statistiques Financières
1. Consultation du endpoint statistiques de dépenses sur base vide (`GET /api/v1/expenses/stats`). Vérification : réponse 200 OK avec totaux à zéro (aucun crash 422 ou 500).
2. Création de dépenses ponctuelles et récurrentes (loyer, carburant).
3. Vérification des agrégations mensuelles et annuelles.
4. Application des filtres de dates (ex: Juillet 2025, Août 2026).

### Scénario E : Multi-Entrepôts & Transferts Atomiques
1. Article X présent dans Dépôt A (100 unités) et Dépôt B (50 unités).
2. Vente de 20 unités sur Dépôt A -> Dépôt A = 80, Dépôt B = 50.
3. Transfert de 30 unités de Dépôt A vers Dépôt B -> Dépôt A = 50, Dépôt B = 80.
4. Vérification de la traçabilité des mouvements (`STOCK_OUT` et `STOCK_IN`).
5. Tentative de transfert avec stock source insuffisant -> Rejet avec erreur 400 sans corruption de soldes.
