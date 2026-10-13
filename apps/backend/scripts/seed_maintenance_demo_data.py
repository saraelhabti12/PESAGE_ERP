import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add app parent directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import SessionLocal
from app.models.employee_model import Employee
from app.models.maintenance_model import (
    Equipment,
    EquipmentStatus,
    EquipmentType,
    Intervention,
    InterventionPart,
    InterventionPriority,
    InterventionStatus,
    InterventionTask,
    InterventionType,
    TaskStatus,
)
from app.models.partner_model import BusinessPartner, PartnerType
from app.models.product_model import Product
from app.models.user_model import User


def seed_maintenance_data():
    db = SessionLocal()
    try:
        print("[INFO] Seeding Pesage 2000 Maintenance & Equipment demo data...")

        # 1. Ensure Admin User
        admin = db.query(User).filter(User.email == "admin@example.com").first()
        if not admin:
            admin = db.query(User).first()
        admin_id = admin.id if admin else 1

        # 2. Ensure Clients
        clients_data = [
            {
                "code": "CLI-MINOT-01",
                "legal_name": "Société des Minoteries du Maghreb SA",
                "trade_name": "Minoteries du Maghreb",
                "partner_type": PartnerType.CUSTOMER,
                "phone": "+212 5 22 35 40 00",
                "email": "sav@minoteries-maghreb.ma",
                "address": "Zone Industrielle Roches Noires",
                "city": "Casablanca",
            },
            {
                "code": "CLI-CIMENT-02",
                "legal_name": "Ciments & Granulats du Maroc SA",
                "trade_name": "Ciments du Maroc",
                "partner_type": PartnerType.CUSTOMER,
                "phone": "+212 5 22 90 80 10",
                "email": "maintenance@cimentsmaroc.ma",
                "address": "Route Secondaire 110, Km 18",
                "city": "Bouskoura",
            },
            {
                "code": "CLI-AGRO-03",
                "legal_name": "Agro-Industrie Atlas SARL",
                "trade_name": "Atlas Agro",
                "partner_type": PartnerType.CUSTOMER,
                "phone": "+212 5 22 75 12 34",
                "email": "technique@agroatlas.ma",
                "address": "Zone Industrielle Ain Sebaa",
                "city": "Casablanca",
            },
        ]

        clients = []
        for c_data in clients_data:
            client = db.query(BusinessPartner).filter(BusinessPartner.legal_name == c_data["legal_name"]).first()
            if not client:
                client = BusinessPartner(**c_data)
                db.add(client)
                db.flush()
            clients.append(client)

        # 3. Ensure Technicians in Personnel
        techs_data = [
            {
                "employee_code": "EMP-TECH-01",
                "first_name": "Omar",
                "last_name": "Bennani",
                "phone": "+212 6 61 11 22 33",
                "email": "omar.bennani@pesage2000.ma",
                "job_title": "Technicien Metrologue Senior",
                "department": "Service Technique & Etalonnage",
                "is_active": True,
            },
            {
                "employee_code": "EMP-TECH-02",
                "first_name": "Youssef",
                "last_name": "Alaoui",
                "phone": "+212 6 62 44 55 66",
                "email": "youssef.alaoui@pesage2000.ma",
                "job_title": "Responsable SAV Pesage",
                "department": "Maintenance Industrielle",
                "is_active": True,
            },
            {
                "employee_code": "EMP-TECH-03",
                "first_name": "Amine",
                "last_name": "Chraibi",
                "phone": "+212 6 63 77 88 99",
                "email": "amine.chraibi@pesage2000.ma",
                "job_title": "Technicien Electromecanicien",
                "department": "Service Technique & Etalonnage",
                "is_active": True,
            },
        ]

        technicians = []
        for t_data in techs_data:
            tech = db.query(Employee).filter(Employee.email == t_data["email"]).first()
            if not tech:
                tech = Employee(**t_data)
                db.add(tech)
                db.flush()
            technicians.append(tech)

        # 4. Ensure Category, ProductType, Unit for Spare Parts
        from app.models.category_model import Category
        from app.models.product_type_model import ProductType
        from app.models.unit_model import Unit

        category = db.query(Category).first()
        if not category:
            category = Category(code="CAT-SAV", name="Pièces Détachées & SAV", is_active=True)
            db.add(category)
            db.flush()

        prod_type = db.query(ProductType).first()
        if not prod_type:
            prod_type = ProductType(code="TYP-PIECE", name="Composant / Pièce", is_active=True)
            db.add(prod_type)
            db.flush()

        unit = db.query(Unit).first()
        if not unit:
            unit = Unit(name="Unité", abbreviation="U", is_active=True)
            db.add(unit)
            db.flush()

        products_data = [
            {
                "sku": "CAP-30T-IP68",
                "designation": "Capteur de pesage 30T Inox IP68 C3",
                "sale_price": 3400.0,
                "purchase_price": 2100.0,
                "tax_rate": 20.0,
                "is_active": True,
                "track_stock": True,
                "category_id": category.id,
                "product_type_id": prod_type.id,
                "unit_id": unit.id,
            },
            {
                "sku": "BOX-JUNC-4C",
                "designation": "Boîte de jonction 4 capteurs inox étanche",
                "sale_price": 850.0,
                "purchase_price": 450.0,
                "tax_rate": 20.0,
                "is_active": True,
                "track_stock": True,
                "category_id": category.id,
                "product_type_id": prod_type.id,
                "unit_id": unit.id,
            },
            {
                "sku": "CBL-PES-15M",
                "designation": "Câble blindé haute immunité 6 conducteurs (15m)",
                "sale_price": 420.0,
                "purchase_price": 220.0,
                "tax_rate": 20.0,
                "is_active": True,
                "track_stock": True,
                "category_id": category.id,
                "product_type_id": prod_type.id,
                "unit_id": unit.id,
            },
        ]

        products = []
        for p_data in products_data:
            prod = db.query(Product).filter(Product.sku == p_data["sku"]).first()
            if not prod:
                prod = Product(**p_data)
                db.add(prod)
                db.flush()
            products.append(prod)

        # 5. Create Weighing Equipments
        equipments_data = [
            {
                "equipment_code": "EQ-2026-0001",
                "customer_id": clients[0].id,
                "designation": "Pont-Bascule Métallique 60T (Fosse)",
                "equipment_type": EquipmentType.PONTS_BASCULES,
                "brand": "Pesage 2000 Pro",
                "model": "PB-60T-18M",
                "serial_number": "SN-2024-PB-088",
                "site_name": "Silo Principal Roches Noires",
                "site_address": "Entrée Camions Poids Lourds",
                "city": "Casablanca",
                "installation_date": datetime(2024, 1, 15, tzinfo=timezone.utc),
                "capacity_max": 60000.0,
                "capacity_min": 400.0,
                "graduation": 20.0,
                "status": EquipmentStatus.OPERATIONAL,
                "notes": "Pont-bascule 6 capteurs sous contrat d'entretien préventif P1.",
            },
            {
                "equipment_code": "EQ-2026-0002",
                "customer_id": clients[1].id,
                "designation": "Pont-Bascule Béton 80T (Hors-sol avec rampes)",
                "equipment_type": EquipmentType.PONTS_BASCULES,
                "brand": "Pesage 2000 Heavy",
                "model": "PB-80T-20M",
                "serial_number": "SN-2023-PB-112",
                "site_name": "Carrière & Usine Bouskoura",
                "site_address": "Poste de pesage carrière",
                "city": "Bouskoura",
                "installation_date": datetime(2023, 6, 20, tzinfo=timezone.utc),
                "capacity_max": 80000.0,
                "capacity_min": 500.0,
                "graduation": 20.0,
                "status": EquipmentStatus.OPERATIONAL,
                "notes": "Pesée intensive des camions malaxeurs et semi-remorques bennes.",
            },
            {
                "equipment_code": "EQ-2026-0003",
                "customer_id": clients[2].id,
                "designation": "Balance Industrielle Plateforme 3000kg Inox",
                "equipment_type": EquipmentType.BALANCES_PLATEFORMES,
                "brand": "Dini Argeo",
                "model": "FL-3T-INOX",
                "serial_number": "SN-2025-DA-409",
                "site_name": "Atelier Conditionnement Huiles",
                "site_address": "Zone Propre Ain Sebaa",
                "city": "Casablanca",
                "installation_date": datetime(2025, 2, 10, tzinfo=timezone.utc),
                "capacity_max": 3000.0,
                "capacity_min": 20.0,
                "graduation": 1.0,
                "status": EquipmentStatus.OPERATIONAL,
                "notes": "Utilisée pour le pesage des palettes et fûts inox.",
            },
            {
                "equipment_code": "EQ-2026-0004",
                "customer_id": clients[0].id,
                "designation": "Indicateur Poids & Terminal Électronique",
                "equipment_type": EquipmentType.INDICATEURS_POIDS,
                "brand": "Pesage 2000",
                "model": "IND-570-TOUCH",
                "serial_number": "SN-2024-IND-331",
                "site_name": "Guérite Pont-Bascule 1",
                "site_address": "Poste de garde",
                "city": "Casablanca",
                "installation_date": datetime(2024, 1, 15, tzinfo=timezone.utc),
                "capacity_max": 60000.0,
                "capacity_min": 400.0,
                "graduation": 20.0,
                "status": EquipmentStatus.OPERATIONAL,
                "notes": "Raccordé au logiciel de pesage de pont-bascule.",
            },
        ]

        equipments = []
        for eq_data in equipments_data:
            eq = db.query(Equipment).filter(Equipment.equipment_code == eq_data["equipment_code"]).first()
            if not eq:
                eq = Equipment(**eq_data)
                db.add(eq)
                db.flush()
            equipments.append(eq)

        # 6. Create Realistic Weighing Interventions
        now = datetime.now(timezone.utc)

        interventions_data = [
            # 1. Completed Preventive Maintenance on Pont-Bascule 60T
            {
                "intervention_code": "INT-2026-0001",
                "customer_id": clients[0].id,
                "equipment_id": equipments[0].id,
                "site": "Silo Principal Roches Noires",
                "assigned_technician_id": technicians[0].id,
                "date_start": now - timedelta(days=12, hours=4),
                "date_end": now - timedelta(days=12),
                "intervention_type": InterventionType.PREVENTIVE_MAINTENANCE,
                "priority": InterventionPriority.NORMAL,
                "status": InterventionStatus.COMPLETED,
                "problem_description": "Visite périodique semestrielle et révision complète de la plateforme de pesage.",
                "diagnosis": "Encrassement modéré des butées de choc et oxydation des connexions de la boîte de jonction.",
                "work_performed": "Nettoyage haute pression de la fosse, réajustage des butées, remplacement des joints d'étanchéité de boîte, réglage du zéro et étalonnage.",
                "observations": "Erreurs de justesse conformes aux tolérances de la classe III sur l'ensemble de l'étendue de mesure.",
                "recommendations": "Prochaine vérification périodique recommandée dans 6 mois.",
                "next_maintenance_date": now + timedelta(days=168),
                "labor_cost": 1200.0,
                "parts_cost": 850.0,
                "travel_cost": 250.0,
                "other_cost": 100.0,
                "total_cost": 2400.0,
                "created_by": admin_id,
                "tasks": [
                    ("Démontage des trappes d'accès et inspection des rotules", TaskStatus.COMPLETED),
                    ("Nettoyage et contrôle d'étanchéité de la boîte de jonction", TaskStatus.COMPLETED),
                    ("Contrôle des câblages capteurs et mise à la terre", TaskStatus.COMPLETED),
                    ("Ajustage des butées longitudinales et transversales (jeu 2mm)", TaskStatus.COMPLETED),
                    ("Vérification de linéarité avec camion étalonné et masses M1", TaskStatus.COMPLETED),
                    ("Poinçonnage et délivrance de la fiche de visite", TaskStatus.COMPLETED),
                ],
                "parts": [
                    (products[1].id, "Boîte de jonction 4 capteurs inox étanche", 1.0, 850.0, 20.0),
                ],
            },
            # 2. Completed Breakdown repair on Ciments du Maroc 80T
            {
                "intervention_code": "INT-2026-0002",
                "customer_id": clients[1].id,
                "equipment_id": equipments[1].id,
                "site": "Carrière Bouskoura",
                "assigned_technician_id": technicians[1].id,
                "date_start": now - timedelta(days=5, hours=6),
                "date_end": now - timedelta(days=5, hours=1),
                "intervention_type": InterventionType.BREAKDOWN_REPAIR,
                "priority": InterventionPriority.CRITICAL,
                "status": InterventionStatus.COMPLETED,
                "problem_description": "Dépannage d'urgence: instabilité totale de la pesée (fluctuations de ±800 kg) bloquant la sortie des camions.",
                "diagnosis": "Court-circuit interne sur le capteur de charge n° 4 suite à une surtension.",
                "work_performed": "Remplacement du capteur défectueux par un capteur inox 30T C3 neuf, rééquilibrage des coins par potentiomètre et recalibration.",
                "observations": "Pont-bascule remis en service avec succès, tests de répétabilité et d'excentration 100% conformes.",
                "recommendations": "Vérifier la ligne de parafoudre du site de pesage.",
                "next_maintenance_date": now + timedelta(days=90),
                "labor_cost": 1500.0,
                "parts_cost": 3820.0,
                "travel_cost": 350.0,
                "other_cost": 0.0,
                "total_cost": 5670.0,
                "created_by": admin_id,
                "tasks": [
                    ("Contrôle d'impédance de chaque capteur au multimètre", TaskStatus.COMPLETED),
                    ("Dépose du capteur n°4 défectueux au cric hydraulique 50T", TaskStatus.COMPLETED),
                    ("Installation et calage du nouveau capteur 30T Inox IP68", TaskStatus.COMPLETED),
                    ("Raccordement et étanchéification du câble 15m blindé", TaskStatus.COMPLETED),
                    ("Étalonnage avec masses étalons et contrôle des 4 coins", TaskStatus.COMPLETED),
                ],
                "parts": [
                    (products[0].id, "Capteur de pesage 30T Inox IP68 C3", 1.0, 3400.0, 20.0),
                    (products[2].id, "Câble blindé haute immunité (15m)", 1.0, 420.0, 20.0),
                ],
            },
            # 3. Calibration & Legal Metrology on Atlas Agro 3T Platform
            {
                "intervention_code": "INT-2026-0003",
                "customer_id": clients[2].id,
                "equipment_id": equipments[2].id,
                "site": "Atelier Conditionnement Ain Sebaa",
                "assigned_technician_id": technicians[0].id,
                "date_start": now - timedelta(days=2, hours=3),
                "date_end": now - timedelta(days=2),
                "intervention_type": InterventionType.CALIBRATION,
                "priority": InterventionPriority.NORMAL,
                "status": InterventionStatus.COMPLETED,
                "problem_description": "Contrôle annuel de métrologie légale et étalonnage COFRAC/ONSSA de la balance plateforme.",
                "diagnosis": "Matériel propre, dérive mineure de zéro (+2 kg).",
                "work_performed": "Nettoyage des appuis, réglage du zéro électronique, étalonnage complet avec masses de 20kg à 2000kg.",
                "observations": "Écart maximal constaté: 0.5 kg (inférieur à l'échelon toléré de 1 kg).",
                "recommendations": "Poinçon vert apposé. Certificat d'étalonnage délivré.",
                "next_maintenance_date": now + timedelta(days=365),
                "labor_cost": 800.0,
                "parts_cost": 0.0,
                "travel_cost": 150.0,
                "other_cost": 50.0,
                "total_cost": 1000.0,
                "created_by": admin_id,
                "tasks": [
                    ("Inspection visuelle de la plateforme et du récepteur de charge", TaskStatus.COMPLETED),
                    ("Essai de mobilité et de fidélité à charge nulle", TaskStatus.COMPLETED),
                    ("Essai d'excentration aux 4 angles avec masse 1000 kg", TaskStatus.COMPLETED),
                    ("Essai de linéarité par paliers ascendants et descendants", TaskStatus.COMPLETED),
                    ("Apposition de la vignette de contrôle métrologique", TaskStatus.COMPLETED),
                ],
                "parts": [],
            },
            # 4. In Progress Preventive Maintenance
            {
                "intervention_code": "INT-2026-0004",
                "customer_id": clients[0].id,
                "equipment_id": equipments[3].id,
                "site": "Guérite Pont-Bascule 1",
                "assigned_technician_id": technicians[2].id,
                "date_start": now - timedelta(hours=2),
                "date_end": None,
                "intervention_type": InterventionType.PREVENTIVE_MAINTENANCE,
                "priority": InterventionPriority.NORMAL,
                "status": InterventionStatus.IN_PROGRESS,
                "problem_description": "Mise à jour firmware de l'indicateur IND-570 et vérification des liaisons RS232/Ethernet.",
                "diagnosis": "Indicateur fonctionnel, mise à niveau demandée pour transmission automatique des pesées.",
                "work_performed": "Sauvegarde des paramètres de calibrage, mise à jour logicielle en cours.",
                "observations": "En cours de synchronisation avec le serveur ERP.",
                "recommendations": "",
                "next_maintenance_date": now + timedelta(days=180),
                "labor_cost": 600.0,
                "parts_cost": 0.0,
                "travel_cost": 150.0,
                "other_cost": 0.0,
                "total_cost": 750.0,
                "created_by": admin_id,
                "tasks": [
                    ("Sauvegarde de la configuration et des coefficients de tarage", TaskStatus.COMPLETED),
                    ("Installation de la mise à jour firmware v2.4", TaskStatus.IN_PROGRESS),
                    ("Test de communication réseau avec l'ERP Pesage 2000", TaskStatus.PENDING),
                ],
                "parts": [],
            },
            # 5. Scheduled Future Inspection
            {
                "intervention_code": "INT-2026-0005",
                "customer_id": clients[1].id,
                "equipment_id": equipments[1].id,
                "site": "Carrière Bouskoura",
                "assigned_technician_id": technicians[1].id,
                "date_start": now + timedelta(days=15, hours=9),
                "date_end": None,
                "intervention_type": InterventionType.INSPECTION,
                "priority": InterventionPriority.NORMAL,
                "status": InterventionStatus.SCHEDULED,
                "problem_description": "Visite de contrôle intermédiaire après réparation lourde.",
                "diagnosis": "",
                "work_performed": "",
                "observations": "",
                "recommendations": "",
                "next_maintenance_date": now + timedelta(days=180),
                "labor_cost": 500.0,
                "parts_cost": 0.0,
                "travel_cost": 250.0,
                "other_cost": 0.0,
                "total_cost": 750.0,
                "created_by": admin_id,
                "tasks": [
                    ("Contrôle du calage du nouveau capteur n°4", TaskStatus.PENDING),
                    ("Vérification de la sensibilité et du zéro", TaskStatus.PENDING),
                ],
                "parts": [],
            },
        ]

        for i_data in interventions_data:
            existing = db.query(Intervention).filter(Intervention.intervention_code == i_data["intervention_code"]).first()
            if existing:
                continue

            tasks_data = i_data.pop("tasks", [])
            parts_data = i_data.pop("parts", [])

            intervention = Intervention(**i_data)
            db.add(intervention)
            db.flush()

            for idx, (desc, task_status) in enumerate(tasks_data):
                t = InterventionTask(
                    intervention_id=intervention.id,
                    description=desc,
                    status=task_status,
                    completed_at=now if task_status == TaskStatus.COMPLETED else None,
                    order_index=idx + 1,
                )
                db.add(t)

            for prod_id, desig, qty, price, tax in parts_data:
                tot_ht = round(qty * price, 2)
                tot_ttc = round(tot_ht * (1 + tax / 100.0), 2)
                p = InterventionPart(
                    intervention_id=intervention.id,
                    product_id=prod_id,
                    designation=desig,
                    quantity=qty,
                    unit_price=price,
                    tax_rate=tax,
                    total_ht=tot_ht,
                    total_ttc=tot_ttc,
                )
                db.add(p)

        db.commit()
        print("[SUCCESS] Successfully seeded Pesage 2000 Maintenance & Equipment demo records!")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error seeding maintenance data: {str(e)}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_maintenance_data()
