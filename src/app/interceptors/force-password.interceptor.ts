import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth.service';

/**
 * forcePasswordInterceptor — centralized 403/requiresPasswordChange handler.
 *
 * Catches any API response with status 403 and requiresPasswordChange: true.
 * This covers edge cases that frontend state cannot:
 *   - stale tabs with an old JWT
 *   - direct URL access with a valid but force-change token
 *   - parallel tabs where password was not yet changed
 *
 * On detection: clears stored user state and redirects to /change-password.
 * The error is re-thrown so that individual component error handlers still fire.
 */
export const forcePasswordInterceptor: HttpInterceptorFn = (req, next) => {
    const router = inject(Router);
    const authService = inject(AuthService);

    return next(req).pipe(
        catchError((error) => {
            if (
                error.status === 403 &&
                error.error?.requiresPasswordChange === true
            ) {
                // Update stored user state to reflect enforcement state.
                const user = authService.getUser();
                if (user) {
                    user.isdefaultPassword = true;
                    authService.saveUser(user);
                }

                router.navigate(['/change-password']);
            }

            return throwError(() => error);
        })
    );
};