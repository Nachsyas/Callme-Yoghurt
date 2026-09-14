<?php

declare(strict_types=1);

namespace App\Http\Controllers\Internal;

use App\Application\Catalog\GetAuthoritativeCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

class CatalogController extends Controller
{
    /**
     * Return authoritative sellable catalog for Next.js BFF.
     *
     * Invariants (Gate 0E.2A):
     * - Requires service authentication (service.auth middleware).
     * - Returns only sellable variants (active Finished Goods with active IDR price).
     * - Exposes zero internal operational data (stock, lots, warehouses, reservations, ledger).
     */
    public function index(GetAuthoritativeCatalogService $service): JsonResponse
    {
        $catalog = $service->execute();

        return response()->json($catalog, 200);
    }
}
