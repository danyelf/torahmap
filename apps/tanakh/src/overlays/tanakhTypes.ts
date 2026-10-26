import type { TanakhIdentity } from '../types.ts';
import type { Overlay, ToolOnMap } from '@torahmap/shell/overlays/types.ts';

export type TanakhOverlay = Overlay<TanakhIdentity>;
export type TanakhTool = ToolOnMap<TanakhIdentity>;
