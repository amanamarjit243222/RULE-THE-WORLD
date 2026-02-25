// ================================================
// RULE THE WORLD — Political Audio Engine v3
// js/audio.js  (regular script, no imports)
// Theme: Cold War political tension + military march
// Inspired by: Shostakovich, Hans Zimmer (Dunkirk),
//              Soviet political hymns, NATO briefing rooms
// Via Web Audio API — no external files needed
// ================================================
"use strict";

const AudioEngine = (() => {
    let ctx = null;
    let master = null;
    let compressor = null;
    let isPlaying = false;
    let allNodes = [];
    let melodyTimer = null;
    let marchTimer = null;
    let tensionTimer = null;
    let brassTimer = null;

    // ── POLITICAL SCALE ────────────────────────────
    // D Dorian — used in Soviet marches, political anthems, military film scores
    // (D natural minor with raised 6th — sounds authoritative but ominous)
    const N = {
        D2: 73.42, F2: 87.31, A2: 110.00,
        C3: 130.81, D3: 146.83, E3: 164.81,
        F3: 174.61, G3: 196.00, A3: 220.00,
        B3: 246.94, C4: 261.63, D4: 293.66,
        E4: 329.63, F4: 349.23, G4: 392.00,
        A4: 440.00, B4: 493.88, D5: 587.33
    };

    // ── POLITICAL CHORD PALETTE ───────────────────
    // Dm — Gm — Am — Bb — C — Dm (political march progression)
    // Used in Soviet anthems, Cold War film scores, military ceremonies
    const CHORDS = [
        [N.D2, N.A2, N.D3, N.F3, N.A3],   // Dm (dark authority)
        [N.G2 || 73.42 * 1.5, N.D3, N.G3, N.B3, N.D4],   // Gm (brooding)
        [N.A2, N.E3 || N.F3 * 0.94, N.A3, N.C4],          // Am7 (tension build)
        [N.C3, N.G3, N.C4, N.E4],          // C major (brief false hope)
        [N.D3, N.A3, N.D4, N.F4],          // Dm/F (return to dark)
        [N.F3, N.C4, N.F4, N.A4],          // F (resolution to power)
    ];

    // Political melody lines — march-like, authoritative, Soviet-inspired
    const MELODY_LINES = [
        // "Empire March" motif — dotted rhythm, rising fourths
        [N.D3, N.D3, N.D3, N.F3, N.A3, N.D4, N.A3, N.F3, N.D3],
        // Descending threat — like a countdown
        [N.D5, N.B4 || N.A4, N.A4, N.G4, N.F4, N.E4, N.D4],
        // Rising authority — anthem-like
        [N.D3, N.E3, N.F3, N.G3, N.A3, N.B3, N.C4, N.D4],
        // Cold War tension motif — stepwise, nervous
        [N.A3, N.A3, N.B3, N.C4, N.B3, N.A3, N.G3, N.A3],
        // Fanfare stab — brass-like angular leaps
        [N.D3, N.F3, N.A3, N.D4, N.A3, N.F3, N.A3, N.D4, N.F4],
    ];

    // March rhythm pattern (kick drum hits in ms offsets)
    const MARCH_PATTERN = [0, 500, 1000, 1500, 2000, 2250, 2500, 3000];

    // ── CONTEXT / INIT ────────────────────────────
    function init() {
        if (ctx) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Hard limiter for cinematic loudness
        compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.knee.value = 4;
        compressor.ratio.value = 8;
        compressor.attack.value = 0.001;
        compressor.release.value = 0.15;

        master = ctx.createGain();
        master.gain.setValueAtTime(0, ctx.currentTime);
        master.connect(compressor);
        compressor.connect(ctx.destination);
    }

    // ── REVERB (political hall: marble + stone) ────
    function makeReverb(secs = 4, decay = 2.2, wet = 0.5) {
        const len = ctx.sampleRate * secs;
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < len; i++) {
                // Early reflections (marble hall)
                const early = i < ctx.sampleRate * 0.04 ? 1.5 : 1;
                d[i] = (Math.random() * 2 - 1) * early * Math.pow(1 - i / len, decay);
            }
        }
        const conv = ctx.createConvolver(); conv.buffer = buf;
        const dry = ctx.createGain(); const wGain = ctx.createGain();
        dry.gain.value = 1 - wet; wGain.gain.value = wet;
        const input = ctx.createGain(); const output = ctx.createGain();
        input.connect(dry); dry.connect(output);
        input.connect(conv); conv.connect(wGain); wGain.connect(output);
        return { input, output };
    }

    // ── DISTORTION (military radio effect) ────────
    function makeDistortion(amount = 40) {
        const ws = ctx.createWaveShaper();
        const n = 256; const c = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const x = (i * 2) / n - 1;
            c[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
        }
        ws.curve = c;
        return ws;
    }

    // ── REGISTER NODE ─────────────────────────────
    function reg(osc, gain) { allNodes.push({ osc, gain }); return { osc, gain }; }

    // ── 1. OMINOUS BASS PEDAL ─────────────────────
    // Low D drone — like a kettledrum roll or organ pedal in political hall
    function createBassPedal() {
        const rev = makeReverb(5, 3.5, 0.4);
        [N.D2, 36.71/*D1*/].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            // Subtle LFO for organ breath effect
            const lfo = ctx.createOscillator();
            const lfoG = ctx.createGain();
            lfo.frequency.value = 0.12 + i * 0.05;
            lfoG.gain.value = 1.8;
            lfo.connect(lfoG); lfoG.connect(osc.detune);
            lfo.start();
            g.gain.setValueAtTime(0, ctx.currentTime);
            g.gain.linearRampToValueAtTime(0.1 - i * 0.03, ctx.currentTime + 3);
            osc.connect(g); g.connect(rev.input);
            osc.start();
            reg(osc, g);
        });
        rev.output.connect(master);
    }

    // ── 2. POLITICAL STRINGS (col legno — bowed tension) ──
    // Imitates a massed string section playing Sul ponticello (bowed near bridge)
    // — the defining sound of Cold War film scores
    function createTensionStrings() {
        const rev = makeReverb(6, 2.8, 0.7);
        // Cluster of detuned sawtooth oscillators → string ensemble
        [[N.A2, -8], [N.A2, 8], [N.D3, -5], [N.D3, 5],
        [N.F3, -6], [N.F3, 4], [N.A3, -3], [N.A3, 7]].forEach(([freq, detune], i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            const filt = ctx.createBiquadFilter();
            filt.type = 'lowpass';
            filt.frequency.value = 1200 + Math.random() * 400;
            filt.Q.value = 1.5;
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            osc.detune.value = detune;
            // Sul ponticello tremolo (fast micro-vibrato)
            const trem = ctx.createOscillator();
            const tremG = ctx.createGain();
            trem.frequency.value = 6.2 + i * 0.15;
            tremG.gain.value = 3;
            trem.connect(tremG); tremG.connect(osc.detune);
            trem.start();
            g.gain.setValueAtTime(0, ctx.currentTime);
            g.gain.linearRampToValueAtTime(0.016, ctx.currentTime + 5 + i * 0.4);
            osc.connect(filt); filt.connect(g); g.connect(rev.input);
            osc.start();
            reg(osc, g);
        });
        rev.output.connect(master);
    }

    // ── 3. MARCH SNARE DRUM ────────────────────────
    // Procedural snare using filtered noise bursts — military march cadence
    function scheduleMarch() {
        if (!isPlaying) return;
        const tempo = 96; // BPM — standard military march
        const beatMs = (60 / tempo) * 1000; // 625ms per beat

        function hitSnare(timeOffset = 0) {
            const t = ctx.currentTime + timeOffset / 1000;
            // White noise burst
            const bufLen = ctx.sampleRate * 0.18;
            const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuf;
            // Bandpass filter for snare "crack"
            const snFilt = ctx.createBiquadFilter();
            snFilt.type = 'bandpass';
            snFilt.frequency.value = 2200;
            snFilt.Q.value = 0.8;
            const snGain = ctx.createGain();
            snGain.gain.setValueAtTime(0.22, t);
            snGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
            noise.connect(snFilt); snFilt.connect(snGain); snGain.connect(master);
            noise.start(t); noise.stop(t + 0.16);

            // Snare body (pitched component)
            const bodyOsc = ctx.createOscillator();
            const bodyG = ctx.createGain();
            bodyOsc.type = 'sine';
            bodyOsc.frequency.setValueAtTime(220, t);
            bodyOsc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
            bodyG.gain.setValueAtTime(0.12, t);
            bodyG.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
            bodyOsc.connect(bodyG); bodyG.connect(master);
            bodyOsc.start(t); bodyOsc.stop(t + 0.12);
        }

        function hitKick(timeOffset = 0) {
            const t = ctx.currentTime + timeOffset / 1000;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            const dist = makeDistortion(15);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(140, t);
            osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
            g.gain.setValueAtTime(0.35, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
            osc.connect(dist); dist.connect(g); g.connect(master);
            osc.start(t); osc.stop(t + 0.3);
        }

        // 4/4 march: KICK on 1&3, SNARE on 2&4
        // Offset pattern in ms within one 4-beat bar
        const barMs = beatMs * 4;
        hitKick(0);
        hitSnare(beatMs);
        hitKick(beatMs * 2);
        hitSnare(beatMs * 3);

        // Optional double-time fill every 4 bars
        if (Math.random() > 0.75) {
            hitSnare(beatMs * 1.5);
            hitSnare(beatMs * 3.5);
        }

        marchTimer = setTimeout(scheduleMarch, barMs);
    }

    // ── 4. BRASS STABS (political fanfare) ────────
    // Imitate brass section stabs — used in Soviet march music
    // Harsh, authoritative, declarative
    function scheduleBrass() {
        if (!isPlaying) return;
        const chord = CHORDS[Math.floor(Math.random() * CHORDS.length)];
        const rev = makeReverb(3, 2, 0.45);
        rev.output.connect(master);

        const stabTime = ctx.currentTime;
        chord.slice(0, 3).forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            const filt = ctx.createBiquadFilter();
            // Brass formant filter
            filt.type = 'peaking';
            filt.frequency.value = 1200 + i * 300;
            filt.gain.value = 8;
            filt.Q.value = 3;
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            osc.detune.value = (Math.random() - 0.5) * 8;
            const dur = 1.2 + Math.random() * 0.8;
            // Brass attack: fast rise, slow decay (authoritatively held)
            g.gain.setValueAtTime(0, stabTime + i * 0.04);
            g.gain.linearRampToValueAtTime(0.065, stabTime + i * 0.04 + 0.06);
            g.gain.setValueAtTime(0.055, stabTime + dur - 0.3);
            g.gain.linearRampToValueAtTime(0, stabTime + dur);
            osc.connect(filt); filt.connect(g); g.connect(rev.input);
            osc.start(stabTime); osc.stop(stabTime + dur + 0.1);
        });

        brassTimer = setTimeout(scheduleBrass, 6000 + Math.random() * 10000);
    }

    // ── 5. POLITICAL MELODY (march theme) ─────────
    function scheduleMelody() {
        if (!isPlaying) return;
        const line = MELODY_LINES[Math.floor(Math.random() * MELODY_LINES.length)];
        const rev = makeReverb(4, 2.5, 0.55);
        rev.output.connect(master);

        let t = ctx.currentTime;
        // Dotted rhythm for march feel: long-short-long-short
        const DURATIONS = [0.5, 0.25, 0.5, 0.25, 0.75, 0.5, 0.25];

        line.forEach((freq, i) => {
            const dur = DURATIONS[i % DURATIONS.length];
            // Brass-like tone (sawtooth + formant)
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            const filt = ctx.createBiquadFilter();
            filt.type = 'bandpass';
            filt.frequency.value = 900;
            filt.Q.value = 2.5;
            osc.type = i % 3 === 0 ? 'sawtooth' : 'square';
            osc.frequency.value = freq;
            // Staccato attack + fast release = march articulation
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.055, t + 0.025);
            g.gain.setValueAtTime(0.055, t + dur * 0.6);
            g.gain.linearRampToValueAtTime(0, t + dur * 0.85);
            osc.connect(filt); filt.connect(g); g.connect(rev.input);
            osc.start(t); osc.stop(t + dur + 0.02);
            t += dur;
        });

        const totalDur = line.length * 0.5 * 1000;
        melodyTimer = setTimeout(scheduleMelody, totalDur + 6000 + Math.random() * 10000);
    }

    // ── 6. COLD WAR TENSION LAYER ─────────────────
    // Rising chromatic line + dissonant cluster = imminent threat
    function scheduleTension() {
        if (!isPlaying) return;

        // Tritone drone (the "devil's interval" — most politically tense)
        const rev = makeReverb(5, 3, 0.6);
        rev.output.connect(master);
        [[N.D3, N.A3 * 1.0], [N.G3 * 0.7071/*Ab*/, N.D4]].forEach(([f1, f2], idx) => {
            [f1, f2].forEach(freq => {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                const lfo = ctx.createOscillator();
                const lfoG = ctx.createGain();
                lfo.frequency.value = 0.06 + idx * 0.04;
                lfoG.gain.value = 4;
                lfo.connect(lfoG); lfoG.connect(osc.detune);
                lfo.start();
                osc.type = 'triangle';
                osc.frequency.value = freq;
                const dur = 12 + Math.random() * 8;
                g.gain.setValueAtTime(0, ctx.currentTime);
                g.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 4);
                g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
                osc.connect(g); g.connect(rev.input);
                osc.start(); osc.stop(ctx.currentTime + dur + 0.5);
                reg(osc, g);
            });
        });

        tensionTimer = setTimeout(scheduleTension, 14000 + Math.random() * 10000);
    }

    // ── SFX ───────────────────────────────────────
    function sfxClick() {
        if (!ctx || !isPlaying) return;
        // Military terminal beep
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.05);
        g.gain.setValueAtTime(0.08, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
        osc.connect(g); g.connect(master);
        osc.start(); osc.stop(ctx.currentTime + 0.12);
    }

    function sfxAlert() {
        if (!ctx || !isPlaying) return;
        // Political broadcast emergency tone (EAS-like)
        [0, 0.18, 0.36].forEach(t => {
            const osc = ctx.createOscillator(); const g = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = t === 0 ? 853 : t === 0.18 ? 960 : 853;
            g.gain.setValueAtTime(0.18, ctx.currentTime + t);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16);
            osc.connect(g); g.connect(master);
            osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.18);
        });
    }

    function sfxVictory() {
        if (!ctx) { init(); }
        if (ctx.state === 'suspended') ctx.resume();
        master.gain.setValueAtTime(0.65, ctx.currentTime);
        // Full political fanfare — D major brass chord
        const fanfare = [N.D3, N.F3, N.A3, N.D4, N.F4, N.A4];
        const rev = makeReverb(4, 2, 0.55); rev.output.connect(ctx.destination);
        fanfare.forEach((freq, i) => {
            const osc = ctx.createOscillator(); const g = ctx.createGain();
            const filt = ctx.createBiquadFilter();
            filt.type = 'peaking'; filt.frequency.value = 1400; filt.gain.value = 6;
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            const t = ctx.currentTime + i * 0.12;
            g.gain.setValueAtTime(0.24, t);
            g.gain.setValueAtTime(0.2, t + 1.2);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
            osc.connect(filt); filt.connect(g); g.connect(rev.input);
            osc.start(t); osc.stop(t + 3);
        });
    }

    // ── PUBLIC API ────────────────────────────────
    function start() {
        if (isPlaying) return;
        init();
        if (ctx.state === 'suspended') ctx.resume();
        isPlaying = true;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(0, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0.52, ctx.currentTime + 5);

        createBassPedal();
        createTensionStrings();
        setTimeout(scheduleTension, 3000);
        setTimeout(scheduleBrass, 5000);
        setTimeout(scheduleMelody, 9000);
        // March starts after 6s (builds up like troops assembling)
        setTimeout(scheduleMarch, 6000);

        _updateBtn();
    }

    function stop() {
        if (!isPlaying || !ctx) return;
        isPlaying = false;
        clearTimeout(melodyTimer);
        clearTimeout(marchTimer);
        clearTimeout(tensionTimer);
        clearTimeout(brassTimer);
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.5);
        setTimeout(() => {
            allNodes.forEach(n => { try { n.osc.stop(); } catch (e) { } });
            allNodes = [];
        }, 3000);
        _updateBtn();
    }

    function toggle() { isPlaying ? stop() : start(); }

    function _updateBtn() {
        const btn = document.getElementById('audio-toggle-btn');
        if (!btn) return;
        btn.textContent = isPlaying ? '\uD83D\uDD0A' : '\uD83D\uDD07';
        btn.title = isPlaying ? 'Mute Music (M)' : 'Unmute Music (M)';
    }

    document.addEventListener('keydown', e => {
        if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.altKey) toggle();
    });

    window.sfxClick = sfxClick;
    window.sfxAlert = sfxAlert;
    window.sfxVictory = sfxVictory;

    return { start, stop, toggle };
})();

// Auto-start on first user gesture
['click', 'keydown', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, () => AudioEngine.start(), { once: true })
);
