<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Admin\Services\AdminAuthenticationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AdminAuthController
{
    public function __construct(
        private readonly AdminAuthenticationService $authService
    ) {}

    /**
     * Authenticate admin credentials and issue secure session cookie.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $email = mb_strtolower(trim($validated['email']));
        $ip = $request->ip() ?? 'unknown';
        $throttleKey = 'admin_login:' . Str::transliterate($email . '|' . $ip);

        // Rate Limiter: 5 attempts per 15 minutes per identity
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            return response()->json([
                'error' => 'Too many login attempts. Please try again later.',
                'retry_after_seconds' => $seconds,
            ], 429);
        }

        $result = $this->authService->login(
            $email,
            $validated['password'],
            $ip,
            $request->userAgent()
        );

        if (! $result['success']) {
            RateLimiter::hit($throttleKey, 15 * 60);

            return response()->json([
                'error' => 'Invalid credentials',
            ], 401);
        }

        RateLimiter::clear($throttleKey);

        $isProduction = app()->environment('production');
        $cookie = Cookie::make(
            name: 'callme_admin_session',
            value: $result['token'],
            minutes: 1440, // 24 hours
            path: '/',
            domain: null,
            secure: $isProduction,
            httpOnly: true,
            raw: false,
            sameSite: 'lax'
        );

        return response()->json([
            'user' => $result['user'],
            'session_created' => true,
        ], 200)->withCookie($cookie);
    }

    /**
     * Terminate admin session and clear cookie.
     */
    public function logout(Request $request): JsonResponse
    {
        $token = $request->cookie('callme_admin_session')
            ?? ($request->bearerToken() ?? null);

        if (! $token && $request->hasHeader('cookie')) {
            $rawCookies = explode(';', (string) $request->header('cookie'));
            foreach ($rawCookies as $cookieStr) {
                $parts = explode('=', trim($cookieStr), 2);
                if (count($parts) === 2 && $parts[0] === 'callme_admin_session') {
                    $token = $parts[1];
                    break;
                }
            }
        }

        $this->authService->logout(
            $token,
            $request->ip(),
            $request->userAgent()
        );

        $isProduction = app()->environment('production');
        $clearedCookie = Cookie::make(
            name: 'callme_admin_session',
            value: '',
            minutes: -2628000,
            path: '/',
            domain: null,
            secure: $isProduction,
            httpOnly: true,
            raw: false,
            sameSite: 'lax'
        );

        return response()->json([
            'message' => 'Logged out successfully',
        ], 200)->withCookie($clearedCookie);
    }
}
