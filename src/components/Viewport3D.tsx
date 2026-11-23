import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  Dimensions3D,
  ElevationColorConfig,
  MAX_ELEVATION_METERS,
  MIN_ELEVATION_METERS,
  MapClickPointInfo,
  WaterLevelConfig,
  computeCameraFit,
  computeClickedMapPointInfo,
  computeWaterPlaneWorldY,
  getZTransformationScale,
  resolveModelElevationBounds,
  roundScale,
  validateModelFileName,
} from '../utils/viewerLogic';
import {
  DEFAULT_MODEL_FILE_NAME,
  applyElevationColorConfigToModel,
  buildDefaultModelGroup,
  cacheModelVertexElevations,
  extractElevationMetadataFromModel,
  prepareModelForCrispViewing,
} from '../utils/proceduralModels';
import { Upload, AlertCircle, X } from 'lucide-react';

export interface Viewport3DProps {
  zScale: number;
  waterConfig: WaterLevelConfig;
  colorConfig: ElevationColorConfig;
  uploadedFile: File | null;
  resetCameraTrigger: number;
  resetModelTrigger: number;
  captureTrigger: number;
  loadedFileName: string;
  clickedPoint: MapClickPointInfo | null;
  onSelectMapPoint: (point: MapClickPointInfo | null) => void;
  onHoverMapPoint: (point: MapClickPointInfo | null) => void;
  onFileDrop: (file: File) => void;
  onLoadStart: (fileName: string) => void;
  onLoadProgress: (progress: number) => void;
  onLoadSuccess: (fileName: string) => void;
  onLoadError: (errorMessage: string) => void;
  onModelElevationBoundsChange?: (minElevation: number, maxElevation: number) => void;
  loadingProgress: number | null;
  errorMessage: string | null;
  onDismissError: () => void;
}

const TEXTURE_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'bumpMap',
  'alphaMap',
  'lightMap',
] as const;

function disposeObject3D(root: THREE.Object3D) {
  const disposedTextures = new Set<THREE.Texture>();
  const disposeTexture = (tex: unknown) => {
    if (tex && typeof (tex as THREE.Texture).dispose === 'function') {
      const texture = tex as THREE.Texture;
      if (!disposedTextures.has(texture)) {
        texture.dispose();
        disposedTextures.add(texture);
      }
    }
  };

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      mats.forEach((m) => {
        if (!m) return;
        const stdMat = m as unknown as Record<string, unknown>;
        for (const slot of TEXTURE_SLOTS) {
          disposeTexture(stdMat[slot]);
        }
        disposeTexture(m.userData?.originalMap);
        disposeTexture(m.userData?.customRampTexture);
        if (m.userData) {
          m.userData.originalMap = null;
          m.userData.customRampTexture = null;
        }
        m.dispose();
      });
    }
  });
}

