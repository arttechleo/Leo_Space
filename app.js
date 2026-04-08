console.log('%c spatialme.xyz ', 'background:#1d1d1f;color:#f5f5f7;font-size:14px;font-weight:600;padding:4px 8px;border-radius:4px;');
console.log('%c vibecoded with \u2736 ChatGPT  \u2736 Cursor  \u2736 Claude Code ', 'color:#6e6e73;font-size:11px;letter-spacing:0.08em;');
console.log('%c Leo Danenkov \u00b7 spatialme.xyz \u00b7 ledanenkov@gmail.com ', 'color:#0066cc;font-size:11px;');

let sceneInstance = null;

// Mobile viewport-height fix for better 100vh handling (address bar on mobile)
(() => {
    if (typeof window === 'undefined') return;
    if (window.__vhFixInstalled) return;
    window.__vhFixInstalled = true;

    function setVH() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    setVH();
    window.addEventListener('resize', setVH, { passive: true });
})();

class MultiVideoScene {
    constructor() {
        if (sceneInstance) {
            return sceneInstance;
        }

        sceneInstance = this;

        // Configuration constants
        this.CONFIG = {
            CAMERA_FOV: 52,
            CAMERA_NEAR: 0.1,
            CAMERA_FAR: 100,
            MODEL_POSITION: new THREE.Vector3(0, 0, 0.8),
            MODEL_ROTATION: new THREE.Euler(0, 0, 0),
            OVERVIEW_CAMERA_POSITION: new THREE.Vector3(0, 1.5, 12),
            OVERVIEW_LOOK_AT: new THREE.Vector3(0, 1.5, 0)
        };

        // Core components setup
        this.scene = new THREE.Scene();
        this.scene.background = null;
        const initialSize = MultiVideoScene.getCanvasContainerSize();
        const aspect =
            initialSize.width > 0 && initialSize.height > 0
                ? initialSize.width / initialSize.height
                : window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(
            this.CONFIG.CAMERA_FOV,
            aspect,
            this.CONFIG.CAMERA_NEAR,
            this.CONFIG.CAMERA_FAR
        );

        // Resource tracking
        this.disposables = new Set();

        // Raycasting setup
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredScreen = null;
        this.mouseMovedThisFrame = false;

        // Resource maps
        this.videos = new Map();
        this.videoTextures = new Map();
        this.videoMaterials = new Map();
        this.projectInfo = new Map();
        this.screenMeshes = [];

        // State
        this.playing = false;
        this.disposed = false;
        /** When true, handleResize only updates renderer size / aspect (scroll zoom owns camera). */
        this._zoomAnimating = false;
        /** 'overview' or a numeric project index (0–11). Tracks the logical camera destination
         *  so handleResize can restore the correct view after a mobile address-bar resize. */
        this._currentZoomState = 'overview';
        this._modelArriveRaf = null;

        // Initialize components
        this.setupRenderer();
        this.setupLighting();
        this.setupVideos();
        this.setupLoaders();
        this.bindEvents();
    }

    static getCanvasContainerSize() {
        const container =
            document.getElementById('canvas-container') ??
            document.getElementById('canvas-overlay');
        const w = container?.offsetWidth || window.innerWidth;
        const h = container?.offsetHeight || window.innerHeight;
        return { width: w, height: h };
    }

