import * as CANNON from 'cannon-es';
import * as THREE from 'three';

/**
 * Basketball controller: dribble, sprint, gather-step, layup, dunk, jump shot.
 * 
 * Phases:
 *   DRIBBLE       → Idle with bouncing ball
 *   GATHER_STEPS  → Sprint + click: 2-step gather toward basket before layup/dunk
 *   LOAD/DELIVERY → Standing shot sequence
 *   LAYUP_DRIVE   → Close-range layup windup
 *   LAYUP_RELEASE → Finger-roll release
 *   DUNK_JUMP     → Slam dunk
 *   RELEASE       → Jump shot release
 *   FOLLOW        → Post-shot animation
 */
export class ShootingController {
    constructor(ball, camera, environment, controls, moveState, sound) {
        this.ball = ball;
        this.camera = camera;
        this.environment = environment;
        this.controls = controls;
        this.moveState = moveState;
        this.sound = sound;
        
        // Dribble sound tracking
        this.lastDribbleBounce = false;
        
        this.score = 0;
        this.phase = 'DRIBBLE';
        this.phaseTime = 0;
        this.shootTime = 0;
        
        this.deliveryProgress = 0;
        this.releaseQuality = 1;
        this.shotType = 'SHOT';
        this.shotDistance = 0;
        
        this.jumpOffset = 0;
        this.jumpVelocity = 0;
        this.isAirborne = false;
        this.jumpPeakReached = false;
        this.jumpPeakTime = 0;
        this.baseHeight = 1.70;
        
        this.dribbleTime = 0;
        this.dribbleBounceSpeed = 2.8;
        
        this.dunkProgress = 0;
        this.isSprinting = false;
        this.isMoving = false;
        
        // Gather step state
        this.gatherStepCount = 0;
        this.gatherStepTime = 0;
        this.gatherDirection = new THREE.Vector3();
        this.gatherSpeed = 0;
        
        // Violation rules
        this.hasDribbled = true;       // Start with dribble available
        this.ballPickedUp = false;     // Ball has been picked up (stop dribble)
        this.stepsAfterPickup = 0;     // Steps counted after stop dribbling
        this.lastPos = new THREE.Vector3();
        this.distSincePickup = 0;      // Dist moved since picking up ball
        
        // Auto Shooting
        this.autoShoot = false;
        
        this.buildPlayerModel();
        this.initEvents();
    }
    
