import type { UrlParamSpec } from '@torahmap/link';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import type { ActItem } from '../layout.ts';
import { amendmentOverlay } from './amendment.ts';
import { REFERENCE_PARAMS, referencesOverlay } from './references.ts';

export const ACT_OVERLAYS: Overlay<ActItem>[] = [amendmentOverlay, referencesOverlay];

export const actOverlayParams = (id: string): readonly UrlParamSpec[] | undefined =>
  id === referencesOverlay.id ? REFERENCE_PARAMS : undefined;
