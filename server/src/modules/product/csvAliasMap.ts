/**
 * Header alias map and normalization for multi-ERP exports (Tally, Busy, Marg, Shopify, WooCommerce)
 * (SEL-7)
 */

export interface NormalizedProductRow {
  sku?: string;
  name: string;
  description: string;
  price: number;
  mrp?: number;
  discount: number;
  bookingAmount: number;
  quantity: number;
  inStock: boolean;
  category: string;
  subCategory?: string;
  brand?: string;
  unit: string;
  tags: string[];
  images: string[];
}

export interface RowValidationError {
  row: number;
  column?: string;
  sku?: string;
  name?: string;
  message: string;
}

// Alias dictionary: maps standard internal field name to possible CSV headers
export const HEADER_ALIASES: Record<string, string[]> = {
  sku: ['sku', 'item_code', 'code', 'barcode', 'product_code', 'item_no', 'itemcode', 'part_number'],
  name: ['name', 'title', 'item_name', 'product_name', 'itemname', 'description1', 'particulars'],
  price: ['price', 'selling_price', 'rate', 'sale_price', 'unit_price', 'sales_rate', 'price_inr', 'mrp_selling'],
  mrp: ['mrp', 'maximum_retail_price', 'original_price', 'list_price', 'standard_rate', 'marked_price'],
  quantity: ['quantity', 'qty', 'stock', 'inventory', 'closing_stock', 'balance_qty', 'units', 'stock_quantity'],
  category: ['category', 'group', 'parent_category', 'item_group', 'category_name', 'dept'],
  subCategory: ['sub_category', 'subgroup', 'sub_group', 'subcategory', 'child_category'],
  unit: ['unit', 'uom', 'unit_of_measure', 'packaging', 'per', 'unit_name'],
  description: ['description', 'details', 'summary', 'item_description', 'notes', 'specifications'],
  images: ['images', 'image', 'image_url', 'photo_urls', 'photos', 'picture', 'image_link'],
  tags: ['tags', 'keywords', 'labels', 'search_tags'],
  bookingAmount: ['booking_amount', 'token_amount', 'advance_amount', 'bookingamount', 'tokenamount'],
  brand: ['brand', 'manufacturer', 'make'],
};

/**
 * Resolves a raw row object by mapping any matching alias to its canonical field
 */
export function normalizeCsvRow(rawRow: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};

  // Build lowercase lookup of input keys
  const inputLookup: Record<string, any> = {};
  for (const [key, val] of Object.entries(rawRow)) {
    const cleanKey = key.trim().toLowerCase().replace(/[\s_-]+/g, '_');
    inputLookup[cleanKey] = val;
  }

  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    // Check canonical first
    if (inputLookup[canonical] !== undefined) {
      normalized[canonical] = inputLookup[canonical];
      continue;
    }
    // Check aliases
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[\s_-]+/g, '_');
      if (inputLookup[cleanAlias] !== undefined) {
        normalized[canonical] = inputLookup[cleanAlias];
        break;
      }
    }
  }

  return normalized;
}

/**
 * Validates and sanitizes a single product row from CSV
 */
export function validateAndParseRow(
  rawRow: Record<string, any>,
  rowIndex: number,
  fallbackCategory = 'General'
): { parsed?: NormalizedProductRow; error?: RowValidationError } {
  const row = normalizeCsvRow(rawRow);

  const rawName = row.name !== undefined && row.name !== null ? String(row.name).trim() : '';
  const rawPrice = row.price !== undefined && row.price !== null ? String(row.price).trim() : '';
  const rawSku = row.sku !== undefined && row.sku !== null ? String(row.sku).trim() : undefined;

  if (!rawName) {
    return {
      error: {
        row: rowIndex,
        column: 'name',
        sku: rawSku,
        name: rawName,
        message: 'Product name is required',
      },
    };
  }

  if (!rawPrice) {
    return {
      error: {
        row: rowIndex,
        column: 'price',
        sku: rawSku,
        name: rawName,
        message: 'Selling price is required',
      },
    };
  }

  const cleanPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, ''));
  if (isNaN(cleanPrice) || cleanPrice <= 0) {
    return {
      error: {
        row: rowIndex,
        column: 'price',
        sku: rawSku,
        name: rawName,
        message: `Invalid price: "${rawPrice}". Must be a positive number.`,
      },
    };
  }

  let cleanMrp: number | undefined;
  if (row.mrp !== undefined && row.mrp !== null && String(row.mrp).trim() !== '') {
    cleanMrp = parseFloat(String(row.mrp).replace(/[^0-9.]/g, ''));
    if (isNaN(cleanMrp) || cleanMrp < cleanPrice) {
      return {
        error: {
          row: rowIndex,
          column: 'mrp',
          sku: rawSku,
          name: rawName,
          message: `MRP (${cleanMrp}) cannot be less than selling price (${cleanPrice})`,
        },
      };
    }
  }

  let discount = 0;
  if (cleanMrp && cleanMrp > cleanPrice) {
    discount = Math.round(((cleanMrp - cleanPrice) / cleanMrp) * 100);
  } else if (row.discount) {
    discount = Math.max(0, Math.min(99, parseInt(String(row.discount), 10) || 0));
  }

  let cleanBookingAmount = 0;
  if (row.bookingAmount !== undefined && row.bookingAmount !== null) {
    const bAmt = parseFloat(String(row.bookingAmount).replace(/[^0-9.]/g, ''));
    if (!isNaN(bAmt) && bAmt >= 0) {
      cleanBookingAmount = Math.min(bAmt, cleanPrice);
    }
  }

  const rawQty = row.quantity;
  const quantity = rawQty !== undefined && rawQty !== null && String(rawQty).trim() !== ''
    ? Math.max(0, parseInt(String(rawQty).replace(/[^0-9]/g, ''), 10) || 0)
    : 10;
  const inStock = quantity > 0;

  const description = row.description
    ? String(row.description).trim()
    : `${rawName} — available in store for immediate pickup or delivery.`;

  const category = (row.category ? String(row.category).trim() : fallbackCategory) || 'General';
  const subCategory = row.subCategory ? String(row.subCategory).trim() : undefined;
  const brand = row.brand ? String(row.brand).trim() : undefined;
  const unit = row.unit ? String(row.unit).trim() : 'pcs';

  const tags = row.tags
    ? String(row.tags).split(/[,|;]/).map((t) => t.trim()).filter(Boolean)
    : [];

  const images = row.images
    ? String(row.images).split(/[,|;]/).map((url) => url.trim()).filter((url) => url.startsWith('http://') || url.startsWith('https://'))
    : [];

  return {
    parsed: {
      sku: rawSku || undefined,
      name: rawName,
      description,
      price: cleanPrice,
      mrp: cleanMrp,
      discount,
      bookingAmount: cleanBookingAmount,
      quantity,
      inStock,
      category,
      subCategory,
      brand,
      unit,
      tags,
      images,
    },
  };
}
