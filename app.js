// ==============================
// Firebase Imports (CDN modules)
// ==============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
// ==============================
// Firebase Configuration
// ==============================
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDjZqovy8TpWrEgpZcM84qULMSztRY5htE",
  authDomain: "mapbox-b1766.firebaseapp.com",
  databaseURL: "https://mapbox-b1766-default-rtdb.firebaseio.com",
  projectId: "mapbox-b1766",
  storageBucket: "mapbox-b1766.firebasestorage.app",
  messagingSenderId: "255708360478",
  appId: "1:255708360478:web:458e011fe32011c85e230f",
  measurementId: "G-VVG5ES8C7Z"
};



const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);


// Mapbox configuration

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-68.1193, -16.4897],
    zoom: 14
});

const size = 200;
const pulsingDot = {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),
    onAdd: function () {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        this.context = canvas.getContext('2d');
    },
    render: function () {
        const duration = 1000;
        const t = (performance.now() % duration) / duration;

        const radius = (size / 2) * 0.3;
        const outerRadius = (size / 2) * 0.7 * t + radius;
        const context = this.context;

        context.clearRect(0, 0, size, size);
        context.beginPath();
        context.arc(size / 2, size / 2, outerRadius, 0, Math.PI * 2);
        context.fillStyle = `rgba(180, 100, 255, ${1 - t})`;
        context.fill();

        context.beginPath();
        context.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
        context.fillStyle = 'rgba(138, 43, 226, 1)';
        context.strokeStyle = 'white';
        context.lineWidth = 2 + 4 * (1 - t);
        context.fill();
        context.stroke();

        this.data = context.getImageData(0, 0, size, size).data;
        map.triggerRepaint();
        return true;
    }
};


map.on('style.load', () => {
    map.addImage('pulsing-dot', pulsingDot, { pixelRatio: 2 });
});

let myMarker = null;
document.getElementById('btn-my-location').addEventListener('click', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;

                map.flyTo({
                    center: [longitude, latitude],
                    zoom: 16
                });

                if (!myMarker) {
                    myMarker = new mapboxgl.Marker({ color: '#6a0dad' })
                        .setLngLat([longitude, latitude])
                        .addTo(map);
                } else {
                    myMarker.setLngLat([longitude, latitude]);
                }
            },
            () => alert('Permiso de ubicación denegado')
        );
    }
});
const markers = {};
const userList = document.getElementById('user-list');
const locationRef = ref(database, 'locations');

onValue(locationRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    userList.innerHTML = "";

    for (let userId in data) {

    const user = data[userId];
    const lat = Number(user.latitude);
    const lon = Number(user.longitude);

    if (isNaN(lat) || isNaN(lon)) continue;

    const color = getColor(userId);

    const ahora = Date.now();
    const activo = (ahora - user.timestamp) < 10000;

    if (markers[userId]) {
        markers[userId].setLngLat([lon, lat]);
    } else {
        markers[userId] = new mapboxgl.Marker({ color })
            .setLngLat([lon, lat])
            .addTo(map);
    }

    crearUsuarioEnPanel(userId, user, lat, lon, color, activo);
}
});

let cacheData = {};

onValue(locationRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    cacheData = data; 

    userList.innerHTML = "";

    for (let userId in data) {
        const user = data[userId];
        const lat = Number(user.latitude);
        const lon = Number(user.longitude);

        if (!lat || !lon) continue;

        const color = getColor(userId);
        const ahora = Date.now();
        const activo = (ahora - user.timestamp) < 10000;

        // marker
        if (markers[userId]) {
            markers[userId].setLngLat([lon, lat]);
        } else {
            markers[userId] = new mapboxgl.Marker({ color })
                .setLngLat([lon, lat])
                .addTo(map);
        }

        crearUsuarioEnPanel(userId, user, lat, lon, color, activo);
    }
});

const panel = document.getElementById('user-panel');
document.getElementById('btn-child-location').addEventListener('click', () => {
    panel.classList.toggle('active');
});

const colores = {};
const listaColores = ['#ff0055', '#00c2ff', '#00ff88', '#ffcc00', '#aa00ff'];

function getColor(userId) {
    if (!colores[userId]) {
        colores[userId] = listaColores[Object.keys(colores).length % listaColores.length];
    }
    return colores[userId];
}
let geofenceState = {
    drawing: false,
    points: [],
    activeUser: null
};

let geocercasData = {};

