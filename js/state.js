// ================================================
// RULE THE WORLD — Game State
// js/state.js  (regular script, global s + helpers)
// ================================================
"use strict";

function getInitialState() {
    return {
        factionId: null,
        c: null,             // current country data
        cmdPoints: 0,
        cpMult: 1.0,
        tension: 0,
        date: new Date(2029, 0, 1),
        dayCounter: 0,
        isPaused: false,
        currentFilter: 'ALL',
        taxRate: 22,
        milSpend: 0.06,
        sciSpend: 0.04,
        welSpend: 0.03,
        netIncome: 0,
        gameSpeed: 1,
        prestige: 0,
        consecutivePeaceTicks: 0,     // for Peacemaker victory
        interestDebtTicks: 0,         // for debt interest punishment
        activeWar: null,
        selectedForeignCountry: null,
        activeCrises: [],
        occupiedTerritories: [],
        diplomaticRelations: {},   // { factionId: 0-100 }
        achievements: [],   // array of unlocked IDs (JSON-serialisable)
        newsArchive: []
    };
}

// Global game state
let s = getInitialState();

// --------------------------------------------------
// SAFE DOM HELPERS
// --------------------------------------------------
function safeSetText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}
function safeSetHTML(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = val;
}
function safeSetWidth(id, val) {
    const el = document.getElementById(id);
    if (el) el.style.width = val;
}
function safeSetClass(id, cls) {
    const el = document.getElementById(id);
    if (el) el.className = cls;
}
function safeShow(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}
function safeHide(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

// --------------------------------------------------
// APPROVAL HELPER
// --------------------------------------------------
function getOverallApproval(demo) {
    return (demo.youth + demo.work + demo.rural + demo.elite) / 4;
}

// --------------------------------------------------
// QUARTER DATE HELPER  (Q1 2029 etc.)
// --------------------------------------------------
function getQuarterLabel(date) {
    const q = Math.floor(date.getMonth() / 3) + 1;
    return `Q${q} ${date.getFullYear()}`;
}
