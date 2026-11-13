// Docker's, Podman's and nerdctl's own calls: history (an image's layers),
// diskUsage, prune (clean up) and run (an image).

import { PluginError } from '@hyperpane/sdk/server';
import type { Prune, RunSpec } from '../../shared/index.ts';
import { name, only, said } from '../checks.ts';
import type { Calls, Ctx } from '../context.ts';

const PRUNES: Prune[] = ['containers', 'images', 'allImages', 'volumes', 'networks', 'buildCache', 'system'];

export function engineCalls({ target }: Ctx): Calls {
  return {
    history: async ({ target: id, id: image }) => {
      const f = await target(id);
      return said(async () => only(f, 'engine', 'show layers').history(f.t, name(image, 'image')));
    },

    diskUsage: async ({ target: id }) => {
      const f = await target(id);
      return said(async () => only(f, 'engine', 'show disk usage').diskUsage(f.t));
    },

    prune: async ({ target: id, what }) => {
      const f = await target(id);
      if (!PRUNES.includes(what as Prune)) throw new PluginError(`There's no “${what}” to clean up.`);
      return said(async () => only(f, 'engine', 'clean up').prune(f.t, what as Prune));
    },

    run: async ({ target: id, spec }) => {
      const f = await target(id);
      return said(async () => only(f, 'engine', 'run images').run(f.t, spec as RunSpec));
    },
  };
}
