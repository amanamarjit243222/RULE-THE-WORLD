// ================================================
// RULE THE WORLD &mdash; UI Layer
// js/ui.js  (regular script)
// Contains: navigation, faction, actions, news,
//           bubble, ticker, updateUI, cloud saves
// ================================================
"use strict";

// -----------------------------------------------
// NAVIGATION
// -----------------------------------------------
function navTo(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`screen-${screenId}`);
    if (target) target.classList.remove('hidden');
    if (screenId === 'select') renderFactionList();
}

function openHowToPlay() { safeShow('how-to-modal'); }
function closeHowToPlay() { safeHide('how-to-modal'); }

// -----------------------------------------------
// FACTION SELECTION
// -----------------------------------------------
function renderFactionList() {
    const list = document.getElementById('faction-list');
    if (!list) return;
    list.innerHTML = '';
    const order = ['india', 'usa', 'china', 'russia', 'eu', 'brazil', 'nigeria'];
    order.forEach(id => {
        const f = gameDB.factions[id];
        const align = f.align === 'RIVAL' ? 'text-orange-400' : f.align === 'ALLY' ? 'text-emerald-400' : f.align === 'LEADER' ? 'text-blue-400' : 'text-amber-400';
        const btn = document.createElement('button');
        btn.className = `faction-card w-full text-left p-4 glass-panel border-l-4 ${f.color} rounded-xl hover:bg-red-950/40 transition-all focus:outline-none`;
        btn.onclick = () => selectFaction(id);
        btn.innerHTML = `
            <div class="flex justify-between items-start mb-1">
                <span class="text-base font-black text-white uppercase tracking-tight leading-none">${f.name}</span>
                <span class="text-[9px] font-bold bg-red-950 px-2 py-0.5 rounded text-red-400 font-mono">TIER ${f.tier}</span>
            </div>
            <div class="flex gap-2 items-center mt-1">
                <span class="text-[9px] ${align} font-bold font-mono tracking-wider">${f.align}</span>
                <span class="text-[8px] text-slate-600">&middot;</span>
                <span class="text-[9px] text-slate-500 font-mono">GDP ${(f.gdp > 0 ? '+' : '')}${f.gdp}%</span>
                <span class="text-[8px] text-slate-600">&middot;</span>
                <span class="text-[9px] text-slate-500 font-mono">$${f.treasury}T</span>
            </div>`;
        list.appendChild(btn);
    });
    selectFaction('india');
}

function selectFaction(id) {
    s.factionId = id;
    const f = gameDB.factions[id];
    safeSetText('sel-name', f.name);
    safeSetText('sel-tier', `Tier ${f.tier} Power &middot; ${f.population ? f.population + 'M People' : ''}`);
    safeSetText('sel-align', `${f.align} Nation`);
    safeSetText('sel-treasury', `$${f.treasury.toFixed(1)}T`);
    safeSetText('sel-cp', f.startCP);
    safeSetText('sel-app', Math.floor(getOverallApproval(f.demo)) + '%');
    safeSetText('sel-gdp', (f.gdp > 0 ? '+' : '') + f.gdp + '%');
    safeSetText('sel-story', f.story);
}

async function startGame() {
    const savedFactionId = s.factionId;
    const f = gameDB.factions[savedFactionId];
    s = getInitialState();
    s.factionId = savedFactionId;

    s.c = {
        name: f.name, topo: f.topo, stability: f.stab, qli: f.qli, alignment: f.align,
        traits: f.traits, gdp: f.gdp, inf: f.inf, treasury: f.treasury, techLevel: 1.0,
        demo: { ...f.demo }
    };
    s.cmdPoints = f.startCP;
    s.tension = f.ten;

    // Init bilateral relations
    Object.keys(gameDB.factions).forEach(id => {
        if (id !== savedFactionId) {
            const nat = gameDB.factions[id].align === 'RIVAL' ? 20 : gameDB.factions[id].align === 'ALLY' ? 62 : 45;
            s.diplomaticRelations[id] = nat + Math.floor(Math.random() * 15 - 7);
        }
    });

    safeSetText('budget-country-name', f.name);
    updateBudgetSliders();
    setSpeed(1); // reset speed markers

    navTo('game');
    renderActionsDOM();
    updateUI();

    safeSetText('story-modal-title', `Welcome, Leader.`);
    safeSetText('story-modal-desc', f.story);
    safeShow('story-modal');
    s.isPaused = true;

    try { await initMap(); } catch (e) { console.error(e); }
}

