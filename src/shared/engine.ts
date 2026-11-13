// What Docker, Podman and nerdctl run and keep: containers, images,
// volumes, networks, Podman's pods; and what they report about them (disk
// usage, an image's layers, live stats), and what starts a container.

export type State = 'running' | 'exited' | 'paused' | 'created' | 'restarting' | 'dead' | 'removing' | 'unknown';

export interface Container {
  id: string;
  name: string;
  image: string;
  state: State;
  /** As the manager says it: `Up 2 hours`, `Exited (0) 3 days ago`. */
  status: string;
  /** `0.0.0.0:8080->80/tcp`, each once. */
  ports: string[];
  /** Its Compose project, or its Podman pod. */
  group: string | null;
}

export interface Image {
  id: string;
  /** `nginx:1.27`, or `<none>` for a dangling one. */
  name: string;
  size: string;
  created: string;
  /** Containers using it, when the manager says. */
  containers: number | null;
}

/** A Podman pod. */
export interface PodmanPod {
  id: string;
  name: string;
  status: string;
  containers: number;
}

export interface Volume {
  name: string;
  driver: string;
  /** Where it is on the host (or in the VM). */
  mountpoint: string;
  /** Containers using it, by name. */
  usedBy: string[];
}

export interface Network {
  id: string;
  name: string;
  driver: string;
  scope: string;
  /** bridge, host and none: Docker's own, not to remove. */
  builtIn: boolean;
}

/** A row of `docker system df`. */
export interface DiskUsage {
  type: string;
  total: number;
  active: number;
  size: string;
  reclaimable: string;
}

/** A layer of an image (`docker history`), newest first. */
export interface Layer {
  id: string;
  created: string;
  createdBy: string;
  size: string;
  comment: string;
}

/** One reading of `docker stats`. */
export interface Stats {
  at: number;
  /** Percent of one CPU. */
  cpu: number;
  /** Percent of the memory it may use. */
  mem: number;
  memUsage: string;
  netIO: string;
  blockIO: string;
  pids: string;
}

/** What `run` starts an image with. */
export interface RunSpec {
  image: string;
  name?: string;
  /** `8080:80`, `127.0.0.1:5432:5432/tcp`. */
  ports?: string[];
  /** `KEY=value`. */
  env?: string[];
  /** `volume:/data`, `/host/dir:/in/container:ro`. */
  volumes?: string[];
  /** `always`, `unless-stopped`, `on-failure`, `no`. */
  restart?: string;
  /** Run it with a command of its own (words). */
  command?: string[];
}
