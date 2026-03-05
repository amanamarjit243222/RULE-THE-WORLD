// ================================================
// RULE THE WORLD — Game Engine
// js/engine.js  (regular script)
// Contains: budget, war, AI, game loop, crises,
//           speed/fullscreen, achievements, victory
// ================================================
"use strict";

// -----------------------------------------------
// BOOT SEQUENCE & LOADING SCREEN
// -----------------------------------------------
async function bootGame() {
    const bar = document.getElementById('loading-bar');
    const pct = document.getElementById('loading-percentage');
    const txt = document.getElementById('loading-text');
    const btn = document.getElementById('btn-init-audio');

    function setProgress(p, label) {
        if (bar) bar.style.width = p + '%';
        if (pct) pct.innerText = p + '%';
        if (txt) txt.innerText = label;
    }

    setProgress(15, 'Loading core simulator modules...');
    await new Promise(r => setTimeout(r, 400));

    setProgress(35, 'Building global maps...');
    // Pre-load map so there is no delay when clicking START
    try { await initMap(); } catch (e) { console.error('Map init failed', e); }

    setProgress(75, 'Populating historical databases...');
    await new Promise(r => setTimeout(r, 200));

    setProgress(95, 'Preparing simulation engines...');
    await new Promise(r => setTimeout(r, 200));

    setProgress(100, 'Ready.');
    if (txt) txt.style.color = '#38bdf8';
    // Auto-advance after a brief moment — no need to click
    await new Promise(r => setTimeout(r, 700));
    completeBootSequence();
}

function completeBootSequence() {
    if (typeof AudioEngine !== 'undefined' && AudioEngine.start) {
        AudioEngine.start();
    }

    const vp = document.getElementById('loading-viewport');
    if (vp) {
        vp.style.opacity = '0';
        setTimeout(() => vp.style.display = 'none', 800);
    }

    const sm = document.getElementById('screen-main');
    if (sm) {
        sm.style.opacity = '1';
        sm.style.pointerEvents = 'auto';
    }

    if (typeof navTo === 'function') navTo('main');
}

// -----------------------------------------------
function updateTension(amount) {
    s.tension += amount;
    s.tension = Math.max(0, Math.min(100, s.tension));
    safeSetText('world-tension', Math.floor(s.tension) + '%');
    // Tension >= 80: forced confrontation on next AI tick
    if (s.tension >= 100) {
        triggerGameOver("DEFCON 1. Global tension has reached 100%. The launch codes were authorized. Nuclear exchange initiated. There are no survivors.");
    }
}

// -----------------------------------------------
// BUDGET ENGINE
// -----------------------------------------------
function updateBudgetSliders() {
    const taxEl = document.getElementById('slide-tax');
    const milEl = document.getElementById('slide-mil');
    const sciEl = document.getElementById('slide-sci');
    const welEl = document.getElementById('slide-wel');

    s.taxRate = taxEl ? parseFloat(taxEl.value) : s.taxRate;
    s.milSpend = milEl ? parseFloat(milEl.value) : s.milSpend;
    s.sciSpend = sciEl ? parseFloat(sciEl.value) : s.sciSpend;
    s.welSpend = welEl ? parseFloat(welEl.value) : (s.welSpend || 0.03);

    safeSetText('disp-tax', s.taxRate + '%');
    safeSetText('disp-mil', '$' + s.milSpend.toFixed(2) + 'T');
    safeSetText('disp-sci', '$' + s.sciSpend.toFixed(2) + 'T');
    const welDisp = document.getElementById('disp-wel');
    if (welDisp) welDisp.innerText = '$' + s.welSpend.toFixed(2) + 'T';

    let baseMultiplier = 1.0;
    let currentMilCost = s.milSpend;
    let currentSciCost = s.sciSpend;

    if (s.activeWar) {
        if (s.activeWar.type === 'MILITARY') currentMilCost *= 3.2;
        else if (s.activeWar.type === 'COLD') currentMilCost *= 1.6;
        else if (s.activeWar.type === 'TRADE') baseMultiplier = 0.65;
        else if (s.activeWar.type === 'CYBER') currentSciCost *= 2.2;
    }

    // HARDER: GDP factor bottoms at 0.3 (steeper recession penalty), territory income further cut
    const gdpFactor = Math.max(0.3, (s.c ? s.c.gdp : 2.0) / 5.5);
    let revenue = (s.taxRate / 22) * gdpFactor * baseMultiplier;  // HARDER: higher tax divisor (was /20)
    if (s.occupiedTerritories) revenue += s.occupiedTerritories.length * 0.08; // HARDER: less territory income (was 0.12)

    // HARDER: Debt interest kicks in sooner (treasury < 0) and at a higher rate
    if (s.c && s.c.treasury < 0) {
        s.interestDebtTicks = (s.interestDebtTicks || 0) + 1;
        const interestDrain = Math.abs(s.c.treasury) * 0.012;  // HARDER: 1.2% per tick (was 0.5%)
        revenue -= interestDrain;
    } else {
        s.interestDebtTicks = 0;
    }

    s.netIncome = revenue - currentMilCost - currentSciCost - s.welSpend;
    const displayNet = Math.abs(s.netIncome) < 0.005 ? 0 : s.netIncome;

    safeSetText('summ-rev', '+$' + revenue.toFixed(2) + 'T');
    safeSetText('summ-mil', '-$' + currentMilCost.toFixed(2) + 'T');
    safeSetText('summ-sci', '-$' + currentSciCost.toFixed(2) + 'T');
    const summWel = document.getElementById('summ-wel');
    if (summWel) summWel.innerText = '-$' + s.welSpend.toFixed(2) + 'T';

    safeSetText('summ-net', (displayNet >= 0 ? '+' : '') + '$' + displayNet.toFixed(2) + 'T');
    safeSetClass('summ-net', displayNet >= 0 ? 'text-emerald-400 font-mono font-bold text-xs' : 'text-red-400 font-mono font-bold text-xs');
    safeSetText('hdr-net-income', (displayNet >= 0 ? '+' : '') + '$' + displayNet.toFixed(2) + 'T');
    safeSetClass('hdr-net-income', `font-bold text-sm ${displayNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`);

    // Visual debt warning
    const budgetPanel = document.getElementById('view-budget-content');
    if (budgetPanel) budgetPanel.classList.toggle('in-debt', s.netIncome < -0.1);
}