function closeStory() {
    safeHide('story-modal');
    s.isPaused = false;
    if (typeof mapG !== 'undefined' && mapG) selectMapCountry(s.c.topo);
    startLoop();

    // Spawn an initial burst of units so the map looks busy immediately
    setTimeout(() => {
        const countries = typeof mapG !== 'undefined' && mapG ? mapG.selectAll('.country').data() : [];
        if (countries && countries.length > 10) {
            for (let i = 0; i < 30; i++) {
                setTimeout(() => {
                    const c1 = countries[Math.floor(Math.random() * countries.length)]?.properties?.name;
                    const c2 = countries[Math.floor(Math.random() * countries.length)]?.properties?.name;
                    if (c1 && c2 && c1 !== c2 && typeof spawnCurvedUnit === 'function') {
                        spawnCurvedUnit(c1, c2, 'NORMAL_TRADE');
                    }
                }, i * 200); // stagger spawns 200ms apart so they don't all start at once
            }
        }
    }, 500);
}

// -----------------------------------------------
// LEFT SIDEBAR TABS
// -----------------------------------------------
function setLeftTab(tab) {
    ['intel', 'budget', 'diplo'].forEach(t => {
        const btn = document.getElementById(`tab-left-${t}`);
        const hdr = document.getElementById(`view-${t}-header`);
        const cont = document.getElementById(`view-${t}-content`);
        if (btn) btn.classList.remove('active');
        if (hdr) hdr.classList.add('hidden');
        if (cont) cont.classList.add('hidden');
    });
    const ab = document.getElementById(`tab-left-${tab}`);
    const ah = document.getElementById(`view-${tab}-header`);
    const ac = document.getElementById(`view-${tab}-content`);
    if (ab) ab.classList.add('active');
    if (ah) ah.classList.remove('hidden');
    if (ac) ac.classList.remove('hidden');
    if (tab === 'diplo') renderDiploPanel();
}

// -----------------------------------------------
// SIDEBAR TOGGLES
// -----------------------------------------------
let rightMenuOpen = window.innerWidth > 768;
let leftMenuOpen = window.innerWidth > 768;

function toggleRightMenu() {
    rightMenuOpen = !rightMenuOpen;
    const sb = document.getElementById('right-sidebar');
    const icon = document.getElementById('right-menu-icon');
    if (sb) sb.style.marginRight = rightMenuOpen ? '0px' : '-20rem';
    if (icon) icon.innerText = rightMenuOpen ? '▶' : '◀';
}
function toggleLeftMenu() {
    leftMenuOpen = !leftMenuOpen;
    const sb = document.getElementById('left-sidebar');
    const icon = document.getElementById('left-menu-icon');
    if (sb) sb.style.marginLeft = leftMenuOpen ? '0px' : '-20rem';
    if (icon) icon.innerText = leftMenuOpen ? '◀' : '▶';
}

window.addEventListener('DOMContentLoaded', () => {
    if (window.innerWidth <= 768) {
        const rs = document.getElementById('right-sidebar'); if (rs) rs.style.marginRight = '-20rem';
        const rmi = document.getElementById('right-menu-icon'); if (rmi) rmi.innerText = '◀';
        const ls = document.getElementById('left-sidebar'); if (ls) ls.style.marginLeft = '-20rem';
        const lmi = document.getElementById('left-menu-icon'); if (lmi) lmi.innerText = '▶';
    }
});

// -----------------------------------------------
// PAUSE
// -----------------------------------------------
function togglePause() {
    s.isPaused = !s.isPaused;
    const btn = document.getElementById('pause-btn');
    if (btn) btn.classList.toggle('bg-red-900', s.isPaused);
    const icon = document.getElementById('pause-icon');
    if (icon) {
        icon.innerHTML = s.isPaused
            ? '<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.685a.717.717 0 0 1 0 1.2z"/>'
            : '<path d="M5.5 3.5A.5.5 0 0 1 6 4v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5zm5 0a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5z"/>';
    }
}

