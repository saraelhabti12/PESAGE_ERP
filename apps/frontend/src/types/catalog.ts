export interface Category {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryCreate {
  name: string;
  code: string;
  description?: string;
}

export interface CategoryUpdate {
  name?: string;
  code?: string;
  description?: string;
  is_active?: boolean;
}

export interface ProductType {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductTypeCreate {
  name: string;
  code: string;
  description?: string;
}

export interface ProductTypeUpdate {
  name?: string;
  code?: string;
  description?: string;
  is_active?: boolean;
}

export interface Brand {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrandCreate {
  name: string;
  code: string;
  description?: string;
}

export interface BrandUpdate {
  name?: string;
  code?: string;
  description?: string;
  is_active?: boolean;
}

export interface Unit {
  id: number;
  name: string;
  abbreviation: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnitCreate {
  name: string;
  abbreviation: string;
  description?: string;
}

export interface UnitUpdate {
  name?: string;
  abbreviation?: string;
  description?: string;
  is_active?: boolean;
}

export interface Product {
  id: number;
  sku: string;
  designation: string;
  description?: string | null;
  category_id: number;
  product_type_id: number;
  brand_id?: number | null;
  unit_id: number;
  barcode?: string | null;
  purchase_price: number;
  sale_price: number;
  tax_rate: number;
  is_active: boolean;
  track_stock: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
  product_type?: ProductType;
  brand?: Brand | null;
  unit?: Unit;
}

export interface ProductCreate {
  sku: string;
  designation: string;
  description?: string;
  category_id: number;
  product_type_id: number;
  brand_id?: number | null;
  unit_id: number;
  barcode?: string;
  purchase_price: number;
  sale_price: number;
  tax_rate: number;
  is_active?: boolean;
  track_stock?: boolean;
}

export interface ProductUpdate {
  sku?: string;
  designation?: string;
  description?: string;
  category_id?: number;
  product_type_id?: number;
  brand_id?: number | null;
  unit_id?: number;
  barcode?: string;
  purchase_price?: number;
  sale_price?: number;
  tax_rate?: number;
  is_active?: boolean;
  track_stock?: boolean;
}
