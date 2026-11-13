// The server part: the container managers on the server, through their
// command lines.

import { serve } from '@hyperpane/sdk/server';
import { plugin } from './plugin.ts';

serve(plugin);
