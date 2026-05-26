import { Routes } from '@angular/router';
import { Users } from './users/users';
import { Login } from './login/login';
import { Register } from './register/register';
import { Documents } from './documents/documents';
import { Monitoring } from './monitoring/monitoring';
import { DashboardComponent } from './dashboard/dashboard';
import { changePassword } from './change-password/change-password';
import { authGuard } from './auth.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },

    { path: 'login', component: Login },
    { path: 'register', component: Register },

    { path: 'change-password', component: changePassword },

    { path: 'users', component: Users, canActivate: [authGuard] },
    { path: 'documents', component: Documents, canActivate: [authGuard] },
    { path: 'monitoring', component: Monitoring, canActivate: [authGuard] },
    { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },

    { path: '**', redirectTo: 'login' }
];