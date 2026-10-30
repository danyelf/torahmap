import fs from 'node:fs';
const dir = process.argv[2];
const st = JSON.parse(fs.readFileSync(`${dir}/structure.json`));
const cited = JSON.parse(fs.readFileSync(`${dir}/cited.json`));
const papers = st.days.flatMap(d => d.sessions.flatMap(s => s.papers));
const byIndex = new Map(papers.map(p => [p.index, p]));
const short = a => (a.length <= 2 ? a.join(' & ') : `${a[0]} et al.`);
const label = w => `${w.title.replace(/[,;]/g, ' ')} (${w.year ?? 'n.d.'}) ${short(w.authors)}`.replace(/\s+/g, ' ');
const multi = cited.filter(w => w.papers.length >= 2);
for (const p of papers) p.works = [];
for (const w of multi) { const l = label(w); for (const i of w.papers) byIndex.get(i)?.works.push(l); }
// shared counts across all works (including cited once: irrelevant since need >=2 papers)
const shared = new Map();
for (const w of multi) for (const a of w.papers) for (const b of w.papers) if (a !== b) {
  const m = shared.get(a) ?? shared.set(a, new Map()).get(a);
  m.set(b, (m.get(b) ?? 0) + 1);
}
for (const p of papers) p.shared = [...(shared.get(p.index) ?? [])].sort((x, y) => y[1] - x[1]).slice(0, 40);
for (const p of papers) if (!p.works.length) delete p.works;
fs.writeFileSync(`${dir}/structure.json`, JSON.stringify(st));
console.log(papers.length, multi.length, papers.filter(p=>p.shared.length).length);
const top = papers.filter(p=>p.shared.length).sort((a,b)=>b.shared.length-a.shared.length).slice(0,5).map(p=>[p.index,p.title.slice(0,50),p.shared.length,p.shared[0]]);
console.log(top);
