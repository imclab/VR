getObject("manifest/js/controllers/demo.js", function(files){
    var totalFileSize = 0,
        fileSizes = {},
        ctrls = null,
        triedSoFar = 0,
        loadedSoFar = 0,
        processedSoFar = 0,
        errorSoFar = 0;

    for(var i = 0; i < files.length; ++i){
        totalFileSize += files[i].size;
        fileSizes[files[i].name] = files[i].size;
    }

    include(
        2,
        "js/psychologist.js",
        "lib/three/three.min.js",
        "lib/three/StereoEffect.js",
        "lib/three/OculusRiftEffect.min.js",
        "lib/three/AnaglyphEffect.min.js",
        "lib/three/ColladaLoader.js",
        "/socket.io/socket.io.js",
        "js/input/NetworkedInput.js",
        "js/input/SpeechInput.js",
        "js/input/GamepadInput.js",
        "js/input/KeyboardInput.js",
        "js/input/MotionInput.js",
        "js/input/MouseInput.js",
        "js/input/TouchInput.js",
        "js/output/Audio3DOutput.js",
        "js/output/SpeechOutput.js",
        "js/camera.jsx",
        progress,
        done);

    function addProgress(p, file, cur){
        //if(p.innerHTML.trim().length > 0){
        //    p.innerHTML += ", ";
        //}
        //p.innerHTML += file;
        cur = cur + (fileSizes[file] || 0);
        p.style.width = pct(100 * cur / totalFileSize);
        return cur;
    }

    function progress(op, file){
        if(file == "js/psychologist.js" && op == "success"){
            ctrls = findEverything();
        }
        if(ctrls){
            if(op == "loading"){
                triedSoFar = addProgress(ctrls.triedSoFar, file, triedSoFar);
                ctrls.triedSoFar.innerHTML
                    = ctrls.processedSoFar.innerHTML
                    = ctrls.loadedSoFar.innerHTML
                    = ctrls.errorSoFar.innerHTML = file;
            }
            else {
                processedSoFar = addProgress(ctrls.processedSoFar, file, processedSoFar);
                if(op == "success"){
                    loadedSoFar = addProgress(ctrls.loadedSoFar, file, loadedSoFar);
                    delete fileSizes[file];
                }
                else{
                    errorSoFar = addProgress(ctrls.errorSoFar, file, errorSoFar);
                    delete fileSizes[file];
                }
                console.log(processedSoFar, file, totalFileSize, fileSizes);
                if(processedSoFar == totalFileSize){
                    ctrls.loading.style.display = "none";
                    ctrls.main.style.display = "";
                }
            }
        }
    }

    function done(){
        THREE.DefaultLoadingManager.onProgress = function ( item, loaded, total ) {
		    console.log( item, loaded, total );
	    };
        var BG_COLOR = 0xafbfff, PLAYER_HEIGHT = 3, CLUSTER = 2,
            DRAW_DISTANCE = 100,
            TRACKING_SCALE = 0.5,
            TRACKING_SCALE_COMP = 1 - TRACKING_SCALE,
            GRAVITY = 9.8, SPEED = 15, FOV = 60,
            pitch = 0, roll = 0, heading = 0,
            dpitch = 0, droll = 0, dheading = 0,
            minX = 0, minY = 0, minZ = 0, lt = 0,
            vcx = 0, vcz = 0, vcy = 0, tx, tz,
            onground = false,
            video,
            camera, scene, effect, renderer, map,
            motion, keyboard, mouse, gamepad, 
            fps, dt, heightmap,
            buttonsTimeout = null,
            buttonsVisible = true,
            key = null,
            isDebug = false,
            isLocal = document.location.hostname == "localhost",
            isHost = false,
            isClient = false,
            isWAN = /\d+\.\d+\.\d+\.\d+/.test(document.location.hostname),
            socket,
            oceanSound = null,
            audio3d = new Audio3DOutput();
    
        function msg(){
            if(!isDebug){
                alert.apply(window, arguments);
            }
        }

        function ask(txt, force){
            return !isDebug && confirm(txt) || (isDebug && force);
        }

        function animate(t) {
            requestAnimationFrame(animate);
            dt = (t - lt) / 1000;
            lt = t;
            motion.update();
            keyboard.update();
            mouse.update();
            gamepad.update();
            touch.update();
            if(camera){
                vcy -= dt * GRAVITY;
                var x = Math.floor((camera.position.x - minX) / CLUSTER);
                var z = Math.floor((camera.position.z - minZ) / CLUSTER);
                var y = PLAYER_HEIGHT;
                if (heightmap 
                    && 0 <= z && z < heightmap.length
                    && 0 <= x && x < heightmap[z].length){
                    y += heightmap[z][x];
                }

                if(camera.position.y <= y && vcy <= 0) {
                    vcy = 0;
                    camera.position.y = camera.position.y * 0.75 + y * 0.25;
                    if(!onground){
                        navigator.vibrate(100);
                    }
                    onground = true;
                }

                if(onground){
                    tx = keyboard.getValue("strafeRight")
                        + keyboard.getValue("strafeLeft")
                        + gamepad.getValue("strafe");
                    tz = keyboard.getValue("driveBack")
                        + keyboard.getValue("driveForward")
                        + gamepad.getValue("drive")
                        + touch.getValue("drive");
                    if(tx != 0 || tz != 0){
                        len = SPEED * Math.min(1, 1 / Math.sqrt(tz * tz + tx * tx));
                    }
                    else{
                        len = 0;
                    }
                    tx *= len;
                    tz *= len;
                    len = tx * Math.cos(heading) + tz * Math.sin(heading);
                    tz = tz * Math.cos(heading) - tx * Math.sin(heading);
                    tx = len;
                    vcx = vcx * 0.9 + tx * 0.1;
                    vcz = vcz * 0.9 + tz * 0.1;
                }

                dheading += (gamepad.getValue("dheading") 
                    + mouse.getValue("dheading")
                    + touch.getValue("dheading")) * dt;
                dpitch += mouse.getValue("dpitch") * dt;
                droll += (gamepad.getValue("drollLeft") 
                    + gamepad.getValue("drollRight") 
                    + keyboard.getValue("drollLeft") 
                    + keyboard.getValue("drollRight")) * dt;

                heading = heading * TRACKING_SCALE + (motion.getValue("heading") + dheading) * TRACKING_SCALE_COMP;
                pitch = pitch * TRACKING_SCALE + (motion.getValue("pitch") + dpitch) * TRACKING_SCALE_COMP;
                roll = roll * TRACKING_SCALE + (motion.getValue("roll") + droll) * TRACKING_SCALE_COMP;

                fps = 1 / dt;
                setCamera(dt);
                draw();
            }
        }

        function setCamera(dt) {
            camera.updateProjectionMatrix();
            camera.setRotationFromEuler(new THREE.Euler(0, 0, 0, "XYZ"));
            camera.translateX(vcx * dt);
            camera.translateY(vcy * dt);
            camera.translateZ(vcz * dt);
            camera.setRotationFromEuler(new THREE.Euler(pitch, heading, roll, "YZX"));
            var x = camera.position.x / 10,
                y = camera.position.y / 10,
                z = camera.position.z / 10;
            
            var len = Math.sqrt(x * x + y * y + z * z);
            audio3d.setPosition(x, y, z);
            audio3d.setVelocity(vcx, vcy, vcz);
            audio3d.setOrientation(x / len, y / len, z / len, 0, 1, 0);
        }

        function draw() {
            if (effect) {
                effect.render(scene, camera);
            }
            else {
                renderer.render(scene, camera);
            }
        }

        function setSize(w, h) {
            if(camera){
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            }
            if (effect) {
                effect.setSize(window.innerWidth, window.innerHeight);
            }
            else if (effect) {
                effect.setSize(window.innerWidth, window.innerHeight);
            }
            else {
                renderer.setSize(window.innerWidth, window.innerHeight);
            }
        }

        scene = new THREE.Scene();
        //scene.fog = new THREE.Fog(BG_COLOR, 1, DRAW_DISTANCE);

        var closers = document.getElementsByClassName("closeSectionButton");
        for(var i = 0; i < closers.length; ++i){
            closers[i].addEventListener("click", function(){
                this.parentElement.style.display = "none";
                if(this.parentElement.id == "instructions"){
                    toggleFullScreen();
                    mouse.requestPointerLock();
                }
                ctrls.menuButton.style.display = "";
            }, false);
        }

        ctrls.options.style.display = "none";
        ctrls.menuButton.style.display = "none";

        ctrls.menuButton.addEventListener("click", function(){
            ctrls.options.style.display = "";
            ctrls.menuButton.style.display = "none";
        }, false);

        ctrls.connectButton.addEventListener("click", function(){
            if(socket){
                key = prompt("Enter a key.");
                if(key){
                    socket.emit("key", key);
                }
                this.innerHTML = fmt("Connect to Device Server (current key: $1", key);
            }
            else{
                msg("No socket available");
            }
        }, false);

        ctrls.startSpeechButton.addEventListener("click", function(){
            speech.start();
        }, false);

        ctrls.pointerLockButton.addEventListener("click", function(){
            mouse.togglePointerLock();
            ctrls.options.style.display = "none";
            ctrls.menuButton.style.display = "";
        }, false);

        ctrls.fullScreenButton.addEventListener("click", function(){
            toggleFullScreen();
        }, false);

        ctrls.regularRenderButton.addEventListener("click", function(){
            effect = null;
        }, false);

        ctrls.anaglyphRenderButton.addEventListener("click", function(){
            effect = new THREE.AnaglyphEffect(renderer, 5, window.innerWidth, window.innerHeight);
        }, false);

        ctrls.stereoRenderButton.addEventListener("click", function(){
            effect = new THREE.StereoEffect(renderer);
        }, false);

        ctrls.riftRenderButton.addEventListener("click", function(){
            effect = new THREE.OculusRiftEffect(renderer, {
                worldFactor: 1,
                HMD: {
                    hResolution: screen.availWidth,
                    vResolution: screen.availHeight,
                    hScreenSize: 0.126,
                    vScreenSize: 0.075,
                    interpupillaryDistance: 0.064,
                    lensSeparationDistance: 0.064,
                    eyeToScreenDistance: 0.051,
                    distortionK: [1, 0.22, 0.06, 0.0],
                    chromaAbParameter: [0.996, -0.004, 1.014, 0.0]
                }
            });
        }, false);

        function jump() {
            if (onground) {
                vcy = 10;
                onground = false;
            }
        }

        function fire() {
        }

        function reload() {
            if (isFullScreenMode()) {
                document.location = document.location.href;
            }
            else {
                mouse.requestPointerLock();
                toggleFullScreen();
            }
        }

        renderer = new THREE.WebGLRenderer({
            antialias: true
        });
        renderer.setClearColor(BG_COLOR);

        socket = io.connect(document.location.hostname,
        {
            "reconnect": true,
            "reconnection delay": 1000,
            "max reconnection attempts": 60
        });

        socket.on("bad", function(){
            msg("Key already in use! You're going to have to reload the page if you want to try again. Sorry. Try not to pick such a stupid key next time.");
        });

        socket.on("good", function(info){
            isHost = info.index == 0;
            isClient = info.index > 0;
            msg(fmt("You are device $1 of $2. If this is your first time entering your key, it means you've chosen a key someone else is already using, in which case you should reload the page and try another, less stupid key.", info.index + 1, info.total));
        });    

        if(isDebug){
            key = "debug";
            ctrls.connectButton.innerHTML = fmt("Connect to Device Server (current key: $1", key)
            socket.emit("key", key);
        }

        motion = new MotionInput([
            { name: "heading", axes: [-1] },
            { name: "pitch", axes: [2] },
            { name: "roll", axes: [-3] }
        ], socket);

        mouse = new MouseInput([
            { name: "dheading", axes: [-4] },
            { name: "dpitch", axes: [5] },
            { name: "fire", buttons: [1], commandDown: fire, dt: 125 },
            { name: "jump", buttons: [2], commandDown: jump, dt: 250 },
        ], socket, renderer.domElement);

        touch = new TouchInput(1, null, [
            { name: "dheading", axes: [-3] },
            { name: "drive", axes: [4] },
        ], socket, renderer.domElement);

        keyboard = new KeyboardInput([
            { name: "strafeLeft", buttons: [-65] },
            { name: "strafeRight", buttons: [68] },
            { name: "driveForward", buttons: [-87] },
            { name: "driveBack", buttons: [83] },
            { name: "drollLeft", buttons: [81] },
            { name: "drollRight", buttons: [-69] },
            { name: "jump", buttons: [32], commandDown: jump, dt: 250 },
            { name: "fire", buttons: [17], commandDown: fire, dt: 125 },
            { name: "reload", buttons: [70], commandDown: reload, dt: 125 },
        ], socket);

        gamepad = new GamepadInput([
            { name: "strafe", axes: [1], deadzone: 0.1 },
            { name: "drive", axes: [2], deadzone: 0.1 },
            { name: "dheading", axes: [-3], deadzone: 0.1 },
            { name: "dpitch", axes: [4], deadzone: 0.1 },
            { name: "drollRight", buttons: [5] },
            { name: "drollLeft", buttons: [-6] },
            { name: "jump", buttons: [1], commandDown: jump, dt: 250 },
            { name: "fire", buttons: [2], commandDown: fire, dt: 125 },
        ], socket);

        speech = new SpeechInput([
            { keywords: ["jump"], command: jump }
        ], socket);

        gamepad.addEventListener("gamepadconnected", function (id) {
            if (!gamepad.isGamepadSet() && ask(fmt("Would you like to use this gamepad? \"$1\"", id), true)) {
                gamepad.setGamepad(id);
            }
        }, false);

        window.addEventListener("resize", function () {
            setSize(window.innerWidth, window.innerHeight);
        }, false);

        var loader = new THREE.ColladaLoader();
        loader.options.convertUpAxis = true;
        progress("loading", "scene/untitled.dae");
        loader.load("scene/untitled.dae", function(collada){
            collada.scene.traverse(function(child){
                if(child instanceof(THREE.PerspectiveCamera)){
                    camera = child;
                }
                else if(child.name == "Terrain"){
                    heightmap = [];
                    var verts = child.children[0].geometry.vertices;
                    var l = verts.length;
                    for(var i = 0; i < l; ++i){
                        minX = Math.min(minX, verts[i].x);
                        minY = Math.min(minY, verts[i].y);
                        minZ = Math.min(minZ, verts[i].z);
                    }
                    for(var i = 0; i < l; ++i){
                        var x = Math.round((verts[i].x - minX) / CLUSTER);
                        var z = Math.round((verts[i].z - minZ) / CLUSTER);
                        if(!heightmap[z]){
                            heightmap[z] = [];
                        }
                        if(heightmap[z][x] == undefined){
                            heightmap[z][x] = verts[i].y;
                        }
                        else{
                            heightmap[z][x] = Math.max(heightmap[z][x], verts[i].y);
                        }
                    }
                }
            });
            scene.add(collada.scene);            
            progress("success", "scene/untitled.dae");
        });
        
        progress("loading", "scene/untitled.dae");
        audio3d.loadSound3D("music/ocean.mp3", true, 0, 0, 0, function(snd){
            oceanSound = snd;
            snd.source.start(0);
            progress("success", "music/ocean.mp3");
        }, console.error.bind(console));
        
        progress("loading", "scene/untitled.dae");
        audio3d.loadSoundFixed("music/menu.mp3", true, function(snd){
            snd.source.start(0);
            snd.volume.gain.value = 0.25;
            progress("success", "music/menu.mp3");
        }, console.error.bind(console));

        ctrls.main.insertBefore(renderer.domElement, ctrls.main.firstChild);
        setSize(window.innerWidth, window.innerHeight);

        requestAnimationFrame(animate);
    }
});