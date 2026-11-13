// What's opened from a list: the thing, by its id, and the tab to show
// first (an image's Run, from the list's Run button).

export interface Open {
  thing: 'container' | 'image' | 'volume' | 'network' | 'pod' | 'kubePod' | 'deployment' | 'service' | 'process' | 'session';
  id: string;
  name: string;
  namespace?: string;
  containers?: string[];
  tab?: string;
}
