// Original inline vector art. The animation decorates the icon, never its location.
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function mascotMarkup(name, state, bib) {
  const badge = state === 'parked' ? 'WAITING' : state === 'estimated' ? 'ESTIMATE' : state === 'awaiting' ? 'AWAITING READ' : state === 'stale' ? 'LAST READ' : state === 'finished' ? 'FINISHED!' : 'CHIP READ';
  return `<div class="runner-mascot is-${safe(state)}" data-state="${safe(state)}" aria-label="${safe(name)} · ${badge}">
    <svg class="duck" viewBox="0 0 76 82" aria-hidden="true">
      <ellipse class="duck-ground" cx="38" cy="73" rx="23" ry="6"/>
      <g class="duck-body" stroke="#33294b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <g class="duck-feet"><path d="M29 62l-5 8-10-1q-3 4 2 5h17l3-10" fill="#f89161"/><path d="M43 64l5 8 12-1q4 4-1 5H43l-6-11" fill="#f89161"/></g>
        <path d="M21 44q-14 9-12 15 8 1 16-7" fill="#ffdc62"/>
        <path d="M51 43q10-9 15-5 0 7-10 14" fill="#ffdc62"/>
        <path d="M20 43q-3 22 16 24 24 2 22-22z" fill="#ffdc62"/>
        <path d="M20 52q15 7 38 0l-3 13q-17 8-32-1z" fill="#a69bea"/>
        <rect x="27" y="48" width="23" height="15" rx="4" fill="#fffdf5"/>
        <path d="M13 31q-1-18 18-21 24-4 29 17 5 21-20 23-24 0-27-19" fill="#ffdc62"/>
        <path d="M15 21q18-12 41-2l3 8q-22-11-45 1z" fill="#9c8ae5"/>
        <path d="M17 22l-7-5m6 10-9 1" fill="none" stroke="#9c8ae5" stroke-width="4"/>
        <ellipse cx="30" cy="30" rx="7" ry="9" fill="white"/><ellipse cx="46" cy="28" rx="8" ry="10" fill="white"/>
        <ellipse cx="33" cy="32" rx="2.4" ry="3.3" fill="#33294b" stroke="none"/><ellipse cx="44" cy="26" rx="2.4" ry="3.3" fill="#33294b" stroke="none"/>
        <path d="M30 39q12-7 27-1-7 11-24 6z" fill="#f89161"/><path d="M36 41l10 1" fill="none" stroke-width="1.4"/>
        <path d="M61 16q7 9 1 10-7-1-1-10" fill="#a1dce9" stroke-width="1.5"/>
        <text x="38.5" y="59" text-anchor="middle" font-size="${String(bib || '').length > 4 ? 6 : 8}" font-family="sans-serif" font-weight="800" stroke="none" fill="#33294b">${safe(bib || 'GO!')}</text>
      </g>
    </svg><span class="mascot-badge">${badge}</span></div>`;
}