function crearUsuarioEnPanel(userId, user, lat, lon, color, activo) {

    const div = document.createElement('div');
    div.className = 'user-item ' + (activo ? 'activo' : 'inactivo');

    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:10px;height:10px;border-radius:50%;background:${color};"></div>
                <span class="user-name">${user.name}</span>
            </div>
            <i class='bx bx-pencil edit-btn' style="cursor:pointer;"></i>
        </div>

        <div class="user-data">
            Lat: ${lat.toFixed(4)}<br>
            Lon: ${lon.toFixed(4)}<br>
            Hora: ${user.hora || '--'}
        </div>
    `;

    const editBtn = div.querySelector('.edit-btn');
    const nameSpan = div.querySelector('.user-name');

    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        const nuevo = prompt("Nuevo nombre:", nameSpan.textContent);
        if (!nuevo) return;

        const userRef = ref(database, 'locations/' + userId);

        import("https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js")
        .then(({ update }) => {
            update(userRef, { name: nuevo });
        });
    });

    const accionesDiv = document.createElement('div');
    accionesDiv.style.marginTop = "8px";

    if (!geocercasData[userId]) {

    const crearBtn = document.createElement('button');
    crearBtn.textContent = "Crear Geocerca";

    crearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        activarModoDibujo(userId);
    });

    accionesDiv.appendChild(crearBtn);

} else {

    const eliminarBtn = document.createElement('button');
    eliminarBtn.textContent = "Eliminar Geocerca";

    eliminarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        eliminarGeocerca(userId);
    });

    accionesDiv.appendChild(eliminarBtn);
}

    div.appendChild(accionesDiv);

    div.addEventListener('click', (e) => {
        if (
            e.target.classList.contains('edit-btn') ||
            e.target.tagName === 'BUTTON'
        ) return;

        map.flyTo({
            center: [lon, lat],
            zoom: 16,
            essential: true
        });
    });

    userList.appendChild(div);
}

const styles = {
    'street-view': 'mapbox://styles/mapbox/satellite-v9',
    'dark-mode':   'mapbox://styles/mapbox/dark-v10',
    'light-mode':  'mapbox://styles/mapbox/light-v10',
    'normal-view': 'mapbox://styles/mapbox/streets-v11'
};

const styleButtons = document.getElementById('style-buttons');
const toggleStyleButton = document.getElementById('btn-toggle-style');

let styleButtonsVisible = false;
toggleStyleButton.addEventListener('click', () => {
    styleButtonsVisible = !styleButtonsVisible;
    styleButtons.style.display = styleButtonsVisible ? 'flex' : 'none';
});

['street-view', 'dark-mode', 'light-mode', 'normal-view'].forEach((id) => {
    document.getElementById(id).addEventListener('click', () => {
        map.setStyle(styles[id]);
        styleButtons.style.display = 'none';
        styleButtonsVisible = false;
    });
});



function activarModoDibujo(userId) {
    geofenceState.drawing = true;
    geofenceState.points = [];
    geofenceState.activeUser = userId;

    alert("Modo dibujo activado: haz clic en el mapa");
}

map.on('click', (e) => {
    if (!geofenceState.drawing) return;

    const { lng, lat } = e.lngLat;

    const pts = geofenceState.points;

    if (pts.length > 2) {
        const [lng0, lat0] = pts[0];
        const dist = Math.hypot(lng - lng0, lat - lat0);

        if (dist < 0.00001) {
            cerrarGeocerca();
            return;
        }
    }

    pts.push([lng, lat]);
    dibujarLinea(pts);
});

function dibujarLinea(coords) {
    if (map.getSource('draw-line')) {
        map.getSource('draw-line').setData({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coords
            }
        });
        return;
    }

    map.addSource('draw-line', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coords
            }
        }
    });

    map.addLayer({
        id: 'draw-line-layer',
        type: 'line',
        source: 'draw-line',
        paint: {
            'line-color': '#00ff88',
            'line-width': 3
        }
    });
}
function cerrarGeocerca() {
    geofenceState.drawing = false;

    const coords = [...geofenceState.points];

    coords.push(coords[0]);

    dibujarPoligonoFinal(coords, geofenceState.activeUser);
    guardarGeocerca();

    alert("Geocerca creada");
}

function dibujarPoligonoFinal(coords, userId) {
    const id = 'geo-' + userId;

    if (map.getSource(id)) {
        map.getSource(id).setData({
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [coords]
            }
        });
        return;
    }

    map.addSource(id, {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [coords]
            }
        }
    });

    map.addLayer({
        id: id + '-fill',
        type: 'fill',
        source: id,
        paint: {
            'fill-color': '#00ff88',
            'fill-opacity': 0.2
        }
    });

    map.addLayer({
        id: id + '-line',
        type: 'line',
        source: id,
        paint: {
            'line-color': '#00ff88',
            'line-width': 2
        }
    });
}


const mensajesActivos = {};

function mostrarEvento(userId, mensaje, tipo = "alerta") {
    const contenedor = document.getElementById("eventos");

    let div = mensajesActivos[userId];

    if (!div) {
        div = document.createElement("div");
        div.className = "evento";
        contenedor.appendChild(div);
        mensajesActivos[userId] = div;
    }

    let color = "rgba(255, 0, 80, 0.9)";
    if (tipo === "ok") color = "rgba(0, 200, 120, 0.9)";

    const ahora = new Date();
    const hora = ahora.toLocaleTimeString();

    div.style.background = color;

    div.innerHTML = `
        ${mensaje}
        <small>${hora}</small>
    `;

    div.style.animation = "none";
    div.offsetHeight;
    div.style.animation = "aparecer 0.3s ease";

let duracion = 5000;
if (tipo === "ok") duracion = 2000;

clearTimeout(div.timer);
div.timer = setTimeout(() => {
    div.style.opacity = "0";
    setTimeout(() => {
        div.remove();
        delete mensajesActivos[userId];
    }, 300);
}, duracion);
}

function guardarGeocerca() {

    const geoRef = ref(database, 'geocercas/' + geofenceState.activeUser);

    set(geoRef, {
        puntos: geofenceState.points
    });
}

const geoRef = ref(database, 'geocercas');

onValue(geoRef, (snapshot) => {
    const data = snapshot.val() || {};
    geocercasData = data;

    if (!map.isStyleLoaded()) {
        map.once('load', () => renderGeocercas(data));
        return;
    }

    renderGeocercas(data);
});

function renderGeocercas(data) {
    Object.keys(data).forEach(userId => {
        const id = 'geo-' + userId;

        if (map.getLayer(id + '-fill')) map.removeLayer(id + '-fill');
        if (map.getLayer(id + '-line')) map.removeLayer(id + '-line');
        if (map.getSource(id)) map.removeSource(id);
    });

    for (let userId in data) {
        dibujarPoligonoFinal(data[userId].puntos, userId);
    }
}

let estadoPrevio = {};

onValue(ref(database, 'status'), (snap) => {
    const data = snap.val() || {};

    for (let userId in data) {
        const status = data[userId];
        const user = cacheData[userId];

        if (!user) continue;

        const ahora = Date.now();

if (!estadoPrevio[userId]) {
    estadoPrevio[userId] = { estado: null, tiempo: 0 };
}

const cambioEstado = estadoPrevio[userId].estado !== status.inside;
const tiempoPasado = ahora - estadoPrevio[userId].tiempo;

if (!cambioEstado && tiempoPasado < 2000) continue;

estadoPrevio[userId] = {
    estado: status.inside,
    tiempo: ahora
};
        const activo = (ahora - user.timestamp) < 10000;
        if (!activo) continue;

        const nombre = user.name || userId;

        if (status.inside === false) {
            mostrarEvento(userId, `⚠ ${nombre} se encuentra fuera de la geocerca`);
        } else {
            mostrarEvento(userId, `✔ ${nombre} se encuentra dentro de la geocerca`, "ok");
        }
    }
});

function eliminarGeocerca(userId) {
    const geoRef = ref(database, 'geocercas/' + userId);

    import("https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js")
    .then(({ remove }) => {
        remove(geoRef);
    });

    const id = 'geo-' + userId;

    if (map.getLayer(id + '-fill')) map.removeLayer(id + '-fill');
    if (map.getLayer(id + '-line')) map.removeLayer(id + '-line');
    if (map.getSource(id)) map.removeSource(id);

    if (map.getLayer('draw-line-layer')) map.removeLayer('draw-line-layer');
    if (map.getSource('draw-line')) map.removeSource('draw-line');

    geofenceState.points = [];
    geofenceState.drawing = false;
    geofenceState.activeUser = null;
}

// Zoom controls
document.getElementById('zoom-in').addEventListener('click', () => {
    map.zoomIn({ duration: 300 });
});
document.getElementById('zoom-out').addEventListener('click', () => {
    map.zoomOut({ duration: 300 });
});