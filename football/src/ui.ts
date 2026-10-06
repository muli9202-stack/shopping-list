import { BOOT_COLORS, HAIR_COLORS, NATION_FLAGS, SKIN_TONES, type PlayerData, type TeamData } from './data';

export const esc = (s: string | number) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function teamBadge(t: TeamData, size = 34) {
  const k = t.home;
  return `<span class="badge" style="width:${size}px;height:${size}px;background:linear-gradient(135deg, ${k.shirt} 0 50%, ${k.stripes ?? k.shorts} 50% 100%);border-color:${k.number}"><b style="color:${k.number}">${esc(t.name.replace(/^(.\.)+\s*/, '').slice(0, 1))}</b></span>`;
}

export function stars(r: number) {
  const n = Math.max(1, Math.min(5, Math.round((r - 62) / 5)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export function face(p: PlayerData, size = 46) {
  const skin = SKIN_TONES[p.skin] ?? SKIN_TONES[1];
  const hair = HAIR_COLORS[p.hairColor] ?? HAIR_COLORS[0];
  const h = p.hair % 6;
  const hairCss = h === 3 ? 'transparent' : hair;
  const hairH = h === 4 ? 46 : h === 1 ? 26 : 34;
  return `<span class="face" style="width:${size}px;height:${size}px;font-size:${size}px;--skin:${skin};--hair:${hairCss};--hh:${hairH}%;--boot:${BOOT_COLORS[p.boots]}"><i class="hair"></i><i class="eyes"></i></span>`;
}

export function futCard(p: PlayerData, opts: { rare?: boolean; extraOvr?: number; small?: boolean; selected?: boolean; data?: string; chem?: number } = {}) {
  const ovr = p.ovr + (opts.rare ? 3 : 0) + (opts.extraOvr ?? 0);
  const tier = ovr >= 75 ? 'gold' : ovr >= 65 ? 'silver' : 'bronze';
  const s = p.stats;
  const six = p.pos === 'GK'
    ? [['GK', s.gk], ['PHY', s.physical], ['COM', s.composure]]
    : [['PAC', Math.round((s.pace + s.accel) / 2)], ['SHO', s.shooting], ['PAS', s.passing], ['DRI', s.dribbling], ['DEF', s.defending], ['PHY', s.physical]];
  return `<div class="fut ${tier} ${opts.rare ? 'rare' : ''} ${opts.small ? 'small' : ''} ${opts.selected ? 'sel' : ''}" ${opts.data ?? ''}>
    <div class="fut-top"><b>${ovr}</b><span>${esc(p.role)}</span><span>${NATION_FLAGS[p.nation] ?? '🏳️'}</span></div>
    ${face(p, opts.small ? 34 : 52)}
    <div class="fut-name">${esc(p.name.split(' ').slice(-1)[0])}</div>
    ${opts.small ? '' : `<div class="fut-stats">${six.map(([k, v]) => `<span><b>${v}</b> ${k}</span>`).join('')}</div>`}
    ${opts.chem !== undefined ? `<div class="chem">${'◆'.repeat(opts.chem)}${'◇'.repeat(3 - opts.chem)}</div>` : ''}
  </div>`;
}

export function modal(html: string, cls = ''): { el: HTMLElement; close: () => void } {
  const el = document.createElement('div');
  el.className = `modal ${cls}`;
  el.innerHTML = `<div class="modal-card">${html}</div>`;
  document.body.appendChild(el);
  return { el, close: () => el.remove() };
}

export function toast(text: string) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 2600);
}
