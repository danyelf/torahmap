import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import type { PieceItem } from '../layout.ts';
import { kindsOverlay } from './kinds.ts';
import { sectionsOverlay } from './sections.ts';

export const VIS_OVERLAYS: Overlay<PieceItem>[] = [sectionsOverlay, kindsOverlay];
