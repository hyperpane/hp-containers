// What Kubernetes runs, as the lists show it: pods, deployments, services.

export interface KubePod {
  name: string;
  namespace: string;
  /** Running, Pending, Succeeded, Failed, Unknown; or why a container waits
   * (CrashLoopBackOff, ImagePullBackOff). */
  phase: string;
  /** `1/2`. */
  ready: string;
  restarts: number;
  node: string | null;
  /** Milliseconds since 1970. */
  created: number | null;
  containers: string[];
}

export interface Deployment {
  name: string;
  namespace: string;
  /** `2/3`. */
  ready: string;
  replicas: number;
  created: number | null;
}

export interface Service {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  /** `80:30080/TCP`. */
  ports: string[];
  created: number | null;
}
