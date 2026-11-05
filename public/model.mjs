export const START = Date.parse('2026-11-08T08:00:00Z');
export const DISTANCE = 42200;
export function duration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export function progress(athlete, timelines, now = Date.now()) {
  if (!athlete) return { kind: 'unresolved', distance: null };
  if (athlete.finish || athlete.state === 'finished') return { kind: 'finished', distance: DISTANCE, measured: DISTANCE };
  if (['did_not_finish', 'did_not_start', 'disqualified'].includes(athlete.state) && !athlete.last_passing) return { kind: athlete.state, distance: null };
  const last = athlete.last_passing;
  const measured = Number(last?.distance_from_start);
  const time = Date.parse(last?.passing_time);
  if (!last || !Number.isFinite(measured) || measured < 0 || measured > DISTANCE || !Number.isFinite(time) || time > now) return { kind: 'waiting', distance: null };
  const base = { measured, time, checkpoint: last.timeline_name, distance: measured };
  if (['did_not_finish', 'did_not_start', 'disqualified'].includes(athlete.state)) return { ...base, kind: athlete.state };
  // Only a measured passing establishes progress; pre-race default speed/start do not.
  if (now < START || athlete.state === 'before') return { kind: 'waiting', distance: null };
  if (last.gps) return { ...base, kind: 'checkpoint' };
  const speed = Number(last.speed);
  if (!(speed > 0 && speed < 12)) return { ...base, kind: 'checkpoint' };
  const next = timelines.find(t => t.distance_from_start > measured);
  const gap = (next?.distance_from_start ?? DISTANCE) - measured;
  const age = (now - time) / 1000;
  const expectedSeconds = gap / speed;
  const stale = age > Math.min(2700, expectedSeconds * 1.35 + 180);
  if (stale) return { ...base, kind: 'stale' };
  const distance = Math.min(measured + age * speed, Math.max(measured, (next?.distance_from_start ?? DISTANCE) - 1));
  return { ...base, kind: 'estimated', distance, speed, capped: age >= expectedSeconds, eta: now + (DISTANCE - distance) / speed * 1000 };
}
const routeCache = new WeakMap();
function anchorsFor(course) {
  if (routeCache.has(course)) return routeCache.get(course);
  const points=course.route.features[0].geometry.coordinates, lengths=[0];
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],r=Math.PI/180;
    lengths.push(lengths.at(-1)+6371000*r*Math.hypot((b[0]-a[0])*Math.cos((a[1]+b[1])/2*r),b[1]-a[1]));
  }
  // Some official path_index values refer to an older geometry. Match each
  // checkpoint spatially within its course-distance neighbourhood instead.
  let previous=0;
  const anchors=[...course.timelines].sort((a,b)=>a.distance_from_start-b.distance_from_start).map(t=>{
    let best=Infinity,index=previous;
    for(let i=previous;i<points.length;i++) {
      if(Math.abs(lengths[i]-t.distance_from_start)>1200)continue;
      const d=Math.hypot((points[i][0]-t.longitude)*Math.cos(t.latitude*Math.PI/180),points[i][1]-t.latitude);
      if(d<best){best=d;index=i;}
    }
    previous=index;return {...t,path_index:index};
  });
  routeCache.set(course,anchors);return anchors;
}
export function routePoint(course, metres) {
  const coordinates = course.route.features[0].geometry.coordinates;
  const anchors = anchorsFor(course);
  const exact=anchors.find(t=>t.distance_from_start===metres);
  if(exact)return [exact.longitude,exact.latitude];
  const upper = anchors.findIndex(t => t.distance_from_start >= metres);
  if (upper === 0) return coordinates[anchors[0].path_index];
  if (upper < 0) return coordinates.at(-1);
  const a = anchors[upper-1], b = anchors[upper];
  const points = [[a.longitude,a.latitude],...coordinates.slice(a.path_index+1, b.path_index),[b.longitude,b.latitude]];
  const lengths = [0];
  for(let i=1;i<points.length;i++) {
    const p=points[i-1], q=points[i], rad=Math.PI/180;
    const dx=(q[0]-p[0])*Math.cos((q[1]+p[1])/2*rad), dy=q[1]-p[1];
    lengths.push(lengths.at(-1)+Math.hypot(dx,dy));
  }
  const target=(metres-a.distance_from_start)/(b.distance_from_start-a.distance_from_start)*lengths.at(-1);
  for(let i=1;i<points.length;i++) if(lengths[i]>=target) {
    const f=(target-lengths[i-1])/(lengths[i]-lengths[i-1] || 1);
    return points[i].map((v,j)=>points[i-1][j]+(v-points[i-1][j])*f);
  }
  return points.at(-1);
}

export function markerView(p, { selected, lastUpdate = 0, now = Date.now() }) {
  const staleFeed = Boolean(selected && lastUpdate && now - lastUpdate > 180000 && now > START && p.kind !== 'finished');
  const distance = staleFeed && p.measured != null ? p.measured : p.distance;
  const parked = Boolean(selected && p.kind === 'waiting' && distance == null);
  const markerDistance = distance ?? (parked ? 0 : null);
  const source = parked ? 'parked' : staleFeed || p.kind === 'stale' ? 'stale' : p.kind === 'estimated' ? (p.capped ? 'awaiting' : 'estimated') : p.kind === 'finished' ? 'finished' : 'checkpoint';
  return { staleFeed, distance, parked, markerDistance, source };
}
