/**
 * GameMode manager: handles Time Attack and Free Throw challenge modes.
 */
export class GameMode {
    constructor(controller) {
        this.controller = controller;
        this.mode = 'FREE_PLAY'; // FREE_PLAY | TIME_ATTACK | FREE_THROW
        this.timeLeft = 0;
        this.timerInterval = null;
        this.combo = 0;
        this.maxCombo = 0;
        this.ftMade = 0;
        this.ftTotal = 10;
        this.ftAttempt = 0;
        
        this.modes = ['FREE_PLAY', 'TIME_ATTACK', 'FREE_THROW'];
        this.selectedIndex = 0;
        
        this.buildUI();
        this.initEvents();
    }
    
    buildUI() {
        // Mode selector overlay
        this.modePanel = document.createElement('div');
        this.modePanel.id = 'mode-panel';
        this.modePanel.innerHTML = `
            <div class="mode-label">GAME MODE [TAB]</div>
            <div class="mode-desc">Wheel: Scroll | Enter: Select</div>
            <div class="mode-buttons">
                <button data-mode="FREE_PLAY" class="mode-btn active selected">🏀 Free Play</button>
                <button data-mode="TIME_ATTACK" class="mode-btn">⏱️ Time Attack</button>
                <button data-mode="FREE_THROW" class="mode-btn">🎯 Free Throw</button>
            </div>
        `;
        document.getElementById('ui-layer').appendChild(this.modePanel);
        
        // Timer HUD
        this.timerEl = document.createElement('div');
        this.timerEl.id = 'game-timer';
        this.timerEl.style.display = 'none';
        document.getElementById('ui-layer').appendChild(this.timerEl);
        
        // Combo HUD
        this.comboEl = document.createElement('div');
        this.comboEl.id = 'combo-display';
        this.comboEl.style.display = 'none';
        document.getElementById('ui-layer').appendChild(this.comboEl);
        
        // Free throw HUD
        this.ftEl = document.createElement('div');
        this.ftEl.id = 'ft-display';
        this.ftEl.style.display = 'none';
        document.getElementById('ui-layer').appendChild(this.ftEl);
        
        // Results overlay
        this.resultsEl = document.createElement('div');
        this.resultsEl.id = 'results-overlay';
        this.resultsEl.style.display = 'none';
        document.getElementById('ui-layer').appendChild(this.resultsEl);
    }
    
    initEvents() {
        // Keyboard and Wheel events
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Tab') {
                e.preventDefault();
                this.modePanel.classList.toggle('visible');
            }
            
