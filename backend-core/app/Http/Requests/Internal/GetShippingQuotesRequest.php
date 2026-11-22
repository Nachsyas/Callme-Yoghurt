<?php

declare(strict_types=1);

namespace App\Http\Requests\Internal;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class GetShippingQuotesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.variant_id' => ['required', 'uuid'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'destination_area_id' => ['nullable', 'string', 'max:100'],
            'destination_postal_code' => ['nullable', 'string', 'max:10'],
            'destination_latitude' => ['nullable', 'numeric'],
            'destination_longitude' => ['nullable', 'numeric'],
            'city' => ['nullable', 'string', 'max:100'],
            'province' => ['nullable', 'string', 'max:100'],
            'district' => ['nullable', 'string', 'max:100'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $rawPayload = $this->all();

            // 1. Prohibit client from providing authoritative product weight or value
            $prohibitedFields = [
                'weight', 'weight_grams', 'price', 'unit_price', 'value', 'subtotal',
                'service_fee', 'shipping_fee', 'total', 'discount',
            ];

            if (isset($rawPayload['items']) && is_array($rawPayload['items'])) {
                foreach ($rawPayload['items'] as $index => $item) {
                    if (!is_array($item)) continue;
                    foreach ($item as $key => $val) {
                        if (in_array(strtolower((string) $key), $prohibitedFields, true)) {
                            $validator->errors()->add(
                                "items.{$index}.{$key}",
                                "Client is not authoritative for [{$key}]. Field is strictly prohibited."
                            );
                        }
                    }
                }
            }

            // Prohibit authoritative weight or fees at root
            foreach (['weight', 'weight_grams', 'price', 'shipping_fee', 'service_fee', 'total'] as $field) {
                if (array_key_exists($field, $rawPayload)) {
                    $validator->errors()->add(
                        $field,
                        "Client is not authoritative for [{$field}]. Field is strictly prohibited."
                    );
                }
            }
        });
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(
            response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()->toArray(),
            ], 422)
        );
    }
}
