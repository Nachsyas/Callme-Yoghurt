export interface PublicCatalogVariant {
  variant_id: string;
  sku: string;
  name: string;
  net_content?: {
    quantity: string | null;
    uom: string | null;
  };
  price: {
    currency: 'IDR';
    amount: number;
  };
}

export interface PublicCatalogProduct {
  slug: string;
  name: string;
  variants: PublicCatalogVariant[];
}

export interface PublicCatalogData {
  products: PublicCatalogProduct[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates whether a value is a valid UUID string (supports UUIDv4, UUIDv7, etc.)
 */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
  );
}

/**
 * Normalizes authoritative variant net content into milliliters (ml) for storefront sizing.
 *
 * Invariants (Gate 0E.2A.1):
 * - Supported UOMs: ML (direct), L (multiplied by 1000).
 * - Rejects null, undefined, non-numeric, zero/negative, non-finite, or unsupported UOMs.
 * - Zero floating-point drift: converts via exact integer or bounded precision.
 * - Never falls back to SKU string guessing.
 */
export function parseNetContentMl(quantity: unknown, uom: unknown): number | null {
  if (typeof quantity !== 'string' || typeof uom !== 'string') {
    return null;
  }

  const trimmedQty = quantity.trim();
  const trimmedUom = uom.trim().toUpperCase();

  if (trimmedQty.length === 0 || trimmedUom.length === 0) {
    return null;
  }

  const parsedNum = Number(trimmedQty);
  if (!Number.isFinite(parsedNum) || parsedNum <= 0) {
    return null;
  }

  if (trimmedUom === 'ML') {
    const ml = Math.round(parsedNum);
    return ml > 0 ? ml : null;
  }

  if (trimmedUom === 'L') {
    const ml = Math.round(parsedNum * 1000);
    return ml > 0 ? ml : null;
  }

  return null;
}

/**
 * Validates and transforms upstream ERP catalog response into an explicit, sanitized public DTO.
 *
 * Invariants (Gate 0E.2A & 0E.2A.1):
 * - Strict schema parsing with zero `any`.
 * - Every variant must have an actual UUID variant_id (UUIDv7/v4 format).
 * - Price currency must be strictly 'IDR' (no normalization from usd/idr/Idr).
 * - Price amount must be an integer non-negative number.
 * - Never blindly forwards arbitrary upstream fields, internal credentials, database info, or debug traces.
 */
export function parsePublicCatalogResponse(value: unknown): PublicCatalogData | null {
  if (!isRecord(value) || !Array.isArray(value.products)) {
    return null;
  }

  const parsedProducts: PublicCatalogProduct[] = [];

  for (const rawProduct of value.products) {
    if (!isRecord(rawProduct)) {
      return null;
    }

    if (!isNonEmptyString(rawProduct.slug) || !isNonEmptyString(rawProduct.name)) {
      return null;
    }

    if (!Array.isArray(rawProduct.variants)) {
      return null;
    }

    const parsedVariants: PublicCatalogVariant[] = [];

    for (const rawVariant of rawProduct.variants) {
      if (!isRecord(rawVariant)) {
        return null;
      }

      if (
        !isUuid(rawVariant.variant_id) ||
        !isNonEmptyString(rawVariant.sku) ||
        !isNonEmptyString(rawVariant.name)
      ) {
        return null;
      }

      if (!isRecord(rawVariant.price)) {
        return null;
      }

      const rawPrice = rawVariant.price;
      if (
        rawPrice.currency !== 'IDR' ||
        typeof rawPrice.amount !== 'number' ||
        !Number.isInteger(rawPrice.amount) ||
        rawPrice.amount < 0
      ) {
        return null;
      }

      const variant: PublicCatalogVariant = {
        variant_id: rawVariant.variant_id.trim(),
        sku: rawVariant.sku.trim(),
        name: rawVariant.name.trim(),
        price: {
          currency: 'IDR',
          amount: rawPrice.amount,
        },
      };

      if (isRecord(rawVariant.net_content)) {
        variant.net_content = {
          quantity:
            typeof rawVariant.net_content.quantity === 'string'
              ? rawVariant.net_content.quantity
              : null,
          uom:
            typeof rawVariant.net_content.uom === 'string'
              ? rawVariant.net_content.uom
              : null,
        };
      }

      parsedVariants.push(variant);
    }

    parsedProducts.push({
      slug: rawProduct.slug.trim(),
      name: rawProduct.name.trim(),
      variants: parsedVariants,
    });
  }

  return {
    products: parsedProducts,
  };
}
