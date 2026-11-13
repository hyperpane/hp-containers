// The client part: the Containers window. The managers are asked by the
// server part, on the server.

import { mount } from '@hyperpane/sdk/client';
import { NodeMessage } from '@hyperpane/ui';
import { ContainersView } from './app/ContainersView.tsx';

mount((host) =>
  host.view.type === 'node' && host.view.kind === 'containers' ? <ContainersView /> : <NodeMessage error>Containers has no “{host.view.type}” view here.</NodeMessage>,
);
