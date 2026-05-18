import { Routes } from '@angular/router';
import { Users } from './users/users';
import { Login } from './login/login';
import { Register } from './register/register';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },

    { path: 'login', component: Login },
    { path: 'register', component: Register },
    { path: 'users', component: Users },

    { path: '**', redirectTo: 'login' }
];