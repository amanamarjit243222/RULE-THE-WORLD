// ================================================
// RULE THE WORLD — Map Layer v5
// js/map.js  (regular script)
// Fixes:
//   1. Planes use great-circle geodesic paths
//   2. Ships use coastal arc near-sea routes
//   3. Animation layer is ABOVE map transform (planes visible over map)
//   4. Player cannot pan/zoom beyond map extents
//   5. Clicking own country auto-shows your country name after 1.2s
// ================================================
"use strict";

let projection, path, zoom, mapG, labelGroup, seaOverlay, airOverlay;
let _mapColorThrottle = 0;
let _activeUnitCount = 0;
const MAX_UNITS = 80;

// -----------------------------------------------
// UNIT ICON REGISTRY
// Each entry: { path, rotOffset, scale }
// rotOffset: degrees added to travel angle so nose faces direction of travel.
// Planes/vertical SVGs (nose up): +90
// Ships/horizontal SVGs (nose right): 0
// -----------------------------------------------
const UNITS = {

    // ── COMMERCIAL AIRLINER (Detailed swept wing)
    PLANE: {
        path: `M 0,-16 C 1.5,-16 2.5,-12 2.5,-8 L 2.5,0 L 16,8 L 16,10 L 2.5,7 L 2.5,14 L 7,17 L 7,18 L 1.5,17 C 0,18 -0,18 0,18 C -0,18 -0,18 -1.5,17 L -7,18 L -7,17 L -2.5,14 L -2.5,7 L -16,10 L -16,8 L -2.5,0 L -2.5,-8 C -2.5,-12 -1.5,-16 0,-16 Z`,
        rotOffset: 90, scale: 0.75
    },

    // ── FIGHTER JET (Detailed delta shape)
    FIGHTER: {
        path: `M 0,-16 L 1.5,-6 L 12,2 L 12,4 L 3,3 L 2,10 L 5,14 L 5,15 L 0,13 L -5,15 L -5,14 L -2,10 L -3,3 L -12,4 L -12,2 L -1.5,-6 Z`,
        rotOffset: 90, scale: 0.7
    },

    // ── NAVAL DESTROYER (Detailed sleek hull)
    DESTROYER: {
        path: `M 18,0 C 12,-3 6,-3.5 0,-3.5 C -6,-3.5 -15,-2 -17,0 C -15,2 -6,3.5 0,3.5 C 6,3.5 12,3 18,0 Z M 8,-2 L 8,2 L -8,2 L -8,-2 Z M 5,-1 L 5,1 L -2,1 L -2,-1 Z M -10,-1 L -10,1 L -12,1 L -12,-1 Z`,
        rotOffset: 0, scale: 0.8
    },

    // ── CARGO VESSEL (Detailed wide hull with cargo blocks)
    CARGO_SHIP: {
        path: `M 16,0 C 14,-4 8,-4.5 -8,-4.5 C -14,-4.5 -17,-3 -18,0 C -17,3 -14,4.5 -8,4.5 C 8,4.5 14,4 16,0 Z 
               M -12,-3 L -12,3 L -8,3 L -8,-3 Z 
               M -6,-3 L -6,3 L -2,3 L -2,-3 Z 
               M 0,-3 L 0,3 L 4,3 L 4,-3 Z 
               M 6,-3 L 6,3 L 10,3 L 10,-3 Z`,
        rotOffset: 0, scale: 0.75
    },

    // ── CYBER PACKET (lightning bolt, tall → +90)
    CYBER: {
        path: `M 3.5,-8 L -1.5,0.5 L 2.5,1 L -3.5,8 L 1.5,1.5 L -1.5,1 Z`,
        rotOffset: 90, scale: 1.2
    },

    // ── TRADE CRATE (horizontal box → 0)
    TRADE_BOX: {
        path: `M -6,-4 L 6,-4 L 6,4 L -6,4 Z
               M -2,-4 L -2,4 M 2,-4 L 2,4
               M -6,0 L 6,0`,
        rotOffset: 0, scale: 0.9
    }
};

// -----------------------------------------------
// CENTROID CACHE (pixel coords in unzoomed space)
// -----------------------------------------------
const centroidCache = {};

