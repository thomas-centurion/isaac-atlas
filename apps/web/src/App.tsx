import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './layout/Layout';
import { Account } from './pages/Account';
import { Design } from './pages/Design';
import { ForgotPassword } from './pages/ForgotPassword';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { MyRuns } from './pages/MyRuns';
import { NewRun } from './pages/NewRun';
import { Register } from './pages/Register';
import { RunDetail } from './pages/RunDetail';
import { ResetPassword } from './pages/ResetPassword';
import { VerifyEmail } from './pages/VerifyEmail';
import { Welcome } from './pages/Welcome';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="design" element={<Design />} />
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
        </Route>
      </Route>
    </Routes>
  );
}
