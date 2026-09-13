<?php

declare(strict_types=1);

namespace App\Http\Requests\Internal;

use App\Domain\CRM\Services\PhoneBlindIndexService;
use App\Domain\Sales\Enums\DeliveryMethod;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

class CreateOrderRequest extends FormRequest
{
    /**
     * Internal service requests are authenticated via ValidateInternalServiceToken middleware.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'customer' => ['required', 'array'],
            'customer.name' => ['required', 'string', 'max:255'],
            'customer.whatsapp' => ['required', 'string', 'max:50'],
            'customer.address' => ['required', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.variant_id' => ['required', 'uuid'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'delivery_method' => ['required', 'string', Rule::in(DeliveryMethod::values())],
        ];
    }

    /**
     * Configure the validator instance with strict structural guards.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            // 1. Validate Idempotency-Key header
            $idempotencyKey = $this->header('Idempotency-Key');
            if (!is_string($idempotencyKey) || trim($idempotencyKey) === '') {
                $validator->errors()->add('idempotency_key', 'The Idempotency-Key header is required.');
                return;
            }

            if (strlen($idempotencyKey) > 200) {
                $validator->errors()->add('idempotency_key', 'The Idempotency-Key header cannot exceed 200 characters.');
                return;
            }

            $rawPayload = $this->all();

            // 2. Strict allowed root keys check
            $allowedRootKeys = ['customer', 'items', 'delivery_method'];
            $extraRootKeys = array_diff(array_keys($rawPayload), $allowedRootKeys);
            if (!empty($extraRootKeys)) {
                $validator->errors()->add(
                    'payload',
                    'Unexpected fields in request root: ' . implode(', ', $extraRootKeys)
                );
            }

            // 3. Strict allowed customer keys check
            if (isset($rawPayload['customer']) && is_array($rawPayload['customer'])) {
                $allowedCustomerKeys = ['name', 'whatsapp', 'address'];
                $extraCustomerKeys = array_diff(array_keys($rawPayload['customer']), $allowedCustomerKeys);
                if (!empty($extraCustomerKeys)) {
                    $validator->errors()->add(
                        'customer',
                        'Unexpected fields in customer: ' . implode(', ', $extraCustomerKeys)
                    );
                }

                // Canonical phone validation
                if (isset($rawPayload['customer']['whatsapp']) && is_string($rawPayload['customer']['whatsapp'])) {
                    $normalizedPhone = PhoneBlindIndexService::normalize($rawPayload['customer']['whatsapp']);
                    if (strlen($normalizedPhone) < 8 || strlen($normalizedPhone) > 16) {
                        $validator->errors()->add(
                            'customer.whatsapp',
                            'The customer whatsapp phone number is invalid.'
                        );
                    }
                }
            }

            // 4. Strict allowed items keys check & duplicate variant detection
            if (isset($rawPayload['items']) && is_array($rawPayload['items'])) {
                $allowedItemKeys = ['variant_id', 'quantity'];
                $seenVariantIds = [];

                foreach ($rawPayload['items'] as $index => $item) {
                    if (!is_array($item)) {
                        continue;
                    }

                    $extraItemKeys = array_diff(array_keys($item), $allowedItemKeys);
                    if (!empty($extraItemKeys)) {
                        $validator->errors()->add(
                            "items.{$index}",
                            "Unexpected fields in item [{$index}]: " . implode(', ', $extraItemKeys)
                        );
                    }

                    if (isset($item['variant_id']) && is_string($item['variant_id'])) {
                        $normalizedVariantId = strtolower(trim($item['variant_id']));
                        if (in_array($normalizedVariantId, $seenVariantIds, true)) {
                            $validator->errors()->add(
                                "items.{$index}.variant_id",
                                "Duplicate variant_id [{$item['variant_id']}] is rejected."
                            );
                        } else {
                            $seenVariantIds[] = $normalizedVariantId;
                        }
                    }
                }
            }

            // 5. Global rejection of prohibited authority fields
            $prohibitedFields = [
                'price', 'unit_price', 'subtotal', 'total', 'total_amount',
                'stock', 'warehouse', 'lot', 'discount', 'order_status',
            ];
            $this->checkProhibitedFieldsRecursively($rawPayload, $prohibitedFields, $validator);
        });
    }

    /**
     * Recursively scan payload for prohibited transaction-authority fields.
     *
     * @param array<string, mixed> $data
     * @param array<int, string> $prohibited
     * @param Validator $validator
     */
    protected function checkProhibitedFieldsRecursively(array $data, array $prohibited, Validator $validator): void
    {
        foreach ($data as $key => $value) {
            if (in_array(strtolower((string) $key), $prohibited, true)) {
                $validator->errors()->add(
                    (string) $key,
                    "Client is not authoritative for [{$key}]. Field is strictly prohibited."
                );
            }
            if (is_array($value)) {
                $this->checkProhibitedFieldsRecursively($value, $prohibited, $validator);
            }
        }
    }

    /**
     * Return standardized JSON 422 for API validation failures.
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(
            response()->json([
                'error' => 'Validation failed',
                'messages' => $validator->errors()->toArray(),
            ], 422)
        );
    }
}
