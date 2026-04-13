import * as THREE from 'three';
import { SceneData, SceneObject, Vector3, PlayerState, AvatarData } from '../../types';

export interface RendererConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  shadows?: boolean;
  antialias?: boolean;
}

export interface RenderObject {
  id: string;
  mesh: THREE.Object3D;
  type: string;
}

export class GameRenderer {
  private _renderer: THREE.WebGLRenderer;
  private _scene: THREE.Scene;
  private _camera: THREE.PerspectiveCamera;
  private _objects: Map<string, THREE.Object3D> = new Map();
  private _playerMeshes: Map<string, THREE.Group> = new Map();
  private _clock = new THREE.Clock();
  private _animationId: number | null = null;
  private _ambientLight: THREE.AmbientLight;
  private _directionalLight: THREE.DirectionalLight;
  private _cameraTarget: THREE.Vector3 = new THREE.Vector3();
  private _cameraOffset: THREE.Vector3 = new THREE.Vector3(0, 8, 16);
  private _localPlayerId: string | null = null;
  private _onRenderCallbacks: ((dt: number) => void)[] = [];

  constructor(config: RendererConfig) {
    this._renderer = new THREE.WebGLRenderer({
      canvas: config.canvas,
      antialias: config.antialias ?? true,
      alpha: false,
    });
    this._renderer.setSize(config.width, config.height);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.shadowMap.enabled = config.shadows ?? true;
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.0;

    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x87ceeb);
    this._scene.fog = new THREE.Fog(0x87ceeb, 80, 300);

    this._camera = new THREE.PerspectiveCamera(70, config.width / config.height, 0.1, 500);
    this._camera.position.set(0, 10, 20);

    this._ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this._scene.add(this._ambientLight);

    this._directionalLight = new THREE.DirectionalLight(0xfff8e7, 1.2);
    this._directionalLight.position.set(50, 100, 50);
    this._directionalLight.castShadow = true;
    this._directionalLight.shadow.mapSize.width = 2048;
    this._directionalLight.shadow.mapSize.height = 2048;
    this._directionalLight.shadow.camera.near = 0.5;
    this._directionalLight.shadow.camera.far = 500;
    this._directionalLight.shadow.camera.left = -150;
    this._directionalLight.shadow.camera.right = 150;
    this._directionalLight.shadow.camera.top = 150;
    this._directionalLight.shadow.camera.bottom = -150;
    this._directionalLight.shadow.bias = -0.001;
    this._scene.add(this._directionalLight);

