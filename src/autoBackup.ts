import { get as idbGet, set as idbSet } from 'idb-keyval';
import { exportData, useApp } from './store';
import { downloadExcel } from './excel';
import type { AppData } from './types';

// Hourly backups while the app is open: a silent snapshot kept in the device's
// storage, plus (when enabled in settings) an Excel file download.

export interface Snapshot {
  date: number;
  data: AppData;
}

const SNAPSHOTS_KEY = 'auto-backups';
const LAST_EXCEL_KEY = 'last-auto-excel';
const HOUR = 60 * 60 * 1000;
const KEEP = 24;

export async function listSnapshots(): Promise<Snapshot[]> {
  return (await idbGet<Snapshot[]>(SNAPSHOTS_KEY)) ?? [];
}

async function tick() {
  const now = Date.now();
  const data = exportData();
  if (!data.products.length && !data.history.length) return;

  const snaps = await listSnapshots();
  const last = snaps[0];
  // Only store a new snapshot when an hour passed and something changed.
  if (!last || (now - last.date >= HOUR && JSON.stringify(last.data) !== JSON.stringify(data))) {
    await idbSet(SNAPSHOTS_KEY, [{ date: now, data }, ...snaps].slice(0, KEEP));
  }

  if (useApp.getState().settings.autoExcel) {
    const lastExcel = (await idbGet<number>(LAST_EXCEL_KEY)) ?? 0;
    if (now - lastExcel >= HOUR) {
      await idbSet(LAST_EXCEL_KEY, now);
      downloadExcel(data);
    }
  }
}

export async function resetExcelTimer() {
  await idbSet(LAST_EXCEL_KEY, Date.now());
}

let started = false;
export function startAutoBackup() {
  if (started) return;
  started = true;
  const run = () => void tick().catch(() => {});
  run();
  setInterval(run, 60 * 1000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && run());
}
