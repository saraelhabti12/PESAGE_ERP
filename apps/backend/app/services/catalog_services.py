from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import or_, select, func
from sqlalchemy.orm import Session, joinedload

from app.models.category_model import Category
from app.models.product_type_model import ProductType
from app.models.brand_model import Brand
from app.models.unit_model import Unit
from app.models.product_model import Product
from app.schemas.category_schemas import CategoryCreate, CategoryUpdate
from app.schemas.product_type_schemas import ProductTypeCreate, ProductTypeUpdate
from app.schemas.brand_schemas import BrandCreate, BrandUpdate
from app.schemas.unit_schemas import UnitCreate, UnitUpdate
from app.schemas.product_schemas import ProductCreate, ProductUpdate


class CatalogService:
    # ----------------------------------------------------
    # CATEGORIES
    # ----------------------------------------------------
    @staticmethod
    def get_categories(
        db: Session, page: int = 1, size: int = 50, search: Optional[str] = None, is_active: Optional[bool] = None
    ) -> Tuple[List[Category], int]:
        query = db.query(Category)
        if is_active is not None:
            query = query.filter(Category.is_active == is_active)
        if search:
            s = f"%{search}%"
            query = query.filter(or_(Category.name.ilike(s), Category.code.ilike(s)))
        
        total = query.count()
        items = query.order_by(Category.name.asc()).offset((page - 1) * size).limit(size).all()
        return items, total

    @staticmethod
    def get_category_by_id(db: Session, category_id: int) -> Category:
        category = db.query(Category).filter(Category.id == category_id).first()
        if not category:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        return category

    @staticmethod
    def create_category(db: Session, data: CategoryCreate) -> Category:
        if db.query(Category).filter(Category.name == data.name).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category name already exists")
        if db.query(Category).filter(Category.code == data.code).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category code already exists")
        
        category = Category(**data.model_dump())
        db.add(category)
        db.commit()
        db.refresh(category)
        return category

    @staticmethod
    def update_category(db: Session, category_id: int, data: CategoryUpdate) -> Category:
        category = CatalogService.get_category_by_id(db, category_id)
        update_data = data.model_dump(exclude_unset=True)

        if "name" in update_data and update_data["name"] != category.name:
            if db.query(Category).filter(Category.name == update_data["name"], Category.id != category_id).first():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category name already exists")
        
        if "code" in update_data and update_data["code"] != category.code:
            if db.query(Category).filter(Category.code == update_data["code"], Category.id != category_id).first():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category code already exists")

        for key, value in update_data.items():
            setattr(category, key, value)
        
        db.commit()
        db.refresh(category)
        return category

    @staticmethod
    def delete_category(db: Session, category_id: int) -> Category:
        category = CatalogService.get_category_by_id(db, category_id)
        category.is_active = False
        db.commit()
        db.refresh(category)
        return category

    # ----------------------------------------------------
    # PRODUCT TYPES
    # ----------------------------------------------------
    @staticmethod
    def get_product_types(
        db: Session, page: int = 1, size: int = 50, search: Optional[str] = None, is_active: Optional[bool] = None
    ) -> Tuple[List[ProductType], int]:
        query = db.query(ProductType)
        if is_active is not None:
            query = query.filter(ProductType.is_active == is_active)
        if search:
            s = f"%{search}%"
            query = query.filter(or_(ProductType.name.ilike(s), ProductType.code.ilike(s)))
        
        total = query.count()
        items = query.order_by(ProductType.name.asc()).offset((page - 1) * size).limit(size).all()
        return items, total

    @staticmethod
    def get_product_type_by_id(db: Session, type_id: int) -> ProductType:
        product_type = db.query(ProductType).filter(ProductType.id == type_id).first()
        if not product_type:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product type not found")
        return product_type

    @staticmethod
    def create_product_type(db: Session, data: ProductTypeCreate) -> ProductType:
        if db.query(ProductType).filter(ProductType.name == data.name).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product type name already exists")
        if db.query(ProductType).filter(ProductType.code == data.code).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product type code already exists")
        
        product_type = ProductType(**data.model_dump())
        db.add(product_type)
        db.commit()
        db.refresh(product_type)
        return product_type

    @staticmethod
    def update_product_type(db: Session, type_id: int, data: ProductTypeUpdate) -> ProductType:
        product_type = CatalogService.get_product_type_by_id(db, type_id)
        update_data = data.model_dump(exclude_unset=True)

        if "name" in update_data and update_data["name"] != product_type.name:
            if db.query(ProductType).filter(ProductType.name == update_data["name"], ProductType.id != type_id).first():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product type name already exists")
        
        if "code" in update_data and update_data["code"] != product_type.code:
            if db.query(ProductType).filter(ProductType.code == update_data["code"], ProductType.id != type_id).first():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product type code already exists")

        for key, value in update_data.items():
            setattr(product_type, key, value)
        
        db.commit()
        db.refresh(product_type)
        return product_type

    @staticmethod
    def delete_product_type(db: Session, type_id: int) -> ProductType:
        product_type = CatalogService.get_product_type_by_id(db, type_id)
        product_type.is_active = False
        db.commit()
        db.refresh(product_type)
        return product_type

    # ----------------------------------------------------
    # BRANDS
    # ----------------------------------------------------
    @staticmethod
    def get_brands(
        db: Session, page: int = 1, size: int = 50, search: Optional[str] = None, is_active: Optional[bool] = None
    ) -> Tuple[List[Brand], int]:
        query = db.query(Brand)
        if is_active is not None:
            query = query.filter(Brand.is_active == is_active)
        if search:
            s = f"%{search}%"
            query = query.filter(or_(Brand.name.ilike(s), Brand.code.ilike(s)))
        
        total = query.count()
        items = query.order_by(Brand.name.asc()).offset((page - 1) * size).limit(size).all()
        return items, total

    @staticmethod
    def get_brand_by_id(db: Session, brand_id: int) -> Brand:
        brand = db.query(Brand).filter(Brand.id == brand_id).first()
        if not brand:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
        return brand

    @staticmethod
    def create_brand(db: Session, data: BrandCreate) -> Brand:
        if db.query(Brand).filter(Brand.name == data.name).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Brand name already exists")
        if db.query(Brand).filter(Brand.code == data.code).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Brand code already exists")
        
        brand = Brand(**data.model_dump())
        db.add(brand)
        db.commit()
        db.refresh(brand)
        return brand

    @staticmethod
    def update_brand(db: Session, brand_id: int, data: BrandUpdate) -> Brand:
        brand = CatalogService.get_brand_by_id(db, brand_id)
        update_data = data.model_dump(exclude_unset=True)

        if "name" in update_data and update_data["name"] != brand.name:
            if db.query(Brand).filter(Brand.name == update_data["name"], Brand.id != brand_id).first():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Brand name already exists")
        
        if "code" in update_data and update_data["code"] != brand.code:
            if db.query(Brand).filter(Brand.code == update_data["code"], Brand.id != brand_id).first():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Brand code already exists")

        for key, value in update_data.items():
            setattr(brand, key, value)
        
        db.commit()
        db.refresh(brand)
        return brand

    @staticmethod
    def delete_brand(db: Session, brand_id: int) -> Brand:
        brand = CatalogService.get_brand_by_id(db, brand_id)
        brand.is_active = False
        db.commit()
        db.refresh(brand)
        return brand

    # ----------------------------------------------------
    # UNITS
    # ----------------------------------------------------
    @staticmethod
    def get_units(
        db: Session, page: int = 1, size: int = 50, search: Optional[str] = None, is_active: Optional[bool] = None
    ) -> Tuple[List[Unit], int]:
        query = db.query(Unit)
        if is_active is not None:
            query = query.filter(Unit.is_active == is_active)
        if search:
            s = f"%{search}%"
            query = query.filter(or_(Unit.name.ilike(s), Unit.abbreviation.ilike(s)))
        
        total = query.count()
        items = query.order_by(Unit.name.asc()).offset((page - 1) * size).limit(size).all()
        return items, total

    @staticmethod
    def get_unit_by_id(db: Session, unit_id: int) -> Unit:
        unit = db.query(Unit).filter(Unit.id == unit_id).first()
        if not unit:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")
        return unit

    @staticmethod
    def create_unit(db: Session, data: UnitCreate) -> Unit:
        if db.query(Unit).filter(Unit.name == data.name).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unit name already exists")
        
        unit = Unit(**data.model_dump())
        db.add(unit)
        db.commit()
        db.refresh(unit)
        return unit

    @staticmethod
    def update_unit(db: Session, unit_id: int, data: UnitUpdate) -> Unit:
        unit = CatalogService.get_unit_by_id(db, unit_id)
        update_data = data.model_dump(exclude_unset=True)

        if "name" in update_data and update_data["name"] != unit.name:
            if db.query(Unit).filter(Unit.name == update_data["name"], Unit.id != unit_id).first():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unit name already exists")

        for key, value in update_data.items():
            setattr(unit, key, value)
        
        db.commit()
        db.refresh(unit)
        return unit

    @staticmethod
    def delete_unit(db: Session, unit_id: int) -> Unit:
        unit = CatalogService.get_unit_by_id(db, unit_id)
        unit.is_active = False
        db.commit()
        db.refresh(unit)
        return unit

    # ----------------------------------------------------
    # PRODUCTS
    # ----------------------------------------------------
    @staticmethod
    def get_products(
        db: Session, page: int = 1, size: int = 50, search: Optional[str] = None, is_active: Optional[bool] = None
    ) -> Tuple[List[Product], int]:
        query = db.query(Product).options(
            joinedload(Product.category),
            joinedload(Product.product_type),
            joinedload(Product.brand),
            joinedload(Product.unit),
        )
        if is_active is not None:
            query = query.filter(Product.is_active == is_active)
        if search:
            s = f"%{search}%"
            query = query.filter(or_(Product.sku.ilike(s), Product.designation.ilike(s), Product.barcode.ilike(s)))
        
        total = query.count()
        items = query.order_by(Product.created_at.desc()).offset((page - 1) * size).limit(size).all()
        return items, total

    @staticmethod
    def get_product_by_id(db: Session, product_id: int) -> Product:
        product = (
            db.query(Product)
            .options(
                joinedload(Product.category),
                joinedload(Product.product_type),
                joinedload(Product.brand),
                joinedload(Product.unit),
            )
            .filter(Product.id == product_id)
            .first()
        )
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        return product

    @staticmethod
    def validate_product_references(
        db: Session, category_id: int, product_type_id: int, unit_id: int, brand_id: Optional[int]
    ):
        # 1. Category check
        category = db.query(Category).filter(Category.id == category_id).first()
        if not category:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        if not category.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot assign inactive category to product"
            )

        # 2. Product Type check
        product_type = db.query(ProductType).filter(ProductType.id == product_type_id).first()
        if not product_type:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product type not found")
        if not product_type.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot assign inactive product type to product"
            )

        # 3. Unit check
        unit = db.query(Unit).filter(Unit.id == unit_id).first()
        if not unit:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")
        if not unit.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot assign inactive unit to product"
            )

        # 4. Optional Brand check
        if brand_id is not None:
            brand = db.query(Brand).filter(Brand.id == brand_id).first()
            if not brand:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
            if not brand.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot assign inactive brand to product"
                )

    @staticmethod
    def create_product(db: Session, data: ProductCreate) -> Product:
        # Check SKU uniqueness
        if db.query(Product).filter(Product.sku == data.sku).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product SKU already exists")

        # Check Barcode uniqueness if provided
        if data.barcode and db.query(Product).filter(Product.barcode == data.barcode).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product barcode already exists")

        # Check prices and tax non-negative
        if data.purchase_price < 0 or data.sale_price < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prices cannot be negative")
        if data.tax_rate < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tax rate cannot be negative")

        # Validate Foreign Key entity existence & active status
        CatalogService.validate_product_references(
            db,
            category_id=data.category_id,
            product_type_id=data.product_type_id,
            unit_id=data.unit_id,
            brand_id=data.brand_id,
        )

        product = Product(**data.model_dump())
        db.add(product)
        db.commit()
        return CatalogService.get_product_by_id(db, product.id)

    @staticmethod
    def update_product(db: Session, product_id: int, data: ProductUpdate) -> Product:
        product = CatalogService.get_product_by_id(db, product_id)
        update_data = data.model_dump(exclude_unset=True)

        if "sku" in update_data and update_data["sku"] != product.sku:
            if db.query(Product).filter(Product.sku == update_data["sku"], Product.id != product_id).first():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product SKU already exists")

        if "barcode" in update_data and update_data["barcode"] and update_data["barcode"] != product.barcode:
            if db.query(Product).filter(Product.barcode == update_data["barcode"], Product.id != product_id).first():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product barcode already exists")

        if "purchase_price" in update_data and update_data["purchase_price"] < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prices cannot be negative")
        if "sale_price" in update_data and update_data["sale_price"] < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prices cannot be negative")
        if "tax_rate" in update_data and update_data["tax_rate"] < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tax rate cannot be negative")

        category_id = update_data.get("category_id", product.category_id)
        product_type_id = update_data.get("product_type_id", product.product_type_id)
        unit_id = update_data.get("unit_id", product.unit_id)
        brand_id = update_data.get("brand_id", product.brand_id)

        CatalogService.validate_product_references(
            db, category_id=category_id, product_type_id=product_type_id, unit_id=unit_id, brand_id=brand_id
        )

        for key, value in update_data.items():
            setattr(product, key, value)

        db.commit()
        return CatalogService.get_product_by_id(db, product_id)

    @staticmethod
    def delete_product(db: Session, product_id: int) -> Product:
        product = CatalogService.get_product_by_id(db, product_id)
        product.is_active = False
        db.commit()
        return CatalogService.get_product_by_id(db, product_id)
