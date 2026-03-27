import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Ball {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.radius = 0.12; // Regulation basketball radius
        
        this.initVisual();
        this.initPhysics();
        
        this.isScored = false;
    }
    
    initVisual() {
        const geo = new THREE.SphereGeometry(this.radius, 32, 32);
        
        // Create a canvas texture with basketball seam lines for visible spin
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Base orange color
        ctx.fillStyle = '#c85a17';
        ctx.fillRect(0, 0, 512, 256);
        
        // Pebble grain texture (random dots)
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        for (let i = 0; i < 3000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 256;
            ctx.fillRect(x, y, 2, 2);
        }
        
        // Black seam lines
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 3;
        
        // Horizontal center seam
        ctx.beginPath();
        ctx.moveTo(0, 128);
        ctx.lineTo(512, 128);
        ctx.stroke();
        
        // Vertical center seam
        ctx.beginPath();
        ctx.moveTo(256, 0);
        ctx.lineTo(256, 256);
        ctx.stroke();
        
        // Curved seams (the characteristic basketball curves)
        ctx.lineWidth = 2.5;
        // Left curve
        ctx.beginPath();
        ctx.arc(128, 128, 80, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.stroke();
        // Right curve
        ctx.beginPath();
        ctx.arc(384, 128, 80, Math.PI * 0.6, Math.PI * 1.4);
        ctx.stroke();
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        const mat = new THREE.MeshStandardMaterial({ 
            map: texture,
            roughness: 0.75,
            metalness: 0.05,
            bumpMap: texture,
            bumpScale: 0.02
        });
        
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
    }
    
    initPhysics() {
        const shape = new CANNON.Sphere(this.radius);
        this.material = new CANNON.Material('ball');
        
        this.body = new CANNON.Body({
            mass: 0.624, // Exact NBA mass
            shape: shape,
            material: this.material,
            position: new CANNON.Vec3(0, 1.5, 7.1)
        });
        
        this.body.linearDamping = 0.1;
        this.body.angularDamping = 0.05; // Low damping so spin is visible longer
        this.world.addBody(this.body);
    }
    
    setupContactMaterials(envMaterials) {
        const cmFloor = new CANNON.ContactMaterial(this.material, envMaterials.floor, {
            friction: 0.5,
            restitution: 0.85
        });
        
        const cmBoard = new CANNON.ContactMaterial(this.material, envMaterials.backboard, {
            friction: 0.6,
            restitution: 0.15
        });
        
        const cmRim = new CANNON.ContactMaterial(this.material, envMaterials.rim, {
            friction: 0.2,
            restitution: 0.3
        });
        
        this.world.addContactMaterial(cmFloor);
        this.world.addContactMaterial(cmBoard);
        this.world.addContactMaterial(cmRim);
    }
    
    update() {
        // Sync Three.js mesh to Cannon body (position AND rotation for visible spin)
        this.mesh.position.copy(this.body.position);
        this.mesh.quaternion.copy(this.body.quaternion);
    }
    
    reset(x, y, z) {
        this.body.position.set(x, y, z);
        this.body.velocity.set(0, 0, 0);
        this.body.angularVelocity.set(0, 0, 0);
        this.body.quaternion.set(0, 0, 0, 1);
        this.isScored = false;
    }
}