    setupRenderer() {
        const container = document.getElementById('canvas-container');
        let canvas = document.getElementById('three-canvas');
        if (!canvas && container) {
            canvas = document.createElement('canvas');
            canvas.id = 'three-canvas';
            canvas.style.cursor = 'pointer';
            container.appendChild(canvas);
        }
        if (!canvas) {
            console.error('canvas-container or three-canvas missing');
            return;
        }
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });

        // Make renderer background transparent so canvas doesn't add its own "white box"
        this.renderer.setClearColor(0x000000, 0);

        const el = this.renderer.domElement;
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.display = 'block';

        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        // Remove this line as we're using existing canvas
        // document.body.appendChild(this.renderer.domElement);
        this.disposables.add(this.renderer);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const container =
                    document.getElementById('canvas-container') ??
                    document.getElementById('canvas-overlay');
                const w = container?.offsetWidth || window.innerWidth;
                const h = container?.offsetHeight || window.innerHeight;
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                this.renderer.setSize(w, h, false);
                this.camera.aspect = w / h;
                this.camera.fov = this.CONFIG.CAMERA_FOV;
                this.camera.updateProjectionMatrix();
                if (this.model) {
                    this.fitCameraToScene();
                    this.applyOverviewCameraOverride();
                }
            });
        });
    }

    /**
     * Frame the GLTF model from its bounding box.
     */
    fitCameraToScene() {
        if (!this.model) return;

        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        if (!maxDim || !isFinite(maxDim)) return;

        const fov = this.camera.fov * (Math.PI / 180);
        let cameraDistance = (maxDim / 2) / Math.tan(fov / 2);

        cameraDistance *= 1.4;
        if (!isFinite(cameraDistance) || cameraDistance <= 0) return;

        this.camera.position.set(center.x, center.y, center.z + cameraDistance);
        this.camera.lookAt(center);
        this.camera.near = cameraDistance / 100;
        this.camera.far = cameraDistance * 100;
        this.camera.updateProjectionMatrix();

        this._sceneCenter = center.clone();
        this._cameraDistance = cameraDistance;
    }

    /**
     * Index overview framing: full pyramid in canvas zone (overrides bbox fit).
     */
    applyOverviewCameraOverride() {
        if (!this.model) return;
        const cfg = this.CONFIG;
        this.camera.fov = cfg.CAMERA_FOV;
        this.camera.position.copy(cfg.OVERVIEW_CAMERA_POSITION);
        this.camera.lookAt(cfg.OVERVIEW_LOOK_AT);
        this.camera.near = cfg.CAMERA_NEAR;
        this.camera.far = cfg.CAMERA_FAR;
        this.camera.updateProjectionMatrix();
        this._sceneCenter = cfg.OVERVIEW_LOOK_AT.clone();
        this._cameraDistance = this.camera.position.distanceTo(this._sceneCenter);
    }

    setupLighting() {
        // Cool white with slight blue tint
        const coldWhite = 0xE1E6FF;
        
        // Ambient light - keep as is, but slightly lower intensity for more contrast
        const ambientLight = new THREE.AmbientLight(coldWhite, 0.55);
        
        // Main directional light - adjust position for better angle
        const directionalLight = new THREE.DirectionalLight(coldWhite, 0.9);
        // Position more from front-right-top for better definition
        directionalLight.position.set(4, 6, 8);
        directionalLight.castShadow = true;
        
        // Improve shadow quality if needed
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        
        // Rim light - reposition for better edge highlighting
        const rimLight = new THREE.DirectionalLight(0x6699FF, 0.4);
        rimLight.position.set(-6, 2, -4);
        
        // Add a subtle fill light from opposite side
        const fillLight = new THREE.DirectionalLight(coldWhite, 0.3);
        fillLight.position.set(-3, 1, 6);
        
        this.scene.add(ambientLight, directionalLight, rimLight, fillLight);
        this.disposables.add(ambientLight);
        this.disposables.add(directionalLight);
        this.disposables.add(rimLight);
        this.disposables.add(fillLight);
    }

    setupVideos() {
        const videoSources = [
            {
                id: 'screen1',
                src: './videos/ScholarlyVRDemo.mp4',
                title: "Scholarly VR",
                about: "Ever wished academic papers were less… paper-y? Scholarly VR lets professors and students step inside research itself, turning dense concepts into immersive 3D experiences. Because if knowledge is power, why not make it feel like a superpower?",
                url: "./project10.html"
            },
            {
                id: 'screen2',
                src: './videos/5CEOMoleculeDemoWebXR.mp4',
                title: "Molecules WebXR",
                about: "Science just got a glow-up. This WebXR demo brings molecular structures to life in a 3D space, making chemistry feel less like a textbook headache and more like a futuristic science fair where you can poke atoms for fun.",
                url: "./project3.html"
            },
            {
                id: 'screen3',
                src: './videos/Piano_Train_Installation.mp4',
                title: "Piano Bar - Cybernetics and Human Knowing",
                about: "A game, an AI, and a piano walk into a bar... and only one of them never loses. This interactive installation features a massive wall projection, an 88-key piano as a controller, and an AI that's out to prove humans are overrated at playing with colors. Are you up for the challenge? (Spoiler: the AI thinks you're not.)",
                url: "./project11.html"
            },
            {
                id: 'screen4',
                src: './videos/WizardofOzVRSoundscapeProject.mp4',
                title: "4'33'' - Soundscapes in VR",
                about: "What if silence wasn't empty but full of hidden stories? Inspired by John Cage's 4'33'', this VR experience lets you explore soundscapes from everyday life—your apartment, your city, maybe even the weird noise your fridge makes at night. It's a concert, but the world is the composer.",
                url: "./project8.html"
            },
            {
                id: 'screen5',
                src: './videos/MemoryGameXR.mp4',
                title: "Memory Game WebXR",
                about: "A Mixed Reality memory game that turns brain training into an interactive adventure. Designed for caregiving facilities, this game uses hand-tracking and point-and-click mechanics to flip cards, find matches, and prove that your memory is sharper than you think (or at least sharper than the AI's).",
                url: "./project12.html"
            },
            {
                id: 'screen6',
                src: './videos/Structural Color Gallery Experience Recording.mp4',
                title: "SCG - Archival 3D Website",
                about: "An art exhibition you don't have to leave your house for. This Web3D experience transports you into a 3D-scanned gallery, letting you explore artist Megumi Nagai's work as if you were there—minus the risk of knocking over a sculpture.",
                url: "./project2.html"
            },
            {
                id: 'screen7',
                src: './videos/mrjs - from web to spatial web.mp4',
                title: "mr.js - WebXR three.js library",
                about: "Building for the web is cool. Building for the immersive web is cooler. mr.js is an open-source WebXR library that helps designers and developers bring Mixed Reality to the browser—because why settle for flat when you can build inside the web?",
                url: "./project5.html"
            },
            {
                id: 'screen8',
                src: './videos/Invisible_Labor.mp4',
                title: "Invisible Labour MR",
                about: "Ever feel like no one sees all the work you do? This Mixed Reality experience dives into the hidden struggles of labor and self-advocacy, giving voice (and visuals) to the effort we put in behind the scenes. Spoiler alert: hard work deserves to be noticed, even in MR.",
                url: "./project7.html"
            },
            {
                id: 'screen9',
                src: './videos/GGJ-21_ Blown Away (Gameplay).mp4',
                title: "Blown Away VR",
                about: "Ever wanted to move through VR using just your breath? This experimental game lets you explore digital worlds by controlling airflow—kind of like a virtual meditation session, but with way more floating. Just don't hyperventilate.",
                url: "./project4.html"
            },
            {
                id: 'screen10',
                src: './videos/IWanderedLonelyasaCloud_by WilliamWordsworth.mp4',
                title: "Classical Poem in Mixed and Virtual Reality",
                about: "Wordsworth's I Wandered Lonely as a Cloud reimagined for the immersive age. With interactive scrolling and AI-generated skyboxes, this project brings poetry off the page and into a dreamlike Mixed and Virtual Reality world. It's literature, but make it sci-fi.",
                url: "./project6.html"
            },
            {
                id: 'screen11',
                src: './videos/Talegraph Trailer.mp4',
                title: "Futuristic Metaverse Trailer - 2018",
                about: "Back in 2018, we asked: what if freelancing happened inside the metaverse? This concept trailer imagined a future where we complete tasks in VR, collaborate in digital spaces, and somehow still have too many Zoom meetings. A glimpse into the future of remote work—before it was cool.",
                url: "./project9.html"
            },
            {
                id: 'screen12',
                src: './videos/Synesthesia VR Experience.mp4',
                title: "Synesthesia VR",
                about: "Ever wondered what it's like to hear colors? This VR experience puts you in the mind of a synesthete, where sounds and colors blend into one. Inspired by Bauhaus aesthetics and Kandinsky's paintings, it's part game, part art experiment, and all kinds of trippy!",
                url: "./project1.html"
            },
        ];

        videoSources.forEach(this.createVideoResources.bind(this));
    }

    createVideoResources({ id, src, title, about, url }) {
        try {
            const video = document.createElement("video");

            video.addEventListener('error', (e) => {
                console.error(`Error loading video ${id}:`, video.error);
            });

            video.addEventListener('loadeddata', () => {
                console.log(`Video ${id} loaded successfully`);
            });

            video.src = src;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.crossOrigin = "anonymous";

            const videoTexture = new THREE.VideoTexture(video);
            videoTexture.minFilter = THREE.LinearFilter;
            videoTexture.magFilter = THREE.LinearFilter;
            videoTexture.format = THREE.RGBAFormat;
            videoTexture.generateMipmaps = false;

            const videoMaterial = new THREE.MeshBasicMaterial({
                map: videoTexture,
                side: THREE.DoubleSide,
                toneMapped: false
            });

            this.videos.set(id, video);
            this.videoTextures.set(id, videoTexture);
            this.videoMaterials.set(id, videoMaterial);
            this.projectInfo.set(id, { title, about, url });

            this.disposables.add(videoTexture);
            this.disposables.add(videoMaterial);

            video.load();
        } catch (error) {
            console.error(`Failed to create video resources for ${id}:`, error);
        }
    }

    setupLoaders() {
        this.gltfLoader = new THREE.GLTFLoader();
        const dracoLoader = new THREE.DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        this.gltfLoader.setDRACOLoader(dracoLoader);
    }

    updateMousePosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.mouseMovedThisFrame = true;
    }

    async loadModel() {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                'Apple_Computer.glb',
                (gltf) => {
                    try {
                        this.model = gltf.scene;
                        this.scene.add(this.model);

                        const endPos = this.CONFIG.MODEL_POSITION.clone();
                        const endRot = this.CONFIG.MODEL_ROTATION.clone();
                        this.model.position.copy(endPos);
                        this.model.position.y -= 8;
                        this.model.rotation.set(
                            endRot.x,
                            endRot.y + Math.PI * 0.15,
                            endRot.z
                        );

                        this.setupScreenMeshes();

                        this.fitCameraToScene();
                        this.applyOverviewCameraOverride();

                        const model = this.model;
                        const yStart = model.position.y;
                        const yEnd = endPos.y;
                        const rStart = model.rotation.y;
                        const rEnd = endRot.y;
                        const arriveStart = performance.now();
                        const ARRIVE_DURATION = 1800;

                        const runModelArrive = (now) => {
                            if (this.disposed) return;
                            const t = Math.min((now - arriveStart) / ARRIVE_DURATION, 1);
                            const e =
                                1 -
                                Math.pow(1 - t, 4) +
                                Math.sin(t * Math.PI) * 0.04 * (1 - t);
                            const clampedE = Math.min(e, 1);
                            model.position.y = yStart + (yEnd - yStart) * clampedE;
                            model.rotation.y =
                                rStart + (rEnd - rStart) * Math.min(e * 1.2, 1);
                            if (t < 1) {
                                this._modelArriveRaf = requestAnimationFrame(runModelArrive);
                            } else {
                                this._modelArriveRaf = null;
                                model.position.copy(endPos);
                                model.rotation.copy(endRot);
                            }
                        };
                        this._modelArriveRaf = requestAnimationFrame(runModelArrive);

                        this.handleResize();

                        resolve(this.screenMeshes);
                    } catch (error) {
                        reject(error);
                    }
                },
                undefined,
                reject
            );
        });
    }

    setupScreenMeshes() {
        this.model.traverse((object) => {
            if (object.isMesh && object.name.toLowerCase().includes('screen')) {
                this.screenMeshes.push(object);
                const screenId = `screen${this.screenMeshes.length}`;

                if (this.videoMaterials.has(screenId)) {
                    const newGeometry = object.geometry.clone();
                    this.flipUVs(newGeometry);
                    object.geometry = newGeometry;
                    object.material = this.videoMaterials.get(screenId);
                    object.userData.screenId = screenId;
                    this.disposables.add(newGeometry);
                }
            }
        });
    }

    flipUVs(geometry) {
        if (!geometry.attributes.uv) return geometry;

        const uvs = geometry.attributes.uv;
        const array = uvs.array;

        for (let i = 0; i < array.length; i += 2) {
            array[i + 1] = 1 - array[i + 1];
        }

        uvs.needsUpdate = true;
        return geometry;
    }

    bindEvents() {
        // Get canvas element
        const canvas = document.getElementById('three-canvas');
        if (!canvas) {
            console.error('Canvas element not found');
            return;
        }

        // Add event listeners
        window.addEventListener("resize", this.handleResize);
        document.addEventListener("mousemove", this.handleMouseMove);
        canvas.addEventListener("click", this.handleClick);
        canvas.addEventListener("touchend", this.handleClick);

        const container = document.getElementById('canvas-container');
        if (container && typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => {
                this.handleResize();
            });
            this._resizeObserver.observe(container);
        }
    }

    handleResize = () => {
        const container =
            document.getElementById('canvas-container') ??
            document.getElementById('canvas-overlay');
        const w = container?.offsetWidth || window.innerWidth;
        const h = container?.offsetHeight || window.innerHeight;
        if (!w || !h) return;



        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();

        if (this._zoomAnimating) {
            return;
        }

        if (this.model) {
            if (this._currentZoomState === 'overview') {
                this.fitCameraToScene();
                this.applyOverviewCameraOverride();
            } else {
                // Restore the zoomed-in project view without animation.
                // PROJECT_ZOOMS is populated by buildProjectZooms() at init time.
                const z = PROJECT_ZOOMS[this._currentZoomState];
                if (z) {
                    this.camera.position.copy(z.cameraEnd);
                    this.camera.lookAt(z.target);
                    this.camera.updateProjectionMatrix();
                } else {
                    // Safety fallback if zoom data isn't ready yet
                    this.fitCameraToScene();
                    this.applyOverviewCameraOverride();
                }
            }
        }

        if (!this._zoomAnimating && this._sceneCenter) {
            this._overviewCameraPosition = this.camera.position.clone();
            this._overviewLookTarget = this._sceneCenter.clone();
        }
    }


    handleMouseMove = (event) => {
        this.updateMousePosition(event);
        this.lastMouseEvent = event;
    }

    handleClick = (event) => {
        event.preventDefault();

        // Update mouse position first
        this.updateMousePosition(event);

        // Start videos
        this.startVideos();

        // Check for screen clicks
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.screenMeshes);

        if (intersects.length > 0) {
            const screenMesh = intersects[0].object;
            const screenId = screenMesh.userData.screenId;
            const info = this.projectInfo.get(screenId);

            // Debug monitor world positions for PROJECT_ZOOMS tuning:
            // const _wp = new THREE.Vector3();
            // screenMesh.getWorldPosition(_wp);
            // console.log(screenMesh.name || screenId, _wp.x, _wp.y, _wp.z);

            console.log('Screen clicked:', screenId);
            console.log('Project info:', info);

            if (info && info.url) {
                console.log('Navigating to:', info.url);
                try {
                    window.location.href = info.url;
                } catch (error) {
                    console.error('Navigation failed:', error);
                }
            }
        }
    }

    // Update cursor style when hovering over screens
    checkIntersection() {
        if (!this.lastMouseEvent) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.screenMeshes);

        if (intersects.length > 0) {
            const screenMesh = intersects[0].object;
            const screenId = screenMesh.userData.screenId;
            document.body.style.cursor = 'pointer';  // Change cursor to pointer on hover

            if (this.hoveredScreen !== screenId) {
                this.hoveredScreen = screenId;
            }
        } else {
            document.body.style.cursor = 'default';  // Reset cursor
            if (this.hoveredScreen !== null) {
                this.hoveredScreen = null;
            }
        }
    }

    async startVideos() {
        if (this.playing) return;

        try {
            const playPromises = Array.from(this.videos.values()).map(async (video) => {
                if (video.paused) {
                    await video.play();
                }
            });

            await Promise.all(playPromises);
            this.playing = true;
        } catch (error) {
            console.error("Video playback failed:", error);
        }
    }

    animate = () => {
        if (this.disposed) return;

        this.animationFrameId = requestAnimationFrame(this.animate);

        if (this.mouseMovedThisFrame) {
            this.checkIntersection();
            this.mouseMovedThisFrame = false;
        }

        this.videoTextures.forEach((texture, id) => {
            const video = this.videos.get(id);
            if (video?.readyState === video.HAVE_ENOUGH_DATA) {
                texture.needsUpdate = true;
            }
        });

        this.renderer.render(this.scene, this.camera);
    }

    // Update the removeEventListeners method
    removeEventListeners() {
        window.removeEventListener("resize", this.handleResize);
        document.removeEventListener("mousemove", this.handleMouseMove);

        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }

        const canvas = document.getElementById('three-canvas');
        if (canvas) {
            canvas.removeEventListener("click", this.handleClick);
            canvas.removeEventListener("touchend", this.handleClick);
        }
    }


    // Cleanup cursor style on dispose
    dispose() {
        teardownDoomScrollObservers();
        if (doomAnimRaf !== null) {
            cancelAnimationFrame(doomAnimRaf);
            doomAnimRaf = null;
        }
        if (this._modelArriveRaf !== null) {
            cancelAnimationFrame(this._modelArriveRaf);
            this._modelArriveRaf = null;
        }
        isAnimating = false;
        currentZoomIndex = -1;
        document.body.style.cursor = 'default';  // Reset cursor
        // ... rest of dispose method remains the same
        this.disposed = true;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        this.removeEventListeners();

        this.disposables.forEach(disposable => {
            if (disposable?.dispose) disposable.dispose();
        });
        this.disposables.clear();

        this.videos.forEach(video => {
            video.pause();
            video.src = '';
            video.load();
            video.remove();
        });

        sceneInstance = null;
    }

    async init() {

        try {
            await this.loadModel();
            this.animate();
            await this.startVideos();
            return true;
        } catch (error) {
            console.error("Initialization failed:", error);
            return false;
        }
    }
}

