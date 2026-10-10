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
  description?: string;
  variants: PublicCatalogVariant[];
}

export interface PublicCatalogData {
  products: PublicCatalogProduct[];
}

export interface PresentationMetadata {
  brandColor: string;
  darkBg: string;
  colorClass: string;
  artwork?: string;
  sub: string;
  tagline: string;
}

export const PRESENTATION_OVERRIDES: Record<string, PresentationMetadata> = {
  plain: {
    brandColor: '#cba258',
    darkBg: '#271900',
    colorClass: 'bg-[#cba258]',
    artwork: '/images/products/plain-250-500.png',
    sub: 'Yoghurt rasa Plain.',
    tagline: 'Varian Plain Callme Yoghurt.',
  },
  stroberi: {
    brandColor: '#D81E5B',
    darkBg: '#3b1c21',
    colorClass: 'bg-[#D81E5B]',
    artwork: '/images/products/stroberi-250-500.png',
    sub: 'Yoghurt rasa Stroberi.',
    tagline: 'Varian Stroberi Callme Yoghurt.',
  },
  mangga: {
    brandColor: '#F9A03F',
    darkBg: '#3d230d',
    colorClass: 'bg-[#F9A03F]',
    artwork: '/images/products/mangga-250-500.png',
    sub: 'Yoghurt rasa Mangga.',
    tagline: 'Varian Mangga Callme Yoghurt.',
  },
  melon: {
    brandColor: '#A1C349',
    darkBg: '#232d0f',
    colorClass: 'bg-[#A1C349]',
    artwork: '/images/products/melon-250-500.png',
    sub: 'Yoghurt rasa Melon.',
    tagline: 'Varian Melon Callme Yoghurt.',
  },
  anggur: {
    brandColor: '#7A3B69',
    darkBg: '#3B1C33',
    colorClass: 'bg-[#7A3B69]',
    artwork: '/images/products/anggur-250-500.png',
    sub: 'Yoghurt rasa Anggur.',
    tagline: 'Varian Anggur Callme Yoghurt.',
  },
  leci: {
    brandColor: '#ff8da1',
    darkBg: '#4a1523',
    colorClass: 'bg-[#ff8da1]',
    artwork: '/images/products/leci-250-500.png',
    sub: 'Yoghurt rasa Leci.',
    tagline: 'Varian Leci Callme Yoghurt.',
  },
  vanila: {
    brandColor: '#f3e5AB',
    darkBg: '#3d361c',
    colorClass: 'bg-[#f3e5AB]',
    artwork: '/images/products/vanila-250-500.png',
    sub: 'Yoghurt rasa Vanila.',
    tagline: 'Varian Vanila Callme Yoghurt.',
  },
};

export const DEFAULT_PRESENTATION_FALLBACK: PresentationMetadata = {
  brandColor: '#00754A',
  darkBg: '#1E3932',
  colorClass: 'bg-[#00754A]',
  artwork: undefined,
  sub: 'Callme Yoghurt.',
  tagline: 'Varian Callme Yoghurt.',
};

export function getProductPresentation(slug: string): PresentationMetadata {
  const normalized = slug.trim().toLowerCase();
  return PRESENTATION_OVERRIDES[normalized] || DEFAULT_PRESENTATION_FALLBACK;
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

const NET_CONTENT_SCALE = BigInt(1000000);
const DECIMAL_STRING_REGEX = /^\d+(\.\d+)?$/;

/**
 * Normalizes authoritative variant net content into milliliters (ml) for storefront sizing.
 *
 * Invariants (Gate 0E.2A.2):
 * - Authoritative PostgreSQL DECIMAL(18,6) exact parsing using BigInt scaled arithmetic.
 * - Zero floating-point drift: rejects parseFloat, Number arithmetic, and Math.round/floor/ceil.
 * - Supported UOMs: ML (direct), L (multiplied by BigInt(1000)).
 * - Exact whole milliliter requirement: rejects any value where (scaledMl % BigInt(1000000) !== BigInt(0)).
 * - Rejects non-strings, negative, zero, scientific notation, NaN, Infinity, more than 6 decimal places, or unsupported UOMs.
 * - Never falls back to SKU string guessing.
 */
export function parseNetContentMl(quantity: unknown, uom: unknown): number | null {
  if (typeof quantity !== "string" || typeof uom !== "string") {
    return null;
  }

  const trimmedQty = quantity.trim();
  const trimmedUom = uom.trim().toUpperCase();

  if (trimmedQty.length === 0 || trimmedUom.length === 0) {
    return null;
  }

  if (trimmedUom !== "ML" && trimmedUom !== "L") {
    return null;
  }

  // Reject signs (+/-), scientific notation (1e3), non-digits, multiple dots, etc.
  if (!DECIMAL_STRING_REGEX.test(trimmedQty)) {
    return null;
  }

  const parts = trimmedQty.split(".");
  const wholePartStr = parts[0];
  const fracPartStr = parts[1] || "";

  // PostgreSQL DECIMAL(18,6) allows at most 6 fractional digits
  if (fracPartStr.length > 6) {
    return null;
  }

  const paddedFracStr = fracPartStr.padEnd(6, "0");

  let whole: bigint;
  let fraction: bigint;
  try {
    whole = BigInt(wholePartStr);
    fraction = BigInt(paddedFracStr);
  } catch {
    return null;
  }

  const scaledQuantity = whole * NET_CONTENT_SCALE + fraction;
  if (scaledQuantity <= BigInt(0)) {
    return null;
  }

  let scaledMl: bigint;
  if (trimmedUom === "ML") {
    scaledMl = scaledQuantity;
  } else if (trimmedUom === "L") {
    scaledMl = scaledQuantity * BigInt(1000);
  } else {
    return null;
  }

  // Must yield an exact whole milliliter
  if (scaledMl % NET_CONTENT_SCALE !== BigInt(0)) {
    return null;
  }

  const mlBigInt = scaledMl / NET_CONTENT_SCALE;
  if (mlBigInt <= BigInt(0) || mlBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }

  return Number(mlBigInt);
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

    const parsedProduct: PublicCatalogProduct = {
      slug: rawProduct.slug.trim(),
      name: rawProduct.name.trim(),
      variants: parsedVariants,
    };
    if (typeof rawProduct.description === 'string' && rawProduct.description.trim().length > 0) {
      parsedProduct.description = rawProduct.description.trim();
    }
    parsedProducts.push(parsedProduct);
  }

  return {
    products: parsedProducts,
  };
}
