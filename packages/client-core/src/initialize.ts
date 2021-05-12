import { detect, detectOS } from 'detect-browser';
import { BufferGeometry, Mesh, PerspectiveCamera, Scene } from 'three';
import { acceleratedRaycast, computeBoundsTree } from "three-mesh-bvh";
import { CameraSystem } from '@xrengine/engine/src/camera/systems/CameraSystem';
import { CharacterControllerSystem } from '@xrengine/engine/src/character/CharacterControllerSystem';
import { isMobileOrTablet } from '@xrengine/engine/src/common/functions/isMobile';
import { Timer } from '@xrengine/engine/src/common/functions/Timer';
import { DebugHelpersSystem } from '@xrengine/engine/src/debug/systems/DebugHelpersSystem';
import { Engine } from '@xrengine/engine/src/ecs/classes/Engine';
import { EngineEvents, proxyEngineEvents } from '@xrengine/engine/src/ecs/classes/EngineEvents';
import { execute } from "@xrengine/engine/src/ecs/functions/EngineFunctions";
import { registerSystem } from '@xrengine/engine/src/ecs/functions/SystemFunctions';
import { SystemUpdateType } from "@xrengine/engine/src/ecs/functions/SystemUpdateType";
import { ActionSystem } from '@xrengine/engine/src/input/systems/ActionSystem';
import { ClientInputSystem } from '@xrengine/engine/src/input/systems/ClientInputSystem';
import { InteractiveSystem } from "@xrengine/engine/src/interaction/systems/InteractiveSystem";
import { Network } from '@xrengine/engine/src/networking/classes/Network';
import { ClientNetworkSystem } from '@xrengine/engine/src/networking/systems/ClientNetworkSystem';
import { MediaStreamSystem } from '@xrengine/engine/src/networking/systems/MediaStreamSystem';
import { ParticleSystem } from '@xrengine/engine/src/particles/systems/ParticleSystem';
import { PhysicsSystem } from '@xrengine/engine/src/physics/systems/PhysicsSystem';
import { HighlightSystem } from '@xrengine/engine/src/renderer/HighlightSystem';
import { WebGLRendererSystem } from '@xrengine/engine/src/renderer/WebGLRendererSystem';
import { ServerSpawnSystem } from '@xrengine/engine/src/scene/systems/ServerSpawnSystem';
import { AnimationManager } from "@xrengine/engine/src/character/AnimationManager";
import { TransformSystem } from '@xrengine/engine/src/transform/systems/TransformSystem';
import { createWorker, WorkerProxy } from '@xrengine/engine/src/worker/MessageQueue';
import { XRSystem } from '@xrengine/engine/src/xr/systems/XRSystem';
import { PhysXInstance } from "three-physx";
//@ts-ignore
import OffscreenWorker from './initializeOffscreen.ts?worker';
import { GameManagerSystem } from '@xrengine/engine/src/game/systems/GameManagerSystem';
import { DefaultInitializationOptions, InitializeOptions } from '@xrengine/engine/src/DefaultInitializationOptions';
import _ from 'lodash';
import { ClientNetworkStateSystem } from '@xrengine/engine/src/networking/systems/ClientNetworkStateSystem';
import { now } from '@xrengine/engine/src/common/functions/now';
import { loadScene } from '@xrengine/engine/src/scene/functions/SceneLoading';
import { UIPanelSystem } from '@xrengine/engine/src/ui/systems/UIPanelSystem';

// import { PositionalAudioSystem } from './audio/systems/PositionalAudioSystem';

Mesh.prototype.raycast = acceleratedRaycast;
BufferGeometry.prototype["computeBoundsTree"] = computeBoundsTree;

const browser = detect();
const os = detectOS(navigator.userAgent);
if (typeof window !== 'undefined') {
  // Add iOS and safari flag to window object -- To use it for creating an iOS compatible WebGLRenderer for example
  (window as any).iOS = os === 'iOS' || /iPad|iPhone|iPod/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  (window as any).safariWebBrowser = browser?.name === 'safari';
}

/**
 *
 * @author Shaw Walters and Josh Field
 * @param initOptions
 */

