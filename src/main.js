import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Environment } from './Environment.js';
import { Ball } from './Ball.js';
import { ShootingController } from './ShootingController.js';
import { SoundManager } from './SoundManager.js';
import { GameMode } from './GameMode.js';

const canvas = document.createElement('canvas');
canvas.style.position = 'absolute';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.zIndex = '-1';
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.FogExp2(0x87CEEB, 0.012);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 150);
camera.position.set(0, 1.70, 7.1);
camera.lookAt(0, 3.05, 0.15);
scene.add(camera);

const controls = new PointerLockControls(camera, document.body);

const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('overlay');
const uiLayer = document.getElementById('ui-layer');

startBtn.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => {
    overlay.style.display = 'none';
    uiLayer.style.display = 'flex';
});
controls.addEventListener('unlock', () => {
    const isMenuOpen = document.getElementById('mode-panel')?.classList.contains('visible') || 
                       document.getElementById('results-overlay')?.style.display === 'flex';
    if (!isMenuOpen) {
        overlay.style.display = 'flex';
        uiLayer.style.display = 'none';
    }
});

// Physics
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 20;

const sound = new SoundManager();
const environment = new Environment(scene, world, sound);
const ball = new Ball(scene, world);
ball.setupContactMaterials(environment.materials);

// Movement state (shared with controller)
const moveState = { forward: false, backward: false, left: false, right: false, sprint: false };
const walkSpeed = 2.6;
const sprintSpeed = 5.5;

const controller = new ShootingController(ball, camera, environment, controls, moveState, sound);
const gameMode = new GameMode(controller);
controller.gameMode = gameMode;

window.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'KeyW': moveState.forward = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyD': moveState.right = true; break;
        case 'ShiftLeft': case 'ShiftRight': moveState.sprint = true; break;
    }
});
window.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW': moveState.forward = false; break;
        case 'KeyS': moveState.backward = false; break;
        case 'KeyA': moveState.left = false; break;
        case 'KeyD': moveState.right = false; break;
        case 'ShiftLeft': case 'ShiftRight': moveState.sprint = false; break;
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let headBobTime = 0;

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    
    // Movement
    if (controls.isLocked) {
        const airFactor = controller.isAirborne ? 0.3 : 1.0;
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0; dir.normalize();
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        
        const velocity = new THREE.Vector3();
        if (moveState.forward) velocity.add(dir);
        if (moveState.backward) velocity.sub(dir);
        if (moveState.right) velocity.add(right);
        if (moveState.left) velocity.sub(right);
        
        const isMoving = velocity.length() > 0;
        const speed = (moveState.sprint ? sprintSpeed : walkSpeed) * airFactor;
        
        if (isMoving) {
            velocity.normalize().multiplyScalar(speed * dt);
            camera.position.add(velocity);
            camera.position.x = THREE.MathUtils.clamp(camera.position.x, -10, 10);
            camera.position.z = THREE.MathUtils.clamp(camera.position.z, -2, 14);
            
            // Head bob (more intense when sprinting)
            headBobTime += dt * (moveState.sprint ? 14 : 8);
            const bobAmount = moveState.sprint ? 0.04 : 0.02;
            if (!controller.isAirborne) {
                camera.position.y = controller.baseHeight + Math.sin(headBobTime) * bobAmount;
            }
        }
        
        // Tell controller whether we're sprinting
        controller.isSprinting = moveState.sprint && isMoving;
        controller.isMoving = isMoving;
        
        // Dynamic crosshair
        const ch = document.getElementById('crosshair');
        if (ch) {
            if (isMoving) ch.classList.add('moving');
            else ch.classList.remove('moving');
        }
    }
    
    world.step(1/60, dt, 3);
    environment.update(dt);
    ball.update();
    controller.update(dt);
    renderer.render(scene, camera);
}
animate();