function getCentroid(topoName) {
    if (centroidCache[topoName]) return centroidCache[topoName];
    if (!mapG || !path) return null;
    let datum = null;
    mapG.selectAll(".country").each(function (d) {
        if (d.properties && d.properties.name === topoName) datum = d;
    });
    if (datum) {
        const coords = path.centroid(datum);
        if (!isNaN(coords[0]) && !isNaN(coords[1])) {
            centroidCache[topoName] = coords;
            return coords;
        }
    }
    return null;
}

// Convert projected pixel [x,y] → geographic [lon,lat]
function pixelToGeo(px) {
    if (!projection) return null;
    return projection.invert(px);
}

// -----------------------------------------------
// GREAT-CIRCLE PLANE PATH GENERATOR
// Returns an array of {x,y} screen-space points
// following the geodesic between two screen points.
// -----------------------------------------------
function greatCirclePoints(p0screen, p2screen, numSteps) {
    if (!projection) return null;
    const g0 = pixelToGeo(p0screen);
    const g2 = pixelToGeo(p2screen);
    if (!g0 || !g2) return null;
    // d3.geoInterpolate interpolates along the great circle
    const interp = d3.geoInterpolate(g0, g2);
    const pts = [];
    for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        const geo = interp(t);
        const px = projection(geo);
        if (!px) return null; // projection failed (e.g., behind the globe)
        pts.push({ x: px[0], y: px[1] });
    }
    return pts;
}

// -----------------------------------------------
// A-STAR OCEAN ROUTING GRAPH
// 22 precisely placed deep-water waypoints preventing
// ships from ever crossing landmasses.
// -----------------------------------------------
const OCEAN_NODES = {
    0: { name: 'North Atlantic', lon: -35, lat: 40 },
    1: { name: 'Mid Atlantic', lon: -30, lat: 0 },
    2: { name: 'South Atlantic', lon: -20, lat: -35 },
    3: { name: 'Caribbean', lon: -75, lat: 15 },
    4: { name: 'Panama Canal', lon: -80, lat: 9 },
    5: { name: 'East Pacific', lon: -100, lat: 0 },
    6: { name: 'North Pacific', lon: -150, lat: 40 },
    7: { name: 'Mid Pacific', lon: 180, lat: 0 },
    8: { name: 'South Pacific', lon: -130, lat: -35 },
    9: { name: 'Drake Passage', lon: -65, lat: -58 },
    10: { name: 'Cape Good Hope', lon: 18, lat: -40 },
    11: { name: 'Indian Ocean', lon: 75, lat: -15 },
    12: { name: 'Arabian Sea', lon: 65, lat: 15 },
    13: { name: 'Gulf of Aden', lon: 47, lat: 12 },
    14: { name: 'Red Sea', lon: 38, lat: 20 },
    15: { name: 'Suez Canal', lon: 32.5, lat: 29.9 },
    16: { name: 'Mediterranean', lon: 15, lat: 37 },
    17: { name: 'Strait of Gibraltar', lon: -4, lat: 36 },
    18: { name: 'Malacca Strait', lon: 98, lat: 5 },
    19: { name: 'South China Sea', lon: 115, lat: 15 },
    20: { name: 'East China Sea', lon: 125, lat: 25 },
    21: { name: 'Bering Sea', lon: -170, lat: 55 }
};

// Connections defining the global maritime network
const OCEAN_EDGES = [
    [0, 1], [1, 2], [0, 3], [1, 3], [0, 17], [17, 16], [16, 15], [15, 14], [14, 13],
    [13, 12], [12, 11], [11, 18], [2, 10], [10, 11], [3, 4], [4, 5], [2, 9], [9, 8],
    [5, 6], [5, 8], [5, 7], [6, 7], [8, 7], [18, 19], [19, 20], [20, 7], [20, 6], [6, 21]
];

// Haversine great-circle distance (standard formula)
function geoDist(a, b) {
    const R = 6371; // km
    const dLat = (b[1] - a[1]) * Math.PI / 180;
    const dLon = (b[0] - a[0]) * Math.PI / 180;
    const lat1 = a[1] * Math.PI / 180;
    const lat2 = b[1] * Math.PI / 180;
    const a1 = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a1), Math.sqrt(1 - a1));
    return R * c;
}

