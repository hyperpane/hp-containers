# Containers

What runs on the server, in one window laid out as Docker Desktop is: a
sidebar with the manager (a switcher) and what it has, a list, and a page
for what you open.

## Managers

Found by themselves, each in the switcher (● answers, ○ doesn't, and why):

- **Docker**, each of its contexts (Docker Desktop, OrbStack, Colima,
  Rancher Desktop, a remote host), **Podman** and **nerdctl**;
- **Kubernetes**, each kubectl context (and Kubernetes itself when kubectl
  has no cluster yet, saying how to get one);
- **pm2**, **tmux** and **screen**.

## Docker, Podman, nerdctl

| Sidebar | List | Page |
| --- | --- | --- |
| **Containers** | by Compose project (start, stop, restart, down a whole project) or pod; status, ports (click to open); start, stop, restart, shell, remove; only running | **Logs** (search, times, copy), **Inspect** (searchable JSON), **Files** (walk folders, read a file, copy it into the project, save it here), **Stats** (CPU and memory charts, network, disk, processes); stop, pause, restart, kill, shell, remove |
| **Images** | name, id, created, size; **Pull**, clean up | **Layers**, **Inspect**, **Run** (name, ports, variables, volumes, restart, command) |
| **Volumes** | what uses each; clean up | Inspect, remove |
| **Networks** | built-in ones marked; clean up | Inspect, remove |
| **Pods** (Podman) | start, stop, remove | Inspect |
| **Disk usage** | images, containers, volumes, build cache: size and what can be freed; clean up stopped containers, dangling or unused images, unused volumes and networks, the build cache, or everything unused | |

## Kubernetes

By namespace (or all): **Pods** (why one waits: CrashLoopBackOff…,
readiness, restarts, node; Logs per container, **Describe** with its
events, Files, Inspect, a shell, delete), **Deployments** (scale, restart
a rollout, Describe, Inspect), **Services** (type, cluster IP, ports).

## pm2, tmux, screen

- **pm2:** its processes with status, CPU, memory, restarts, uptime and
  mode; start, stop, restart, reload, delete; Logs, Inspect.
- **tmux, screen:** sessions, attached or not; **Screen** (what's on it,
  with its scrollback, again every 2 s), **Attach** in a Terminal window,
  end.

## How it works

The server part runs the managers' own command lines on the server, so it
sees what you'd see there: your contexts, your kubeconfig, your
permissions. Tools are looked for on the PATH and where they install
themselves (Homebrew, Docker Desktop, OrbStack, Rancher Desktop, Podman,
npm, Volta, Bun, pnpm, nvm), since a server the app starts may have a
short PATH.

- Contexts are named on every command (`--context`): your current Docker
  or kubectl context is never changed.
- Names, ids, paths, ports and variables are checked before they reach a
  command line, and passed as arguments, never into a shell.
- A folder in a container is listed by a small `sh` script run in it, with
  the path as its argument (`stat`, as busybox and coreutils have it). A
  container without a shell can't be walked, but a file can still be opened
  by its path. Reading, copying and saving use `docker cp`, which works on
  stopped containers too.
- Shell, Attach: a Terminal window in the project, typing `docker exec -it
  …` (bash if it has it, else sh), `kubectl exec`, `tmux attach` or `screen
  -x`. That's the `terminal` permission.
- Removing, deleting, killing, down and cleaning up ask first.

## Develop

```sh
./build.sh --test     # with stand-ins for docker, podman, kubectl, pm2, tmux and screen
```
