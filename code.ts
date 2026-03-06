// --- Types & Interfaces ---

interface Point {
  x: number;
  y: number;
}

interface ArcLUTEntry {
  t: number;
  arcLen: number;
}

interface BezierSegment {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
  length: number;
  type: "CUBIC" | "LINE";
  lut: ArcLUTEntry[]; // arc-length lookup table for accurate parameterization
}

// --- Math Utilities ---

class BezierEngine {
  // Evaluate position on bezier at parameter t ∈ [0, 1]
  static evaluate(t: number, seg: BezierSegment): Point {
    if (seg.type === "LINE") {
      return {
        x: seg.p0.x + t * (seg.p3.x - seg.p0.x),
        y: seg.p0.y + t * (seg.p3.y - seg.p0.y),
      };
    }
    const mt = 1 - t;
    return {
      x:
        mt * mt * mt * seg.p0.x +
        3 * mt * mt * t * seg.p1.x +
        3 * mt * t * t * seg.p2.x +
        t * t * t * seg.p3.x,
      y:
        mt * mt * mt * seg.p0.y +
        3 * mt * mt * t * seg.p1.y +
        3 * mt * t * t * seg.p2.y +
        t * t * t * seg.p3.y,
    };
  }

  // Evaluate tangent direction at parameter t
  static derivative(t: number, seg: BezierSegment): Point {
    if (seg.type === "LINE") {
      return { x: seg.p3.x - seg.p0.x, y: seg.p3.y - seg.p0.y };
    }
    const mt = 1 - t;
    return {
      x:
        3 * mt * mt * (seg.p1.x - seg.p0.x) +
        6 * mt * t * (seg.p2.x - seg.p1.x) +
        3 * t * t * (seg.p3.x - seg.p2.x),
      y:
        3 * mt * mt * (seg.p1.y - seg.p0.y) +
        6 * mt * t * (seg.p2.y - seg.p1.y) +
        3 * t * t * (seg.p3.y - seg.p2.y),
    };
  }

  // Build an arc-length LUT for a segment — maps arc distance → curve parameter t
  // This is necessary because arc-length does NOT map linearly to t on cubic beziers.
  static buildArcLUT(seg: BezierSegment, steps = 200): ArcLUTEntry[] {
    if (seg.type === "LINE") {
      return [
        { t: 0, arcLen: 0 },
        { t: 1, arcLen: Math.hypot(seg.p3.x - seg.p0.x, seg.p3.y - seg.p0.y) },
      ];
    }
    const lut: ArcLUTEntry[] = [{ t: 0, arcLen: 0 }];
    let prev = seg.p0;
    let accumulated = 0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const curr = BezierEngine.evaluate(t, seg);
      accumulated += Math.hypot(curr.x - prev.x, curr.y - prev.y);
      lut.push({ t, arcLen: accumulated });
      prev = curr;
    }
    return lut;
  }

  // Given a LUT and a target arc-length, return the best t via binary search + linear interpolation
  static tFromArcLength(lut: ArcLUTEntry[], targetLen: number): number {
    const last = lut[lut.length - 1];
    if (targetLen <= 0) return 0;
    if (targetLen >= last.arcLen) return 1;

    let lo = 0,
      hi = lut.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (lut[mid].arcLen < targetLen) lo = mid;
      else hi = mid;
    }
    const span = lut[hi].arcLen - lut[lo].arcLen;
    const alpha = span === 0 ? 0 : (targetLen - lut[lo].arcLen) / span;
    return lut[lo].t + alpha * (lut[hi].t - lut[lo].t);
  }

  // Compute true arc-length of a cubic segment via adaptive numerical integration
  static calculateLength(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    type: "CUBIC" | "LINE",
    steps = 200,
  ): number {
    if (type === "LINE") {
      return Math.hypot(p3.x - p0.x, p3.y - p0.y);
    }
    let length = 0;
    let prev = p0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const curr = {
        x:
          mt * mt * mt * p0.x +
          3 * mt * mt * t * p1.x +
          3 * mt * t * t * p2.x +
          t * t * t * p3.x,
        y:
          mt * mt * mt * p0.y +
          3 * mt * mt * t * p1.y +
          3 * mt * t * t * p2.y +
          t * t * t * p3.y,
      };
      length += Math.hypot(curr.x - prev.x, curr.y - prev.y);
      prev = curr;
    }
    return length;
  }
}

// --- Placement Helper ---

/**
 * Place a clone at a world position (cx, cy) with optional rotation.
 * Uses relativeTransform so that rotation is applied around the object's
 * geometric center — not its top-left corner.
 */
function placeClone(
  clone: SceneNode,
  cx: number,
  cy: number,
  angleDeg: number,
  rotate: boolean,
): void {
  if (rotate) {
    const angle = angleDeg * (Math.PI / 180);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const w = clone.width;
    const h = clone.height;
    // Translate so that the center (w/2, h/2) lands at (cx, cy)
    const tx = cx - cos * (w / 2) + sin * (h / 2);
    const ty = cy - sin * (w / 2) - cos * (h / 2);
    clone.relativeTransform = [
      [cos, -sin, tx],
      [sin, cos, ty],
    ];
  } else {
    clone.x = cx - clone.width / 2;
    clone.y = cy - clone.height / 2;
  }
}

