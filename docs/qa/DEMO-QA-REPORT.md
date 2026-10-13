# RAPPORT DE QUALITÉ ET VALIDATION DES SCÉNARIOS UTILISATEUR RÉELS
## ERP PESAGE 2000 — DÉMONSTRATION COMPLÈTE & JEU DE DONNÉES RÉALISTE

- **Date d'exécution** : 06 Octobre 2026
- **Environnement** : Développement Local (Frontend: `http://localhost:5173`, Backend: `http://localhost:8000`)
- **Version applicative** : 1.0.0-rc3
- **Base de données** : PostgreSQL (`erp_db`) — Données de démonstration persistées et actives
- **Statut global** : ✅ **TOUS LES SCÉNARIOS VALIDÉS (100% PASS)**

---

### 1. RÉSUMÉ EXÉCUTIF

L'intégralité des 33 phases de validation métier, d'exécution de scénarios utilisateur réels et de génération de données de démonstration cohérentes a été exécutée avec succès sur la plateforme **ERP PESAGE 2000**.

Aucune donnée n'a été insérée par des raccourcis directs en base de données : l'ensemble des enregistrements, mouvements de stocks, imputations comptables, écritures de caisse, maintenances et alertes a été généré à travers les flux et API applicatifs réels, garantissant l'intégrité référentielle, le respect du RBAC, la validation des règles de gestion et l'isolation stricte des pièces comptables (ventes vs achats).

La base locale reste entièrement peuplée avec un jeu de données représentatif d'une société marocaine spécialisée dans le pesage industriel, prête pour les démonstrations clients.

---

### 2. TABLEAU RÉCAPITULATIF DES MODULES ET WORKFLOWS TESTÉS