export const initializeEngine = async (initOptions: InitializeOptions): Promise<void> => {
  const options = _.defaultsDeep({}, initOptions, DefaultInitializationOptions);

  const canvas = options.renderer && options.renderer.canvas ? options.renderer.canvas : null;

  Engine.gameMode = options.gameMode;

  const { useCanvas, postProcessing, useOfflineMode } = options;

  Engine.offlineMode = useOfflineMode;

  Engine.xrSupported = await (navigator as any).xr?.isSessionSupported('immersive-vr');

  // TODO: pipe network & entity data to main thread
  // const useOffscreen = useCanvas && !Engine.xrSupported && 'transferControlToOffscreen' in canvas;
  const useOffscreen = false;
  if (!options.renderer) options.renderer = {};

  if (useOffscreen) {
    const workerProxy: WorkerProxy = await createWorker(
      new OffscreenWorker(),
      (canvas),
      {
        postProcessing,
        useOfflineMode
      }
    );
    proxyEngineEvents(workerProxy);
    Engine.viewportElement = options.renderer.canvas;

  } else {
    Engine.scene = new Scene();
    EngineEvents.instance.once(EngineEvents.EVENTS.LOAD_SCENE, ({ sceneData }) => { loadScene(sceneData); });
    EngineEvents.instance.once(EngineEvents.EVENTS.JOINED_WORLD, () => {
      EngineEvents.instance.dispatchEvent({ type: EngineEvents.EVENTS.ENABLE_SCENE, enable: true });
    });
  }

  Engine.publicPath = options.publicPath;

  if (options.networking) {
    const networkSystemOptions = { schema: options.networking.schema, app: options.networking.app };
    // console.log("Network system options are", networkSystemOptions);
    // console.log("Network system schema is", networkSystemOptions.schema);
    Network.instance = new Network();

    Network.instance.schema = networkSystemOptions.schema;
    if (!useOfflineMode) {
      registerSystem(ClientNetworkSystem, { ...networkSystemOptions, priority: -1 });
    }
    registerSystem(MediaStreamSystem);
  }

  Engine.lastTime = now() / 1000;

  if(useCanvas) {
    if (options.input) {
      registerSystem(ClientInputSystem, { useWebXR: Engine.xrSupported });
    }

    if (!useOffscreen) {

      Engine.camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
      Engine.scene.add(Engine.camera);

      new AnimationManager();

      // promise in parallel to speed things up
      await Promise.all([
        AnimationManager.instance.getDefaultModel(),
        AnimationManager.instance.getAnimations(),
        new Promise<void>(async (resolve) => {
          /** @todo fix bundling */
          // if((window as any).safariWebBrowser) {
            const worker = new Worker('/scripts/loadPhysXClassic.js');
            Engine.workers.push(worker);
            await PhysXInstance.instance.initPhysX(worker);
          // } else {
          //   //@ts-ignore
          //   const { default: PhysXWorker } = await import('./physics/functions/loadPhysX.ts?worker&inline');
          //   await PhysXInstance.instance.initPhysX(new PhysXWorker(), { });
          // }
          resolve();
        })
      ]);

      registerSystem(ClientNetworkStateSystem);
      registerSystem(CharacterControllerSystem);
      registerSystem(HighlightSystem);
      registerSystem(ActionSystem);

      registerSystem(PhysicsSystem);
      registerSystem(TransformSystem, { priority: 900 });
      // audio breaks webxr currently
      // Engine.audioListener = new AudioListener();
      // Engine.camera.add(Engine.audioListener);
      // registerSystem(PositionalAudioSystem);
      registerSystem(ParticleSystem);
      registerSystem(DebugHelpersSystem);
      registerSystem(InteractiveSystem);
      registerSystem(CameraSystem);
      registerSystem(WebGLRendererSystem, { priority: 1001, canvas, postProcessing });
      registerSystem(XRSystem);
      registerSystem(GameManagerSystem);
      registerSystem(UIPanelSystem);

      Engine.viewportElement = Engine.renderer.domElement;
      Engine.renderer.xr.enabled = Engine.xrSupported;
    }
  }

  await Promise.all(Engine.systems.map((system) => { 
    return new Promise<void>(async (resolve) => { await system.initialize(); system.initialized = true; resolve(); }); 
  }));

  Engine.engineTimer = Timer({
    networkUpdate: (delta: number, elapsedTime: number) => execute(delta, elapsedTime, SystemUpdateType.Network),
    fixedUpdate: (delta: number, elapsedTime: number) => execute(delta, elapsedTime, SystemUpdateType.Fixed),
    update: (delta, elapsedTime) => execute(delta, elapsedTime, SystemUpdateType.Free)
  }, Engine.physicsFrameRate, Engine.networkFramerate).start();

  const engageType = isMobileOrTablet() ? 'touchstart' : 'click';
  const onUserEngage = () => {
    EngineEvents.instance.dispatchEvent({ type: EngineEvents.EVENTS.USER_ENGAGE });
    document.removeEventListener(engageType, onUserEngage);
  };
  document.addEventListener(engageType, onUserEngage);

  EngineEvents.instance.once(ClientNetworkSystem.EVENTS.CONNECT, ({ id }) => {
    Network.instance.isInitialized = true;
    Network.instance.userId = id;
  });

  Engine.isInitialized = true;
};


export const initializeEditor = async (initOptions: InitializeOptions): Promise<void> => {
  const options = _.defaultsDeep({}, initOptions, DefaultInitializationOptions);

  Engine.scene = new Scene();

  Engine.gameMode = initOptions.gameMode;
  Engine.publicPath = options.publicPath;

  Engine.lastTime = now() / 1000;

  Engine.camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
  Engine.scene.add(Engine.camera);

  // if((window as any).safariWebBrowser) {
    const worker = new Worker('/scripts/loadPhysXClassic.js');
    Engine.workers.push(worker);
    await PhysXInstance.instance.initPhysX(worker);
  // } else {
  //   //@ts-ignore
  //   const { default: PhysXWorker } = await import('./physics/functions/loadPhysX.ts?worker');
  //   await PhysXInstance.instance.initPhysX(new PhysXWorker(), { });
  // }

  registerSystem(PhysicsSystem);
  registerSystem(TransformSystem, { priority: 900 });
  registerSystem(ParticleSystem);
  registerSystem(DebugHelpersSystem);
  registerSystem(GameManagerSystem);

  await Promise.all(Engine.systems.map((system) => { 
    return new Promise<void>(async (resolve) => { await system.initialize(); system.initialized = true; resolve(); }); 
  }));

  Engine.engineTimer = Timer({
    networkUpdate: (delta: number, elapsedTime: number) => execute(delta, elapsedTime, SystemUpdateType.Network),
    fixedUpdate: (delta: number, elapsedTime: number) => execute(delta, elapsedTime, SystemUpdateType.Fixed),
    update: (delta, elapsedTime) => execute(delta, elapsedTime, SystemUpdateType.Free)
  }, Engine.physicsFrameRate, Engine.networkFramerate).start();

  Engine.isInitialized = true;
};