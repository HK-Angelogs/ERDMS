// ./auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // 1. Check if user is logged in at all
    if (!authService.isLoggedIn()) {
        router.navigate(['/login']);
        return false;
    }

    // 2. Prevent access to protected routes if password change is required
    if (authService.requiresPasswordChange()) {
        router.navigate(['/change-password']);
        return false;
    }

    return true;
};