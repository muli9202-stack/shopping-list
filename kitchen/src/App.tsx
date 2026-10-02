import { Component, useEffect, useState, type ReactNode } from 'react';
import { HashRouter, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { IS_ARTIFACT } from './env';
import { useStore } from './store';
import { ConfirmDialog, Player } from './ui';
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

/** Shows what went wrong instead of a blank page if a screen crashes. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <div className="card crash">
          <h2>משהו השתבש בתצוגה</h2>
          <p className="muted">הנתונים שלך שמורים. נסו לחזור לדף הבית. אם זה חוזר, שלחו צילום מסך של ההודעה הזאת.</p>
          <pre dir="ltr">{String(this.state.error.message || this.state.error)}</pre>
          <button className="btn" onClick={() => location.reload()}>
            חזרה לדף הבית
          </button>
        </div>
      </div>
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

function AppInner() {
  // IndexedDB loads asynchronously; render only once saved data is in, so
  // nothing typed in the first instant can overwrite it.
  const [ready, setReady] = useState(useStore.persist.hasHydrated());
  useEffect(() => {
    if (ready) return;
    return useStore.persist.onFinishHydration(() => setReady(true));
  }, [ready]);
  if (!ready) return <div className="loading">טוען…</div>;

  // Inside the chat the page can't own the URL, so routing stays in memory.
  const Router = IS_ARTIFACT ? MemoryRouter : HashRouter;
  return (
    <Router>
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
      <ConfirmDialog />
    </Router>
  );
}