/* ════════════════════════════════════════════
   DOOM SCROLL SYSTEM — Zone B scroll drives Zone A camera
   ════════════════════════════════════════════ */


const PROJECT_DISPLAY = [
    {
        index: 0,
        year: '2025',
        number: '01',
        platform: 'VISION PRO',
        title: 'Spatial Synesthesia',
        description:
            'A gaze-driven mixed reality experience where eye-dwell on Kandinsky painting regions solos instruments and shifts passthrough color. Perception as interface.',
        videoUrl: 'https://www.youtube.com/embed/66hFXR_sxr0',
        projectUrl: 'project-synesthesia.html',
        tags: ['VISION PRO', 'visionOS', 'RealityKit', 'Eye Tracking']
    },
    {
        index: 1,
        year: '2024',
        number: '02',
        platform: 'QUEST 3',
        title: 'Herald Examiner MR',
        description:
            'A mixed reality prototype where computer vision detects real-world objects and transforms them into narrative anchors across three historical eras. Built for Meta Quest 3.',
        videoUrl: 'https://www.youtube.com/embed/dYqZd54enW0',
        projectUrl: 'project-herald.html',
        tags: ['QUEST 3', 'Unity', 'Computer Vision', 'Sentis', 'MR']
    },
    {
        index: 2,
        year: '2024',
        number: '03',
        platform: '3D',
        title: 'World Labs → UE Pipeline',
        description:
            'A greybox-to-photorealistic pipeline for Unreal Engine 5 using World Labs Marble AI. Blockouts become cinematic film sets in minutes — built for virtual production workflows.',
        videoUrl: 'https://www.youtube.com/embed/IFVzCY6aNYU',
        projectUrl: 'project-worldlabs.html',
        tags: ['UNREAL ENGINE 5', 'AI', 'Virtual Production', 'World Labs']
    },
    {
        index: 3,
        year: '2025',
        number: '04',
        platform: 'QUEST PRO',
        title: 'Molecules WebXR',
        description:
            'WebXR molecular visualization that makes chemistry tangible in the headset. Designed for clarity, scale, and classroom-ready interaction in the browser.',
        videoUrl: 'https://www.youtube.com/embed/Q-V5EQ-FBMc',
        projectUrl: 'project3.html',
        tags: ['QUEST PRO', 'WebXR', 'Education', 'Three.js']
    },
    {
        index: 4,
        year: '2024',
        number: '05',
        platform: 'QUEST 3',
        title: 'mr.js — WebXR library',
        description:
            'Open-source WebXR layer for building mixed reality on the web with familiar three.js patterns. Focused on designer-friendly components and rapid spatial prototyping.',
        videoUrl: './images/volumetrics/fish_on_page.mp4',
        projectUrl: 'project5.html',
        tags: ['QUEST 3', 'WebXR', 'Open Source', 'JavaScript']
    },
    {
        index: 5,
        year: '2021',
        number: '06',
        platform: 'QUEST 1',
        title: 'Synesthesia VR',
        description:
            "A VR experience embodying a synesthete's perception of sound as color, grounded in Kandinsky and Bauhaus. Built in Unity with a painterly, interactive audiovisual language.",
        videoUrl: 'https://www.youtube.com/embed/OqJXfS4G-cE',
        projectUrl: 'project1.html',
        tags: ['QUEST 1', 'Unity', 'VR', 'UX Design']
    },
    {
        index: 6,
        year: '2024',
        number: '07',
        platform: 'QUEST 3',
        title: 'Classical Poem in MR / VR',
        description:
            "Wordsworth's 'I Wandered Lonely as a Cloud' reimagined as a spatial narrative with scrolling poetry and AI-assisted skyboxes. Literature as an explorable environment.",
        videoUrl: 'https://www.youtube.com/embed/Nb5_dX4yZZA',
        projectUrl: 'project6.html',
        tags: ['QUEST 3', 'MR', 'VR', 'Story']
    },
    {
        index: 7,
        year: '2020',
        number: '08',
        platform: 'INSTALLATION',
        title: 'Piano Bar — Cybernetics installation',
        description:
            'Wall-scale projection, live piano, and an AI opponent in a color-matching duel—half game, half cybernetic performance.',
        videoUrl: 'https://www.youtube.com/embed/bEsWqgApTyw',
        projectUrl: 'project11.html',
        tags: ['PHYSICAL COMPUTING', 'INTERACTIVE INSTALLATION', 'AI']
    },
    {
        index: 8,
        year: '2025',
        number: '09',
        platform: 'WEBXR',
        title: 'Memory Game WebXR',
        description:
            'Hand-tracked memory cards for caregiving settings: approachable mechanics, clear feedback, and sessions designed for repeated play.',
        videoUrl: 'https://www.youtube.com/embed/F2fcI6bCOhs',
        projectUrl: 'project12.html',
        tags: ['WEBXR', 'WebXR', 'Hand Tracking', 'Health']
    },
    {
        index: 9,
        year: '2024',
        number: '10',
        platform: '3D',
        title: 'SCG Archival 3D Website',
        description:
            'WebGL archive of Structural Color Gallery: a navigable 3D scan of the exhibition with twenty artworks. Performance-tuned delivery and usability sessions with 20+ participants.',
        videoUrl: './images/scg/scg_scan.mp4',
        projectUrl: 'project2.html',
        tags: ['3D', 'Three.js', 'WebGL', 'UX Research']
    },
    {
        index: 10,
        year: '2024',
        number: '11',
        platform: 'QUEST 2',
        title: 'Invisible Labour MR',
        description:
            'Mixed reality piece surfacing unseen emotional and physical labor. Uses presence and juxtaposition to advocate for recognition and care.',
        videoUrl: 'https://www.youtube.com/embed/-3eBUV7rLAA',
        projectUrl: 'project7.html',
        tags: ['QUEST 2', 'MR', 'Art', 'Social']
    },
    {
        index: 11,
        year: '2023',
        number: '12',
        platform: 'QUEST 2',
        title: 'Scholarly VR',
        description:
            'Turns dense research into explorable 3D spaces so students and faculty can inhabit ideas instead of only reading them.',
        videoUrl: 'https://www.youtube.com/embed/hrvmM2Cxiho',
        projectUrl: 'project10.html',
        tags: ['QUEST 2', 'VR', 'EdTech', 'Research']
    },
    {
        index: 12,
        year: '2023',
        number: '13',
        platform: 'QUEST 2',
        title: 'Blown Away VR',
        description:
            'Experimental locomotion using breath control to move through surreal spaces. A playful study in embodied input and comfort in VR.',
        videoUrl: 'https://www.youtube.com/embed/YkhsBu1dw0Y',
        projectUrl: 'project4.html',
        tags: ['QUEST 2', 'VR', 'Gameplay', 'Experiment']
    },
    {
        index: 13,
        year: '2023',
        number: '14',
        platform: 'QUEST 1',
        title: "4'33'' — Soundscapes in VR",
        description:
            'A Cage-inspired VR study of everyday soundscapes—from home to city—treating silence and ambience as compositional material.',
        videoUrl: 'https://www.youtube.com/embed/Zp0g3Y7vn_8',
        projectUrl: 'project8.html',
        tags: ['QUEST 1', 'VR', 'Audio', 'Installation']
    },
    {
        index: 14,
        year: '2018',
        number: '15',
        platform: 'OCULUS GO',
        title: 'Futuristic Metaverse Trailer (2018)',
        description:
            'Speculative short imagining freelance work inside the metaverse—tasks, collaboration, and the humor of early remote-work futures.',
        videoUrl: 'https://www.youtube.com/embed/cwTM4ci1i84',
        projectUrl: 'project9.html',
        tags: ['OCULUS GO', 'VR', 'Trailer', 'Concept']
    }
];

