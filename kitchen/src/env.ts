/** True in the single-file build that runs inside a claude.ai Artifact. */
export const IS_ARTIFACT = import.meta.env.VITE_ARTIFACT === '1';

type Use = (name: string) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** The Artifact viewer's capability entry point, when the page runs inside one. */
export function claudeUse(name: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const use = (window as unknown as { claude?: { use?: Use } }).claude?.use;
  return use ? use(name).catch(() => null) : Promise.resolve(null);
}