// -----------------------------------------------
// WAR ENGINE
// -----------------------------------------------
function declareWar(type) {
    if (!s.selectedForeignCountry) return;
    if (s.activeWar) { showToast('⚠️ Multiple Fronts', 'Conclude the current conflict before opening another.', 'red'); return; }

    const costs = { MILITARY: { cp: 42, ten: 32, ah: 12 }, TRADE: { cp: 22, ten: 12, ah: 6 }, CYBER: { cp: 28, ten: 8, ah: 3 }, COLD: { cp: 18, ten: 18, ah: 0 } };
    const c = costs[type];
    if (!c) return;

    if (s.cmdPoints < c.cp) { showToast('⛽ Insufficient CP', `Need ${c.cp} CP to authorize ${type} operations.`, 'red'); return; }

    s.cmdPoints -= c.cp;
    updateTension(c.ten);
    s.c.demo.youth -= c.ah;
    s.c.demo.work -= c.ah;

    s.activeWar = {
        targetName: s.selectedForeignCountry,
        attacker: s.c.topo,
        defender: s.selectedForeignCountry,
        type, progress: 0, days: 0, stance: 'AGGRESSIVE',
        morale: 100  // Morale: 0-100, degrades with losses, buffs offense
    };

    addNews('WAR DECLARED: ' + type + ' operations launched against ' + s.activeWar.targetName.toUpperCase() + '!', 'critical');
    initWarHUD(type, s.activeWar.targetName);
}

function initWarHUD(type, targetName) {
    const colorMap = { MILITARY: 'text-red-500 border-red-500', TRADE: 'text-orange-500 border-orange-500', CYBER: 'text-cyan-500 border-cyan-500', COLD: 'text-purple-500 border-purple-500' };
    const colorClass = colorMap[type] || 'text-red-500 border-red-500';

    const alertBox = document.getElementById('budget-war-alert');
    if (alertBox) {
        alertBox.className = `bg-red-950/80 p-3 rounded-xl border ${colorClass} text-center animate-pulse`;
        safeSetText('budget-war-alert-text', `ACTIVE ${type} CONFLICT — UPKEEP SURGE`);
        alertBox.classList.remove('hidden');
    }

    const hud = document.getElementById('war-hud');
    if (hud) {
        hud.className = `absolute top-4 left-1/2 -translate-x-1/2 w-[420px] glass-panel rounded-2xl border-2 ${colorClass} p-4 z-40 text-center shadow-[0_0_40px_rgba(239,68,68,0.25)]`;
        safeSetText('war-hud-type', `${type} WARZONE`);
        safeSetClass('war-hud-type', `text-[10px] font-black uppercase tracking-widest mb-2 animate-pulse ${colorClass.split(' ')[0]}`);
        const progBar = document.getElementById('war-progress-bar');
        if (progBar) progBar.className = `h-full absolute left-1/2 -translate-x-1/2 w-0 transition-all duration-500 ${colorClass.split(' ')[0].replace('text-', 'bg-')}`;
        hud.classList.remove('hidden');
        safeSetText('war-hud-us', s.c.name.toUpperCase());
        safeSetText('war-hud-them', targetName.toUpperCase());
        safeSetText('war-pow-us', 'PWR: –');
        safeSetText('war-pow-them', 'PWR: –');
        updateWarGradientDirection();
    }

    updateBudgetSliders();
    updateMapColors();
    updateUI();
}

function updateWarGradientDirection() {
    if (!s.activeWar || !mapG) return;
    const cA = getCentroid(s.activeWar.attacker);
    const cD = getCentroid(s.activeWar.defender);
    const angle = Math.atan2(cD[1] - cA[1], cD[0] - cA[0]);
    const x1 = 50 - Math.cos(angle) * 50, y1 = 50 - Math.sin(angle) * 50;
    const x2 = 50 + Math.cos(angle) * 50, y2 = 50 + Math.sin(angle) * 50;
    d3.select("#war-gradient").attr("x1", x1 + "%").attr("y1", y1 + "%").attr("x2", x2 + "%").attr("y2", y2 + "%");
    const ac = s.activeWar.attacker === s.c.topo ? "rgba(239,68,68,0.85)" : "rgba(180,83,9,0.8)";
    const dc = s.activeWar.defender === s.c.topo ? "rgba(239,68,68,0.85)" : "rgba(30,15,15,0.8)";
    d3.select("#grad-attacker").attr("stop-color", ac).attr("offset", "0%");
    d3.select("#grad-defender").attr("stop-color", dc).attr("offset", "0%");
}