/** Populated by buildProjectZooms() — used by scroll observers */
let PROJECT_ZOOMS = [];

/**
 * World-space screen centers per monitor, index order = project 01–12.
 * Replace with output from logAllMonitorPositions() after measuring the GLTF.
 */
const MONITOR_TARGET_Y_OFFSET = 0.3;
const MONITOR_CAMERA_Z_STANDOFF = 2.0;

const monitorPositions = [
    { x: 0, y: 2.5, z: 0 },
    { x: -1.2, y: 2.5, z: 0 },
    { x: 1.2, y: 2.5, z: 0 },
    { x: -1.8, y: 1.5, z: 0 },
    { x: -0.6, y: 1.5, z: 0 },
    { x: 0.6, y: 1.5, z: 0 },
    { x: 1.8, y: 1.5, z: 0 },
    { x: -2.4, y: 0.5, z: 0 },
    { x: -1.2, y: 0.5, z: 0 },
    { x: 0, y: 0.5, z: 0 },
    { x: 1.2, y: 0.5, z: 0 },
    { x: 2.4, y: 0.5, z: 0 }
];

function buildProjectZooms() {
    const fallbackTarget = new THREE.Vector3(0, 1.5, 0);
    const fallbackEnd = new THREE.Vector3(0, 1.8, 2.0);

    PROJECT_ZOOMS = PROJECT_DISPLAY.map((p, i) => {
        const m = monitorPositions[i];
        const target = m
            ? new THREE.Vector3(m.x, m.y, m.z)
            : fallbackTarget.clone();
        const cameraEnd = m
            ? new THREE.Vector3(
                  m.x,
                  m.y + MONITOR_TARGET_Y_OFFSET,
                  m.z + MONITOR_CAMERA_Z_STANDOFF
              )
            : fallbackEnd.clone();

        return {
            index: p.index,
            number: p.number,
            title: p.title,
            projectUrl: p.projectUrl,
            target,
            cameraEnd
        };
    });
}

