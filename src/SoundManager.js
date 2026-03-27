/**
 * Procedural sound effects using Web Audio API.
 * No external audio files needed.
 */
export class SoundManager {
    constructor() {
        this.ctx = null;
        this.initialized = false;
    }
    
    init() {
        if (this.initialized) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.initialized = true;
    }
    
    _ensure() {
        if (!this.initialized) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    
    // === DRIBBLE BOUNCE: short low thump ===
    playDribble(intensity = 1) {
        this._ensure();
        const c = this.ctx, t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80 * intensity, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
        gain.gain.setValueAtTime(0.25 * intensity, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain).connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.1);
        
        // Add noise burst for impact
        const buf = c.createBuffer(1, c.sampleRate * 0.04, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
        const noise = c.createBufferSource();
        noise.buffer = buf;
        const nGain = c.createGain();
        nGain.gain.setValueAtTime(0.2, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        noise.connect(nGain).connect(c.destination);
        noise.start(t);
    }
    
    // === SHOT RELEASE: whoosh ===
    playWhoosh() {
        this._ensure();
        const c = this.ctx, t = c.currentTime;
        const buf = c.createBuffer(1, c.sampleRate * 0.25, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            const env = 1 - i / data.length;
            data[i] = (Math.random() * 2 - 1) * env * 0.12;
        }
        const src = c.createBufferSource();
        src.buffer = buf;
        const hp = c.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 2000;
        const gain = c.createGain();
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        src.connect(hp).connect(gain).connect(c.destination);
        src.start(t);
    }
    
    // === RIM CLANK: metallic ring ===
    playClank(impactVel = 3) {
        this._ensure();
        const c = this.ctx, t = c.currentTime;
        const vol = Math.min(impactVel / 8, 1) * 0.35;
        
        [820, 1640, 2460].forEach((freq, i) => {
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = 'square';
            osc.frequency.value = freq + Math.random() * 50;
            gain.gain.setValueAtTime(vol / (i + 1), t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(gain).connect(c.destination);
            osc.start(t);
            osc.stop(t + 0.15);
        });
    }
    
    // === BACKBOARD THUD: low dull impact ===
    playThud(impactVel = 3) {
        this._ensure();
        const c = this.ctx, t = c.currentTime;
        const vol = Math.min(impactVel / 6, 1) * 0.3;
        const buf = c.createBuffer(1, c.sampleRate * 0.15, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            const env = Math.exp(-i / (data.length * 0.2));
            data[i] = (Math.random() * 2 - 1) * env;
        }
        const src = c.createBufferSource();
        src.buffer = buf;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 250;
        const gain = c.createGain();
        gain.gain.value = vol;
        src.connect(lp).connect(gain).connect(c.destination);
        src.start(t);
    }
    
    // === DUNK SLAM: heavy bass thump + metallic ring ===
    playDunk() {
        this._ensure();
        const c = this.ctx, t = c.currentTime;
        
        // Heavy bass impact
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, t);
        osc.frequency.exponentialRampToValueAtTime(25, t + 0.2);
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain).connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.25);
        
        // Metallic ring (rim vibration)
        const osc2 = c.createOscillator();
        const gain2 = c.createGain();
        osc2.type = 'triangle';
        osc2.frequency.value = 400;
        gain2.gain.setValueAtTime(0.2, t + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc2.connect(gain2).connect(c.destination);
        osc2.start(t + 0.02);
        osc2.stop(t + 0.3);
        
        // Noise burst for impact
        const buf = c.createBuffer(1, c.sampleRate * 0.08, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
        const noise = c.createBufferSource();
        noise.buffer = buf;
        const nGain = c.createGain();
        nGain.gain.setValueAtTime(0.4, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        noise.connect(nGain).connect(c.destination);
        noise.start(t);
    }
    
    // === SWISH: smooth net sound ===
    playSwish() {
        this._ensure();
        const c = this.ctx, t = c.currentTime;
        const buf = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            const progress = i / data.length;
            const env = Math.sin(progress * Math.PI) * (1 - progress);
            data[i] = (Math.random() * 2 - 1) * env * 0.5;
        }
        const src = c.createBufferSource();
        src.buffer = buf;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 3000;
        bp.Q.value = 0.5;
        const gain = c.createGain();
        gain.gain.value = 0.25;
        src.connect(bp).connect(gain).connect(c.destination);
        src.start(t);
    }
    
    // === SCORE CHIME: celebratory chord ===
    playScore() {
        this._ensure();
        const c = this.ctx, t = c.currentTime;
        // Major chord sweep
        [523, 659, 784, 1047].forEach((freq, i) => {
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const delay = i * 0.06;
            gain.gain.setValueAtTime(0, t + delay);
            gain.gain.linearRampToValueAtTime(0.12, t + delay + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.5);
            osc.connect(gain).connect(c.destination);
            osc.start(t + delay);
            osc.stop(t + delay + 0.5);
        });
    }
}
