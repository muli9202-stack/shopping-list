import { useEffect } from 'react';
import { create } from 'zustand';
import { useApp, type Store } from '../store';

interface Toast {
  id: number;
  text: string;
  undo?: () => void;
}

const useToasts = create<{ toast: Toast | null }>(() => ({ toast: null }));
let seq = 0;

export function showToast(text: string, undo?: () => void) {
  useToasts.setState({ toast: { id: ++seq, text, undo } });
}

type DataOnly = Omit<Store, { [K in keyof Store]: Store[K] extends (...a: never[]) => unknown ? K : never }[keyof Store]>;

/** Runs a change and offers to take it back from a toast. */
export function withUndo(text: string, change: () => void) {
  const s = useApp.getState();
  const snapshot: Partial<DataOnly> = {
    categories: s.categories,
    products: s.products,
    lists: s.lists,
    history: s.history,
    branches: s.branches,
    stock: s.stock,
    budgets: s.budgets,
  };
  change();
  showToast(text, () => useApp.setState(snapshot));
}

export const haptic = (ms = 12) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
};

export function ToastHost() {
  const toast = useToasts((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useToasts.setState((s) => (s.toast?.id === toast.id ? { toast: null } : s)), toast.undo ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.text}</span>
      {toast.undo && (
        <button
          onClick={() => {
            toast.undo!();
            useToasts.setState({ toast: null });
          }}
        >
          ביטול
        </button>
      )}
    </div>
  );
}
