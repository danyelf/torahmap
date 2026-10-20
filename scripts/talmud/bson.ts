// BSON, as mongodump writes it: a run of documents. Only the types Sefaria's
// word-form and dictionary collections use are read; any other throws.

import { readFileSync } from 'node:fs';

export type Bson = string | number | boolean | null | Bson[] | { [key: string]: Bson };

function readDocument(buf: Buffer, at: number): { [key: string]: Bson } {
  const end = at + buf.readInt32LE(at);
  const doc: { [key: string]: Bson } = {};
  let i = at + 4;
  while (i < end - 1) {
    const type = buf[i++];
    const nameEnd = buf.indexOf(0, i);
    const name = buf.toString('utf8', i, nameEnd);
    i = nameEnd + 1;
    switch (type) {
      case 0x01:
        doc[name] = buf.readDoubleLE(i);
        i += 8;
        break;
      case 0x02: {
        const len = buf.readInt32LE(i);
        doc[name] = buf.toString('utf8', i + 4, i + 4 + len - 1);
        i += 4 + len;
        break;
      }
      case 0x03:
      case 0x04: {
        const sub = readDocument(buf, i);
        doc[name] = type === 0x04 ? Object.values(sub) : sub;
        i += buf.readInt32LE(i);
        break;
      }
      case 0x07:
        doc[name] = buf.toString('hex', i, i + 12);
        i += 12;
        break;
      case 0x08:
        doc[name] = buf[i++] === 1;
        break;
      case 0x09:
      case 0x12:
        doc[name] = Number(buf.readBigInt64LE(i));
        i += 8;
        break;
      case 0x0a:
        doc[name] = null;
        break;
      case 0x10:
        doc[name] = buf.readInt32LE(i);
        i += 4;
        break;
      default:
        throw new Error(`BSON type 0x${type.toString(16)} in field ${name}`);
    }
  }
  return doc;
}

export function* documents(path: string): Generator<{ [key: string]: Bson }> {
  const buf = readFileSync(path);
  for (let at = 0; at < buf.length; at += buf.readInt32LE(at)) yield readDocument(buf, at);
}
