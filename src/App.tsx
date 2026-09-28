import { useEffect, useState, type ReactElement } from 'react';
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useApp } from './store';
import { isChainId, isMode, type ChainId, type Mode } from './types';
import { DialogHost } from './ui/dialog';
import { ToastHost } from './ui/toast';
import { startAutoBackup } from './autoBackup';
import HomeScreen from './screens/HomeScreen';
import ChainScreen from './screens/ChainScreen';
import SelectScreen from './screens/SelectScreen';
import ShopScreen from './screens/ShopScreen';
import SettingsScreen from './screens/SettingsScreen';
import AverageScreen from './screens/AverageScreen';
import HistoryScreen from './screens/HistoryScreen';
import InventoryScreen from './screens/InventoryScreen';
import SpendingScreen from './screens/SpendingScreen';
import CompareScreen from './screens/CompareScreen';
import JoinScreen from './screens/JoinScreen';
import BranchesScreen from './screens/BranchesScreen';
import MapEditorScreen from './screens/MapEditorScreen';
import NavScreen from './screens/NavScreen';

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

function BranchRoute({ chainId }: { chainId: ChainId }) {
  const { branchId = '' } = useParams();
  return <MapEditorScreen chainId={chainId} branchId={branchId} />;
}

export default function App() {
  const hydrated = useHydrated();
  const theme = useApp((s) => s.settings.theme ?? 'auto');
  const textSize = useApp((s) => s.settings.textSize ?? 'normal');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    root.setAttribute('data-text', textSize);
    // Keep the browser chrome in step with the theme.
    const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1419' : '#0f766e');
  }, [theme, textSize]);
  useEffect(() => {
    if (!hydrated) return;
    startAutoBackup();
    const sync = useApp.getState().settings.sync;
    if (sync?.enabled) import('./sync').then((m) => m.startSync(sync.firebaseConfig, sync.familyCode, 'resume')).catch(() => {});
  }, [hydrated]);
  if (!hydrated) return <div className="splash">טוען…</div>;
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/c/:chain" element={<WithChain render={(c) => <ChainScreen chainId={c} />} />} />
        <Route path="/join/:payload" element={<JoinScreen />} />
        <Route path="/spending" element={<SpendingScreen />} />
        <Route path="/compare" element={<CompareScreen />} />
        <Route path="/c/:chain/inventory" element={<WithChain render={(c) => <InventoryScreen chainId={c} />} />} />
        <Route path="/c/:chain/branches" element={<WithChain render={(c) => <BranchesScreen chainId={c} />} />} />
        <Route path="/c/:chain/branches/:branchId" element={<WithChain render={(c) => <BranchRoute chainId={c} />} />} />
        <Route path="/c/:chain/history" element={<WithChain render={(c) => <HistoryScreen chainId={c} />} />} />
        <Route path="/c/:chain/:mode" element={<WithMode render={(c, m) => <SelectScreen chainId={c} mode={m} />} />} />
        <Route path="/c/:chain/:mode/shop" element={<WithMode render={(c, m) => <ShopScreen chainId={c} mode={m} />} />} />
        <Route path="/c/:chain/:mode/nav" element={<WithMode render={(c, m) => <NavScreen chainId={c} mode={m} />} />} />
        <Route path="/c/:chain/:mode/average" element={<WithMode render={(c, m) => <AverageScreen chainId={c} mode={m} />} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <DialogHost />
      <ToastHost />
    </HashRouter>
  );
}