// -----------------------------------------------
// ACTIONS PANEL
// -----------------------------------------------
function filterActions(cat) {
    s.currentFilter = cat;
    document.querySelectorAll('[id^="filter-"]').forEach(el => el.classList.remove('active'));
    const fb = document.getElementById(`filter-${cat}`);
    if (fb) fb.classList.add('active');
    renderActionsDOM();
}

function renderActionsDOM() {
    const container = document.getElementById('action-list');
    if (!container || !s.factionId) return;
    container.innerHTML = '';
    const pool = s.currentFilter === 'ALL' ? gameDB.actions : gameDB.actions.filter(a => a.cat === s.currentFilter);
    const visible = pool.filter(a => !a.faction || a.faction === s.factionId);
    visible.forEach(a => {
        const uniqueTag = a.faction ? `<span class="bg-orange-900/40 text-orange-400 px-1.5 py-0.5 rounded text-[7px] font-black ml-1 tracking-widest border border-orange-700/40">UNIQUE</span>` : '';
        const moneyText = a.money > 0 ? ` | -$${a.money}T` : (a.money < 0 ? ` | +$${Math.abs(a.money)}T` : '');
        container.innerHTML += `
        <button id="btn-action-${a.id}" onclick="executeAction('${a.id}')"
            class="w-full text-left p-3 rounded-xl glass-panel border-l-2 ${a.faction ? 'border-orange-600' : 'border-red-900/60'} hover:border-red-500 transition group disabled:opacity-35 disabled:cursor-not-allowed">
            <div class="flex justify-between items-start mb-1">
                <span class="text-[10px] font-bold text-slate-200 group-hover:text-red-300">${a.name}${uniqueTag}</span>
                <span id="cost-action-${a.id}" class="text-[9px] font-mono font-bold text-red-400 shrink-0 ml-2">${a.cost} CP${moneyText}</span>
            </div>
            <p class="text-[8px] text-slate-500 leading-relaxed">${a.desc}</p>
        </button>`;
    });
    updateActionStates();
}

function updateActionStates() {
    if (!s.c) return;
    const pool = s.currentFilter === 'ALL' ? gameDB.actions : gameDB.actions.filter(a => a.cat === s.currentFilter);
    pool.filter(a => !a.faction || a.faction === s.factionId).forEach(a => {
        const btn = document.getElementById(`btn-action-${a.id}`);
        const costSpan = document.getElementById(`cost-action-${a.id}`);
        if (btn && costSpan) {
            const canAfford = s.cmdPoints >= a.cost && (a.money <= 0 || s.c.treasury >= a.money);
            btn.disabled = !canAfford;
            costSpan.className = `text-[9px] font-mono font-bold shrink-0 ml-2 ${canAfford ? 'text-red-400' : 'text-slate-600'}`;
        }
    });
}

function executeAction(id) {
    const action = gameDB.actions.find(a => a.id === id);
    if (!action || !s.c) return;
    if (s.cmdPoints >= action.cost && (action.money <= 0 || s.c.treasury >= action.money)) {
        s.cmdPoints -= action.cost;
        s.c.treasury -= action.money;
        action.effect();
        Object.keys(s.c.demo).forEach(k => s.c.demo[k] = Math.max(0, Math.min(100, s.c.demo[k])));
        updateTension(0);
        addNews(`🏛 POLICY ENACTED: ${action.name}`, 'political');
        updateUI();
    }
}

