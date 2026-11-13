// The sidebar's sections: what each is called and shows as, which ones a
// manager has (Kubernetes', pm2's and the session managers' own; Podman's
// pods only when it has them), and how many things each one lists.

import { Boxes, Container as ContainerIcon, Cpu, Database, HardDrive, Layers, Network as NetworkIcon, SquareTerminal, Waypoints } from 'lucide-react';
import type { Kind, Snapshot } from '../../shared/index.ts';

export type Section = 'containers' | 'images' | 'volumes' | 'networks' | 'pods' | 'disk' | 'kubePods' | 'deployments' | 'services' | 'processes' | 'sessions';

export const SECTIONS: Record<Section, { name: string; icon: React.ComponentType<{ className?: string }> }> = {
  containers: { name: 'Containers', icon: ContainerIcon },
  images: { name: 'Images', icon: Layers },
  volumes: { name: 'Volumes', icon: Database },
  networks: { name: 'Networks', icon: NetworkIcon },
  pods: { name: 'Pods', icon: Boxes },
  disk: { name: 'Disk usage', icon: HardDrive },
  kubePods: { name: 'Pods', icon: Boxes },
  deployments: { name: 'Deployments', icon: Layers },
  services: { name: 'Services', icon: Waypoints },
  processes: { name: 'Processes', icon: Cpu },
  sessions: { name: 'Sessions', icon: SquareTerminal },
};

export function sectionsFor(kind: Kind | undefined, snap: Snapshot | null): Section[] {
  if (kind === 'kubernetes') return ['kubePods', 'deployments', 'services'];
  if (kind === 'pm2') return ['processes'];
  if (kind === 'screen' || kind === 'tmux') return ['sessions'];
  return ['containers', 'images', 'volumes', 'networks', ...(snap?.pods ? (['pods'] as Section[]) : []), 'disk'];
}

export const count = (s: Section, snap: Snapshot | null): number | undefined =>
  (
    {
      containers: snap?.containers,
      images: snap?.images,
      volumes: snap?.volumes,
      networks: snap?.networks,
      pods: snap?.pods,
      kubePods: snap?.kubePods,
      deployments: snap?.deployments,
      services: snap?.services,
      processes: snap?.processes,
      sessions: snap?.sessions,
    } as Partial<Record<Section, unknown[]>>
  )[s]?.length;

