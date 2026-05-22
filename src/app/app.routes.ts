import { Routes } from '@angular/router';
import { Users } from './users/users';
import { Login } from './login/login';
import { Register } from './register/register';
import { Documents } from './documents/documents';
import { Monitoring } from './monitoring/monitoring';
import { DashboardComponent } from './dashboard/dashboard';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },

    { path: 'login', component: Login },
    { path: 'dashboard', component: DashboardComponent, },
    { path: 'register', component: Register },
    { path: 'users', component: Users },
    { path: 'documents', component: Documents },
    { path: 'monitoring', component: Monitoring },

    { path: '**', redirectTo: 'login' }
];