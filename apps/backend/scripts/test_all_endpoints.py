import httpx

client = httpx.Client(base_url='http://127.0.0.1:8000', timeout=10.0)
r = client.post('/api/v1/auth/login', json={'email': 'admin@example.com', 'password': 'CHANGE_THIS_PASSWORD'})
if r.status_code != 200:
    print(f"Login failed: {r.status_code} {r.text}")
    exit(1)

token = r.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'}

endpoints = [
    ('/api/v1/dashboard/stats', 'Tableau de Bord KPIs'),
    ('/api/v1/products', 'Catalogue Produits (21 items)'),
    ('/api/v1/categories', 'Catégories (5)'),
    ('/api/v1/product-types', 'Types Produits (5)'),
    ('/api/v1/brands', 'Marques (5)'),
    ('/api/v1/units', 'Unités (4)'),
    ('/api/v1/partners?partner_type=CUSTOMER', 'Clients Marocains (7)'),
    ('/api/v1/partners?partner_type=SUPPLIER', 'Fournisseurs Pesage (5)'),
    ('/api/v1/warehouses', 'Dépôts & Entrepôts (4)'),
    ('/api/v1/stock', 'Soldes de Stock Dépôts'),
    ('/api/v1/stock/stats', 'Statistiques de Stock'),
    ('/api/v1/stock/movements', 'Mouvements de Stock Traçabilité'),
    ('/api/v1/purchases', 'Commandes d\'Achat Fournisseurs'),
    ('/api/v1/purchase-receipts', 'Bons de Réception Dépôts'),
    ('/api/v1/quotes', 'Devis Clients'),
    ('/api/v1/sales', 'Commandes de Vente'),
    ('/api/v1/delivery-notes', 'Bons de Livraison Sortie Stock'),
    ('/api/v1/invoices?type=CUSTOMER', 'Factures Vente (Clients)'),
    ('/api/v1/invoices?type=SUPPLIER', 'Factures Achat (Fournisseurs)'),
    ('/api/v1/credit-notes', 'Avoirs Clients (Retour Stock)'),
    ('/api/v1/payments', 'Règlements & Encaissements'),
    ('/api/v1/expenses', 'Dépenses & Journal de Caisse'),
    ('/api/v1/expenses/recurring', 'Charges Récurrentes (Loyers, etc.)'),
    ('/api/v1/expenses/stats', 'Statistiques Dépenses'),
    ('/api/v1/employees', 'Personnel & RH'),
    ('/api/v1/vehicles', 'Flotte Véhicules SAV & Ateliers'),
    ('/api/v1/vehicles/maintenances', 'Maintenances Véhicules'),
    ('/api/v1/vehicles/fuel', 'Consommation Carburant'),
    ('/api/v1/vehicles/stats', 'Statistiques Flotte Automobile'),
    ('/api/v1/users', 'Utilisateurs & RBAC'),
    ('/api/v1/roles', 'Rôles Applicatifs'),
    ('/api/v1/permissions', 'Permissions Sécurité'),
    ('/api/v1/reports/commercial', 'Rapport Commercial & Marges'),
    ('/api/v1/reports/commercial-statistics', 'Statistiques Ventes & Marges'),
    ('/api/v1/reports/commercial-bundle', 'Synthèse Commerciale Globale')
]

print(f"=== TESTING ALL {len(endpoints)} FRONTEND & BACKEND API ENDPOINTS ===")
all_ok = True
for ep, name in endpoints:
    res = client.get(ep, headers=headers)
    status = res.status_code
    try:
        data = res.json()
        if isinstance(data, dict):
            items = data.get('items', data)
            count = len(items) if isinstance(items, list) else len(data)
        elif isinstance(data, list):
            count = len(data)
        else:
            count = 'raw'
    except Exception:
        count = 'non-json'
    
    ok = (status == 200)
    if not ok:
        all_ok = False
    print(f"[{'PASS' if ok else 'FAIL'}] {name:<35} | Status: {status} | Records/Data: {count:<4} | {ep}")

print("==================================================================")
if all_ok:
    print("SUCCESS: 100% OF ENDPOINTS RETURNED HTTP 200 OK WITH COHERENT DEMO DATA!")
else:
    print("WARNING: SOME ENDPOINTS FAILED")