export const Viewport3D: React.FC<Viewport3DProps> = React.memo(({
  zScale,
  waterConfig,
  colorConfig,
  uploadedFile,
  resetCameraTrigger,
  resetModelTrigger,
  captureTrigger,
  loadedFileName,
  clickedPoint,
  onSelectMapPoint,
  onHoverMapPoint,
  onFileDrop,
  onLoadStart,
  onLoadProgress,
  onLoadSuccess,
  onLoadError,
  onModelElevationBoundsChange,
  loadingProgress,
  errorMessage,
  onDismissError,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const zScaleGroupRef = useRef<THREE.Group | null>(null);
  const modelHolderGroupRef = useRef<THREE.Group | null>(null);
  const clickMarkerGroupRef = useRef<THREE.Group | null>(null);
  const hoverMarkerMeshRef = useRef<THREE.Mesh | null>(null);
  const waterGroupRef = useRef<THREE.Group | null>(null);

  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const ndcRef = useRef<THREE.Vector2>(new THREE.Vector2());

  const modelReliefBoundsRef = useRef<{
    minReliefZ: number;
    maxReliefZ: number;
    baseDimensions: Dimensions3D;
    minElevationMeters: number;
    maxElevationMeters: number;
  }>({
    minReliefZ: 0.22,
    maxReliefZ: 0.94,
    baseDimensions: { x: 2.4, y: 2.4, z: 0.94 },
    minElevationMeters: MIN_ELEVATION_METERS,
    maxElevationMeters: MAX_ELEVATION_METERS,
  });

  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const isPointerDownRef = useRef<boolean>(false);
  const hoverRafRef = useRef<number>(0);
  const pendingHoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastHoverActiveRef = useRef<boolean>(false);

  const defaultCameraPosRef = useRef<THREE.Vector3>(new THREE.Vector3(3.4, 2.6, 3.8));
  const defaultTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.75, 0));
  const requestRenderRef = useRef<() => void>(() => {});
  const activeZScaleRef = useRef<number>(zScale);
  activeZScaleRef.current = zScale;
  const activeWaterConfigRef = useRef<WaterLevelConfig>(waterConfig);
  activeWaterConfigRef.current = waterConfig;
  const activeColorConfigRef = useRef<ElevationColorConfig>(colorConfig);
  activeColorConfigRef.current = colorConfig;
  const loadedFileNameRef = useRef<string>(loadedFileName);
  loadedFileNameRef.current = loadedFileName;

  const callbacksRef = useRef({
    onLoadStart,
    onLoadProgress,
    onLoadSuccess,
    onLoadError,
    onSelectMapPoint,
    onHoverMapPoint,
    onModelElevationBoundsChange,
  });
  callbacksRef.current = {
    onLoadStart,
    onLoadProgress,
    onLoadSuccess,
    onLoadError,
    onSelectMapPoint,
    onHoverMapPoint,
    onModelElevationBoundsChange,
  };

  const clearCurrentModel = (holder: THREE.Group) => {
    while (holder.children.length > 0) {
      const child = holder.children[0];
      holder.remove(child);
      disposeObject3D(child);
    }
  };

  const mountAndFrameModel = (
    rawObject: THREE.Object3D,
    displayName: string,
    currentZScale: number,
    gltfExtraSources: unknown[] = []
  ) => {
    const holder = modelHolderGroupRef.current;
    const zScaleGroup = zScaleGroupRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const renderer = rendererRef.current;
    if (!holder || !zScaleGroup || !camera || !controls) return;

    clearCurrentModel(holder);

    zScaleGroup.scale.set(1, 1, 1);
    zScaleGroup.updateMatrixWorld(true);

    const maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
    const { minY, maxY } = prepareModelForCrispViewing(rawObject, maxAniso);

    rawObject.updateMatrixWorld(true);
    const rawBox = new THREE.Box3().setFromObject(rawObject);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    const rawCenter = rawBox.getCenter(new THREE.Vector3());

    const maxRawDim = Math.max(rawSize.x, rawSize.y, rawSize.z, 0.001);
    const normFactor = 2.4 / maxRawDim;

    const minReliefZ = Math.max(0, (minY - rawBox.min.y) * normFactor);
    const rawMaxReliefZ = (maxY - rawBox.min.y) * normFactor;
    const maxReliefZ =
      rawMaxReliefZ > minReliefZ + 1e-7 ? rawMaxReliefZ : minReliefZ + 1e-4;

    const metadataRange = extractElevationMetadataFromModel(
      rawObject,
      gltfExtraSources
    );
    const resolvedBounds = resolveModelElevationBounds({
      rawSize,
      rawMinY: minY,
      rawMaxY: maxY,
      metadataRange,
    });
    const modelMinElevation = resolvedBounds.minElevation;
    const modelMaxElevation = resolvedBounds.maxElevation;

    callbacksRef.current.onModelElevationBoundsChange?.(
      modelMinElevation,
      modelMaxElevation
    );

    cacheModelVertexElevations({
      rawObject,
      rawBoxMinY: rawBox.min.y,
      normFactor,
      minReliefZ,
      maxReliefZ,
      minElevationMeters: modelMinElevation,
      maxElevationMeters: modelMaxElevation,
    });

    if (activeColorConfigRef.current.enabled) {
      applyElevationColorConfigToModel(rawObject, {
        ...activeColorConfigRef.current,
        domainMin: modelMinElevation,
        domainMax: modelMaxElevation,
        minElevation: modelMinElevation,
        maxElevation: modelMaxElevation,
      });
    }

    const normalizationWrapper = new THREE.Group();
    normalizationWrapper.name = 'Model_Normalization_Group';
    normalizationWrapper.scale.setScalar(normFactor);
    normalizationWrapper.position.set(
      -rawCenter.x * normFactor,
      -rawBox.min.y * normFactor,
      -rawCenter.z * normFactor
    );
    normalizationWrapper.add(rawObject);

    const zSpaceAdapter = new THREE.Group();
    zSpaceAdapter.name = 'Z_Axis_Orientation_Adapter';
    zSpaceAdapter.rotation.x = Math.PI / 2;
    zSpaceAdapter.add(normalizationWrapper);

    holder.add(zSpaceAdapter);

    const baseDimensions: Dimensions3D = {
      x: roundScale(Math.max(rawSize.x * normFactor, 0.01)),
      y: roundScale(Math.max(rawSize.z * normFactor, 0.01)),
      z: roundScale(Math.max(rawSize.y * normFactor, 0.01)),
    };

    modelReliefBoundsRef.current = {
      minReliefZ,
      maxReliefZ,
      baseDimensions,
      minElevationMeters: modelMinElevation,
      maxElevationMeters: modelMaxElevation,
    };

    if (waterGroupRef.current) {
      waterGroupRef.current.scale.set(
        baseDimensions.x * 0.96,
        1,
        baseDimensions.y * 0.96
      );
      if (activeWaterConfigRef.current.enabled) {
        const waterY = computeWaterPlaneWorldY({
          waterLevelMeters: activeWaterConfigRef.current.level,
          minReliefZ,
          maxReliefZ,
          zScale: currentZScale,
          minElevationMeters: modelMinElevation,
          maxElevationMeters: modelMaxElevation,
        });
        waterGroupRef.current.position.set(0, waterY, 0);
        waterGroupRef.current.updateMatrixWorld(true);
      }
    }

    const scaleVec = getZTransformationScale(currentZScale);
    zScaleGroup.scale.set(scaleVec.x, scaleVec.y, scaleVec.z);
    zScaleGroup.updateMatrixWorld(true);

    const fit = computeCameraFit(baseDimensions, camera.fov);

    const camPos = new THREE.Vector3(
      fit.distance * 0.62,
      fit.targetZ + fit.distance * 0.64,
      fit.distance * 0.78
    );
    const targetPos = new THREE.Vector3(0, fit.targetZ * 0.85, 0);

    defaultCameraPosRef.current.copy(camPos);
    defaultTargetRef.current.copy(targetPos);

    camera.near = 0.01;
    camera.far = Math.max(500, fit.far * 4);
    camera.position.copy(camPos);
    camera.updateProjectionMatrix();

    controls.target.copy(targetPos);
    controls.minDistance = Math.max(0.2, fit.distance * 0.1);
    controls.maxDistance = Math.max(50, fit.distance * 10);
    controls.update();

    callbacksRef.current.onLoadSuccess(displayName);
    requestRenderRef.current();
  };

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111827);
    sceneRef.current = scene;

    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 300);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 500);
    camera.position.set(3.2, 2.8, 3.8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const domCanvas = renderer.domElement;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
      requestRender();
    };
    domCanvas.addEventListener('webglcontextlost', handleContextLost);
    domCanvas.addEventListener('webglcontextrestored', handleContextRestored);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x64748b, 0.65);
    hemiLight.position.set(0, 15, 0);
    scene.add(hemiLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.35);
    directionalLight.position.set(5.5, 9.5, 6.0);
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-5.5, 7.0, -5.5);
    scene.add(fillLight);

    const gridHelper = new THREE.GridHelper(10, 20, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = -0.004;
    scene.add(gridHelper);

    const verticalRigGroup = new THREE.Group();
    verticalRigGroup.name = 'Z_Up_Coordinate_Rig';
    verticalRigGroup.rotation.x = -Math.PI / 2;
    scene.add(verticalRigGroup);

    const zScaleGroup = new THREE.Group();
    zScaleGroup.name = 'Z_Axis_Exaggeration_Transform_Group';
    verticalRigGroup.add(zScaleGroup);
    zScaleGroupRef.current = zScaleGroup;

    const modelHolder = new THREE.Group();
    modelHolder.name = 'Original_Model_Holder';
    zScaleGroup.add(modelHolder);
    modelHolderGroupRef.current = modelHolder;

    // 3D Water Level / Flood Simulation Plane
    const waterGroup = new THREE.Group();
    waterGroup.name = 'Water_Flood_Simulation_Plane';
    waterGroup.visible = false;

    const waterSurfaceGeo = new THREE.PlaneGeometry(1, 1);
    waterSurfaceGeo.rotateX(-Math.PI / 2);
    const waterSurfaceMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.22,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const waterMesh = new THREE.Mesh(waterSurfaceGeo, waterSurfaceMat);
    waterGroup.add(waterMesh);

    const borderEdges = new THREE.EdgesGeometry(waterSurfaceGeo);
    const borderMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });
    const waterBorder = new THREE.LineSegments(borderEdges, borderMat);
    waterGroup.add(waterBorder);

    scene.add(waterGroup);
    waterGroupRef.current = waterGroup;

    // Subtle 3D Hover Cursor Ring
    const hoverRingGeo = new THREE.RingGeometry(0.028, 0.046, 24);
    hoverRingGeo.rotateX(-Math.PI / 2);
    hoverRingGeo.translate(0, 0.005, 0);
    const hoverRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
    });
    const hoverMesh = new THREE.Mesh(hoverRingGeo, hoverRingMat);
    hoverMesh.name = 'Hover_Cursor_Ring';
    hoverMesh.visible = false;
    scene.add(hoverMesh);
    hoverMarkerMeshRef.current = hoverMesh;

    // 3D Survey Pin Marker for Clicked Map Location
    const markerGroup = new THREE.Group();
    markerGroup.name = 'Clicked_Map_Point_Marker';
    markerGroup.visible = false;

    const ringGeo = new THREE.RingGeometry(0.035, 0.062, 28);
    ringGeo.rotateX(-Math.PI / 2);
    ringGeo.translate(0, 0.004, 0);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
    });
    markerGroup.add(new THREE.Mesh(ringGeo, ringMat));

    const stemGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.24, 12);
    stemGeo.translate(0, 0.12, 0);
    const stemMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    markerGroup.add(new THREE.Mesh(stemGeo, stemMat));

    const headGeo = new THREE.SphereGeometry(0.038, 16, 16);
    headGeo.translate(0, 0.25, 0);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    markerGroup.add(new THREE.Mesh(headGeo, headMat));

    scene.add(markerGroup);
    clickMarkerGroupRef.current = markerGroup;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.target.set(0, 0.75, 0);
    controlsRef.current = controls;

    let rafId = 0;
    let timeoutId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let isUpdatingControls = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        timeoutId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          timeoutId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          timeoutId = window.setTimeout(cb, 80);
        }
      };
      timeoutId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (isUpdatingControls) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      rafId = requestAnimationFrame(() => {
        renderDirty = false;
        isUpdatingControls = true;
        const didDampMove = controls.update();
        isUpdatingControls = false;
        if (controls.enableDamping && didDampMove) {
          renderDirty = true;
        }
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    requestRenderRef.current = requestRender;
    controls.addEventListener('change', requestRender);

    let lastW = width;
    let lastH = height;
    const handleResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 200);
      const h = Math.max(container.clientHeight, 200);
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = 0;
      pendingHoverPosRef.current = null;
      clearTimeout(timeoutId);
      requestRenderRef.current = () => {};
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      domCanvas.removeEventListener('webglcontextlost', handleContextLost);
      domCanvas.removeEventListener('webglcontextrestored', handleContextRestored);
      clearCurrentModel(modelHolder);
      disposeObject3D(gridHelper);
      disposeObject3D(waterGroup);
      disposeObject3D(hoverMesh);
      disposeObject3D(markerGroup);
      renderer.dispose();
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      zScaleGroupRef.current = null;
      modelHolderGroupRef.current = null;
      clickMarkerGroupRef.current = null;
      hoverMarkerMeshRef.current = null;
      waterGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (uploadedFile) return;
    callbacksRef.current.onLoadStart(DEFAULT_MODEL_FILE_NAME);
    const sampleGroup = buildDefaultModelGroup();
    mountAndFrameModel(sampleGroup, DEFAULT_MODEL_FILE_NAME, activeZScaleRef.current);
  }, [uploadedFile, resetModelTrigger]);

  useEffect(() => {
    if (!uploadedFile) return;

    const validation = validateModelFileName(uploadedFile.name);
    if (!validation.valid) {
      callbacksRef.current.onLoadError(
        validation.error || 'Unsupported 3D model file format.'
      );
      return;
    }

    let isCancelled = false;
    const objectUrl = URL.createObjectURL(uploadedFile);
    callbacksRef.current.onLoadStart(uploadedFile.name);
    callbacksRef.current.onLoadProgress(5);

    const loader = new GLTFLoader();
    loader.load(
      objectUrl,
      (gltf) => {
        URL.revokeObjectURL(objectUrl);
        if (isCancelled) return;
        if (!gltf || !gltf.scene) {
          callbacksRef.current.onLoadError(
            `Unable to parse 3D scene graph from "${uploadedFile.name}".`
          );
          return;
        }
        callbacksRef.current.onLoadProgress(100);
        mountAndFrameModel(gltf.scene, uploadedFile.name, activeZScaleRef.current, [
          gltf.asset?.extras,
          gltf.userData,
        ]);
      },
      (event) => {
        if (isCancelled) return;
        if (event.lengthComputable && event.total > 0) {
          const pct = Math.min(99, Math.round((event.loaded / event.total) * 100));
          callbacksRef.current.onLoadProgress(pct);
        } else {
          callbacksRef.current.onLoadProgress(50);
        }
      },
      (err) => {
        URL.revokeObjectURL(objectUrl);
        if (isCancelled) return;
        const detail =
          err instanceof Error ? err.message : 'Corrupted or invalid glTF/GLB data';
        callbacksRef.current.onLoadError(
          `Failed to load "${uploadedFile.name}": ${detail}.`
        );
      }
    );

    return () => {
      isCancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [uploadedFile]);

  // Update 3D Survey Pin Marker position
  useEffect(() => {
    const marker = clickMarkerGroupRef.current;
    if (!marker) return;
    if (!clickedPoint) {
      marker.visible = false;
      requestRenderRef.current();
      return;
    }
    marker.visible = true;
    marker.position.set(
      clickedPoint.x,
      clickedPoint.baseZ * zScale,
      clickedPoint.y
    );
    marker.updateMatrixWorld(true);
    requestRenderRef.current();
  }, [clickedPoint, zScale]);

  // Update 3D Water Level Plane visibility & height
  useEffect(() => {
    const waterGroup = waterGroupRef.current;
    if (!waterGroup) return;

    if (!waterConfig.enabled) {
      waterGroup.visible = false;
      requestRenderRef.current();
      return;
    }

    const {
      minReliefZ,
      maxReliefZ,
      baseDimensions,
      minElevationMeters,
      maxElevationMeters,
    } = modelReliefBoundsRef.current;
    const waterY = computeWaterPlaneWorldY({
      waterLevelMeters: waterConfig.level,
      minReliefZ,
      maxReliefZ,
      zScale,
      minElevationMeters,
      maxElevationMeters,
    });

    waterGroup.visible = true;
    waterGroup.scale.set(
      baseDimensions.x * 0.96,
      1,
      baseDimensions.y * 0.96
    );
    waterGroup.position.set(0, waterY, 0);
    waterGroup.updateMatrixWorld(true);
    requestRenderRef.current();
  }, [waterConfig, zScale]);

  // Update Z-Axis Exaggeration scale
  useEffect(() => {
    const zScaleGroup = zScaleGroupRef.current;
    if (!zScaleGroup) return;
    const scaleVec = getZTransformationScale(zScale);
    zScaleGroup.scale.set(scaleVec.x, scaleVec.y, scaleVec.z);
    zScaleGroup.updateMatrixWorld(true);
    requestRenderRef.current();
  }, [zScale]);

  // Update Custom Elevation Color Mapping in real time
  useEffect(() => {
    const holder = modelHolderGroupRef.current;
    if (!holder || holder.children.length === 0) return;
    applyElevationColorConfigToModel(holder, colorConfig);
    requestRenderRef.current();
  }, [colorConfig]);

  // High-Resolution Screenshot Capture
  useEffect(() => {
    if (captureTrigger === 0) return;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;

    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');
    const cleanBase = loadedFileNameRef.current.replace(/\.(glb|gltf)$/i, '');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${cleanBase}-capture.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [captureTrigger]);

  // Reset Camera
  useEffect(() => {
    if (resetCameraTrigger === 0) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const zScaleGroup = zScaleGroupRef.current;
    if (!camera || !controls) return;

    if (zScaleGroup) {
      zScaleGroup.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(zScaleGroup);
      const size = box.getSize(new THREE.Vector3());
      if (size.lengthSq() > 0.0001) {
        const fit = computeCameraFit(
          { x: size.x, y: size.z, z: size.y },
          camera.fov
        );
        camera.position.set(
          fit.distance * 0.62,
          fit.targetZ + fit.distance * 0.64,
          fit.distance * 0.78
        );
        controls.target.set(0, fit.targetZ * 0.85, 0);
      } else {
        camera.position.copy(defaultCameraPosRef.current);
        controls.target.copy(defaultTargetRef.current);
      }
    } else {
      camera.position.copy(defaultCameraPosRef.current);
      controls.target.copy(defaultTargetRef.current);
    }

    camera.updateProjectionMatrix();
    controls.update();
    requestRenderRef.current();
  }, [resetCameraTrigger]);

  // Shared helper to raycast against the 3D model surface at client (x, y)
  const raycastSurfaceAtClientPos = (
    clientX: number,
    clientY: number
  ): MapClickPointInfo | null => {
    const container = canvasMountRef.current;
    const camera = cameraRef.current;
    const holder = modelHolderGroupRef.current;
    const zScaleGroup = zScaleGroupRef.current;
    if (!container || !camera || !holder || !zScaleGroup) return null;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    ndcRef.current.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    zScaleGroup.updateMatrixWorld(false);
    raycasterRef.current.setFromCamera(ndcRef.current, camera);

    const hits = raycasterRef.current.intersectObjects(holder.children, true);
    if (hits.length === 0) return null;

    const surfaceHit =
      hits.find((h) => h.object.userData?.isElevationSurface) || hits[0];

    const {
      minReliefZ,
      maxReliefZ,
      baseDimensions,
      minElevationMeters,
      maxElevationMeters,
    } = modelReliefBoundsRef.current;
    return computeClickedMapPointInfo({
      worldX: surfaceHit.point.x,
      worldHorizontalZ: surfaceHit.point.z,
      worldVerticalY: surfaceHit.point.y,
      zScale: activeZScaleRef.current,
      baseDimensions,
      minReliefZ,
      maxReliefZ,
      minElevationMeters,
      maxElevationMeters,
    });
  };

  const cancelPendingHover = () => {
    if (hoverRafRef.current) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = 0;
    }
    pendingHoverPosRef.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    cancelPendingHover();
    if (e.button === 0) {
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    }
    isPointerDownRef.current = true;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPointerDownRef.current) return;
    pendingHoverPosRef.current = { x: e.clientX, y: e.clientY };
    if (hoverRafRef.current) return;

    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = 0;
      const pos = pendingHoverPosRef.current;
      pendingHoverPosRef.current = null;
      if (!pos || isPointerDownRef.current) return;

      const pointInfo = raycastSurfaceAtClientPos(pos.x, pos.y);
      const hoverMesh = hoverMarkerMeshRef.current;

      if (pointInfo) {
        if (hoverMesh) {
          hoverMesh.visible = true;
          hoverMesh.position.set(pointInfo.x, pointInfo.scaledZ, pointInfo.y);
          hoverMesh.updateMatrixWorld(true);
          requestRenderRef.current();
        }
        lastHoverActiveRef.current = true;
        callbacksRef.current.onHoverMapPoint(pointInfo);
      } else {
        if (hoverMesh && hoverMesh.visible) {
          hoverMesh.visible = false;
          requestRenderRef.current();
        }
        if (lastHoverActiveRef.current) {
          lastHoverActiveRef.current = false;
          callbacksRef.current.onHoverMapPoint(null);
        }
      }
    });
  };

  const handlePointerLeave = () => {
    cancelPendingHover();
    isPointerDownRef.current = false;
    const hoverMesh = hoverMarkerMeshRef.current;
    if (hoverMesh && hoverMesh.visible) {
      hoverMesh.visible = false;
      requestRenderRef.current();
    }
    if (lastHoverActiveRef.current) {
      lastHoverActiveRef.current = false;
      callbacksRef.current.onHoverMapPoint(null);
    }
  };

  const handlePointerCancel = () => {
    cancelPendingHover();
    isPointerDownRef.current = false;
    pointerDownPosRef.current = null;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isPointerDownRef.current = false;
    if (e.button !== 0 || !pointerDownPosRef.current) return;
    const dx = e.clientX - pointerDownPosRef.current.x;
    const dy = e.clientY - pointerDownPosRef.current.y;
    pointerDownPosRef.current = null;

    if (Math.hypot(dx, dy) > 6) return;

    const pointInfo = raycastSurfaceAtClientPos(e.clientX, e.clientY);
    if (pointInfo) {
      callbacksRef.current.onSelectMapPoint(pointInfo);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      onFileDrop(files[0]);
    }
  };

  const scaleVec = getZTransformationScale(zScale);

  return (
    <div
      className="relative flex-1 h-full w-full bg-[#111827] overflow-hidden select-none"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="viewport-3d-container"
      data-scale-x={scaleVec.x}
      data-scale-y={scaleVec.y}
      data-scale-z={scaleVec.z}
    >
      <div
        ref={canvasMountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerCancel}
        onPointerUp={handlePointerUp}
        data-testid="webgl-canvas-mount"
        className="w-full h-full cursor-crosshair active:cursor-grabbing"
        aria-label="Interactive 3D Model Viewport"
      />

      {loadingProgress !== null && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80"
        >
          <div className="w-64 rounded-xl bg-slate-900 border border-slate-800 p-4 shadow-xl text-center">
            <div className="text-xs font-semibold text-slate-100 mb-2">
              Loading 3D Model ({loadingProgress}%)
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-400 transition-all duration-150"
                style={{ width: `${Math.max(5, loadingProgress)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          data-testid="model-error-banner"
          className="absolute top-3.5 left-3.5 right-3.5 max-w-lg z-20 flex items-start gap-2.5 rounded-xl bg-rose-950/95 border border-rose-700/80 px-3.5 py-2.5 text-rose-100 shadow-lg"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">{errorMessage}</div>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss error message"
            className="p-0.5 rounded text-rose-300 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isDraggingOver && (
        <div className="pointer-events-none absolute inset-3 z-30 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-sky-400 bg-slate-900/85 text-center p-6">
          <Upload className="w-8 h-8 text-sky-400 mb-2" />
          <p className="text-sm font-semibold text-slate-100">
            Drop .glb or .gltf 3D Model Here
          </p>
        </div>
      )}

      {contextLost && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/90 p-6 text-center">
          <p className="text-xs font-semibold text-slate-200">
            Restoring WebGL Context...
          </p>
        </div>
      )}
    </div>
  );
});
