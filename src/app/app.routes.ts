import { Routes } from '@angular/router';
import { Users } from './users/users';

export const routes: Routes = [
    { path: '', redirectTo: 'users', pathMatch: 'full' },

    { path: 'users', component: Users },
];