function setWarStance(stance) {
    if (!s.activeWar) return;
    if (stance === 'SURGE') {
        if (s.cmdPoints < 12) { showToast('Low CP', 'Need 12 CP for surge offensive.', 'red'); return; }
        s.cmdPoints -= 12;
        s.activeWar.stance = 'SURGE';
        s.activeWar.morale = Math.min(100, (s.activeWar.morale || 80) + 15); // Surge boosts morale
        addNews('SURGE AUTHORIZED: Massive operational offensive ordered. Lines are moving.', 'critical');
    } else if (stance === 'DEFEND') {
        s.activeWar.stance = s.activeWar.stance === 'DEFEND' ? 'AGGRESSIVE' : 'DEFEND';
        addNews('Forces ordered to adopt ' + s.activeWar.stance.toLowerCase() + ' posture.', 'standard');
    } else if (stance === 'PEACE') {
        // Allow ceasefire at any point, but outcomes vary
        const progress = s.activeWar.progress;
        if (progress >= 30) {
            // Winning — full annexation
            if (!s.occupiedTerritories.includes(s.activeWar.targetName)) {
                s.occupiedTerritories.push(s.activeWar.targetName);
                s.c.treasury += 0.8;
            }
            showEvent('CEASEFIRE: TERRITORY GAINED', 'DIPLOMACY',
                s.activeWar.targetName + ' accepted ceasefire terms. Their territory is now under your administration.');
            updateTension(-8);
        } else if (progress <= -30) {
            // Losing — pay reparations to escape
            s.c.treasury -= 0.5;
            showEvent('CEASEFIRE: REPARATIONS PAID', 'DIPLOMACY',
                'You negotiated an end to hostilities at a cost of $0.5T in reparations. The war is over.');
            updateTension(-5);
        } else {
            // Stalemate — white peace
            showEvent('WHITE PEACE AGREED', 'DIPLOMACY',
                'Diplomats secured a cessation of hostilities with ' + s.activeWar.targetName + '. Borders return to status quo.');
            updateTension(-10);
        }
        endWar();
    }
    updateUI();
}

function processWarTick() {
    if (!s.activeWar) return;
    s.activeWar.days += 10;
    if (s.activeWar.morale === undefined) s.activeWar.morale = 100;

    const targetId = Object.keys(gameDB.factions).find(id => gameDB.factions[id].topo === s.activeWar.targetName);
    const targetTier = targetId ? gameDB.factions[targetId].tier : 'III';
    const theirMult = targetTier === 'I' ? 1.15 : (targetTier === 'II' ? 0.65 : 0.35);
    const moraleFactor = 0.7 + (s.activeWar.morale / 100) * 0.6; // 0.7–1.3x based on morale

    let powerUs = 0, powerThem = 0;
    if (s.activeWar.type === 'MILITARY') {
        s.c.demo.youth -= 0.8; s.c.demo.work -= 0.7;   // HARDER: more per-tick war attrition
        s.c.treasury -= 0.055;   // HARDER: higher ongoing military cost (was 0.035)
        powerUs = (s.milSpend * 100 + 5) * s.c.techLevel * moraleFactor;
        powerThem = theirMult * 12 + 2;
    } else if (s.activeWar.type === 'TRADE') {
        s.c.inf += 0.2;
        powerUs = Math.max(0, s.c.gdp) * 3.5 * moraleFactor;
        powerThem = theirMult * 13;
    } else if (s.activeWar.type === 'CYBER') {
        powerUs = (s.sciSpend * 100 + 3) * s.c.techLevel * moraleFactor;
        powerThem = theirMult * 9;
    } else if (s.activeWar.type === 'COLD') {
        updateTension(0.5);
        powerUs = ((s.milSpend + s.sciSpend) * 50) * s.c.techLevel * moraleFactor;
        powerThem = theirMult * 10;
    }

    if (s.activeWar.stance === 'SURGE') { powerUs *= 1.85; s.activeWar.stance = 'AGGRESSIVE'; }
    else if (s.activeWar.stance === 'DEFEND') { powerThem *= 0.5; powerUs *= 0.6; }

    // Less random — uses 85-115% roll instead of 75-125%
    const rollUs = powerUs * (0.85 + Math.random() * 0.30);
    const rollThem = powerThem * (0.85 + Math.random() * 0.30);
    let result = (rollUs - rollThem) * 1.2;
    if (Math.abs(result) < 0.8) result = Math.random() > 0.5 ? 1.5 : -1.5; // Minimum swing

    s.activeWar.progress += result;

    // Morale: recovers slightly on wins, drops on losses
    if (result > 0) s.activeWar.morale = Math.min(100, s.activeWar.morale + 1.5);
    else s.activeWar.morale = Math.max(10, s.activeWar.morale - 2.5);

    const visualProg = Math.max(0, Math.min(100, (s.activeWar.progress + 100) / 2));
    safeSetWidth('war-progress-bar', visualProg + '%');

    // Show morale in HUD
    const moraleEl = document.getElementById('war-morale-val');
    if (moraleEl) moraleEl.innerText = Math.round(s.activeWar.morale) + '%';
    const moraleFillEl = document.getElementById('war-morale-bar');
    if (moraleFillEl) safeSetWidth('war-morale-bar', s.activeWar.morale + '%');

    const atkProgPct = s.activeWar.attacker === s.c.topo ? (s.activeWar.progress + 100) / 2 : (100 - s.activeWar.progress) / 2;
    d3.select('#grad-attacker').attr('offset', atkProgPct + '%');
    d3.select('#grad-defender').attr('offset', atkProgPct + '%');
    safeSetText('war-pow-us', 'PWR:' + Math.round(rollUs));
    safeSetText('war-pow-them', 'PWR:' + Math.round(rollThem));
    Object.keys(s.c.demo).forEach(k => s.c.demo[k] = Math.max(0, Math.min(100, s.c.demo[k])));

    if (s.activeWar.progress >= 100) {
        if (s.activeWar.type === 'MILITARY') { s.c.treasury += 1.8; s.c.demo.youth += 18; unlockAchievement('first_victory', 'War Victor', 'Won your first military conflict!', 'gold'); }
        else if (s.activeWar.type === 'TRADE') { s.c.gdp += 1.5; s.c.treasury += 0.8; }
        else if (s.activeWar.type === 'CYBER') { s.c.techLevel += 0.22; s.cmdPoints += 28; }
        else if (s.activeWar.type === 'COLD') { s.c.demo.elite += 10; updateTension(-15); }
        if (!s.occupiedTerritories.includes(s.activeWar.targetName)) {
            s.occupiedTerritories.push(s.activeWar.targetName);
            s.c.gdp += 0.8;
            if (s.occupiedTerritories.length >= 5) unlockAchievement('warlord', 'Warlord', 'Annexed 5+ territories!', 'gold');
            if (s.occupiedTerritories.length >= 15) unlockAchievement('dominator', 'Dominator', 'Seized 15 territories!', 'gold');
        }
        showEvent('VICTORY ACHIEVED', 'WAR CONCLUSION',
            s.activeWar.targetName + ' has surrendered in the ' + s.activeWar.type + ' theater.<br><br>Territory annexed. Strategic assets seized.');
        endWar();
    } else if (s.activeWar.progress <= -100 || s.activeWar.days >= 220) {
        // HARDER: defeat penalties drastically steeper
        if (s.activeWar.type === 'MILITARY') { s.c.demo.youth -= 40; s.c.demo.work -= 20; s.c.treasury -= 1.2; updateTension(15); }
        else if (s.activeWar.type === 'TRADE') { s.c.gdp -= 3.5; s.c.inf += 3.5; s.c.treasury -= 0.6; }
        else if (s.activeWar.type === 'CYBER') { s.c.techLevel = Math.max(0.3, s.c.techLevel - 0.25); s.cmdPoints = Math.max(0, s.cmdPoints - 30); }
        else if (s.activeWar.type === 'COLD') { s.c.demo.elite -= 22; s.c.demo.work -= 12; updateTension(18); }
        Object.keys(s.c.demo).forEach(k => s.c.demo[k] = Math.max(0, Math.min(100, s.c.demo[k])));
        showEvent('DEFEAT', 'WAR CONCLUSION',
            'Our forces were routed by ' + s.activeWar.targetName + '.<br><br>We accept their terms. The public is furious.');
        endWar();
    } else if (s.activeWar.morale < 20 && Math.random() > 0.85) {
        // Morale collapse — forces ceasefire negotiation
        showEvent('MORALE COLLAPSE', 'CRISIS',
            'Troop morale has collapsed. Commanders are requesting immediate ceasefire negotiations.',
            [
                { text: 'Negotiate (White Peace)', action: () => { closeEvent(); setWarStance('PEACE'); } },
                { text: 'Press On (-8 morale)', action: () => { s.activeWar.morale = Math.max(5, s.activeWar.morale - 8); closeEvent(); } }
            ]);
    }
}

