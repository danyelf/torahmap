// Sketch: paper-to-paper overlap by cited works, three ways, and a k-means clustering.
// node coupling-sketch.mjs <public/data/ieeevis> <out.json> [k...]
import fs from 'node:fs';

const [dir, out, ...ks] = process.argv.slice(2);
const works = JSON.parse(fs.readFileSync(`${dir}/cited.json`, 'utf8'));
const structure = JSON.parse(fs.readFileSync(`${dir}/structure.json`, 'utf8'));
const papers = structure.days.flatMap((d) =>
  d.sessions.flatMap((s) => s.papers.map((p) => ({ ...p, session: s.name, day: d.name }))),
);
const byIndex = new Map(papers.map((p) => [p.index, p]));

// Each citing paper's works, as sparse vectors: work id -> weight.
const citing = [...new Set(works.flatMap((w) => w.papers))].sort((a, b) => a - b);
const N = citing.length;
const idf = works.map((w) => Math.log(N / w.papers.length));
const binary = new Map(citing.map((p) => [p, new Map()]));
const tfidf = new Map(citing.map((p) => [p, new Map()]));
works.forEach((w, id) => {
  for (const p of w.papers) {
    binary.get(p).set(id, 1);
    tfidf.get(p).set(id, idf[id]);
  }
});
const normalize = (v) => {
  const n = Math.hypot(...v.values()) || 1;
  return new Map([...v].map(([k, x]) => [k, x / n]));
};
const unitBinary = new Map([...binary].map(([p, v]) => [p, normalize(v)]));
const unitTfidf = new Map([...tfidf].map(([p, v]) => [p, normalize(v)]));
const dot = (a, b) => {
  if (a.size > b.size) [a, b] = [b, a];
  let s = 0;
  for (const [k, x] of a) s += x * (b.get(k) ?? 0);
  return s;
};

// Pairs sharing at least one work, with all three measures.
const neighbours = new Map(citing.map((p) => [p, []]));
for (const a of citing)
  for (const b of citing) {
    if (a >= b) continue;
    const count = dot(binary.get(a), binary.get(b));
    if (!count) continue;
    const pair = {
      count,
      cosine: dot(unitBinary.get(a), unitBinary.get(b)),
      tfidf: dot(unitTfidf.get(a), unitTfidf.get(b)),
    };
    neighbours.get(a).push([b, pair]);
    neighbours.get(b).push([a, pair]);
  }

// Spherical k-means on the tf-idf vectors, best of several seeded restarts.
function rng(seed) {
  return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
function kmeans(k, seed) {
  const rand = rng(seed);
  const vecs = citing.map((p) => unitTfidf.get(p));
  // k-means++ seeding by cosine distance.
  const centres = [vecs[Math.floor(rand() * vecs.length)]];
  while (centres.length < k) {
    const d = vecs.map((v) => 1 - Math.max(...centres.map((c) => dot(v, c))));
    let r = rand() * d.reduce((a, b) => a + b, 0);
    let i = 0;
    while ((r -= d[i]) > 0 && i < d.length - 1) i++;
    centres.push(vecs[i]);
  }
  let assign = [];
  for (let iter = 0; iter < 50; iter++) {
    const next = vecs.map((v) => {
      let best = 0,
        bestSim = -1;
      centres.forEach((c, j) => {
        const s = dot(v, c);
        if (s > bestSim) [best, bestSim] = [j, s];
      });
      return best;
    });
    if (next.every((x, i) => x === assign[i])) break;
    assign = next;
    for (let j = 0; j < k; j++) {
      const sum = new Map();
      vecs.forEach((v, i) => {
        if (assign[i] !== j) return;
        for (const [key, x] of v) sum.set(key, (sum.get(key) ?? 0) + x);
      });
      if (sum.size) centres[j] = normalize(sum);
    }
  }
  const cohesion = vecs.reduce((s, v, i) => s + dot(v, centres[assign[i]]), 0);
  return { assign, centres, cohesion };
}

const clusterings = {};
for (const k of ks.map(Number)) {
  let best = null;
  for (let seed = 1; seed <= 20; seed++) {
    const run = kmeans(k, seed);
    if (!best || run.cohesion > best.cohesion) best = run;
  }
  // Order clusters by size, and name each by the works weighing most in its centre.
  const sizes = Array.from({ length: k }, (_, j) => best.assign.filter((a) => a === j).length);
  const order = sizes.map((_, j) => j).sort((a, b) => sizes[b] - sizes[a]);
  const rank = new Map(order.map((j, r) => [j, r]));
  clusterings[k] = {
    clusters: order.map((j) => ({
      size: sizes[j],
      works: [...best.centres[j]]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(
          ([id]) =>
            `${works[id].title} (${works[id].year ?? 'n.d.'}) — ${works[id].papers.length} papers`,
        ),
      sessions: Object.entries(
        citing
          .filter((_, i) => best.assign[i] === j)
          .reduce(
            (m, p) => ({ ...m, [byIndex.get(p).session]: (m[byIndex.get(p).session] ?? 0) + 1 }),
            {},
          ),
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4),
    })),
    of: Object.fromEntries(citing.map((p, i) => [p, rank.get(best.assign[i])])),
  };
}

const top = (p, key, n = 8) =>
  neighbours
    .get(p)
    .sort((a, b) => b[1][key] - a[1][key])
    .slice(0, n);
const round = (x) => Math.round(x * 1000) / 1000;
fs.writeFileSync(
  out,
  JSON.stringify({
    neighbours: Object.fromEntries(
      citing.map((p) => [
        p,
        neighbours.get(p).map(([q, m]) => [q, m.count, round(m.cosine), round(m.tfidf)]),
      ]),
    ),
    clusterings: Object.fromEntries(Object.entries(clusterings).map(([k, c]) => [k, c.of])),
    clusterNames: Object.fromEntries(
      Object.entries(clusterings).map(([k, c]) => [k, c.clusters.map((x) => x.works[0])]),
    ),
  }),
);

// Report to the terminal.
console.log(`${N} citing papers of ${papers.length}`);
for (const [k, c] of Object.entries(clusterings)) {
  console.log(`\n== k=${k}: sizes ${c.clusters.map((x) => x.size).join(' ')}`);
  c.clusters.forEach((x, r) => {
    console.log(
      `  [${r}] ${x.size} papers; sessions: ${x.sessions.map(([s, n]) => `${s} (${n})`).join('; ')}`,
    );
    for (const w of x.works.slice(0, 3)) console.log(`      ${w.slice(0, 110)}`);
  });
}
for (const p of [94, ...(process.env.SHOW?.split(',').map(Number) ?? [])]) {
  if (!neighbours.has(p)) continue;
  console.log(`\n== paper ${p}: ${byIndex.get(p).title.slice(0, 80)} (${binary.get(p).size} refs)`);
  for (const key of ['count', 'cosine', 'tfidf']) {
    console.log(`  by ${key}:`);
    for (const [q, m] of top(p, key, 6))
      console.log(
        `    ${String(m.count).padStart(2)} shared, cos ${m.cosine.toFixed(2)}, tfidf ${m.tfidf.toFixed(2)}, ${binary.get(q).size} refs — ${byIndex.get(q).title.slice(0, 60)}`,
      );
  }
}
