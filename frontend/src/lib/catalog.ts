export interface PublicCatalogVariant {
  variant_id: string;
  sku: string;
  name: string;
  net_content?: {
    quantity: string | null;
    uom: string | null;
  };
  price: {
    currency: string;
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
 * Validates and transforms upstream ERP catalog response into an explicit, sanitized public DTO.
 *
 * Invariants (Gate 0E.2A):
 * - Strict schema parsing with zero `any`.
 * - Every variant must have an actual UUID variant_id, non-empty SKU, name, and integer price >= 0.
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
        !isNonEmptyString(rawVariant.variant_id) ||
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
        !isNonEmptyString(rawPrice.currency) ||
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
          currency: rawPrice.currency.trim(),
          amount: rawPrice.amount,
        },
      };

      if (isRecord(rawVariant.net_content)) {
        variant.net_content = {
          quantity: typeof rawVariant.net_content.quantity === 'string'
            ? rawVariant.net_content.quantity
            : null,
          uom: typeof rawVariant.net_content.uom === 'string'
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
