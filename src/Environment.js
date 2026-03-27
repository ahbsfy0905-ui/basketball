import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Real Basketball Court Dimensions (FIBA/NBA):
 *   Rim height:        3.05m (10 ft)
 *   Backboard:         1.83m × 1.07m
 *   Rim diameter:      0.45m (18 in) → radius 0.225m
 *   Rim offset:        ~0.15m from backboard face
 *   3-point line:      6.75m (FIBA) / 7.24m (NBA) from rim center (floor projection)
 *   
 * Layout (Z-axis):
 *   Backboard face     Z = 0
 *   Rim center         Z = 0.15
 *   Player (3pt line)  Z ≈ 7.4
 */
export class Environment {
    constructor(scene, world, sound) {
        this.scene = scene;
        this.world = world;
        this.sound = sound;
        
        this.materials = {
            floor: new CANNON.Material('floor'),
            backboard: new CANNON.Material('backboard'),
            rim: new CANNON.Material('rim')
        };
        
        this.wobbleAngle = 0;
        this.wobbleVelocity = 0;
        
        // Real positions
        this.rimY = 3.05;
        this.rimZ = 0.381; // NBA: rim inner edge is 6 inches (0.1524m) from board + radius 9 inches (0.2286m) = 15 inches (0.381m)
        
        this.setupLighting();
        this.setupSkybox();
        this.setupCourt();
        this.setupHoop();
        this.setupCollisionListener();
    }
    
    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        
        const sunLight = new THREE.DirectionalLight(0xfff5e0, 2.5);
        sunLight.position.set(8, 18, 12);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 50;
        sunLight.shadow.camera.left = -15;
        sunLight.shadow.camera.right = 15;
        sunLight.shadow.camera.top = 15;
        sunLight.shadow.camera.bottom = -15;
        this.scene.add(sunLight);
        
