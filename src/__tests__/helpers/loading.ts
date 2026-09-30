import { vi } from 'vitest';
import { ready, type Loadable } from '../../dataLoading';

/** Count `tools` as loaded without loading them, for a test that supplies their data itself. */
export async function countAsLoaded(...tools: Loadable[]): Promise<void> {
  for (const tool of tools) {
    if (!tool.init) continue;
    const init = vi.spyOn(tool as Required<Loadable>, 'init').mockResolvedValue();
    await ready(tool);
    init.mockRestore();
  }
}