function endWar() {
    s.activeWar = null;
    safeHide('budget-war-alert');
    safeHide('war-hud');
    updateBudgetSliders();
    updateMapColors();
}

// -----------------------------------------------
// MAIN GAME LOOP
// -----------------------------------------------
function startLoop() {
    if (window.gameInterval) clearInterval(window.gameInterval);
    const intervalMs = Math.max(200, Math.round(1000 / (s.gameSpeed || 1)));

    window.gameInterval = setInterval(() => {
        if (s.isPaused) return;

        s.dayCounter++;
        s.date.setDate(s.date.getDate() + 2);
        s.cmdPoints += 0.10 * (s.cpMult || 1);  // HARDER: slower CP regeneration (was 0.15)

        // Update quarter label in header
        safeSetText('header-quarter', getQuarterLabel(s.date));

        if (s.dayCounter % 5 === 0) {
            s.c.treasury += s.netIncome;
            s.c.techLevel += s.sciSpend * 0.018;
            safeSetText('tech-level-display', s.c.techLevel.toFixed(2));

            // Positive feedback loops
            if (s.c.techLevel > 1.2 && Math.random() > 0.82) s.c.gdp += 0.1;
            if (s.c.techLevel >= 2.5) unlockAchievement('tech_titan', '🔬 Tech Titan', 'Tech Level 2.5 reached!', 'green');

            // Tax stress
            if (s.taxRate > 30) { s.c.demo.elite -= 1.2; s.c.demo.work -= 0.6; s.c.demo.rural -= 0.4; }  // HARDER: high tax punishes at 30% (was 35%)

            // Welfare bonuses
            if (s.welSpend > 0.05) {
                s.c.demo.work += s.welSpend * 1.8;
                s.c.demo.youth += s.welSpend * 1.0;
                s.c.demo.rural += s.welSpend * 0.8;
            }

            processWarTick();
            processActiveCrises();

            // HARDER: inflation > 6% triggers approval crash (was 8%), and steeper penalties
            if (s.c.inf > 6.0) {
                s.c.demo.work -= (s.c.inf - 6.0) * 1.2;
                s.c.demo.rural -= (s.c.inf - 6.0) * 1.2;
                s.c.demo.youth -= (s.c.inf - 6.0) * 0.6;
                s.c.demo.elite -= (s.c.inf - 6.0) * 0.6;
            } else if (s.c.inf > 3.5) {
                s.c.demo.work -= (s.c.inf - 3.5) * 0.7;
                s.c.demo.rural -= (s.c.inf - 3.5) * 0.7;
            }

            // Recession effects
            if (s.c.gdp < 0) s.c.demo.elite -= Math.abs(s.c.gdp) * 0.8;
            if (s.c.gdp < -2) s.c.demo.work -= Math.abs(s.c.gdp + 2) * 0.6;

            // Boom effects
            if (s.c.gdp > 4.0 && s.taxRate < 35) { s.c.demo.work += 0.4; s.c.demo.youth += 0.4; }

            // Dynamic inflation
            s.c.inf = Math.max(0.5, s.c.inf + (s.c.gdp > 2.5 ? 0.08 : -0.05) + (s.welSpend > 0.06 ? 0.03 : 0));

            // Harder: tension >= 80 forces AI to become aggressive every tick
            if (s.tension >= 80 && !s.activeWar && s.dayCounter % 3 === 0) {
                const rivals = Object.keys(gameDB.factions).filter(id => id !== s.factionId && gameDB.factions[id].align === 'RIVAL');
                if (rivals.length > 0 && Math.random() > 0.55) {
                    const rival = gameDB.factions[rivals[Math.floor(Math.random() * rivals.length)]];
                    addNews(`🚨 DEFCON ALERT: ${rival.name} forces mobilising on all fronts. War may be imminent.`, 'critical');
                    updateTension(2);
                }
            }

            // Clamp all demo values
            Object.keys(s.c.demo).forEach(k => s.c.demo[k] = Math.max(0, Math.min(100, s.c.demo[k])));

            // Prestige
            const overallApp = getOverallApproval(s.c.demo);
            s.prestige = Math.max(0, Math.floor(
                (s.c.treasury * 4) + (overallApp * 2.2) +
                (s.occupiedTerritories.length * 60) +
                ((100 - s.tension) * 1.5) + (s.c.techLevel * 35)
            ));
            safeSetText('prestige-score', s.prestige.toLocaleString());

            // Peacemaker: track consecutive low-tension ticks
            if (s.tension <= 3) s.consecutivePeaceTicks = (s.consecutivePeaceTicks || 0) + 1;
            else s.consecutivePeaceTicks = 0;

            // HARDER game-over thresholds
            if (overallApp <= 5) triggerGameOver("OVERTHROWN. Public confidence has evaporated. The military junta has seized power and dissolved your administration.");
            if (s.c.treasury <= -2) triggerGameOver("SOVEREIGN DEFAULT. The nation is bankrupt. The IMF has dissolved your government and installed an emergency administrator.");
            // HARDER: any single demographic bottoming out triggers coup
            if (s.c.demo.youth <= 3) triggerGameOver("YOUTH UPRISING. A generation without hope has stormed the capital. Your government fell overnight.");
            if (s.c.demo.work <= 3) triggerGameOver("GENERAL STRIKE. The working class revolted. Production ceased and your government lost all legitimacy.");
            if (s.c.demo.rural <= 3) triggerGameOver("RURAL REBELLION. Famine and neglect drove the countryside to armed revolt. You have been deposed.");
            // HARDER: prolonged war drains treasury faster — extra per-tick penalty
            if (s.activeWar && s.activeWar.type === 'MILITARY') {
                s.c.treasury -= 0.015;  // additional hidden war drain per budget tick
            }

            checkVictoryConditions();
        }

        if (s.dayCounter % 15 === 0) simulateAIFactions();
        if (s.dayCounter % 22 === 0) autoSaveGame();
        if (s.dayCounter % 10 === 0 && Math.random() > 0.55) triggerSystemCrisis();  // HARDER: crises hit every 10 ticks (was 14), and fire even during war
        if (s.dayCounter % 8 === 0 && Math.random() > 0.3 && !s.isPaused) spawnBubble();
        if (s.dayCounter % 6 === 0) generateNewsItem();

        // Animated unit spawner
        if (s.activeWar) {
            const warUnitType = s.activeWar.type === 'TRADE' ? 'TRADE_WAR' : s.activeWar.type === 'CYBER' ? 'CYBER' : 'MILITARY';
            const o = Math.random() > 0.5 ? s.c.topo : s.activeWar.targetName;
            const d = o === s.c.topo ? s.activeWar.targetName : s.c.topo;
            spawnCurvedUnit(o, d, warUnitType);
            if (Math.random() > 0.45) setTimeout(() => {
                if (s.activeWar) { const o2 = Math.random() > 0.5 ? s.c.topo : s.activeWar.targetName; spawnCurvedUnit(o2, o2 === s.c.topo ? s.activeWar.targetName : s.c.topo, warUnitType); }
            }, 420);
        }

        // Trade unit spawning — every 2 ticks (was 4) to increase volume
        if (s.dayCounter % 2 === 0 && mapG) {
            const countries = mapG.selectAll(".country").data();
            if (countries && countries.length > 1) {
                const n = Math.floor(Math.random() * 4) + 2; // spawn 2 to 5 ships/planes at once
                for (let i = 0; i < n; i++) {
                    const c1 = countries[Math.floor(Math.random() * countries.length)]?.properties?.name;
                    const c2 = countries[Math.floor(Math.random() * countries.length)]?.properties?.name;
                    if (c1 && c2 && c1 !== c2) spawnCurvedUnit(c1, c2, 'NORMAL_TRADE');
                }
            }
        }

        // Throttle UI updates — every 3 ticks saves ~66% DOM work at high speed
        if (s.dayCounter % 3 === 0) updateUI();
    }, intervalMs);
}

