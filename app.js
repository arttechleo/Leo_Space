// Hamburger menu functionality
const menuIcon = document.getElementById('menu-icon');
const navLinks = document.getElementById('nav-links');

menuIcon.addEventListener('click', () => {
    navLinks.classList.toggle('show-menu');
});

let sceneInstance = null;

class MultiVideoScene {
    constructor() {
        if (sceneInstance) {
            return sceneInstance;
        }

        sceneInstance = this;

        // Configuration constants
        this.CONFIG = {
            CAMERA_FOV: 75,
            CAMERA_NEAR: 0.1,
            CAMERA_FAR: 100,
            MODEL_POSITION: new THREE.Vector3(0, 0, 0.8),
            MODEL_ROTATION: new THREE.Euler(0, 0, 0),
            CAMERA_POSITION: new THREE.Vector3(0, 2, 10.2) // Adjusted to better view the scene
        };

        // Core components setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            this.CONFIG.CAMERA_FOV,
            window.innerWidth / window.innerHeight,
            this.CONFIG.CAMERA_NEAR,
            this.CONFIG.CAMERA_FAR
        );
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });



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

        // Initialize components
        this.setupRenderer();
        this.setupLighting();
        this.setupVideos();
        this.setupLoaders();
        this.setupUI();
        this.bindEvents();
    }



    setupRenderer() {
        // Get the existing canvas instead of creating a new one
        const canvas = document.getElementById('three-canvas');
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        // Remove this line as we're using existing canvas
        // document.body.appendChild(this.renderer.domElement);
        this.disposables.add(this.renderer);
    }



    setupLighting() {
        // Cool white with slight blue tint (more blue than red/green)
        const coldWhite = 0xE1E6FF;  // or try 0xD6E4FF for even cooler

        // Ambient light with cool temperature
        const ambientLight = new THREE.AmbientLight(coldWhite, 0.8);

        // Directional light with same cool temperature
        const directionalLight = new THREE.DirectionalLight(coldWhite, 1);
        directionalLight.position.set(3, 5, 5);
        directionalLight.castShadow = true;

        // Optional: Add a very subtle blue rim light for enhanced cold effect
        const rimLight = new THREE.DirectionalLight(0x6699FF, 0.3);
        rimLight.position.set(-5, 3, -5);

        this.scene.add(ambientLight, directionalLight, rimLight);
        this.disposables.add(ambientLight);
        this.disposables.add(directionalLight);
        this.disposables.add(rimLight);
    }


    setupUI() {
        try {
            const template = `
            <div class="video-info-panel" style="
                opacity: 0;
                position: fixed;
                padding: 20px;
                color: black;
                border-radius: 8px;
                max-width: 320px;
                transform: translateY(10px);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 1000;
                backdrop-filter: blur(10px);
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                pointer-events: none;
                font-family: 'NeueMontreal-Bold';
            ">
                <h3 class="title" style="
                    margin: 0 0 10px 0;
                    font-size: 18px;
                    font-weight: 600;
                    color: rgb(0, 0, 0);
                    opacity: 1;
                    text-shadow: 0 0 0 #000;
                "></h3>
                <p class="description" style="
                    margin: 0;
                    font-size: 14px;
                    line-height: 1.6;
                    opacity: 0.9;
                    font-family: 'NeueMontreal-Medium';
                "></p>
            </div>
        `;

            const panel = document.createElement('div');
            panel.innerHTML = template;
            this.uiPanel = panel.firstElementChild;
            
            // Only append to document.body if it exists
            if (document.body) {
                document.body.appendChild(this.uiPanel);
            } else {
                console.warn('Document body not available for UI panel attachment');
            }
        } catch (error) {
            console.error('Error setting up UI:', error);
        }
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
                about: "A game, an AI, and a piano walk into a bar... and only one of them never loses. This interactive installation features a massive wall projection, an 88-key piano as a controller, and an AI that’s out to prove humans are overrated at playing with colors. Are you up for the challenge? (Spoiler: the AI thinks you’re not.)",
                url: "./project11.html"
            },
            {
                id: 'screen4',
                src: './videos/WizardofOzVRSoundscapeProject.mp4',
                title: "4'33'' - Soundscapes in VR",
                about: "What if silence wasn’t empty but full of hidden stories? Inspired by John Cage’s 4'33'', this VR experience lets you explore soundscapes from everyday life—your apartment, your city, maybe even the weird noise your fridge makes at night. It’s a concert, but the world is the composer.",
                url: "./project8.html"
            },
            {
                id: 'screen5',
                src: './videos/MemoryGameXR.mp4',
                title: "Memory Game WebXR",
                about: "A Mixed Reality memory game that turns brain training into an interactive adventure. Designed for caregiving facilities, this game uses hand-tracking and point-and-click mechanics to flip cards, find matches, and prove that your memory is sharper than you think (or at least sharper than the AI’s).",
                url: "./project12.html"
            },
            {
                id: 'screen6',
                src: './videos/Structural Color Gallery Experience Recording.mp4',
                title: "SCG - Archival 3D Website",
                about: "An art exhibition you don’t have to leave your house for. This Web3D experience transports you into a 3D-scanned gallery, letting you explore artist Megumi Nagai’s work as if you were there—minus the risk of knocking over a sculpture.",
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
                about: "Ever wanted to move through VR using just your breath? This experimental game lets you explore digital worlds by controlling airflow—kind of like a virtual meditation session, but with way more floating. Just don’t hyperventilate.",
                url: "./project4.html"
            },
            {
                id: 'screen10',
                src: './videos/_I Wandered Lonely as a Cloud_ by William Wordsworth.mp4',
                title: "Classical Poem in Mixed and Virtual Reality",
                about: "Wordsworth’s I Wandered Lonely as a Cloud reimagined for the immersive age. With interactive scrolling and AI-generated skyboxes, this project brings poetry off the page and into a dreamlike Mixed and Virtual Reality world. It’s literature, but make it sci-fi.",
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
                about: "Ever wondered what it’s like to hear colors? This VR experience puts you in the mind of a synesthete, where sounds and colors blend into one. Inspired by Bauhaus aesthetics and Kandinsky’s paintings, it’s part game, part art experiment, and all kinds of trippy!",
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

    handleClick(event) {
        event.preventDefault(); // Prevent any default behavior
        
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
            
            console.log('Screen clicked:', screenId); // Debug log
            console.log('Project info:', info); // Debug log
            
            if (info && info.url) {
                console.log('Navigating to:', info.url); // Debug log
                try {
                    window.location.href = info.url;
                } catch (error) {
                    console.error('Navigation failed:', error);
                }
            }
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

    showUIPanel(screenId, event) {
        const info = this.projectInfo.get(screenId);
        if (!info) return;

        const panel = this.uiPanel;
        panel.querySelector('.title').textContent = info.title;
        panel.querySelector('.description').textContent = info.about;

        // Position panel
        const padding = 20;
        let x = event.clientX + padding;
        let y = event.clientY + padding;

        if (x + panel.offsetWidth > window.innerWidth - padding) {
            x = event.clientX - panel.offsetWidth - padding;
        }
        if (y + panel.offsetHeight > window.innerHeight - padding) {
            y = event.clientY - panel.offsetHeight - padding;
        }

        panel.style.transform = 'translateY(0)';
        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
        panel.style.opacity = '1';
    }

    hideUIPanel() {
        this.uiPanel.style.opacity = '0';
        this.uiPanel.style.transform = 'translateY(10px)';
    }

    async loadModel() {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                'Apple_Computer.glb',
                (gltf) => {
                    try {
                        this.model = gltf.scene;
                        this.scene.add(this.model);

                        this.model.position.copy(this.CONFIG.MODEL_POSITION);
                        this.model.rotation.copy(this.CONFIG.MODEL_ROTATION);

                        this.camera.position.copy(this.CONFIG.CAMERA_POSITION);
                        this.camera.lookAt(this.model.position);

                        this.setupScreenMeshes();

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
    }

    handleResize = () => {
        const container = document.getElementById('canvas-overlay');
        if (container) {
            const width = container.clientWidth;
            const height = container.clientHeight;

            this.renderer.setSize(width, height);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
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
                this.showUIPanel(screenId, this.lastMouseEvent);
            }
        } else {
            document.body.style.cursor = 'default';  // Reset cursor
            if (this.hoveredScreen !== null) {
                this.hoveredScreen = null;
                this.hideUIPanel();
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
    
    const canvas = document.getElementById('three-canvas');
    if (canvas) {
        canvas.removeEventListener("click", this.handleClick);
        canvas.removeEventListener("touchend", this.handleClick);
    }
}


   // Cleanup cursor style on dispose
   dispose() {
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

    if (this.uiPanel) {
        this.uiPanel.remove();
    }

    sceneInstance = null;
}

    // Modify setupBackground to return a Promise
    setupBackground() {
        return new Promise((resolve) => {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(
                'images/hero_image_bg_new.png',
                (texture) => {
                    const aspectRatio = texture.image.width / texture.image.height;
                    let width = 2;
                    let height = width / aspectRatio;

                    if (height < 2) {
                        height = 10;
                        width = height * aspectRatio;
                    }

                    const geometry = new THREE.PlaneGeometry(width, height);
                    const material = new THREE.MeshBasicMaterial({
                        map: texture,
                        depthWrite: false
                    });

                    const backgroundPlane = new THREE.Mesh(geometry, material);
                    backgroundPlane.position.z = -7; // Move it further back
                    backgroundPlane.position.y = 4;
                    backgroundPlane.position.x = 0;
                    this.scene.add(backgroundPlane);

                    this.disposables.add(geometry);
                    this.disposables.add(material);
                    this.disposables.add(texture);

                    resolve();
                },
                undefined,
                resolve // Resolve even on error to not block video playback
            );
        });
    }

    async init() {
        try {
            // Setup background first
            await this.setupBackground();

            // Then load model and start videos
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
        } else {
            console.error("Scene initialization failed");
        }
    } catch (error) {
        console.error("Error creating scene:", error);
    }
}

// Ensure DOM is fully loaded before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeScene);
} else {
    initializeScene();
}



