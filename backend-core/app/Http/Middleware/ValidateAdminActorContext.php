<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Admin\Enums\AdminRole;
use App\Domain\Admin\Enums\AdminStatus;
use App\Domain\Admin\Models\AdminUser;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class ValidateAdminActorContext
{
    /**
     * Handle an incoming internal admin request.
     * Enforces defense-in-depth: validates that the forwarded admin actor exists,
     * is ACTIVE, and that the specified role matches the database authority.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $adminUserId = $request->header('X-Admin-User-Id');
        $adminRole = $request->header('X-Admin-Role');

        if (!is_string($adminUserId) || !Str::isUuid($adminUserId)) {
            return response()->json([
                'error' => 'Forbidden: missing or invalid admin actor identity',
            ], 403);
        }

        if (!is_string($adminRole) || ($adminRole !== AdminRole::OWNER->value && $adminRole !== AdminRole::ADMIN->value)) {
            return response()->json([
                'error' => 'Forbidden: invalid or missing admin role context',
            ], 403);
        }

        /** @var AdminUser|null $adminUser */
        $adminUser = AdminUser::find($adminUserId);

        if ($adminUser === null) {
            return response()->json([
                'error' => 'Forbidden: admin user not found',
            ], 403);
        }

        if ($adminUser->status !== AdminStatus::ACTIVE) {
            return response()->json([
                'error' => 'Forbidden: admin user is inactive or suspended',
            ], 403);
        }

        if ($adminUser->role->value !== $adminRole) {
            return response()->json([
                'error' => 'Forbidden: admin role mismatch',
            ], 403);
        }

        $request->attributes->set('admin_user', $adminUser);

        return $next($request);
    }
}