// -----------------------------------------------
// CRISIS ENGINE
// -----------------------------------------------
function triggerSystemCrisis() {
    if (s.activeCrises.length >= 4) return; // HARDER: up to 4 simultaneous crises (was 3)
    const crisis = gameDB.systemCrises[Math.floor(Math.random() * gameDB.systemCrises.length)];
    if (s.activeCrises.find(c => c.id === crisis.id)) return;
    const activeCrisisCopy = { ...crisis };
    // HARDER: cascade at 50% chance (was 30%), and costs scale 1.6x (was 1.4x)
    if (s.activeCrises.length >= 1 && Math.random() > 0.5) {
        activeCrisisCopy.costCP = Math.round(activeCrisisCopy.costCP * 1.6);
        activeCrisisCopy.costMoney = parseFloat((activeCrisisCopy.costMoney * 1.6).toFixed(2));
        activeCrisisCopy.name = '⚡ CASCADING: ' + activeCrisisCopy.name;
    }
    // HARDER: crises that linger also passively raise tension
    activeCrisisCopy.tensionDrain = 0.5;
    s.activeCrises.push(activeCrisisCopy);
    updateTension(3);  // HARDER: each new crisis immediately spikes tension
    addNews(`🚨 CRISIS ALERT: ${activeCrisisCopy.name}. Immediate executive action required.`, 'critical');
    showToast(`${crisis.symbol || '🚨'} ${crisis.name}`, crisis.desc, 'red', 6000);
}

