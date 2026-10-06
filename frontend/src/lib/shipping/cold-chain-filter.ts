/**
 * Cold-Chain Logistics Business Filter (SOP 01 & Phase 1.7C.19)
 *
 * Invariants:
 * 1. Dairy yoghurt requires active or insulated temperature preservation (0–5°C).
 * 2. Regular multi-day transit (> 1 day / 2–5 days) in unrefrigerated vehicles is
 *    strictly PROHIBITED because room temperature transit > 3 days spoils live cultures.
 * 3. Inside Jakarta:
 *    - Instant courier (Grab Instant, Gojek Instant) is permitted.
 *    - Same Day delivery (Paxel Same Day, Grab/Gojek Same Day) is permitted.
 *    - Valid Next Day delivery is permitted if available.
 * 4. Outside Jakarta:
 *    - Only sufficiently fast services (e.g., genuine Next Day / Overnight like JNE YES,
 *      TIKI ONS, Paxel) or Same Day if serviced by the courier are permitted.
 * 5. All Standard / Reguler / Kargo / Economy services (> 1 day duration) are rejected.
 */

import type { BiteshipRateItemRaw, ShippingQuote, ShippingServiceCategory } from './types.ts';

export interface DestinationContext {
  province?: string;
  city?: string;
  isJakarta?: boolean;
}

/**
 * Checks if destination is located within DKI Jakarta / Jakarta metropolitan area.
 */
export function isJakartaLocation(context: DestinationContext): boolean {
  if (context.isJakarta !== undefined) return context.isJakarta;
  const prov = (context.province || '').toLowerCase();
  const city = (context.city || '').toLowerCase();
  return (
    prov.includes('jakarta') ||
    prov.includes('dki') ||
    city.includes('jakarta') ||
    city.includes('jaktim') ||
    city.includes('jaksel') ||
    city.includes('jakpus') ||
    city.includes('jakbar') ||
    city.includes('jakut')
  );
}

/**
 * Detects whether a rate item falls into instant, sameday, or legitimate nextday category.
 */
export function categorizeBiteshipService(rate: BiteshipRateItemRaw): ShippingServiceCategory {
  const serviceType = (rate.service_type || '').toLowerCase();
  const type = (rate.type || '').toLowerCase();
  const serviceCode = (rate.courier_service_code || '').toLowerCase();
  const serviceName = (rate.courier_service_name || '').toLowerCase();

  // 1. Instant check
  if (
    serviceType === 'instant' ||
    type === 'instant' ||
    serviceCode.includes('instant') ||
    serviceName.includes('instant')
  ) {
    return 'instant';
  }

  // 2. Same Day check
  if (
    serviceType === 'same_day' ||
    type === 'same_day' ||
    serviceCode.includes('same_day') ||
    serviceCode.includes('sameday') ||
    serviceName.includes('same day') ||
    serviceName.includes('sameday')
  ) {
    return 'sameday';
  }

  // 3. Next Day / Overnight check
  if (
    serviceType === 'next_day' ||
    type === 'next_day' ||
    serviceCode === 'yes' || // JNE Yakin Esok Sampai
    serviceCode === 'ons' || // TIKI Over Night Services
    serviceCode === 'sds' || // Same Day / Super Fast
    serviceCode.includes('next_day') ||
    serviceCode.includes('nextday') ||
    serviceName.includes('next day') ||
    serviceName.includes('overnight') ||
    serviceName.includes('esok')
  ) {
    return 'nextday';
  }

  return 'other';
}

/**
 * Validates if the duration represents 1 day or faster.
 * Blocks any service with multi-day transit (> 1 day / 2-5 days).
 */
export function isWithinColdChainDuration(rate: BiteshipRateItemRaw): boolean {
  const duration = (rate.duration || '').toLowerCase();
  const unit = (rate.shipment_duration_unit || '').toLowerCase();
  const range = (rate.shipment_duration_range || '').trim();

  // If duration is in hours, it's fast (< 24 hours)
  if (unit === 'hours' || duration.includes('hour') || duration.includes('jam')) {
    return true;
  }

  // If duration explicitly says "same day"
  if (duration.includes('same day') || duration.includes('hari yang sama')) {
    return true;
  }

  // If unit is days, check range
  if (unit === 'days' || duration.includes('day') || duration.includes('hari')) {
    // "1 - 1" or "1" is next day
    if (range === '1' || range === '1 - 1' || range === '0 - 1') {
      return true;
    }
    // Any range exceeding 1 day (e.g. "1 - 2", "2 - 3", "2 - 5") is rejected
    if (
      range.includes('2') ||
      range.includes('3') ||
      range.includes('4') ||
      range.includes('5') ||
      duration.includes('2') ||
      duration.includes('3') ||
      duration.includes('4') ||
      duration.includes('5')
    ) {
      return false;
    }
  }

  return false;
}

/**
 * Filters and normalizes raw Biteship rates against Callme Yoghurt Cold Chain Policy.
 */
export function filterColdChainQuotes(
  rawRates: BiteshipRateItemRaw[],
  destination: DestinationContext
): ShippingQuote[] {
  if (!Array.isArray(rawRates) || rawRates.length === 0) {
    return [];
  }

  const isJakarta = isJakartaLocation(destination);
  const compliantQuotes: ShippingQuote[] = [];

  for (const rate of rawRates) {
    if (!rate || typeof rate !== 'object') {
      continue;
    }

    // 1. Price validation: strictly non-negative, finite positive price
    if (typeof rate.price !== 'number' || !Number.isFinite(rate.price) || rate.price <= 0) {
      continue;
    }

    // 2. Identify category
    const category = categorizeBiteshipService(rate);

    // Filter out standard, reguler, cargo, trucking, economy
    if (category === 'other') {
      continue;
    }

    // 3. Duration validation
    if (!isWithinColdChainDuration(rate)) {
      continue;
    }

    // 4. Policy enforcement by destination
    if (isJakarta) {
      // Jakarta permits instant, sameday, and nextday
      if (category !== 'instant' && category !== 'sameday' && category !== 'nextday') {
        continue;
      }
    } else {
      // Outside Jakarta: only instant/sameday if serviced, or legitimate nextday
      if (category !== 'nextday' && category !== 'sameday' && category !== 'instant') {
        continue;
      }
    }

    const quoteId = `biteship_${rate.courier_code}_${rate.courier_service_code}_${rate.price}`;
    compliantQuotes.push({
      quote_id: quoteId,
      provider: 'Biteship',
      courier_name: rate.courier_name || rate.company || rate.courier_code.toUpperCase(),
      courier_code: rate.courier_code,
      service_name: rate.courier_service_name || rate.courier_service_code.toUpperCase(),
      service_code: rate.courier_service_code,
      service_type: category,
      price: Math.round(rate.price),
      duration: rate.duration || (category === 'instant' ? '1-3 hours' : category === 'sameday' ? 'Same day' : '1 day'),
      cold_chain_compliant: true,
      description: rate.description || 'Pengiriman dingin sesuai SOP 01 (Insulated & Icepack)',
    });
  }

  // Sort: instant first, then sameday, then nextday, sorted by price ascending
  const priorityMap: Record<ShippingServiceCategory, number> = {
    instant: 1,
    sameday: 2,
    nextday: 3,
    pickup: 4,
    other: 5,
  };

  compliantQuotes.sort((a, b) => {
    const prioDiff = (priorityMap[a.service_type] || 99) - (priorityMap[b.service_type] || 99);
    if (prioDiff !== 0) return prioDiff;
    return a.price - b.price;
  });

  return compliantQuotes;
}