            if (this.modePanel.classList.contains('visible')) {
                if (e.code === 'Enter') {
                    e.preventDefault();
                    this.startMode(this.modes[this.selectedIndex]);
                    this.modePanel.classList.remove('visible');
                }
                if (e.code === 'ArrowUp' || e.code === 'KeyW') {
                    this.moveSelection(-1);
                }
                if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                    this.moveSelection(1);
                }
            }
        });
        
        window.addEventListener('wheel', (e) => {
            if (this.modePanel.classList.contains('visible')) {
                const dir = e.deltaY > 0 ? 1 : -1;
                this.moveSelection(dir);
            }
        }, { passive: true });
    }
    
    moveSelection(dir) {
        this.selectedIndex = (this.selectedIndex + dir + this.modes.length) % this.modes.length;
        this.updateUIHighlight();
    }
    
    updateUIHighlight() {
        const btns = this.modePanel.querySelectorAll('.mode-btn');
        btns.forEach((btn, i) => {
            if (i === this.selectedIndex) btn.classList.add('selected');
            else btn.classList.remove('selected');
        });
    }
    
    startMode(mode) {
        this.mode = mode;
        this.combo = 0;
        this.maxCombo = 0;
        this.controller.score = 0;
        const sc = document.getElementById('score');
        if (sc) sc.innerText = '0';
        this.resultsEl.style.display = 'none';
        
        // Re-lock pointer when starting mode
        this.controller.controls.lock();
        
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        if (mode === 'TIME_ATTACK') {
            this.timeLeft = 60;
            this.timerEl.style.display = 'block';
            this.comboEl.style.display = 'block';
            this.ftEl.style.display = 'none';
            this.updateTimer();
            this.timerInterval = setInterval(() => {
                this.timeLeft--;
                this.updateTimer();
                if (this.timeLeft <= 0) {
                    clearInterval(this.timerInterval);
                    this.endTimeAttack();
                }
            }, 1000);
        } else if (mode === 'FREE_THROW') {
            this.ftMade = 0;
            this.ftAttempt = 0;
            this.timerEl.style.display = 'none';
            this.comboEl.style.display = 'none';
            this.ftEl.style.display = 'block';
            this.updateFT();
            // Move player to free throw line
            this.controller.camera.position.set(0, this.controller.baseHeight, this.controller.environment.rimZ + 4.57);
            this.controller.camera.lookAt(0, 3.05, this.controller.environment.rimZ);
        } else {
            // Free Play
            this.timerEl.style.display = 'none';
            this.comboEl.style.display = 'none';
            this.ftEl.style.display = 'none';
        }
    }
    
    // Called from ShootingController when score happens
    onScore(pts) {
        if (this.mode === 'TIME_ATTACK') {
            this.combo++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;
            // Combo bonus: multiply points
            const multiplier = Math.min(this.combo, 5);
            const bonus = pts * multiplier;
            this.controller.score += bonus - pts; // Controller already added pts
            const sc = document.getElementById('score');
            if (sc) sc.innerText = this.controller.score;
            this.updateCombo();
        } else if (this.mode === 'FREE_THROW') {
            this.ftMade++;
            this.ftAttempt++;
            this.updateFT();
            if (this.ftAttempt >= this.ftTotal) {
                setTimeout(() => this.endFreeThrow(), 1500);
            }
        }
    }
    
    // Called when shot misses (ball resets without scoring)
    onMiss() {
        if (this.mode === 'TIME_ATTACK') {
            this.combo = 0;
            this.updateCombo();
        } else if (this.mode === 'FREE_THROW') {
            this.ftAttempt++;
            this.updateFT();
            if (this.ftAttempt >= this.ftTotal) {
                setTimeout(() => this.endFreeThrow(), 1500);
            }
        }
    }
    
    updateTimer() {
        const m = Math.floor(this.timeLeft / 60);
        const s = this.timeLeft % 60;
        this.timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        if (this.timeLeft <= 10) this.timerEl.classList.add('urgent');
        else this.timerEl.classList.remove('urgent');
    }
    
    updateCombo() {
        if (this.combo > 1) {
            this.comboEl.textContent = `🔥 COMBO ×${this.combo}`;
            this.comboEl.style.display = 'block';
        } else {
            this.comboEl.style.display = 'none';
        }
    }
    
    updateFT() {
        this.ftEl.textContent = `🎯 FREE THROW: ${this.ftMade}/${this.ftAttempt} (${this.ftTotal - this.ftAttempt} left)`;
    }
    
    endTimeAttack() {
        this.resultsEl.style.display = 'flex';
        this.resultsEl.innerHTML = `
            <div class="results-card">
                <h2>⏱️ TIME'S UP!</h2>
                <div class="results-score">${this.controller.score}</div>
                <div class="results-label">POINTS</div>
                <div class="results-detail">Max Combo: ×${this.maxCombo}</div>
                <button class="results-btn" id="results-ok-btn">OK</button>
            </div>
        `;
        document.exitPointerLock();
        this.resultsEl.querySelector('#results-ok-btn').addEventListener('click', () => {
            this.resultsEl.style.display = 'none';
            this.controller.controls.lock();
        });
        this.resultsEl.querySelector('#results-ok-btn').style.pointerEvents = 'all';
    }
    
    endFreeThrow() {
        this.resultsEl.style.display = 'flex';
        const pct = this.ftTotal > 0 ? Math.round(this.ftMade / this.ftTotal * 100) : 0;
        this.resultsEl.innerHTML = `
            <div class="results-card">
                <h2>🎯 FREE THROW</h2>
                <div class="results-score">${this.ftMade}/${this.ftTotal}</div>
                <div class="results-label">${pct}% ACCURACY</div>
                <button class="results-btn" id="ft-results-ok-btn">OK</button>
            </div>
        `;
        document.exitPointerLock();
        this.resultsEl.querySelector('#ft-results-ok-btn').addEventListener('click', () => {
            this.resultsEl.style.display = 'none';
            this.controller.controls.lock();
        });
        this.resultsEl.querySelector('#ft-results-ok-btn').style.pointerEvents = 'all';
    }
}
