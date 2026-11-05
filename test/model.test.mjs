import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {START,DISTANCE,progress,routePoint,duration,markerView} from '../public/model.mjs';
const course=JSON.parse(fs.readFileSync(new URL('../public/course.json',import.meta.url)));
const timelines=course.timelines;
const passing={state:'during',last_passing:{distance_from_start:5000,passing_time:new Date(START+1800000).toISOString(),speed:3,timeline_name:'5 K',gps:false}};
test('no pre-race movement from scheduled start and default speed',()=>{assert.equal(progress({state:'before',speed:3,start:new Date(START).toISOString()},timelines,START+60000).distance,null);});
test('measured read anchors the estimate, capped before next timing mat',()=>{let p=progress(passing,timelines,START+2100000);assert.equal(p.distance,5900);assert.equal(p.kind,'estimated');p=progress(passing,timelines,START+3600000);assert.equal(p.distance,9999);assert.equal(p.capped,true);});
test('overdue read returns to confirmed checkpoint',()=>{const p=progress(passing,timelines,START+4800000);assert.equal(p.kind,'stale');assert.equal(p.distance,5000);});
test('DNF does not continue moving; DNS without read is preserved',()=>{assert.equal(progress({...passing,state:'did_not_finish'},timelines,START+2100000).distance,5000);assert.equal(progress({state:'did_not_start'},timelines,START+2100000).kind,'did_not_start');});
test('finish is confirmed, future passing never extrapolates',()=>{assert.equal(progress({state:'finished'},timelines,START+15000000).distance,DISTANCE);assert.equal(progress(passing,timelines,START+1000).distance,null);});
test('all checkpoints use geographic anchors despite stale official path indices',()=>{for(const t of timelines)assert.deepEqual(routePoint(course,t.distance_from_start),[t.longitude,t.latitude]);for(let m=0;m<=DISTANCE;m+=100){const p=routePoint(course,m);assert.equal(p.length,2);assert.ok(p.every(Number.isFinite));assert.ok(p[0]>-8.75&&p[0]<-8.55);assert.ok(p[1]>41.1&&p[1]<41.25);}});
test('duration parses milliseconds returned by real public split schema',()=>{assert.equal(duration(850273),'0:14:10');assert.equal(duration(NaN),'—');});

test('mascot parks without manufacturing a measured distance',()=>{const v=markerView({kind:'waiting',distance:null},{selected:true,now:START-1000});assert.equal(v.markerDistance,0);assert.equal(v.distance,null);assert.equal(v.source,'parked');assert.equal(markerView({kind:'unresolved',distance:null},{selected:false}).markerDistance,null);});
test('fresh estimates move, awaiting reads never masquerade as confirmed checkpoints',()=>{let now=START+2100000,p=progress(passing,timelines,now),v=markerView(p,{selected:true,lastUpdate:now,now});assert.equal(v.markerDistance,5900);assert.equal(v.source,'estimated');now=START+3600000;p=progress(passing,timelines,now);v=markerView(p,{selected:true,lastUpdate:now,now});assert.equal(v.markerDistance,9999);assert.equal(v.source,'awaiting');});
test('a failed timing feed freezes the duck at the last measured point',()=>{const now=START+2100000;const v=markerView(progress(passing,timelines,now),{selected:true,lastUpdate:now-181000,now});assert.equal(v.source,'stale');assert.equal(v.markerDistance,5000);assert.equal(v.staleFeed,true);});
test('finished ducks retain a confirmed finish when the feed grows old',()=>{const now=START+18000000;const v=markerView(progress({state:'finished'},timelines,now),{selected:true,lastUpdate:START,now});assert.equal(v.source,'finished');assert.equal(v.markerDistance,DISTANCE);});
