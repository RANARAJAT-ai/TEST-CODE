
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { AppState, SimulationVoxel, RebuildTarget, VoxelData } from '../types';
import { CONFIG, COLORS } from '../utils/voxelConstants';

const VignetteShader = {
	uniforms: {
		'tDiffuse': { value: null },
		'offset': { value: 1.0 },
		'darkness': { value: 1.2 }
	},
	vertexShader: `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}
	`,
	fragmentShader: `
		uniform float offset;
		uniform float darkness;
		uniform sampler2D tDiffuse;
		varying vec2 vUv;
		void main() {
			vec4 texel = texture2D( tDiffuse, vUv );
			vec2 uv = ( vUv - vec2( 0.5 ) ) * vec2( offset );
			gl_FragColor = vec4( texel.rgb * mix( 1.0, 1.0 - darkness, dot( uv, uv ) ), texel.a );
		}
	`
};

export class VoxelEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private controls: OrbitControls;
  private instanceMesh: THREE.InstancedMesh | null = null;
  private dummy = new THREE.Object3D();
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  
  private voxels: SimulationVoxel[] = [];
  private rebuildTargets: RebuildTarget[] = [];
  private rebuildStartTime: number = 0;
  
  private state: AppState = AppState.STABLE;
  private onStateChange: (state: AppState) => void;
  private onCountChange: (count: number) => void;
  private animationId: number = 0;

  // Holographic Core for generation feedback
  private neuralCore: THREE.Group;
  private isGenerating: boolean = false;

  constructor(
    container: HTMLElement, 
    onStateChange: (state: AppState) => void,
    onCountChange: (count: number) => void
  ) {
    this.container = container;
    this.onStateChange = onStateChange;
    this.onCountChange = onCountChange;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.BG_COLOR);
    this.scene.fog = new THREE.FogExp2(CONFIG.BG_COLOR, 0.0015);

    this.camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.5, 1000);
    this.camera.position.set(55, 40, 85);

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: false, 
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    container.appendChild(this.renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    const envLight = new THREE.PointLight(0xffffff, 50, 100);
    envLight.position.set(10, 20, 10);
    envScene.add(envLight);
    const envTarget = pmremGenerator.fromScene(envScene);
    this.scene.environment = envTarget.texture;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const ssaoPass = new SSAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
    ssaoPass.kernelRadius = 3.0;
    ssaoPass.minDistance = 0.002;
    ssaoPass.maxDistance = 0.08;
    this.composer.addPass(ssaoPass);
    
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.6,   // Increased strength for the core
      0.4,   
      0.85   
    );
    this.composer.addPass(bloomPass);
    this.composer.addPass(new ShaderPass(VignetteShader));

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.04;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.target.set(0, 2, 0);
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 200;

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x0F172A, 0.3);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(40, 70, 40);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 4096;
    keyLight.shadow.mapSize.height = 4096;
    keyLight.shadow.camera.left = -70;
    keyLight.shadow.camera.right = 70;
    keyLight.shadow.camera.top = 70;
    keyLight.shadow.camera.bottom = -70;
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.radius = 1.8;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 1.0);
    fillLight.position.set(-50, 20, 20);
    this.scene.add(fillLight);

    const planeMat = new THREE.MeshStandardMaterial({ 
      color: 0x111827, 
      roughness: 0.15,
      metalness: 0.5,
      transparent: true,
      opacity: 0.98
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), planeMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = CONFIG.FLOOR_Y;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(400, 80, 0x1e293b, 0x0f172a);
    grid.position.y = CONFIG.FLOOR_Y + 0.05;
    this.scene.add(grid);

    // Build Neural Core Group
    this.neuralCore = new THREE.Group();
    const coreGeom = new THREE.IcosahedronGeometry(8, 2);
    const coreMat = new THREE.MeshBasicMaterial({ 
      color: 0x00f2ff, 
      wireframe: true, 
      transparent: true, 
      opacity: 0.0 
    });
    const coreMesh = new THREE.Mesh(coreGeom, coreMat);
    this.neuralCore.add(coreMesh);
    
    const innerCore = new THREE.Mesh(
      new THREE.SphereGeometry(3, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.0 })
    );
    this.neuralCore.add(innerCore);
    this.neuralCore.position.y = 5;
    this.scene.add(this.neuralCore);

    this.container.addEventListener('click', this.onMouseClick.bind(this));
    this.animate = this.animate.bind(this);
    this.animate();
  }

  public setGenerating(val: boolean) {
    this.isGenerating = val;
  }

  private onMouseClick(event: MouseEvent) {
    if (this.state !== AppState.STABLE || !this.instanceMesh) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.instanceMesh);
    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      this.triggerFalling(intersects[0].instanceId);
      this.checkStructuralIntegrity();
    }
  }

  private triggerFalling(index: number) {
    const v = this.voxels[index];
    if (v.isFalling) return;
    v.isFalling = true;
    v.grounded = false;
    v.vx = (Math.random() - 0.5) * 0.5;
    v.vy = Math.random() * 0.3;
    v.vz = (Math.random() - 0.5) * 0.5;
    v.rvx = (Math.random() - 0.5) * 0.3;
    v.rvy = (Math.random() - 0.5) * 0.3;
    v.rvz = (Math.random() - 0.5) * 0.3;
  }

  private checkStructuralIntegrity() {
    this.voxels.forEach(v => v.grounded = false);
    const queue: number[] = [];
    this.voxels.forEach((v, i) => {
      if (!v.isFalling && v.y <= CONFIG.FLOOR_Y + 1.2) { 
        v.grounded = true;
        queue.push(i);
      }
    });
    let head = 0;
    const voxelMap = new Map<string, number>();
    this.voxels.forEach((v, i) => {
        if (!v.isFalling) {
            const key = `${Math.round(v.x)},${Math.round(v.y)},${Math.round(v.z)}`;
            voxelMap.set(key, i);
        }
    });
    while (head < queue.length) {
      const currentIdx = queue[head++];
      const v = this.voxels[currentIdx];
      const neighbors = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
      for (const [dx, dy, dz] of neighbors) {
        const nx = Math.round(v.x) + dx;
        const ny = Math.round(v.y) + dy;
        const nz = Math.round(v.z) + dz;
        const key = `${nx},${ny},${nz}`;
        const neighborIdx = voxelMap.get(key);
        if (neighborIdx !== undefined) {
          const nv = this.voxels[neighborIdx];
          if (!nv.isFalling && !nv.grounded) {
            nv.grounded = true;
            queue.push(neighborIdx);
          }
        }
      }
    }
    this.voxels.forEach((v, i) => {
      if (!v.isFalling && !v.grounded) {
        this.triggerFalling(i);
      }
    });
  }

  public loadInitialModel(data: VoxelData[]) {
    this.createVoxels(data);
    this.onCountChange(this.voxels.length);
    this.state = AppState.STABLE;
    this.onStateChange(this.state);
  }

  private createVoxels(data: VoxelData[]) {
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);
      this.instanceMesh.geometry.dispose();
      if (Array.isArray(this.instanceMesh.material)) {
          this.instanceMesh.material.forEach(m => m.dispose());
      } else {
          this.instanceMesh.material.dispose();
      }
    }

    this.voxels = data.map((v, i) => {
        const c = new THREE.Color(v.color);
        c.offsetHSL(0, 0, (Math.random() * 0.04) - 0.02);
        return {
            id: i,
            x: v.x, y: v.y, z: v.z, color: c,
            vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0,
            rvx: 0, rvy: 0, rvz: 0,
            isFalling: false, grounded: true
        };
    });

    const geometry = new THREE.BoxGeometry(CONFIG.VOXEL_SIZE - 0.015, CONFIG.VOXEL_SIZE - 0.015, CONFIG.VOXEL_SIZE - 0.015);
    const material = new THREE.MeshStandardMaterial({ 
      roughness: 0.12, 
      metalness: 0.45,
      envMapIntensity: 1.8
    });
    
    this.instanceMesh = new THREE.InstancedMesh(geometry, material, this.voxels.length);
    this.instanceMesh.castShadow = true;
    this.instanceMesh.receiveShadow = true;
    this.scene.add(this.instanceMesh);
    this.draw();
  }

  private draw() {
    if (!this.instanceMesh) return;
    this.voxels.forEach((v, i) => {
        this.dummy.position.set(v.x, v.y, v.z);
        this.dummy.rotation.set(v.rx, v.ry, v.rz);
        this.dummy.updateMatrix();
        this.instanceMesh!.setMatrixAt(i, this.dummy.matrix);
        this.instanceMesh!.setColorAt(i, v.color);
    });
    this.instanceMesh.instanceMatrix.needsUpdate = true;
    if (this.instanceMesh.instanceColor) {
      this.instanceMesh.instanceColor.needsUpdate = true;
    }
  }

  public dismantle() {
    if (this.state !== AppState.STABLE) return;
    this.state = AppState.DISMANTLING;
    this.onStateChange(this.state);
    this.voxels.forEach(v => {
        this.triggerFalling(v.id);
        v.vx = (Math.random() - 0.5) * 1.6;
        v.vy = Math.random() * 1.4;
        v.vz = (Math.random() - 0.5) * 1.6;
    });
  }

  private getColorDist(c1: THREE.Color, hex2: number): number {
    const c2 = new THREE.Color(hex2);
    const r = (c1.r - c2.r) * 0.3;
    const g = (c1.g - c2.g) * 0.59;
    const b = (c1.b - c2.b) * 0.11;
    return Math.sqrt(r * r + g * g + b * b);
  }

  public rebuild(targetModel: VoxelData[]) {
    this.state = AppState.REBUILDING;
    this.onStateChange(this.state);
    const available = this.voxels.map((v, i) => ({ index: i, color: v.color, taken: false }));
    const mappings: RebuildTarget[] = new Array(this.voxels.length).fill(null);

    targetModel.forEach(target => {
        let bestDist = 9999;
        let bestIdx = -1;
        for (let i = 0; i < available.length; i++) {
            if (available[i].taken) continue;
            const d = this.getColorDist(available[i].color, target.color);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
                if (d < 0.01) break;
            }
        }
        if (bestIdx !== -1) {
            available[bestIdx].taken = true;
            const h = Math.max(0, (target.y - CONFIG.FLOOR_Y) / 15);
            mappings[available[bestIdx].index] = {
                x: target.x, y: target.y, z: target.z,
                delay: h * 800
            };
        }
    });

    for (let i = 0; i < this.voxels.length; i++) {
        if (!mappings[i]) {
            mappings[i] = {
                x: this.voxels[i].x, y: this.voxels[i].y, z: this.voxels[i].z,
                isRubble: true, delay: 0
            };
        }
    }
    this.rebuildTargets = mappings;
    this.rebuildStartTime = Date.now();
  }

  private updatePhysics() {
    if (this.state === AppState.REBUILDING) {
        const now = Date.now();
        const elapsed = now - this.rebuildStartTime;
        let allDone = true;
        this.voxels.forEach((v, i) => {
            const t = this.rebuildTargets[i];
            if (t.isRubble) return;
            if (elapsed < t.delay) {
                allDone = false;
                return;
            }
            const speed = 0.12;
            v.x += (t.x - v.x) * speed;
            v.y += (t.y - v.y) * speed;
            v.z += (t.z - v.z) * speed;
            v.rx += (0 - v.rx) * speed;
            v.ry += (0 - v.ry) * speed;
            v.rz += (0 - v.rz) * speed;
            if ((t.x - v.x) ** 2 + (t.y - v.y) ** 2 + (t.z - v.z) ** 2 > 0.01) {
                allDone = false;
            } else {
                v.x = t.x; v.y = t.y; v.z = t.z;
                v.rx = 0; v.ry = 0; v.rz = 0;
                v.isFalling = false;
                v.grounded = true;
                v.vx = v.vy = v.vz = 0;
            }
        });
        if (allDone) {
            this.state = AppState.STABLE;
            this.onStateChange(this.state);
        }
    } else {
        this.voxels.forEach(v => {
            if (v.isFalling) {
                v.vy -= 0.052;
                v.x += v.vx; v.y += v.vy; v.z += v.vz;
                v.rx += v.rvx; v.ry += v.rvy; v.rz += v.rvz;
                if (v.y < CONFIG.FLOOR_Y + 0.5) {
                    v.y = CONFIG.FLOOR_Y + 0.5;
                    v.vy *= -0.42;
                    v.vx *= 0.75; 
                    v.vz *= 0.75;
                    v.rvx *= 0.65; v.rvy *= 0.65; v.rvz *= 0.65;
                    if (Math.abs(v.vy) < 0.05 && Math.abs(v.vx) < 0.05 && Math.abs(v.vz) < 0.05) {
                        v.vx = v.vz = v.vy = 0;
                        v.rvx = v.rvy = v.rvz = 0;
                    }
                }
            }
        });
    }
  }

  private animate() {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.updatePhysics();
    
    // Update Neural Core animation
    if (this.neuralCore) {
      this.neuralCore.rotation.y += 0.01;
      this.neuralCore.rotation.z += 0.005;
      const targetOpacity = this.isGenerating ? 0.6 : 0.0;
      this.neuralCore.children.forEach((child) => {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity += (targetOpacity - mat.opacity) * 0.1;
      });
      const pulse = Math.sin(Date.now() * 0.005) * 0.2 + 1.0;
      this.neuralCore.scale.set(pulse, pulse, pulse);
    }

    this.draw();
    this.composer.render();
  }

  public handleResize() {
      if (this.camera && this.renderer && this.composer) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }
  }
  
  public setAutoRotate(enabled: boolean) {
    if (this.controls) {
        this.controls.autoRotate = enabled;
    }
  }

  public getJsonData(): string {
      const data = this.voxels.map((v, i) => ({
          id: i,
          x: +v.x.toFixed(2),
          y: +v.y.toFixed(2),
          z: +v.z.toFixed(2),
          c: '#' + v.color.getHexString()
      }));
      return JSON.stringify(data, null, 2);
  }
  
  public cleanup() {
    cancelAnimationFrame(this.animationId);
    this.container.removeEventListener('click', this.onMouseClick);
    this.container.removeChild(this.renderer.domElement);
    this.renderer.dispose();
    this.composer.dispose();
  }
}
