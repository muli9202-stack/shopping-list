import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './store';
import { Player } from './ui';
import { ChagScreen, HomeScreen, SettingsScreen, ShabbatScreen, TableChooseScreen } from './screens';
import {
  CategoriesScreen,
  CategoryScreen,
  ChefsScreen,
  CollectionScreen,
  NotFound,
  RecipeEditScreen,
  RecipeScreen,
} from './library';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  // IndexedDB loads asynchronously; render only once saved data is in, so
  // nothing typed in the first instant can overwrite it.
  const [ready, setReady] = useState(useStore.persist.hasHydrated());
  useEffect(() => {
    if (ready) return;
    return useStore.persist.onFinishHydration(() => setReady(true));
  }, [ready]);
  if (!ready) return <div className="loading">טוען…</div>;

  return (
    <HashRouter>
      <ScrollTop />
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/table" element={<TableChooseScreen />} />
        <Route path="/table/shabbat" element={<ShabbatScreen />} />
        <Route path="/table/chag" element={<ChagScreen />} />
        <Route path="/videos" element={<ChefsScreen key="v" mode="videos" />} />
        <Route path="/videos/:chefId" element={<CategoriesScreen mode="videos" />} />
        <Route path="/videos/:chefId/:catId" element={<CategoryScreen mode="videos" />} />
        <Route path="/recipes" element={<ChefsScreen key="r" mode="recipes" />} />
        <Route path="/recipes/:chefId" element={<CategoriesScreen mode="recipes" />} />
        <Route path="/recipes/:chefId/:catId" element={<CategoryScreen mode="recipes" />} />
        <Route path="/recipes/:chefId/:catId/new" element={<RecipeEditScreen />} />
        <Route path="/recipe/:id" element={<RecipeScreen />} />
        <Route path="/recipe/:id/edit" element={<RecipeEditScreen />} />
        <Route path="/collection/:which" element={<CollectionScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Player />
    </HashRouter>
  );
}
