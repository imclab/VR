VUI = {};

VUI.Text = function(text, size, fgcolor, bgcolor, x, y, z, hAlign){
    hAlign = hAlign || "center";
    var height = (size * 1000);

    var textCanvas = document.createElement("canvas");
    var textContext = textCanvas.getContext("2d");
    textContext.font = height + "px Arial";
    var width = textContext.measureText(text).width;

    textCanvas.width = width;
    textCanvas.height = height;
    textContext.font = height + "px Arial";
    if(bgcolor !== "transparent"){
        textContent.fillStyle = bgcolor;
        textContent.fillRect(0, 0, textCanvas.width, textCanvas.height);
    }
    textContext.fillStyle = fgcolor;
    textContext.textBaseline = "top";
    textContext.fillText(text, 0, 0);

    var texture = new THREE.Texture(textCanvas);
    texture.needsUpdate = true;

    var material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: bgcolor === "transparent",
        useScreenCoordinates: false,
        color: 0xffffff,
        shading: THREE.FlatShading
    });

    var textGeometry = new THREE.PlaneGeometry(size * width / height, size);
    textGeometry.computeBoundingBox();
    textGeometry.computeVertexNormals();

    var textMesh = new THREE.Mesh(textGeometry, material);
    if(hAlign === "left"){
        x -= textGeometry.boundingBox.min.x;
    }
    else if(hAlign === "right"){
        x += textGeometry.boundingBox.min.x;
    }
    textMesh.position.set(x, y, z);
    return textMesh;
};

VUI.Button = function(template, name){
    this.listeners = { click: [] };
    this.base = template.clone();
    this.position = this.base.position;
    this.rotation = this.base.rotation;
    this.name = name;
    this.cap = this.base.buttons[0];
    this.cap.name = name;
    this.rest = this.cap.position.clone();
    this.color = this.cap.children[0].material.materials[0].color;
    this.touched = false;
    this.wasTouched = false;
    this.pressed = false;
    this.wasPressed = false;
    delete this.base.buttons;
};

VUI.Button.prototype.addEventListener = function(event, func){
    if(this.listeners[event]){
        this.listeners[event].push(func);
    }
};

VUI.Button.prototype.fireEvents = function(event){
    var ls = this.listeners[event];
    if(ls){
        for(var i = 0; i < ls.length; ++i){
            ls[i].call(this);
        }
    }
};