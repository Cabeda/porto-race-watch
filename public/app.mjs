import {mascotMarkup} from './mascot.mjs';
import {START,DISTANCE,duration,progress,routePoint,markerView} from './model.mjs';
const $=id=>document.getElementById(id), API='https://api.tracx.events/v1/web/events/2250';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let course, map, runner=null, runnerMarker=null, measuredMarker=null, selectedId=null, ranking=25156, leaders=[], leaderMarkers=[], following=false, busy=false, lastGood=0, lastLeaders=0, searchController, searchSerial=0, searchTimer, runnerCheckedAt=0, mascotKey='';
let desiredBib=new URL(location.href).searchParams.get('bib')||'6297';
const initialId=new URL(location.href).searchParams.get('runner');
const clock=ms=>new Date(ms).toLocaleTimeString('en-GB',{timeZone:'Europe/Lisbon',hour:'2-digit',minute:'2-digit'});
async function get(path,signal){const r=await fetch(API+path,{signal:signal||AbortSignal.timeout(15000),credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw new Error(r.status===403?'This runner’s profile is private.':`Timing feed unavailable (${r.status}).`);return r.json();}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2600);}
function pin(className,label,size=32){return L.divIcon({className:'',html:`<div class="map-pin ${className}" style="width:${size}px;height:${size}px">${escape(label)}</div>`,iconSize:[size,size],iconAnchor:[size/2,size/2]});}
function ll(m){const p=routePoint(course,m);return [p[1],p[0]];}
function mapSetup(){
  map=L.map('map',{zoomControl:false,scrollWheelZoom:true,zoomSnap:0.25}).setView([41.164,-8.66],12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',maxZoom:19}).addTo(map);
  L.geoJSON(course.route,{interactive:false,style:{color:'#fffdf7',weight:14,opacity:.95,lineCap:'round',lineJoin:'round'}}).addTo(map);
  L.geoJSON(course.route,{interactive:false,style:{color:'#403057',weight:9,opacity:.9,lineCap:'round',lineJoin:'round'}}).addTo(map);
  const route=L.geoJSON(course.route,{style:{color:'#8b67e8',weight:6,opacity:1,lineCap:'round',lineJoin:'round'}}).addTo(map);
  for(let metres=2500;metres<DISTANCE;metres+=2500){
    const a=ll(metres-30),b=ll(metres+30),heading=Math.atan2((b[1]-a[1])*Math.cos(a[0]*Math.PI/180),b[0]-a[0])*180/Math.PI;
    L.marker(ll(metres),{interactive:false,keyboard:false,zIndexOffset:-500,icon:L.divIcon({className:'course-direction',html:`<svg viewBox="0 0 20 20" style="transform:rotate(${heading}deg)" aria-hidden="true"><path d="M5 13l5-6 5 6" fill="none" stroke="#fffdf5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,iconSize:[20,20],iconAnchor:[10,10]})}).addTo(map);
  }
  const fit=()=>map.fitBounds(route.getBounds(),{paddingTopLeft:[48,95],paddingBottomRight:[48,100]});$('fit').onclick=()=>{following=false;fit();};fit();
  L.control.zoom({position:'bottomright'}).addTo(map);
  course.timelines.filter(t=>t.type!=='split'||t.distance_from_start%5000===0).forEach(t=>{
    const special=t.type==='start'||t.type==='finish';
    const label=t.type==='start'?'START':t.type==='finish'?'FINISH':t.distance_from_start/1000;
    L.marker([t.latitude,t.longitude],{icon:L.divIcon({className:special?'start-pin':'checkpoint',html:String(label),iconSize:special?[43,22]:[22,22],iconAnchor:special?[21,11]:[11,11]})}).bindTooltip(`${escape(t.name)} · ${(t.distance_from_start/1000).toFixed(1)} km`).addTo(map);
  });
  map.on('resize',fit);
  map.on('dragstart',()=>{following=false;$('follow').textContent='◎';$('follow').setAttribute('aria-pressed','false');});
}
function showResults(items,query,total){
  const root=$('search-results');root.replaceChildren();
  if(!items.length){const p=document.createElement('p');p.className='muted';p.textContent=/^\d+$/.test(query)?`No bib ${query} in the feed yet. Search by registered name, or try again after bibs are published.`:'No matching runners. Try fewer words or a bib number.';root.append(p);return;}
  const p=document.createElement('p');p.className='muted';p.textContent=`${total>items.length?`Showing ${items.length} of ${total}`:items.length} matching runner${total===1?'':'s'} · select an entry`;root.append(p);
  items.forEach(row=>{
    const b=document.createElement('button');b.type='button';b.className='result';
    const title=document.createElement('strong');title.textContent=row.full_name;
    const details=document.createElement('small');details.textContent=[row.start_number?`Bib ${row.start_number}`:'Bib pending',row['category.name'],row['team.name']||row.club||'No team listed',row.country_code].filter(Boolean).join(' · ');
    // Identical published identities cannot safely be disambiguated using a name alone.
    if(items.filter(x=>x.full_name===row.full_name&&x['category.name']===row['category.name']&&x['team.name']===row['team.name']&&!x.start_number).length>1)details.textContent+=` · Entry ${row.participant.id}`;
    b.append(title,details);b.onclick=()=>selectRunner(row.participant.id,row.start_number);root.append(b);
  });
}
async function search(query){
  query=query.trim();const serial=++searchSerial;searchController?.abort();searchController=new AbortController();
  if(!query){$('search-results').replaceChildren();return;}
  $('search-results').textContent='Searching the official entries…';
  const controller=searchController;
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{const data=await get(`/rankings/25156/results?search=${encodeURIComponent(query)}&itemsPerPage=50`,searchController.signal);if(serial!==searchSerial)return;showResults(data.items,query,data.meta.pagination.total);}
  catch(e){if(serial===searchSerial)$('search-results').textContent=e.name==='AbortError'?'Search timed out. Try again.':e.message;}
  finally{clearTimeout(timeout);}
}
let selectionSerial=0;
async function selectRunner(id,bib){
  clearTimeout(searchTimer);searchController?.abort();searchSerial++;
  const serial=++selectionSerial;try{const a=await get(`/participants/${encodeURIComponent(id)}?include=splits,last_passing`);if(serial!==selectionSerial)return;
    if(a.race?.id!==6220)throw new Error('Please select a Porto Marathon runner.');
    runner=a;runnerCheckedAt=Date.now();mascotKey='';selectedId=String(id);desiredBib=bib?String(bib):'';following=true;
    const url=new URL(location.href);url.search='';url.searchParams.set('runner',selectedId);if(a.start_number)url.searchParams.set('bib',a.start_number);history.replaceState(null,'',url);
    $('search-results').replaceChildren();$('search').value=a.full_name;renderRunner();toast(`Following ${a.full_name}`);
  }catch(e){toast(e.message);}
}
function renderRunner(){
  const p=progress(runner,course.timelines);
  document.querySelector('.runner-card').hidden=!runner;
  if(runner){
    $('runner-name').textContent=runner.full_name;$('initials').textContent=runner.full_name.split(/\s+/).map(s=>s[0]).slice(0,2).join('');
    $('runner-meta').textContent=[runner.start_number?`Bib ${runner.start_number}`:'Bib pending'].filter(Boolean).join(' · ');
  }
  const view=markerView(p,{selected:!!runner,lastUpdate:runnerCheckedAt});
  const staleFeed=view.staleFeed;
  const descriptions={unresolved:'Bib 6297 is not published yet. Search by name above and select a matching entry. Identical names may need a bib to confirm.',waiting:'Waiting for the first confirmed chip read. No position is available yet.',estimated:p.capped?'Estimated at the next checkpoint · awaiting a new chip read.':'Estimated from the last chip read. Position between checkpoints is not live GPS.',checkpoint:'Showing the last confirmed checkpoint. No position estimate available.',stale:'Next read is overdue. Showing the last confirmed checkpoint.',finished:'Across the line. Official finish recorded.',did_not_finish:'Did not finish · last confirmed checkpoint shown.',did_not_start:'Did not start.',disqualified:'Disqualified · last confirmed checkpoint shown.'};
  $('runner-note').textContent=staleFeed?'Feed updates are delayed. Showing the last confirmed checkpoint.':descriptions[p.kind];
  $('runner-state').textContent=staleFeed?'Updates delayed':({unresolved:'Select runner',waiting:Date.now()<START?'Waiting for start':'Waiting for timing',estimated:'Estimated position',checkpoint:'Confirmed checkpoint',stale:'Read overdue',finished:'Finished',did_not_finish:'DNF',did_not_start:'DNS',disqualified:'Disqualified'})[p.kind];
  const shown=view.distance;
  $('distance').textContent=shown==null?'—':(shown/1000).toFixed(1);$('progress-fill').style.width=`${(shown||0)/DISTANCE*100}%`;
  const pace=runner?.pace>0?runner.pace:p.speed?1000000/p.speed:null;
  $('pace').textContent=pace?`${Math.floor(pace/60000)}:${String(Math.floor(pace/1000)%60).padStart(2,'0')}`:'—';
  $('eta').textContent=runner?.finish?clock(Date.parse(runner.finish)):p.eta&&!staleFeed&&!p.capped?clock(p.eta):'—';
  $('position').textContent=runner?.positions?.overall?`#${runner.positions.overall}`:'—';
  $('eta-wrap').hidden=$('eta').textContent==='—';
  $('follow').disabled=!runner;
  $('follow').setAttribute('aria-pressed',String(following));
  $('runner-state').title=$('runner-note').textContent;
  // A parked mascot is a start placeholder, never a location observation.
  const {parked,markerDistance}=view;
  if(runner&&markerDistance!=null){
    const state=view.source;
    const key=`${runner.id}:${runner.start_number}:${state}`;
    const location=ll(markerDistance);
    const icon=()=>L.divIcon({className:'mascot-marker',html:mascotMarkup(runner.full_name,state,runner.start_number),iconSize:[76,103],iconAnchor:[38,73],popupAnchor:[0,-65]});
    if(!runnerMarker){runnerMarker=L.marker(location,{icon:icon(),zIndexOffset:1500}).addTo(map);mascotKey=key;}
    else{runnerMarker.setLatLng(location);if(key!==mascotKey){runnerMarker.setIcon(icon());mascotKey=key;}}
    const content=document.createElement('div');
    content.textContent=parked?`${runner.full_name} · parked at the start. No position received yet.`:`${runner.full_name} · ${(markerDistance/1000).toFixed(2)} km · ${$('runner-state').textContent}${p.time?` · last read ${clock(p.time)}`:''}`;
    runnerMarker.bindPopup(content);
    const element=runnerMarker.getElement();if(element){element.dataset.distance=String(markerDistance);element.dataset.source=state;}
    if(parked){$('runner-state').textContent=Date.now()<START?'Parked at start · race pending':'No position yet · icon at start';$('runner-state').title=content.textContent;}
    if(following&&!parked&&!map.getBounds().pad(-.2).contains(location))map.panTo(location,{animate:true});
  }else if(runnerMarker){runnerMarker.remove();runnerMarker=null;mascotKey='';}
  if(measuredMarker){measuredMarker.remove();measuredMarker=null;}
  if(p.kind==='estimated'&&!staleFeed){measuredMarker=L.circleMarker(ll(p.measured),{radius:6,color:'#33294b',fillColor:'#ffdc62',fillOpacity:1,weight:2}).bindTooltip(`Last chip read: ${escape(p.checkpoint)} · ${clock(p.time)}`).addTo(map);}
  const splits=(runner?.splits||[]).filter(s=>Number(s.passing)>0);
  $('splits').innerHTML=splits.length?splits.map(s=>`<div class="split-row"><span>${escape(s.split_name)}</span><strong>${duration(Number(s.passing))}</strong><small>${s.pace>0?`${Math.floor(s.pace/60000)}:${String(Math.floor(s.pace/1000)%60).padStart(2,'0')}/km`:'—'}</small></div>`).join(''):'<p class="muted">Confirmed splits will appear after he crosses a timing mat.</p>';
}
async function refreshLeaders(){
  const rank=ranking;const data=await get(`/rankings/${rank}/results?itemsPerPage=5`);if(rank!==ranking)return;
  const ranked=data.items.filter(a=>a.position!=null&&a.status!=='before');
  leaders=ranked;leaderMarkers.forEach(m=>m.remove());leaderMarkers=[];
  if(!ranked.length){$('leaders').innerHTML='<p class="muted">No rankings yet.</p>';lastLeaders=Date.now();return;}
  $('leaders').replaceChildren();
  ranked.forEach(a=>{const b=document.createElement('button');b.className='leader-row';b.innerHTML=`<span class="rank">${escape(a.position)}</span><span class="name">${escape(a.full_name)}<small>${escape(a.country_code)} · ${a.start_number?`#${escape(a.start_number)}`:'Bib pending'}</small></span><span class="leader-time">${escape(a.gun_time||a.race_time||'Racing')}</span>`;b.onclick=()=>selectRunner(a.participant.id,a.start_number);$('leaders').append(b);});
  const details=await Promise.allSettled(ranked.map(a=>get(`/participants/${a.participant.id}?include=last_passing`)));
  if(rank!==ranking)return;
  details.forEach((r,i)=>{if(r.status!=='fulfilled')return;const a=r.value,p=progress(a,course.timelines);if(p.distance==null)return;const m=L.marker(ll(p.distance),{icon:pin('leader',ranked[i].position,27)}).bindTooltip(`${escape(a.full_name)} · ${p.kind} · ${(p.distance/1000).toFixed(1)} km`).addTo(map);leaderMarkers.push(m);});lastLeaders=Date.now();
}
async function refresh(){
  if(busy||document.hidden)return;busy=true;
  try{
    if(selectedId){const id=selectedId,a=await get(`/participants/${id}?include=splits,last_passing`);if(id===selectedId){runner=a;runnerCheckedAt=Date.now();}}
    else if(desiredBib){const data=await get(`/rankings/25156/results?search=${encodeURIComponent(desiredBib)}&itemsPerPage=20`);const exact=data.items.filter(x=>String(x.start_number)===desiredBib);if(exact.length===1)await selectRunner(exact[0].participant.id,desiredBib);}
    if(Date.now()-lastLeaders>120000)await refreshLeaders();
    lastGood=Date.now();$('connection').textContent=Date.now()<START?'8 Nov · 08:00':`Updated ${clock(lastGood)}`;$('updated').textContent=`Feed checked ${clock(lastGood)} WET`;
  }catch(e){$('connection').textContent='Feed delayed';$('updated').textContent=lastGood?`Last checked ${clock(lastGood)} WET`:'Feed unavailable · retrying';if(Date.now()-lastLeaders>180000){leaderMarkers.forEach(m=>m.remove());leaderMarkers=[];$('leaders').innerHTML='<p class="muted">Leaderboard updates are delayed. Retrying automatically.</p>';}}
  finally{busy=false;renderRunner();}
}
function tick(){const d=START-Date.now();$('countdown-card').hidden=d<=0;$('countdown').textContent=`${Math.floor(d/86400000)}d ${Math.floor(d/3600000)%24}h ${Math.floor(d/60000)%60}m to the start`;if(runner)renderRunner();}
$('search-form').onsubmit=e=>{e.preventDefault();clearTimeout(searchTimer);search($('search').value);};
$('search').oninput=()=>{clearTimeout(searchTimer);const q=$('search').value.trim();searchTimer=setTimeout(()=>search(q),350);};
$('follow').onclick=()=>{following=true;$('follow').textContent='◎';$('follow').setAttribute('aria-pressed',String(following));renderRunner();if(following&&runnerMarker)map.setView(runnerMarker.getLatLng(),15);};
document.querySelectorAll('[data-ranking]').forEach(b=>b.onclick=async()=>{ranking=Number(b.dataset.ranking);document.querySelectorAll('[data-ranking]').forEach(x=>x.classList.toggle('active',x===b));$('leaders').textContent='Loading rankings…';try{await refreshLeaders();}catch{$('leaders').textContent='Rankings unavailable. Retrying automatically.';}});
function toggleLeaderboard(open){$('leaderboard').hidden=!open;$('leaderboard-button').setAttribute('aria-expanded',String(open));document.body.classList.toggle('leaderboard-open',open);}
$('leaderboard-button').onclick=()=>toggleLeaderboard($('leaderboard').hidden);
$('leader-toggle').onclick=()=>toggleLeaderboard(false);
$('clear-runner').onclick=()=>{clearTimeout(searchTimer);searchController?.abort();searchSerial++;selectionSerial++;selectedId=null;desiredBib='';runner=null;following=false;history.replaceState(null,'',location.pathname);$('search').value='';$('search-results').replaceChildren();renderRunner();$('search').focus();};
$('about').onclick=()=>$('info').showModal();$('close-info').onclick=()=>$('info').close();
$('share').onclick=async()=>{try{if(navigator.share)await navigator.share({title:'Porto, together · Race watch',url:location.href});else{await navigator.clipboard.writeText(location.href);toast('Watch link copied');}}catch(e){if(e.name!=='AbortError')toast('Copy the page address to share this watch.');}};
try{
  course=await fetch('./course.json').then(r=>r.json());mapSetup();
  if(initialId&&/^\d+$/.test(initialId))await selectRunner(initialId,desiredBib);
  await refresh();tick();
  if(!runner){$('search').value='Francisco Silva';await search('Francisco Silva');}
  setInterval(()=>{if(!document.hidden&&Date.now()-lastGood>(Date.now()<START?300000:60000))refresh();},15000);
  setInterval(()=>{if(!document.hidden)tick();},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
}catch(e){$('runner-note').textContent=`Could not load the map: ${e.message}. Please reload.`;$('connection').textContent='Connection needed';}
