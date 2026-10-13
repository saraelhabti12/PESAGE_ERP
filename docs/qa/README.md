# ERP Pesage 2000 — Assurance Qualité & Validation Pré-Livraison

Ce dossier contient la documentation complète du cycle d'Assurance Qualité (QA), de stabilisation et de validation fonctionnelle réalisé sur la plateforme **ERP Pesage 2000** avant la livraison client.

---

## 📁 Structure de la Documentation QA

- **[`TEST-PLAN.md`](./TEST-PLAN.md)** : Plan de test d'assurance qualité exhaustif (Phases 0 à 32), matrice de couverture fonctionnelle, règles de gestion critiques, scénarios end-to-end et cas limites.
- **[`TEST-REPORT.md`](./TEST-REPORT.md)** : Rapport de validation formel, résultats d'exécution des tests (Pytest, Alembic, Vite/TypeScript), audit sécurité/CORS, anomalies identifiées et corrigées.

---

## 🛠️ Commandes d'Exécution & Reproduction

### 1. Backend (FastAPI & SQLAlchemy)
```powershell
# Activer l'environnement virtuel
cd apps/backend
.\.venv\Scripts\Activate.ps1

# Exécution de la suite complète de tests automatisés (99 tests)
pytest -v

# Exécution des scénarios métier client réels End-to-End
pytest tests/test_client_real_world_e2e.py -v

# Vérification de l'intégrité du schéma de base de données (Alembic)
alembic current
alembic heads
alembic check
```

### 2. Frontend (React 18, Vite & TypeScript)
```powershell
cd apps/frontend

# Validation TypeScript et compilation de production
pnpm build

# Linting du code source
pnpm lint
```

### 3. Validation Infrastructure & CORS
```powershell
# Santé API et Base de données
curl http://localhost:8000/health
curl http://localhost:8000/health/db

# Validation du preflight CORS (Ne doit pas renvoyer 400)
curl -X OPTIONS http://localhost:8000/api/v1/auth/login `
  -H "Origin: http://localhost:5173" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: Content-Type" -I
```

---

## 🛡️ Règles Métier Critiques Validées

1. **Isolation Stricte des Stocks par Entrepôt (`product_id + warehouse_id`)** :
   - Aucun solde global fictif. Le stock est déduit uniquement dans l'entrepôt exact sélectionné lors de la commande/vente.
   - Les transferts inter-dépôts sont atomiques (débit source + crédit destination).
2. **Workflow Commercial Découplé** :
   - La création de bon de commande fournisseur n'incrémente pas le stock.
   - La réception fournisseur incrémente le stock dans le dépôt choisi.
   - La confirmation de vente déduit le stock ; la génération du bon de livraison ne provoque aucune double déduction.
3. **Ségrégation Stricte des Factures** :
   - Les factures clients (`CUSTOMER`) et fournisseurs (`SUPPLIER`) sont filtrées rigoureusement au niveau backend.
4. **Intégrité Financière & Avoirs** :
   - Impossibilité d'émettre un avoir excédant la quantité ou la valeur facturée.
   - Les avoirs avec retour en stock créent des mouvements `CUSTOMER_RETURN` dans le dépôt spécifié.
5. **Sécurité & Protection des Données** :
   - Zéro exposition de `password_hash`, `jwt_secret`, ou clés secrètes dans les API et exports Excel.
   - Origines CORS strictement déclarées (`http://localhost:5173`, etc.) sans wildcard `allow_origins=["*"]`.