// A* Pathfinding through the global maritime graph
function getSafeOceanRoute(origGeo, destGeo) {
    if (!origGeo || !destGeo) return [];

    // Find closest nodes to origin and destination
    let startNode = -1, endNode = -1;
    let minStartDist = Infinity, minEndDist = Infinity;

    for (const [id, node] of Object.entries(OCEAN_NODES)) {
        const dStart = geoDist(origGeo, [node.lon, node.lat]);
        const dEnd = geoDist(destGeo, [node.lon, node.lat]);
        if (dStart < minStartDist) { minStartDist = dStart; startNode = parseInt(id); }
        if (dEnd < minEndDist) { minEndDist = dEnd; endNode = parseInt(id); }
    }

    if (startNode === endNode) return []; // Too close, straight geodesic is fine

    // Build Adjacency Matrix
    const graph = {};
    for (const key in OCEAN_NODES) graph[key] = [];
    OCEAN_EDGES.forEach(([u, v]) => {
        const d = geoDist([OCEAN_NODES[u].lon, OCEAN_NODES[u].lat], [OCEAN_NODES[v].lon, OCEAN_NODES[v].lat]);
        graph[u].push({ node: v, cost: d });
        graph[v].push({ node: u, cost: d });
    });

    // A* Search
    const openSet = new Set([startNode]);
    const cameFrom = {};
    const gScore = {};
    const fScore = {};
    for (const key in OCEAN_NODES) { gScore[key] = Infinity; fScore[key] = Infinity; }
    gScore[startNode] = 0;
    fScore[startNode] = geoDist([OCEAN_NODES[startNode].lon, OCEAN_NODES[startNode].lat], destGeo);

    while (openSet.size > 0) {
        let curr = null;
        let lowestF = Infinity;
        openSet.forEach(node => {
            if (fScore[node] < lowestF) { lowestF = fScore[node]; curr = parseInt(node); }
        });

        if (curr === endNode) {
            // Reconstruct path
            const path = [];
            let n = curr;
            while (n in cameFrom) {
                path.unshift([OCEAN_NODES[n].lon, OCEAN_NODES[n].lat]);
                n = cameFrom[n];
            }
            path.unshift([OCEAN_NODES[startNode].lon, OCEAN_NODES[startNode].lat]);
            return path;
        }

        openSet.delete(curr);
        graph[curr].forEach(neighbor => {
            const nextNode = neighbor.node;
            const tentative_g = gScore[curr] + neighbor.cost;
            if (tentative_g < gScore[nextNode]) {
                cameFrom[nextNode] = curr;
                gScore[nextNode] = tentative_g;
                fScore[nextNode] = tentative_g + geoDist([OCEAN_NODES[nextNode].lon, OCEAN_NODES[nextNode].lat], destGeo);
                if (!openSet.has(nextNode)) openSet.add(nextNode);
            }
        });
    }
    return []; // No path found
}

// Build a screen-space point array for ships that routes strictly
// via the safe A* ocean graphs.
function shipOceanPoints(origGeo, destGeo, numSteps) {
    if (!projection || !origGeo || !destGeo) return null;

    const routeWaypoints = getSafeOceanRoute(origGeo, destGeo);
    // Full route: origin → [waypoints] → destination
    const geoRoute = [origGeo, ...routeWaypoints, destGeo];

    const pts = [];
    const segCount = geoRoute.length - 1;
    const stepsPerSeg = Math.ceil(numSteps / segCount);

    for (let seg = 0; seg < segCount; seg++) {
        const g0 = geoRoute[seg], g1 = geoRoute[seg + 1];
        const segInterp = d3.geoInterpolate(g0, g1);
        const steps = seg === segCount - 1 ? stepsPerSeg : stepsPerSeg;
        for (let i = (seg === 0 ? 0 : 1); i <= steps; i++) {
            const t = i / steps;
            let geo = segInterp(t);
            // Quick dateline wrap check for Pacific routes to prevent long horizontal splines
            if (geo[0] < -180 || geo[0] > 180) geo[0] = geo[0] > 180 ? geo[0] - 360 : geo[0] + 360;

            const px = projection(geo);
            if (!px || isNaN(px[0]) || isNaN(px[1])) continue;
            pts.push({ x: px[0], y: px[1] });
        }
    }
    return pts.length > 2 ? pts : null;
}


