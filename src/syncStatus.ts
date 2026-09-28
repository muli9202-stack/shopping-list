import { create } from 'zustand';

// Kept outside sync.ts so screens can show the status without loading the Firebase SDK.
export type SyncStatus = 'off' | 'connecting' | 'online' | 'error';
export const useSyncStatus = create<{ status: SyncStatus; error: string }>(() => ({ status: 'off', error: '' }));
