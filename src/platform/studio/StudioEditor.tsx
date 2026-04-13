import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../auth/AuthContext';
import { Game, SceneObject, ScriptEntry, Vector3 } from '../../types';
import * as THREE from 'three';
import { SCRIPT_TEMPLATES } from '../../engine/scripting/ScriptTemplates';
import { ChevronRight, ChevronDown, Plus, Trash2, Copy, Eye, EyeOff, Save, Play, Code, Layers, Settings2, Package, AlertCircle, CheckCircle2, X, Minus, Box, Sun, Zap, TerminalSquare, Move3d, Trash, CreditCard as Edit2, Search, Download, Upload, Grid3x3, Palette, Type, LogOut, Maximize, Grid2x2 as Grid2X2, Home, Library, RotateCw, RotateCcw } from 'lucide-react';

const OBJECT_TYPES = [
  { type: 'Part', icon: Box, label: 'Part' },
  { type: 'SpawnLocation', icon: Zap, label: 'Spawn' },
  { type: 'PointLight', icon: Sun, label: 'Light' },
  { type: 'ServerScript', icon: Code, label: 'Script' },
  { type: 'LocalScript', icon: Code, label: 'LocalScript' },
  { type: 'Model', icon: Package, label: 'Model' },
];

const PRESET_MODELS = [
  { name: 'Cube', geometry: 'box', size: { x: 4, y: 4, z: 4 }, color: 0x1f9e78 },
  { name: 'Sphere', geometry: 'sphere', size: { x: 4, y: 4, z: 4 }, color: 0xff6b6b },
  { name: 'Cylinder', geometry: 'cylinder', size: { x: 4, y: 4, z: 4 }, color: 0x4ecdc4 },
  { name: 'Wedge', geometry: 'cone', size: { x: 4, y: 4, z: 4 }, color: 0xffe66d },
  { name: 'Platform', geometry: 'box', size: { x: 20, y: 1, z: 20 }, color: 0x95a5a6 },
  { name: 'Wall', geometry: 'box', size: { x: 1, y: 20, z: 20 }, color: 0xbdc3c7 },
];

const SCRIPT_LANGUAGES_LIST = [
  { id: 'lua', name: 'Lua', icon: Code },
  { id: 'python', name: 'Python', icon: Code },
  { id: 'javascript', name: 'JavaScript', icon: Code },
  { id: 'csharp', name: 'C#', icon: Code },
  { id: 'typescript', name: 'TypeScript', icon: Code },
  { id: 'html', name: 'HTML/CSS', icon: Code },
];

