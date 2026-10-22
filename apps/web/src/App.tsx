import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './layout/Layout';
import { NotFound } from './pages/NotFound';
import { Privacy } from './pages/Privacy';
import { Profile } from './pages/Profile';
import { ForgotPassword } from './pages/ForgotPassword';
import { Search } from './pages/Search';
import { SeedPage } from './pages/SeedPage';
import { Login } from './pages/Login';
import { MyRuns } from './pages/MyRuns';
import { Register } from './pages/Register';
import { RunDetail } from './pages/RunDetail';
import { ResetPassword } from './pages/ResetPassword';
import { VerifyEmail } from './pages/VerifyEmail';
import { Welcome } from './pages/Welcome';

// Páginas pesadas o poco visitadas: se bajan solo cuando se entra a ellas.
const Account = lazy(() => import('./pages/Account').then((m) => ({ default: m.Account })));
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));
const Design = lazy(() => import('./pages/Design').then((m) => ({ default: m.Design })));
const EditRun = lazy(() => import('./pages/EditRun').then((m) => ({ default: m.EditRun })));
const NewRun = lazy(() => import('./pages/NewRun').then((m) => ({ default: m.NewRun })));

export function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Search />} />
          <Route path="seeds/:seed" element={<SeedPage />} />
          <Route path="u/:username" element={<Profile />} />
          <Route path="admin" element={<Admin />} />
          {import.meta.env.DEV ? <Route path="design" element={<Design />} /> : null}
          <Route path="privacy" element={<Privacy />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="verify-email" element={<VerifyEmail />} />
          <Route element={<RequireAuth allowWithoutUsername />}>
            <Route path="welcome" element={<Welcome />} />
          </Route>
          <Route path="runs/:id" element={<RunDetail />} />
          <Route element={<RequireAuth />}>
            <Route path="account" element={<Account />} />
            <Route path="runs" element={<MyRuns />} />
            <Route path="runs/new" element={<NewRun />} />
            <Route path="runs/:id/edit" element={<EditRun />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