// -----------------------------------------------
// UNIT SPAWNER — animation overlay is anchored
// inside mapG, so units appear glued to the map
// and perfectly track during zoom and pan!
// -----------------------------------------------
function spawnCurvedUnit(originName, destName, unitType) {
    if (!mapG || !airOverlay || !seaOverlay || s.isPaused) return;
    if (_activeUnitCount >= MAX_UNITS) return;

    const orig = getCentroid(originName);
    const dest = getCentroid(destName);
    if (!orig || !dest) return;

    // Map units directly onto projection coordinates
    const oScreen = orig;
    const dScreen = dest;

    const dx = dScreen[0] - oScreen[0], dy = dScreen[1] - oScreen[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10) return;

    // Jitter start/end slightly
    const oX = oScreen[0] + (Math.random() - 0.5) * 4;
    const oY = oScreen[1] + (Math.random() - 0.5) * 4;
    const dX = dScreen[0] + (Math.random() - 0.5) * 4;
    const dY = dScreen[1] + (Math.random() - 0.5) * 4;

    let def, color, trailColor, duration, trailDash, isAirUnit, dotColor;

    switch (unitType) {
        case 'NORMAL_TRADE':
            if (Math.random() > 0.45) {
                def = UNITS.CARGO_SHIP; color = 'rgba(16,185,129,0.9)';
                trailColor = 'rgba(16,185,129,0.12)'; duration = dist * 250;
                trailDash = '4,6'; isAirUnit = false; dotColor = '#34d399';
            } else {
                def = UNITS.PLANE; color = 'rgba(200,215,240,0.85)';
                trailColor = 'rgba(200,215,240,0.07)'; duration = dist * 120;
                trailDash = '3,5'; isAirUnit = true; dotColor = '#93c5fd';
            }
            break;
        case 'MILITARY':
            if (Math.random() > 0.35) {
                def = UNITS.FIGHTER; color = 'rgba(239,68,68,0.95)';
                trailColor = 'rgba(239,68,68,0.3)'; duration = dist * 100;
                trailDash = '2,3'; isAirUnit = true; dotColor = '#fca5a5';
            } else {
                def = UNITS.DESTROYER; color = 'rgba(200,30,30,0.9)';
                trailColor = 'rgba(200,30,30,0.2)'; duration = dist * 220;
                trailDash = '2,4'; isAirUnit = false; dotColor = '#ef4444';
            }
            break;
        case 'TRADE_WAR':
            def = UNITS.CARGO_SHIP; color = 'rgba(249,115,22,0.9)';
            trailColor = 'rgba(249,115,22,0.2)'; duration = dist * 240;
            trailDash = '5,7'; isAirUnit = false; dotColor = '#fdba74';
            break;
        case 'CYBER':
            def = UNITS.CYBER; color = 'rgba(6,182,212,0.95)';
            trailColor = 'rgba(6,182,212,0.4)'; duration = dist * 60;
            trailDash = '1,2'; isAirUnit = true; dotColor = '#67e8f9';
            break;
        default:
            def = UNITS.PLANE; color = 'rgba(180,195,220,0.8)';
            trailColor = 'rgba(180,195,220,0.05)'; duration = dist * 120;
            trailDash = '3,5'; isAirUnit = true; dotColor = '#cbd5e1';
    }

    // Compute path points
    const NUM_STEPS = 60;
    let pts;
    if (isAirUnit) {
        // Planes: great-circle geodesic path
        pts = greatCirclePoints([oX, oY], [dX, dY], NUM_STEPS);
        if (!pts) {
            // Fallback: quadratic bezier
            const curveFactor = 0.18 * (Math.random() > 0.5 ? 1 : -1);
            const cxB = (oX + dX) / 2 - dy * curveFactor;
            const cyB = (oY + dY) / 2 + dx * curveFactor;
            pts = [];
            for (let i = 0; i <= NUM_STEPS; i++) {
                const t = i / NUM_STEPS;
                pts.push({
                    x: (1 - t) * (1 - t) * oX + 2 * (1 - t) * t * cxB + t * t * dX,
                    y: (1 - t) * (1 - t) * oY + 2 * (1 - t) * t * cyB + t * t * dY
                });
            }
        }
    } else {
        // Ships: route via strict geographic ocean waypoints to stay perfectly on water
        const origGeo = projection.invert([oX, oY]);
        const destGeo = projection.invert([dX, dY]);
        if (origGeo && destGeo) {
            // Because animationOverlay is inside mapG, we use RAW projection points! No `.apply(currentTransform)`
            pts = shipOceanPoints(origGeo, destGeo, NUM_STEPS);
        }
        // Fallback: simple perpendicular bulge arc (screen space)
        if (!pts || pts.length < 3) {
            const perpX2 = -dy / Math.max(dist, 1), perpY2 = dx / Math.max(dist, 1);
            const bulge = dist * 0.2 * (Math.random() > 0.5 ? 1 : -1);
            const cxS = (oX + dX) / 2 + perpX2 * bulge;
            const cyS = (oY + dY) / 2 + perpY2 * bulge;
            pts = [];
            for (let i = 0; i <= NUM_STEPS; i++) {
                const t = i / NUM_STEPS;
                pts.push({
                    x: (1 - t) * (1 - t) * oX + 2 * (1 - t) * t * cxS + t * t * dX,
                    y: (1 - t) * (1 - t) * oY + 2 * (1 - t) * t * cyS + t * t * dY
                });
            }
        }
    }

    _activeUnitCount++;

    // Build SVG path string for the trail
    let trailD = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
        trailD += ` L ${pts[i].x},${pts[i].y}`;
    }

    // Trail
    const targetLayer = isAirUnit ? airOverlay : seaOverlay;
    const trail = targetLayer.append("path")
        .attr("d", trailD)
        .attr("fill", "none")
        .attr("stroke", trailColor)
        .attr("stroke-width", unitType === 'MILITARY' ? 0.9 : 0.6)
        .attr("stroke-dasharray", trailDash)
        .style("opacity", 0)
        .style("pointer-events", "none");
    trail.transition().duration(250).style("opacity", 1)
        .transition().delay(duration).duration(350)
        .style("opacity", 0).remove();

    // Unit group with will-change to optimize rendering lag
    const unit = targetLayer.append("g")
        .style("opacity", 0)
        .style("pointer-events", "none")
        .style("will-change", "transform");

    // Compute dynamic scale based on current map zoom so units don't stay huge
    const currentTransform = d3.zoomTransform(d3.select("#world-svg").node());
    const dynamicScale = def.scale / Math.max(1, Math.sqrt(currentTransform.k));

    // Drop shadow (dynamic offset for planes to simulate flying high above)
    const shadowOffset = isAirUnit ? "translate(1.8, 2.5)" : "translate(0.5, 0.8)";
    unit.append("path").attr("d", def.path)
        .style("fill", "rgba(0,0,0,0.35)")
        .attr("transform", `scale(${dynamicScale}) ${shadowOffset}`);

    // Icon
    unit.append("path").attr("d", def.path)
        .style("fill", color)
        .style("stroke", "rgba(255,255,255,0.2)")
        .style("stroke-width", "0.4px")
        .attr("transform", `scale(${dynamicScale})`);

    // Plague Inc glowing leading dot
    // If unit faces +90 (plane), dot goes at top (0, -18)
    // If unit faces 0 (ship), dot goes at right (18, 0)
    const dotX = def.rotOffset === 90 ? 0 : 18;
    const dotY = def.rotOffset === 90 ? -18 : 0;

    unit.append("circle")
        .attr("cx", dotX)
        .attr("cy", dotY)
        .attr("r", 4)
        .style("fill", dotColor)
        .style("filter", "drop-shadow(0 0 4px " + dotColor + ")")
        .attr("transform", `scale(${dynamicScale})`);

    // Animate along the precomputed path array
    unit.transition().duration(240).style("opacity", 1)
        .transition().duration(duration).ease(d3.easeLinear)
        .attrTween("transform", () => {
            return t => {
                const idx = Math.min(Math.floor(t * (pts.length - 1)), pts.length - 2);
                const localT = t * (pts.length - 1) - idx;
                const x = pts[idx].x + localT * (pts[idx + 1].x - pts[idx].x);
                const y = pts[idx].y + localT * (pts[idx + 1].y - pts[idx].y);
                const tx = pts[idx + 1].x - pts[idx].x;
                const ty = pts[idx + 1].y - pts[idx].y;
                const angle = Math.atan2(ty, tx) * 180 / Math.PI + def.rotOffset;
                return `translate(${x},${y}) rotate(${angle})`;
            };
        })
        .transition().duration(240).style("opacity", 0)
        .on("end", () => { _activeUnitCount = Math.max(0, _activeUnitCount - 1); })
        .remove();
}