function processActiveCrises() {
    s.activeCrises.forEach(c => {
        // HARDER: all crisis drains amplified ~50%
        if (c.gdpDrain) s.c.gdp -= c.gdpDrain * 0.06;
        if (c.infSpike) s.c.inf += c.infSpike * 0.12;
        if (c.appDrain) {
            s.c.demo.rural -= c.appDrain * 0.18;
            s.c.demo.work -= c.appDrain * 0.15;
            s.c.demo.youth -= c.appDrain * 0.08;
        }
        // HARDER: unresolved crises drain treasury
        s.c.treasury -= 0.008;
        // HARDER: tension creep from lingering crises
        if (c.tensionDrain) updateTension(c.tensionDrain);
    });
}

function renderActiveCrises() {
    const panel = document.getElementById('active-crises-panel');
    const list = document.getElementById('crises-list');
    if (!panel || !list) return;
    list.innerHTML = '';
    if (s.activeCrises.length === 0) { safeHide('active-crises-panel'); return; }
    safeShow('active-crises-panel');
    s.activeCrises.forEach(c => {
        const canAfford = s.cmdPoints >= c.costCP && s.c.treasury >= c.costMoney;
        list.innerHTML += `
        <div class="bg-red-950/40 p-2 rounded border border-red-800/50 flex justify-between items-center gap-2">
            <div>
                <div class="text-[9px] font-black text-white uppercase">${c.name}</div>
                <div class="text-[8px] text-red-300 mt-0.5">${c.desc}</div>
            </div>
            <button onclick="resolveCrisis('${c.id}')" ${!canAfford ? 'disabled' : ''} class="px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-[8px] font-black rounded disabled:opacity-40 shrink-0">
                SOLVE<br><span class="text-[7px] font-normal opacity-80">${c.costCP}CP|$${c.costMoney}T</span>
            </button>
        </div>`;
    });
}

function resolveCrisis(id) {
    const idx = s.activeCrises.findIndex(c => c.id === id);
    if (idx === -1) return;
    const c = s.activeCrises[idx];
    if (s.cmdPoints >= c.costCP && s.c.treasury >= c.costMoney) {
        s.cmdPoints -= c.costCP;
        s.c.treasury -= c.costMoney;
        s.activeCrises.splice(idx, 1);
        addNews(`✅ CRISIS RESOLVED: ${c.name} stabilised by executive action.`, 'political');
        renderActiveCrises();
        updateUI();
    }
}

// -----------------------------------------------
// AI FACTION SIMULATION
// -----------------------------------------------
function simulateAIFactions() {
    const factions = Object.keys(gameDB.factions).filter(id => id !== s.factionId);
    const activeAIId = factions[Math.floor(Math.random() * factions.length)];
    const f = gameDB.factions[activeAIId];

    // HARDER: Rivals attack at lower tension; thresholds tightened
    const warThreshold = (s.tension > 60) ? 0.55 : (s.tension > 40) ? 0.78 : 0.90;
    if (f.align === 'RIVAL' && s.tension > 35 && !s.activeWar && Math.random() > warThreshold) {  // HARDER: attacks start at tension 35 (was 55)
        const warType = ['MILITARY', 'CYBER', 'COLD'][Math.floor(Math.random() * 3)];
        updateTension(22);  // HARDER: surprise attack spikes tension more
        s.activeWar = {
            targetName: f.topo, attacker: f.topo, defender: s.c.topo,
            type: warType, progress: -25, days: 0, stance: 'DEFEND', morale: 80  // HARDER: start at -25 (was -15), lower morale
        };
        showEvent(
            "DECLARATION OF WAR", "CRITICAL THREAT",
            `URGENT: ${f.name} has launched a ${warType} offensive against us! Our borders are under attack!`,
            [{ text: "To Arms!", action: () => { closeEvent(); initWarHUD(warType, f.topo); } }]
        );
        return;
    }

    // ALLY requesting aid
    if (f.align !== 'RIVAL' && s.c.treasury > 4.5 && !s.activeWar && Math.random() > 0.91) {
        showEvent("FOREIGN AID REQUEST", "DIPLOMACY",
            `${f.name} faces economic collapse and requests $1.2T emergency relief. Granting aid boosts prestige and bilateral relations — but your treasury bleeds.`,
            [
                {
                    text: "Grant Aid (-$1.2T, +Relations)", action: () => {
                        s.c.treasury -= 1.2; s.c.demo.elite += 4; updateTension(-6);
                        s.diplomaticRelations[activeAIId] = Math.min(100, (s.diplomaticRelations[activeAIId] || 50) + 15);
                        closeEvent(); updateUI();
                    }
                },
                {
                    text: "Decline", action: () => {
                        updateTension(4);
                        s.diplomaticRelations[activeAIId] = Math.max(0, (s.diplomaticRelations[activeAIId] || 50) - 8);
                        closeEvent(); updateUI();
                    }
                }
            ]
        );
        return;
    }

    // HARDER: AI economic actions more frequent and tension-raising
    if (f.align === 'RIVAL' && s.tension > 28 && Math.random() > 0.40) {
        updateTension(6);
        addNews(`🛰 INTEL: ${f.name} conducting large-scale military exercises along contested frontiers.`, 'critical');
    } else if (f.gdp < 1.5 && Math.random() > 0.45) {
        f.gdp += 1.2;
        addNews(`📊 ${f.name} enacted emergency fiscal stimulus to prevent economic collapse.`, 'economic');
    } else if (Math.random() > 0.78) {
        const t2 = factions[Math.floor(Math.random() * factions.length)];
        if (t2 !== activeAIId) addNews(`🤝 ${f.name} signed a strategic partnership agreement with ${gameDB.factions[t2].name}.`, 'political');
    }

    // Drift diplomatic relations toward natural state
    Object.keys(s.diplomaticRelations).forEach(id => {
        const natural = gameDB.factions[id]?.align === 'RIVAL' ? 25 : (gameDB.factions[id]?.align === 'ALLY' ? 65 : 50);
        s.diplomaticRelations[id] = s.diplomaticRelations[id] * 0.98 + natural * 0.02;
    });
}

