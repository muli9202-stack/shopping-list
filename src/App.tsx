import { useEffect, useState, type ReactElement } from 'react';
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useApp } from './store';
import { isChainId, isMode, type ChainId, type Mode } from './types';
import { DialogHost } from './ui/dialog';
import HomeScreen from './screens/HomeScreen';
import ChainScreen from './screens/ChainScreen';
import CatalogScreen from './screens/CatalogScreen';
import SelectScreen from './screens/SelectScreen';
import ShopScreen from './screens/ShopScreen';
import SettingsScreen from './screens/SettingsScreen';

function useHydrated() {
  const [done, setDone] = useState(useApp.persist.hasHydrated());
  useEffect(() => {
    const unsub = useApp.persist.onFinishHydration(() => setDone(true));
    setDone(useApp.persist.hasHydrated());
    return unsub;
  }, []);
  return done;
}

/** Validates :chain (and optionally :mode) route params before rendering a screen. */
function WithChain({ render }: { render: (chainId: ChainId) => ReactElement }) {
  const { chain } = useParams();
  return isChainId(chain) ? render(chain) : <Navigate to="/" replace />;
}
function WithMode({ render }: { render: (chainId: ChainId, mode: Mode) => ReactElement }) {
  const { chain, mode } = useParams();
  return isChainId(chain) && isMode(mode) ? render(chain, mode) : <Navigate to="/" replace />;
}

export default function App() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="splash">טוען…</div>;
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/c/:chain" element={<WithChain render={(c) => <ChainScreen chainId={c} />} />} />
        <Route path="/c/:chain/catalog" element={<WithChain render={(c) => <CatalogScreen chainId={c} />} />} />
        <Route path="/c/:chain/:mode" element={<WithMode render={(c, m) => <SelectScreen chainId={c} mode={m} />} />} />
        <Route path="/c/:chain/:mode/shop" element={<WithMode render={(c, m) => <ShopScreen chainId={c} mode={m} />} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <DialogHost />
    </HashRouter>
  );
}