// -----------------------------------------------
// NEWS
// -----------------------------------------------
function generateNewsItem() {
    if (!s.c) return;
    let text = gameDB.newsPool[Math.floor(Math.random() * gameDB.newsPool.length)];
    let type = 'standard';
    const rand = Math.random();
    if (s.activeWar) { text = `Heavy fighting continues on the ${s.activeWar.targetName} front. Casualties mounting.`; type = 'critical'; }
    else if (s.c.inf > 8 && rand > 0.45) { text = `Hyperinflation crisis deepens as consumer prices soar ${s.c.inf.toFixed(1)}% YoY. Public fury rising.`; type = 'economic'; }
    else if (s.c.gdp < 0 && rand > 0.45) { text = `Economy contracts ${Math.abs(s.c.gdp).toFixed(1)}%. Recession confirmed by central bank data.`; type = 'economic'; }
    else if (getOverallApproval(s.c.demo) < 28 && rand > 0.4) { text = `Approval at historic low ${Math.floor(getOverallApproval(s.c.demo))}%. Calls for resignation intensify.`; type = 'critical'; }
    else if (s.tension > 78 && rand > 0.4) { text = `DEFCON WARNING: Global nuclear readiness elevated. Citizens identify nearest fallout shelters.`; type = 'critical'; }
    else if (s.c.treasury < 0 && rand > 0.5) { text = `S&P downgrades sovereign credit to junk. Borrowing costs spike. IMF monitoring team dispatched.`; type = 'economic'; }
    addNews(text, type);
}

function addNews(text, type = 'standard') {
    const dateStr = s.date ? s.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '&mdash;';
    const full = `[${dateStr}] ${text}`;
    const ticker = document.getElementById('ticker-text');
    if (ticker) ticker.innerText = full + '  &middot;&middot;&middot;  ' + ticker.innerText;
    if (s.newsArchive.length >= 60) s.newsArchive.pop();
    s.newsArchive.unshift({ date: dateStr, text, type });
    renderNewsArchive();
}

function openNewsModal() { s.isPaused = true; safeShow('news-modal'); renderNewsArchive(); }
function closeNewsModal() { s.isPaused = false; safeHide('news-modal'); }

function renderNewsArchive() {
    const list = document.getElementById('news-archive-list');
    if (!list || !s.newsArchive.length) return;
    list.innerHTML = s.newsArchive.map(n => `
        <div class="news-item ${n.type}">
            <span class="text-slate-600 text-[9px] mr-2">[${n.date}]</span>
            <span class="${n.type === 'critical' ? 'text-red-400 font-bold' : n.type === 'economic' ? 'text-emerald-400' : 'text-slate-300'}">${n.text}</span>
        </div>`).join('');
}

// -----------------------------------------------
// CP BUBBLES
// -----------------------------------------------
function spawnBubble() {
    const container = document.getElementById('bubble-layer');
    if (!container || s.isPaused) return;
    const el = document.createElement('div');
    const isCrisis = Math.random() > 0.78;
    el.className = `dna-bubble pointer-events-auto ${isCrisis ? 'crisis-bubble text-red-100' : ''}`;
    el.innerText = isCrisis ? '!' : '+CP';
    el.style.left = (8 + Math.random() * 84) + '%';
    el.style.top = (18 + Math.random() * 62) + '%';
    el.onclick = e => {
        e.stopPropagation();
        if (isCrisis) { s.c.demo.youth += 3; s.c.demo.rural += 2; addNews("Local crisis swiftly contained by executive order.", 'political'); }
        else { s.cmdPoints += 5; showToast('⚡ +5 CP', 'Political opportunity seized!', 'gold', 2000); }
        el.remove();
        updateUI();
    };
    container.appendChild(el);
    setTimeout(() => {
        if (el.parentNode) {
            if (isCrisis) { s.c.demo.elite -= 6; addNews("🚨 Ignored crisis escalates &mdash; public approval drops!", 'critical'); updateUI(); }
            el.remove();
        }
    }, isCrisis ? 3200 : 6500);
}

function animateTicker() {
    const ticker = document.getElementById('ticker-text');
    const container = document.getElementById('world-map-container');
    let pos = container ? container.clientWidth : 1000;
    const step = () => {
        if (!s.isPaused && ticker) {
            pos -= 1.1;
            if (pos < -ticker.scrollWidth) pos = container ? container.clientWidth : 1000;
            ticker.style.transform = `translateX(${pos}px)`;
        }
        requestAnimationFrame(step);
    };
    step();
}

// -----------------------------------------------
// MAP MODE
// -----------------------------------------------
function setMapMode(mode) {
    s.mapMode = mode;
    document.querySelectorAll('.map-mode-btn').forEach(b => { b.classList.remove('active'); b.classList.add('text-slate-400'); });
    const mb = document.getElementById(`mode-${mode}`);
    if (mb) { mb.classList.remove('text-slate-400'); mb.classList.add('active', 'text-white'); }
    updateMapColors();
}

