// Talking to the server part: its id, a call that toasts what goes wrong, a
// call's answer loaded into a component, and the app's confirm for what
// can't be undone.

import { useEffect, useState } from 'react';
import { useHost } from '@hyperpane/sdk/client';

export const ID = 'containers';
export type Host = ReturnType<typeof useHost>;

/** Calls the server part, toasting what goes wrong. */
export function useCall() {
  const host = useHost();
  return async <T>(req: Record<string, unknown>): Promise<T | undefined> => {
    try {
      return await host.call<T>(ID, req);
    } catch (e) {
      host.app.toast((e as Error).message, { error: true });
      return undefined;
    }
  };
}

/** What a call answers, loaded once (again on `reload`). */
export function useLoad<T>(req: Record<string, unknown> | null): { value?: T; error?: string; reload(): void } {
  const host = useHost();
  const [state, setState] = useState<{ value?: T; error?: string }>({});
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(req);
  useEffect(() => {
    if (!req) return;
    let live = true;
    setState({});
    host.call<T>(ID, req).then(
      (value) => live && setState({ value }),
      (e: Error) => live && setState({ error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [host, key, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function confirmer(host: Host) {
  return (title: string, message: string, label: string) => host.ui.confirm({ title, message, confirm: label, destructive: true });
}