    buildPlayerModel() {
        this.bodyGroup = new THREE.Group();
        this.camera.add(this.bodyGroup);
        
        const skin = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.6 });
        const darkSkin = new THREE.MeshStandardMaterial({ color: 0x7a4a1e, roughness: 0.65 });
        const shorts = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
        const shoeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });
        
        // RIGHT ARM
        this.rightShoulder = new THREE.Group();
        this.rightShoulder.position.set(0.14, -0.16, -0.40);
        this.bodyGroup.add(this.rightShoulder);
        this.rightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.20), skin);
        this.rightUpperArm.position.y = -0.10;
        this.rightShoulder.add(this.rightUpperArm);
        this.rightElbow = new THREE.Group();
        this.rightElbow.position.set(0, -0.20, 0);
        this.rightShoulder.add(this.rightElbow);
        this.rightForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.024, 0.18), skin);
        this.rightForearmMesh.position.y = -0.09;
        this.rightElbow.add(this.rightForearmMesh);
        this.rightWrist = new THREE.Group();
        this.rightWrist.position.set(0, -0.18, 0);
        this.rightElbow.add(this.rightWrist);
        this.rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.025), darkSkin);
        this.rightHand.position.y = -0.03;
        this.rightWrist.add(this.rightHand);
        
        // LEFT ARM
        this.leftShoulder = new THREE.Group();
        this.leftShoulder.position.set(-0.14, -0.16, -0.40);
        this.bodyGroup.add(this.leftShoulder);
        this.leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.20), skin);
        this.leftUpperArm.position.y = -0.10;
        this.leftShoulder.add(this.leftUpperArm);
        this.leftElbow = new THREE.Group();
        this.leftElbow.position.set(0, -0.20, 0);
        this.leftShoulder.add(this.leftElbow);
        this.leftForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.024, 0.18), skin);
        this.leftForearmMesh.position.y = -0.09;
        this.leftElbow.add(this.leftForearmMesh);
        this.leftWrist = new THREE.Group();
        this.leftWrist.position.set(0, -0.18, 0);
        this.leftElbow.add(this.leftWrist);
        this.leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.025), darkSkin);
        this.leftHand.position.y = -0.03;
        this.leftWrist.add(this.leftHand);
        
        // LEGS
        this.legGroup = new THREE.Group();
        this.legGroup.position.set(0, -0.45, -0.32);
        this.bodyGroup.add(this.legGroup);
        [['right', 0.06], ['left', -0.06]].forEach(([side, xOff]) => {
            const hip = new THREE.Group();
            hip.position.set(xOff, 0, 0);
            this.legGroup.add(hip);
            const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.28), shorts);
            thigh.position.y = -0.14; hip.add(thigh);
            const knee = new THREE.Group();
            knee.position.set(0, -0.28, 0); hip.add(knee);
            const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.26), skin);
            shin.position.y = -0.13; knee.add(shin);
            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.12), shoeMat);
            foot.position.set(0, -0.28, 0.03); knee.add(foot);
            this[`${side}Hip`] = hip;
            this[`${side}Knee`] = knee;
        });
    }
    
    getDistToRim() {
        const cp = this.camera.position;
        const dx = cp.x;
        const dz = cp.z - this.environment.rimZ;
        return Math.sqrt(dx * dx + dz * dz);
    }
    
    determineShotType() {
        const d = this.getDistToRim();
        if (d < 1.2) return 'DUNK';
        if (d < 3.5) return 'LAYUP';
        return 'SHOT';
    }
    
    // Can only layup/dunk inside 3pt line
    canDriveMove() {
        return !this.isThreePointer(this.camera.position);
    }
    
    isThreePointer(pos) {
        const dx = Math.abs(pos.x);
        const dz = pos.z - this.environment.rimZ;
        // NBA corner 3: 6.71m, Arc: 7.24m
        // Arc starts at z = ~2.73m from rim center
        if (dz <= 2.73) return dx >= 6.71;
        return Math.sqrt(dx * dx + dz * dz) >= 7.24;
    }
    
    initEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                const canJump = !this.isAirborne && (
                    this.phase === 'DRIBBLE' || this.phase === 'DELIVERY' || 
                    this.phase === 'LOAD' || this.phase === 'LAYUP_DRIVE' ||
                    this.phase === 'GATHER_STEPS'
                );
                if (canJump) {
                    if (!this.shotPosition) this.shotPosition = this.camera.position.clone();
                    this.doJump();
                }
            } else if (e.code === 'KeyB') {
                this.autoShoot = !this.autoShoot;
                this.updateShotIndicator();
            }
        });
        
        window.addEventListener('mousedown', (e) => {
            if (!this.controls.isLocked) return;
            if (e.button === 0 && this.phase === 'DRIBBLE') {
                // Double dribble check: if ball was picked up and put down again
                if (this.ballPickedUp && !this.hasDribbled) {
                    this.callViolation('DOUBLE DRIBBLE');
                    return;
                }
                
                if (this.isSprinting && this.canDriveMove()) {
                    this.shotPosition = this.camera.position.clone();
                    this.startGatherSteps();
                    this.ballPickedUp = true;
                    this.hasDribbled = false;
                    this.distSincePickup = 0;
                    this.lastPos.copy(this.camera.position);
                } else {
                    const dist = this.getDistToRim();
                    this.ballPickedUp = true;
                    this.hasDribbled = false;
                    this.distSincePickup = 0;
                    this.lastPos.copy(this.camera.position);
                    this.shotPosition = this.camera.position.clone();
                    if (dist < 1.2) { this.shotType = 'DUNK'; this.startDunk(); }
                    else if (dist < 3.5) { this.shotType = 'LAYUP'; this.startLayup(); }
                    else { 
                        this.shotType = 'SHOT'; 
                        this.phase = 'LOAD'; 
                        this.phaseTime = 0; 
                        this.deliveryProgress = 0; 
                        this.shotDistance = this.getDistToRim(); 
                        if (this.autoShoot) {
                            this.autoShootActive = true;
                            if (!this.isAirborne) this.doJump();
                        }
                    }
                }
            }
        });
        
        window.addEventListener('mouseup', (e) => {
            if (!this.controls.isLocked) return;
            if (e.button === 0) {
                if (this.autoShootActive && this.shotType === 'SHOT') return; // Auto-Release handles it
                if (this.phase === 'DELIVERY' || this.phase === 'LOAD') this.releaseShot();
                else if (this.phase === 'LAYUP_DRIVE') this.releaseLayup();
            }
        });
    }
    
    // ===== GATHER STEPS (sprint → layup/dunk) =====
    
    startGatherSteps() {
        this.phase = 'GATHER_STEPS';
        this.phaseTime = 0;
        this.gatherStepCount = 0;
        this.gatherStepTime = 0;
        
        // Capture sprint direction and speed at the moment of click
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        dir.y = 0; dir.normalize();
        this.gatherDirection.copy(dir);
        this.gatherSpeed = 6.0; // Decelerate from sprint speed
        
        // Pick up the ball (no more dribble)
        this.deliveryProgress = 0;
    }
    
    doJump() {
        const boost = (this.phase === 'GATHER_STEPS' || this.shotType === 'DUNK') ? 5.5 : 3.2;
        this.jumpVelocity = boost;
        this.isAirborne = true;
        this.jumpPeakReached = false;
        this.jumpPeakTime = 0;
    }
    
    // ===== SHOT =====
    
    releaseShot() {
        this.releaseQuality = this.autoShootActive ? 1.0 : this.calcQuality();
        this.shotDistance = this.getDistToRim();
        this.phase = 'RELEASE';
        this.phaseTime = 0;
        this.shootTime = performance.now();
        if (!this.isAirborne) { this.jumpVelocity = 3.2; this.isAirborne = true; this.jumpPeakReached = false; }
        setTimeout(() => this.fireShot(), 60);
    }
    
    calcQuality() {
        const dp = Math.min(this.deliveryProgress, 1);
        let t = dp >= 0.8 ? 1 : dp >= 0.6 ? 0.5 + (dp - 0.6) / 0.2 * 0.5 : dp / 0.6 * 0.5;
        let jt = 0.5;
        if (this.isAirborne) {
            if (this.jumpPeakReached) { const s = performance.now() - this.jumpPeakTime; jt = s < 150 ? 1 : s < 400 ? 0.7 : 0.4; }
            else { jt = 0.3 + Math.min(this.jumpOffset / 0.5, 1) * 0.5; }
        }
        return dp * 0.30 + jt * 0.45 + (0.7 + Math.random() * 0.3) * 0.25;
    }
    
    fireShot() {
        if (this.phase !== 'RELEASE') return;
        this.phase = 'FOLLOW'; this.phaseTime = 0;
        
        const cd = new THREE.Vector3(); this.camera.getWorldDirection(cd);
        const hD = new THREE.Vector3(cd.x, 0, cd.z).normalize();
        
        let vU = 0, vH = 0;
        const bad = 1 - this.releaseQuality; 
        const sc = bad * 0.8;
        
        if (this.autoShoot) {
            const bp = this.ball.body.position;
            // Target just above the rim front lip so ball clears it and drops in
            const targetY = this.environment.rimY + 0.15;
            const dy = targetY - bp.y;
            
            // Calculate PROJECTED distance along the aim direction (hD)
            // This is critical for side/angle shots: the ball travels along hD,
            // so we need the distance along hD to reach the rim, not the straight-line distance
            const toRim = new THREE.Vector3(
                0 - bp.x,           // rim X is 0
                0,
                this.environment.rimZ - bp.z
            );
            const dist = Math.max(1, toRim.dot(hD)); // projected distance along aim direction
            
            // Launch angle: mid-range (3-4m) uses 45°, far range (7-8m) uses 48°
            // Lower angles for close = faster/flatter, slightly higher for far = more arc to drop in
            const launchAngle = THREE.MathUtils.lerp(45, 49, THREE.MathUtils.clamp((dist - 3) / 5, 0, 1));
            const rad = launchAngle * Math.PI / 180;
            
            // Solve for initial speed using projectile equation:
            // dy = dist * tan(angle) - (g * dist^2) / (2 * v^2 * cos^2(angle))
            const g = 9.82;
            const cosA = Math.cos(rad);
            const tanA = Math.tan(rad);
            const denom = 2 * cosA * cosA * (dist * tanA - dy);
            
            let speed;
            if (denom > 0.01) {
                speed = Math.sqrt(g * dist * dist / denom);
            } else {
                speed = 8;
            }
            
            // Small drag compensation (~5%)
            speed *= 1.05;
            
            vU = Math.sin(rad) * speed;
            vH = Math.cos(rad) * speed;
        } else {
            // Manual shot power based on power meter
            const uA = Math.asin(THREE.MathUtils.clamp(cd.y, -1, 1));
            const eU = Math.max(uA, 15 * Math.PI / 180);
            const dp = Math.min(this.deliveryProgress, 1);
            const sp = 5.0 + dp * 6.5;
            vU = Math.sin(eU) * sp;
            vH = Math.cos(eU) * sp;
        }

        // Apply variance from bad timing
        vU += (Math.random() - 0.5) * sc;
        const vx = hD.x * vH + (Math.random() - 0.5) * sc * 0.5;
        const vz = hD.z * vH + (Math.random() - 0.5) * sc * 0.5;
        
        const m = this.ball.body.mass;
        this.ball.body.applyImpulse(new CANNON.Vec3(vx * m, vU * m, vz * m));
        
        this.sound.playWhoosh();
        this.ball.body.angularVelocity.set(-15 * hD.z, 0, 15 * hD.x);
    }
    
    // ===== LAYUP =====
    
    startLayup() { this.phase = 'LAYUP_DRIVE'; this.phaseTime = 0; this.deliveryProgress = 0; this.shotType = 'LAYUP'; this.shotDistance = this.getDistToRim(); }
    
    releaseLayup() {
        this.phase = 'LAYUP_RELEASE'; this.phaseTime = 0; this.shootTime = performance.now();
        if (!this.isAirborne) { this.jumpVelocity = 4.0; this.isAirborne = true; this.jumpPeakReached = false; }
        setTimeout(() => this.fireLayup(), 80);
    }
    
    fireLayup() {
        if (this.phase !== 'LAYUP_RELEASE') return;
        this.phase = 'FOLLOW'; this.phaseTime = 0;
        const cp = this.camera.position;
        const dist = this.getDistToRim();
        // Close range: aim directly at rim; further: use backboard
        const bbOffset = dist < 1.8 ? 0 : -0.25;
        const tgt = new THREE.Vector3(0, this.environment.rimY + 0.35, this.environment.rimZ + bbOffset);
        const dx = tgt.x - cp.x, dy = tgt.y - (cp.y + this.jumpOffset), dz = tgt.z - cp.z;
        const hD = Math.sqrt(dx * dx + dz * dz);
        // Softer arc at close range
        const arcAngle = dist < 2 ? 55 : 40;
        const a = arcAngle * Math.PI / 180; const g = 9.82;
        const den = 2 * Math.cos(a) ** 2 * (hD * Math.tan(a) - dy);
        let v = den > 0.01 ? Math.sqrt(Math.abs(g * hD * hD / den)) : 3;
        // Cap velocity for close-range softness
        v = Math.min(v, dist < 2 ? 4.5 : 7) * (0.95 + Math.random() * 0.1);
        const hA = Math.atan2(dz, dx);
        const m = this.ball.body.mass;
        this.ball.body.applyImpulse(new CANNON.Vec3(
            (Math.cos(hA) * Math.cos(a) * v + (Math.random() - 0.5) * 0.12) * m,
            Math.sin(a) * v * m,
            (Math.sin(hA) * Math.cos(a) * v + (Math.random() - 0.5) * 0.12) * m
        ));
        this.ball.body.angularVelocity.set(8 * Math.sin(hA), 0, -8 * Math.cos(hA));
        this.sound.playWhoosh();
    }
    
    // ===== DUNK =====
    
    startDunk() {
        this.phase = 'DUNK_JUMP'; this.phaseTime = 0; this.dunkProgress = 0;
        this.shotType = 'DUNK'; this.shootTime = performance.now();
        this.shotDistance = this.getDistToRim();
        this.jumpVelocity = 5.8; this.isAirborne = true; this.jumpPeakReached = false;
    }
    
    fireDunk() {
        this.phase = 'FOLLOW'; this.phaseTime = 0;
        // Slam impulse: ball flies from hand to rim naturally
        const bp = this.ball.body.position;
        const tx = 0, ty = this.environment.rimY - 0.1, tz = this.environment.rimZ;
        const dx = tx - bp.x, dy = ty - bp.y, dz = tz - bp.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.1;
        const slamSpeed = 9;
        const m = this.ball.body.mass;
        this.ball.body.applyImpulse(new CANNON.Vec3(
            dx/dist * slamSpeed * m,
            dy/dist * slamSpeed * m,
            dz/dist * slamSpeed * m
        ));
        this.ball.body.angularVelocity.set(0, 0, -15);
        this.sound.playWhoosh();
        // Auto-score dunk
        this.ball.isScored = true;
        this.score += 2;
        const sc = document.getElementById('score');
        if (sc) sc.innerText = this.score;
        // Dunk sounds — heavy thud + rim vibration
        this.sound.playDunk();
        setTimeout(() => {
            this.sound.playSwish();
            this.sound.playScore();
        }, 150);
        this.showScorePopup(2);
    }
    
    // ===== UPDATE =====
    
    update(dt) {
        this.phaseTime += dt;
        this.dribbleTime += dt;
        const S = 10;
        
        // Jump physics
        if (this.isAirborne) {
            const prev = this.jumpVelocity;
            this.jumpVelocity -= 9.82 * dt;
            this.jumpOffset += this.jumpVelocity * dt;
            if (prev > 0 && this.jumpVelocity <= 0 && !this.jumpPeakReached) {
                this.jumpPeakReached = true;
                this.jumpPeakTime = performance.now();
            }
            if (this.jumpOffset <= 0) {
                this.jumpOffset = 0; this.jumpVelocity = 0;
                this.isAirborne = false; this.jumpPeakReached = false;
            }
            this.camera.position.y = this.baseHeight + this.jumpOffset;
        }
        
        switch (this.phase) {
            case 'DRIBBLE':       this.poseDribble(dt, S); this.ballDribble(dt); this.updateShotIndicator(); break;
            case 'GATHER_STEPS':  this.updateGatherSteps(dt, S); this.checkTravelling(); break;
            case 'LOAD':          this.poseLoad(dt, S); this.ballAtBelly(); this.checkLoadDone(); this.checkTravelling(); break;
            case 'DELIVERY':      this.poseDelivery(dt, S); this.ballDelivery(); this.checkTravelling(); break;
            case 'RELEASE':       this.poseRelease(dt, S); this.ballAtSetPoint(); break;
            case 'LAYUP_DRIVE':   this.poseLayupDrive(dt, S); this.ballLayupCarry(); break;
            case 'LAYUP_RELEASE': this.poseLayupRelease(dt, S); this.ballAtSetPoint(); break;
            case 'DUNK_JUMP':     this.poseDunkJump(dt, S); this.ballDunkCarry(dt); break;
            case 'FOLLOW':        this.poseFollow(dt, S); this.detectScore(); this.checkReset(); break;
        }
        
        // Auto-release logic for single-click auto-shoot
        if (this.autoShootActive && this.phase === 'DELIVERY' && this.phaseTime > 0.12) {
            this.releaseShot();
        }
    }
    
    // ===== GATHER STEPS UPDATE =====
    
    updateGatherSteps(dt, S) {
        this.gatherStepTime += dt;
        
        // Decelerate
        this.gatherSpeed = Math.max(this.gatherSpeed - dt * 4, 1.5);
        
        // Move camera forward (momentum from sprint)
        const moveVec = this.gatherDirection.clone().multiplyScalar(this.gatherSpeed * dt);
        this.camera.position.add(moveVec);
        this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -10, 10);
        this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -2, 14);
        
        // Count steps by time (each step ~0.25s, total 2 steps = 0.5s)
        const stepPhase = Math.min(this.gatherStepTime / 0.5, 1.0);
        this.gatherStepCount = Math.floor(stepPhase * 2);
        
        // Animate gather: alternating powerful steps, ball gathered to chest
        const stepCycle = Math.sin(this.gatherStepTime * Math.PI * 4); // Fast alternating
        
        // Legs: big alternating strides
        this.lx(this.rightHip.rotation, 'x', 0.3 + stepCycle * 0.4, dt, S * 2);
        this.lx(this.rightKnee.rotation, 'x', -0.4 - Math.max(0, stepCycle) * 0.3, dt, S * 2);
        this.lx(this.leftHip.rotation, 'x', 0.3 - stepCycle * 0.4, dt, S * 2);
        this.lx(this.leftKnee.rotation, 'x', -0.4 + Math.min(0, stepCycle) * 0.3, dt, S * 2);
        
        // Arms: ball gathered to chest, protected
        this.lx(this.rightShoulder.rotation, 'x', 0.4, dt, S);
        this.lx(this.rightElbow.rotation, 'x', -1.2, dt, S);
        this.lx(this.leftShoulder.rotation, 'x', 0.5, dt, S);
        this.lx(this.leftElbow.rotation, 'x', -1.3, dt, S);
        this.lx(this.leftShoulder.rotation, 'z', 0.2, dt, S);
        
        // Camera slight lean forward
        // Ball at chest
        this._lb(this._wp(0, -0.15, -0.40));
        
        // After 2 steps, transition to layup or dunk based on distance
        if (this.gatherStepTime >= 0.5) {
            this.shotType = this.determineShotType();
            if (this.shotType === 'DUNK') {
                this.startDunk();
            } else {
                // Default to layup after gather
                this.startLayup();
            }
        }
    }
    
    checkLoadDone() {
        const threshold = this.autoShootActive ? 0.12 : 0.40;
        if (this.phaseTime > threshold) { this.phase = 'DELIVERY'; this.phaseTime = 0; }
    }
    
    // ========== POSES ==========
    
    lx(o, p, t, dt, s) { o[p] = THREE.MathUtils.lerp(o[p], t, dt * s); }
    
    poseDribble(dt, S) {
        const b = Math.sin(this.dribbleTime * this.dribbleBounceSpeed * Math.PI * 2);
        // Right arm dribble push
        this.lx(this.rightShoulder.rotation, 'x', 0.6 + b * 0.15, dt, S * 1.5);
        this.lx(this.rightElbow.rotation, 'x', -0.8 + b * 0.15, dt, S * 1.5);
        this.lx(this.rightWrist.rotation, 'x', 0.3 + b * 0.2, dt, S * 2);
        // Left arm relaxed
        this.lx(this.leftShoulder.rotation, 'x', 0.3, dt, S);
        this.lx(this.leftElbow.rotation, 'x', -0.5, dt, S);
        this.lx(this.leftWrist.rotation, 'x', 0, dt, S);
        this.lx(this.leftShoulder.rotation, 'z', 0, dt, S);
        // Legs
        if (this.isSprinting && this.isMoving) {
            // Running animation while sprinting
            const run = Math.sin(this.dribbleTime * 10) * 0.35;
            this.lx(this.rightHip.rotation, 'x', 0.1 + run, dt, S * 1.5);
            this.lx(this.rightKnee.rotation, 'x', -0.3 - Math.max(0, run) * 0.4, dt, S * 1.5);
            this.lx(this.leftHip.rotation, 'x', 0.1 - run, dt, S * 1.5);
            this.lx(this.leftKnee.rotation, 'x', -0.3 + Math.min(0, run) * 0.4, dt, S * 1.5);
        } else {
            const lb = Math.abs(b) * 0.05;
            this.lx(this.rightHip.rotation, 'x', 0.15 + lb, dt, S);
            this.lx(this.rightKnee.rotation, 'x', -0.15 - lb, dt, S);
            this.lx(this.leftHip.rotation, 'x', 0.15 + lb, dt, S);
            this.lx(this.leftKnee.rotation, 'x', -0.15 - lb, dt, S);
        }
    }
    
    poseLoad(dt, S) {
        const t = Math.min(this.phaseTime / 0.2, 1);
        this.lx(this.rightHip.rotation, 'x', 0.15 + t * 0.35, dt, S * 2);
        this.lx(this.rightKnee.rotation, 'x', -0.15 - t * 0.40, dt, S * 2);
        this.lx(this.leftHip.rotation, 'x', 0.15 + t * 0.35, dt, S * 2);
        this.lx(this.leftKnee.rotation, 'x', -0.15 - t * 0.40, dt, S * 2);
        if (!this.isAirborne) this.camera.position.y = this.baseHeight - t * 0.10;
        this.lx(this.rightShoulder.rotation, 'x', 0.6, dt, S);
        this.lx(this.rightElbow.rotation, 'x', -1.1, dt, S);
        this.lx(this.leftShoulder.rotation, 'x', 0.6, dt, S);
        this.lx(this.leftElbow.rotation, 'x', -1.1, dt, S);
    }
    
    poseDelivery(dt, S) {
        this.deliveryProgress += dt * (this.autoShootActive ? 7.0 : 2.2);
        const t = Math.min(this.deliveryProgress, 1);
        const pBar = document.getElementById('power-bar');
        if (pBar && !this.autoShoot) pBar.style.height = `${t * 100}%`;
        else if (pBar) pBar.style.height = '100%'; // Full bar in auto mode
        
        this.lx(this.rightHip.rotation, 'x', 0.50 - t * 0.40, dt, S);
        this.lx(this.rightKnee.rotation, 'x', -0.55 + t * 0.45, dt, S);
        this.lx(this.leftHip.rotation, 'x', 0.50 - t * 0.40, dt, S);
        this.lx(this.leftKnee.rotation, 'x', -0.55 + t * 0.45, dt, S);
        if (!this.isAirborne) this.camera.position.y = this.baseHeight - 0.10 + t * 0.10;
        this.lx(this.rightShoulder.rotation, 'x', 0.6 - t * 1.4, dt, S);
        this.lx(this.rightElbow.rotation, 'x', -1.1 + t * 0.7, dt, S);
        this.lx(this.rightWrist.rotation, 'x', 0.2, dt, S);
        this.lx(this.leftShoulder.rotation, 'x', 0.6 - t * 1.2, dt, S);
        this.lx(this.leftShoulder.rotation, 'z', t * 0.25, dt, S);
        this.lx(this.leftElbow.rotation, 'x', -1.1 + t * 0.5, dt, S);
    }
    
    poseRelease(dt, S) {
        this.lx(this.rightHip.rotation, 'x', -0.08, dt, S * 2);
        this.lx(this.rightKnee.rotation, 'x', 0, dt, S * 2);
        this.lx(this.leftHip.rotation, 'x', -0.08, dt, S * 2);
        this.lx(this.leftKnee.rotation, 'x', 0, dt, S * 2);
        this.lx(this.rightShoulder.rotation, 'x', -0.9, dt, S * 2);
        this.lx(this.rightElbow.rotation, 'x', -0.25, dt, S * 2);
    }
    
    poseLayupDrive(dt, S) {
        this.deliveryProgress += dt * 2.5;
        const t = Math.min(this.deliveryProgress, 1);
        this.lx(this.rightShoulder.rotation, 'x', 0.4 - t * 1.6, dt, S * 1.5);
        this.lx(this.rightElbow.rotation, 'x', -0.9 + t * 0.5, dt, S * 1.5);
        this.lx(this.rightWrist.rotation, 'x', 0, dt, S);
        this.lx(this.leftShoulder.rotation, 'x', 0.2, dt, S);
        this.lx(this.leftElbow.rotation, 'x', -0.8, dt, S);
        this.lx(this.leftShoulder.rotation, 'z', 0.3, dt, S);
        const run = Math.sin(this.phaseTime * 8) * 0.3;
        this.lx(this.rightHip.rotation, 'x', 0.1 + run, dt, S);
        this.lx(this.rightKnee.rotation, 'x', -0.3, dt, S);
        this.lx(this.leftHip.rotation, 'x', 0.1 - run, dt, S);
        this.lx(this.leftKnee.rotation, 'x', -0.3, dt, S);
    }
    
    poseLayupRelease(dt, S) {
        this.lx(this.rightShoulder.rotation, 'x', -1.5, dt, S * 2);
        this.lx(this.rightElbow.rotation, 'x', -0.1, dt, S * 2);
        this.lx(this.rightWrist.rotation, 'x', 0.8, dt, S * 2);
        this.lx(this.rightHip.rotation, 'x', -0.3, dt, S);
        this.lx(this.rightKnee.rotation, 'x', -0.8, dt, S);
        this.lx(this.leftHip.rotation, 'x', 0.1, dt, S);
        this.lx(this.leftKnee.rotation, 'x', 0, dt, S);
    }
    
    poseDunkJump(dt, S) {
        this.dunkProgress += dt * 2.0;
        this.lx(this.rightShoulder.rotation, 'x', -1.8, dt, S * 2);
        this.lx(this.rightElbow.rotation, 'x', -0.2, dt, S * 2);
        this.lx(this.rightWrist.rotation, 'x', -0.5, dt, S);
        this.lx(this.leftShoulder.rotation, 'x', -1.6, dt, S * 1.5);
        this.lx(this.leftElbow.rotation, 'x', -0.3, dt, S);
        this.lx(this.leftShoulder.rotation, 'z', 0, dt, S);
        this.lx(this.rightHip.rotation, 'x', 0.3, dt, S);
        this.lx(this.rightKnee.rotation, 'x', -0.6, dt, S);
        this.lx(this.leftHip.rotation, 'x', 0.2, dt, S);
        this.lx(this.leftKnee.rotation, 'x', -0.5, dt, S);
        if (this.jumpPeakReached && this.dunkProgress > 0.5) this.fireDunk();
    }
    
    poseFollow(dt, S) {
        if (this.shotType === 'DUNK') {
            this.lx(this.rightShoulder.rotation, 'x', -1.0, dt, S);
            this.lx(this.rightElbow.rotation, 'x', -0.1, dt, S);
            this.lx(this.rightWrist.rotation, 'x', 0.5, dt, S);
            this.lx(this.leftShoulder.rotation, 'x', -0.8, dt, S);
            this.lx(this.leftElbow.rotation, 'x', -0.3, dt, S);
            this.lx(this.leftShoulder.rotation, 'z', 0, dt, S);
        } else if (this.shotType === 'LAYUP') {
            this.lx(this.rightShoulder.rotation, 'x', -1.4, dt, S);
            this.lx(this.rightElbow.rotation, 'x', -0.05, dt, S);
            this.lx(this.rightWrist.rotation, 'x', 0.9, dt, S * 1.5);
            this.lx(this.leftShoulder.rotation, 'x', 0.2, dt, S);
            this.lx(this.leftShoulder.rotation, 'z', -0.3, dt, S);
            this.lx(this.leftElbow.rotation, 'x', -0.6, dt, S);
        } else {
            this.lx(this.rightShoulder.rotation, 'x', -1.3, dt, S);
            this.lx(this.rightElbow.rotation, 'x', -0.05, dt, S * 1.5);
            this.lx(this.rightWrist.rotation, 'x', 1.4, dt, S * 2);
            this.lx(this.leftShoulder.rotation, 'x', 0.15, dt, S);
            this.lx(this.leftShoulder.rotation, 'z', -0.5, dt, S);
            this.lx(this.leftElbow.rotation, 'x', -0.7, dt, S);
        }
        if (this.isAirborne) {
            this.lx(this.rightHip.rotation, 'x', 0.12, dt, S);
            this.lx(this.rightKnee.rotation, 'x', -0.15, dt, S);
            this.lx(this.leftHip.rotation, 'x', 0.1, dt, S);
            this.lx(this.leftKnee.rotation, 'x', -0.12, dt, S);
        } else {
            this.lx(this.rightHip.rotation, 'x', 0.2, dt, S);
            this.lx(this.rightKnee.rotation, 'x', -0.2, dt, S);
            this.lx(this.leftHip.rotation, 'x', 0.2, dt, S);
            this.lx(this.leftKnee.rotation, 'x', -0.2, dt, S);
        }
    }
    
    // ========== BALL POSITIONING ==========
    
    _wp(lx, ly, lz) { return new THREE.Vector3(lx, ly, lz).applyMatrix4(this.camera.matrixWorld); }
    _lb(p) { this.ball.body.position.set(p.x, p.y, p.z); this.ball.body.velocity.set(0,0,0); this.ball.body.angularVelocity.set(0,0,0); }
    
    ballDribble(dt) {
        const bounce = Math.abs(Math.sin(this.dribbleTime * this.dribbleBounceSpeed * Math.PI));
        // Dribble sound at bounce nadir
        const isBouncing = bounce < 0.15;
        if (isBouncing && !this.lastDribbleBounce) {
            this.sound.playDribble(0.7 + Math.random() * 0.3);
        }
        this.lastDribbleBounce = isBouncing;
        const cp = this.camera.position;
        const cd = new THREE.Vector3(); this.camera.getWorldDirection(cd); cd.y = 0; cd.normalize();
        const r = new THREE.Vector3().crossVectors(cd, new THREE.Vector3(0, 1, 0)).normalize();
        this.ball.body.position.set(
            cp.x + r.x * 0.35 + cd.x * 0.3,
            this.ball.radius + bounce * 0.55,
            cp.z + r.z * 0.35 + cd.z * 0.3
        );
        this.ball.body.velocity.set(0, 0, 0);
        this.ball.body.angularVelocity.set(-cd.z * 8, 0, cd.x * 8);
    }
    
    ballAtBelly() { this._lb(this._wp(0, -0.22, -0.50)); }
    ballDelivery() {
        const t = Math.min(this.deliveryProgress, 1);
        this._lb(this._wp(
            THREE.MathUtils.lerp(0, 0.06, t),
            THREE.MathUtils.lerp(-0.22, 0.16, t),
            THREE.MathUtils.lerp(-0.50, -0.38, t)
        ));
    }
    ballAtSetPoint() { this._lb(this._wp(0.06, 0.20, -0.38)); }
    ballLayupCarry() {
        const t = Math.min(this.deliveryProgress, 1);
        this._lb(this._wp(
            THREE.MathUtils.lerp(0.15, 0.10, t),
            THREE.MathUtils.lerp(-0.15, 0.30, t),
            THREE.MathUtils.lerp(-0.40, -0.35, t)
        ));
    }
    ballDunkCarry(dt) {
        const t = Math.min(this.dunkProgress, 1);
        const hand = this._wp(0, 0.35, -0.35);
        const rim = new THREE.Vector3(0, this.environment.rimY + 0.3, this.environment.rimZ);
        this._lb(hand.lerp(rim, t * 0.6));
    }
    
    // ========== SCORE & RESET ==========
    
    detectScore() {
        const bp = this.ball.body.position;
        const rz = this.environment.rimZ; const ry = this.environment.rimY;
        
        const dx = bp.x;
        const dz = bp.z - rz;
        const distSq = dx * dx + dz * dz;
        
        // Score only if ball is falling down (velocity < 0), vertically passes rim (0 to -0.3m below rim),
        // and horizontally inside the rim cylinder (radius ~0.2)
        if (!this.ball.isScored && this.ball.body.velocity.y < 0 &&
            bp.y < ry && bp.y > ry - 0.3 &&
            distSq < 0.04) {
            this.ball.isScored = true;
            // Use shot location for exactly accurate 3pt check based on release position
            // But since we only stored shotDistance, let's recalculate from stored position
            // Wait, we stored shotDistance early on. We should really store isThree instead!
            // But for now, we'll approximate that if shotDistance > 7.1 it's a 3. Wait, corner is 6.71!
            // That's a bug. Let's fix this in the releases.
            const pts = (this.shotPosition && this.isThreePointer(this.shotPosition)) ? 3 : 2;
            this.score += pts;
            const sc = document.getElementById('score');
            if (sc) sc.innerText = this.score;
            // Sound & visual feedback
            this.sound.playSwish();
            setTimeout(() => this.sound.playScore(), 200);
            this.showScorePopup(pts);
            // Notify GameMode
            if (this.gameMode) this.gameMode.onScore(pts);
        }
    }
    
    checkReset() {
        const bp = this.ball.body.position;
        const e = performance.now() - this.shootTime;
        // Quick reset if ball is OOB, otherwise 3 seconds
        const oob = bp.y < -1 || Math.abs(bp.x) > 20 || Math.abs(bp.z) > 20;
        if (oob && e > 1500) { this.resetBall(); return; }
        if (e > 3000) this.resetBall();
    }
    
    resetBall() {
        // Notify miss if ball wasn't scored
        if (!this.ball.isScored && this.gameMode && this.phase === 'FOLLOW') {
            this.gameMode.onMiss();
        }
        this.phase = 'DRIBBLE'; this.shotType = 'SHOT';
        this.ball.isScored = false; this.deliveryProgress = 0; this.dunkProgress = 0; this.shotDistance = 0;
        this.jumpOffset = 0; this.jumpVelocity = 0;
        this.isAirborne = false; this.jumpPeakReached = false;
        this.gatherStepCount = 0; this.gatherStepTime = 0; this.gatherSpeed = 0;
        this.camera.position.y = this.baseHeight;
        this.leftShoulder.rotation.z = 0; this.rightWrist.rotation.x = 0;
        // Restore dribble rights
        this.hasDribbled = true;
        this.ballPickedUp = false;
        this.distSincePickup = 0;
        this.autoShootActive = false;
        this.shotPosition = null;
        const pBar = document.getElementById('power-bar');
        if (pBar) pBar.style.height = '0%';
    }
    
    // ===== VIOLATION CHECKS =====
    
    checkTravelling() {
        // Track distance moved since picking up the ball
        const cp = this.camera.position;
        const dx = cp.x - this.lastPos.x;
        const dz = cp.z - this.lastPos.z;
        this.distSincePickup += Math.sqrt(dx * dx + dz * dz);
        this.lastPos.copy(cp);
        
        // Allow gather steps (2 steps ≈ 3m), but beyond that = travelling
        if (this.distSincePickup > 3.0 && !this.isAirborne) {
            this.callViolation('TRAVELLING');
        }
    }
    
    callViolation(type) {
        // Show violation popup
        const el = document.getElementById('score-popup');
        if (el) {
            el.textContent = `⚠️ ${type}`;
            el.classList.remove('show');
            void el.offsetWidth;
            el.classList.add('show');
            setTimeout(() => el.classList.remove('show'), 1500);
        }
        // Turnover: reset to dribble
        setTimeout(() => this.resetBall(), 800);
    }
    
    showScorePopup(pts) {
        const el = document.getElementById('score-popup');
        if (!el) return;
        el.textContent = `+${pts}`;
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 1200);
    }
    
    updateShotIndicator() {
        const el = document.getElementById('shot-type');
        const distEl = document.getElementById('shot-distance');
        const autoEl = document.getElementById('auto-indicator');
        if (!el) return;
        
        if (autoEl) {
            autoEl.textContent = `[B] AUTO: ${this.autoShoot ? 'ON' : 'OFF'}`;
            if (this.autoShoot) autoEl.classList.add('active');
            else autoEl.classList.remove('active');
        }
        
        const d = this.getDistToRim();
        if (distEl) distEl.textContent = `${d.toFixed(1)}m`;
        if (d < 1.2) { el.textContent = '🔥 DUNK!'; el.style.color = '#f44336'; }
        else if (d < 3.5) { el.textContent = '🏃 LAYUP'; el.style.color = '#ff9800'; }
        else if (this.isThreePointer(this.camera.position)) { el.textContent = '🎯 3PT SHOT'; el.style.color = '#4caf50'; }
        else { el.textContent = '🏀 MID-RANGE'; el.style.color = '#ffffff'; }
    }
}