// -----------------------------------------------
// MAIN UI UPDATE
// -----------------------------------------------
function updateUI() {
    if (!s.c) return;

    const overallApp = getOverallApproval(s.c.demo);
    const quarter = getQuarterLabel(s.date);

    // Header stats
    safeSetText('hdr-cp', Math.floor(s.cmdPoints) + ' CP');
    safeSetText('hdr-approval', Math.floor(overallApp) + '%');
    safeSetText('hdr-tension', Math.floor(s.tension) + '%');
    safeSetText('world-tension', Math.floor(s.tension) + '%');
    safeSetText('header-quarter', quarter);
    safeSetText('prestige-score', (s.prestige || 0).toLocaleString());

    // Date
    const ds = s.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    safeSetText('current-date', ds);
    safeSetText('hdr-date', ds);

    // Treasury
    safeSetText('hdr-treasury', '$' + (s.c.treasury || 0).toFixed(2) + 'T');
    const tEl = document.getElementById('hdr-treasury');
    if (tEl) tEl.className = `font-bold text-sm font-mono ${s.c.treasury < 0 ? 'text-red-400' : 'text-emerald-400'}`;

    // Intel panel
    safeSetText('intel-gdp', (s.c.gdp > 0 ? '+' : '') + s.c.gdp.toFixed(2) + '%');
    safeSetText('intel-inf', s.c.inf.toFixed(1) + '%');
    safeSetText('intel-treasury', '$' + (s.c.treasury || 0).toFixed(2) + 'T');
    safeSetText('intel-stability', (s.c.stability || 60) + '%');
    safeSetText('intel-qli', (s.c.qli || 60) + '%');
    safeSetText('tech-level-display', (s.c.techLevel || 1).toFixed(2));
    safeSetText('intel-territories', s.occupiedTerritories.length + ' occupied');

    // Inflation color indicator
    const infEl = document.getElementById('intel-inf');
    if (infEl) infEl.className = s.c.inf > 8 ? 'font-mono font-bold text-xs rate-up' : s.c.inf > 5 ? 'font-mono text-xs text-amber-400' : 'font-mono text-xs text-emerald-400';

    // Demographics
    safeSetText('demo-youth-val', Math.floor(s.c.demo.youth) + '%');
    safeSetText('demo-work-val', Math.floor(s.c.demo.work) + '%');
    safeSetText('demo-rural-val', Math.floor(s.c.demo.rural) + '%');
    safeSetText('demo-elite-val', Math.floor(s.c.demo.elite) + '%');
    safeSetWidth('demo-youth-bar', s.c.demo.youth + '%');
    safeSetWidth('demo-work-bar', s.c.demo.work + '%');
    safeSetWidth('demo-rural-bar', s.c.demo.rural + '%');
    safeSetWidth('demo-elite-bar', s.c.demo.elite + '%');

    // Overall approval bar
    safeSetWidth('overall-approval-bar', overallApp + '%');
    const oab = document.getElementById('overall-approval-bar');
    if (oab) oab.style.background = overallApp > 55 ? '#10b981' : overallApp > 30 ? '#f59e0b' : '#ef4444';

    // Country info panel (ONLY update if we are not actively inspecting a foreign country)
    if (!s.selectedForeignCountry) {
        safeSetText('country-name', s.c.name);
        safeSetText('country-alignment', s.c.alignment || s.c.align || 'RISING');
        safeSetText('val-stability', (s.c.stability || 60) + '%');
        safeSetWidth('bar-stability', (s.c.stability || 60) + '%');
        safeSetText('val-qli', (s.c.qli || 60) + '%');
        safeSetWidth('bar-qli', (s.c.qli || 60) + '%');
    }

    // CP bar
    const cpPct = Math.min(100, (s.cmdPoints / 100) * 100);
    safeSetWidth('cp-bar', cpPct + '%');

    // Territories
    safeSetText('occupied-list', s.occupiedTerritories.length === 0 ? 'None' : s.occupiedTerritories.join(', '));

    // War HUD tension bar
    safeSetText('war-tension-val', Math.floor(s.tension) + '%');
    safeSetWidth('tension-bar', s.tension + '%');

    if (s.dayCounter % 10 === 0) updateMapColors();
    updateActionStates();
    renderActiveCrises();
}

