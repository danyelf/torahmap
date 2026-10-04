import type { TanakhIdentity } from '../types.ts';
import type { Overlay, ToolOnMap, Tools } from './types.ts';

export type TanakhOverlay = Overlay<TanakhIdentity>;
export type TanakhTool = ToolOnMap<TanakhIdentity>;
export type TanakhTools = Tools<TanakhIdentity>;