// -----------------------------------------------
// GAME OVER & EVENTS
// -----------------------------------------------
function triggerGameOver(reason) {
    if (s.isGameOver) return;
    s.isGameOver = true;
    s.isPaused = true;
    if (window.gameInterval) clearInterval(window.gameInterval);
    safeSetText('game-over-desc', reason);
    safeSetText('game-over-score', `Final Prestige: ${(s.prestige || 0).toLocaleString()} | Days in Power: ${s.dayCounter}`);
    safeShow('game-over-modal');
}

function showEvent(title, tag, desc, options = [{ text: "Acknowledge", action: () => closeEvent() }]) {
    s.isPaused = true;
    safeSetText('event-tag', tag);
    safeSetText('event-title', title);
    safeSetHTML('event-desc', desc);
    const optsEl = document.getElementById('event-options');
    if (optsEl) {
        optsEl.innerHTML = '';
        options.forEach(o => {
            const btn = document.createElement('button');
            btn.className = "px-6 py-2 bg-red-700 hover:bg-red-600 text-white font-bold text-sm rounded-lg transition";
            btn.innerText = o.text;
            btn.onclick = o.action;
            optsEl.appendChild(btn);
        });
    }
    safeShow('event-modal');
}

function closeEvent() {
    safeHide('event-modal');
    s.isPaused = false;
}

// -----------------------------------------------
// SPEED CONTROL
// -----------------------------------------------
function setSpeed(speed) {
    s.gameSpeed = speed;
    [1, 2, 4].forEach(v => {
        const btn = document.getElementById(`speed-${v}`);
        if (btn) btn.classList.toggle('active', v === speed);
    });
    if (window.gameInterval) startLoop();
}

// -----------------------------------------------
// FULLSCREEN
// -----------------------------------------------
function toggleFullscreen() {
    const doc = window.document;
    const docEl = doc.documentElement;

    const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    const cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl).catch(err => console.log(err));
    } else {
        cancelFullScreen.call(doc).catch(err => console.log(err));
    }
}
document.addEventListener('fullscreenchange', () => {
    const icon = document.getElementById('fs-icon');
    if (!icon) return;
    if (document.fullscreenElement) {
        icon.innerHTML = '<path d="M5.5 0A.5.5 0 0 1 6 .5v4A.5.5 0 0 1 5.5 5h-4a.5.5 0 0 1 0-1h3.5V.5a.5.5 0 0 1 .5-.5zm5 0a.5.5 0 0 1 .5.5V4h3.5a.5.5 0 0 1 0 1h-4A.5.5 0 0 1 10 4.5v-4a.5.5 0 0 1 .5-.5zM0 10.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V11H.5a.5.5 0 0 1-.5-.5zm10 0a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1H11v3.5a.5.5 0 0 1-1 0v-4z"/>';
    } else {
        icon.innerHTML = '<path d="M1.5 1h4a.5.5 0 0 1 0 1h-4v4a.5.5 0 0 1-1 0v-4A.5.5 0 0 1 1.5 1zm10.5.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4h-4a.5.5 0 0 1-.5-.5zM1 10.5a.5.5 0 0 1 .5-.5h0a.5.5 0 0 1 .5.5v4h4a.5.5 0 0 1 0 1h-4A.5.5 0 0 1 1 15v-4.5zm13 0V15a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1 0-1h4v-4a.5.5 0 0 1 .5-.5h0a.5.5 0 0 1 .5.5z"/>';
    }
});

// -----------------------------------------------
// ACHIEVEMENT & TOAST SYSTEM
// -----------------------------------------------
function unlockAchievement(id, title, desc, color = 'gold') {
    if (!s.achievements) s.achievements = [];
    if (s.achievements.includes(id)) return;
    s.achievements.push(id);
    showToast('🏅 ' + title, desc, color);
}

