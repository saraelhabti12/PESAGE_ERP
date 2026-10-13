import sys
import os
import httpx
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("API_BASE_URL", "http://127.0.0.1:8000/api/v1")
AUTH_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@example.com")
AUTH_PASSWORD = os.environ.get("ADMIN_PASSWORD", "CHANGE_THIS_PASSWORD")

session = httpx.Client(timeout=30.0)

def log(msg):
    print(f"[DEMO SEEDER] {msg}")

def login():
    log(f"Logging in as {AUTH_EMAIL} to {BASE_URL}/auth/login...")
    res = session.post(
        f"{BASE_URL}/auth/login",
        json={"email": AUTH_EMAIL, "password": AUTH_PASSWORD},
    )
    if res.status_code != 200:
        log(f"Login failed: {res.status_code} {res.text}")
        sys.exit(1)
    tokens = res.json()
    access_token = tokens["access_token"]
    session.headers.update({"Authorization": f"Bearer {access_token}"})
    log("Logged in successfully. Access token acquired.")

def seed_users():
    log("--- Seeding Users & RBAC ---")
    users_data = [
        {
            "first_name": "Karim",
            "last_name": "Bennani",
            "email": "karim.bennani@pesage2000.ma",
            "password": "Password123!",
            "phone": "+212 6 61 23 45 67",
            "role_names": ["commercial", "manager"],
        },
        {
            "first_name": "Fatima",
            "last_name": "Zahra",
            "email": "fatima.zahra@pesage2000.ma",
            "password": "Password123!",
            "phone": "+212 6 62 34 56 78",
            "role_names": ["comptable", "manager"],
        },
        {
            "first_name": "Omar",
            "last_name": "Idrissi",
            "email": "omar.idrissi@pesage2000.ma",
            "password": "Password123!",
            "phone": "+212 6 63 45 67 89",
            "role_names": ["technician"],
        },
        {
            "first_name": "Yassine",
            "last_name": "Alami",
            "email": "yassine.alami@pesage2000.ma",
            "password": "Password123!",
            "phone": "+212 6 64 56 78 90",
            "role_names": ["manager"],
        },
    ]

    # Get available roles
    res_roles = session.get(f"{BASE_URL}/users/roles")
    roles_map = {}
    if res_roles.status_code == 200:
        for r in res_roles.json():
            roles_map[r["name"].lower()] = r["id"]

    created = 0
    for u in users_data:
        role_ids = [roles_map[rn] for rn in u["role_names"] if rn in roles_map]
        payload = {
            "first_name": u["first_name"],
            "last_name": u["last_name"],
            "email": u["email"],
            "password": u["password"],
            "phone": u["phone"],
            "role_ids": role_ids,
            "is_active": True,
        }
        res = session.post(f"{BASE_URL}/users", json=payload)
        if res.status_code in (200, 201):
            log(f"Created User: {u['first_name']} {u['last_name']} ({u['email']})")
            created += 1
        elif res.status_code == 409 or "already exists" in res.text:
            log(f"User already exists: {u['email']}")
        else:
            log(f"User create returned {res.status_code}: {res.text}")
    return created

