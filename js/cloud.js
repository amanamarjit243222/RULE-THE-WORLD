// ================================================
// RULE THE WORLD — Cloud / Firebase Layer
// js/cloud.js  (regular script — NOT a module)
// Firebase loaded via dynamic import() with
// a guaranteed fallback if network is unavailable
// ================================================
"use strict";

window.db = null;
window.auth = null;
window.fbDoc = null; window.fbSetDoc = null;
window.fbGetDoc = null; window.fbDeleteDoc = null;
window.appId = typeof __app_id !== 'undefined' ? __app_id : 'rule-the-world-v2';
window.hasSaveData = false;

// Always reveal main menu buttons (guaranteed path)
function _revealMenuButtons() {
    const loadMsg = document.getElementById('loading-msg');
    const btnStart = document.getElementById('btn-start');
    const btnHow = document.getElementById('btn-how-to');
    if (loadMsg) loadMsg.style.display = 'none';
    if (btnStart) btnStart.style.display = 'inline-block';
    if (btnHow) btnHow.style.display = 'inline-block';

    // Also check localStorage for a saved game and show continue/reset
    try {
        const raw = localStorage.getItem('rtw_save_v2');
        if (raw) {
            window.hasSaveData = true;
            const btnContinue = document.getElementById('btn-continue');
            const btnReset = document.getElementById('btn-reset');
            if (btnContinue) btnContinue.style.display = 'inline-block';
            if (btnReset) btnReset.style.display = 'inline-block';
        }
    } catch (e) { /* ignore */ }
}

// Safety timeout: if cloud init takes > 3s, show buttons anyway
const _safetyTimer = setTimeout(_revealMenuButtons, 3000);

// Also reveal when DOM is ready as a belt-and-suspenders approach
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(_revealMenuButtons, 200));
} else {
    setTimeout(_revealMenuButtons, 200);
}

const FB_CDN = 'https://www.gstatic.com/firebasejs/11.6.1/';

async function initCloud() {
    try {
        // Dynamic import — won't crash the whole page if it fails
        const [fbApp, fbAuth, fbFs] = await Promise.all([
            import(FB_CDN + 'firebase-app.js'),
            import(FB_CDN + 'firebase-auth.js'),
            import(FB_CDN + 'firebase-firestore.js'),
        ]);

        let firebaseConfig;
        if (typeof __firebase_config !== 'undefined' && __firebase_config) {
            firebaseConfig = JSON.parse(__firebase_config);
        } else {
            throw new Error('No Firebase config — local mode');
        }

        const app = fbApp.initializeApp(firebaseConfig);
        window.auth = fbAuth.getAuth(app);
        window.db = fbFs.getFirestore(app);
        window.fbDoc = fbFs.doc;
        window.fbSetDoc = fbFs.setDoc;
        window.fbGetDoc = fbFs.getDoc;
        window.fbDeleteDoc = fbFs.deleteDoc;

        // Sign in
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await fbAuth.signInWithCustomToken(window.auth, __initial_auth_token);
        } else {
            await fbAuth.signInAnonymously(window.auth);
        }

        // Check for existing cloud save
        if (window.auth.currentUser) {
            const saveRef = window.fbDoc(
                window.db, 'artifacts', window.appId,
                'users', window.auth.currentUser.uid,
                'saves', 'saveData'
            );
            const snap = await window.fbGetDoc(saveRef);
            if (snap.exists()) {
                window.hasSaveData = true;
                const btnContinue = document.getElementById('btn-continue');
                const btnReset = document.getElementById('btn-reset');
                if (btnContinue) btnContinue.style.display = 'inline-block';
                if (btnReset) btnReset.style.display = 'inline-block';
            }
        }
    } catch (e) {
        console.info('Cloud features unavailable — running in local mode:', e.message);
    } finally {
        clearTimeout(_safetyTimer);
        _revealMenuButtons();
    }
}

// Also save to localStorage as local backup
function autoSaveLocal() {
    try {
        if (!window.s || !window.s.c) return;
        const snap = JSON.parse(JSON.stringify(window.s));
        snap.date = window.s.date.toISOString();
        localStorage.setItem('rtw_save_v2', JSON.stringify(snap));
    } catch (e) { /* silent */ }
}

function loadLocalSave() {
    try {
        const raw = localStorage.getItem('rtw_save_v2');
        if (!raw) return null;
        const data = JSON.parse(raw);
        data.date = new Date(data.date);
        return data;
    } catch (e) { return null; }
}

// Expose helpers
window.autoSaveLocal = autoSaveLocal;
window.loadLocalSave = loadLocalSave;

// Start cloud init (non-blocking — buttons appear via _safetyTimer if this fails)
initCloud();
