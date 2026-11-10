import type { UrlParamSpec } from '@torahmap/link';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import type { CodeItem } from '../layout.ts';
import { churnOverlay } from './churn.ts';
import { fileTypeOverlay } from './fileType.ts';
import { lineKindOverlay } from './lineKind.ts';
import { pullRequestOverlay } from './pullRequest.ts';

export const CODE_OVERLAYS: Overlay<CodeItem>[] = [
  pullRequestOverlay,
  churnOverlay,
  lineKindOverlay,
  fileTypeOverlay,
];

export const codeOverlayParams = (id: string): readonly UrlParamSpec[] | undefined =>
  CODE_OVERLAYS.find((overlay) => overlay.id === id)?.urlParams;