// -----------------------------------------------
// MAP INIT
// -----------------------------------------------
async function initMap() {
    const projFunc = typeof d3.geoMiller === 'function' ? d3.geoMiller : d3.geoNaturalEarth1;
    const svg = d3.select("#world-svg");
    svg.selectAll("*").remove();

    const defs = svg.append("defs");

    // War gradient
    const wg = defs.append("linearGradient").attr("id", "war-gradient")
        .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
    wg.append("stop").attr("id", "grad-attacker").attr("offset", "50%").attr("stop-color", "rgba(239,68,68,0.85)");
    wg.append("stop").attr("id", "grad-defender").attr("offset", "50%").attr("stop-color", "rgba(30,10,10,0.85)");

    // Annexed pattern
    const pat = defs.append("pattern").attr("id", "annexed-pattern")
        .attr("width", 6).attr("height", 6).attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)");
    pat.append("rect").attr("width", 6).attr("height", 6).attr("fill", "rgba(153,27,27,0.45)");
    pat.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6)
        .attr("stroke", "rgba(239,68,68,0.7)").attr("stroke-width", 1.8);

    // Player glow
    const flt = defs.append("filter").attr("id", "player-glow")
        .attr("x", "-30%").attr("y", "-30%").attr("width", "160%").attr("height", "160%");
    flt.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", "2.5").attr("result", "blur");
    const mg = flt.append("feMerge");
    mg.append("feMergeNode").attr("in", "blur");
    mg.append("feMergeNode").attr("in", "SourceGraphic");

    const container = document.getElementById('world-map-container');
    const W = container.clientWidth || 800;
    const H = container.clientHeight || 500;

    projection = projFunc().scale(W / 5.8).translate([W / 2, H / 1.75]);
    path = d3.geoPath().projection(projection);

    // ---- ZOOM with strict boundary so player cannot go beyond the map ----
    let _zoomRaf = null;
    zoom = d3.zoom()
        .scaleExtent([0.85, 22])
        .translateExtent([
            [-W * 0.18, -H * 0.18],
            [W * 1.18, H * 1.18]
        ])
        .on("zoom", event => {
            mapG.attr("transform", event.transform);
            if (_zoomRaf) cancelAnimationFrame(_zoomRaf);
            _zoomRaf = requestAnimationFrame(() => {
                const k = event.transform.k;
                mapG.selectAll(".country").style("stroke-width", (0.38 / k) + "px");
                mapG.selectAll(".country-label").style("opacity", k > 3 ? 1 : 0);
            });
        });
    svg.call(zoom);

    // mapG: the group that gets zoom/pan transform (land + labels + units inside)
    mapG = svg.append("g").attr("id", "map-layer");
    labelGroup = mapG.append("g").attr("class", "labels-layer");

    // seaOverlay: INSIDE mapG so ships stay anchored to geographic coords
    seaOverlay = mapG.append("g")
        .attr("id", "sea-overlay")
        .style("pointer-events", "none");

    // airOverlay: Added AFTER seaOverlay so planes render strictly ON TOP of ships
    airOverlay = mapG.append("g")
        .attr("id", "air-overlay")
        .style("pointer-events", "none");

    const world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");

    // India full polygon fix - Merge India (ID 356) and Kashmir/Disputed regions (ID -99)
    const geoms = world.objects.countries.geometries;
    let indiaGeoms = [], otherGeoms = [];
    geoms.forEach(g => {
        const gid = parseInt(g.id);
        if (gid === 356 || gid === -99) {
            indiaGeoms.push(g);
        } else {
            otherGeoms.push(g);
        }
    });

    const namedWorld = topojson.feature(world, world.objects.countries);
    let indiaFeature;
    try {
        const mergedGeom = indiaGeoms.length > 0
            ? topojson.merge(world, indiaGeoms.filter(g => g.type !== undefined))
            : null;
        indiaFeature = {
            type: "Feature", properties: { name: "India" },
            geometry: mergedGeom || namedWorld.features.find(f => f.properties.name === 'India')?.geometry
        };
    } catch (e) {
        indiaFeature = namedWorld.features.find(f => f.properties.name === 'India')
            || { type: "Feature", properties: { name: "India" }, geometry: null };
        indiaFeature.properties = { name: "India" };
    }

    const otherFeatures = topojson.feature(world, { type: "GeometryCollection", geometries: otherGeoms }).features;
    const allCountries = [...otherFeatures, indiaFeature].filter(f => f.geometry);

    mapG.selectAll(".country")
        .data(allCountries).enter().append("path")
        .attr("class", d => getCountryClass(d.properties.name))
        .attr("d", path)
        .on("click", (event, d) => {
            if (d.properties && d.properties.name) selectMapCountry(d.properties.name);
        });

    // Country labels (lazy — only visible at zoom > 3)
    mapG.selectAll(".country-label")
        .data(allCountries.filter(f => path.area(f) > 250))
        .enter().append("text")
        .attr("class", "label country-label")
        .attr("transform", d => `translate(${path.centroid(d)})`)
        .attr("text-anchor", "middle").attr("dy", "0.35em")
        .text(d => d.properties.name)
        .style("opacity", 0);

    // Continent ghost labels
    [["NORTH AMERICA", [-100, 40]], ["SOUTH AMERICA", [-58, -15]],
    ["EUROPE", [15, 54]], ["AFRICA", [20, 5]], ["ASIA", [90, 45]], ["OCEANIA", [135, -25]]]
        .forEach(([name, coords]) => {
            const px = projection(coords);
            if (px) labelGroup.append("text").attr("class", "label continent-label")
                .attr("x", px[0]).attr("y", px[1]).attr("text-anchor", "middle").text(name);
        });

    // Controls
    d3.select("#zoom-in").on("click", () => svg.transition().duration(250).call(zoom.scaleBy, 1.65));
    d3.select("#zoom-out").on("click", () => svg.transition().duration(250).call(zoom.scaleBy, 0.6));
    d3.select("#reset-btn").on("click", () => svg.transition().duration(450).call(zoom.transform, d3.zoomIdentity));

    d3.select("#map-loading").transition().duration(300).style("opacity", 0).remove();
    setTimeout(() => {
        if (s && s.c && s.c.topo) selectMapCountry(s.c.topo);
        animateTicker();
    }, 380);
}

