// What a request names, checked before it reaches a command line (a name,
// a namespace, a container), and errors as the user reads them.

import { PluginError } from '@hyperpane/sdk/server';
import { NAME, type Target } from '../shared/index.ts';
import { NAMESPACE } from './runtimes/kube.ts';
import type { Found } from './targets.ts';

export const name = (v: unknown, what = 'name'): string => {
  if (typeof v !== 'string' || !NAME.test(v)) throw new PluginError(`That isn’t a ${what}.`);
  return v;
};
export const ns = (t: Target, v: unknown): string => {
  const n = v === undefined || v === null || v === '' ? (t.namespace ?? 'default') : String(v);
  if (!NAMESPACE.test(n)) throw new PluginError(`“${n}” isn’t a namespace.`);
  return n;
};
export const one = (t: Target, v: unknown) => {
  const n = ns(t, v);
  if (n === '*') throw new PluginError('Say which namespace it’s in.');
  return n;
};
export const container = (v: unknown) => (v ? name(v, 'container') : undefined);
/** Errors from the tools are the user's to read. */
export const said = async <T>(f: () => Promise<T>): Promise<T> => {
  try {
    return await f();
  } catch (e) {
    if (e instanceof PluginError) throw e;
    throw new PluginError((e as Error).message);
  }
};
export const only = <K extends keyof Found>(f: Found, k: K, what: string): NonNullable<Found[K]> => {
  if (!f[k]) throw new PluginError(`${f.t.name} can’t ${what}.`);
  return f[k]!;
};