function showToast(title, desc, color = 'gold', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast-item ${color}`;
    el.innerHTML = `
        <div class="toast-icon ${color}">${title.split(' ')[0]}</div>
        <div style="flex:1">
            <div class="text-[10px] font-black text-white uppercase tracking-widest">${title.replace(/^\S+\s/, '')}</div>
            <div class="text-[8px] text-slate-400 mt-0.5">${desc}</div>
        </div>
        <button onclick="this.parentElement.remove()" class="ml-2 text-slate-600 hover:text-white text-xs shrink-0">✕</button>`;
    container.appendChild(el);
    setTimeout(() => {
        el.style.animation = 'toastSlideOut 0.4s ease forwards';
        setTimeout(() => el.remove(), 400);
    }, duration);
}

// -----------------------------------------------
// HARDER VICTORY CONDITIONS
// -----------------------------------------------
function checkVictoryConditions() {
    if (!s.c || s.isGameOver) return;
    const vmEl = document.getElementById('victory-modal');
    if (vmEl && !vmEl.classList.contains('hidden')) return;

    const yearsRuled = Math.floor(s.dayCounter / 182);
    let victoryTitle = null, victoryDesc = null;

    // HARDEST: 20 territories (was 15)
    if (s.occupiedTerritories.length >= 20) {
        victoryTitle = '🌐 WORLD DOMINATOR';
        victoryDesc = 'You control 20 sovereign nations. The world map is painted in your colours. History will not forget your name.';
    }
    // HARDEST: 50 years, 80% approval (was 40/75%)
    else if (yearsRuled >= 50 && getOverallApproval(s.c.demo) > 80) {
        victoryTitle = '📜 ETERNAL LEADER';
        victoryDesc = 'Fifty years of popular, stable governance. An unprecedented feat. You are the most consequential leader in history.';
    }
    // HARDEST: Tech Level 3.5 + 8 territories (was 3.0 + 5)
    else if (s.c.techLevel >= 3.5 && s.occupiedTerritories.length >= 8) {
        victoryTitle = '🔬 TECH SUPREMACY';
        victoryDesc = 'Your nation commands the technological frontier and eight subjugated territories. The digital-military superpower era belongs to you.';
    }
    // HARDEST: 12 years of peace at tension <= 2 (was 8yr / tension<=3)
    else if ((s.consecutivePeaceTicks || 0) >= 12 * 365 / 2 && yearsRuled >= 12 && s.tension <= 2) {
        victoryTitle = '🕊 THE PEACEMAKER';
        victoryDesc = 'Twelve consecutive years of near-zero global tension. You dismantled decades of enmity through patient, transcendent diplomacy.';
    }
    // HARDEST: all relations >= 75 for 30+ years (was 70 / 20yr)
    else if (yearsRuled >= 30 && Object.keys(s.diplomaticRelations).length > 0 &&
        Object.values(s.diplomaticRelations).every(v => v >= 75)) {
        victoryTitle = '🤝 DIPLOMATIC GRANDMASTER';
        victoryDesc = 'Every major power is an ally or partner for three decades. You achieved what no leader in history could — universal goodwill.';
    }

    if (victoryTitle) {
        s.isPaused = true;
        if (window.gameInterval) clearInterval(window.gameInterval);
        safeSetText('victory-title', victoryTitle);
        safeSetText('victory-desc', victoryDesc);
        safeSetText('victory-score', s.prestige.toLocaleString());
        safeSetText('victory-territories', s.occupiedTerritories.length);
        safeSetText('victory-years', yearsRuled);
        safeShow('victory-modal');
    }
}

// -----------------------------------------------
// DIPLOMATIC RELATIONS PANEL
// -----------------------------------------------
function renderDiploPanel() {
    const content = document.getElementById('view-diplo-content');
    if (!content) return;
    content.innerHTML = `<h3 class="text-[9px] font-black text-slate-500 uppercase mb-3 tracking-widest border-b border-red-900/50 pb-2">Bilateral Relations Index</h3><div class="space-y-3" id="diplo-list"></div>`;
    const list = document.getElementById('diplo-list');
    Object.keys(gameDB.factions).forEach(id => {
        if (id === s.factionId) return;
        const f = gameDB.factions[id];
        const rel = s.diplomaticRelations[id] !== undefined ? s.diplomaticRelations[id] : 50;
        const color = rel >= 65 ? '#10b981' : (rel >= 38 ? '#f59e0b' : '#ef4444');
        const label = rel >= 65 ? 'FRIENDLY' : (rel >= 38 ? 'NEUTRAL' : 'HOSTILE');
        list.innerHTML += `
        <div>
            <div class="flex justify-between text-[9px] font-bold text-slate-300 uppercase mb-1">
                <span>${f.name}</span>
                <span style="color:${color}">${label} ${Math.round(rel)}</span>
            </div>
            <div class="h-1.5 bg-red-950/60 rounded-full overflow-hidden">
                <div class="diplo-bar" style="width:${rel}%;background:${color}"></div>
            </div>
            <div class="text-[7px] text-slate-600 mt-0.5">${f.align} · Tier ${f.tier}</div>
        </div>`;
    });
}

// -----------------------------------------------
// KEYBOARD SHORTCUTS
// -----------------------------------------------
document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === 'Escape') {
        ['event-modal', 'news-modal', 'how-to-modal'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.classList.contains('hidden')) { el.classList.add('hidden'); s.isPaused = false; }
        });
    }
    if (e.key === ' ') { e.preventDefault(); const gs = document.getElementById('screen-game'); if (gs && !gs.classList.contains('hidden')) togglePause(); }
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    if (e.key === '1') setSpeed(1);
    if (e.key === '2') setSpeed(2);
    if (e.key === '4') setSpeed(4);
});
