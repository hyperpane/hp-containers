// What the window asks of a target: what it runs now (a snapshot), what can
// be inspected, cleaned up or done to a thing, and what a name may be.

import type { Container, Image, Network, PodmanPod, Volume } from './engine.ts';
import type { Deployment, KubePod, Service } from './kube.ts';
import type { Pm2Process, TermSession } from './processes.ts';

/** What `watch` sends for a target: what's there now. */
export interface Snapshot {
  target: string;
  error: string | null;
  containers?: Container[];
  images?: Image[];
  volumes?: Volume[];
  networks?: Network[];
  pods?: PodmanPod[];
  kubePods?: KubePod[];
  deployments?: Deployment[];
  services?: Service[];
  namespaces?: string[];
  processes?: Pm2Process[];
  sessions?: TermSession[];
}

/** What can be inspected. */
export type Thing = 'container' | 'image' | 'volume' | 'network' | 'pod' | 'kubePod' | 'deployment' | 'service' | 'process';

/** What `prune` clears. */
export type Prune = 'containers' | 'images' | 'allImages' | 'volumes' | 'networks' | 'buildCache' | 'system';

/** What an action does to a thing. */
export type Action =
  | 'start'
  | 'stop'
  | 'restart'
  | 'pause'
  | 'unpause'
  | 'kill'
  | 'remove'
  | 'removeImage'
  | 'removeVolume'
  | 'removeNetwork'
  | 'composeStart'
  | 'composeStop'
  | 'composeRestart'
  | 'composeDown'
  | 'podStart'
  | 'podStop'
  | 'podRemove'
  | 'deletePod'
  | 'rolloutRestart'
  | 'scale'
  | 'pm2Start'
  | 'pm2Stop'
  | 'pm2Restart'
  | 'pm2Reload'
  | 'pm2Delete'
  | 'sessionKill';

/** A name or id as a command takes it: nothing that reads as an option. */
export const NAME = /^[A-Za-z0-9][A-Za-z0-9_.:@/+-]{0,252}$/;