const CANVAS_HEIGHT_VH_DESKTOP = 106;
const CANVAS_HEIGHT_VH_MOBILE = 52;

let currentZoomIndex = -1;
let overviewLeft = true;
let isAnimating = false;
let overviewCameraPos = null;
let overviewCameraTarget = null;

let doomObservers = [];
let doomAnimRaf = null;
let doomResizeBound = false;

function doomCanvasZoneVh() {
    return window.matchMedia('(max-width: 768px)').matches
        ? CANVAS_HEIGHT_VH_MOBILE
        : CANVAS_HEIGHT_VH_DESKTOP;
}

function logAllMonitorPositions() {
    const inst = sceneInstance;
    if (!inst || !inst.scene) {
        console.warn('logAllMonitorPositions: scene not ready');
        return [];
    }

    const positions = [];
    inst.scene.traverse((obj) => {
        if (!obj.isMesh) return;
        const name = (obj.name && String(obj.name).toLowerCase()) || '';
        const parentName =
            (obj.parent && obj.parent.name && String(obj.parent.name).toLowerCase()) ||
            '';
        if (
            name.includes('screen') ||
            name.includes('display') ||
            /project\d+/.test(parentName)
        ) {
            const wp = new THREE.Vector3();
            obj.getWorldPosition(wp);
            positions.push({
                name: obj.name,
                parent: obj.parent ? obj.parent.name : '',
                position: {
                    x: +wp.x.toFixed(3),
                    y: +wp.y.toFixed(3),
                    z: +wp.z.toFixed(3)
                }
            });
        }
    });
    console.table(positions);
    console.log(JSON.stringify(positions, null, 2));
    return positions;
}