        const fillLight = new THREE.DirectionalLight(0x8ecaff, 0.6);
        fillLight.position.set(-6, 8, -4);
        this.scene.add(fillLight);
    }

    setupSkybox() {
        const skyGeo = new THREE.SphereGeometry(80, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x3a8fd6) },
                bottomColor: { value: new THREE.Color(0xc8e6ff) },
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        this.scene.add(new THREE.Mesh(skyGeo, skyMat));
    }

    setupCourt() {
        // Floor (asphalt) - slightly larger than court
        const floorGeo = new THREE.PlaneGeometry(35, 35);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.95, metalness: 0.05 });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.receiveShadow = true;
        this.scene.add(floorMesh);
        
        // NBA Court Specs (converted to meters)
        const courtW = 15.24;
        const courtL = 28.65;
        const halfW = courtW / 2;
        
        // Z-axis positions
        const bbFaceZ = 0;              // Backboard face
        const baselineZ = bbFaceZ - 1.22; // Backboard is 4ft (1.22m) inside baseline
        const centerLineZ = baselineZ + courtL / 2;
        const rimFloorZ = this.rimZ;    // Rim center (Z=0.15)
        const ftZ = bbFaceZ + 4.57;     // Free throw line is 15ft (4.57m) from backboard face
        
        // Key/Paint area (filled)
        const paintW = 4.88;
        const paintL = ftZ - baselineZ; // ~ 5.79m
        const paintGeo = new THREE.PlaneGeometry(paintW, paintL);
        const paintMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.85 });
        const paintMesh = new THREE.Mesh(paintGeo, paintMat);
        paintMesh.rotation.x = -Math.PI / 2;
        paintMesh.position.set(0, 0.005, baselineZ + paintL / 2);
        this.scene.add(paintMesh);
        
        // ===== COURT LINES =====
        const lineColor = 0xffffff;
        const drawLine = (points, color = lineColor) => {
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({ color });
            const line = new THREE.Line(geo, mat);
            this.scene.add(line);
        };
        
        // 1. Court Boundaries
        drawLine([
            new THREE.Vector3(-halfW, 0.015, baselineZ),
            new THREE.Vector3(halfW, 0.015, baselineZ),
            new THREE.Vector3(halfW, 0.015, baselineZ + courtL),
            new THREE.Vector3(-halfW, 0.015, baselineZ + courtL),
            new THREE.Vector3(-halfW, 0.015, baselineZ) // Close loop
        ]);
        
        // Center Line (Half-court)
        drawLine([
            new THREE.Vector3(-halfW, 0.015, centerLineZ),
            new THREE.Vector3(halfW, 0.015, centerLineZ)
        ]);
        
        // 2. NBA 3-Point Line
        const threeR = 7.24;
        const cornerX = 6.71; // NBA corner distance from rim center
        const t0 = Math.acos(cornerX / threeR); // Start angle on the right (+X, +Z)
        const arcPts = [];
        const numSeg = 80;
        for (let i = 0; i <= numSeg; i++) {
            const angle = t0 + (i / numSeg) * (Math.PI - 2 * t0);
            const x = Math.cos(angle) * threeR;
            const z = rimFloorZ + Math.sin(angle) * threeR;
            arcPts.push(new THREE.Vector3(x, 0.015, z));
        }
        drawLine(arcPts);
        
        // Corner straight lines (down to baseline)
        const arcLeftEnd = arcPts[0];
        drawLine([ new THREE.Vector3(arcLeftEnd.x, 0.015, baselineZ), arcLeftEnd ]);
        const arcRightEnd = arcPts[arcPts.length - 1];
        drawLine([ new THREE.Vector3(arcRightEnd.x, 0.015, baselineZ), arcRightEnd ]);
        
        // 3. Paint boundary lines
        const halfPaintW = paintW / 2;
        drawLine([
            new THREE.Vector3(-halfPaintW, 0.012, baselineZ),
            new THREE.Vector3(-halfPaintW, 0.012, ftZ),
            new THREE.Vector3(halfPaintW, 0.012, ftZ),
            new THREE.Vector3(halfPaintW, 0.012, baselineZ),
        ]);
        
        // 4. Free-Throw Circle (Top half solid, bottom dashed in real life—we'll do top half for now)
        const ftR = 1.83;
        const ftPts = [];
        for (let i = 0; i <= 40; i++) {
            const a = (i / 40) * Math.PI;
            ftPts.push(new THREE.Vector3( Math.cos(a) * ftR, 0.013, ftZ + Math.sin(a) * ftR ));
        }
        drawLine(ftPts);
        
        // 5. Center Circle
        const centerPts = [];
        for (let i = 0; i <= 60; i++) {
            const a = (i / 60) * Math.PI * 2;
            centerPts.push(new THREE.Vector3( Math.cos(a) * 1.83, 0.015, centerLineZ + Math.sin(a) * 1.83 ));
        }
        drawLine(centerPts);
        
        // 6. Restricted Area (No-charge semi-circle)
        const raR = 1.22;
        const raPts = [];
        for (let i = 0; i <= 30; i++) {
            const a = (i / 30) * Math.PI;
            raPts.push(new THREE.Vector3( Math.cos(a) * raR, 0.015, rimFloorZ + Math.sin(a) * raR ));
        }
        drawLine(raPts);
        
        // Physics Floor
        const floorShape = new CANNON.Plane();
        const floorBody = new CANNON.Body({ mass: 0, shape: floorShape, material: this.materials.floor });
        floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.addBody(floorBody);
        
        // ===== ENVIRONMENT OBJECTS =====
        this.setupEnvironmentObjects();
    }
    
    setupEnvironmentObjects() {
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.7, roughness: 0.4 });
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.85 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
        
        // ===== CHAIN-LINK FENCE (3 sides) =====
        const fenceH = 3.0;
        const fenceMat = new THREE.MeshStandardMaterial({ 
            color: 0x888888, wireframe: true, transparent: true, opacity: 0.3 
        });
        const postGeo = new THREE.CylinderGeometry(0.03, 0.03, fenceH);
        
        // Fence along back (Z = -2)
        for (let x = -10; x <= 10; x += 2.5) {
            const post = new THREE.Mesh(postGeo, metalMat);
            post.position.set(x, fenceH / 2, -2);
            post.castShadow = true;
            this.scene.add(post);
        }
        const backFence = new THREE.Mesh(new THREE.PlaneGeometry(20, fenceH), fenceMat);
        backFence.position.set(0, fenceH / 2, -2);
        this.scene.add(backFence);
        
        // Fence along sides (X = ±10)
        [-10, 10].forEach(x => {
            for (let z = -2; z <= 14; z += 2.5) {
                const post = new THREE.Mesh(postGeo, metalMat);
                post.position.set(x, fenceH / 2, z);
                post.castShadow = true;
                this.scene.add(post);
            }
            const sideFence = new THREE.Mesh(new THREE.PlaneGeometry(16, fenceH), fenceMat);
            sideFence.position.set(x, fenceH / 2, 6);
            sideFence.rotation.y = Math.PI / 2;
            this.scene.add(sideFence);
        });
        
        // ===== BENCHES (2, along side) =====
        [-7, 7].forEach(x => {
            const benchGroup = new THREE.Group();
            benchGroup.position.set(x, 0, 8);
            benchGroup.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
            
            // Seat
            const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.3), woodMat);
            seat.position.y = 0.45;
            seat.castShadow = true;
            benchGroup.add(seat);
            
            // Legs (4)
            const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.45);
            [[-0.5, 0.1], [-0.5, -0.1], [0.5, 0.1], [0.5, -0.1]].forEach(([lx, lz]) => {
                const leg = new THREE.Mesh(legGeo, metalMat);
                leg.position.set(lx, 0.225, lz);
                benchGroup.add(leg);
            });
            
            // Backrest
            const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.03), woodMat);
            back.position.set(0, 0.65, -0.13);
            benchGroup.add(back);
            
            this.scene.add(benchGroup);
        });
        
        // ===== STREET LIGHTS (2) =====
        [-8, 8].forEach(x => {
            const poleGeo = new THREE.CylinderGeometry(0.04, 0.06, 5.5);
            const pole = new THREE.Mesh(poleGeo, darkMat);
            pole.position.set(x, 2.75, 12);
            pole.castShadow = true;
            this.scene.add(pole);
            
            // Lamp head
            const lampGeo = new THREE.BoxGeometry(0.4, 0.08, 0.25);
            const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffeeaa, emissiveIntensity: 0.3 });
            const lamp = new THREE.Mesh(lampGeo, lampMat);
            lamp.position.set(x, 5.5, 12);
            this.scene.add(lamp);
            
            // Point light
            const light = new THREE.PointLight(0xffeedd, 0.8, 15);
            light.position.set(x, 5.3, 12);
            this.scene.add(light);
        });
        
        // ===== TREES (4) =====
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.9 });
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.9 });
        
        [[-12, 5], [12, 3], [-11, 12], [12, 11]].forEach(([x, z]) => {
            const h = 3 + Math.random() * 2;
            // Trunk
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, h * 0.4), trunkMat);
            trunk.position.set(x, h * 0.2, z);
            trunk.castShadow = true;
            this.scene.add(trunk);
            // Canopy
            const canopy = new THREE.Mesh(new THREE.SphereGeometry(h * 0.35, 8, 6), treeMat);
            canopy.position.set(x, h * 0.55, z);
            canopy.castShadow = true;
            this.scene.add(canopy);
        });
        
        // ===== TRASH CANS (2) =====
        [-6, 6].forEach(x => {
            const can = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8),
                new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7 })
            );
            can.position.set(x, 0.35, -1.5);
            can.castShadow = true;
            this.scene.add(can);
        });
    }
    
    setupHoop() {
        const boardFaceZ = 0;             // Backboard face at Z=0
        const boardW = 1.83;              // 72 inches
        const boardH = 1.07;              // 42 inches
        const boardBottomY = this.rimY - 0.15; // Rim is 6 inches (15cm) above bottom of board -> 2.90m
        const boardCenterY = boardBottomY + boardH / 2; // 3.435m
        const rimRadius = 0.2286;         // 18 inches diameter -> 9 in radius (22.86 cm)
        
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.25 });
        
        // ===== POLE =====
        const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 4.0);
        const poleMesh = new THREE.Mesh(poleGeo, metalMat);
        poleMesh.position.set(0, 2.0, -1.22); // NBA goalpost is usually outside the baseline
        poleMesh.castShadow = true;
        this.scene.add(poleMesh);
        
        // Horizontal support arm
        const armGeo = new THREE.BoxGeometry(0.2, 0.2, 1.22);
        const armMesh = new THREE.Mesh(armGeo, metalMat);
        armMesh.position.set(0, boardCenterY, -0.61);
        armMesh.castShadow = true;
        this.scene.add(armMesh);
        
        // ===== BACKBOARD GROUP (wobbles on impact) =====
        this.hoopGroup = new THREE.Group();
        this.hoopGroup.position.set(0, boardCenterY, boardFaceZ);
        this.scene.add(this.hoopGroup);
        
        // Glass backboard
        const boardGeo = new THREE.BoxGeometry(boardW, boardH, 0.04);
        const boardMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xffffff, transparent: true, opacity: 0.35,
            roughness: 0.05, metalness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.1
        });
        const boardMesh = new THREE.Mesh(boardGeo, boardMat);
        this.hoopGroup.add(boardMesh);
        
        // Frame border & Target Box (White)
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const addBorder = (w, h, x, y) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.052), frameMat);
            m.position.set(x, y, 0);
            this.hoopGroup.add(m);
        };
        // Outer Frame
        addBorder(boardW, 0.03, 0, boardH/2 - 0.015);    // top
        addBorder(boardW, 0.03, 0, -boardH/2 + 0.015);   // bottom
        addBorder(0.03, boardH, -boardW/2 + 0.015, 0);   // left
        addBorder(0.03, boardH, boardW/2 - 0.015, 0);    // right
        
        // NBA Target Box (24" x 18" = 61cm x 45.7cm, 2" = 5cm thickness)
        // Bottom edge of target box is level with the rim (0.15m above board bottom)
        const tbW = 0.61, tbH = 0.457, tbT = 0.05;
        const tbBottomY = -boardH/2 + 0.15; // relative to boardCenterY
        const tbCenterY = tbBottomY + tbH/2;
        addBorder(tbW, tbT, 0, tbBottomY + tbH - tbT/2); // top
        addBorder(tbW, tbT, 0, tbBottomY + tbT/2);       // bottom
        addBorder(tbT, tbH, -tbW/2 + tbT/2, tbCenterY);  // left
        addBorder(tbT, tbH, tbW/2 - tbT/2, tbCenterY);   // right
        
        // ===== RIM =====
        const rimLocalZ = this.rimZ; // 0.381m
        const rimLocalY = this.rimY - boardCenterY; // -0.385m
        
        const rimGeo = new THREE.TorusGeometry(rimRadius, 0.016, 16, 32);
        const rimColor = new THREE.MeshStandardMaterial({ color: 0xff4400, metalness: 0.6, roughness: 0.4 });
        const rimMesh = new THREE.Mesh(rimGeo, rimColor);
        rimMesh.rotation.x = Math.PI / 2;
        rimMesh.position.set(0, rimLocalY, rimLocalZ);
        rimMesh.castShadow = true;
        this.hoopGroup.add(rimMesh);
        
        // Rim connector (back to board)
        const connLen = rimLocalZ - rimRadius; // distance from board to inner ring = 0.1524m
        const connGeo = new THREE.BoxGeometry(0.15, 0.02, connLen);
        const connMesh = new THREE.Mesh(connGeo, rimColor);
        connMesh.position.set(0, rimLocalY, connLen / 2);
        this.hoopGroup.add(connMesh);
        
        // Net (wireframe cylinder)
        const netGeo = new THREE.CylinderGeometry(rimRadius, rimRadius * 0.6, 0.45, 12, 5, true);
        const netMat = new THREE.MeshStandardMaterial({ 
            color: 0xf0f0f0, transparent: true, opacity: 0.8, side: THREE.DoubleSide, wireframe: true
        });
        const netMesh = new THREE.Mesh(netGeo, netMat);
        netMesh.position.set(0, rimLocalY - 0.225, rimLocalZ);
        this.hoopGroup.add(netMesh);
        
        // ===== PHYSICS: STATIC BACKBOARD =====
        this.boardBody = new CANNON.Body({ mass: 0, material: this.materials.backboard });
        this.boardBody.addShape(new CANNON.Box(new CANNON.Vec3(boardW/2, boardH/2, 0.04/2)));
        this.boardBody.position.set(0, boardCenterY, boardFaceZ);
        this.world.addBody(this.boardBody);
        
        // ===== PHYSICS: STATIC RIM =====
        this.rimBody = new CANNON.Body({ mass: 0, material: this.materials.rim });
        const numSeg = 20;
        for (let i = 0; i < numSeg; i++) {
            const a = (i / numSeg) * Math.PI * 2;
            this.rimBody.addShape(
                new CANNON.Sphere(0.016),
                new CANNON.Vec3(Math.cos(a) * rimRadius, 0, Math.sin(a) * rimRadius)
            );
        }
        this.rimBody.position.set(0, this.rimY, this.rimZ);
        this.world.addBody(this.rimBody);
    }
    
    setupCollisionListener() {
        this.boardBody.addEventListener('collide', (e) => {
            const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
            if (v > 1) {
                this.wobbleVelocity += v * 0.012;
                this.sound.playThud(v);
            }
        });
        this.rimBody.addEventListener('collide', (e) => {
            const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
            if (v > 0.5) {
                this.wobbleVelocity += v * 0.008;
                this.sound.playClank(v);
            }
        });
    }
    
    update(dt) {
        const force = -80 * this.wobbleAngle - 5 * this.wobbleVelocity;
        this.wobbleVelocity += force * dt;
        this.wobbleAngle += this.wobbleVelocity * dt;
        if (Math.abs(this.wobbleAngle) < 0.0001 && Math.abs(this.wobbleVelocity) < 0.0001) {
            this.wobbleAngle = 0;
            this.wobbleVelocity = 0;
        }
        this.hoopGroup.rotation.x = this.wobbleAngle;
        
        // Sync physics bodies with visual wobble
        const q = new CANNON.Quaternion();
        q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), this.wobbleAngle);
        this.boardBody.quaternion.copy(q);
        this.rimBody.quaternion.copy(q);
    }
}
