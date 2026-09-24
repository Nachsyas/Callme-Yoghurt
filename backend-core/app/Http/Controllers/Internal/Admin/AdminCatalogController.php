<?php

declare(strict_types=1);

namespace App\Http\Controllers\Internal\Admin;

use App\Application\Admin\Catalog\AdminCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use InvalidArgumentException;
use Throwable;

class AdminCatalogController extends Controller
{
    public function __construct(
        private readonly AdminCatalogService $catalogService
    ) {}

    public function index(): JsonResponse
    {
        return response()->json($this->catalogService->listProducts());
    }

    public function storeProduct(Request $request): JsonResponse
    {
        $adminUserId = (string) $request->header('X-Admin-User-Id');

        try {
            $product = $this->catalogService->createProduct(
                $request->all(),
                $adminUserId,
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'message' => 'Product created successfully',
                'product' => $product,
            ], 201);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Failed to create product: ' . $e->getMessage()], 500);
        }
    }

    public function updateProduct(Request $request, string $id): JsonResponse
    {
        $adminUserId = (string) $request->header('X-Admin-User-Id');

        try {
            $product = $this->catalogService->updateProduct(
                $id,
                $request->all(),
                $adminUserId,
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'message' => 'Product updated successfully',
                'product' => $product,
            ]);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Failed to update product: ' . $e->getMessage()], 500);
        }
    }

    public function deactivateProduct(Request $request, string $id): JsonResponse
    {
        $adminUserId = (string) $request->header('X-Admin-User-Id');

        try {
            $product = $this->catalogService->deactivateProduct(
                $id,
                $adminUserId,
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'message' => 'Product deactivated successfully',
                'product' => $product,
            ]);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Failed to deactivate product: ' . $e->getMessage()], 500);
        }
    }

    public function storeVariant(Request $request): JsonResponse
    {
        $adminUserId = (string) $request->header('X-Admin-User-Id');

        try {
            $variant = $this->catalogService->createVariant(
                $request->all(),
                $adminUserId,
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'message' => 'Variant created successfully',
                'variant' => $variant,
            ], 201);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Failed to create variant: ' . $e->getMessage()], 500);
        }
    }

    public function updateVariant(Request $request, string $id): JsonResponse
    {
        $adminUserId = (string) $request->header('X-Admin-User-Id');

        try {
            $variant = $this->catalogService->updateVariant(
                $id,
                $request->all(),
                $adminUserId,
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'message' => 'Variant updated successfully',
                'variant' => $variant,
            ]);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Failed to update variant: ' . $e->getMessage()], 500);
        }
    }

    public function deactivateVariant(Request $request, string $id): JsonResponse
    {
        $adminUserId = (string) $request->header('X-Admin-User-Id');

        try {
            $variant = $this->catalogService->deactivateVariant(
                $id,
                $adminUserId,
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'message' => 'Variant deactivated successfully',
                'variant' => $variant,
            ]);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Failed to deactivate variant: ' . $e->getMessage()], 500);
        }
    }

    public function changePrice(Request $request, string $id): JsonResponse
    {
        $adminUserId = (string) $request->header('X-Admin-User-Id');

        $amount = $request->input('amount');
        if (!is_numeric($amount)) {
            return response()->json(['error' => 'Price amount is required and must be an integer.'], 422);
        }

        try {
            $price = $this->catalogService->changeVariantPrice(
                $id,
                (int) $amount,
                $adminUserId,
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'message' => 'Price updated successfully',
                'price' => $price,
            ]);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Failed to change price: ' . $e->getMessage()], 500);
        }
    }
}