function updateProgressDot(idx) {
    document.querySelectorAll('.scroll-progress-dot').forEach((dot) => {
        const di = parseInt(dot.dataset.index, 10);
        dot.classList.toggle('active', di === idx);
    });
}

function storeOverviewState(scene) {
    overviewCameraPos = scene.CONFIG.OVERVIEW_CAMERA_POSITION.clone();
    overviewCameraTarget = scene.CONFIG.OVERVIEW_LOOK_AT.clone();
}

function getCurrentLookTarget(camera) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return camera.position.clone().add(dir);
}

function animateCameraEpic(
    scene,
    fromPos,
    fromTarget,
    toPos,
    toTarget,
    onComplete,
    options = {}
) {
    if (!scene || scene.disposed) return;
    if (isAnimating) return;

    const duration = options.duration ?? 1400;
    const overshoot = options.overshoot ?? false;
    const flashMid = options.flashMid ?? false;
    const vignetteEl = document.getElementById('canvas-container');
    const flashEl = document.getElementById('zoom-flash');

    isAnimating = true;
    scene._zoomAnimating = true;
    if (doomAnimRaf !== null) {
        cancelAnimationFrame(doomAnimRaf);
        doomAnimRaf = null;
    }

    const start = performance.now();
    const fromP = fromPos.clone();
    const fromT = fromTarget.clone();
    const toP = toPos.clone();
    const toT = toTarget.clone();

    vignetteEl?.classList.add('zooming');

    if (flashMid && flashEl) {
        window.setTimeout(() => {
            if (!scene || scene.disposed) return;
            flashEl.classList.add('flash-in');
            window.setTimeout(() => {
                flashEl.classList.remove('flash-in');
            }, 180);
        }, duration * 0.55);
    }

    function tick(now) {
        if (!scene || scene.disposed) {
            isAnimating = false;
            if (scene) scene._zoomAnimating = false;
            vignetteEl?.classList.remove('zooming');
            doomAnimRaf = null;
            return;
        }
        const elapsed = now - start;
        const rawT = Math.min(elapsed / duration, 1);

        let tEase;
        if (overshoot) {
            tEase = 1 - Math.pow(1 - rawT, 3) + Math.sin(rawT * Math.PI) * 0.06;
            tEase = Math.min(tEase, 1);
        } else {
            tEase =
                rawT < 0.5
                    ? 4 * rawT * rawT * rawT
                    : 1 - Math.pow(-2 * rawT + 2, 3) / 2;
        }

        scene.camera.position.lerpVectors(fromP, toP, tEase);
        const currentTarget = new THREE.Vector3().lerpVectors(fromT, toT, tEase);
        scene.camera.lookAt(currentTarget);
        scene.camera.updateProjectionMatrix();

        if (rawT < 1) {
            doomAnimRaf = requestAnimationFrame(tick);
        } else {
            isAnimating = false;
            scene._zoomAnimating = false;
            vignetteEl?.classList.remove('zooming');
            doomAnimRaf = null;
            if (onComplete) onComplete();
        }
    }
    doomAnimRaf = requestAnimationFrame(tick);
}

function animateCameraArc(
    scene,
    fromPos,
    fromTarget,
    toPos,
    toTarget,
    onComplete
) {
    if (!scene || scene.disposed) return;
    if (isAnimating) return;

    const fromP = fromPos.clone();
    const toP = toPos.clone();
    const fromT = fromTarget.clone();
    const toT = toTarget.clone();

    const midPos = new THREE.Vector3(
        (fromP.x + toP.x) / 2,
        Math.max(fromP.y, toP.y) + 3.5,
        Math.max(fromP.z, toP.z) + 2.5
    );

    const flashEl = document.getElementById('zoom-flash');
    const vignetteEl = document.getElementById('canvas-container');
    const duration = 1600;
    const start = performance.now();

    isAnimating = true;
    scene._zoomAnimating = true;
    if (doomAnimRaf !== null) {
        cancelAnimationFrame(doomAnimRaf);
        doomAnimRaf = null;
    }

    vignetteEl?.classList.add('zooming');

    window.setTimeout(() => {
        if (!scene || scene.disposed) return;
        flashEl?.classList.add('flash-in');
        window.setTimeout(() => {
            flashEl?.classList.remove('flash-in');
        }, 200);
    }, duration * 0.45);

    function tick(now) {
        if (!scene || scene.disposed) {
            isAnimating = false;
            if (scene) scene._zoomAnimating = false;
            vignetteEl?.classList.remove('zooming');
            doomAnimRaf = null;
            return;
        }
        const elapsed = now - start;
        const rawT = Math.min(elapsed / duration, 1);
        const t =
            rawT < 0.5
                ? 4 * rawT * rawT * rawT
                : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        const u = 1 - t;
        const p = new THREE.Vector3();
        p.x = u * u * fromP.x + 2 * u * t * midPos.x + t * t * toP.x;
        p.y = u * u * fromP.y + 2 * u * t * midPos.y + t * t * toP.y;
        p.z = u * u * fromP.z + 2 * u * t * midPos.z + t * t * toP.z;
        scene.camera.position.copy(p);

        const currentTarget = new THREE.Vector3().lerpVectors(fromT, toT, t);
        scene.camera.lookAt(currentTarget);
        scene.camera.updateProjectionMatrix();

        if (rawT < 1) {
            doomAnimRaf = requestAnimationFrame(tick);
        } else {
            isAnimating = false;
            scene._zoomAnimating = false;
            vignetteEl?.classList.remove('zooming');
            doomAnimRaf = null;
            if (onComplete) onComplete();
        }
    }
    doomAnimRaf = requestAnimationFrame(tick);
}