// -----------------------------------------------
// MAP COLOR ENGINE (throttled)
// -----------------------------------------------
function getCountryClass(topoName) {
    if (!topoName) return "country country-neutral";
    if (s.activeWar && s.activeWar.defender === topoName) return "country country-war-target";
    if (s.c && topoName === s.c.topo) return "country country-player";
    if (s.occupiedTerritories && s.occupiedTerritories.includes(topoName)) return "country country-annexed";
    if (s.mapMode === 'ALIGN') {
        const gid = Object.keys(gameDB.factions).find(id => gameDB.factions[id].topo === topoName);
        if (gid) {
            const a = gameDB.factions[gid].align;
            return `country ${a === 'RIVAL' ? 'country-rival' : a === 'ALLY' ? 'country-ally' : 'country-rising'}`;
        }
    } else if (s.mapMode === 'STAB') {
        const h = (topoName.charCodeAt(0) * 7 + topoName.length * 13) % 100;
        const stab = Math.max(0, Math.min(100, h - s.tension * 0.2));
        return stab > 60 ? "country country-stab-high" : stab > 30 ? "country country-stab-mid" : "country country-stab-low";
    } else if (s.mapMode === 'ECON') {
        const gid = Object.keys(gameDB.factions).find(id => gameDB.factions[id].topo === topoName);
        const gdp = gid ? gameDB.factions[gid].gdp : (topoName.charCodeAt(0) * 3 + topoName.length) % 6 - 1;
        return gdp > 4 ? "country country-econ-high" : gdp > 1 ? "country country-econ-mid" : "country country-econ-low";
    }
    return "country country-neutral";
}

