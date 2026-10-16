import { Route, Routes } from 'react-router-dom';
import { Layout } from './layout/Layout';
import { Design } from './pages/Design';
import { Home } from './pages/Home';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="design" element={<Design />} />
      </Route>
    </Routes>
  );
}