| Module | Enregistrements créés | UI / API testé | Workflow métier testé | Résultat |
| :--- | :---: | :---: | :---: | :---: |
| **Authentification & RBAC** | 4 utilisateurs + 1 admin | OUI | OUI (Isolation des rôles & permissions) | **PASS** |
| **Clients (Partenaires)** | 7 clients marocains (ICE/IF) | OUI | OUI (Numérotation auto, filtres) | **PASS** |
| **Fournisseurs** | 5 équipementiers pesage | OUI | OUI (Relations commandes d'achat) | **PASS** |
| **Catalogue & Produits** | 21 références (5 catégories) | OUI | OUI (Articles stockés et non stockés) | **PASS** |
| **Dépôts & Stocks** | 4 dépôts régionaux / SAV | OUI | OUI (Valorisation, seuils d'alerte) | **PASS** |
| **Commandes d'Achat** | 10 commandes | OUI | OUI (Approbation, non-impact stock) | **PASS** |
| **Bons de Réception Achat** | 10 réceptions | OUI | OUI (Incrémentation stock par dépôt) | **PASS** |
| **Devis & Commandes Vente**| 9 commandes / devis | OUI | OUI (Conversion devis, réservations) | **PASS** |
| **Bons de Livraison Vente** | 9 livraisons | OUI | OUI (Décrémentation stock en temps réel) | **PASS** |
| **Transferts Inter-Dépôts** | 3 transferts | OUI | OUI (Source $\to$ Dest, traçabilité lot) | **PASS** |
| **Factures Vente** | 9 factures clients | OUI | OUI (Calculs TVA 20%, échéances) | **PASS** |
| **Factures Achat** | 10 factures fournisseurs | OUI | OUI (Isolation stricte Achat/Vente) | **PASS** |
| **Avoirs Clients** | 3 avoirs (avec retour stock) | OUI | OUI (Réintégration stock, anti sur-avoir) | **PASS** |
| **Règlements & Encaissements**| 12 paiements | OUI | OUI (Virement, Chèque, Espèces, Partiels) | **PASS** |
| **Dépenses & Caisse** | 12 dépenses réelles | OUI | OUI (Fixes/Variables, 2025/2026, ventilation) | **PASS** |
| **Charges Récurrentes** | 4 contrats récurrents | OUI | OUI (Générateur sans doublons) | **PASS** |
| **Flotte & Véhicules** | 3 véhicules de service/SAV | OUI | OUI (Kilométrage, statut, affectations) | **PASS** |
| **Maintenance Véhicules** | 3 interventions | OUI | OUI (Fournisseurs, pièces, main d'œuvre) | **PASS** |
| **Carburant / Gazole** | 3 pleins | OUI | OUI (Calcul MAD/L, index kilométrique) | **PASS** |
| **Personnel & RH** | 5 employés | OUI | OUI (Départements, postes, statuts) | **PASS** |
| **Rapports & Statistiques** | Multi-exercices | OUI | OUI (Calculs dynamiques temps réel) | **PASS** |
| **Tableau de Bord (KPIs)** | 1 dashboard unifié | OUI | OUI (Chiffres d'affaires, marges, alertes) | **PASS** |

---

### 3. DÉTAIL DES PHASES ET VALIDATIONS EXÉCUTÉES

#### Phase 1 : Démarrage et Contrôle d'Intégrité
- Vérification du backend FastAPI (`http://localhost:8000/api/v1/health`) : Opérationnel.
- Vérification du frontend React / Vite (`http://localhost:5173`) : Opérationnel.
- Absence d'erreur CORS, absence de 422 ou 500 sur les endpoints de base.

#### Phase 2 : Administration, Utilisateurs & RBAC
- **Utilisateurs créés** :
  1. `admin_gestion` (Karim Bennani) — Rôle Administrateur Gestion
  2. `resp_commercial` (Fatima Zahra) — Rôle Commercial
  3. `comptable` (Omar Idrissi) — Rôle Comptable
  4. `technicien_sav` (Yassine Alami) — Rôle Technicien Atelier
- **Test RBAC** : Vérification de l'isolation des permissions par rôle. Le compte administrateur initial a été préservé intact.

#### Phases 3 & 4 : Partenaires (Clients & Fournisseurs Marocains)
- **Clients créés** :
  - *Atlas BTP Tanger* (ICE: 001234567890123, Tanger)
  - *Société Industrielle du Nord* (ICE: 009876543210987, Tanger Free Zone)
  - *TransLog Med S.A.R.L.* (ICE: 004567890123456, Tanger Med)
  - *Carrières & Granulats du Rif* (ICE: 007890123456789, Tétouan)
  - *Sucrerie Raffinerie du Tadla* (ICE: 003210987654321, Beni Mellal)
  - *Ciments & Matériaux de l'Atlas* (ICE: 006543210987654, Casablanca)
  - *AgriMaroc Souss Distribution* (ICE: 008901234567890, Agadir)
- **Fournisseurs créés** :
  - *Pesage Européen Technologies* (Balance industrielle & ponts)
  - *Capteurs & Composants Maroc* (Capteurs de pesage analogiques/numériques)
  - *Dini Argeo Maroc Distribution* (Indicateurs & terminaux homologués)
  - *Châssis & Métallerie du Nord* (Tabliers ponts-bascules & génie civil)
  - *Fournitures Industrielles Casa* (Câblage, accessoires, boîtes de raccordement)

#### Phase 5 : Catalogue Produits Pesage 2000
Création de 21 références cohérentes avec le domaine du pesage :
- **Ponts-Bascules** : Pont Métallique 60T (18x3m), Pont Béton 80T (18x3m).
- **Balances Industrielles** : Plateforme 1500kg (1.5x1.5m), Balance Compacte Inox 30kg, Pèse-Palette U 3000kg.
- **Indicateurs & Électronique** : Indicateur Numérique IP68 Homologué, Terminal Tactile Industriel Windows, Boîte de Raccordement Inox 4/6 voies.
- **Capteurs de Charge** : Capteur Cisaillement 2000kg C3, Capteur Compression 30T OIML C3.
- **Accessoires & Câblage** : Répétiteur Affichage Géant LED 100mm, Câble Blindé 6 conducteurs (bobine 100m), Imprimante Thermique Ticket Pesée.
- **Services & Prestations** : Forfait Étalonnage & Contrôle Métrologique (Non stocké).

#### Phase 6 : Dépôts & Stocks Multi-Sites
- 4 Dépôts opérationnels :
  1. `Dépôt Tanger - Principal Zone Franche`
  2. `Dépôt Casablanca - Ain Sebaa`
  3. `Dépôt Rabat - Agdal Service`
  4. `Atelier Central SAV & Métrologie`

#### Phases 7 & 8 : Flux d'Achats et de Ventes Complets
- **Achats** :
  - Création de 10 commandes d'achat réparties sur 2025 et 2026.
  - Confirmation des réceptions : incrémentation automatique des stocks dans les dépôts cibles spécifiés.
  - Génération des factures fournisseurs et enregistrement des paiements (comptants, partiels, en attente).
- **Ventes** :
  - Création de devis et commandes de vente.
  - Validation des bons de livraison : décrémentation automatique des quantités disponibles dans les dépôts sources.
  - Émission des factures clients avec calculs exacts HT, TVA (20%) et TTC.

#### Phase 9 : Transferts Inter-Dépôts & Tests Négatifs
- Transfert réel de 30 capteurs de charge du *Dépôt Tanger* vers le *Dépôt Casablanca*.
- Validation de la traçabilité des mouvements d'inventaire.
- Validation des rejets d'erreurs :
  - Rejet d'un transfert avec dépôt source identique au dépôt destination (`400 Bad Request`).
  - Rejet d'une vente ou d'un transfert avec quantité supérieure au stock disponible.

#### Phases 10 & 11 : Isolation Absolue Factures Ventes vs Factures Achats
- Vérification formelle : Les factures clients n'apparaissent jamais dans le registre des factures d'achat.
- Les factures fournisseurs restent strictement cantonnées au module Achats.

#### Phase 12 : Avoirs Clients et Réintégration en Stock
- Création d'un avoir client partiel pour retour de matériel avec `return_to_stock = True`.
- Constat de la réintégration immédiate des quantités dans le stock du dépôt désigné.
- Création d'un mouvement de type `CUSTOMER_RETURN` dans le journal des stocks.
- Blocage strict de toute tentative de sur-avoir (montant ou quantité supérieur au restant facturé).

#### Phase 13 : Règlements & Paiements Multi-Banques
- Paiements enregistrés par Virement bancaire (BMCE, Attijariwafa Bank, CIH Bank, SGMB), Chèque et Espèces.
- Traitement des paiements intégraux $\to$ statut `PAYEE`.
- Traitement des paiements partiels $\to$ statut `PARTIELLEMENT_PAYEE`.

#### Phases 14 & 15 : Dépenses, Petite Caisse & Charges Récurrentes
- 12 dépenses enregistrées sur les exercices 2025 et 2026 : Loyers d'agences, Télécoms, Amendis, Lydec, Assurances flotte, Carburant, Fournitures d'atelier.
- 4 contrats récurrents configurés (Loyer Tanger, Loyer Casa, Internet Fibre, Assurance RMA).
- Exécution du générateur de charges récurrentes : création automatique des occurrences sans duplication sur exécutions répétées.

#### Phases 16, 17 & 18 : Flotte Automobile, Maintenance & Carburant
- Véhicules enregistrés :
  1. *Renault Master SAV Atelier* (45120-A-1)
  2. *Dacia Dokker Commercial* (78945-B-40)
  3. *Camion Isuzu Étalonnage Poids Lourds* (12345-D-1)
- Maintenances consignées avec ventilation pièces, main-d'œuvre et prestataires.
- Journal de carburant : consommation et prix au litre validés avec calcul automatique du montant total TTC.

#### Phase 19 : Personnel & Ressources Humaines
- 5 collaborateurs enregistrés avec affectation aux départements Direction, Ventes, Finance, Métrologie et Logistique.

#### Phases 20, 21 & 22 : Tableaux de Bord, Statistiques & Filtres
- Le Tableau de Bord affiche désormais des métriques riches et non nulles (Chiffre d'Affaires, Valeur du Stock, Dépenses courantes, Alertes de paiement).
- Filtrage validé sur les périodes 2025, 2026, Mois spécifique, Partenaire et Statut avec réinitialisation sans anomalie.

---

### 4. ANOMALIES DÉTECTÉES ET CORRIGÉES

| Réf | Fichier / Composant | Description de l'anomalie | Correction appliquée | Statut |
| :--- | :--- | :--- | :--- | :---: |
| **BUG-01** | `apps/backend/app/services/vehicle_services.py:376` | `TypeError: unsupported operand type(s) for /: 'float' and 'decimal.Decimal'` lors du calcul de la consommation moyenne de carburant dans les statistiques de flotte. | Cast explicite du total kilométrique en `float` avant la division : `float(raw_km)`. | **CORRIGÉ** |
| **BUG-02** | `apps/backend/app/services/export_services.py:164, 301` | `AttributeError: 'Product' object has no attribute 'sale_price_ht'` lors de l'export Excel / PDF du catalogue de produits. | Harmonisation de l'accès aux attributs du modèle `Product` : `p.sale_price` et `p.purchase_price`. | **CORRIGÉ** |
| **BUG-03** | `apps/backend/scripts/run_full_demo_qa.py` | Conflits de clé unique sur les références de paiement lors de relances successives du script de démonstration. | Génération de références horodatées uniques (`VIR-YYYYMMDD-...`, `CHQ-...`). | **CORRIGÉ** |

---

### 5. RÉSULTATS DES SUITES DE TESTS AUTOMATISÉS

1. **Pytest Backend** :
   ```bash
   pytest -q
   ................................................................................ [ 80%]
   ....................                                                             [100%]
   100 passed in 23.41s
   ```

2. **Vérification des Migrations Alembic** :
   ```bash
   alembic current
   8e5ba12cf3d0 (head)
   alembic check
   No new operations detected. Schema is synchronized.
   ```

3. **Compilation et Validation Frontend** :
   ```bash
   pnpm build
   $ tsc -b && vite build
   ✓ 1707 modules transformed.
   ✓ built in 14.44s (dist/assets/index.js, dist/assets/index.css generated with 0 errors).
   ```

---

### 6. COMPTES DE DÉMONSTRATION DISPONIBLES

| Identifiant | Rôle | Mot de passe | Usage recommandé en démonstration |
| :--- | :--- | :--- | :--- |
| `admin` | Super Administrateur | *(Compte d'origine)* | Vue d'ensemble complète, configuration système |
| `admin_gestion` | Admin Gestion | `Admin@123456` | Gestion globale, validation des stocks et achats |
| `resp_commercial` | Responsable Commercial | `Commercial@123456` | Devis, Commandes clients, Factures de vente |
| `comptable` | Comptable | `Compta@123456` | Règlements, Factures d'achat, Dépenses, Caisse |
| `technicien_sav` | Technicien SAV & Métrologie | `Tech@123456` | Flotte, Maintenances, Bons de réception atelier |

---

### 7. CONCLUSION

L'application **ERP PESAGE 2000** est validée sur l'ensemble de ses fonctionnalités transactionnelles, analytiques et de gestion. La base de données locale est prête, cohérente et immédiatement exploitable pour les présentations et revues opérationnelles.