// -----------------------------------------------
// CLOUD SAVE
// -----------------------------------------------
async function autoSaveGame() {
    // Local save (always works)
    if (typeof autoSaveLocal === 'function') autoSaveLocal();
    // Cloud save (optional)
    if (!window.auth || !window.auth.currentUser || !window.db) return;
    try {
        const snap = JSON.parse(JSON.stringify(s));
        snap.date = s.date.toISOString();
        snap.achievements = s.achievements || [];
        const ref = window.fbDoc(window.db, 'artifacts', window.appId, 'users', window.auth.currentUser.uid, 'saves', 'saveData');
        await window.fbSetDoc(ref, snap);
    } catch (e) { console.warn('Cloud autosave failed:', e.message); }
}

async function continueGame() {
    const btn = document.getElementById('btn-continue');
    if (btn) btn.innerText = 'Restoring...';
    try {
        let data = null;
        // Try cloud first
        if (window.auth && window.auth.currentUser && window.db) {
            const ref = window.fbDoc(window.db, 'artifacts', window.appId, 'users', window.auth.currentUser.uid, 'saves', 'saveData');
            const snap = await window.fbGetDoc(ref);
            if (snap.exists()) data = snap.data();
        }
        // Fallback to localStorage
        if (!data && typeof loadLocalSave === 'function') data = loadLocalSave();
        if (!data) { if (btn) btn.innerText = 'Continue Campaign'; return; }

        s = data;
        s.date = s.date instanceof Date ? s.date : new Date(s.date);
        s.isPaused = true;
        s.activeCrises = s.activeCrises || [];
        s.occupiedTerritories = s.occupiedTerritories || [];
        s.diplomaticRelations = s.diplomaticRelations || {};
        safeSetText('budget-country-name', s.c.name);
        updateBudgetSliders();
        navTo('game');
        renderActionsDOM();
        updateUI();
        safeSetText('story-modal-title', 'Welcome Back, Leader.');
        safeSetText('story-modal-desc', 'Your administration records have been restored. All operations paused pending your command.');
        safeShow('story-modal');
        try { await initMap(); } catch (e) { console.error(e); }
    } catch (e) {
        console.error(e);
        if (btn) btn.innerText = 'Continue Campaign';
    }
}

async function resetSaveData() {
    if (!confirm('Permanently wipe your save data?')) return;
    // Clear localStorage
    try { localStorage.removeItem('rtw_save_v2'); } catch (e) { }
    // Clear cloud save if available
    if (window.auth && window.auth.currentUser && window.db) {
        try {
            const ref = window.fbDoc(window.db, 'artifacts', window.appId, 'users', window.auth.currentUser.uid, 'saves', 'saveData');
            await window.fbDeleteDoc(ref);
        } catch (e) { /* ignore */ }
    }
    const btnContinue = document.getElementById('btn-continue');
    const btnReset = document.getElementById('btn-reset');
    if (btnContinue) btnContinue.style.display = 'none';
    if (btnReset) btnReset.style.display = 'none';
    window.hasSaveData = false;
    showToast('Save Deleted', 'Save data wiped successfully.', 'red', 3000);
}

function renderTraits(traits) {
    const container = document.getElementById('country-traits');
    if (!container) return;
    container.innerHTML = traits.map(t =>
        `<div class="text-[8px] bg-red-950/40 p-1.5 rounded border border-red-900/30 font-mono text-slate-400">&gt; ${t}</div>`
    ).join('');
}
function showTOS() { document.getElementById('tos-modal')?.classList.remove('hidden'); }

function acceptCookies() {
    localStorage.setItem('rtw_cookies_accepted', 'true');
    document.getElementById('cookie-banner')?.classList.add('hidden');
}

window.addEventListener('load', () => {
    if (!localStorage.getItem('rtw_cookies_accepted')) {
        setTimeout(() => {
            document.getElementById('cookie-banner')?.classList.remove('hidden');
        }, 2000);
    }
});