function teardownDoomScrollObservers() {
    doomObservers.forEach((o) => o.disconnect());
    doomObservers = [];
    window._doomObservers = [];
}

function initScrollObserver(scene) {
    teardownDoomScrollObservers();

    const spatialLeft = document.querySelector('.spatial-left');
    const spatialRight = document.querySelector('.spatial-right');

    const projectObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;

                const idx = parseInt(entry.target.dataset.projectIndex, 10);
                if (Number.isNaN(idx)) return;

                entry.target.classList.add('entering');

                const sectionVideo = entry.target.querySelector('video');
                if (sectionVideo) {
                    sectionVideo.play().catch(() => {});
                }

                if (idx === currentZoomIndex) return;

                const project = PROJECT_ZOOMS[idx];
                if (!project) return;

                const prevIndex = currentZoomIndex;
                currentZoomIndex = idx;
                // scene._currentZoomState = idx;  // zoom disabled — re-enable with camera animations below
                overviewLeft = false;

                scene.renderer.domElement.style.pointerEvents = 'none';
                document.getElementById('canvas-container')?.classList.add('inactive');

                spatialLeft?.classList.add('faded');
                spatialRight?.classList.add('faded');

                document.querySelector('h1.hero-title')?.classList.add('exiting');
                document.querySelector('.scroll-hint')?.classList.add('exiting');

                updateProgressDot(idx);

                // Camera zoom disabled — uncomment to re-enable
                // const fromPos = scene.camera.position.clone();
                // const fromTarget = getCurrentLookTarget(scene.camera);
                // if (prevIndex === -1) {
                //     animateCameraEpic(
                //         scene,
                //         fromPos,
                //         fromTarget,
                //         project.cameraEnd.clone(),
                //         project.target.clone(),
                //         null,
                //         { duration: 1400, overshoot: false, flashMid: idx === 0 }
                //     );
                // } else {
                //     animateCameraArc(
                //         scene,
                //         fromPos,
                //         fromTarget,
                //         project.cameraEnd.clone(),
                //         project.target.clone(),
                //         null
                //     );
                // }
            });
        },
        {
            root: null,
            rootMargin: '0px 0px -20% 0px',
            threshold: 0.05
        }
    );
    doomObservers.push(projectObserver);

    const landing = document.getElementById('section-landing');
    if (landing) {
        const landingObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    if (currentZoomIndex === -1) return;

                    currentZoomIndex = -1;
                    scene._currentZoomState = 'overview';
                    overviewLeft = true;

                    scene.renderer.domElement.style.pointerEvents = 'auto';
                    document.getElementById('canvas-container')?.classList.remove('inactive');

                    spatialLeft?.classList.remove('faded');
                    spatialRight?.classList.remove('faded');

                    document.querySelector('h1.hero-title')?.classList.remove('exiting');
                    document.querySelector('.scroll-hint')?.classList.remove('exiting');

                    document
                        .querySelectorAll('.project-section')
                        .forEach((s) => {
                            s.classList.remove('visible', 'entering');
                        });

                    updateProgressDot(-1);

                    // Camera return disabled — uncomment to re-enable
                    // if (!overviewCameraPos || !overviewCameraTarget) return;
                    // const fromPos = scene.camera.position.clone();
                    // const fromTarget = getCurrentLookTarget(scene.camera);
                    // animateCameraEpic(
                    //     scene,
                    //     fromPos,
                    //     fromTarget,
                    //     overviewCameraPos.clone(),
                    //     overviewCameraTarget.clone(),
                    //     null,
                    //     { duration: 1000, overshoot: true, flashMid: false }
                    // );
                });
            },
            { root: null, threshold: 0.25 }
        );
        landingObserver.observe(landing);
        doomObservers.push(landingObserver);
    }

    document.querySelectorAll('.project-section').forEach((s) => {
        projectObserver.observe(s);
    });

    const progressEl = document.getElementById('scroll-progress');
    if (progressEl) {
        progressEl.replaceChildren();
        const landDot = document.createElement('div');
        landDot.className = 'scroll-progress-dot active';
        landDot.dataset.index = '-1';
        landDot.dataset.label = 'Home';
        landDot.addEventListener('click', () => {
            document.getElementById('section-landing')?.scrollIntoView({ behavior: 'smooth' });
        });
        progressEl.appendChild(landDot);
        PROJECT_DISPLAY.forEach((proj, i) => {
            const dot = document.createElement('div');
            dot.className = 'scroll-progress-dot';
            dot.dataset.index = String(i);
            dot.dataset.label = proj.title;
            dot.addEventListener('click', () => {
                document.getElementById('section-project-' + i)?.scrollIntoView({ behavior: 'smooth' });
            });
            progressEl.appendChild(dot);
        });
        updateProgressDot(currentZoomIndex);
    }

    window._doomObservers = doomObservers;
}

function bindDoomResizeOnce(scene) {
    if (doomResizeBound) return;
    doomResizeBound = true;
    window.addEventListener(
        'resize',
        () => {
            if (!sceneInstance || sceneInstance.disposed) return;
            window.clearTimeout(window.__doomObsResizeT);
            window.__doomObsResizeT = window.setTimeout(() => {
                initScrollObserver(sceneInstance);
            }, 120);
        },
        { passive: true }
    );
}