interface StudioEditorProps {
  game?: Game;
  onClose: () => void;
  onPlaytest: (game: Game) => void;
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

const DEFAULT_SCENE: SceneObject[] = [
  {
    id: 'baseplate',
    name: 'Baseplate',
    type: 'Part',
    parent_id: null,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    properties: {
      Size: { x: 512, y: 1.2, z: 512 },
      Color: { r: 0.388, g: 0.373, b: 0.384 },
      Anchored: true,
      CanCollide: true,
      Material: 'Grass',
    },
  },
  {
    id: 'spawn1',
    name: 'SpawnLocation',
    type: 'SpawnLocation',
    parent_id: null,
    position: { x: 0, y: 2, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    properties: {
      Size: { x: 6, y: 1, z: 6 },
      Color: { r: 0.294, g: 0.592, b: 0.294 },
      Anchored: true,
    },
  },
];

export function StudioEditor({ game, onClose, onPlaytest }: StudioEditorProps) {
  const { profile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const objectMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const animFrameRef = useRef<number | null>(null);
  const orbitStateRef = useRef({ rotating: false, panning: false, lastX: 0, lastY: 0, zoom: 100 });
  const selectedMeshRef = useRef<THREE.Object3D | null>(null);
  const controlsRef = useRef<any>(null);

  const [objects, setObjects] = useState<SceneObject[]>(game?.scene_data?.objects ?? DEFAULT_SCENE);
  const [scripts, setScripts] = useState<ScriptEntry[]>(game?.scripts ?? []);
  const [selectedId, setSelectedId] = useState<string | null>('baseplate');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['root']));
  const [activePanel, setActivePanel] = useState<'hierarchy' | 'properties' | 'scripts' | 'settings'>('hierarchy');
  const [activeScript, setActiveScript] = useState<ScriptEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [gameTitle, setGameTitle] = useState(game?.title ?? 'Untitled Game');
  const [gameGenre, setGameGenre] = useState(game?.genre ?? 'All');
  const [gameMaxPlayers, setGameMaxPlayers] = useState(game?.max_players ?? 10);
  const [gameDesc, setGameDesc] = useState(game?.description ?? '');
  const [isPublished, setIsPublished] = useState(game?.is_published ?? false);
  const [showModelBrowser, setShowModelBrowser] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('lua');
  const [modelSearch, setModelSearch] = useState('');
  const [transformMode, setTransformMode] = useState<'move' | 'rotate' | 'scale'>('move');
  const [editingScript, setEditingScript] = useState(false);
  const [showScriptTemplates, setShowScriptTemplates] = useState(false);

  const selectedObject = objects.find(o => o.id === selectedId) ?? null;
  const filteredTemplates = SCRIPT_TEMPLATES.filter(t =>
    selectedLanguage === 'lua' || t.source.includes(selectedLanguage)
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    initRenderer();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      rendererRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current) rebuildScene();
  }, [objects]);

  function initRenderer() {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1e2e);
    scene.fog = new THREE.Fog(0x1e1e2e, 500, 2000);
    sceneRef.current = scene;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(100, 150, 100);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 1000;
    dirLight.shadow.camera.left = -200;
    dirLight.shadow.camera.right = 200;
    dirLight.shadow.camera.top = 200;
    dirLight.shadow.camera.bottom = -200;
    scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(512, 32, 0x333344, 0x222233);
    scene.add(gridHelper);

    const camera = new THREE.PerspectiveCamera(65, canvas.clientWidth / canvas.clientHeight, 0.1, 5000);
    camera.position.set(50, 40, 70);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    rebuildScene();
    startRenderLoop();
    setupControls(canvas, camera);
    setupObjectSelection(canvas, scene, camera);
  }

  function setupObjectSelection(canvas: HTMLCanvasElement, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    canvas.addEventListener('click', (e) => {
      if (orbitStateRef.current.rotating || orbitStateRef.current.panning) return;

      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      let selected = null;
      for (const intersection of intersects) {
        let obj = intersection.object as any;
        while (obj && !obj.name) obj = obj.parent;
        if (obj?.name && obj.name !== 'grid') {
          selected = obj.name;
          break;
        }
      }

      if (selected) {
        setSelectedId(selected);
      }
    });
  }

  function setupControls(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
    let isDragging = false;
    let isRightClick = false;

    canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      isRightClick = e.button === 2;
      orbitStateRef.current.lastX = e.clientX;
      orbitStateRef.current.lastY = e.clientY;
      if (isRightClick) orbitStateRef.current.rotating = true;
      else orbitStateRef.current.panning = true;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDragging || !cameraRef.current) return;

      const deltaX = e.clientX - orbitStateRef.current.lastX;
      const deltaY = e.clientY - orbitStateRef.current.lastY;

      const position = camera.position;
      const distance = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);

      if (isRightClick) {
        const theta = Math.atan2(position.z, position.x) + deltaX * 0.01;
        const phi = Math.acos(position.y / distance) + deltaY * 0.01;
        camera.position.x = distance * Math.sin(phi) * Math.cos(theta);
        camera.position.y = distance * Math.cos(phi);
        camera.position.z = distance * Math.sin(phi) * Math.sin(theta);
        camera.lookAt(0, 0, 0);
      }

      orbitStateRef.current.lastX = e.clientX;
      orbitStateRef.current.lastY = e.clientY;
    });

    canvas.addEventListener('mouseup', () => {
      isDragging = false;
      orbitStateRef.current.rotating = false;
      orbitStateRef.current.panning = false;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const position = camera.position;
      const distance = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
      const newDistance = Math.max(5, distance + e.deltaY * 0.1);
      const scale = newDistance / distance;
      camera.position.multiplyScalar(scale);
    });
  }

  function rebuildScene() {
    if (!sceneRef.current) return;
    for (const mesh of objectMeshesRef.current.values()) {
      sceneRef.current.remove(mesh);
    }
    objectMeshesRef.current.clear();

    for (const obj of objects) {
      const mesh = createMeshForObject(obj);
      if (mesh) {
        mesh.name = obj.id;
        mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
        mesh.rotation.set(
          THREE.MathUtils.degToRad(obj.rotation.x),
          THREE.MathUtils.degToRad(obj.rotation.y),
          THREE.MathUtils.degToRad(obj.rotation.z)
        );
        mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
        sceneRef.current.add(mesh);
        objectMeshesRef.current.set(obj.id, mesh);

        if (obj.id === selectedId) {
          const wireframeGeo = new THREE.EdgesGeometry((mesh as any).geometry);
          const wireframe = new THREE.LineSegments(
            wireframeGeo,
            new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 })
          );
          mesh.add(wireframe);
        }
      }
    }
  }

  function createMeshForObject(obj: SceneObject): THREE.Object3D | null {
    const props = obj.properties as Record<string, unknown>;
    const size = (props.Size as Vector3) ?? { x: 4, y: 1.2, z: 4 };
    const color = (props.Color as { r: number; g: number; b: number }) ?? { r: 0.5, g: 0.5, b: 0.5 };

    if (obj.type === 'Part' || obj.type === 'SpawnLocation') {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color.r, color.g, color.b),
        metalness: 0.1,
        roughness: 0.8,
        transparent: obj.type === 'SpawnLocation',
        opacity: obj.type === 'SpawnLocation' ? 0.6 : 1,
      });
      const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    } else if (obj.type === 'PointLight') {
      const light = new THREE.PointLight(0xffffff, 1, 50);
      light.castShadow = true;
      return light;
    }
    return null;
  }

  function startRenderLoop() {
    const render = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animFrameRef.current = requestAnimationFrame(render);
    };
    render();
  }

  function addObject(type: string) {
    const newId = generateId();
    const newObj: SceneObject = {
      id: newId,
      name: `${type}_${newId.substr(0, 4)}`,
      type: type as any,
      parent_id: null,
      position: { x: 0, y: 5, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      properties: {
        Size: { x: 4, y: 4, z: 4 },
        Color: { r: 0.5, g: 0.5, b: 0.5 },
        Anchored: false,
      },
    };
    setObjects(prev => [...prev, newObj]);
    setSelectedId(newId);
  }

  function addPresetModel(model: typeof PRESET_MODELS[0]) {
    const newId = generateId();
    const newObj: SceneObject = {
      id: newId,
      name: `${model.name}_${newId.substr(0, 4)}`,
      type: 'Part',
      parent_id: null,
      position: { x: 0, y: 5, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      properties: {
        Size: model.size,
        Color: {
          r: ((model.color >> 16) & 255) / 255,
          g: ((model.color >> 8) & 255) / 255,
          b: (model.color & 255) / 255,
        },
        Anchored: false,
      },
    };
    setObjects(prev => [...prev, newObj]);
    setSelectedId(newId);
    setShowModelBrowser(false);
  }

  function deleteObject(id: string) {
    setObjects(prev => prev.filter(o => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function updateObjectProperty(prop: string, value: any) {
    if (!selectedObject) return;
    setObjects(prev =>
      prev.map(o =>
        o.id === selectedId
          ? {
              ...o,
              [prop]: value,
              properties: { ...o.properties, [prop]: value },
            }
          : o
      )
    );
  }

  function duplicateObject(id: string) {
    const obj = objects.find(o => o.id === id);
    if (!obj) return;
    const newId = generateId();
    const newObj = { ...obj, id: newId, name: `${obj.name}_copy` };
    setObjects(prev => [...prev, newObj]);
    setSelectedId(newId);
  }

  function addScript() {
    const newId = generateId();
    const newScript: ScriptEntry = {
      id: newId,
      name: `Script_${newId.substr(0, 4)}`,
      source: SCRIPT_TEMPLATES[0]?.source || '-- New Script\nprint("Hello")',
      script_type: 'ServerScript',
      enabled: true,
    };
    setScripts(prev => [...prev, newScript]);
    setActiveScript(newScript);
    setEditingScript(true);
  }

  function deleteScript(id: string) {
    setScripts(prev => prev.filter(s => s.id !== id));
    if (activeScript?.id === id) setActiveScript(null);
  }

  function updateScript(id: string, updates: Partial<ScriptEntry>) {
    setScripts(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updates } : s))
    );
    if (activeScript?.id === id) {
      setActiveScript({ ...activeScript, ...updates });
    }
  }

  function addScriptFromTemplate(template: typeof SCRIPT_TEMPLATES[0]) {
    const newId = generateId();
    const newScript: ScriptEntry = {
      id: newId,
      name: template.name,
      source: template.source,
      script_type: 'ServerScript',
      enabled: true,
    };
    setScripts(prev => [...prev, newScript]);
    setActiveScript(newScript);
    setShowScriptTemplates(false);
  }

  async function saveGame() {
    if (!profile) return;
    setSaving(true);
    try {
      const gameData = {
        title: gameTitle,
        description: gameDesc,
        genre: gameGenre,
        max_players: gameMaxPlayers,
        is_published: isPublished,
        scene_data: { objects },
        scripts,
        updated_at: new Date().toISOString(),
      };

      if (game?.id) {
        await supabase.from('games').update(gameData).eq('id', game.id);
      } else {
        await supabase.from('games').insert({
          ...gameData,
          creator_id: profile.id,
          is_featured: false,
        });
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
    setSaving(false);
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <div className="flex flex-1 flex-col">
        <div className="h-14 bg-gradient-to-r from-blue-600 to-blue-700 border-b border-blue-800 flex items-center px-4 gap-3">
          <Home className="w-4 h-4" />
          <span className="text-sm font-semibold">{gameTitle}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs bg-blue-900/40 px-2 py-1 rounded">NexaVerse Studio</span>
            <button onClick={onClose} className="p-1 hover:bg-blue-700 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
            <div className="flex gap-1 p-2 border-b border-gray-700">
              {[
                { id: 'hierarchy', label: 'Explorer', icon: Grid3x3 },
                { id: 'properties', label: 'Properties', icon: Settings2 },
                { id: 'scripts', label: 'Scripts', icon: Code },
                { id: 'settings', label: 'Settings', icon: Palette },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActivePanel(id as any)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded transition-colors ${
                    activePanel === id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {activePanel === 'hierarchy' && (
                <div className="p-2 space-y-1">
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => setShowModelBrowser(!showModelBrowser)}
                      className="flex items-center gap-1.5 w-full bg-blue-600 hover:bg-blue-500 text-white px-2 py-1.5 rounded text-xs font-semibold"
                    >
                      <Plus className="w-3 h-3" />
                      Add Model
                    </button>
                  </div>
                  {showModelBrowser && (
                    <div className="mb-3 p-2 bg-gray-700 rounded space-y-2">
                      <input
                        type="text"
                        placeholder="Search models..."
                        value={modelSearch}
                        onChange={e => setModelSearch(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-500"
                      />
                      <div className="grid grid-cols-2 gap-1">
                        {PRESET_MODELS.map(model => (
                          <button
                            key={model.name}
                            onClick={() => addPresetModel(model)}
                            className="p-2 bg-gray-600 hover:bg-gray-500 rounded text-xs font-semibold transition-colors"
                          >
                            {model.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase px-1">Workspace</p>
                    {objects.map(obj => (
                      <div
                        key={obj.id}
                        className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                          selectedId === obj.id
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                        onClick={() => setSelectedId(obj.id)}
                      >
                        <span className="truncate">{obj.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              duplicateObject(obj.id);
                            }}
                            className="p-0.5 hover:bg-gray-600 rounded"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              deleteObject(obj.id);
                            }}
                            className="p-0.5 hover:bg-red-600/20 rounded"
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activePanel === 'properties' && selectedObject && (
                <div className="p-3 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-400">Name</label>
                    <input
                      type="text"
                      value={selectedObject.name}
                      onChange={e => updateObjectProperty('name', e.target.value)}
                      className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {['Position', 'Rotation', 'Scale'].map((prop, i) => {
                      const key = prop.toLowerCase() as 'position' | 'rotation' | 'scale';
                      const value = selectedObject[key];
                      return (
                        <div key={i}>
                          <label className="text-xs font-semibold text-gray-400">{prop}</label>
                          <div className="space-y-1 mt-1">
                            {['x', 'y', 'z'].map(axis => (
                              <input
                                key={axis}
                                type="number"
                                value={Math.round((value as any)[axis] * 100) / 100}
                                onChange={e =>
                                  updateObjectProperty(key, {
                                    ...value,
                                    [axis]: parseFloat(e.target.value),
                                  })
                                }
                                className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-white"
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-400">Color</label>
                    <div className="flex gap-2 mt-1">
                      {['r', 'g', 'b'].map(c => (
                        <input
                          key={c}
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={Math.round(
                            ((selectedObject.properties as any).Color as any)[c] * 100
                          ) / 100}
                          onChange={e => {
                            const color = (selectedObject.properties as any).Color;
                            updateObjectProperty('Color', {
                              ...color,
                              [c]: parseFloat(e.target.value),
                            });
                          }}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activePanel === 'scripts' && (
                <div className="p-2 space-y-2">
                  <button
                    onClick={addScript}
                    className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-2 py-1.5 rounded text-xs font-semibold"
                  >
                    <Plus className="w-3 h-3" />
                    New Script
                  </button>
                  <button
                    onClick={() => setShowScriptTemplates(!showScriptTemplates)}
                    className="w-full flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white px-2 py-1.5 rounded text-xs font-semibold"
                  >
                    <Library className="w-3 h-3" />
                    Templates
                  </button>

                  {showScriptTemplates && (
                    <div className="p-2 bg-gray-700 rounded space-y-2">
                      <div className="flex gap-1 flex-wrap">
                        {SCRIPT_LANGUAGES_LIST.map(lang => (
                          <button
                            key={lang.id}
                            onClick={() => setSelectedLanguage(lang.id)}
                            className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                              selectedLanguage === lang.id
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            }`}
                          >
                            {lang.name}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {filteredTemplates.slice(0, 15).map(template => (
                          <button
                            key={template.id}
                            onClick={() => addScriptFromTemplate(template)}
                            className="w-full text-left p-1.5 bg-gray-600 hover:bg-gray-500 rounded text-xs font-semibold transition-colors truncate"
                          >
                            {template.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    {scripts.map(script => (
                      <div
                        key={script.id}
                        className={`flex items-center justify-between p-1.5 rounded text-xs cursor-pointer transition-colors ${
                          activeScript?.id === script.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                        onClick={() => setActiveScript(script)}
                      >
                        <span className="truncate">{script.name}</span>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            deleteScript(script.id);
                          }}
                          className="p-0.5 hover:bg-red-600/20 rounded"
                        >
                          <Trash className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activePanel === 'settings' && (
                <div className="p-3 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-400">Title</label>
                    <input
                      type="text"
                      value={gameTitle}
                      onChange={e => setGameTitle(e.target.value)}
                      className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400">Description</label>
                    <textarea
                      value={gameDesc}
                      onChange={e => setGameDesc(e.target.value)}
                      className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white h-20 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-400">Genre</label>
                      <select
                        value={gameGenre}
                        onChange={e => setGameGenre(e.target.value)}
                        className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                      >
                        {['All', 'Adventure', 'Obby', 'RPG', 'Simulator', 'Tycoon', 'FPS', 'Horror', 'Racing', 'Social'].map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-400">Max Players</label>
                      <input
                        type="number"
                        value={gameMaxPlayers}
                        onChange={e => setGameMaxPlayers(parseInt(e.target.value))}
                        className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={e => setIsPublished(e.target.checked)}
                      className="rounded"
                    />
                    Publish Game
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <canvas ref={canvasRef} className="flex-1 bg-gray-900" />
            {activeScript && editingScript && (
              <div className="h-48 bg-gray-800 border-t border-gray-700 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
                  <span className="text-sm font-semibold">{activeScript.name}</span>
                  <button onClick={() => setEditingScript(false)} className="p-1 hover:bg-gray-700 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  value={activeScript.source}
                  onChange={e => updateScript(activeScript.id, { source: e.target.value })}
                  className="flex-1 bg-gray-900 text-gray-100 p-3 font-mono text-xs resize-none overflow-auto"
                />
              </div>
            )}
          </div>
        </div>

        <div className="h-12 bg-gray-800 border-t border-gray-700 flex items-center px-4 gap-3">
          {saveStatus === 'saved' && (
            <div className="flex items-center gap-2 text-green-400 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              Saved
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4" />
              Save failed
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={saveGame}
              disabled={saving}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-semibold px-4 py-1.5 rounded text-sm transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => onPlaytest({ ...game, title: gameTitle, description: gameDesc, genre: gameGenre, max_players: gameMaxPlayers } as Game)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-1.5 rounded text-sm transition-colors"
            >
              <Play className="w-4 h-4" />
              Playtest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