    this._buildDefaultWorld();
  }

  private _buildDefaultWorld(): void {
    const groundGeo = new THREE.PlaneGeometry(500, 500);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x4a7c59 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = '__ground__';
    this._scene.add(ground);

    const gridHelper = new THREE.GridHelper(500, 100, 0x000000, 0x000000);
    (gridHelper.material as THREE.LineBasicMaterial).opacity = 0.05;
    (gridHelper.material as THREE.LineBasicMaterial).transparent = true;
    this._scene.add(gridHelper);
  }

  loadScene(sceneData: SceneData): void {
    this._clearScene();
    if (sceneData.lighting) {
      if (sceneData.lighting.ambient !== undefined) {
        this._ambientLight.intensity = sceneData.lighting.ambient;
      }
      if (sceneData.lighting.sky_color) {
        const color = new THREE.Color(sceneData.lighting.sky_color);
        this._scene.background = color;
        (this._scene.fog as THREE.Fog).color = color;
      }
    }
    for (const obj of sceneData.objects) {
      this._addSceneObject(obj);
    }
  }

  private _clearScene(): void {
    const toRemove = Array.from(this._objects.values());
    for (const obj of toRemove) this._scene.remove(obj);
    this._objects.clear();
  }

  private _addSceneObject(obj: SceneObject): void {
    let mesh: THREE.Object3D | null = null;

    if (obj.type === 'Part') {
      const props = obj.properties as Record<string, unknown>;
      const size = (props.Size as Vector3) ?? obj.scale;
      const color = (props.Color as { r: number; g: number; b: number }) ?? { r: 0.5, g: 0.5, b: 0.5 };
      const transparency = (props.Transparency as number) ?? 0;
      const material_name = (props.Material as string) ?? 'SmoothPlastic';

      let mat: THREE.Material;
      if (material_name === 'Neon') {
        mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color.r, color.g, color.b),
          emissive: new THREE.Color(color.r, color.g, color.b),
          emissiveIntensity: 1,
          transparent: transparency > 0,
          opacity: 1 - transparency,
        });
      } else {
        mat = new THREE.MeshLambertMaterial({
          color: new THREE.Color(color.r, color.g, color.b),
          transparent: transparency > 0,
          opacity: 1 - transparency,
        });
      }

      const shape = (props.Shape as string) ?? 'Block';
      let geo: THREE.BufferGeometry;
      if (shape === 'Sphere') {
        geo = new THREE.SphereGeometry(Math.min(size.x, size.y, size.z) / 2, 16, 16);
      } else if (shape === 'Cylinder') {
        geo = new THREE.CylinderGeometry(size.x / 2, size.x / 2, size.y, 16);
      } else {
        geo = new THREE.BoxGeometry(size.x, size.y, size.z);
      }

      const m = new THREE.Mesh(geo, mat);
      m.castShadow = (props.CastShadow as boolean) ?? true;
      m.receiveShadow = true;
      mesh = m;
    } else if (obj.type === 'SpawnPoint') {
      const geo = new THREE.CylinderGeometry(2, 2, 0.1, 32);
      const mat = new THREE.MeshLambertMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
      mesh = new THREE.Mesh(geo, mat);
    } else if (obj.type === 'Light') {
      const props = obj.properties as Record<string, unknown>;
      const color = (props.Color as { r: number; g: number; b: number }) ?? { r: 1, g: 1, b: 1 };
      const light = new THREE.PointLight(
        new THREE.Color(color.r, color.g, color.b),
        (props.Brightness as number) ?? 1,
        (props.Range as number) ?? 16
      );
      mesh = light;
    } else {
      mesh = new THREE.Group();
    }

    if (mesh) {
      mesh.name = obj.id;
      mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(obj.rotation.x),
        THREE.MathUtils.degToRad(obj.rotation.y),
        THREE.MathUtils.degToRad(obj.rotation.z)
      );
      this._scene.add(mesh);
      this._objects.set(obj.id, mesh);
    }
  }

  updateSceneObject(obj: SceneObject): void {
    const existing = this._objects.get(obj.id);
    if (existing) {
      existing.position.set(obj.position.x, obj.position.y, obj.position.z);
      existing.rotation.set(
        THREE.MathUtils.degToRad(obj.rotation.x),
        THREE.MathUtils.degToRad(obj.rotation.y),
        THREE.MathUtils.degToRad(obj.rotation.z)
      );
    } else {
      this._addSceneObject(obj);
    }
  }

  removeSceneObject(id: string): void {
    const obj = this._objects.get(id);
    if (obj) { this._scene.remove(obj); this._objects.delete(id); }
  }

  createPlayerMesh(playerId: string, avatarData: AvatarData = {}): THREE.Group {
    const group = new THREE.Group();

    const bodyColor = avatarData.body_color ? new THREE.Color(avatarData.body_color) : new THREE.Color(0x4a90d9);
    const headColor = avatarData.head_color ? new THREE.Color(avatarData.head_color) : new THREE.Color(0xf5c8a0);
    const shirtColor = avatarData.shirt_color ? new THREE.Color(avatarData.shirt_color) : new THREE.Color(0x2c5f8a);
    const pantsColor = avatarData.pants_color ? new THREE.Color(avatarData.pants_color) : new THREE.Color(0x2d4a70);

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1.4, 0.6),
      new THREE.MeshLambertMaterial({ color: shirtColor })
    );
    torso.position.y = 1.4;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.85, 0.85),
      new THREE.MeshLambertMaterial({ color: headColor })
    );
    head.position.y = 2.5;
    head.castShadow = true;
    group.add(head);

    const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.2, 2.55, 0.43);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.2, 2.55, 0.43);
    group.add(rightEye);

    const leftArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 1.2, 0.4),
      new THREE.MeshLambertMaterial({ color: bodyColor })
    );
    leftArm.position.set(-0.7, 1.4, 0);
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 1.2, 0.4),
      new THREE.MeshLambertMaterial({ color: bodyColor })
    );
    rightArm.position.set(0.7, 1.4, 0);
    rightArm.castShadow = true;
    group.add(rightArm);

    const leftLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 1.2, 0.5),
      new THREE.MeshLambertMaterial({ color: pantsColor })
    );
    leftLeg.position.set(-0.25, 0.3, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 1.2, 0.5),
      new THREE.MeshLambertMaterial({ color: pantsColor })
    );
    rightLeg.position.set(0.25, 0.3, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    const nametagCanvas = document.createElement('canvas');
    nametagCanvas.width = 256; nametagCanvas.height = 64;
    const ctx = nametagCanvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.roundRect(4, 4, 248, 56, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(playerId.slice(0, 12), 128, 40);
    const tex = new THREE.CanvasTexture(nametagCanvas);
    const nametagMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 0.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    nametagMesh.position.y = 3.2;
    group.add(nametagMesh);

    group.name = playerId;
    this._scene.add(group);
    this._playerMeshes.set(playerId, group);
    return group;
  }

  updatePlayerMesh(playerId: string, state: PlayerState): void {
    let group = this._playerMeshes.get(playerId);
    if (!group) group = this.createPlayerMesh(playerId, state.avatar_data);

    group.position.set(state.position.x, state.position.y, state.position.z);
    group.rotation.y = THREE.MathUtils.degToRad(state.rotation.y);
  }

  removePlayerMesh(playerId: string): void {
    const group = this._playerMeshes.get(playerId);
    if (group) { this._scene.remove(group); this._playerMeshes.delete(playerId); }
  }

  setLocalPlayer(playerId: string): void { this._localPlayerId = playerId; }

  updateCamera(playerPos: Vector3): void {
    this._cameraTarget.lerp(new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z), 0.1);
    this._camera.position.set(
      this._cameraTarget.x + this._cameraOffset.x,
      this._cameraTarget.y + this._cameraOffset.y,
      this._cameraTarget.z + this._cameraOffset.z
    );
    this._camera.lookAt(this._cameraTarget.x, this._cameraTarget.y + 1, this._cameraTarget.z);
  }

  setCameraOffset(x: number, y: number, z: number): void {
    this._cameraOffset.set(x, y, z);
  }

  onRender(callback: (dt: number) => void): () => void {
    this._onRenderCallbacks.push(callback);
    return () => { this._onRenderCallbacks = this._onRenderCallbacks.filter(c => c !== callback); };
  }

  start(): void {
    const animate = () => {
      this._animationId = requestAnimationFrame(animate);
      const dt = this._clock.getDelta();
      for (const cb of this._onRenderCallbacks) {
        try { cb(dt); } catch (e) { console.error('[Renderer] Render callback error:', e); }
      }
      if (this._localPlayerId) {
        const playerMesh = this._playerMeshes.get(this._localPlayerId);
        if (playerMesh) {
          this.updateCamera({
            x: playerMesh.position.x,
            y: playerMesh.position.y,
            z: playerMesh.position.z
          });
        }
      }
      this._renderer.render(this._scene, this._camera);
    };
    animate();
  }

  stop(): void {
    if (this._animationId !== null) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  resize(width: number, height: number): void {
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(width, height);
  }

  dispose(): void {
    this.stop();
    this._renderer.dispose();
  }

  get scene(): THREE.Scene { return this._scene; }
  get camera(): THREE.PerspectiveCamera { return this._camera; }
  get threeRenderer(): THREE.WebGLRenderer { return this._renderer; }
}
