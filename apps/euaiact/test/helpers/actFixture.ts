import type { ActStructure } from '../../src/data.ts';

const cell = (id: string) => ({ id, origin: 'B' as const });
const plain = (id: string) => ({ kind: 'plain' as const, cell: cell(id) });

export const actFixture: ActStructure = {
  recitals: 3,
  chapters: [
    {
      number: 'I',
      columns: [
        {
          label: null,
          runs: [
            [
              {
                number: '1',
                groups: [
                  plain('1(1)'),
                  plain('1(2)'),
                  {
                    kind: 'list',
                    lead: cell('1(3)'),
                    points: [cell('1(3)(a)'), cell('1(3)(b)'), cell('1(3)(c)')],
                  },
                ],
              },
            ],
            [{ number: '2', groups: [plain('2')] }],
          ],
        },
      ],
    },
    {
      number: 'III',
      columns: [
        { label: 'Section 1', runs: [[{ number: '6', groups: [plain('6')] }]] },
        { label: 'Section 2', runs: [[{ number: '7', groups: [plain('7')] }]] },
      ],
    },
  ],
  annexes: [
    {
      number: 'I',
      blocks: [{ number: '1', groups: [plain('Annex.I.1.1'), plain('Annex.I.1.2')] }],
    },
  ],
};
