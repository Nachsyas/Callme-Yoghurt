/**
 * Shipping and Delivery Foundation Types
 * Phase 1.7C.13 & Phase 1.7C.19 (Biteship Integration)
 */

export type DeliveryMethodOption = 'instant' | 'sameday' | 'nextday' | 'pickup';

export type ShippingServiceCategory = 'instant' | 'sameday' | 'nextday' | 'pickup' | 'other';

/**
 * Normalized internal shipping quote format.
 */
export interface ShippingQuote {
  quote_id: string;
  provider: 'Biteship' | 'Manual';
  courier_name: string;
  courier_code: string;
  service_name: string;
  service_code: string;
  service_type: ShippingServiceCategory;
  price: number;
  duration: string;
  cold_chain_compliant: boolean;
  description?: string;
}

/**
 * Normalized area structure returned by Biteship Maps API (GET /v1/maps/areas).
 */
export interface BiteshipArea {
  id: string;
  name: string;
  country_name?: string;
  country_code?: string;
  administrative_division_level_1_name?: string;
  administrative_division_level_1_type?: string;
  administrative_division_level_2_name?: string;
  administrative_division_level_2_type?: string;
  administrative_division_level_3_name?: string;
  administrative_division_level_3_type?: string;
  postal_code?: number | string;
  latitude?: number;
  longitude?: number;
}

/**
 * Raw pricing item from Biteship Rates API (POST /v1/rates/couriers).
 */
export interface BiteshipRateItemRaw {
  company?: string;
  courier_name: string;
  courier_code: string;
  courier_service_name: string;
  courier_service_code: string;
  description?: string;
  duration?: string;
  shipment_duration_range?: string;
  shipment_duration_unit?: string;
  service_type?: string;
  shipping_type?: string;
  price: number;
  type?: string;
  available_for_cash_on_delivery?: boolean;
  available_for_proof_of_delivery?: boolean;
}

/**
 * Item specification sent in Biteship rate calculation request.
 */
export interface BiteshipRateItemPayload {
  name: string;
  description?: string;
  value?: number;
  quantity?: number;
  weight: number; // in grams
  length?: number;
  width?: number;
  height?: number;
}

/**
 * Authoritative Origin Configuration (Bambu Apus, Cipayung, Jakarta Timur).
 */
export interface BiteshipOriginConfig {
  contact_name?: string;
  contact_phone?: string;
  address?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  area_id?: string;
}

export interface ShippingCalculationInput {
  city: string;
  district: string;
  weight: number; // in kg (legacy compatibility)
  weight_grams?: number; // authoritative weight in grams
  delivery_method: DeliveryMethodOption;
  province?: string;
  postal_code?: string;
  destination_area_id?: string;
  destination_latitude?: number;
  destination_longitude?: number;
  destination_postal_code?: string;
  destination_address?: string;
  items?: Array<{
    name: string;
    quantity: number;
    value?: number;
    weight_grams?: number;
    description?: string;
  }>;
}

export interface ShippingCalculationOutput {
  service: string;
  shipping_fee: number;
  estimated_delivery: string;
  cold_chain_fee: number;
  quote_id?: string;
  courier_name?: string;
  courier_code?: string;
  available_quotes?: ShippingQuote[];
  uncalculated?: boolean;
  error?: string;
}

export interface ShippingProvider {
  readonly name: string;
  calculateShipping(
    input: ShippingCalculationInput
  ): Promise<ShippingCalculationOutput> | ShippingCalculationOutput;
  getQuotes?(
    input: ShippingCalculationInput
  ): Promise<ShippingQuote[]>;
}
