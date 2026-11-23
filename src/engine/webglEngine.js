/* ==========================================================================
   Original Multipass WebGL 2.0 / 1.0 Engine — Round 02 Visual Upgrade
   Upgrades over Round 01:
   1. Smooth-Filleted High-Tessellation 3D Ring (200x20 smooth vertex normals)
   2. Smooth Swept-Tube Architectural Inner Monogram (replaces blocky polygons)
   3. Smooth Swept Biomechanical Rib-Spine in Scene 2 (26 organic curved pairs)
   4. Procedural Studio HDRI Reflection + Physical Thin-Film Iridescence Shader
   5. Spring-Damped Secondary Motion & Camera Roll Inertia
   6. Zero-Overlap Mobile Spatial Separation (3D Ring 13-45% H, Headline 50-65% H)
   ========================================================================== */

(function () {
  "use strict";

  const Mat4 = {
    create() {
      const m = new Float32Array(16);
      m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
      return m;
    },
    perspective(out, fovy, aspect, near, far) {
      const f = 1.0 / Math.tan(fovy / 2);
      out.fill(0);
      out[0] = f / aspect;
      out[5] = f;
      out[10] = (far + near) / (near - far);
      out[11] = -1;
      out[14] = (2 * far * near) / (near - far);
      return out;
    },
    lookAt(out, eye, center, up) {
      let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
      let len = Math.hypot(zx, zy, zz) || 1;
      zx /= len; zy /= len; zz /= len;
      let xx = up[1] * zz - up[2] * zy;
      let xy = up[2] * zx - up[0] * zz;
      let xz = up[0] * zy - up[1] * zx;
      len = Math.hypot(xx, xy, xz) || 1;
      xx /= len; xy /= len; xz /= len;
      const yx = zy * xz - zz * xy;
      const yy = zz * xx - zx * xz;
      const yz = zx * xy - zy * xx;
      out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
      out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
      out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
      out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
      out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
      out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
      out[15] = 1;
      return out;
    },
    fromTRS(out, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
      const cx = Math.cos(rx), sxn = Math.sin(rx);
      const cy = Math.cos(ry), syn = Math.sin(ry);
      const cz = Math.cos(rz), szn = Math.sin(rz);
      out[0] = (cy * cz) * sx;
      out[1] = (cy * szn) * sx;
      out[2] = (-syn) * sx;
      out[3] = 0;
      out[4] = (sxn * syn * cz - cx * szn) * sy;
      out[5] = (sxn * syn * szn + cx * cz) * sy;
      out[6] = (sxn * cy) * sy;
      out[7] = 0;
      out[8] = (cx * syn * cz + sxn * szn) * sz;
      out[9] = (cx * syn * szn - sxn * cz) * sz;
      out[10] = (cx * cy) * sz;
      out[11] = 0;
      out[12] = tx;
      out[13] = ty;
      out[14] = tz;
      out[15] = 1;
      return out;
    }
  };

  function hexToRgb01(hex) {
    const clean = (hex || "#03060a").replace("#", "");
    const num = parseInt(clean.length === 3
      ? clean.split("").map(c => c + c).join("")
      : clean, 16) || 0;
    return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
  }

  /* ---------- Squared-Corner Technical Vector Glyph Renderer ---------- */
  const TECH_GLYPHS = {
    A: [[[0.08,1],[0.08,0.22],[0.26,0],[0.74,0],[0.92,0.22],[0.92,1]], [[0.08,0.54],[0.92,0.54]]],
    B: [[[0.08,0],[0.72,0],[0.88,0.14],[0.88,0.38],[0.74,0.48],[0.08,0.48]], [[0.74,0.48],[0.92,0.60],[0.92,0.86],[0.74,1],[0.08,1],[0.08,0]]],
    C: [[[0.92,0.22],[0.76,0],[0.24,0],[0.08,0.18],[0.08,0.82],[0.24,1],[0.76,1],[0.92,0.78]]],
    D: [[[0.08,0],[0.68,0],[0.92,0.22],[0.92,0.78],[0.68,1],[0.08,1],[0.08,0]]],
    E: [[[0.90,0],[0.08,0],[0.08,1],[0.90,1]], [[0.08,0.49],[0.76,0.49]]],
    F: [[[0.90,0],[0.08,0],[0.08,1]], [[0.08,0.49],[0.76,0.49]]],
    G: [[[0.90,0.20],[0.74,0],[0.24,0],[0.08,0.18],[0.08,0.82],[0.24,1],[0.76,1],[0.92,0.82],[0.92,0.52],[0.52,0.52]]],
    H: [[[0.08,0],[0.08,1]], [[0.92,0],[0.92,1]], [[0.08,0.49],[0.92,0.49]]],
    I: [[[0.22,0],[0.78,0]], [[0.50,0],[0.50,1]], [[0.22,1],[0.78,1]]],
    J: [[[0.26,0],[0.84,0],[0.84,0.82],[0.66,1],[0.24,1],[0.08,0.82]]],
    K: [[[0.10,0],[0.10,1]], [[0.88,0],[0.24,0.50],[0.10,0.50]], [[0.28,0.48],[0.90,1]]],
    L: [[[0.10,0],[0.10,1],[0.90,1]]],
    M: [[[0.06,1],[0.06,0],[0.50,0.54],[0.94,0],[0.94,1]]],
    N: [[[0.08,1],[0.08,0],[0.92,1],[0.92,0]]],
    O: [[[0.24,0],[0.76,0],[0.92,0.18],[0.92,0.82],[0.76,1],[0.24,1],[0.08,0.82],[0.08,0.18],[0.24,0]]],
    P: [[[0.08,1],[0.08,0],[0.74,0],[0.92,0.16],[0.92,0.38],[0.74,0.54],[0.08,0.54]]],
    Q: [[[0.24,0],[0.76,0],[0.92,0.18],[0.92,0.82],[0.76,1],[0.24,1],[0.08,0.82],[0.08,0.18],[0.24,0]], [[0.58,0.68],[0.94,1.04]]],
    R: [[[0.08,1],[0.08,0],[0.74,0],[0.92,0.16],[0.92,0.36],[0.74,0.52],[0.08,0.52]], [[0.56,0.52],[0.92,1]]],
    S: [[[0.90,0.18],[0.74,0],[0.24,0],[0.08,0.15],[0.08,0.36],[0.24,0.49],[0.76,0.49],[0.92,0.64],[0.92,0.85],[0.76,1],[0.24,1],[0.08,0.82]]],
    T: [[[0.04,0],[0.96,0]], [[0.50,0],[0.50,1]]],
    U: [[[0.08,0],[0.08,0.82],[0.26,1],[0.74,1],[0.92,0.82],[0.92,0]]],
    V: [[[0.06,0],[0.50,1],[0.94,0]]],
    W: [[[0.04,0],[0.26,1],[0.50,0.42],[0.74,1],[0.96,0]]],
    X: [[[0.08,0],[0.92,1]], [[0.92,0],[0.08,1]]],
    Y: [[[0.06,0],[0.50,0.50],[0.94,0]], [[0.50,0.50],[0.50,1]]],
    Z: [[[0.08,0],[0.92,0],[0.08,1],[0.92,1]]],
    "0": [[[0.24,0],[0.76,0],[0.92,0.18],[0.92,0.82],[0.76,1],[0.24,1],[0.08,0.82],[0.08,0.18],[0.24,0]], [[0.18,0.84],[0.82,0.16]]],
    "1": [[[0.26,0.18],[0.52,0],[0.52,1]], [[0.22,1],[0.82,1]]],
    "2": [[[0.10,0.20],[0.26,0],[0.74,0],[0.90,0.18],[0.90,0.40],[0.10,1],[0.92,1]]],
    "3": [[[0.10,0.16],[0.26,0],[0.74,0],[0.90,0.18],[0.90,0.38],[0.72,0.49],[0.38,0.49]], [[0.72,0.49],[0.92,0.64],[0.92,0.84],[0.74,1],[0.26,1],[0.10,0.84]]],
    "4": [[[0.74,1],[0.74,0],[0.08,0.66],[0.94,0.66]]],
    "5": [[[0.88,0],[0.12,0],[0.12,0.46],[0.74,0.46],[0.92,0.62],[0.92,0.84],[0.74,1],[0.24,1],[0.08,0.84]]],
    "6": [[[0.86,0.16],[0.70,0],[0.26,0],[0.08,0.20],[0.08,0.82],[0.26,1],[0.74,1],[0.92,0.82],[0.92,0.58],[0.74,0.46],[0.08,0.46]]],
    "7": [[[0.08,0],[0.92,0],[0.36,1]]],
    "8": [[[0.26,0],[0.74,0],[0.90,0.16],[0.90,0.36],[0.74,0.49],[0.26,0.49],[0.10,0.36],[0.10,0.16],[0.26,0]], [[0.26,0.49],[0.08,0.64],[0.08,0.84],[0.26,1],[0.74,1],[0.92,0.84],[0.92,0.64],[0.74,0.49]]],
    "9": [[[0.92,0.52],[0.26,0.52],[0.08,0.38],[0.08,0.18],[0.26,0],[0.74,0],[0.92,0.18],[0.92,0.82],[0.74,1],[0.24,1]]],
    "-": [[[0.18,0.50],[0.82,0.50]]],
    "/": [[[0.16,1],[0.84,0]]],
    ".": [[[0.44,0.90],[0.56,0.90],[0.56,1],[0.44,1],[0.44,0.90]]],
    "·": [[[0.44,0.45],[0.56,0.45],[0.56,0.55],[0.44,0.55],[0.44,0.45]]],
    "!": [[[0.50,0],[0.50,0.72]], [[0.46,0.90],[0.54,0.90]]],
    "&": [[[0.88,1],[0.16,0.34],[0.16,0.14],[0.34,0],[0.62,0],[0.76,0.14],[0.76,0.32],[0.10,0.70],[0.10,0.86],[0.28,1],[0.66,1],[0.90,0.72]]]
  };

  function drawTechLine(ctx, text, x, y, charW, charH, tracking, strokeW, colorStr) {
    const str = (text || "").toUpperCase();
    ctx.save();
    ctx.strokeStyle = colorStr || "#ffffff";
    ctx.fillStyle = colorStr || "#ffffff";
    ctx.lineWidth = strokeW;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.miterLimit = 4;

    let cursorX = x;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === " ") {
        cursorX += charW * 0.56 + tracking;
        continue;
      }
      const strokes = TECH_GLYPHS[ch];
      if (strokes) {
        const w = (ch === "I" || ch === "1" || ch === "!") ? charW * 0.64 : (ch === "M" || ch === "W") ? charW * 1.12 : charW;
        for (let s = 0; s < strokes.length; s++) {
          const pts = strokes[s];
          ctx.beginPath();
          ctx.moveTo(cursorX + pts[0][0] * w, y + pts[0][1] * charH);
          for (let p = 1; p < pts.length; p++) {
            ctx.lineTo(cursorX + pts[p][0] * w, y + pts[p][1] * charH);
          }
          ctx.stroke();
        }
        cursorX += w + tracking;
      } else {
        ctx.font = `600 ${Math.round(charH * 1.06)}px "Chakra Petch", "Inter Display", sans-serif`;
        ctx.fillText(ch, cursorX, y + charH * 0.94);
        cursorX += ctx.measureText(ch).width + tracking * 0.55;
      }
    }
    ctx.restore();
  }

  /* ---------- High-Quality Smooth-Normal 3D Geometry Builders ---------- */
  function combineMeshes(list) {
    let totalVerts = 0;
    let totalIdx = 0;
    for (const m of list) {
      totalVerts += m.positions.length / 3;
      totalIdx += m.indices.length;
    }
    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const partIds = new Float32Array(totalVerts);
    const indices = new Uint32Array(totalIdx);

    let vOffset = 0;
    let iOffset = 0;
    for (const m of list) {
      positions.set(m.positions, vOffset * 3);
      normals.set(m.normals, vOffset * 3);
      const pVal = m.partId || 0;
      for (let k = 0; k < m.positions.length / 3; k++) {
        partIds[vOffset + k] = pVal;
      }
      for (let k = 0; k < m.indices.length; k++) {
        indices[iOffset + k] = m.indices[k] + vOffset;
      }
      vOffset += m.positions.length / 3;
      iOffset += m.indices.length;
    }
    return { positions, normals, partIds, indices };
  }

  /* Smooth-Filleted Machined Rectangular Annulus Ring (200 radial x 24 superellipse profile)
     Eliminates faceted polygon banding; produces liquid-chrome specular streaks */
  function createSmoothFilletedRing(rInner, rOuter, halfDepth, radialSegs, profileSegs, partId) {
    const midR = (rInner + rOuter) * 0.5;
    const halfW = (rOuter - rInner) * 0.5;
    const expN = 4.2; // Machined rounded-bevel superellipse exponent

    const profile = [];
    for (let j = 0; j <= profileSegs; j++) {
      const a = (j / profileSegs) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const sgnC = ca >= 0 ? 1 : -1;
      const sgnS = sa >= 0 ? 1 : -1;
      const pr = midR + sgnC * Math.pow(Math.abs(ca), 2 / expN) * halfW;
      const pz = sgnS * Math.pow(Math.abs(sa), 2 / expN) * halfDepth;

      // Exact analytic gradient normal of superellipse
      let nr = sgnC * Math.pow(Math.abs(ca), 2 - 2 / expN) / Math.max(halfW, 0.001);
      let nz = sgnS * Math.pow(Math.abs(sa), 2 - 2 / expN) / Math.max(halfDepth, 0.001);
      const nl = Math.hypot(nr, nz) || 1;
      profile.push([pr, pz, nr / nl, nz / nl]);
    }

    const positions = [];
    const normals = [];
    const indices = [];

    for (let i = 0; i <= radialSegs; i++) {
      const theta = (i / radialSegs) * Math.PI * 2;
      const ct = Math.cos(theta), st = Math.sin(theta);
      for (let j = 0; j <= profileSegs; j++) {
        const [pr, pz, nr, nz] = profile[j];
        positions.push(pr * ct, pr * st, pz);
        normals.push(nr * ct, nr * st, nz);
      }
    }

    const stride = profileSegs + 1;
    for (let i = 0; i < radialSegs; i++) {
      for (let j = 0; j < profileSegs; j++) {
        const a = i * stride + j;
        const b = (i + 1) * stride + j;
        const c = b + 1;
        const d = a + 1;
        indices.push(a, b, d, b, c, d);
      }
    }
    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint32Array(indices),
      partId: partId || 0
    };
  }

  /* Smooth Swept Superellipse Tube along any 3D Spine Curve (for Monogram & Biomechanical Ribs) */
  function createSweptTube(curvePts, radiusStart, radiusEnd, radialSegs, flattenZ, partId) {
    const nPts = curvePts.length;
    const positions = [];
    const normals = [];
    const indices = [];

    for (let i = 0; i < nPts; i++) {
      const P = curvePts[i];
      const Pprev = curvePts[Math.max(0, i - 1)];
      const Pnext = curvePts[Math.min(nPts - 1, i + 1)];

      let tx = Pnext[0] - Pprev[0], ty = Pnext[1] - Pprev[1], tz = Pnext[2] - Pprev[2];
      let tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;

      // Stable Frenet-like frame with [0,0,1] or [0,1,0] up reference
      let ux = 0, uy = 0, uz = 1;
      if (Math.abs(tz) > 0.9) { ux = 0; uy = 1; uz = 0; }
      let nx = uy * tz - uz * ty;
      let ny = uz * tx - ux * tz;
      let nz = ux * ty - uy * tx;
      let nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;

      const bx = ty * nz - tz * ny;
      const by = tz * nx - tx * nz;
      const bz = tx * ny - ty * nx;

      const t = i / Math.max(1, nPts - 1);
      // Smooth hemispherical end-cap taper
      const capTaper = Math.sin(Math.min(1, t * 8.0) * Math.PI * 0.5) * Math.sin(Math.min(1, (1 - t) * 8.0) * Math.PI * 0.5);
      const r = (radiusStart + (radiusEnd - radiusStart) * t) * (0.22 + 0.78 * capTaper);

      for (let j = 0; j <= radialSegs; j++) {
        const v = (j / radialSegs) * Math.PI * 2;
        const cv = Math.cos(v), sv = Math.sin(v) * (flattenZ || 1.0);
        const vx = nx * cv + bx * sv;
        const vy = ny * cv + by * sv;
        const vz = nz * cv + bz * sv;
        const vlen = Math.hypot(vx, vy, vz) || 1;
        positions.push(P[0] + r * vx, P[1] + r * vy, P[2] + r * vz);
        normals.push(vx / vlen, vy / vlen, vz / vlen);
      }
    }

    const stride = radialSegs + 1;
    for (let i = 0; i < nPts - 1; i++) {
      for (let j = 0; j < radialSegs; j++) {
        const a = i * stride + j;
        const b = (i + 1) * stride + j;
        const c = b + 1;
        const d = a + 1;
        indices.push(a, b, d, b, c, d);
      }
    }
    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint32Array(indices),
      partId: partId || 1
    };
  }

  /* Smooth Sculpted Dark-Chrome Inner Ribbon Monogram (Original non-copyrighted 3D sculpture) */
  function createSmoothInnerMonogram() {
    const pieces = [];
    // Smooth sweeping C-loop arc
    const arcPts = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const a = 0.42 + (i / steps) * (Math.PI * 1.56);
      const r = 0.58;
      arcPts.push([Math.cos(a) * r - 0.04, Math.sin(a) * r, Math.sin(i / steps * Math.PI) * 0.08]);
    }
    pieces.push(createSweptTube(arcPts, 0.145, 0.145, 22, 1.35, 1.0));

    // Smooth vertical architectural stem on right with chamfered bevel taper
    const stemPts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      stemPts.push([0.46, 0.62 - t * 1.24, Math.cos(t * Math.PI) * 0.05]);
    }
    pieces.push(createSweptTube(stemPts, 0.14, 0.14, 22, 1.4, 1.0));

    // Inner floating crossbar / prism bridge
    const barPts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      barPts.push([-0.26 + t * 0.68, -0.06 + t * 0.16, 0.06]);
    }
    pieces.push(createSweptTube(barPts, 0.105, 0.105, 18, 1.25, 1.0));

    return combineMeshes(pieces);
  }

  function createTorusKnot(R, tube, p, q, tubularSegs, radialSegs, partId) {
    const curve = [];
    for (let i = 0; i <= tubularSegs; i++) {
      const u = (i / tubularSegs) * p * Math.PI * 2;
      const quOverP = (q / p) * u;
      const r = R * (2 + Math.cos(quOverP)) * 0.34;
      curve.push([r * Math.cos(p * u), r * Math.sin(p * u), R * Math.sin(quOverP) * 0.48]);
    }
    return createSweptTube(curve, tube, tube, radialSegs, 1.0, partId || 0);
  }

  function createOctahedron(radius, partId) {
    const verts = [
      [0, radius, 0], [radius, 0, 0], [0, 0, radius],
      [-radius, 0, 0], [0, 0, -radius], [0, -radius, 0]
    ];
    const faces = [
      [0,2,1], [0,1,4], [0,4,3], [0,3,2],
      [5,1,2], [5,4,1], [5,3,4], [5,2,3]
    ];
    const positions = [];
    const normals = [];
    const indices = [];
    let idx = 0;
    for (const f of faces) {
      const A = verts[f[0]], B = verts[f[1]], C = verts[f[2]];
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
      const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      positions.push(...A, ...B, ...C);
      normals.push(nx / nl, ny / nl, nz / nl, nx / nl, ny / nl, nz / nl, nx / nl, ny / nl, nz / nl);
      indices.push(idx, idx + 1, idx + 2);
      idx += 3;
    }
    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint32Array(indices),
      partId: partId || 1
    };
  }

  /* High-Tessellation 3D UV Sphere for True 3D 20-Sphere Intrarat Logo Assembly */
  function createUnitSphere(latSegs, lonSegs) {
    const positions = [];
    const normals = [];
    const partIds = [];
    const indices = [];

    for (let lat = 0; lat <= latSegs; lat++) {
      const theta = (lat / latSegs) * Math.PI;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      for (let lon = 0; lon <= lonSegs; lon++) {
        const phi = (lon / lonSegs) * Math.PI * 2;
        const nx = sinT * Math.cos(phi);
        const ny = cosT;
        const nz = sinT * Math.sin(phi);
        positions.push(nx, ny, nz);
        normals.push(nx, ny, nz);
        partIds.push(0);
      }
    }

    const stride = lonSegs + 1;
    for (let lat = 0; lat < latSegs; lat++) {
      for (let lon = 0; lon < lonSegs; lon++) {
        const a = lat * stride + lon;
        const b = (lat + 1) * stride + lon;
        const c = b + 1;
        const d = a + 1;
        // Counter-clockwise (CCW) outward front-face winding
        indices.push(a, d, b, b, d, c);
      }
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      partIds: new Float32Array(partIds),
      indices: new Uint32Array(indices)
    };
  }

  /* Exact 20-Circle Intrarat Cross Specification (Positions & RGB Colors sampled from INTRARAT_LOGO_SYMBOL_ONLY_TRANSPARENT.png) */
  const INTRARAT_CROSS_RAW = [
    { row: 0, col: 2, hex: "#358e2e", rgb: [0.208, 0.557, 0.180] },
    { row: 0, col: 3, hex: "#06642e", rgb: [0.024, 0.392, 0.180] },
    { row: 1, col: 2, hex: "#07662f", rgb: [0.027, 0.400, 0.184] },
    { row: 1, col: 3, hex: "#1a7f34", rgb: [0.102, 0.498, 0.204] },
    { row: 2, col: 0, hex: "#045e2d", rgb: [0.016, 0.369, 0.176] },
    { row: 2, col: 1, hex: "#208030", rgb: [0.125, 0.502, 0.188] },
    { row: 2, col: 2, hex: "#439e29", rgb: [0.263, 0.620, 0.161] },
    { row: 2, col: 3, hex: "#409d28", rgb: [0.251, 0.616, 0.157] },
    { row: 2, col: 4, hex: "#208030", rgb: [0.125, 0.502, 0.188] },
    { row: 2, col: 5, hex: "#04592b", rgb: [0.016, 0.349, 0.169] },
    { row: 3, col: 0, hex: "#04562c", rgb: [0.016, 0.337, 0.173] },
    { row: 3, col: 1, hex: "#16762e", rgb: [0.086, 0.463, 0.180] },
    { row: 3, col: 2, hex: "#3c9925", rgb: [0.235, 0.600, 0.145] },
    { row: 3, col: 3, hex: "#3c9826", rgb: [0.235, 0.596, 0.149] },
    { row: 3, col: 4, hex: "#15742c", rgb: [0.082, 0.455, 0.173] },
    { row: 3, col: 5, hex: "#04592c", rgb: [0.016, 0.349, 0.173] },
    { row: 4, col: 2, hex: "#197932", rgb: [0.098, 0.475, 0.196] },
    { row: 4, col: 3, hex: "#06652f", rgb: [0.024, 0.396, 0.184] },
    { row: 5, col: 2, hex: "#04552b", rgb: [0.016, 0.333, 0.169] },
    { row: 5, col: 3, hex: "#227d2d", rgb: [0.133, 0.490, 0.176] }
  ];

  const INTRARAT_GRID_PITCH = 0.455;
  const INTRARAT_SPHERE_RADIUS = 0.194; // Crisp 3D separation gap so every sphere is visibly a distinct round 3D ball

  // Deterministic 3D depth layers for hover explosion (each sphere moves independently in X, Y, Z)
  const EXPLODE_Z_LAYERS = [
    0.16, -0.48, -0.44, 0.14,
    -0.64, 0.46, 0.66, -0.42, 0.52, -0.58,
    0.56, -0.52, -0.46, 0.64, -0.50, 0.58,
    0.15, -0.46, -0.52, 0.18
  ];

  const INTRARAT_20_SPHERES = INTRARAT_CROSS_RAW.map((item, idx) => {
    const tx = (item.col - 2.5) * INTRARAT_GRID_PITCH;
    const ty = (2.5 - item.row) * INTRARAT_GRID_PITCH;
    const tz = 0.0;
    const radialDist = Math.hypot(tx, ty);
    const baseAngle = Math.atan2(ty, tx);
    const angle = baseAngle + ((idx % 2 === 0 ? 1 : -1) * 0.28);

    // Distinct 3D entry origins at varied X/Y/Z depths (kept inside camera frustum so all 20 spheres are visible from t=0)
    const depthLayer = ((idx * 7) % 11 - 5) * 0.26;
    const spreadX = 1.38 + (idx % 3) * 0.12;
    const spreadY = 1.15 + (idx % 3) * 0.07;
    const startX = tx * spreadX + Math.cos(angle + idx * 0.65) * 0.34;
    const startY = ty * spreadY + Math.sin(angle + idx * 0.65) * 0.22;
    const startZ = depthLayer - 0.18;

    // 1.0s intermediate floating waypoint before precision convergence
    const midX = tx * 1.18 + Math.cos(angle) * 0.14;
    const midY = ty * 1.14 + Math.sin(angle) * 0.12;
    const midZ = depthLayer * 0.42;

    // 3D Exploded hover separation vector (independent X/Y/Z per sphere while keeping all 20 spheres inside viewport)
    const radialUnitX = tx / Math.max(0.15, radialDist);
    const radialUnitY = ty / Math.max(0.15, radialDist);
    const fanAngle = baseAngle + ((idx % 3) - 1) * 0.22;
    const explodeX = tx * 0.34 + radialUnitX * 0.11 + Math.cos(fanAngle) * 0.055;
    const explodeY = ty * 0.34 + radialUnitY * 0.11 + Math.sin(fanAngle) * 0.055;
    const explodeZ = EXPLODE_Z_LAYERS[idx % EXPLODE_Z_LAYERS.length];

    return {
      index: idx,
      row: item.row,
      col: item.col,
      hex: item.hex,
      rgb: item.rgb,
      targetX: tx,
      targetY: ty,
      targetZ: tz,
      startX,
      startY,
      startZ,
      midX,
      midY,
      midZ,
      explodeX,
      explodeY,
      explodeZ,
      radialDist,
      phaseSeed: idx * 0.47
    };
  });

  /* Scene 2 Organic Swept Biomechanical Rib-Spine (Matches g-3.jpg & social.jpg) */
  function createOrganicBiomechanicalSpine() {
    const pieces = [];
    const numVertebrae = 26;
    const spanY = 10.2;

    // Continuous central sinuous liquid-chrome spinal cord
    const coreCurve = [];
    for (let k = 0; k <= 90; k++) {
      const t = k / 90;
      const y = -spanY * 0.52 + t * spanY * 1.04;
      coreCurve.push([Math.sin(y * 0.85) * 0.08, y, Math.cos(y * 0.85) * 0.08]);
    }
    pieces.push(createSweptTube(coreCurve, 0.16, 0.16, 20, 1.0, 2.0));

    for (let i = 0; i < numVertebrae; i++) {
      const y = -spanY * 0.5 + (i / (numVertebrae - 1)) * spanY;
      const twist = i * 0.36;
      const ct = Math.cos(twist), st = Math.sin(twist);

      // Smooth sculpted horizontal vertebra collar
      const collar = createSmoothFilletedRing(0.15, 0.36, 0.065, 36, 12, 2.0);
      const cPos = new Float32Array(collar.positions.length);
      const cNrm = new Float32Array(collar.normals.length);
      const tilt = Math.sin(i * 0.55) * 0.16;
      const cTilt = Math.cos(tilt), sTilt = Math.sin(tilt);
      for (let k = 0; k < cPos.length; k += 3) {
        const lx = collar.positions[k];
        const ly = collar.positions[k + 2];
        const lz = -collar.positions[k + 1];
        const ry = ly * cTilt - lz * sTilt;
        const rz = ly * sTilt + lz * cTilt;
        cPos[k]     = lx * ct + rz * st;
        cPos[k + 1] = ry + y;
        cPos[k + 2] = -lx * st + rz * ct;

        const nlx = collar.normals[k];
        const nly = collar.normals[k + 2];
        const nlz = -collar.normals[k + 1];
        const nry = nly * cTilt - nlz * sTilt;
        const nrz = nly * sTilt + nlz * cTilt;
        cNrm[k]     = nlx * ct + nrz * st;
        cNrm[k + 1] = nry;
        cNrm[k + 2] = -nlx * st + nrz * ct;
      }
      pieces.push({ positions: cPos, normals: cNrm, indices: collar.indices, partId: 2.0 });

      // Bilateral swept organic curved biomechanical ribs
      for (const side of [-1, 1]) {
        const ribCurve = [];
        for (let s = 0; s <= 14; s++) {
          const u = s / 14;
          const rx = side * (0.18 + u * 0.68);
          const ry = -Math.sin(u * Math.PI * 0.85) * 0.16 + u * u * 0.24;
          const rz = Math.sin(u * Math.PI) * 0.22 * side;
          ribCurve.push([
            rx * ct + rz * st,
            y + ry,
            -rx * st + rz * ct
          ]);
        }
        pieces.push(createSweptTube(ribCurve, 0.072, 0.024, 14, 0.72, 2.0));
      }
    }

    return combineMeshes(pieces);
  }

  /* Wavefront .OBJ Parser */
  function parseOBJ(objText) {
    const rawV = [[0, 0, 0]];
    const rawVN = [[0, 0, 1]];
    const positions = [];
    const normals = [];
    const indices = [];
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const line of (objText || "").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const parts = trimmed.split(/\s+/);
      if (parts[0] === "v" && parts.length >= 4) {
        const x = parseFloat(parts[1]) || 0, y = parseFloat(parts[2]) || 0, z = parseFloat(parts[3]) || 0;
        rawV.push([x, y, z]);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      } else if (parts[0] === "vn" && parts.length >= 4) {
        rawVN.push([parseFloat(parts[1]) || 0, parseFloat(parts[2]) || 0, parseFloat(parts[3]) || 1]);
      } else if (parts[0] === "f" && parts.length >= 4) {
        const faceVerts = parts.slice(1).map(tok => {
          const seg = tok.split("/");
          let vi = parseInt(seg[0], 10);
          if (vi < 0) vi = rawV.length + vi;
          let ni = seg.length > 2 && seg[2] ? parseInt(seg[2], 10) : 0;
          if (ni < 0) ni = rawVN.length + ni;
          return { v: rawV[vi] || [0, 0, 0], n: ni ? rawVN[ni] : null };
        });
        for (let t = 1; t < faceVerts.length - 1; t++) {
          const A = faceVerts[0], B = faceVerts[t], C = faceVerts[t + 1];
          let fn = A.n;
          if (!fn) {
            const ux = B.v[0] - A.v[0], uy = B.v[1] - A.v[1], uz = B.v[2] - A.v[2];
            const vx = C.v[0] - A.v[0], vy = C.v[1] - A.v[1], vz = C.v[2] - A.v[2];
            let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            const nl = Math.hypot(nx, ny, nz) || 1;
            fn = [nx / nl, ny / nl, nz / nl];
          }
          const base = positions.length / 3;
          positions.push(...A.v, ...B.v, ...C.v);
          normals.push(...(A.n || fn), ...(B.n || fn), ...(C.n || fn));
          indices.push(base, base + 1, base + 2);
        }
      }
    }
    if (positions.length < 9) return null;
    const cx = (minX + maxX) * 0.5, cy = (minY + maxY) * 0.5, cz = (minZ + maxZ) * 0.5;
    const scale = 2.6 / (Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (positions[i] - cx) * scale;
      positions[i + 1] = (positions[i + 1] - cy) * scale;
      positions[i + 2] = (positions[i + 2] - cz) * scale;
    }
    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      partIds: new Float32Array(positions.length / 3).fill(0.0),
      indices: new Uint32Array(indices)
    };
  }

  /* ---------- GLSL Shaders (Studio HDRI + Physical Thin-Film Dispersion) ---------- */
  const BACKDROP_VS = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const BACKDROP_FS = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uOverlayTex;
    uniform vec3 uVoidBg;
    uniform vec3 uGlowColor;
    uniform vec3 uAccentCyan;
    uniform vec3 uAccentMagenta;
    uniform vec3 uIntroBgCenter;
    uniform vec3 uIntroBgEdge;
    uniform vec3 uIntroGlowColor;
    uniform float uIntroGlowOpacity;
    uniform vec2 uMouse;
    uniform float uScroll;
    uniform float uTime;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    void main() {
      vec2 screenUv = vec2(vUv.x, 1.0 - vUv.y);

      float heroMix = 1.0 - smoothstep(0.15, 0.44, uScroll);
      float workMix = smoothstep(0.16, 0.40, uScroll) * (1.0 - smoothstep(0.76, 0.92, uScroll));
      float contactMix = smoothstep(0.76, 0.94, uScroll);

      // Subtle animated FBM atmospheric mist
      float mist = noise(vUv * 3.2 + vec2(uTime * 0.025, -uTime * 0.018)) * 0.55
                 + noise(vUv * 6.4 - vec2(uTime * 0.03, uTime * 0.015)) * 0.25;

      // Scene 1 (Opening 3D Logo Intro): Warm White / Ivory studio canvas with soft green radial light & depth
      vec2 centerDelta = (vUv - vec2(0.5, 0.52)) * vec2(1.12, 1.0);
      float radialDist = length(centerDelta);
      vec3 heroStudioBg = mix(uIntroBgCenter, uIntroBgEdge, smoothstep(0.05, 0.88, radialDist));

      // Gentle soft-green volumetric studio key from upper-left & warm mint halo behind the 20-sphere cross
      float dCenterHalo = length((vUv - vec2(0.50 + uMouse.x * 0.04, 0.50 + uMouse.y * 0.04)) * vec2(1.05, 1.0));
      float dTopLeftLight = length((vUv - vec2(0.24, 0.78)) * vec2(1.0, 1.1));
      heroStudioBg = mix(
        heroStudioBg,
        uIntroGlowColor,
        clamp(exp(-dCenterHalo * 3.1) * (0.34 + 0.08 * mist) * uIntroGlowOpacity, 0.0, 1.0)
      );
      heroStudioBg += vec3(0.018, 0.042, 0.024) * exp(-dTopLeftLight * 2.4) * 0.35 * uIntroGlowOpacity;

      // Scene 2 (Page 02 Approved White Luxury Medical + Emerald Luminous Stage):
      // Pure white (#FFFFFF) to soft medical alabaster (#F7FAF8) with subtle emerald luminous wave glow
      vec3 page02WhiteLuxuryBg = mix(vec3(1.0, 1.0, 1.0), vec3(0.969, 0.980, 0.973), smoothstep(0.08, 0.92, radialDist));
      float leftWaveDist = abs(vUv.y - (0.46 - (vUv.x) * 0.42 + sin(vUv.x * 4.5) * 0.04));
      float rightWaveDist = abs(vUv.y - (0.34 + (vUv.x - 0.45) * 0.56 + sin(vUv.x * 3.8) * 0.05));
      page02WhiteLuxuryBg = mix(page02WhiteLuxuryBg, vec3(0.84, 0.97, 0.89), exp(-leftWaveDist * 14.0) * 0.22 * (1.0 - smoothstep(0.25, 0.55, vUv.x)));
      page02WhiteLuxuryBg = mix(page02WhiteLuxuryBg, vec3(0.82, 0.96, 0.88), exp(-rightWaveDist * 11.0) * 0.25 * smoothstep(0.35, 0.85, vUv.x));

      // Scene 3 Contact Stage (preserved)
      vec3 contactStageBg = vec3(0.035, 0.095, 0.058);
      float dPortal = length(vUv - vec2(0.5, 0.5));
      contactStageBg += vec3(0.12, 0.38, 0.22) * exp(-dPortal * 2.9) * 0.32 * contactMix;

      vec3 postHeroBg = mix(page02WhiteLuxuryBg, contactStageBg, contactMix);
      vec3 col = mix(postHeroBg, heroStudioBg, heroMix);

      // Subtle dithering to prevent any 8-bit gradient banding
      col += (hash(vUv * 920.0 + fract(uTime * 0.41)) - 0.5) * 0.006;

      vec4 ov = texture2D(uOverlayTex, screenUv);
      col = mix(col, ov.rgb, ov.a);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `;

  /* ---------- True 3D Medical-Luxury Spherical Shader & Studio Contact Shadow Shader ---------- */
  const SPHERE_VS = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;

    uniform mat4 uProj;
    uniform mat4 uView;
    uniform mat4 uGroupMat;
    uniform vec3 uSphereCenter;
    uniform float uSphereRadius;

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec3 vLocalNormal;
    varying vec3 vAssemblyPos;

    void main() {
      vec3 localPos = uSphereCenter + aPosition * uSphereRadius;
      vec4 wp = uGroupMat * vec4(localPos, 1.0);
      vWorldPos = wp.xyz;
      vWorldNormal = normalize(mat3(uGroupMat) * aNormal);
      vLocalNormal = aNormal;
      vAssemblyPos = localPos;
      gl_Position = uProj * uView * wp;
    }
  `;

  const SPHERE_FS = `
    precision highp float;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec3 vLocalNormal;
    varying vec3 vAssemblyPos;

    uniform vec3 uCamPos;
    uniform vec3 uSphereColor;
    uniform float uSphereAlpha;
    uniform float uSheenWave;
    uniform float uAssembledGlow;
    uniform vec3 uSphereTintColor;
    uniform float uSphereColorBlend;
    uniform float uSphereBrightness;
    uniform vec3 uReflectionColor;
    uniform float uReflectionIntensity;

    vec3 acesFilm(vec3 x) {
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }

    void main() {
      vec3 N = normalize(vWorldNormal);
      vec3 V = normalize(uCamPos - vWorldPos);
      float ndotv = max(dot(N, V), 0.0);

      // Optional surface color override/tint blend (default uSphereColorBlend = 0.0, uSphereBrightness = 1.0 -> exact v6 colors)
      vec3 tonalTarget = mix(uSphereColor * (uSphereTintColor / vec3(0.263, 0.620, 0.161)), uSphereTintColor, 0.65);
      vec3 baseSphereCol = clamp(mix(uSphereColor, tonalTarget, uSphereColorBlend) * uSphereBrightness, 0.0, 1.0);

      // 1. Studio Key Light (upper-left front), Fill Light, & Warm Ivory Floor Bounce
      vec3 L_key = normalize(vec3(-0.46, 0.58, 0.67));
      vec3 L_fill = normalize(vec3(0.52, -0.28, 0.64));
      vec3 L_bounce = normalize(vec3(0.06, -0.92, 0.38));

      float ndotlKey = dot(N, L_key);
      // Strong 3D spherical terminator gradient so every sphere reads unmistakably as a round 3D ball
      float wrappedKey = clamp((ndotlKey + 0.38) / 1.38, 0.0, 1.0);
      float coreShade = smoothstep(-0.25, 0.82, ndotlKey);

      float fillLight = max(dot(N, L_fill), 0.0) * 0.18;
      float bounceLight = max(dot(N, L_bounce), 0.0) * 0.24;

      // Rich dimensional shadow on lower-right hemisphere -> authentic Intrarat green core -> lit upper-left dome
      vec3 shadowTone = baseSphereCol * vec3(0.38, 0.48, 0.40);
      vec3 litAlbedo = mix(shadowTone, baseSphereCol * 1.10, wrappedKey);
      litAlbedo += baseSphereCol * (coreShade * 0.18 + fillLight);

      // Warm ivory studio floor bounce on bottom hemisphere
      litAlbedo = mix(litAlbedo, mix(baseSphereCol, vec3(0.86, 0.96, 0.88), 0.38), bounceLight * 0.42);

      // 2. Dual-Lobe Studio Softbox Specular (Glossy 3D Spherical Highlight)
      vec3 H_key = normalize(L_key + V);
      float ndoth = max(dot(N, H_key), 0.0);
      float specBroad = pow(ndoth, 18.0) * 0.22;
      float specCrisp = pow(ndoth, 68.0) * 0.48;

      vec3 H_fill = normalize(L_fill + V);
      float specFill = pow(max(dot(N, H_fill), 0.0), 32.0) * 0.09;

      // 3. Gentle 3D Spherical Rim Highlight
      float fresnel = pow(1.0 - ndotv, 3.0);
      vec3 rimCol = mix(baseSphereCol * 1.45, mix(vec3(0.82, 0.99, 0.86), uReflectionColor, 0.5), 0.55);

      // 4. 2.5s - 3.0s Dimensional Green Light Reflection Sweep across assembled 3D cross
      float diagCoord = vAssemblyPos.x * 0.68 - vAssemblyPos.y * 0.52;
      float sweepBand = exp(-pow(diagCoord - uSheenWave, 2.0) * 6.5) * uAssembledGlow;
      vec3 greenReflection = mix(vec3(0.45, 0.94, 0.58), uReflectionColor, 0.55) * sweepBand * (0.28 + 0.35 * ndotv) * uReflectionIntensity;

      // Spherical limb darkening toward silhouette edge for unmistakable 3D roundness
      float limbDepth = mix(0.72, 1.04, pow(ndotv, 0.45));

      vec3 finalCol = litAlbedo * limbDepth
                    + uReflectionColor * ((specBroad + specCrisp + specFill) * uReflectionIntensity)
                    + rimCol * (fresnel * (0.22 + 0.14 * uAssembledGlow) * uReflectionIntensity)
                    + greenReflection;

      gl_FragColor = vec4(clamp(finalCol, 0.0, 1.0), uSphereAlpha);
    }
  `;

  const SHADOW_VS = `
    attribute vec2 aPos;
    uniform mat4 uProj;
    uniform mat4 uView;
    uniform vec3 uShadowCenter;
    uniform float uShadowRadius;
    varying vec2 vLocalUv;

    void main() {
      vLocalUv = aPos;
      vec3 worldPos = uShadowCenter + vec3(aPos.x * uShadowRadius, aPos.y * uShadowRadius, 0.0);
      gl_Position = uProj * uView * vec4(worldPos, 1.0);
    }
  `;

  const SHADOW_FS = `
    precision mediump float;
    varying vec2 vLocalUv;
    uniform float uShadowAlpha;
    uniform vec3 uShadowColor;

    void main() {
      float r = length(vLocalUv);
      if (r > 1.0) discard;
      float soft = pow(1.0 - r, 2.25);
      // Soft emerald-tinted studio ambient shadow on warm white backdrop
      gl_FragColor = vec4(uShadowColor, uShadowAlpha * soft);
    }
  `;

  const MESH_VS = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute float aPartId;

    uniform mat4 uProj;
    uniform mat4 uView;
    uniform mat4 uModel;

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec3 vViewNormal;
    varying vec3 vLocalPos;
    varying vec4 vClipPos;
    varying float vPartId;

    void main() {
      vec4 wp = uModel * vec4(aPosition, 1.0);
      vWorldPos = wp.xyz;
      vLocalPos = aPosition;
      vWorldNormal = normalize(mat3(uModel) * aNormal);
      vViewNormal = normalize(mat3(uView) * vWorldNormal);
      vPartId = aPartId;
      vClipPos = uProj * uView * wp;
      gl_Position = vClipPos;
    }
  `;

  const MESH_FS = `
    precision highp float;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec3 vViewNormal;
    varying vec3 vLocalPos;
    varying vec4 vClipPos;
    varying float vPartId;

    uniform sampler2D uBackdropTex;
    uniform vec3 uCamPos;
    uniform vec3 uAccentCyan;
    uniform vec3 uAccentMagenta;
    uniform float uIridescence;
    uniform float uRefraction;
    uniform float uTime;
    uniform float uOpacity;
    uniform float uAspect;

    vec3 acesFilm(vec3 x) {
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }

    /* Physical Cosine Thin-Film Spectral Interference */
    vec3 thinFilmIridescence(float cosTheta, float opd) {
      vec3 phase = 6.2831853 * (opd * cosTheta + vec3(0.0, 0.33, 0.67));
      return 0.5 + 0.5 * cos(phase);
    }

    /* Procedural Studio HDRI Environment Map with crisp softbox strips */
    vec3 sampleStudioHDRI(vec3 R, vec3 cyanCol, vec3 magCol) {
      // Main left-upper studio softbox strip
      float strip1 = smoothstep(0.62, 0.96, dot(R, normalize(vec3(-0.78, 0.44, 0.44))));
      // Overhead crisp rim softbox
      float strip2 = smoothstep(0.76, 0.985, dot(R, normalize(vec3(0.12, 0.92, 0.36))));
      // Lower-right magenta/violet fill strip
      float strip3 = smoothstep(0.55, 0.92, dot(R, normalize(vec3(0.64, -0.66, 0.38))));
      // Horizon dark chrome gradient
      float horizon = exp(-abs(R.y + 0.12) * 5.5) * 0.22;

      vec3 env = vec3(0.015, 0.022, 0.034);
      env += mix(cyanCol, vec3(0.65, 1.0, 0.85), 0.45) * strip1 * 2.15;
      env += vec3(0.95, 0.98, 1.0) * strip2 * 2.60;
      env += mix(magCol, vec3(0.55, 0.36, 1.0), 0.35) * strip3 * 1.55;
      env += vec3(0.18, 0.30, 0.38) * horizon;
      return env;
    }

    void main() {
      vec3 N = normalize(vWorldNormal);
      vec3 V = normalize(uCamPos - vWorldPos);
      vec3 VN = normalize(vViewNormal);
      vec3 R = reflect(-V, N);

      float ndotv = max(dot(N, V), 0.0);
      float fresnel = pow(1.0 - ndotv, 2.8);

      // Multi-wavelength Snell chromatic refraction of background FBO
      vec2 screenUv = (vClipPos.xy / max(vClipPos.w, 0.0001)) * 0.5 + 0.5;
      vec2 refrOffset = VN.xy * (0.062 * uRefraction) * vec2(1.0 / max(uAspect, 0.5), 1.0);

      vec3 refracted;
      refracted.r = texture2D(uBackdropTex, clamp(screenUv + refrOffset * 0.68, 0.002, 0.998)).r;
      refracted.g = texture2D(uBackdropTex, clamp(screenUv + refrOffset * 1.00, 0.002, 0.998)).g;
      refracted.b = texture2D(uBackdropTex, clamp(screenUv + refrOffset * 1.36, 0.002, 0.998)).b;

      vec3 studioEnv = sampleStudioHDRI(R, uAccentCyan, uAccentMagenta);

      float polar = atan(vLocalPos.y, vLocalPos.x) / 6.2831853 + 0.5;
      vec3 film = thinFilmIridescence(ndotv * 0.75 + 0.25, 1.65 + polar * 1.35 + uTime * 0.03);
      // Tint film toward Active Theory V6 signature Cyan -> Emerald -> Magenta -> Gold spectrum
      vec3 iridTint = mix(
        mix(uAccentCyan, vec3(0.38, 1.0, 0.58), film.g),
        mix(uAccentMagenta, vec3(0.95, 0.84, 0.38), film.r),
        film.b * 0.68
      );

      vec3 col;
      if (vPartId < 0.5) {
        // Outer Filleted Refractive Crystal-Chrome Ring (Matches g-2.jpg)
        float leftHotspot = smoothstep(-0.10, 0.88, -vLocalPos.x * 0.76 + vLocalPos.y * 0.14);
        float bottomHotspot = smoothstep(0.10, 0.92, -vLocalPos.y * 0.78 + vLocalPos.x * 0.22);

        vec3 obsidianBase = vec3(0.018, 0.026, 0.038);
        vec3 leftGlow = mix(uAccentCyan, vec3(0.42, 1.0, 0.62), clamp(0.52 - vLocalPos.y * 0.4, 0.0, 1.0));
        vec3 botGlow  = mix(uAccentMagenta, vec3(0.94, 0.82, 0.42), clamp(vLocalPos.x * 0.55 + 0.45, 0.0, 1.0));

        vec3 metalLayer = obsidianBase
          + studioEnv * (0.58 + 0.55 * fresnel)
          + leftGlow * (leftHotspot * 0.95 * uIridescence)
          + botGlow * (bottomHotspot * 0.72 * uIridescence)
          + iridTint * (fresnel * 0.62 * uIridescence);

        // Glass-metal blend: refracts white headline sharply through dark bevels
        float glassTransmission = clamp(0.56 - fresnel * 0.28, 0.18, 0.65);
        col = mix(metalLayer, refracted * (1.08 + iridTint * 0.35), glassTransmission);
        col += studioEnv * pow(fresnel, 1.6) * 0.52;
      } else if (vPartId < 1.5) {
        // Smooth Smoked-Titanium Inner Sculpted Monogram
        vec3 darkTitanium = vec3(0.022, 0.030, 0.044) + studioEnv * 0.48;
        darkTitanium += iridTint * (fresnel * 0.38 * uIridescence);
        col = mix(darkTitanium, refracted * 0.72, 0.28);
        col += vec3(0.85, 0.96, 1.0) * pow(fresnel, 3.2) * 0.45;
      } else {
        // Scene 2 Smooth Organic Biomechanical Liquid-Chrome Spine (Matches g-3.jpg)
        vec3 violet = vec3(0.50, 0.36, 1.0);
        vec3 spineBand = mix(uAccentCyan, mix(violet, uAccentMagenta, 0.5), fract(vLocalPos.y * 0.28 + fresnel * 0.4));
        vec3 liquidChrome = vec3(0.028, 0.036, 0.062)
          + studioEnv * 0.78
          + spineBand * ((0.36 + 0.62 * fresnel) * uIridescence);
        col = mix(liquidChrome, refracted * 0.55, 0.22);
      }

      col = acesFilm(col * 1.18);
      gl_FragColor = vec4(col, uOpacity);
    }
  `;

  const PARTICLE_VS = `
    attribute vec3 aOrigin;
    attribute vec3 aColor;
    attribute vec2 aSeed;

    uniform mat4 uProj;
    uniform mat4 uView;
    uniform float uTime;
    uniform float uScroll;
    uniform vec2 uMouse;
    uniform float uDpr;
    uniform float uDensity;

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vec3 p = aOrigin;
      float t = uTime * (0.26 + aSeed.x * 0.36);

      p.x += sin(t + p.y * 1.35 + aSeed.y * 6.28) * 0.28;
      p.y += cos(t * 0.82 + p.x * 1.15) * 0.20 + (uScroll - 0.35) * 4.4;
      p.z += cos(t + p.y * 1.25 + aSeed.x * 6.28) * 0.28;

      p.y = mod(p.y + 5.6, 11.2) - 5.6;

      vec2 mWorld = uMouse * vec2(2.8, 1.8);
      vec2 delta = p.xy - mWorld;
      float md = length(delta);
      if (md < 1.85) {
        p.xy += normalize(delta + 0.001) * (1.85 - md) * 0.25;
      }

      vec4 mv = uView * vec4(p, 1.0);
      gl_Position = uProj * mv;

      float dist = max(-mv.z, 0.5);
      float visMask = step(aSeed.y, uDensity);
      float sceneBoost = mix(0.30, 1.0, smoothstep(0.10, 0.32, uScroll));

      gl_PointSize = clamp((16.0 + pow(aSeed.x, 1.55) * 38.0) * uDpr / dist, 2.0, 40.0) * visMask;
      vColor = aColor;
      vAlpha = (0.36 + 0.64 * aSeed.x) * sceneBoost * visMask * smoothstep(9.8, 1.9, dist);
    }
  `;

  const PARTICLE_FS = `
    precision mediump float;
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vec2 d = gl_PointCoord - vec2(0.5);
      float r = length(d) * 2.0;
      if (r > 1.0) discard;
      float glow = pow(1.0 - r, 2.2);
      gl_FragColor = vec4(vColor, vAlpha * glow * 0.26);
    }
  `;

  /* ---------- Engine Class ---------- */
  class ActiveTheoryWebGLEngine {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext("webgl2", { antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" })
             || canvas.getContext("webgl", { antialias: true, alpha: false, preserveDrawingBuffer: true });

      this.width = 1;
      this.height = 1;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.overlayCanvas = document.createElement("canvas");
      this.overlayCtx = this.overlayCanvas.getContext("2d");

      this.pointerHistory = [];
      this.customMeshGPU = null;
      this.envVariant = 0;

      // Secondary spring-lagged rotation states for fluid Active Theory inertia
      this.innerLagX = 0;
      this.innerLagY = 0;

      if (this.gl) {
        this.initGL();
      }
      this.resize();
    }

    compileShader(type, src) {
      const gl = this.gl;
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    }

    createProgram(vsSrc, fsSrc) {
      const gl = this.gl;
      const vs = this.compileShader(gl.VERTEX_SHADER, vsSrc);
      const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSrc);
      if (!vs || !fs) return null;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      return prog;
    }

    uploadMesh(meshData) {
      const gl = this.gl;
      const extUint = this.isWebGL2 || gl.getExtension("OES_element_index_uint");
      const idxArray = extUint ? meshData.indices : new Uint16Array(meshData.indices);
      const idxType = extUint ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;

      const posBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, meshData.positions, gl.STATIC_DRAW);

      const nrmBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf);
      gl.bufferData(gl.ARRAY_BUFFER, meshData.normals, gl.STATIC_DRAW);

      const partBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
      gl.bufferData(gl.ARRAY_BUFFER, meshData.partIds || new Float32Array(meshData.positions.length / 3), gl.STATIC_DRAW);

      const idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxArray, gl.STATIC_DRAW);

      return { posBuf, nrmBuf, partBuf, idxBuf, count: idxArray.length, idxType };
    }

    initGL() {
      const gl = this.gl;
      this.isWebGL2 = (typeof WebGL2RenderingContext !== "undefined") && (gl instanceof WebGL2RenderingContext);

      this.backdropProg = this.createProgram(BACKDROP_VS, BACKDROP_FS);
      this.meshProg = this.createProgram(MESH_VS, MESH_FS);
      this.sphereProg = this.createProgram(SPHERE_VS, SPHERE_FS);
      this.shadowProg = this.createProgram(SHADOW_VS, SHADOW_FS);
      this.particleProg = this.createProgram(PARTICLE_VS, PARTICLE_FS);

      this.quadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

      this.overlayTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.overlayTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      this.unitSphereGPU = this.uploadMesh(createUnitSphere(36, 48));

      const outerRing = createSmoothFilletedRing(1.28, 1.48, 0.145, 200, 22, 0.0);
      this.presetsGPU = {
        "intrarat-3d-spheres": {
          outer: null,
          inner: null
        },
        "intrarat-symbol": {
          outer: null,
          inner: null
        },
        "torus-knot": {
          outer: this.uploadMesh(combineMeshes([createTorusKnot(1.16, 0.20, 2, 3, 200, 28, 0.0)])),
          inner: null
        },
        "octa-core": {
          outer: this.uploadMesh(combineMeshes([createOctahedron(0.76, 1.0)])),
          inner: null
        },
        "dual-gyro": {
          outer: this.uploadMesh(combineMeshes([outerRing])),
          inner: this.uploadMesh(combineMeshes([createSmoothFilletedRing(0.68, 0.86, 0.11, 140, 18, 1.0)]))
        }
      };

      this.spineGPU = this.uploadMesh(createOrganicBiomechanicalSpine());

      const pCount = 3800;
      const pOrigins = new Float32Array(pCount * 3);
      const pColors = new Float32Array(pCount * 3);
      const pSeeds = new Float32Array(pCount * 2);

      const palette = [
        [0.13, 0.72, 0.38],
        [0.30, 0.86, 0.52],
        [0.64, 0.96, 0.76],
        [0.94, 1.00, 0.96]
      ];

      for (let i = 0; i < pCount; i++) {
        const cluster = i % 6;
        const angle = (cluster / 6) * Math.PI * 2 + (Math.random() - 0.5) * 1.28;
        const radius = 0.24 + Math.pow(Math.random(), 1.2) * 2.10;
        pOrigins[i * 3]     = Math.cos(angle) * radius;
        pOrigins[i * 3 + 1] = (Math.random() - 0.5) * 10.8;
        pOrigins[i * 3 + 2] = Math.sin(angle) * radius - 0.38;

        const c = palette[i % palette.length];
        pColors[i * 3]     = c[0];
        pColors[i * 3 + 1] = c[1];
        pColors[i * 3 + 2] = c[2];

        pSeeds[i * 2]     = Math.random();
        pSeeds[i * 2 + 1] = Math.random();
      }

      this.particleCount = pCount;
      this.pOriginBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pOriginBuf);
      gl.bufferData(gl.ARRAY_BUFFER, pOrigins, gl.STATIC_DRAW);

      this.pColorBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pColorBuf);
      gl.bufferData(gl.ARRAY_BUFFER, pColors, gl.STATIC_DRAW);

      this.pSeedBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pSeedBuf);
      gl.bufferData(gl.ARRAY_BUFFER, pSeeds, gl.STATIC_DRAW);

      this.projMat = Mat4.create();
      this.viewMat = Mat4.create();
      this.modelMat = Mat4.create();
    }

    initBackdropFBO(w, h) {
      const gl = this.gl;
      if (!gl) return;
      if (this.backdropFBO) {
        gl.deleteFramebuffer(this.backdropFBO);
        gl.deleteTexture(this.backdropTex);
      }
      this.backdropTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.backdropTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      this.backdropFBO = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.backdropFBO);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.backdropTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    loadCustomOBJ(objText) {
      if (!this.gl) return false;
      const parsed = parseOBJ(objText);
      if (!parsed) return false;
      this.customMeshGPU = this.uploadMesh(parsed);
      return true;
    }

    toggleEnvironmentEasterEgg() {
      this.envVariant = (this.envVariant + 1) % 3;
      return this.envVariant;
    }

    recordPointer(normX, normY) {
      const px = (normX * 0.5 + 0.5) * this.width;
      const py = (0.5 - normY * 0.5) * this.height;
      this.pointerHistory.push({ x: px, y: py, life: 1.0 });
      if (this.pointerHistory.length > 38) {
        this.pointerHistory.shift();
      }
    }

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = this.canvas.clientWidth || window.innerWidth || 1;
      const cssH = this.canvas.clientHeight || window.innerHeight || 1;
      const w = Math.max(1, Math.floor(cssW * this.dpr));
      const h = Math.max(1, Math.floor(cssH * this.dpr));
      if (this.width === w && this.height === h) return;

      this.width = w;
      this.height = h;
      this.canvas.width = w;
      this.canvas.height = h;
      this.overlayCanvas.width = w;
      this.overlayCanvas.height = h;

      if (this.gl) {
        this.initBackdropFBO(w, h);
      }
    }

    updateOverlayCanvas(config, scrollProgress, dt) {
      const ctx = this.overlayCtx;
      const w = this.width;
      const h = this.height;
      ctx.clearRect(0, 0, w, h);

      // 1. Smooth Cursor / Touch Colored Light-Tubes
      if (config.model3D.cursorTubes && this.pointerHistory.length > 2) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 1; i < this.pointerHistory.length; i++) {
          const p0 = this.pointerHistory[i - 1];
          const p1 = this.pointerHistory[i];
          const t = i / this.pointerHistory.length;
          const alpha = p1.life * t * 0.58;
          if (alpha > 0.01) {
            const grad = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
            grad.addColorStop(0, config.theme.accentCyan);
            grad.addColorStop(1, config.theme.accentMagenta);
            ctx.strokeStyle = grad;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = (2.5 + t * 9.5) * this.dpr;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();

            ctx.globalAlpha = alpha * 0.34;
            ctx.lineWidth = (1.5 + t * 4.5) * this.dpr;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y * 0.07);
            ctx.lineTo(p1.x, p1.y * 0.07);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      for (let i = this.pointerHistory.length - 1; i >= 0; i--) {
        this.pointerHistory[i].life -= dt * 1.85;
        if (this.pointerHistory[i].life <= 0) this.pointerHistory.splice(i, 1);
      }

      // 2. Hero 3-Line Display Headline (only drawn when non-empty headline lines are configured)
      const heroAlpha = Math.max(0, Math.min(1, 1 - (scrollProgress - 0.04) / 0.21));
      const hasHeadlineText = Boolean(
        (config.hero.headlineLine1 && config.hero.headlineLine1.trim()) ||
        (config.hero.headlineLine2 && config.hero.headlineLine2.trim()) ||
        (config.hero.headlineLine3 && config.hero.headlineLine3.trim())
      );
      if (heroAlpha > 0.01 && hasHeadlineText) {
        const isMobile = (w / this.dpr) <= 900;
        const scale = config.hero.headlineScale || 1.0;
        const offsetX = (isMobile ? 0 : (config.hero.horizontalOffsetPx || 0)) * this.dpr;
        const offsetY = (isMobile ? 0 : (config.hero.verticalOffsetPx || 0)) * this.dpr;
        const textCol = config.theme.textPrimary || "#ffffff";

        ctx.save();
        ctx.globalAlpha = heroAlpha;

        const lines = [
          config.hero.headlineLine1 || "",
          config.hero.headlineLine2 || "",
          config.hero.headlineLine3 || ""
        ];

        const maxChars = Math.max(8, ...lines.map(s => (s || "").length));
        const fitMobileCap = ((w - 44 * this.dpr) / (maxChars * 0.88)) * Math.min(scale, 1.12);
        const baseCapH = isMobile
          ? Math.min(w * 0.074 * scale, fitMobileCap, 31 * this.dpr)
          : Math.min(w * 0.047, 70 * this.dpr) * scale;

        const charW = baseCapH * 0.72;
        const tracking = baseCapH * 0.14;
        const lineGap = baseCapH * (isMobile ? 1.30 : 1.24);
        const strokeW = Math.max(2.1 * this.dpr, baseCapH * 0.068);

        const startX = (isMobile ? 22 * this.dpr : w * 0.026) + offsetX;
        const totalBlockH = lineGap * 2 + baseCapH;
        const startY = isMobile
          ? h * 0.505 + offsetY * 0.25
          : h * 0.49 - totalBlockH * 0.5 + offsetY;

        const slideUp = scrollProgress * 180 * this.dpr;

        for (let idx = 0; idx < 3; idx++) {
          const ly = startY + idx * lineGap - slideUp;
          if (config.hero.fontStyle === "tech-vector") {
            drawTechLine(ctx, lines[idx], startX, ly, charW, baseCapH, tracking, strokeW, textCol);
          } else {
            const fam = config.hero.fontStyle === "mono"
              ? '"JetBrains Mono", "DejaVu Sans Mono", monospace'
              : '"Chakra Petch", "Inter Display", "Inter", sans-serif';
            ctx.font = `600 ${Math.round(baseCapH * 1.10)}px ${fam}`;
            ctx.fillStyle = textCol;
            ctx.fillText((lines[idx] || "").toUpperCase(), startX, ly + baseCapH * 0.94);
          }
        }
        ctx.restore();
      }

      if (this.gl) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.overlayTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.overlayCanvas);
      }
    }

    drawMeshObject(gpuMesh, modelMat, camPos, config, time, opacity) {
      if (!gpuMesh || opacity <= 0.005) return;
      const gl = this.gl;
      const prog = this.meshProg;
      gl.useProgram(prog);

      gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uProj"), false, this.projMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uView"), false, this.viewMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uModel"), false, modelMat);
      gl.uniform3fv(gl.getUniformLocation(prog, "uCamPos"), camPos);

      const cyan = this.envVariant === 1 ? [0.42, 1.0, 0.68] : this.envVariant === 2 ? [1.0, 0.72, 0.35] : hexToRgb01(config.theme.accentCyan);
      const mag  = this.envVariant === 1 ? [0.35, 0.62, 1.0] : this.envVariant === 2 ? [0.95, 0.28, 0.58] : hexToRgb01(config.theme.accentMagenta);

      gl.uniform3fv(gl.getUniformLocation(prog, "uAccentCyan"), cyan);
      gl.uniform3fv(gl.getUniformLocation(prog, "uAccentMagenta"), mag);
      gl.uniform1f(gl.getUniformLocation(prog, "uIridescence"), config.model3D.iridescenceIntensity);
      gl.uniform1f(gl.getUniformLocation(prog, "uRefraction"), config.model3D.refractionStrength);
      gl.uniform1f(gl.getUniformLocation(prog, "uTime"), time);
      gl.uniform1f(gl.getUniformLocation(prog, "uOpacity"), opacity);
      gl.uniform1f(gl.getUniformLocation(prog, "uAspect"), this.width / Math.max(1, this.height));

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.backdropTex);
      gl.uniform1i(gl.getUniformLocation(prog, "uBackdropTex"), 0);

      const posLoc = gl.getAttribLocation(prog, "aPosition");
      const nrmLoc = gl.getAttribLocation(prog, "aNormal");
      const prtLoc = gl.getAttribLocation(prog, "aPartId");

      gl.bindBuffer(gl.ARRAY_BUFFER, gpuMesh.posBuf);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, gpuMesh.nrmBuf);
      gl.enableVertexAttribArray(nrmLoc);
      gl.vertexAttribPointer(nrmLoc, 3, gl.FLOAT, false, 0, 0);

      if (prtLoc >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, gpuMesh.partBuf);
        gl.enableVertexAttribArray(prtLoc);
        gl.vertexAttribPointer(prtLoc, 1, gl.FLOAT, false, 0, 0);
      }

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gpuMesh.idxBuf);
      gl.drawElements(gl.TRIANGLES, gpuMesh.count, gpuMesh.idxType, 0);
    }

    drawIntrarat20SphereAssembly(state, isMobile, heroVis, camPos) {
      const gl = this.gl;
      const { config, scrollProgress, mouseX, mouseY, time } = state;
      const rawIntroTime = typeof state.introElapsed === "number" ? state.introElapsed : time;
      const t = state.reducedMotion ? Math.max(3.1, rawIntroTime) : rawIntroTime;

      const maxTiltDeg = (config.intro && typeof config.intro.maxTiltDeg === "number")
        ? config.intro.maxTiltDeg
        : 15;
      const maxTiltRad = (maxTiltDeg * Math.PI) / 180;
      const floatIntensity = (config.intro && typeof config.intro.floatIntensity === "number")
        ? config.intro.floatIntensity
        : 1.0;

      // Smooth 3D Parallax rotation strictly clamped within ±maxTiltDeg (default ±15°)
      const clampedMouseX = Math.max(-1, Math.min(1, mouseX || 0));
      const clampedMouseY = Math.max(-1, Math.min(1, mouseY || 0));
      const entryTiltBlend = Math.min(1, t / 2.5);
      const introSweepY = (1 - entryTiltBlend) * 0.14;
      const introSweepX = (1 - entryTiltBlend) * -0.08;

      const rotY = Math.max(-maxTiltRad, Math.min(maxTiltRad, clampedMouseX * maxTiltRad)) + introSweepY;
      const rotX = Math.max(-maxTiltRad, Math.min(maxTiltRad, -clampedMouseY * maxTiltRad)) + introSweepX;
      const rotZ = clampedMouseX * -0.025;

      // Hover explosion progress [0, 1] driven by smooth spring in appController
      const hoverExp = Math.max(0, Math.min(1.25, state.hoverExplosion || 0)) * entryTiltBlend;

      const aspect = this.width / Math.max(1, this.height);
      const mobileFit = isMobile ? Math.min(0.68, Math.max(0.45, aspect * 1.10)) : 0.94;
      const hoverFit = 1.0 - Math.min(0.11, hoverExp * 0.11);
      const baseScale = (config.model3D.modelScale || 1.0) * mobileFit * hoverFit;
      const floatBobY = t >= 2.5
        ? Math.sin((t - 2.5) * 1.45) * 0.032 * floatIntensity * Math.min(1, (t - 2.5) / 0.6)
        : 0.0;

      // Entire assembled logo visibly follows the mouse position with spring damping!
      const followDampOnHover = 1.0 - Math.min(0.45, hoverExp * 0.45);
      const followRangeX = (isMobile ? 0.18 : 0.64) * followDampOnHover;
      const followRangeY = (isMobile ? 0.22 : 0.40) * followDampOnHover;
      const followOffsetX = (state.followX || 0) * followRangeX * entryTiltBlend;
      const followOffsetY = (state.followY || 0) * followRangeY * entryTiltBlend;

      const baseCfgX = isMobile ? 0.0 : ((config.layout && typeof config.layout.ringOffsetX === "number") ? config.layout.ringOffsetX : 0.0);
      const groupX = baseCfgX + followOffsetX;
      const groupY = (isMobile ? 0.04 : 0.0) + followOffsetY + floatBobY + scrollProgress * 3.8;
      const groupZ = -scrollProgress * 2.2;

      Mat4.fromTRS(this.modelMat, groupX, groupY, groupZ, rotX, rotY, rotZ, baseScale, baseScale, baseScale);

      // Determine animation phase & 2.5-3.0s green light reflection wave
      let phase = "0-1s-float-in";
      let assembledProgress = 0.0;
      let sheenWave = -2.2;
      let assembledGlow = 0.0;

      if (t < 1.0) {
        phase = "0-1s-float-in";
        assembledProgress = (t / 2.5);
      } else if (t < 2.5) {
        phase = "1-2.5s-converging";
        assembledProgress = Math.min(1.0, t / 2.5);
        assembledGlow = Math.max(0.0, (t - 2.1) / 0.4) * 0.45;
      } else if (t < 3.0) {
        phase = hoverExp > 0.08 ? "hover-3d-exploded" : "2.5-3s-green-light-reflection";
        assembledProgress = 1.0;
        const p3 = (t - 2.5) / 0.5;
        sheenWave = -1.55 + p3 * 3.10;
        assembledGlow = Math.sin(p3 * Math.PI);
      } else {
        phase = hoverExp > 0.08 ? "hover-3d-exploded" : "interactive-3d-parallax";
        assembledProgress = 1.0;
        const cyc = ((t - 3.0) % 4.5) / 4.5;
        sheenWave = -1.8 + cyc * 3.6;
        assembledGlow = 0.32 + hoverExp * 0.25;
      }

      const sphereStates = [];
      const m = this.modelMat;

      for (let i = 0; i < INTRARAT_20_SPHERES.length; i++) {
        const sp = INTRARAT_20_SPHERES[i];
        const stagger = (sp.radialDist / 1.45) * 0.14;
        const localT = Math.max(0, t - stagger);

        let cx, cy, cz, radiusScale;
        if (localT < 0.92) {
          // 0 - 1s: Float in smoothly from varied 3D X/Y/Z positions & depths
          const u = Math.min(1, localT / 0.92);
          const easeOut = 1 - Math.pow(1 - u, 2.5);
          cx = sp.startX + (sp.midX - sp.startX) * easeOut;
          cy = sp.startY + (sp.midY - sp.startY) * easeOut;
          cz = sp.startZ + (sp.midZ - sp.startZ) * easeOut;
          radiusScale = 0.84 + 0.12 * easeOut;
        } else if (localT < 2.36) {
          // 1 - 2.5s: Precision convergence into exact 20-circle Intrarat cross
          const u = Math.min(1, (localT - 0.92) / (2.36 - 0.92));
          const easeInOut = u < 0.5
            ? 4 * u * u * u
            : 1 - Math.pow(-2 * u + 2, 3) / 2;
          cx = sp.midX + (sp.targetX - sp.midX) * easeInOut;
          cy = sp.midY + (sp.targetY - sp.midY) * easeInOut;
          cz = sp.midZ + (sp.targetZ - sp.midZ) * easeInOut;
          radiusScale = 0.96 + 0.04 * easeInOut;
        } else {
          // >= 2.5s: Assembled in exact Intrarat cross + gentle 3D harmonic depth breath
          const idleBlend = Math.min(1, Math.max(0, (t - 2.6) / 0.5)) * floatIntensity;
          const microZ = Math.sin(time * 1.7 + sp.phaseSeed) * 0.012 * idleBlend;
          cx = sp.targetX;
          cy = sp.targetY;
          cz = sp.targetZ + microZ;
          radiusScale = 1.0;
        }

        // Apply independent 3D X/Y/Z hover separation when cursor hovers over the logo
        if (hoverExp > 0.0005) {
          const hoverOrbitX = Math.cos(time * 2.2 + sp.phaseSeed) * 0.032 * hoverExp;
          const hoverOrbitY = Math.sin(time * 2.1 + sp.phaseSeed) * 0.032 * hoverExp;
          const hoverOrbitZ = Math.sin(time * 2.5 + sp.phaseSeed * 1.3) * 0.045 * hoverExp;
          cx += sp.explodeX * hoverExp + hoverOrbitX;
          cy += sp.explodeY * hoverExp + hoverOrbitY;
          cz += sp.explodeZ * hoverExp + hoverOrbitZ;
        }

        const wx = m[0] * cx + m[4] * cy + m[8] * cz + m[12];
        const wy = m[1] * cx + m[5] * cy + m[9] * cz + m[13];
        const wz = m[2] * cx + m[6] * cy + m[10] * cz + m[14];

        sphereStates.push({
          index: sp.index,
          row: sp.row,
          col: sp.col,
          hex: sp.hex,
          rgb: sp.rgb,
          cx,
          cy,
          cz,
          wx,
          wy,
          wz,
          targetX: sp.targetX,
          targetY: sp.targetY,
          radius: INTRARAT_SPHERE_RADIUS * radiusScale,
          alpha: heroVis
        });
      }

      const introCfg = config.intro || {};
      const sphereTintHex = introCfg.sphereSurfaceColor || "#439e29";
      const sphereTintRgb = hexToRgb01(sphereTintHex);
      const sphereColorBlend = (typeof introCfg.sphereColorBlend === "number")
        ? Math.max(0, Math.min(1, introCfg.sphereColorBlend))
        : 0.0;
      const sphereBrightness = (typeof introCfg.sphereBrightness === "number")
        ? Math.max(0.2, Math.min(2.5, introCfg.sphereBrightness))
        : 1.0;
      const reflectionHex = introCfg.reflectionColor || "#f5fff7";
      const reflectionRgb = (!introCfg.reflectionColor || reflectionHex.toLowerCase() === "#f5fff7")
        ? [0.96, 1.0, 0.97]
        : hexToRgb01(reflectionHex);
      const reflectionIntensity = (typeof introCfg.reflectionIntensity === "number")
        ? Math.max(0, Math.min(3.0, introCfg.reflectionIntensity))
        : 1.0;
      const shadowHex = introCfg.shadowColor || "#0f381c";
      const shadowRgb = (!introCfg.shadowColor || shadowHex.toLowerCase() === "#0f381c")
        ? [0.06, 0.22, 0.11]
        : hexToRgb01(shadowHex);
      const shadowIntensity = (typeof introCfg.shadowIntensity === "number")
        ? Math.max(0, Math.min(3.0, introCfg.shadowIntensity))
        : 1.0;

      // Clean attribute state before shadow & sphere passes
      gl.disableVertexAttribArray(0);
      gl.disableVertexAttribArray(1);
      gl.disableVertexAttribArray(2);

      // Pass A: Soft 3D Studio Ambient Contact Shadows on Warm White Backdrop (No depth write/test so shadows never intersect spheres)
      if (this.shadowProg) {
        gl.useProgram(this.shadowProg);
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.uniformMatrix4fv(gl.getUniformLocation(this.shadowProg, "uProj"), false, this.projMat);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.shadowProg, "uView"), false, this.viewMat);
        gl.uniform3fv(gl.getUniformLocation(this.shadowProg, "uShadowColor"), shadowRgb);

        const aPos = gl.getAttribLocation(this.shadowProg, "aPos");
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const uCenterLoc = gl.getUniformLocation(this.shadowProg, "uShadowCenter");
        const uRadLoc = gl.getUniformLocation(this.shadowProg, "uShadowRadius");
        const uAlphaLoc = gl.getUniformLocation(this.shadowProg, "uShadowAlpha");

        for (let i = 0; i < sphereStates.length; i++) {
          const s = sphereStates[i];
          const depthDist = Math.abs(s.cz);
          const shadowSpread = s.radius * baseScale * (1.48 + depthDist * 0.42);
          const shadowAlpha = s.alpha * 0.14 * shadowIntensity * Math.exp(-depthDist * 0.55);

          gl.uniform3f(uCenterLoc, s.wx + 0.065, s.wy - 0.078, -0.55);
          gl.uniform1f(uRadLoc, shadowSpread);
          gl.uniform1f(uAlphaLoc, shadowAlpha);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        gl.disableVertexAttribArray(aPos);
      }

      // Pass B: True 3D Lit Green Spheres (20 Spheres, CCW Back-Face Culling + Clean Depth Buffer)
      const prog = this.sphereProg;
      const gpu = this.unitSphereGPU;
      gl.useProgram(prog);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.frontFace(gl.CCW);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);

      gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uProj"), false, this.projMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uView"), false, this.viewMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uGroupMat"), false, this.modelMat);
      gl.uniform3fv(gl.getUniformLocation(prog, "uCamPos"), camPos);
      gl.uniform1f(gl.getUniformLocation(prog, "uSheenWave"), sheenWave);
      gl.uniform1f(gl.getUniformLocation(prog, "uAssembledGlow"), assembledGlow);
      gl.uniform3fv(gl.getUniformLocation(prog, "uSphereTintColor"), sphereTintRgb);
      gl.uniform1f(gl.getUniformLocation(prog, "uSphereColorBlend"), sphereColorBlend);
      gl.uniform1f(gl.getUniformLocation(prog, "uSphereBrightness"), sphereBrightness);
      gl.uniform3fv(gl.getUniformLocation(prog, "uReflectionColor"), reflectionRgb);
      gl.uniform1f(gl.getUniformLocation(prog, "uReflectionIntensity"), reflectionIntensity);

      const posLoc = gl.getAttribLocation(prog, "aPosition");
      const nrmLoc = gl.getAttribLocation(prog, "aNormal");

      gl.bindBuffer(gl.ARRAY_BUFFER, gpu.posBuf);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, gpu.nrmBuf);
      gl.enableVertexAttribArray(nrmLoc);
      gl.vertexAttribPointer(nrmLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gpu.idxBuf);

      const uCenter = gl.getUniformLocation(prog, "uSphereCenter");
      const uRadius = gl.getUniformLocation(prog, "uSphereRadius");
      const uColor = gl.getUniformLocation(prog, "uSphereColor");
      const uAlpha = gl.getUniformLocation(prog, "uSphereAlpha");

      for (let i = 0; i < sphereStates.length; i++) {
        const s = sphereStates[i];
        gl.uniform3f(uCenter, s.cx, s.cy, s.cz);
        gl.uniform1f(uRadius, s.radius);
        gl.uniform3fv(uColor, s.rgb);
        gl.uniform1f(uAlpha, s.alpha);
        gl.drawElements(gl.TRIANGLES, gpu.count, gpu.idxType, 0);
      }

      gl.disable(gl.CULL_FACE);
      gl.disableVertexAttribArray(posLoc);
      gl.disableVertexAttribArray(nrmLoc);

      // Expose deterministic 3D assembly, mouse follow, & hover explosion telemetry for QA inspection
      window.__INTRARAT_3D_INTRO_STATE = {
        sphereCount: sphereStates.length,
        phase,
        introElapsedSec: +t.toFixed(3),
        assembledProgress: +assembledProgress.toFixed(3),
        isLogoHovered: Boolean(state.isLogoHovered),
        hoverExplosion: +hoverExp.toFixed(3),
        hoverCycleCount: state.hoverCycleCount || 0,
        followX: +groupX.toFixed(3),
        followY: +groupY.toFixed(3),
        tiltDegX: +((rotX * 180) / Math.PI).toFixed(2),
        tiltDegY: +((rotY * 180) / Math.PI).toFixed(2),
        maxTiltDeg,
        materialConfig: {
          backgroundColor: introCfg.backgroundColor || "#fcfefc",
          backgroundEdgeColor: introCfg.backgroundEdgeColor || "#e9f4ec",
          ambientGlowColor: introCfg.ambientGlowColor || "#d5f0dc",
          ambientGlowOpacity: +(introCfg.ambientGlowOpacity ?? 1.0).toFixed(2),
          sphereSurfaceColor: sphereTintHex,
          sphereColorBlend: +sphereColorBlend.toFixed(2),
          sphereBrightness: +sphereBrightness.toFixed(2),
          reflectionColor: reflectionHex,
          reflectionIntensity: +reflectionIntensity.toFixed(2),
          shadowColor: shadowHex,
          shadowIntensity: +shadowIntensity.toFixed(2)
        },
        spheres: sphereStates.map(s => ({
          row: s.row,
          col: s.col,
          hex: s.hex,
          pos: [+s.cx.toFixed(3), +s.cy.toFixed(3), +s.cz.toFixed(3)],
          worldPos: [+s.wx.toFixed(3), +s.wy.toFixed(3), +s.wz.toFixed(3)],
          target: [+s.targetX.toFixed(3), +s.targetY.toFixed(3), 0]
        }))
      };
    }

    render(state, dt) {
      this.resize();
      const { config, scrollProgress, scrollVelocity, mouseX, mouseY, time } = state;
      this.updateOverlayCanvas(config, scrollProgress, dt);

      const gl = this.gl;
      if (!gl) return;

      const w = this.width;
      const h = this.height;
      const aspect = w / Math.max(1, h);
      const isMobile = (w / this.dpr) <= 900;

      // Secondary spring lag for inner sculpture inertia
      const lagFactor = 1 - Math.pow(1 - 0.045, dt * 60);
      this.innerLagX += (mouseX - this.innerLagX) * lagFactor;
      this.innerLagY += (mouseY - this.innerLagY) * lagFactor;

      const voidRgb = hexToRgb01(config.theme.voidBg);
      const glowRgb = this.envVariant === 1 ? [0.10, 0.36, 0.28] : this.envVariant === 2 ? [0.34, 0.16, 0.24] : hexToRgb01(config.theme.volumetricGlow);
      const cyanRgb = hexToRgb01(config.theme.accentCyan);
      const magRgb  = hexToRgb01(config.theme.accentMagenta);

      const introCfg = config.intro || {};
      const bgCenterHex = introCfg.backgroundColor || "#fcfefc";
      const introBgCenterRgb = (!introCfg.backgroundColor || bgCenterHex.toLowerCase() === "#fcfefc" || bgCenterHex.toLowerCase() === "#f8fbf8")
        ? [0.988, 0.995, 0.989]
        : hexToRgb01(bgCenterHex);
      const bgEdgeHex = introCfg.backgroundEdgeColor || "#e9f4ec";
      const introBgEdgeRgb = (!introCfg.backgroundEdgeColor || bgEdgeHex.toLowerCase() === "#e9f4ec")
        ? [0.914, 0.957, 0.925]
        : hexToRgb01(bgEdgeHex);
      const introGlowHex = introCfg.ambientGlowColor || "#d5f0dc";
      const introGlowColorRgb = (!introCfg.ambientGlowColor || introGlowHex.toLowerCase() === "#d5f0dc")
        ? [0.835, 0.942, 0.865]
        : hexToRgb01(introGlowHex);
      const introGlowOpacity = (typeof introCfg.ambientGlowOpacity === "number")
        ? Math.max(0, Math.min(2.5, introCfg.ambientGlowOpacity))
        : 1.0;

      const drawBackdropPass = () => {
        gl.viewport(0, 0, w, h);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.useProgram(this.backdropProg);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.overlayTex);
        gl.uniform1i(gl.getUniformLocation(this.backdropProg, "uOverlayTex"), 0);
        gl.uniform3fv(gl.getUniformLocation(this.backdropProg, "uVoidBg"), voidRgb);
        gl.uniform3fv(gl.getUniformLocation(this.backdropProg, "uGlowColor"), glowRgb);
        gl.uniform3fv(gl.getUniformLocation(this.backdropProg, "uAccentCyan"), cyanRgb);
        gl.uniform3fv(gl.getUniformLocation(this.backdropProg, "uAccentMagenta"), magRgb);
        gl.uniform3fv(gl.getUniformLocation(this.backdropProg, "uIntroBgCenter"), introBgCenterRgb);
        gl.uniform3fv(gl.getUniformLocation(this.backdropProg, "uIntroBgEdge"), introBgEdgeRgb);
        gl.uniform3fv(gl.getUniformLocation(this.backdropProg, "uIntroGlowColor"), introGlowColorRgb);
        gl.uniform1f(gl.getUniformLocation(this.backdropProg, "uIntroGlowOpacity"), introGlowOpacity);
        gl.uniform2f(gl.getUniformLocation(this.backdropProg, "uMouse"), mouseX, mouseY);
        gl.uniform1f(gl.getUniformLocation(this.backdropProg, "uScroll"), scrollProgress);
        gl.uniform1f(gl.getUniformLocation(this.backdropProg, "uTime"), time);

        const aPos = gl.getAttribLocation(this.backdropProg, "aPos");
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.backdropFBO);
      drawBackdropPass();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      drawBackdropPass();

      const presetKey = config.model3D.preset || "intrarat-3d-spheres";
      const useSphereAssembly =
        presetKey === "intrarat-3d-spheres" ||
        presetKey === "intrarat-symbol" ||
        presetKey === "ring-emblem";

      // Telephoto studio perspective (26 deg FOV) eliminates wide-angle edge stretching so every sphere is 100% round
      const fovRad = (useSphereAssembly ? 26 : 41) * Math.PI / 180;
      Mat4.perspective(this.projMat, fovRad, aspect, 0.1, 45.0);

      const camRoll = useSphereAssembly ? 0 : Math.max(-0.06, Math.min(0.06, (scrollVelocity || 0) * 0.035));
      const camX = useSphereAssembly ? 0 : mouseX * 0.28;
      const camY = useSphereAssembly ? 0 : -mouseY * 0.20;
      const camZ = useSphereAssembly
        ? (isMobile ? 9.4 : 8.20)
        : (isMobile ? 5.85 : 4.52 - Math.sin(scrollProgress * Math.PI) * 0.36);
      const camPos = [camX, camY, camZ];
      Mat4.lookAt(this.viewMat, camPos, [0, 0, 0], [Math.sin(camRoll), Math.cos(camRoll), 0]);

      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      const rotSpd = config.model3D.rotationSpeed;
      const ringOffsetCfg = (config.layout && typeof config.layout.ringOffsetX === "number") ? config.layout.ringOffsetX : -0.18;

      // 2A. Scene 1 Hero 3D Artifact — True 3D 20-Sphere Intrarat Logo Assembly + Mouse Follow + Hover 3D Explosion
      const heroVis = 1.0 - Math.min(1, Math.max(0, (scrollProgress - 0.14) / 0.19));
      if (heroVis > 0.01) {
        if (useSphereAssembly && this.unitSphereGPU && this.sphereProg) {
          this.drawIntrarat20SphereAssembly(state, isMobile, heroVis, camPos);
        } else {
          const mScale = config.model3D.modelScale * (isMobile ? 0.49 : 0.98);
          const heroX = isMobile ? 0.0 : ringOffsetCfg;
          const floatBob = Math.sin(time * 1.15 * rotSpd) * 0.045;
          const heroY = (isMobile ? 0.88 : 0.02) + floatBob + scrollProgress * 4.2;
          const heroZ = -scrollProgress * 2.4;

          const baseRotY = -0.82 + mouseX * 0.44 + Math.sin(time * 0.48 * rotSpd) * 0.12 + scrollProgress * 2.7;
          const baseRotX = 0.14 - mouseY * 0.30 + Math.cos(time * 0.38 * rotSpd) * 0.06;
          const baseRotZ = -0.05 + Math.sin(time * 0.32 * rotSpd) * 0.035;

          if (presetKey === "custom-obj" && this.customMeshGPU) {
            Mat4.fromTRS(this.modelMat, heroX, heroY, heroZ, baseRotX, baseRotY, baseRotZ, mScale, mScale, mScale);
            this.drawMeshObject(this.customMeshGPU, this.modelMat, camPos, config, time, heroVis);
          } else {
            const pair = this.presetsGPU[presetKey];
            if (pair && pair.outer) {
              Mat4.fromTRS(this.modelMat, heroX, heroY, heroZ, baseRotX, baseRotY, baseRotZ, mScale, mScale, mScale);
              this.drawMeshObject(pair.outer, this.modelMat, camPos, config, time, heroVis);
            }
            if (pair && pair.inner) {
              const innerRotX = presetKey === "dual-gyro"
                ? baseRotX + time * 0.72 * rotSpd
                : 0.12 - this.innerLagY * 0.38 + Math.sin(time * 0.62 * rotSpd) * 0.08;
              const innerRotY = presetKey === "dual-gyro"
                ? baseRotY - time * 0.62 * rotSpd
                : -0.72 + this.innerLagX * 0.52 - Math.cos(time * 0.52 * rotSpd) * 0.12 + scrollProgress * 3.1;
              Mat4.fromTRS(this.modelMat, heroX, heroY - floatBob * 0.4, heroZ - 0.02, innerRotX, innerRotY, baseRotZ * 0.7, mScale, mScale, mScale);
              this.drawMeshObject(pair.inner, this.modelMat, camPos, config, time, heroVis);
            }
          }
        }
      }

      // 2B. Scene 2 Organic Swept Biomechanical Spine (Disabled in intrarat-3d-spheres mode so elongated rib-bars never appear)
      const spineIn = Math.min(1, Math.max(0, (scrollProgress - 0.15) / 0.15));
      const spineOut = 1.0 - Math.min(1, Math.max(0, (scrollProgress - 0.80) / 0.13));
      const spineVis = useSphereAssembly ? 0.0 : (spineIn * spineOut);
      if (spineVis > 0.01) {
        const workT = Math.max(0, Math.min(1, (scrollProgress - 0.22) / 0.60));
        const spineY = (0.5 - workT) * 3.2;
        const spineRotY = workT * 5.2 * config.model3D.spineTwist + mouseX * 0.38 + time * 0.18 * rotSpd;
        const spineRotZ = Math.sin(workT * Math.PI * 2.0 + time * 0.4) * 0.055;
        const sScale = (isMobile ? 0.68 : 0.96) * config.model3D.modelScale;
        const spineX = isMobile ? 0.24 : 0.0;

        Mat4.fromTRS(this.modelMat, spineX, spineY, -0.45, mouseY * 0.12, spineRotY, spineRotZ, sScale, sScale, sScale);
        this.drawMeshObject(this.spineGPU, this.modelMat, camPos, config, time, spineVis);
      }

      // 2C. Scene 3 Contact Iridescent Portal Halo
      const contactVis = useSphereAssembly ? 0.0 : Math.min(1, Math.max(0, (scrollProgress - 0.78) / 0.15));
      if (contactVis > 0.01) {
        const pair = this.presetsGPU["dual-gyro"];
        const pScale = (isMobile ? 0.72 : 1.16 + 0.16 * contactVis) * config.model3D.modelScale;
        Mat4.fromTRS(this.modelMat, 0, isMobile ? 0.15 : 0, -0.5, mouseY * 0.22 + 0.2, time * 0.28 * rotSpd + mouseX * 0.3, 0.1, pScale, pScale, pScale);
        this.drawMeshObject(pair.outer, this.modelMat, camPos, config, time, contactVis * 0.88);
      }

      // Pass 3: GPU Bokeh Particle Nebula
      if (config.model3D.particleDensity > 0.01 && this.particleProg) {
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        if (scrollProgress < 0.25) {
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        } else {
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        }

        const pProg = this.particleProg;
        gl.useProgram(pProg);
        gl.uniformMatrix4fv(gl.getUniformLocation(pProg, "uProj"), false, this.projMat);
        gl.uniformMatrix4fv(gl.getUniformLocation(pProg, "uView"), false, this.viewMat);
        gl.uniform1f(gl.getUniformLocation(pProg, "uTime"), time);
        gl.uniform1f(gl.getUniformLocation(pProg, "uScroll"), scrollProgress);
        gl.uniform2f(gl.getUniformLocation(pProg, "uMouse"), mouseX, mouseY);
        gl.uniform1f(gl.getUniformLocation(pProg, "uDpr"), this.dpr);
        gl.uniform1f(gl.getUniformLocation(pProg, "uDensity"), Math.min(1.0, config.model3D.particleDensity));

        const aOrig = gl.getAttribLocation(pProg, "aOrigin");
        const aCol  = gl.getAttribLocation(pProg, "aColor");
        const aSeed = gl.getAttribLocation(pProg, "aSeed");

        gl.bindBuffer(gl.ARRAY_BUFFER, this.pOriginBuf);
        gl.enableVertexAttribArray(aOrig);
        gl.vertexAttribPointer(aOrig, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.pColorBuf);
        gl.enableVertexAttribArray(aCol);
        gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.pSeedBuf);
        gl.enableVertexAttribArray(aSeed);
        gl.vertexAttribPointer(aSeed, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.POINTS, 0, this.particleCount);
        gl.depthMask(true);
      }
    }
  }

  window.ActiveTheoryWebGLEngine = ActiveTheoryWebGLEngine;
})();