function updateMapColors() {
    if (!mapG || !s.c) return;
    const now = Date.now();
    if (now - _mapColorThrottle < 900) return;
    _mapColorThrottle = now;
    requestAnimationFrame(() => {
        const sel = document.getElementById('country-name')?.innerText;
        mapG.selectAll(".country").attr("class", d => {
            const name = d.properties && d.properties.name;
            let cls = getCountryClass(name);
            if (sel && sel === name && name !== s.c.topo && !cls.includes("country-war")) cls += " country-active";
            return cls;
        });
        mapG.selectAll(".country")
            .filter(d => d.properties && d.properties.name === s.c.topo)
            .style("filter", "url(#player-glow)");
    });
}

// -----------------------------------------------
// COUNTRY SELECTION
// Locks onto any country clicked persistently.
// -----------------------------------------------
function selectMapCountry(topoName) {
    if (!mapG || !s.c || !topoName) return;
    mapG.selectAll(".country").classed("country-active", false);
    mapG.selectAll(".country")
        .filter(d => d.properties && d.properties.name === topoName)
        .classed("country-active", true).raise();
    if (s.activeWar) updateMapColors();

    const isOwned = (topoName === s.c.topo || s.occupiedTerritories.includes(topoName));
    const warBox = document.getElementById('war-options-box');
    const foreignPnl = document.getElementById('foreign-stats-panel');
    const demoPnl = document.getElementById('demo-panel');

    if (isOwned) {
        s.selectedForeignCountry = null;
        if (warBox) warBox.classList.add('hidden');
        if (foreignPnl) foreignPnl.classList.add('hidden');
        if (demoPnl) demoPnl.classList.remove('hidden');

        safeSetText('country-name', s.c.name);
        safeSetText('country-alignment', s.c.alignment || 'RISING');
        renderTraits(topoName === s.c.topo ? s.c.traits
            : ['Annexed Region', 'Under Military Administration', 'Tribute-Paying Territory']);
        updateUI();

    } else {
        s.selectedForeignCountry = topoName;
        if (warBox) warBox.classList.remove('hidden');
        if (foreignPnl) foreignPnl.classList.remove('hidden');
        if (demoPnl) demoPnl.classList.add('hidden');

        safeSetText('country-name', topoName);
        safeSetText('country-alignment', 'FOREIGN NATION');
        const h = Array.from(topoName).reduce((a, c) => a + c.charCodeAt(0), 0);
        const stab = 25 + (h * 17) % 60, qli = 20 + (h * 13) % 65;
        safeSetText('val-stability', stab + '%'); safeSetWidth('bar-stability', stab + '%');
        safeSetText('val-qli', qli + '%'); safeSetWidth('bar-qli', qli + '%');
        const fid = Object.keys(gameDB.factions).find(id => gameDB.factions[id].topo === topoName);
        if (fid) {
            const ff = gameDB.factions[fid];
            renderTraits([`Alignment: ${ff.align}`, `GDP Growth: ${(ff.gdp > 0 ? '+' : '') + ff.gdp}%`,
            `Tier ${ff.tier} Power`, ...ff.traits.slice(0, 2)]);
            safeSetText('country-alignment', ff.align + ' NATION');
        } else {
            renderTraits(['Intel: Classified', 'Sovereign State', 'No Treaty Status']);
        }
    }
}
