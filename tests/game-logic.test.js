/**
 * @jest-environment node
 *
 * Unit Tests for RULE THE WORLD - Core Game Logic
 *
 * Tests cover pure state-management helpers and deterministic
 * game calculations that don't require a browser DOM.
 */

// -------------------------------------------------------
// Mirror pure functions from src/services/state.js
// -------------------------------------------------------
function getInitialState() {
    return {
        factionId: null,
        cmdPoints: 0,
        cpMult: 1.0,
        tension: 0,
        date: new Date(2029, 0, 1),
        dayCounter: 0,
        isPaused: false,
        taxRate: 22,
        milSpend: 0.06,
        sciSpend: 0.04,
        welSpend: 0.03,
        netIncome: 0,
        gameSpeed: 1,
        prestige: 0,
        consecutivePeaceTicks: 0,
        interestDebtTicks: 0,
        activeWar: null,
        activeCrises: [],
        occupiedTerritories: [],
        diplomaticRelations: {},
        achievements: [],
        newsArchive: []
    };
}

function getOverallApproval(demo) {
    return (demo.youth + demo.work + demo.rural + demo.elite) / 4;
}

function getQuarterLabel(date) {
    const q = Math.floor(date.getMonth() / 3) + 1;
    return `Q${q} ${date.getFullYear()}`;
}

// -------------------------------------------------------
// Tests: Initial State
// -------------------------------------------------------
describe('getInitialState()', () => {
    let state;
    beforeEach(() => { state = getInitialState(); });

    test('starts in 2029', () => {
        expect(state.date.getFullYear()).toBe(2029);
    });

    test('game starts unpaused', () => {
        expect(state.isPaused).toBe(false);
    });

    test('starts with zero tension', () => {
        expect(state.tension).toBe(0);
    });

    test('starts with 22% default tax rate', () => {
        expect(state.taxRate).toBe(22);
    });

    test('no active war at game start', () => {
        expect(state.activeWar).toBeNull();
    });

    test('empty achievements on start', () => {
        expect(state.achievements).toEqual([]);
    });

    test('has correct initial spending allocations', () => {
        expect(state.milSpend).toBe(0.06);
        expect(state.sciSpend).toBe(0.04);
        expect(state.welSpend).toBe(0.03);
    });
});

// -------------------------------------------------------
// Tests: Approval Rating
// -------------------------------------------------------
describe('getOverallApproval()', () => {
    test('calculates average of four demographic groups', () => {
        const demo = { youth: 80, work: 70, rural: 60, elite: 90 };
        expect(getOverallApproval(demo)).toBe(75);
    });

    test('returns 0 if all demographics are 0', () => {
        const demo = { youth: 0, work: 0, rural: 0, elite: 0 };
        expect(getOverallApproval(demo)).toBe(0);
    });

    test('returns 100 if all demographics are maxed', () => {
        const demo = { youth: 100, work: 100, rural: 100, elite: 100 };
        expect(getOverallApproval(demo)).toBe(100);
    });
});

// -------------------------------------------------------
// Tests: Quarter Label
// -------------------------------------------------------
describe('getQuarterLabel()', () => {
    test('returns Q1 for January', () => {
        expect(getQuarterLabel(new Date(2029, 0, 15))).toBe('Q1 2029');
    });

    test('returns Q2 for April', () => {
        expect(getQuarterLabel(new Date(2029, 3, 1))).toBe('Q2 2029');
    });

    test('returns Q3 for July', () => {
        expect(getQuarterLabel(new Date(2029, 6, 1))).toBe('Q3 2029');
    });

    test('returns Q4 for October', () => {
        expect(getQuarterLabel(new Date(2029, 9, 1))).toBe('Q4 2029');
    });
});