function preloadProjects() {
    PROJECT_DISPLAY.forEach((project) => {
        const section = document.getElementById('section-project-' + project.index);
        if (!section) return;

        const inner = section.querySelector('.project-section-inner');
        if (!inner) return;

        const href = project.projectUrl.startsWith('./')
            ? project.projectUrl
            : `./${project.projectUrl}`;

        const isYoutube = /youtube\.com|youtu\.be/i.test(project.videoUrl);
        const ytSep = project.videoUrl.includes('?') ? '&' : '?';
        const embedId = project.videoUrl.match(/embed\/([^?&/]+)/);
        const ytLoop =
            embedId && embedId[1]
                ? `${ytSep}autoplay=1&mute=1&loop=1&playlist=${embedId[1]}&rel=0&modestbranding=1&controls=0&playsinline=1`
                : `${ytSep}autoplay=1&mute=1&loop=1&rel=0&modestbranding=1&controls=0&playsinline=1`;

        inner.innerHTML = `
  <div class="project-short">

    <div class="project-short-video">
      <div class="project-short-screen">
        ${
            isYoutube
                ? `<iframe
               src="${project.videoUrl}${ytLoop}"
               frameborder="0"
               allow="autoplay; fullscreen"
               allowfullscreen>
             </iframe>`
                : `<video
               src="${project.videoUrl}"
               muted autoplay loop playsinline
               preload="auto">
             </video>`
        }
      </div>
      <div class="project-short-number">
        ${project.number}
      </div>
    </div>

    <div class="project-short-info">
      <div class="project-short-meta">
        <span class="project-short-year">
          ${project.year ?? ''}
        </span>
      </div>

      <h2 class="project-short-title">
        ${project.title}
      </h2>

      <p class="project-short-desc">
        ${project.description}
      </p>

      <div class="project-short-skills">
        ${project.tags.map((t, i) => `<span class="project-short-skill${i === 0 ? ' project-short-skill--platform' : ''}">${t}</span>`).join('')}
      </div>

      <a href="${href}"
         class="project-short-cta">
        Open project
        <span class="cta-arrow">→</span>
      </a>
    </div>

  </div>
`;
    });
}

function updateCanvasSize(scene) {
    if (!scene || !scene.renderer) return;
    const container =
        document.getElementById('canvas-container') ??
        document.getElementById('canvas-overlay');
    const w = container?.offsetWidth || window.innerWidth;
    const h = container?.offsetHeight || window.innerHeight;
    if (!w || !h) return;

    scene.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    scene.renderer.setSize(w, h, false);
    scene.camera.aspect = w / h;
    scene.camera.fov = scene.CONFIG.CAMERA_FOV;
    scene.camera.updateProjectionMatrix();
}

function setupHoverHint() {
    const hintEl = document.getElementById('hover-hint');
    const canvas = document.getElementById('three-canvas');
    if (!hintEl || !canvas) return;

    const dismissHint = () => {
        if (hintEl.classList.contains('hidden')) return;
        hintEl.style.animation = 'none';
        void hintEl.offsetWidth;
        hintEl.style.transition = 'opacity 0.4s ease';
        hintEl.style.opacity = '0';
        window.setTimeout(() => {
            hintEl.classList.add('hidden');
        }, 400);
    };

    const onFirstCanvasInteract = () => {
        dismissHint();
        canvas.removeEventListener('mousemove', onFirstCanvasInteract);
        canvas.removeEventListener('touchstart', onFirstCanvasInteract);
    };

    canvas.addEventListener('mousemove', onFirstCanvasInteract);
    canvas.addEventListener('touchstart', onFirstCanvasInteract, { passive: true });

    hintEl.addEventListener('animationend', (e) => {
        if (e.animationName === 'hint-fadeout') {
            hintEl.classList.add('hidden');
        }
    });
}

// Initialize the scene
async function initializeScene() {
    try {
        if (sceneInstance) {
            sceneInstance.dispose();
        }
        const scene = new MultiVideoScene();
        const success = await scene.init();
        if (success) {
            scene.handleResize();
            scene._overviewCameraPosition = scene.camera.position.clone();
            scene._overviewLookTarget = scene._sceneCenter
                ? scene._sceneCenter.clone()
                : new THREE.Vector3(0, 0, 0);
            scene._zoomAnimating = false;
            buildProjectZooms();
            storeOverviewState(scene);
            preloadProjects();
            initScrollObserver(scene);
            bindDoomResizeOnce(scene);
            updateCanvasSize(scene);
        } else {
            console.error("Scene initialization failed");
        }
    } catch (error) {
        console.error("Error creating scene:", error);
    }
}

function ensureHeroTitleWords() {
    const h1 = document.querySelector('body.index-page h1.hero-title');
    if (!h1 || h1.getAttribute('data-hero-words') === '4') return;
    h1.innerHTML =
        '<span class="hero-title-word">Hello,</span><span class="hero-title-word">I</span><span class="hero-title-word">am</span><span class="hero-title-word">Leo</span>';
    h1.setAttribute('data-hero-words', '4');
}

// Ensure DOM is fully loaded before initializing
function bootIndexScene() {
    ensureHeroTitleWords();
    setupHoverHint();
    initializeScene();
}

window.addEventListener('scroll', () => {
    const hint = document.querySelector('.scroll-hint');
    if (hint) hint.classList.toggle('hidden', window.scrollY > 80);
}, { passive: true });

if (document.body.classList.contains('index-page')) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootIndexScene);
    } else {
        bootIndexScene();
    }
}

window.logAllMonitorPositions = logAllMonitorPositions;

window.testZoom = function (x, y, z, standoff = 2.0) {
    const inst = sceneInstance;
    if (!inst) {
        console.warn('testZoom: scene not ready');
        return;
    }
    const target = new THREE.Vector3(x, y, z);
    const camEnd = new THREE.Vector3(
        x,
        y + MONITOR_TARGET_Y_OFFSET,
        z + standoff
    );
    const fromPos = inst.camera.position.clone();
    const fromTgt = getCurrentLookTarget(inst.camera);
    animateCameraEpic(inst, fromPos, fromTgt, camEnd, target, null, {
        duration: 1000,
        flashMid: false,
        overshoot: false
    });
    console.log('Zooming to:', { x, y, z }, 'standoff:', standoff);
};