def seed_catalog():
    log("--- Seeding Catalog (Categories, Types, Units, Brands, Products) ---")
    # 1. Categories
    cats = [
        {"name": "Ponts-Bascules & Terminaux", "code": "CAT-PB", "description": "Équipements de pesage lourd pour véhicules industriels"},
        {"name": "Balances Industrielles", "code": "CAT-BAL", "description": "Balances de table, de sol et plateformes de pesée"},
        {"name": "Capteurs & Composants", "code": "CAT-CAPT", "description": "Capteurs de pesage, boîtes de jonction et pesons"},
        {"name": "Afficheurs & Accessoires", "code": "CAT-ACC", "description": "Répétiteurs LED, imprimantes et câblage haute précision"},
        {"name": "Services & Métrologie", "code": "CAT-SERV", "description": "Prestations d'étalonnage, maintenance et mise en service"},
    ]
    cat_ids = {}
    for c in cats:
        r = session.post(f"{BASE_URL}/categories", json=c)
        if r.status_code in (200, 201):
            cat_ids[c["code"]] = r.json()["id"]
        else:
            # find existing
            r_list = session.get(f"{BASE_URL}/categories")
            for item in r_list.json():
                if item["code"] == c["code"]:
                    cat_ids[c["code"]] = item["id"]

    # 2. Product Types
    types = [
        {"name": "Poids Lourd", "code": "TYP-PL", "description": "Matériel de pesage véhicules"},
        {"name": "Industriel", "code": "TYP-IND", "description": "Matériel d'atelier et usine"},
        {"name": "Composant Électronique", "code": "TYP-COMP", "description": "Pièces détachées et capteurs"},
        {"name": "Périphérique", "code": "TYP-PERIPH", "description": "Imprimantes et écrans"},
        {"name": "Prestation de Service", "code": "TYP-SERV", "description": "Main d'oeuvre et métrologie"},
    ]
    type_ids = {}
    for t in types:
        r = session.post(f"{BASE_URL}/product-types", json=t)
        if r.status_code in (200, 201):
            type_ids[t["code"]] = r.json()["id"]
        else:
            r_list = session.get(f"{BASE_URL}/product-types")
            for item in r_list.json():
                if item["code"] == t["code"]:
                    type_ids[t["code"]] = item["id"]

    # 3. Units
    units = [
        {"name": "Unité", "abbreviation": "U", "description": "Pièce unitaire"},
        {"name": "Kilogramme", "abbreviation": "kg", "description": "Masse en kilogrammes"},
        {"name": "Mètre", "abbreviation": "m", "description": "Longueur de câble"},
        {"name": "Forfait", "abbreviation": "FF", "description": "Forfait prestation"},
    ]
    unit_ids = {}
    for u in units:
        r = session.post(f"{BASE_URL}/units", json=u)
        if r.status_code in (200, 201):
            unit_ids[u["abbreviation"]] = r.json()["id"]
        else:
            r_list = session.get(f"{BASE_URL}/units")
            for item in r_list.json():
                if item["abbreviation"] == u["abbreviation"]:
                    unit_ids[u["abbreviation"]] = item["id"]

    # 4. Brands
    brands = [
        {"name": "Pesage 2000", "code": "BR-P2000", "description": "Fabrication & Intégration Pesage 2000 Maroc"},
        {"name": "Bilanciai", "code": "BR-BIL", "description": "Constructeur Européen de pesage industriel"},
        {"name": "Dini Argeo", "code": "BR-DINI", "description": "Systèmes de pesage et électronique de mesure"},
        {"name": "HBM Hottinger", "code": "BR-HBM", "description": "Capteurs de pesage haute fidélité"},
        {"name": "Vishay Nobel", "code": "BR-VISH", "description": "Capteurs de force numériques et analogiques"},
    ]
    brand_ids = {}
    for b in brands:
        r = session.post(f"{BASE_URL}/brands", json=b)
        if r.status_code in (200, 201):
            brand_ids[b["code"]] = r.json()["id"]
        else:
            r_list = session.get(f"{BASE_URL}/brands")
            for item in r_list.json():
                if item["code"] == b["code"]:
                    brand_ids[b["code"]] = item["id"]

    # 5. Products list (21 realistic pesage items)
    products_data = [
        {
            "sku": "PB-60T-MET",
            "designation": "Pont-Bascule Métallique 60T (18m x 3m)",
            "description": "Plateforme métallique extra-robuste pour pesage de camions et semi-remorques avec 6 capteurs compression.",
            "category_id": cat_ids["CAT-PB"],
            "product_type_id": type_ids["TYP-PL"],
            "brand_id": brand_ids["BR-P2000"],
            "unit_id": unit_ids["U"],
            "purchase_price": 180000.0,
            "sale_price": 240000.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "PB-80T-BET",
            "designation": "Pont-Bascule Béton 80T (18m x 3m)",
            "description": "Pont-bascule tablier béton armé coulé sur site pour carrières et environnements corrosifs sévères.",
            "category_id": cat_ids["CAT-PB"],
            "product_type_id": type_ids["TYP-PL"],
            "brand_id": brand_ids["BR-P2000"],
            "unit_id": unit_ids["U"],
            "purchase_price": 220000.0,
            "sale_price": 295000.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "BAL-IND-300",
            "designation": "Balance Industrielle Inox 300kg (60x60cm)",
            "description": "Balance de sol tout inox IP67 avec colonne et indicateur numérique pour industrie agroalimentaire et chimique.",
            "category_id": cat_ids["CAT-BAL"],
            "product_type_id": type_ids["TYP-IND"],
            "brand_id": brand_ids["BR-DINI"],
            "unit_id": unit_ids["U"],
            "purchase_price": 8500.0,
            "sale_price": 12900.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "BAL-IND-600",
            "designation": "Balance Industrielle Renforcée 600kg (80x80cm)",
            "description": "Plateforme industrielle acier peint haute résistance aux chocs pour ateliers d'expédition.",
            "category_id": cat_ids["CAT-BAL"],
            "product_type_id": type_ids["TYP-IND"],
            "brand_id": brand_ids["BR-BIL"],
            "unit_id": unit_ids["U"],
            "purchase_price": 11000.0,
            "sale_price": 16500.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "BAL-PLT-1500",
            "designation": "Balance Plateforme 1500kg (1.2m x 1.2m)",
            "description": "Plateforme 4 capteurs de cisaillement avec boîte de jonction et pieds articulés auto-alignants.",
            "category_id": cat_ids["CAT-BAL"],
            "product_type_id": type_ids["TYP-IND"],
            "brand_id": brand_ids["BR-DINI"],
            "unit_id": unit_ids["U"],
            "purchase_price": 14000.0,
            "sale_price": 21000.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "BAL-PLT-3000",
            "designation": "Balance Plateforme Extra-Plate 3000kg (1.5m x 1.5m)",
            "description": "Plateforme extra-plate pour transpalettes manuels avec rampes d'accès amovibles.",
            "category_id": cat_ids["CAT-BAL"],
            "product_type_id": type_ids["TYP-IND"],
            "brand_id": brand_ids["BR-BIL"],
            "unit_id": unit_ids["U"],
            "purchase_price": 19000.0,
            "sale_price": 28000.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "IND-D440-IP68",
            "designation": "Indicateur Numérique Dini Argeo DFWLK IP68 Inox",
            "description": "Indicateur de poids étanche rétroéclairé avec port RS232 et sortie relais de dosage.",
            "category_id": cat_ids["CAT-PB"],
            "product_type_id": type_ids["TYP-COMP"],
            "brand_id": brand_ids["BR-DINI"],
            "unit_id": unit_ids["U"],
            "purchase_price": 4200.0,
            "sale_price": 6800.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "IND-TOUCH-WIN",
            "designation": "Terminal Tactile Industriel Pesage 2000 Pro (15 pouces)",
            "description": "PC tactile industriel tout-en-un Windows 11 avec logiciel de gestion des pesées et gestion de barrières.",
            "category_id": cat_ids["CAT-PB"],
            "product_type_id": type_ids["TYP-PL"],
            "brand_id": brand_ids["BR-P2000"],
            "unit_id": unit_ids["U"],
            "purchase_price": 9500.0,
            "sale_price": 15000.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "CAPT-HBM-20T",
            "designation": "Capteur de Compression HBM C16i 20T C3",
            "description": "Capteur numérique en acier inoxydable soudé hermétiquement IP68/IP69K avec protection foudre intégrée.",
            "category_id": cat_ids["CAT-CAPT"],
            "product_type_id": type_ids["TYP-COMP"],
            "brand_id": brand_ids["BR-HBM"],
            "unit_id": unit_ids["U"],
            "purchase_price": 3100.0,
            "sale_price": 4800.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "CAPT-VISH-30T",
            "designation": "Capteur Compression Numérique Vishay Nobel 30T",
            "description": "Capteur de pesage pour pont-bascule classe C3 avec calibration automatique et diagnostic de cellule.",
            "category_id": cat_ids["CAT-CAPT"],
            "product_type_id": type_ids["TYP-COMP"],
            "brand_id": brand_ids["BR-VISH"],
            "unit_id": unit_ids["U"],
            "purchase_price": 3900.0,
            "sale_price": 5900.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "CAPT-SHEAR-2T",
            "designation": "Capteur Cisaillement 2T Acier Nickelé IP67",
            "description": "Peson de flexion pour balances plateformes industrielles et trémies de pesage.",
            "category_id": cat_ids["CAT-CAPT"],
            "product_type_id": type_ids["TYP-COMP"],
            "brand_id": brand_ids["BR-DINI"],
            "unit_id": unit_ids["U"],
            "purchase_price": 1400.0,
            "sale_price": 2300.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "BOX-JB-4V",
            "designation": "Boîte de Raccordement 4 Voies Étanche IP67",
            "description": "Boîtier ABS étanche avec potentiomètres de réglage d'angle de haute précision pour 4 capteurs.",
            "category_id": cat_ids["CAT-CAPT"],
            "product_type_id": type_ids["TYP-COMP"],
            "brand_id": brand_ids["BR-P2000"],
            "unit_id": unit_ids["U"],
            "purchase_price": 650.0,
            "sale_price": 1100.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "BOX-JB-8V",
            "designation": "Boîte de Raccordement 8 Voies Inox avec Parafoudre",
            "description": "Boîtier inox étanche IP68 intégrant cartouche parafoudre parafoudre pour 6 à 8 capteurs de pont-bascule.",
            "category_id": cat_ids["CAT-CAPT"],
            "product_type_id": type_ids["TYP-COMP"],
            "brand_id": brand_ids["BR-P2000"],
            "unit_id": unit_ids["U"],
            "purchase_price": 1200.0,
            "sale_price": 1950.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "AFF-LED-100",
            "designation": "Afficheur Répétiteur Géant LED 100mm Extérieur",
            "description": "Panneau d'affichage dynamique ultra-haute luminosité visible jusqu'à 60 mètres pour chauffeurs de poids lourds.",
            "category_id": cat_ids["CAT-ACC"],
            "product_type_id": type_ids["TYP-PERIPH"],
            "brand_id": brand_ids["BR-DINI"],
            "unit_id": unit_ids["U"],
            "purchase_price": 3800.0,
            "sale_price": 5900.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "IMP-TH-80",
            "designation": "Imprimante Ticket Thermique Industrielle 80mm",
            "description": "Imprimante pour tickets de pesée avec massicot automatique, port série RS232 et Ethernet.",
            "category_id": cat_ids["CAT-ACC"],
            "product_type_id": type_ids["TYP-PERIPH"],
            "brand_id": brand_ids["BR-P2000"],
            "unit_id": unit_ids["U"],
            "purchase_price": 1800.0,
            "sale_price": 2900.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "CAB-BLIND-6C",
            "designation": "Câble Blindé LiYCY 6x0.5mm² Haute Immunité (100m)",
            "description": "Couronne de 100 mètres de câble blindé spécial pesage résistant aux hydrocarbures et aux rongeurs.",
            "category_id": cat_ids["CAT-ACC"],
            "product_type_id": type_ids["TYP-COMP"],
            "brand_id": brand_ids["BR-P2000"],
            "unit_id": unit_ids["m"],
            "purchase_price": 1200.0,
            "sale_price": 1900.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "KIT-PARAF-PRO",
            "designation": "Kit Parafoudre Haute Énergie pour Pont-Bascule",
            "description": "Protection contre les surtensions transitoires atmosphériques pour alimentation 230V et boucles signaux.",
            "category_id": cat_ids["CAT-ACC"],
            "product_type_id": type_ids["TYP-COMP"],
            "brand_id": brand_ids["BR-P2000"],
            "unit_id": unit_ids["U"],
            "purchase_price": 2500.0,
            "sale_price": 3900.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "MASS-ETAL-20K",
            "designation": "Poids Étalon Fonte Classe M1 20kg",
            "description": "Masse étalon parallélépipédique en fonte peinte avec cavité d'ajustage pour étalonnage des balances.",
            "category_id": cat_ids["CAT-ACC"],
            "product_type_id": type_ids["TYP-COMP"],
            "brand_id": brand_ids["BR-P2000"],
            "unit_id": unit_ids["U"],
            "purchase_price": 900.0,
            "sale_price": 1450.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        {
            "sku": "SERV-ETAL-PB",
            "designation": "Forfait Étalonnage & Vérification Périodique Pont-Bascule",
            "description": "Intervention métrologique complète avec camion étalon équipé de 40 tonnes de masses certifiées et délivrance du certificat.",
            "category_id": cat_ids["CAT-SERV"],
            "product_type_id": type_ids["TYP-SERV"],
            "brand_id": brand_ids["BR-P2000"],
            "unit_id": unit_ids["FF"],
            "purchase_price": 0.0,
            "sale_price": 7500.0,
            "tax_rate": 20.0,
            "track_stock": False,
        },
        {
            "sku": "SERV-MAINT-AN",
            "designation": "Contrat Annuel de Maintenance Préventive Pont-Bascule",
            "description": "Comprend 2 visites préventives annuelles, nettoyage des fosses, contrôle des capteurs, réglage d'angles et assistance prioritaire.",
            "category_id": cat_ids["CAT-SERV"],
            "product_type_id": type_ids["TYP-SERV"],
            "brand_id": brand_ids["BR-P2000"],
            "unit_id": unit_ids["FF"],
            "purchase_price": 0.0,
            "sale_price": 15000.0,
            "tax_rate": 20.0,
            "track_stock": False,
        },
        {
            "sku": "SERV-INSTALL",
            "designation": "Forfait Montage, Raccordement & Mise en Service",
            "description": "Installation mécanique, pose des capteurs, câblage, paramétrage de l'indicateur et formation des opérateurs sur site.",
            "category_id": cat_ids["CAT-SERV"],
            "product_type_id": type_ids["TYP-SERV"],
            "brand_id": brand_ids["BR-P2000"],
            "unit_id": unit_ids["FF"],
            "purchase_price": 0.0,
            "sale_price": 18000.0,
            "tax_rate": 20.0,
            "track_stock": False,
        },
    ]

    prod_map = {}
    for p in products_data:
        r = session.post(f"{BASE_URL}/products", json=p)
        if r.status_code in (200, 201):
            prod_map[p["sku"]] = r.json()["id"]
            log(f"Created Product: {p['sku']} - {p['designation']}")
        else:
            r_list = session.get(f"{BASE_URL}/products?search={p['sku']}")
            for item in r_list.json():
                if item["sku"] == p["sku"]:
                    prod_map[p["sku"]] = item["id"]
                    log(f"Found existing Product: {p['sku']} (ID: {item['id']})")
    return prod_map

def seed_warehouses():
    log("--- Seeding Warehouses ---")
    wh_data = [
        {"name": "Dépôt Principal Tanger", "code": "DEP-TNG", "type": "MAIN", "address": "Zone Industrielle Gzenaya, Tanger", "description": "Entrepôt central et stockage des ponts-bascules"},
        {"name": "Dépôt Régional Casablanca", "code": "DEP-CAS", "type": "WAREHOUSE", "address": "Route d'El Jadida, Lissasfa, Casablanca", "description": "Plateforme logistique et distribution région Centre"},
        {"name": "Dépôt Régional Rabat", "code": "DEP-RBT", "type": "WAREHOUSE", "address": "Zone Industrielle Takaddoum, Rabat", "description": "Stock tampon et matériel d'exposition"},
        {"name": "Atelier SAV & Métrologie Tanger", "code": "ATEL-TNG", "type": "WORKSHOP", "address": "Zone Industrielle Moghogha, Tanger", "description": "Atelier de calibration et réparation des capteurs"},
    ]
    wh_map = {}
    for wh in wh_data:
        r = session.post(f"{BASE_URL}/warehouses", json=wh)
        if r.status_code in (200, 201):
            wh_map[wh["code"]] = r.json()["id"]
            log(f"Created Warehouse: {wh['name']} (ID: {r.json()['id']})")
        else:
            r_list = session.get(f"{BASE_URL}/warehouses")
            for item in r_list.json():
                if item["code"] == wh["code"]:
                    wh_map[wh["code"]] = item["id"]
                    log(f"Found existing Warehouse: {wh['name']} (ID: {item['id']})")
    return wh_map

def seed_partners():
    log("--- Seeding Partners (Customers & Suppliers) ---")
    customers = [
        {
            "legal_name": "Atlas BTP Maroc SA",
            "trade_name": "Atlas BTP",
            "partner_type": "CUSTOMER",
            "ice": "001894523000045",
            "tax_id": "34567891",
            "phone": "+212 5 22 45 67 89",
            "email": "contact@atlasbtp.ma",
            "address": "Boulevard Abdelmoumen, Casablanca",
            "city": "Casablanca",
            "notes": "Leader des grands chantiers autoroutiers et terrassement",
        },
        {
            "legal_name": "Société Industrielle du Nord SARL",
            "trade_name": "S.I.N. Tanger",
            "partner_type": "CUSTOMER",
            "ice": "002145879000012",
            "tax_id": "45678912",
            "phone": "+212 5 39 34 56 78",
            "email": "achats@sin-maroc.com",
            "address": "Zone Franche d'Exportation, Tanger",
            "city": "Tanger",
            "notes": "Usine de transformation métallurgique et export",
        },
        {
            "legal_name": "TransLog Maroc Logistique SA",
            "trade_name": "TransLog Med",
            "partner_type": "CUSTOMER",
            "ice": "001987654000033",
            "tax_id": "23456789",
            "phone": "+212 5 39 93 12 34",
            "email": "logistique@translog.ma",
            "address": "Zone Logistique Tanger Med, Ksar Sghir",
            "city": "Tanger",
            "notes": "Hub logistique portuaire international",
        },
        {
            "legal_name": "Carrières & Granulats du Rif SARL",
            "trade_name": "Carrières du Rif",
            "partner_type": "CUSTOMER",
            "ice": "002345678000088",
            "tax_id": "56789123",
            "phone": "+212 5 39 70 88 99",
            "email": "direction@carrieresrif.ma",
            "address": "Route Nationale 2, Tétouan",
            "city": "Tétouan",
            "notes": "Extraction de roche massive et concassage",
        },
        {
            "legal_name": "Société Sucrière & Agroalimentaire Tadla",
            "trade_name": "Sucrerie Tadla",
            "partner_type": "CUSTOMER",
            "ice": "001456789000021",
            "tax_id": "12345678",
            "phone": "+212 5 23 48 55 66",
            "email": "appro@sucredutadla.ma",
            "address": "Zone Industrielle Ouled Ayad, Béni Mellal",
            "city": "Béni Mellal",
            "notes": "Pesage continu des récoltes de betteraves",
        },
        {
            "legal_name": "Ciments & Matériaux de l'Atlas SA",
            "trade_name": "Cimat",
            "partner_type": "CUSTOMER",
            "ice": "001678912000066",
            "tax_id": "67891234",
            "phone": "+212 5 22 98 77 00",
            "email": "projets@cimat.ma",
            "address": "Twin Center, Tour Ouest, Casablanca",
            "city": "Casablanca",
            "notes": "Cimenterie et stations de broyage",
        },
        {
            "legal_name": "AgriMaroc Primeurs Distribution SARL",
            "trade_name": "AgriMaroc Souss",
            "partner_type": "CUSTOMER",
            "ice": "002987654000099",
            "tax_id": "78912345",
            "phone": "+212 5 28 84 11 22",
            "email": "station@agrimaroc.ma",
            "address": "Zone Industrielle Tassila, Agadir",
            "city": "Agadir",
            "notes": "Station d'emballage d'agrumes et tomates",
        },
    ]

    suppliers = [
        {
            "legal_name": "Pesage Equipements Industrie Europe SAS",
            "trade_name": "Pesage Europe",
            "partner_type": "SUPPLIER",
            "ice": "009988776000011",
            "tax_id": "99887766",
            "phone": "+33 1 45 67 89 00",
            "email": "export@pesage-europe.fr",
            "address": "15 Avenue des Usines, Lyon, France",
            "city": "Lyon",
            "notes": "Fournisseur principal de tabliers de ponts-bascules",
        },
        {
            "legal_name": "Capteurs & Composants Maroc SARL",
            "trade_name": "Capteurs Maroc",
            "partner_type": "SUPPLIER",
            "ice": "001122334000055",
            "tax_id": "11223344",
            "phone": "+212 5 22 33 44 55",
            "email": "ventes@capteursmaroc.com",
            "address": "Zone Industrielle Ain Sebaa, Casablanca",
            "city": "Casablanca",
            "notes": "Distributeur officiel cellules de charge HBM et Vishay",
        },
        {
            "legal_name": "Dini Argeo Maroc Distribution",
            "trade_name": "Dini Argeo Maroc",
            "partner_type": "SUPPLIER",
            "ice": "005566778000022",
            "tax_id": "55667788",
            "phone": "+212 5 22 66 77 88",
            "email": "maroc@diniargeo.com",
            "address": "Sidi Maarouf, Casablanca",
            "city": "Casablanca",
            "notes": "Indicateurs électroniques et balances étanches",
        },
        {
            "legal_name": "Métallurgie & Châssis du Nord SARL",
            "trade_name": "Châssis Nord",
            "partner_type": "SUPPLIER",
            "ice": "003344556000077",
            "tax_id": "33445566",
            "phone": "+212 5 39 40 50 60",
            "email": "contact@chassisnord.ma",
            "address": "Zone Industrielle Tanger Automohile City, Tanger",
            "city": "Tanger",
            "notes": "Tôlerie lourde, rampes d'accès et garde-corps",
        },
        {
            "legal_name": "Fournitures Industrielles & Câbles du Maroc",
            "trade_name": "FIC Maroc",
            "partner_type": "SUPPLIER",
            "ice": "007788990000044",
            "tax_id": "77889900",
            "phone": "+212 5 37 77 88 99",
            "email": "commandes@ficmaroc.ma",
            "address": "Avenue Hassan II, Rabat",
            "city": "Rabat",
            "notes": "Câblage blindé, gaines et boîtiers de raccordement",
        },
    ]

    partner_map = {"customers": {}, "suppliers": {}}
    for c in customers:
        r = session.post(f"{BASE_URL}/partners", json=c)
        if r.status_code in (200, 201):
            partner_map["customers"][c["trade_name"]] = r.json()["id"]
            log(f"Created Customer: {c['trade_name']} (Code: {r.json().get('code')})")
        else:
            r_list = session.get(f"{BASE_URL}/partners?partner_type=CUSTOMER&search={c['trade_name']}")
            for item in r_list.json():
                if item["legal_name"] == c["legal_name"]:
                    partner_map["customers"][c["trade_name"]] = item["id"]

    for s in suppliers:
        r = session.post(f"{BASE_URL}/partners", json=s)
        if r.status_code in (200, 201):
            partner_map["suppliers"][s["trade_name"]] = r.json()["id"]
            log(f"Created Supplier: {s['trade_name']} (Code: {r.json().get('code')})")
        else:
            r_list = session.get(f"{BASE_URL}/partners?partner_type=SUPPLIER&search={s['trade_name']}")
            for item in r_list.json():
                if item["legal_name"] == s["legal_name"]:
                    partner_map["suppliers"][s["trade_name"]] = item["id"]

    return partner_map

def seed_employees_and_fleet(wh_map):
    log("--- Seeding Employees & Fleet ---")
    employees = [
        {"first_name": "Karim", "last_name": "Bennani", "phone": "+212 6 61 23 45 67", "email": "karim.bennani@pesage2000.ma", "job_title": "Responsable Commercial", "department": "Commerce", "hire_date": "2023-01-15T09:00:00Z"},
        {"first_name": "Fatima", "last_name": "Zahra", "phone": "+212 6 62 34 56 78", "email": "fatima.zahra@pesage2000.ma", "job_title": "Responsable Comptable", "department": "Finance", "hire_date": "2023-03-01T09:00:00Z"},
        {"first_name": "Omar", "last_name": "Idrissi", "phone": "+212 6 63 45 67 89", "email": "omar.idrissi@pesage2000.ma", "job_title": "Chef d'Atelier & Métrologue", "department": "Technique", "hire_date": "2022-06-10T09:00:00Z"},
        {"first_name": "Youssef", "last_name": "El Mansouri", "phone": "+212 6 65 11 22 33", "email": "youssef.mansouri@pesage2000.ma", "job_title": "Technicien de Maintenance Itinérant", "department": "Technique", "hire_date": "2024-02-01T09:00:00Z"},
        {"first_name": "Mohammed", "last_name": "Berrada", "phone": "+212 6 66 44 55 66", "email": "mohammed.berrada@pesage2000.ma", "job_title": "Chauffeur Poids Lourd Étalonnage", "department": "Logistique", "hire_date": "2022-11-01T09:00:00Z"},
    ]

    emp_map = {}
    for emp in employees:
        r = session.post(f"{BASE_URL}/employees", json=emp)
        if r.status_code in (200, 201):
            emp_map[f"{emp['first_name']} {emp['last_name']}"] = r.json()["id"]
            log(f"Created Employee: {emp['first_name']} {emp['last_name']} (ID: {r.json()['id']})")
        else:
            r_list = session.get(f"{BASE_URL}/employees?search={emp['last_name']}")
            data = r_list.json()
            items = data.get("items", data) if isinstance(data, dict) else data
            for item in items:
                if item["last_name"] == emp["last_name"]:
                    emp_map[f"{emp['first_name']} {emp['last_name']}"] = item["id"]

    # Vehicles
    vehicles = [
        {
            "registration_number": "45892-A-40",
            "brand": "Renault",
            "model": "Master Fourgon L3H2",
            "vehicle_type": "Utilitaire Atelier",
            "year": 2023,
            "current_mileage": 48500.0,
            "fuel_type": "DIESEL",
            "fuel_capacity": 80.0,
            "status": "ACTIVE",
            "default_driver_id": emp_map.get("Youssef El Mansouri"),
            "notes": "Véhicule d'intervention rapide équipé outillage électromécanique",
        },
        {
            "registration_number": "12456-B-40",
            "brand": "Dacia",
            "model": "Dokker Van",
            "vehicle_type": "Commercial / Service",
            "year": 2022,
            "current_mileage": 74200.0,
            "fuel_type": "DIESEL",
            "fuel_capacity": 50.0,
            "status": "ACTIVE",
            "default_driver_id": emp_map.get("Karim Bennani"),
            "notes": "Véhicule commercial pour visites clients et petits dépannages",
        },
        {
            "registration_number": "78912-A-40",
            "brand": "Isuzu",
            "model": "F-Series FVR 34P Plateau Grue",
            "vehicle_type": "Camion Étalon Poids Lourd",
            "year": 2021,
            "current_mileage": 115000.0,
            "fuel_type": "DIESEL",
            "fuel_capacity": 200.0,
            "status": "ACTIVE",
            "default_driver_id": emp_map.get("Mohammed Berrada"),
            "notes": "Camion étalon équipé de grue Palfinger et 40T de masses M1",
        },
    ]

    veh_map = {}
    for v in vehicles:
        r = session.post(f"{BASE_URL}/vehicles", json=v)
        if r.status_code in (200, 201):
            veh_map[v["registration_number"]] = r.json()["id"]
            log(f"Created Vehicle: {v['brand']} {v['model']} ({v['registration_number']})")
        else:
            r_list = session.get(f"{BASE_URL}/vehicles")
            for item in r_list.json():
                if item["registration_number"] == v["registration_number"]:
                    veh_map[v["registration_number"]] = item["id"]

    # Maintenance operations
    if "45892-A-40" in veh_map:
        session.post(f"{BASE_URL}/maintenance", json={
            "vehicle_id": veh_map["45892-A-40"],
            "maintenance_date": "2026-04-12T10:00:00Z",
            "mileage": 42000.0,
            "maintenance_type": "OIL_CHANGE",
            "description": "Vidange complète 10W40, filtre à huile, filtre à gazole et filtre d'habitacle",
            "supplier": "Garage Rapide Auto Tanger",
            "labor_cost": 450.0,
            "parts_cost": 1400.0,
            "notes": "Contrôle visuel des amortisseurs RAS",
        })
    if "78912-A-40" in veh_map:
        session.post(f"{BASE_URL}/maintenance", json={
            "vehicle_id": veh_map["78912-A-40"],
            "maintenance_date": "2026-06-20T14:00:00Z",
            "mileage": 110000.0,
            "maintenance_type": "BRAKE_SYSTEM",
            "description": "Remplacement garnitures de freins essieu arrière et révision circuit pneumatique",
            "supplier": "Atelier Poids Lourds du Détroit",
            "labor_cost": 1200.0,
            "parts_cost": 2400.0,
            "notes": "Plaquettes homologuées constructeur Isuzu",
        })

    # Fuel logs
    if "45892-A-40" in veh_map:
        session.post(f"{BASE_URL}/fuel", json={
            "vehicle_id": veh_map["45892-A-40"],
            "date": "2026-08-05T08:30:00Z",
            "mileage": 46200.0,
            "liters": 65.0,
            "price_per_liter": 12.85,
            "station": "Station Afriquia Gzenaya Tanger",
            "driver_id": emp_map.get("Youssef El Mansouri"),
            "notes": "Plein gazole 50 pour tournée Casa",
        })
    if "78912-A-40" in veh_map:
        session.post(f"{BASE_URL}/fuel", json={
            "vehicle_id": veh_map["78912-A-40"],
            "date": "2026-08-18T09:15:00Z",
            "mileage": 113500.0,
            "liters": 140.0,
            "price_per_liter": 12.90,
            "station": "Station Total Tanger Med",
            "driver_id": emp_map.get("Mohammed Berrada"),
            "notes": "Plein avant mission étalonnage carrières",
        })

    return emp_map, veh_map

def seed_expenses():
    log("--- Seeding Expenses & Recurring Expenses ---")
    r_list = session.get(f"{BASE_URL}/expenses/categories")
    all_cats = {item["code"]: item["id"] for item in r_list.json()}

    cat_loyer = all_cats.get("EXP-LOYER", all_cats.get("LOYER", 1))
    cat_energie = all_cats.get("EXP-ENERGIE", all_cats.get("ELEC", 4))
    cat_telecom = all_cats.get("EXP-TELECOM", all_cats.get("INTERNET", 2))
    cat_transport = all_cats.get("EXP-TRANSPORT", all_cats.get("TRANSP", 9))
    cat_fourn = all_cats.get("EXP-FOURN", all_cats.get("FOURN", 8))
    cat_assur = all_cats.get("EXP-ASSUR", all_cats.get("ASSUR", 12))

    # Recurring Expenses
    rec_expenses = [
        {
            "category_id": cat_loyer,
            "label": "Loyer Dépôt Central & Siège Tanger",
            "amount": 14000.0,
            "frequency": "MONTHLY",
            "start_date": "2025-01-01T00:00:00Z",
            "day_of_month": 1,
            "payment_method": "Virement bancaire",
            "notes": "Virement permanent au bailleur Société Immobilière Détroit",
        },
        {
            "category_id": cat_loyer,
            "label": "Loyer Dépôt Régional Casablanca",
            "amount": 9500.0,
            "frequency": "MONTHLY",
            "start_date": "2025-01-01T00:00:00Z",
            "day_of_month": 5,
            "payment_method": "Virement bancaire",
            "notes": "Loyer plateforme Lissasfa",
        },
        {
            "category_id": cat_telecom,
            "label": "Abonnement Fibre Optique Entreprise & Flotte Mobile",
            "amount": 1850.0,
            "frequency": "MONTHLY",
            "start_date": "2025-01-01T00:00:00Z",
            "day_of_month": 10,
            "payment_method": "Prélèvement automatique",
            "notes": "Maroc Telecom Pro",
        },
    ]

    for rec in rec_expenses:
        r = session.post(f"{BASE_URL}/expenses/recurring", json=rec)
        if r.status_code in (200, 201):
            log(f"Created Recurring Expense: {rec['label']} ({rec['amount']} DH)")

    # Trigger generation of recurring expenses
    res_gen = session.post(f"{BASE_URL}/expenses/generate-recurring")
    log(f"Generated recurring expenses: {res_gen.status_code}")

    # Diverse one-off expenses spanning 2025 and 2026
    expenses_list = [
        {"expense_date": "2025-07-15T11:00:00Z", "category_id": cat_energie, "label": "Facture Électricité AMENDIS Tanger Atelier", "amount": 2850.0, "payment_method": "Virement bancaire", "supplier_payee": "AMENDIS Tanger", "status": "PAID", "notes": "Climatisation atelier et compresseurs"},
        {"expense_date": "2025-07-28T16:00:00Z", "category_id": cat_fourn, "label": "Fournitures de bureau et cartouches d'encre", "amount": 1250.0, "payment_method": "Carte bancaire", "supplier_payee": "Papeterie du Nord", "status": "PAID", "notes": "Facture semestrielle"},
        {"expense_date": "2025-11-20T10:00:00Z", "category_id": cat_transport, "label": "Recharge Cartes Autoroutes du Maroc (JAWAZ)", "amount": 3000.0, "payment_method": "Virement bancaire", "supplier_payee": "ADM Maroc", "status": "PAID", "notes": "Péages flotte 3 véhicules"},
        {"expense_date": "2026-01-10T14:00:00Z", "category_id": cat_assur, "label": "Police d'Assurance Flotte Automobile & RC Pro", "amount": 18500.0, "payment_method": "Chèque", "supplier_payee": "RMA Assurance", "status": "PAID", "notes": "Prime annuelle tous risques 2026"},
        {"expense_date": "2026-03-05T09:30:00Z", "category_id": cat_fourn, "label": "Achat outillage métrologique et clés dynamométriques", "amount": 4200.0, "payment_method": "Virement bancaire", "supplier_payee": "Outillage Industriel Maroc", "status": "PAID", "notes": "Serrage contrôlé capteurs C16"},
        {"expense_date": "2026-05-18T15:00:00Z", "category_id": cat_energie, "label": "Facture Eau & Électricité Lydec Dépôt Casa", "amount": 1640.0, "payment_method": "Virement bancaire", "supplier_payee": "Lydec Casablanca", "status": "PAID", "notes": "Consommation bimestrielle"},
        {"expense_date": "2026-08-10T11:20:00Z", "category_id": cat_transport, "label": "Frais de déplacement et hébergement techniciens chantier", "amount": 3800.0, "payment_method": "Espèces", "supplier_payee": "Hôtel Ibis Agadir", "status": "PAID", "notes": "Chantier installation pont-bascule Souss"},
    ]

    for exp in expenses_list:
        r = session.post(f"{BASE_URL}/expenses", json=exp)
        if r.status_code in (200, 201):
            log(f"Created Expense: {exp['label']} ({exp['amount']} DH)")
        else:
            log(f"Expense creation returned {r.status_code}: {r.text}")

def execute_purchases_and_stock(prod_map, wh_map, partner_map):
    log("--- Executing Purchases & Stock Workflow ---")
    sup_pe = partner_map["suppliers"]["Pesage Europe"]
    sup_dini = partner_map["suppliers"]["Dini Argeo Maroc"]
    sup_cap = partner_map["suppliers"]["Capteurs Maroc"]

    wh_tng = wh_map["DEP-TNG"]
    wh_cas = wh_map["DEP-CAS"]

    # 1. Purchase Order 1 (November 2025) -> Received into Dépôt Tanger -> Invoiced -> Paid
    po1_data = {
        "supplier_id": sup_pe,
        "order_date": "2025-11-10T10:00:00Z",
        "expected_delivery_date": "2025-11-25T10:00:00Z",
        "notes": "Approvisionnement initial tabliers ponts-bascules, indicateurs et afficheurs",
        "items": [
            {"product_id": prod_map["PB-60T-MET"], "quantity_ordered": 3.0, "unit_price_ht": 180000.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["PB-80T-BET"], "quantity_ordered": 2.0, "unit_price_ht": 220000.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["IND-D440-IP68"], "quantity_ordered": 10.0, "unit_price_ht": 4200.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["IND-TOUCH-WIN"], "quantity_ordered": 5.0, "unit_price_ht": 9500.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["AFF-LED-100"], "quantity_ordered": 6.0, "unit_price_ht": 3800.0, "tax_rate": 20.0, "discount_rate": 0.0},
        ],
    }
    r_po1 = session.post(f"{BASE_URL}/purchases", json=po1_data)
    if r_po1.status_code in (200, 201):
        po1 = r_po1.json()
        po1_id = po1["id"]
        log(f"Created Purchase Order 1 (ID: {po1_id}, Ref: {po1['reference']}, TTC: {po1['total_ttc']} DH)")
        # Approve PO
        session.post(f"{BASE_URL}/purchases/{po1_id}/approve")
        # Confirm Receipt into Dépôt Tanger
        r_rec1 = session.post(f"{BASE_URL}/purchase-receipts", json={
            "purchase_order_id": po1_id,
            "warehouse_id": wh_tng,
            "receipt_date": "2025-11-26T14:00:00Z",
            "notes": "Réception conforme au Dépôt Tanger",
            "items": [
                {
                    "purchase_order_item_id": item["id"],
                    "product_id": item["product_id"],
                    "quantity_received": float(item["quantity_ordered"]),
                    "warehouse_id": wh_tng,
                }
                for item in po1["items"]
            ],
        })
        log(f"Confirmed Purchase Receipt 1: Status {r_rec1.status_code}")
        # Create Supplier Invoice via from-purchase
        r_inv1 = session.post(f"{BASE_URL}/invoices/from-purchase", json={
            "purchase_order_id": po1_id,
            "invoice_date": "2025-11-28T10:00:00Z",
            "due_date": "2025-12-28T10:00:00Z",
            "payment_terms": "Virement à 30 jours",
            "payment_method": "Virement bancaire",
            "notes": "Facture fournisseur Pesage Europe",
        })
        log(f"Invoice from purchase 1 response: {r_inv1.status_code} {r_inv1.text[:200] if r_inv1.text else ''}")
        if r_inv1.status_code in (200, 201):
            inv1 = r_inv1.json()
            inv1_id = inv1["id"]
            log(f"Created Supplier Invoice 1 (ID: {inv1_id}, TTC: {inv1['total_ttc']} DH)")
            # Full payment by bank transfer
            session.post(f"{BASE_URL}/payments", json={
                "invoice_id": inv1_id,
                "amount": inv1["total_ttc"],
                "payment_date": "2025-12-20T11:00:00Z",
                "payment_method": "Virement bancaire",
                "reference": "VIR-SGMB-2025-9988",
                "notes": "Règlement intégral facture Pesage Europe",
            })
            log("Supplier Invoice 1 fully paid.")
    else:
        log(f"Failed PO1: {r_po1.status_code} {r_po1.text}")

    # 2. Purchase Order 2 (February 2026) -> Balances into Dépôt Casablanca -> Invoiced -> Partial Paid
    po2_data = {
        "supplier_id": sup_dini,
        "order_date": "2026-02-05T10:00:00Z",
        "expected_delivery_date": "2026-02-18T10:00:00Z",
        "notes": "Stock balances industrielles et plateformes Dépôt Casa",
        "items": [
            {"product_id": prod_map["BAL-IND-300"], "quantity_ordered": 12.0, "unit_price_ht": 8500.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["BAL-IND-600"], "quantity_ordered": 8.0, "unit_price_ht": 11000.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["BAL-PLT-1500"], "quantity_ordered": 6.0, "unit_price_ht": 14000.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["BAL-PLT-3000"], "quantity_ordered": 4.0, "unit_price_ht": 19000.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["AFF-LED-100"], "quantity_ordered": 8.0, "unit_price_ht": 3800.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["IMP-TH-80"], "quantity_ordered": 10.0, "unit_price_ht": 1800.0, "tax_rate": 20.0, "discount_rate": 0.0},
        ],
    }
    r_po2 = session.post(f"{BASE_URL}/purchases", json=po2_data)
    if r_po2.status_code in (200, 201):
        po2 = r_po2.json()
        po2_id = po2["id"]
        session.post(f"{BASE_URL}/purchases/{po2_id}/approve")
        # Receipt in Casa
        session.post(f"{BASE_URL}/purchase-receipts", json={
            "purchase_order_id": po2_id,
            "warehouse_id": wh_cas,
            "receipt_date": "2026-02-20T15:00:00Z",
            "notes": "Réception plateforme Casablanca",
            "items": [
                {
                    "purchase_order_item_id": item["id"],
                    "product_id": item["product_id"],
                    "quantity_received": float(item["quantity_ordered"]),
                    "warehouse_id": wh_cas,
                }
                for item in po2["items"]
            ],
        })
        log(f"Confirmed Purchase Receipt 2 in Casablanca")
        # Supplier Invoice 2 via from-purchase
        r_inv2 = session.post(f"{BASE_URL}/invoices/from-purchase", json={
            "purchase_order_id": po2_id,
            "invoice_date": "2026-02-22T10:00:00Z",
            "due_date": "2026-03-22T10:00:00Z",
            "payment_terms": "Chèque à 30 jours",
            "payment_method": "Chèque",
            "notes": "Facture fournisseur Dini Argeo",
        })
        if r_inv2.status_code in (200, 201):
            inv2 = r_inv2.json()
            inv2_id = inv2["id"]
            # Partial payment
            session.post(f"{BASE_URL}/payments", json={
                "invoice_id": inv2_id,
                "amount": 200000.0,
                "payment_date": "2026-03-10T10:00:00Z",
                "payment_method": "Chèque",
                "reference": "CHQ-ATTIJARI-445566",
                "notes": "Acompte 200 000 DH sur facture Dini Argeo",
            })
            log("Supplier Invoice 2 partially paid (200 000 DH).")
    else:
        log(f"Failed PO2: {r_po2.status_code} {r_po2.text}")

    # 3. Purchase Order 3 (August 2026) -> Capteurs into Dépôt Tanger
    po3_data = {
        "supplier_id": sup_cap,
        "order_date": "2026-08-01T10:00:00Z",
        "expected_delivery_date": "2026-08-15T10:00:00Z",
        "notes": "Capteurs HBM, Vishay et boîtes de jonction",
        "items": [
            {"product_id": prod_map["CAPT-HBM-20T"], "quantity_ordered": 30.0, "unit_price_ht": 3100.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["CAPT-VISH-30T"], "quantity_ordered": 25.0, "unit_price_ht": 3900.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["CAPT-SHEAR-2T"], "quantity_ordered": 20.0, "unit_price_ht": 1400.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["BOX-JB-4V"], "quantity_ordered": 15.0, "unit_price_ht": 650.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["BOX-JB-8V"], "quantity_ordered": 12.0, "unit_price_ht": 1200.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["CAB-BLIND-6C"], "quantity_ordered": 10.0, "unit_price_ht": 1200.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["KIT-PARAF-PRO"], "quantity_ordered": 8.0, "unit_price_ht": 2500.0, "tax_rate": 20.0, "discount_rate": 0.0},
        ],
    }
    r_po3 = session.post(f"{BASE_URL}/purchases", json=po3_data)
    if r_po3.status_code in (200, 201):
        po3 = r_po3.json()
        po3_id = po3["id"]
        session.post(f"{BASE_URL}/purchases/{po3_id}/approve")
        session.post(f"{BASE_URL}/purchase-receipts", json={
            "purchase_order_id": po3_id,
            "warehouse_id": wh_tng,
            "receipt_date": "2026-08-16T11:00:00Z",
            "notes": "Réception Dépôt Tanger",
            "items": [
                {
                    "purchase_order_item_id": item["id"],
                    "product_id": item["product_id"],
                    "quantity_received": float(item["quantity_ordered"]),
                    "warehouse_id": wh_tng,
                }
                for item in po3["items"]
            ],
        })
        log(f"Confirmed Purchase Receipt 3 in Tanger")
    else:
        log(f"Failed PO3: {r_po3.status_code} {r_po3.text}")

def execute_sales_and_deliveries(prod_map, wh_map, partner_map):
    log("--- Executing Sales, Deliveries, Invoices & Payments ---")
    cust_atlas = partner_map["customers"]["Atlas BTP"]
    cust_sin = partner_map["customers"]["S.I.N. Tanger"]
    cust_cimat = partner_map["customers"]["Cimat"]
    cust_trans = partner_map["customers"]["TransLog Med"]
    cust_rif = partner_map["customers"]["Carrières du Rif"]

    wh_tng = wh_map["DEP-TNG"]
    wh_cas = wh_map["DEP-CAS"]

    # 1. Quote 1 -> Sale 1 (December 2025) to Atlas BTP -> Confirmed -> Delivered -> Invoiced -> Fully Paid
    q1_data = {
        "customer_id": cust_atlas,
        "quote_date": "2025-11-28T10:00:00Z",
        "validity_date": "2025-12-28T10:00:00Z",
        "notes": "Devis fourniture et installation pont-bascule 60T chantier autoroute",
        "items": [
            {"product_id": prod_map["PB-60T-MET"], "quantity": 1.0, "unit_price_ht": 240000.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["AFF-LED-100"], "quantity": 1.0, "unit_price_ht": 5900.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["SERV-INSTALL"], "quantity": 1.0, "unit_price_ht": 18000.0, "tax_rate": 20.0, "discount_rate": 0.0},
        ],
    }
    r_q1 = session.post(f"{BASE_URL}/quotes", json=q1_data)
    log(f"Created Quote 1: {r_q1.status_code}")

    sale1_data = {
        "customer_id": cust_atlas,
        "order_date": "2025-12-05T10:00:00Z",
        "notes": "Commande ferme pont-bascule Atlas BTP",
        "items": [
            {"product_id": prod_map["PB-60T-MET"], "warehouse_id": wh_tng, "quantity": 1.0, "unit_price_ht": 240000.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["AFF-LED-100"], "warehouse_id": wh_tng, "quantity": 1.0, "unit_price_ht": 5900.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["SERV-INSTALL"], "warehouse_id": None, "quantity": 1.0, "unit_price_ht": 18000.0, "tax_rate": 20.0, "discount_rate": 0.0},
        ],
    }
    r_s1 = session.post(f"{BASE_URL}/sales", json=sale1_data)
    if r_s1.status_code in (200, 201):
        s1 = r_s1.json()
        s1_id = s1["id"]
        # Confirm Sale (Deducts from Dépôt Tanger)
        session.post(f"{BASE_URL}/sales/{s1_id}/confirm")
        log(f"Confirmed Sale 1 (ID: {s1_id}, TTC: {s1['total_ttc']} DH)")
        # Delivery Note
        session.post(f"{BASE_URL}/delivery-notes", json={
            "sale_id": s1_id,
            "customer_id": cust_atlas,
            "delivery_date": "2025-12-15T10:00:00Z",
            "notes": "Livraison sur chantier Tit Mellil",
            "items": [
                {"product_id": prod_map["PB-60T-MET"], "warehouse_id": wh_tng, "delivered_quantity": 1.0},
                {"product_id": prod_map["AFF-LED-100"], "warehouse_id": wh_tng, "delivered_quantity": 1.0},
            ],
        })
        # Customer Invoice 1 via from-sale
        r_inv1 = session.post(f"{BASE_URL}/invoices/from-sale", json={
            "sale_id": s1_id,
            "invoice_date": "2025-12-18T10:00:00Z",
            "payment_terms": "30 jours",
            "payment_method": "Virement bancaire",
            "notes": "Facture Vente Atlas BTP",
        })
        if r_inv1.status_code in (200, 201):
            inv1 = r_inv1.json()
            inv1_id = inv1["id"]
            # Payment
            session.post(f"{BASE_URL}/payments", json={
                "invoice_id": inv1_id,
                "amount": inv1["total_ttc"],
                "payment_date": "2026-01-15T11:00:00Z",
                "payment_method": "Virement bancaire",
                "reference": "VIR-BMCE-2026-1144",
                "notes": "Règlement solde facture Atlas BTP",
            })
            log("Customer Invoice 1 fully paid.")
    else:
        log(f"Failed Sale 1: {r_s1.status_code} {r_s1.text}")

    # 2. Sale 2 (March 2026) to Société Industrielle du Nord -> From Casablanca Depot -> Invoiced -> Partial Paid -> Credit Note
    sale2_data = {
        "customer_id": cust_sin,
        "order_date": "2026-03-08T10:00:00Z",
        "notes": "Équipement atelier de pesage usine Tanger",
        "items": [
            {"product_id": prod_map["BAL-IND-300"], "warehouse_id": wh_cas, "quantity": 4.0, "unit_price_ht": 12900.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["BAL-PLT-1500"], "warehouse_id": wh_cas, "quantity": 2.0, "unit_price_ht": 21000.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["IND-D440-IP68"], "warehouse_id": wh_tng, "quantity": 2.0, "unit_price_ht": 6800.0, "tax_rate": 20.0, "discount_rate": 0.0},
        ],
    }
    r_s2 = session.post(f"{BASE_URL}/sales", json=sale2_data)
    if r_s2.status_code in (200, 201):
        s2 = r_s2.json()
        s2_id = s2["id"]
        session.post(f"{BASE_URL}/sales/{s2_id}/confirm")
        log(f"Confirmed Sale 2 (ID: {s2_id}, TTC: {s2['total_ttc']} DH)")
        # Delivery
        session.post(f"{BASE_URL}/delivery-notes", json={
            "sale_id": s2_id,
            "customer_id": cust_sin,
            "delivery_date": "2026-03-12T10:00:00Z",
            "notes": "Livraison usine S.I.N. Tanger",
            "items": [
                {"product_id": prod_map["BAL-IND-300"], "warehouse_id": wh_cas, "delivered_quantity": 4.0},
                {"product_id": prod_map["BAL-PLT-1500"], "warehouse_id": wh_cas, "delivered_quantity": 2.0},
                {"product_id": prod_map["IND-D440-IP68"], "warehouse_id": wh_tng, "delivered_quantity": 2.0},
            ],
        })
        # Customer Invoice 2 via from-sale
        r_inv2 = session.post(f"{BASE_URL}/invoices/from-sale", json={
            "sale_id": s2_id,
            "invoice_date": "2026-03-15T10:00:00Z",
            "payment_terms": "30 jours",
            "payment_method": "Chèque",
            "notes": "Facture S.I.N. Tanger",
        })
        if r_inv2.status_code in (200, 201):
            inv2 = r_inv2.json()
            inv2_id = inv2["id"]
            # Partial payment of 60 000 DH
            session.post(f"{BASE_URL}/payments", json={
                "invoice_id": inv2_id,
                "amount": 60000.0,
                "payment_date": "2026-03-25T10:00:00Z",
                "payment_method": "Chèque",
                "reference": "CHQ-CIH-889900",
                "notes": "Acompte 60 000 DH Société Industrielle du Nord",
            })
            log("Customer Invoice 2 partially paid.")
            # Credit note (Avoir): Return 1x BAL-IND-300 with return_to_stock=True
            r_cn = session.post(f"{BASE_URL}/credit-notes", json={
                "invoice_id": inv2_id,
                "reason": "RETURN",
                "credit_note_date": "2026-04-02T10:00:00Z",
                "notes": "Retour 1 balance inox 300kg suite modification cahier des charges client",
                "items": [
                    {
                        "product_id": prod_map["BAL-IND-300"],
                        "description": "Retour Balance Industrielle Inox 300kg",
                        "quantity": 1.0,
                        "unit_price_ht": 12900.0,
                        "tax_rate": 20.0,
                        "discount_rate": 0.0,
                        "return_to_stock": True,
                        "warehouse_id": wh_cas,
                    }
                ],
            })
            log(f"Created Credit Note with return_to_stock=True: Status {r_cn.status_code}")
    else:
        log(f"Failed Sale 2: {r_s2.status_code} {r_s2.text}")

    # 3. Sale 3 (July 2026) to Carrières du Rif -> Pont-Bascule 80T Béton
    sale3_data = {
        "customer_id": cust_rif,
        "order_date": "2026-07-10T10:00:00Z",
        "notes": "Pont-bascule 80T pour pesage de dumpers et camions de granulats",
        "items": [
            {"product_id": prod_map["PB-80T-BET"], "warehouse_id": wh_tng, "quantity": 1.0, "unit_price_ht": 295000.0, "tax_rate": 20.0, "discount_rate": 0.0},
            {"product_id": prod_map["SERV-ETAL-PB"], "warehouse_id": None, "quantity": 1.0, "unit_price_ht": 7500.0, "tax_rate": 20.0, "discount_rate": 0.0},
        ],
    }
    r_s3 = session.post(f"{BASE_URL}/sales", json=sale3_data)
    if r_s3.status_code in (200, 201):
        s3 = r_s3.json()
        s3_id = s3["id"]
        session.post(f"{BASE_URL}/sales/{s3_id}/confirm")
        # Delivery
        session.post(f"{BASE_URL}/delivery-notes", json={
            "sale_id": s3_id,
            "customer_id": cust_rif,
            "delivery_date": "2026-07-25T10:00:00Z",
            "notes": "Livraison site carrière Tétouan",
            "items": [
                {"product_id": prod_map["PB-80T-BET"], "warehouse_id": wh_tng, "delivered_quantity": 1.0},
            ],
        })
        # Customer Invoice 3 (Unpaid / En attente) via from-sale
        r_inv3 = session.post(f"{BASE_URL}/invoices/from-sale", json={
            "sale_id": s3_id,
            "invoice_date": "2026-07-28T10:00:00Z",
            "payment_terms": "30 jours",
            "payment_method": "Traite",
            "notes": "Facture Carrières du Rif",
        })
        log(f"Created Customer Invoice 3 (Unpaid): Status {r_inv3.status_code}")
    else:
        log(f"Failed Sale 3: {r_s3.status_code} {r_s3.text}")

    # 4. Multi-warehouse transfer: Transfer 4x CAPT-HBM-20T from Tanger to Casablanca
    r_tr = session.post(f"{BASE_URL}/stock/transfers", json={
        "product_id": prod_map["CAPT-HBM-20T"],
        "source_warehouse_id": wh_tng,
        "dest_warehouse_id": wh_cas,
        "quantity": 4.0,
        "reason": "Transfert stock tampon capteurs Tanger -> Casablanca pour interventions SAV régionales",
    })
    log(f"Executed Multi-Warehouse Transfer: Status {r_tr.status_code}")

    # 5. Overdue checks
    session.post(f"{BASE_URL}/invoices/check-overdue")
    log("Checked and notified overdue invoices.")

def main():
    log("==========================================================")
    log("STARTING ERP PESAGE 2000 DEMONSTRATION SEEDING WORKFLOW")
    log("==========================================================")
    login()
    seed_users()
    prod_map = seed_catalog()
    wh_map = seed_warehouses()
    partner_map = seed_partners()
    emp_map, veh_map = seed_employees_and_fleet(wh_map)
    seed_expenses()
    execute_purchases_and_stock(prod_map, wh_map, partner_map)
    execute_sales_and_deliveries(prod_map, wh_map, partner_map)

    # Check dashboard stats
    r_dash = session.get(f"{BASE_URL}/dashboard/stats")
    if r_dash.status_code == 200:
        log(f"Dashboard Stats Live Verification: {r_dash.json()}")
    log("==========================================================")
    log("ERP PESAGE 2000 DEMO SEEDING COMPLETED SUCCESSFULLY")
    log("==========================================================")

if __name__ == "__main__":
    main()