// --- Figma Logic ---

figma.showUI(__html__, { width: 300, height: 524 });

figma.ui.onmessage = async (msg) => {
  // ── Assign a node role (shape or path) ──────────────────────────────────
  if (msg.type === "set-node") {
    const selection = figma.currentPage.selection;
    if (selection.length !== 1) {
      figma.notify("Select exactly one object first.", { error: true });
      return;
    }

    const node = selection[0];

    if (msg.target === "path" && !("vectorNetwork" in node)) {
      figma.notify(
        "Not a vector path — try Outline Stroke or use the Pen tool.",
        { error: true },
      );
      return;
    }

    figma.ui.postMessage({
      type: "node-confirmed",
      target: msg.target,
      id: node.id,
      name: node.name,
    });
    figma.notify(
      `${msg.target === "shape" ? "Shape" : "Path"} set: "${node.name}"`,
    );
  }

  // ── Generate the array ──────────────────────────────────────────────────
  if (msg.type === "generate") {
    figma.ui.postMessage({ type: "generating" });

    const shapeNode = (await figma.getNodeByIdAsync(msg.shapeId)) as SceneNode;
    const pathNode = (await figma.getNodeByIdAsync(msg.pathId)) as any;

    if (!shapeNode || !pathNode) {
      figma.notify("A referenced node no longer exists. Please re-assign.", {
        error: true,
      });
      figma.ui.postMessage({ type: "done" });
      return;
    }
    if (!pathNode.vectorNetwork) {
      figma.notify("Path node has no vector network.", { error: true });
      figma.ui.postMessage({ type: "done" });
      return;
    }

    // Build segments with per-segment arc-length LUTs
    const network = pathNode.vectorNetwork;
    const segments: BezierSegment[] = [];

    for (const seg of network.segments) {
      const v0 = network.vertices[seg.start];
      const v1 = network.vertices[seg.end];
      const p0 = { x: v0.x, y: v0.y };
      const p3 = { x: v1.x, y: v1.y };
      const tStart = seg.tangentStart ?? { x: 0, y: 0 };
      const tEnd = seg.tangentEnd ?? { x: 0, y: 0 };
      const isLine =
        tStart.x === 0 && tStart.y === 0 && tEnd.x === 0 && tEnd.y === 0;
      const p1 = { x: p0.x + tStart.x, y: p0.y + tStart.y };
      const p2 = { x: p3.x + tEnd.x, y: p3.y + tEnd.y };
      const type: "CUBIC" | "LINE" = isLine ? "LINE" : "CUBIC";

      // Temporary segment (without lut) to build lut
      const tmp = { p0, p1, p2, p3, type, length: 0, lut: [] as ArcLUTEntry[] };
      const lut = BezierEngine.buildArcLUT(tmp);
      const length = lut[lut.length - 1].arcLen;

      segments.push({ p0, p1, p2, p3, type, length, lut });
    }

    if (segments.length === 0) {
      figma.notify("Path has no segments.", { error: true });
      figma.ui.postMessage({ type: "done" });
      return;
    }

    const totalLength = segments.reduce((sum, s) => sum + s.length, 0);

    // Build a cumulative distance table so we can binary-search for the target segment
    const cumLengths: number[] = [];
    let acc = 0;
    for (const seg of segments) {
      cumLengths.push(acc);
      acc += seg.length;
    }

    // Determine sample distances
    const count =
      msg.mode === "even"
        ? Math.max(2, msg.count)
        : Math.floor(totalLength / Math.max(1, msg.gap)) + 1;

    const stepDist =
      msg.mode === "even"
        ? count > 1
          ? totalLength / (count - 1)
          : 0
        : msg.gap;

    const clones: SceneNode[] = [];

    for (let i = 0; i < count; i++) {
      const targetDist = i * stepDist;
      if (targetDist > totalLength + 0.5) break;

      // Binary search for the correct segment
      let lo = 0,
        hi = segments.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cumLengths[mid] <= targetDist) lo = mid;
        else hi = mid - 1;
      }
      const seg = segments[lo];
      const distInSeg = Math.min(seg.length, targetDist - cumLengths[lo]);

      // Use the LUT for accurate arc-length → t mapping
      const localT = BezierEngine.tFromArcLength(seg.lut, distInSeg);
      const pos = BezierEngine.evaluate(localT, seg);
      const deriv = BezierEngine.derivative(localT, seg);

      const worldX = pathNode.x + pos.x;
      const worldY = pathNode.y + pos.y;
      const angleDeg = Math.atan2(deriv.y, deriv.x) * (180 / Math.PI);

      const clone = shapeNode.clone();
      placeClone(clone, worldX, worldY, angleDeg, msg.rotateToPath);
      clones.push(clone);
    }

    if (clones.length > 0) {
      const group = figma.group(clones, figma.currentPage);
      group.name = `Array along ${pathNode.name}`;
      figma.currentPage.selection = [group];
      figma.notify(`✓ Created ${clones.length} instances`);
    } else {
      figma.notify(
        "No instances were placed. Check count / gap vs. path length.",
        { error: true },
      );
    }

    figma.ui.postMessage({ type: "done" });
  }
};
