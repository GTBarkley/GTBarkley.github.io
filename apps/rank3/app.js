const EDGE_LABELS = [2, 3, 4, 6, "inf", "custom"];
const EDGE_KEYS = ["12", "23", "13"];

const PRESETS = {
  A3: {
    label: "A3",
    matrix: [
      [2, -1, 0],
      [-1, 2, -1],
      [0, -1, 2],
    ],
  },
  B3: {
    label: "B3",
    matrix: [
      [2, -1, 0],
      [-1, 2, -1],
      [0, -2, 2],
    ],
  },
  C3: {
    label: "C3",
    matrix: [
      [2, -1, 0],
      [-2, 2, -1],
      [0, -1, 2],
    ],
  },
  A_tilde_2: {
    label: "Ã2",
    matrix: [
      [2, -1, -1],
      [-1, 2, -1],
      [-1, -1, 2],
    ],
  },
  C_tilde_2: {
    label: "C̃2",
    matrix: [
      [2, -1, 0],
      [-2, 2, -2],
      [0, -1, 2],
    ],
  },
  G_tilde_2: {
    label: "G̃2",
    matrix: [
      [2, -1, 0],
      [-1, 2, -1],
      [0, -3, 2],
    ],
  },
  U3: {
    label: "U3",
    matrix: [
      [2, -2, -2],
      [-2, 2, -2],
      [-2, -2, 2],
    ],
  },
  triangle_2_3_inf: {
    label: "(2, 3, ∞)",
    matrix: [
      [2, -1, 0],
      [-1, 2, -2],
      [0, -2, 2],
    ],
  },
};

const BASE_VIEWER_TITLE = "Rank 3 Root System Viewer";
const activeViewerMode = window.RootViewerMode || { name: "default" };
const viewerExtensions = Array.isArray(window.RootViewerExtensions)
  ? window.RootViewerExtensions.slice()
  : [];

const nodes = {
  presetSelect: document.getElementById("preset-select"),
  applyPresetButton: document.getElementById("apply-preset-button"),
  cartanEditor: document.getElementById("cartan-editor"),
  cartanOutput: document.getElementById("cartan-output"),
  diagram: document.getElementById("diagram"),
  diagramOutput: document.getElementById("diagram-output"),
  statusOutput: document.getElementById("status-output"),
  maxHeightLabel: document.getElementById("max-height-label"),
  maxHeightInput: document.getElementById("max-height-input"),
  plot: document.getElementById("plot"),
  tooltip: document.getElementById("tooltip"),
  rootCount: document.getElementById("root-count"),
  selectRank2Toggle: document.getElementById("select-rank-2-toggle"),
  arrangementViewToggleWrap: document.getElementById("arrangement-view-toggle-wrap"),
  arrangementViewToggle: document.getElementById("arrangement-view-toggle"),
  separatingLineToggle: document.getElementById("separating-line-toggle"),
  separatingLineActions: document.getElementById("separating-line-actions"),
  flipSeparatingSideButton: document.getElementById("flip-separating-side-button"),
  separatedRootsButton: document.getElementById("separated-roots-button"),
  findSeparatingLineButton: document.getElementById("find-separating-line-button"),
  separatingLineStatus: document.getElementById("separating-line-status"),
  clearPairButton: document.getElementById("clear-pair-button"),
  resetViewButton: document.getElementById("reset-view-button"),
  rootTableBody: document.getElementById("root-table-body"),
  showMoreButton: document.getElementById("show-more-button"),
  viewerTitle: document.getElementById("viewer-title"),
};

const matrixInputs = [];
const ROOTS_PAGE_SIZE = 25;
let visibleRootCount = ROOTS_PAGE_SIZE;
let currentRoots = [];
let plotLayer = null;
let rootCircles = [];
let dualLineElements = [];
let currentLineElement = null;
let selectedRootIndices = [];
let highlightedLineRootIndices = new Set();
let selectRank2Enabled = false;
let arrangementViewEnabled = false;
let hiddenRootKeys = new Set();
let lastCartanSignature = null;
let currentConeData = null;
let separatingBackgroundLayer = null;
let separatingForegroundLayer = null;
let separatingLineEnabled = false;
const separatingLine = {
  first: null,
  second: null,
  halfspaceSign: 1,
  dragPointerId: null,
  dragHandle: null,
  regionHighlight: null,
};
const plotView = {
  scale: 1,
  tx: 0,
  ty: 0,
  minScale: 0.6,
  maxScale: Infinity,
  pointerDown: false,
  dragging: false,
  dragStartClient: null,
  lastPoint: null,
  activePointers: new Map(),
  pinchDistance: null,
  pinchScale: 1,
  pinchMidpoint: null,
};
const viewerApp = createViewerApp();

window.RootViewerApp = viewerApp;

function edgeSelect(key) {
  return document.getElementById(`edge-${key}`);
}

function flipButton(key) {
  return document.getElementById(`flip-${key}`);
}

function setupControls() {
  runExtensionHook("beforeSetup");
  setupPresetMenu();
  setupEdgeMenus();
  setupMatrixEditor();
  setupPlotInteractions();

  nodes.applyPresetButton.addEventListener("click", applyPreset);
  nodes.presetSelect.addEventListener("change", applyPreset);
  nodes.showMoreButton.addEventListener("click", showMoreRoots);
  nodes.clearPairButton.addEventListener("click", clearLineSelection);
  nodes.resetViewButton.addEventListener("click", resetPlotView);
  nodes.maxHeightInput.addEventListener("input", renderAll);
  nodes.selectRank2Toggle.addEventListener("change", onSelectRank2Toggle);
  nodes.arrangementViewToggle.addEventListener("change", onArrangementViewToggle);
  nodes.separatingLineToggle.addEventListener("change", onSeparatingLineToggle);
  nodes.flipSeparatingSideButton.addEventListener("click", flipSeparatingHalfspace);
  nodes.separatedRootsButton.addEventListener("click", selectSeparatedRoots);
  nodes.findSeparatingLineButton.addEventListener("click", findSeparatingLine);

  syncSeparatingLineControls();
  applyPreset();
  runExtensionHook("afterSetup");
}

function onArrangementViewToggle() {
  arrangementViewEnabled = nodes.arrangementViewToggle.checked;
  renderAll({ preserveSelection: true });
}

function onSelectRank2Toggle() {
  setSelectRank2Enabled(nodes.selectRank2Toggle.checked);
}

function onSeparatingLineToggle() {
  separatingLineEnabled = nodes.separatingLineToggle.checked;
  if (separatingLineEnabled) {
    ensureSeparatingLine();
    setSeparatingLineStatus("Drag either gold point to position the separating line.");
  } else {
    separatingLine.regionHighlight = null;
    setSeparatingLineStatus("");
  }
  syncSeparatingLineControls();
  refreshLineSelectionVisuals();
}

function setupPresetMenu() {
  for (const [name, preset] of Object.entries(PRESETS)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = preset.label;
    nodes.presetSelect.append(option);
  }
}

function setupEdgeMenus() {
  for (const key of EDGE_KEYS) {
    const select = edgeSelect(key);
    for (const label of EDGE_LABELS) {
      const option = document.createElement("option");
      option.value = String(label);
      option.textContent = label === "custom" ? "custom" : label === "inf" ? "∞" : String(label);
      select.append(option);
    }
    select.addEventListener("change", () => {
      applyEdgeLabel(key, select.value);
      renderAll();
    });
    flipButton(key).addEventListener("click", () => {
      flipEdgeOrientation(key);
      renderAll();
    });
  }
}

function setupMatrixEditor() {
  const header = document.createElement("div");
  header.className = "matrix-col-header";
  header.append(document.createElement("div"));
  for (const label of ["1", "2", "3"]) {
    const node = document.createElement("div");
    node.className = "matrix-col-label";
    node.textContent = `j=${label}`;
    header.append(node);
  }
  nodes.cartanEditor.append(header);

  for (let row = 0; row < 3; row += 1) {
    matrixInputs[row] = [];
    const rowWrap = document.createElement("div");
    rowWrap.className = "compact-matrix-row";
    const rowLabel = document.createElement("div");
    rowLabel.className = "matrix-row-label";
    rowLabel.textContent = `i=${row + 1}`;
    rowWrap.append(rowLabel);
    for (let col = 0; col < 3; col += 1) {
      const wrapper = document.createElement("label");
      wrapper.className = "matrix-cell";
      const label = document.createElement("span");
      label.textContent = `a${row + 1}${col + 1}`;
      label.hidden = true;
      const input = document.createElement("input");
      input.type = "number";
      input.step = "1";
      input.value = row === col ? "2" : "0";
      input.disabled = row === col;
      input.addEventListener("input", () => {
        syncEdgeControlsFromMatrix();
        renderAll();
      });
      wrapper.append(label, input);
      rowWrap.append(wrapper);
      matrixInputs[row][col] = input;
    }
    nodes.cartanEditor.append(rowWrap);
  }
}

function applyPreset() {
  const preset = PRESETS[nodes.presetSelect.value] || PRESETS.A3;
  setMatrix(cloneMatrix(preset.matrix));
  renderAll();
}

function setMatrix(matrix) {
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      matrixInputs[row][col].value = String(matrix[row][col]);
    }
  }
  syncEdgeControlsFromMatrix();
}

function readMatrix() {
  const matrix = [];
  for (let row = 0; row < 3; row += 1) {
    matrix[row] = [];
    for (let col = 0; col < 3; col += 1) {
      if (row === col) {
        matrix[row][col] = 2;
      } else {
        const parsed = Number(matrixInputs[row][col].value);
        matrix[row][col] = Number.isInteger(parsed) ? parsed : 0;
      }
    }
  }
  return matrix;
}

function writeEdgePair(key, pair) {
  const [i, j] = edgeIndices(key);
  matrixInputs[i][j].value = String(pair[0]);
  matrixInputs[j][i].value = String(pair[1]);
}

function applyEdgeLabel(key, rawLabel) {
  if (rawLabel === "custom") {
    return;
  }

  const [i, j] = edgeIndices(key);
  const matrix = readMatrix();
  const current = [matrix[i][j], matrix[j][i]];
  const label = rawLabel === "inf" ? Infinity : Number(rawLabel);
  writeEdgePair(key, pairForLabel(label, current));
  syncEdgeControlsFromMatrix();
}

function flipEdgeOrientation(key) {
  const [i, j] = edgeIndices(key);
  const matrix = readMatrix();
  const left = matrix[i][j];
  const right = matrix[j][i];
  matrixInputs[i][j].value = String(right);
  matrixInputs[j][i].value = String(left);
  syncEdgeControlsFromMatrix();
}

function pairForLabel(label, currentPair) {
  if (label === 2) {
    return [0, 0];
  }
  if (label === 3) {
    return [-1, -1];
  }
  if (label === Infinity) {
    const leftMagnitude = Math.max(2, Math.abs(currentPair[0]));
    const rightMagnitude = Math.max(2, Math.abs(currentPair[1]));
    return [-leftMagnitude, -rightMagnitude];
  }

  const canonical = label === 4 ? [-1, -2] : [-1, -3];
  if (Math.abs(currentPair[0]) > Math.abs(currentPair[1])) {
    return [canonical[1], canonical[0]];
  }
  return canonical;
}

function syncEdgeControlsFromMatrix() {
  const matrix = readMatrix();
  for (const key of EDGE_KEYS) {
    const [i, j] = edgeIndices(key);
    const label = detectEdgeLabel(matrix[i][j], matrix[j][i]);
    edgeSelect(key).value = String(label);
    flipButton(key).disabled = !(label === 4 || label === 6 || label === "inf");
  }
}

function detectEdgeLabel(aij, aji) {
  const product = aij * aji;
  if (aij === 0 && aji === 0) {
    return 2;
  }
  if (product === 1 && aij < 0 && aji < 0) {
    return 3;
  }
  if (product === 2 && aij < 0 && aji < 0) {
    return 4;
  }
  if (product === 3 && aij < 0 && aji < 0) {
    return 6;
  }
  if (product >= 4 && aij < 0 && aji < 0) {
    return "inf";
  }
  return "custom";
}

function renderAll(options = {}) {
  runExtensionHook("beforeRender", { options });
  const { preserveSelection = false } = options;
  const preservedSelectionKeys = preserveSelection
    ? selectedRootIndices
      .map((index) => currentRoots[index])
      .filter(Boolean)
      .map((root) => vectorKey(root.vector))
    : [];
  const cartan = readMatrix();
  const cartanSignature = JSON.stringify(cartan);
  const preserveHidden = cartanSignature === lastCartanSignature;
  const preservedHiddenKeys = preserveHidden ? new Set(hiddenRootKeys) : new Set();
  const analysis = runExtensionPipeline(
    "transformAnalysis",
    analyzeRootSystem(cartan, readMaxHeight()),
    { options, cartan },
  );
  currentRoots = analysis.positiveRoots;
  lastCartanSignature = cartanSignature;
  hiddenRootKeys = new Set(
    currentRoots
      .map((root) => vectorKey(root.vector))
      .filter((key) => preservedHiddenKeys.has(key)),
  );
  visibleRootCount = ROOTS_PAGE_SIZE;
  if (preserveSelection) {
    selectedRootIndices = preservedSelectionKeys
      .map((key) => currentRoots.findIndex((root) => vectorKey(root.vector) === key))
      .filter((index) => index >= 0)
      .filter((index) => isRootVisible(currentRoots[index]))
      .slice(0, selectRank2Enabled ? 2 : Number.POSITIVE_INFINITY);
    recomputeLineSelection();
    invalidateSeparatingRegionHighlight();
  } else {
    selectedRootIndices = [];
    highlightedLineRootIndices = new Set();
    separatingLine.regionHighlight = null;
  }
  currentLineElement = null;
  drawMatrixOutput(cartan);
  nodes.statusOutput.textContent = analysis.status;
  nodes.rootCount.textContent = `${analysis.positiveRoots.length} positive roots`;
  nodes.diagramOutput.textContent = diagramSummary(cartan);
  drawDiagram(cartan);
  drawPlot(analysis.positiveRoots, cartan);
  drawTable();
  runExtensionHook("afterRender", { options, cartan, analysis });
}

function createViewerApp() {
  return {
    baseTitle: BASE_VIEWER_TITLE,
    nodes,
    getCurrentMode: () => activeViewerMode.name || "default",
    getState: () => ({
      arrangementViewEnabled,
      currentRoots,
      highlightedLineRootIndices,
      separatingLineEnabled,
      selectedRootIndices,
      selectRank2Enabled,
      visibleRootCount,
    }),
    getPlotContext: () => ({
      arrangementViewEnabled,
      currentConeData,
      dualLineElements,
      plotLayer,
      plotScale: plotView.scale,
      rootCircles,
    }),
    getPresetName: () => nodes.presetSelect?.value || "",
    canvasRectangle,
    clipPolygonToHalfPlane,
    createSvgElement: svgElement,
    dualRegionDataForLine,
    extendedLineThroughPoints,
    lineSignedValue,
    orientedDualVectorForLine,
    plotPointFromClient,
    readMatrix,
    readMaxHeight,
    renderAll,
    decorateRoot,
    reflect,
    isPositive,
    selectRootsByKeys,
    setSeparatingHalfspace,
    setTitle: setViewerTitle,
    setTitleSuffix: (suffix = "") => setViewerTitle(`${BASE_VIEWER_TITLE}${suffix}`),
    setSelectRank2Enabled,
    validateCartan,
    vectorKey,
  };
}

function runExtensionHook(name, payload = {}) {
  for (const extension of viewerExtensions) {
    if (typeof extension?.[name] !== "function") {
      continue;
    }
    try {
      extension[name](viewerApp, payload);
    } catch (error) {
      console.error(`Viewer extension hook failed: ${name}`, extension?.name || extension, error);
    }
  }
}

function runExtensionPipeline(name, value, payload = {}) {
  let nextValue = value;
  for (const extension of viewerExtensions) {
    if (typeof extension?.[name] !== "function") {
      continue;
    }
    try {
      const result = extension[name](viewerApp, { ...payload, value: nextValue });
      if (result !== undefined) {
        nextValue = result;
      }
    } catch (error) {
      console.error(`Viewer extension pipeline failed: ${name}`, extension?.name || extension, error);
    }
  }
  return nextValue;
}

function setViewerTitle(title) {
  document.title = title;
  if (nodes.viewerTitle) {
    nodes.viewerTitle.textContent = title;
  }
}

function setSelectRank2Enabled(enabled) {
  selectRank2Enabled = Boolean(enabled);
  if (nodes.selectRank2Toggle) {
    nodes.selectRank2Toggle.checked = selectRank2Enabled;
  }
  if (selectedRootIndices.length > 2 && selectRank2Enabled) {
    selectedRootIndices = [];
  }
  invalidateSeparatingRegionHighlight();
  recomputeLineSelection();
  refreshLineSelectionVisuals();
  drawTable();
  runExtensionHook("afterSelectRank2Change", { enabled: selectRank2Enabled });
}

function selectRootsByKeys(keys, options = {}) {
  const { reveal = true } = options;
  const keySet = new Set(keys);
  if (reveal) {
    for (const key of keySet) {
      hiddenRootKeys.delete(key);
    }
  }
  selectedRootIndices = currentRoots
    .map((root, index) => ({ root, index }))
    .filter(({ root }) => keySet.has(vectorKey(root.vector)) && isRootVisible(root))
    .map(({ index }) => index);
  if (selectRank2Enabled && selectedRootIndices.length > 2) {
    selectedRootIndices = [];
  }
  invalidateSeparatingRegionHighlight();
  recomputeLineSelection();
  refreshRootVisibilityVisuals();
  refreshLineSelectionVisuals();
  drawTable();
}

function analyzeRootSystem(cartan, maxHeight) {
  const issues = validateCartan(cartan);
  const roots = generateRoots(cartan, maxHeight, 2500);
  const positiveRoots = roots
    .filter((entry) => isPositive(entry.vector))
    .map((entry) => decorateRoot(entry))
    .sort(compareRoots);

  const parts = [];
  if (issues.length) {
    parts.push(`Matrix warning: ${issues.join(" ")}`);
  }
  parts.push(`Discovered ${positiveRoots.length} positive roots with height <= ${maxHeight}.`);
  if (roots.truncated) {
    parts.push("Exploration hit the safety cap, so this may be an infinite or unexpectedly large system.");
  }

  return {
    status: parts.join(" "),
    positiveRoots,
  };
}

function validateCartan(cartan) {
  const issues = [];
  for (let i = 0; i < 3; i += 1) {
    if (cartan[i][i] !== 2) {
      issues.push(`Expected a${i + 1}${i + 1} = 2.`);
    }
  }
  for (const key of EDGE_KEYS) {
    const [i, j] = edgeIndices(key);
    if (cartan[i][j] > 0 || cartan[j][i] > 0) {
      issues.push(`Off-diagonal entries on edge ${i + 1}-${j + 1} should usually be non-positive.`);
    }
  }
  return issues;
}

function generateRoots(cartan, maxHeight, limit) {
  const queue = [];
  const seen = new Map();
  let truncated = false;

  for (let i = 0; i < 3; i += 1) {
    const vector = [0, 0, 0];
    vector[i] = 1;
    const entry = {
      vector,
      source: i,
      word: [],
    };
    seen.set(vectorKey(vector), entry);
    queue.push(entry);
  }

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    for (let reflection = 0; reflection < 3; reflection += 1) {
      const image = reflect(current.vector, reflection, cartan);
      const height = rootHeight(image);
      if (height <= 0 || height > maxHeight) {
        continue;
      }
      const key = vectorKey(image);
      if (!seen.has(key)) {
        const next = {
          vector: image,
          source: current.source,
          word: [reflection, ...current.word],
        };
        seen.set(key, next);
        queue.push(next);
        if (queue.length >= limit) {
          truncated = true;
          return Object.assign(queue, { truncated });
        }
      }
    }
  }

  return Object.assign(queue, { truncated });
}

function reflect(vector, index, cartan) {
  const pairing =
    vector[0] * cartan[index][0] +
    vector[1] * cartan[index][1] +
    vector[2] * cartan[index][2];
  const next = vector.slice();
  next[index] -= pairing;
  return next;
}

function rootHeight(vector) {
  return vector[0] + vector[1] + vector[2];
}

function readMaxHeight() {
  const parsed = Number(nodes.maxHeightInput.value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 100;
}

function isPositive(vector) {
  return vector.every((value) => value >= 0) && vector.some((value) => value > 0);
}

function decorateRoot(entry) {
  const total = entry.vector[0] + entry.vector[1] + entry.vector[2];
  const barycentric = entry.vector.map((value) => value / total);
  const point = barycentricToCanvas(barycentric);
  return {
    ...entry,
    total,
    barycentric,
    point,
    label: rootLabel(entry.vector),
    witness: witnessLabel(entry),
  };
}

function compareRoots(left, right) {
  if (left.total !== right.total) {
    return left.total - right.total;
  }
  for (let i = 0; i < 3; i += 1) {
    if (left.vector[i] !== right.vector[i]) {
      return left.vector[i] - right.vector[i];
    }
  }
  return 0;
}

function vectorKey(vector) {
  return vector.join(",");
}

function rootLabel(vector) {
  return `${vector[0]} α₁ + ${vector[1]} α₂ + ${vector[2]} α₃`;
}

function witnessLabel(entry) {
  const action = entry.word.length
    ? entry.word.map((index) => `s${index + 1}`).join(" ")
    : "id";
  return `${action}(${simpleRootSymbol(entry.source)})`;
}

function formatMatrix(matrix) {
  return matrix.map((row) => `[ ${row.map((value) => String(value).padStart(2, " ")).join("  ")} ]`).join("\n");
}

function drawMatrixOutput(matrix) {
  nodes.cartanOutput.innerHTML = "";
  for (const row of matrix) {
    const line = document.createElement("div");
    line.className = "matrix-output-row";
    line.textContent = `[ ${row.map((value) => String(value).padStart(2, " ")).join("  ")} ]`;
    nodes.cartanOutput.append(line);
  }
}

function diagramSummary(cartan) {
  return EDGE_KEYS
    .map((key) => {
      const [i, j] = edgeIndices(key);
      const aij = cartan[i][j];
      const aji = cartan[j][i];
      const label = detectEdgeLabel(aij, aji);
      if (label === "custom") {
        return `${i + 1}-${j + 1}: custom from (${aij}, ${aji})`;
      }
      if (label === "inf") {
        const arrow = Math.abs(aij) === Math.abs(aji)
          ? "no arrow"
          : Math.abs(aij) > Math.abs(aji) ? `${i + 1} <- ${j + 1}` : `${j + 1} <- ${i + 1}`;
        return `${i + 1}-${j + 1}: label ∞, ${arrow}`;
      }
      if (label === 4 || label === 6) {
        const arrow = Math.abs(aij) > Math.abs(aji) ? `${i + 1} <- ${j + 1}` : `${j + 1} <- ${i + 1}`;
        return `${i + 1}-${j + 1}: label ${label}, arrow ${arrow}`;
      }
      return `${i + 1}-${j + 1}: label ${label}`;
    })
    .join(" | ");
}

function drawDiagram(cartan) {
  const svg = nodes.diagram;
  svg.innerHTML = "";

  const positions = {
    1: { x: 74, y: 118 },
    2: { x: 180, y: 56 },
    3: { x: 286, y: 118 },
  };

  for (const key of EDGE_KEYS) {
    const [i, j] = edgeIndices(key);
    const aij = cartan[i][j];
    const aji = cartan[j][i];
    const start = positions[i + 1];
    const end = positions[j + 1];

    if (aij === 0 && aji === 0) {
      continue;
    }

    svg.append(svgElement("line", {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      class: "diagram-edge",
    }));

    const label = detectEdgeLabel(aij, aji);
    const text = svgElement("text", {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2 - 14,
      class: "diagram-edge-label",
      "text-anchor": "middle",
    });
    text.textContent = label === "custom" ? `${aij}/${aji}` : label === "inf" ? "∞" : String(label);
    svg.append(text);

    if (label === 4 || label === 6 || label === "inf" || label === "custom") {
      if (Math.abs(aij) !== Math.abs(aji)) {
        const arrowToJ = Math.abs(aij) < Math.abs(aji);
        const arrowEnd = arrowToJ ? end : start;
        const arrowStart = arrowToJ ? start : end;
        svg.append(drawArrow(arrowStart, arrowEnd));
      }
    }
  }

  for (const index of [1, 2, 3]) {
    const pos = positions[index];
    svg.append(svgElement("circle", {
      cx: pos.x,
      cy: pos.y,
      r: 24,
      class: "diagram-node",
    }));
    const text = svgElement("text", {
      x: pos.x,
      y: pos.y + 5,
      class: "diagram-node-label",
      "text-anchor": "middle",
    });
    text.textContent = `${index}`;
    svg.append(text);
  }
}

function drawArrow(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / length;
  const uy = dy / length;
  const startX = from.x + ux * 30;
  const startY = from.y + uy * 30;
  const endX = to.x - ux * 30;
  const endY = to.y - uy * 30;
  const wing = 8;

  const group = svgElement("g", {});
  group.append(svgElement("line", {
    x1: startX,
    y1: startY,
    x2: endX,
    y2: endY,
    class: "diagram-arrow",
  }));
  group.append(svgElement("line", {
    x1: endX,
    y1: endY,
    x2: endX - ux * wing - uy * wing,
    y2: endY - uy * wing + ux * wing,
    class: "diagram-arrow",
  }));
  group.append(svgElement("line", {
    x1: endX,
    y1: endY,
    x2: endX - ux * wing + uy * wing,
    y2: endY - uy * wing - ux * wing,
    class: "diagram-arrow",
  }));
  return group;
}

function barycentricToCanvas([a, b, c]) {
  const margin = 90;
  const width = 720;
  const height = 640;
  const side = Math.min(width - 2 * margin, (height - 2 * margin) / 0.8660254037844386);
  const p1 = { x: margin, y: margin + side * 0.8660254037844386 };
  const p2 = { x: margin + side / 2, y: margin };
  const p3 = { x: margin + side, y: margin + side * 0.8660254037844386 };
  return {
    x: a * p1.x + b * p2.x + c * p3.x,
    y: a * p1.y + b * p2.y + c * p3.y,
  };
}

function drawPlot(roots, cartan) {
  const svg = nodes.plot;
  svg.innerHTML = "";
  rootCircles = [];
  dualLineElements = [];
  currentLineElement = null;
  currentConeData = null;
  separatingBackgroundLayer = null;
  separatingForegroundLayer = null;
  plotLayer = svgElement("g", {});
  svg.append(plotLayer);
  applyPlotTransform();
  const triangle = simplexTriangle();

  plotLayer.append(
    svgElement("polygon", {
      points: triangle.map((point) => `${point.x},${point.y}`).join(" "),
      class: "triangle-fill",
    }),
  );

  separatingBackgroundLayer = svgElement("g", {
    class: "separating-background-layer",
  });
  plotLayer.append(separatingBackgroundLayer);

  for (const line of simplexGridLines()) {
    plotLayer.append(
      svgElement("line", {
        x1: line.x1,
        y1: line.y1,
        x2: line.x2,
        y2: line.y2,
        class: "simplex-grid",
      }),
    );
  }

  plotLayer.append(
    svgElement("polygon", {
      points: triangle.map((point) => `${point.x},${point.y}`).join(" "),
      class: "triangle-edge",
    }),
  );

  const coneData = drawIsotropicCone(cartan);
  currentConeData = coneData;
  nodes.arrangementViewToggleWrap.style.display = coneData ? "" : "none";
  nodes.arrangementViewToggle.checked = coneData ? arrangementViewEnabled : false;
  if (!coneData && arrangementViewEnabled) {
    arrangementViewEnabled = false;
    nodes.arrangementViewToggle.checked = false;
  }
  if (coneData) {
    drawDualHyperplanes(roots, coneData);
  }

  const vertexLabels = [
    { point: triangle[0], text: "α₁" },
    { point: triangle[1], text: "α₂" },
    { point: triangle[2], text: "α₃" },
  ];

  for (const label of vertexLabels) {
    const text = svgElement("text", {
      x: label.point.x,
      y: label.point.y + (label.text === "α₂" ? -16 : 24),
      class: "plot-label",
      "text-anchor": "middle",
    });
    text.textContent = label.text;
    plotLayer.append(text);
  }

  for (const [index, root] of roots.entries()) {
    const circle = svgElement("circle", {
      cx: root.point.x,
      cy: root.point.y,
      r: 7,
      class: "dot",
      "data-index": String(index),
      "data-base-radius": String(baseRadiusForRoot(root)),
      tabindex: "0",
    });
    const tooltipText =
      `Root ${index + 1}\n` +
      `${root.label}\n` +
      `Coordinates: (${root.vector.join(", ")})\n` +
      `Witness: ${root.witness}`;
    circle.addEventListener("mouseenter", (event) => showTooltip(event, tooltipText, circle));
    circle.addEventListener("mousemove", (event) => moveTooltip(event));
    circle.addEventListener("mouseleave", () => hideTooltip(circle));
    circle.addEventListener("focus", () => showTooltipAtCircle(tooltipText, circle));
    circle.addEventListener("blur", () => hideTooltip(circle));
    circle.addEventListener("click", (event) => {
      event.stopPropagation();
      onRootClick(index);
      showTooltipAtCircle(tooltipText, circle);
    });
    plotLayer.append(circle);
    rootCircles.push(circle);
  }

  separatingForegroundLayer = svgElement("g", {
    class: "separating-foreground-layer",
  });
  plotLayer.append(separatingForegroundLayer);
  updateRootCircleScreenSize();
  refreshRootVisibilityVisuals();
  refreshLineSelectionVisuals();
}

function drawIsotropicCone(cartan) {
  const coneData = isotropicConeData(cartan);
  if (!coneData) {
    return null;
  }

  const path = svgElement("path", {
    d: coneData.path,
    class: "isotropic-cone",
  });
  plotLayer.append(path);
  return coneData;
}

function drawDualHyperplanes(roots, coneData) {
  for (const [index, root] of roots.entries()) {
    const segment = dualSegmentForRoot(root.vector, coneData);
    if (!segment) {
      dualLineElements[index] = null;
      continue;
    }
    const lineGeometry = arrangementViewEnabled
      ? extendedLineThroughPoints(segment.start, segment.end, 720, 640)
      : {
          x1: segment.start.x,
          y1: segment.start.y,
          x2: segment.end.x,
          y2: segment.end.y,
        };
    if (!lineGeometry) {
      dualLineElements[index] = null;
      continue;
    }
    const line = svgElement("line", {
      x1: lineGeometry.x1,
      y1: lineGeometry.y1,
      x2: lineGeometry.x2,
      y2: lineGeometry.y2,
      class: "dual-hyperplane",
    });
    if (arrangementViewEnabled) {
      line.classList.add("arrangement-view");
    }
    plotLayer.append(line);
    dualLineElements[index] = line;
  }
}

function dualSegmentForRoot(rootVector, coneData) {
  const { bilinear, reduced } = coneData;
  const { basis1, basis2, z0, matrix, linear, constant } = reduced;
  const lineA = quadraticPair(rootVector, bilinear, basis1);
  const lineB = quadraticPair(rootVector, bilinear, basis2);
  const lineC = quadraticPair(rootVector, bilinear, z0);
  const epsilon = 1e-9;

  if (Math.abs(lineA) < epsilon && Math.abs(lineB) < epsilon) {
    return null;
  }

  const direction = normalizeVector2({ x: lineB, y: -lineA });
  let basePoint;
  if (Math.abs(lineA) >= Math.abs(lineB)) {
    basePoint = { x: -lineC / lineA, y: 0 };
  } else {
    basePoint = { x: 0, y: -lineC / lineB };
  }

  const quad = evaluateQuadratic2(matrix, direction, direction);
  const mixed =
    2 * evaluateQuadratic2(matrix, basePoint, direction) +
    linear[0] * direction.x +
    linear[1] * direction.y;
  const offset =
    evaluateQuadratic2(matrix, basePoint, basePoint) +
    linear[0] * basePoint.x +
    linear[1] * basePoint.y +
    constant;

  const parameters = solveQuadraticReal(quad, mixed, offset);
  if (!parameters || parameters.length === 0) {
    return null;
  }

  const points = parameters
    .map((t) => ({
      x: basePoint.x + direction.x * t,
      y: basePoint.y + direction.y * t,
    }))
    .map(sliceCoordinatesToCanvasPoint);

  if (points.length === 1) {
    return { start: points[0], end: points[0] };
  }

  return { start: points[0], end: points[1] };
}

function solveQuadraticReal(a, b, c) {
  const epsilon = 1e-9;
  if (Math.abs(a) < epsilon) {
    if (Math.abs(b) < epsilon) {
      return null;
    }
    return [-c / b];
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < -epsilon) {
    return null;
  }
  if (Math.abs(discriminant) <= epsilon) {
    return [-b / (2 * a)];
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);
  return t1 <= t2 ? [t1, t2] : [t2, t1];
}

function sliceCoordinatesToCanvasPoint(point) {
  return barycentricToCanvas([point.x, point.y, 1 - point.x - point.y]);
}

function simplexTriangle() {
  return [
    barycentricToCanvas([1, 0, 0]),
    barycentricToCanvas([0, 1, 0]),
    barycentricToCanvas([0, 0, 1]),
  ];
}

function simplexGridLines() {
  const lines = [];
  for (const t of [0.25, 0.5, 0.75]) {
    const fixed1 = [
      barycentricToCanvas([t, 1 - t, 0]),
      barycentricToCanvas([t, 0, 1 - t]),
    ];
    const fixed2 = [
      barycentricToCanvas([1 - t, t, 0]),
      barycentricToCanvas([0, t, 1 - t]),
    ];
    const fixed3 = [
      barycentricToCanvas([1 - t, 0, t]),
      barycentricToCanvas([0, 1 - t, t]),
    ];
    for (const [start, end] of [fixed1, fixed2, fixed3]) {
      lines.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    }
  }
  return lines;
}

function drawTable() {
  nodes.rootTableBody.innerHTML = "";
  const rootsToShow = currentRoots.slice(0, visibleRootCount);
  for (const [index, root] of rootsToShow.entries()) {
    const row = document.createElement("tr");
    row.classList.toggle("root-row-hidden", !isRootVisible(root));
    row.classList.toggle("root-row-selected", selectedRootIndices.includes(index));
    row.classList.toggle(
      "root-row-line-member",
      highlightedLineRootIndices.has(index) && !selectedRootIndices.includes(index),
    );
    row.innerHTML = `
      <td>${index + 1}</td>
      <td><code>${root.label}</code></td>
      <td><code>(${root.vector.join(", ")})</code></td>
      <td><code>${root.witness}</code></td>
      <td class="root-row-actions-cell"></td>
    `;
    const actionsCell = row.querySelector(".root-row-actions-cell");

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "secondary-button root-row-button";
    const isSelected = selectedRootIndices.includes(index);
    selectButton.textContent = isSelected ? "Unselect" : "Select";
    selectButton.addEventListener("click", () => {
      if (!isRootVisible(root)) {
        toggleRootVisibility(index);
      }
      onRootClick(index);
    });

    const visibilityToggle = document.createElement("label");
    visibilityToggle.className = "root-row-visibility-toggle";

    const visibilityCheckbox = document.createElement("input");
    visibilityCheckbox.type = "checkbox";
    visibilityCheckbox.checked = isRootVisible(root);
    visibilityCheckbox.addEventListener("change", () => toggleRootVisibility(index));

    const visibilityText = document.createElement("span");
    visibilityText.textContent = "Visible";

    visibilityToggle.append(visibilityCheckbox, visibilityText);
    actionsCell.append(selectButton, visibilityToggle);
    nodes.rootTableBody.append(row);
  }
  nodes.showMoreButton.hidden = visibleRootCount >= currentRoots.length;
}

function showMoreRoots() {
  visibleRootCount = Math.min(visibleRootCount + ROOTS_PAGE_SIZE, currentRoots.length);
  drawTable();
}

function toggleRootVisibility(index) {
  const root = currentRoots[index];
  if (!root) {
    return;
  }
  const key = vectorKey(root.vector);
  if (hiddenRootKeys.has(key)) {
    hiddenRootKeys.delete(key);
  } else {
    hiddenRootKeys.add(key);
  }
  selectedRootIndices = selectedRootIndices.filter((selectedIndex) => {
    const selectedRoot = currentRoots[selectedIndex];
    return selectedRoot && isRootVisible(selectedRoot);
  });
  separatingLine.regionHighlight = null;
  recomputeLineSelection();
  refreshRootVisibilityVisuals();
  refreshLineSelectionVisuals();
  drawTable();
}

function isRootVisible(root) {
  return root ? !hiddenRootKeys.has(vectorKey(root.vector)) : false;
}

function refreshRootVisibilityVisuals() {
  for (let i = 0; i < rootCircles.length; i += 1) {
    const root = currentRoots[i];
    const visible = isRootVisible(root);
    const circle = rootCircles[i];
    if (circle) {
      circle.classList.toggle("is-hidden", !visible);
      circle.setAttribute("aria-hidden", String(!visible));
      if (!visible) {
        circle.classList.remove("active");
      }
    }
    const dualLine = dualLineElements[i];
    if (dualLine) {
      dualLine.classList.toggle("is-hidden", !visible);
      dualLine.classList.remove("active");
    }
  }
}

function showTooltip(event, text, circle) {
  circle.classList.add("active");
  setDualLineActive(circle, true);
  updateCircleRadius(circle);
  nodes.tooltip.textContent = text;
  nodes.tooltip.classList.remove("hidden");
  moveTooltip(event);
}

function showTooltipAtCircle(text, circle) {
  circle.classList.add("active");
  setDualLineActive(circle, true);
  updateCircleRadius(circle);
  nodes.tooltip.textContent = text;
  nodes.tooltip.classList.remove("hidden");
  const frame = document.querySelector(".viewer-frame").getBoundingClientRect();
  const box = circle.getBoundingClientRect();
  const x = box.left - frame.left + box.width / 2 + 16;
  const y = box.top - frame.top + box.height / 2 + 16;
  nodes.tooltip.style.left = `${x}px`;
  nodes.tooltip.style.top = `${y}px`;
}

function moveTooltip(event) {
  const frame = document.querySelector(".viewer-frame").getBoundingClientRect();
  const x = event.clientX - frame.left + 16;
  const y = event.clientY - frame.top + 16;
  nodes.tooltip.style.left = `${x}px`;
  nodes.tooltip.style.top = `${y}px`;
}

function hideTooltip(circle) {
  circle.classList.remove("active");
  setDualLineActive(circle, false);
  updateCircleRadius(circle);
  nodes.tooltip.classList.add("hidden");
}

function setDualLineActive(circle, active) {
  const index = Number(circle.dataset.index);
  if (!Number.isInteger(index)) {
    return;
  }
  const dualLine = dualLineElements[index];
  if (dualLine) {
    dualLine.classList.toggle("active", active);
  }
}

function setupPlotInteractions() {
  const svg = nodes.plot;
  svg.addEventListener("wheel", onPlotWheel, { passive: false });
  svg.addEventListener("pointerdown", onPlotPointerDown);
  svg.addEventListener("pointermove", onPlotPointerMove);
  svg.addEventListener("pointerup", onPlotPointerUp);
  svg.addEventListener("pointerleave", onPlotPointerUp);
  svg.addEventListener("pointercancel", onPlotPointerUp);
  svg.addEventListener("dblclick", resetPlotView);
}

function onPlotWheel(event) {
  event.preventDefault();
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  const nextScale = clamp(plotView.scale * factor, plotView.minScale, plotView.maxScale);
  const actualFactor = nextScale / plotView.scale;
  if (actualFactor === 1) {
    return;
  }

  const point = clientToSvgPoint(event.clientX, event.clientY);
  plotView.tx = point.x - actualFactor * (point.x - plotView.tx);
  plotView.ty = point.y - actualFactor * (point.y - plotView.ty);
  plotView.scale = nextScale;
  applyPlotTransform();
}

function onPlotPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }
  plotView.activePointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
  });
  if (plotView.activePointers.size === 2) {
    beginPinchGesture();
  }
  if (event.target instanceof Element && event.target.classList.contains("dot")) {
    plotView.pointerDown = false;
    plotView.dragStartClient = null;
    return;
  }
  plotView.pointerDown = true;
  plotView.dragStartClient = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  plotView.lastPoint = clientToSvgPoint(event.clientX, event.clientY);
}

function onPlotPointerMove(event) {
  if (separatingLine.dragPointerId === event.pointerId) {
    moveSeparatingHandle(event);
    return;
  }
  if (plotView.activePointers.has(event.pointerId)) {
    plotView.activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  if (plotView.activePointers.size >= 2) {
    updatePinchGesture();
    return;
  }

  if (plotView.pointerDown && !plotView.dragging && plotView.dragStartClient) {
    const dx = event.clientX - plotView.dragStartClient.x;
    const dy = event.clientY - plotView.dragStartClient.y;
    if (Math.hypot(dx, dy) >= 4) {
      plotView.dragging = true;
      nodes.plot.classList.add("is-dragging");
      nodes.plot.setPointerCapture(plotView.dragStartClient.pointerId);
    }
  }

  if (!plotView.dragging) {
    return;
  }
  const point = clientToSvgPoint(event.clientX, event.clientY);
  plotView.tx += point.x - plotView.lastPoint.x;
  plotView.ty += point.y - plotView.lastPoint.y;
  plotView.lastPoint = point;
  applyPlotTransform();
}

function onPlotPointerUp(event) {
  if (separatingLine.dragPointerId === event.pointerId) {
    endSeparatingHandleDrag(event);
    return;
  }
  plotView.activePointers.delete(event.pointerId);
  if (plotView.activePointers.size < 2) {
    plotView.pinchDistance = null;
    plotView.pinchMidpoint = null;
  }
  plotView.pointerDown = false;
  plotView.dragStartClient = null;
  if (!plotView.dragging) {
    return;
  }
  plotView.dragging = false;
  plotView.lastPoint = null;
  nodes.plot.classList.remove("is-dragging");
  if (event.pointerId !== undefined && nodes.plot.hasPointerCapture(event.pointerId)) {
    nodes.plot.releasePointerCapture(event.pointerId);
  }
}

function resetPlotView() {
  plotView.scale = 1;
  plotView.tx = 0;
  plotView.ty = 0;
  plotView.pointerDown = false;
  plotView.dragging = false;
  plotView.dragStartClient = null;
  plotView.lastPoint = null;
  plotView.activePointers.clear();
  plotView.pinchDistance = null;
  plotView.pinchScale = 1;
  plotView.pinchMidpoint = null;
  nodes.plot.classList.remove("is-dragging");
  applyPlotTransform();
  runExtensionHook("afterResetView");
}

function clearLineSelection() {
  selectedRootIndices = [];
  highlightedLineRootIndices = new Set();
  invalidateSeparatingRegionHighlight();
  refreshLineSelectionVisuals();
  drawTable();
}

function applyPlotTransform() {
  if (!plotLayer) {
    return;
  }
  plotLayer.setAttribute(
    "transform",
    `translate(${plotView.tx} ${plotView.ty}) scale(${plotView.scale})`,
  );
  updateRootCircleScreenSize();
  updateSeparatingHandleScreenSize();
  runExtensionHook("afterPlotTransform");
}

function clientToSvgPoint(clientX, clientY) {
  const point = nodes.plot.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const matrix = nodes.plot.getScreenCTM();
  if (!matrix) {
    return { x: 0, y: 0 };
  }
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function beginPinchGesture() {
  const [first, second] = firstTwoPointers();
  if (!first || !second) {
    return;
  }
  plotView.pointerDown = false;
  plotView.dragging = false;
  plotView.dragStartClient = null;
  plotView.lastPoint = null;
  nodes.plot.classList.remove("is-dragging");
  plotView.pinchDistance = distanceBetween(first, second);
  plotView.pinchScale = plotView.scale;
  const midpointSvg = clientToSvgPoint(
    (first.x + second.x) / 2,
    (first.y + second.y) / 2,
  );
  plotView.pinchMidpoint = {
    x: (midpointSvg.x - plotView.tx) / plotView.scale,
    y: (midpointSvg.y - plotView.ty) / plotView.scale,
  };
}

function updatePinchGesture() {
  const [first, second] = firstTwoPointers();
  if (!first || !second) {
    return;
  }
  if (!plotView.pinchDistance || !plotView.pinchMidpoint) {
    beginPinchGesture();
    return;
  }

  const nextDistance = distanceBetween(first, second);
  if (nextDistance <= 0) {
    return;
  }

  const midpointClientX = (first.x + second.x) / 2;
  const midpointClientY = (first.y + second.y) / 2;
  const midpointSvg = clientToSvgPoint(midpointClientX, midpointClientY);
  const nextScale = clamp(
    plotView.pinchScale * (nextDistance / plotView.pinchDistance),
    plotView.minScale,
    plotView.maxScale,
  );

  plotView.scale = nextScale;
  plotView.tx = midpointSvg.x - nextScale * plotView.pinchMidpoint.x;
  plotView.ty = midpointSvg.y - nextScale * plotView.pinchMidpoint.y;
  applyPlotTransform();
}

function firstTwoPointers() {
  const pointers = Array.from(plotView.activePointers.values());
  return [pointers[0], pointers[1]];
}

function distanceBetween(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function updateRootCircleScreenSize() {
  for (const circle of rootCircles) {
    updateCircleRadius(circle);
  }
}

function updateCircleRadius(circle) {
  const baseRadius = Number(circle.getAttribute("data-base-radius")) || 7;
  const selectedBoost = circle.classList.contains("selected") ? 1.6 : 0;
  const lineBoost = circle.classList.contains("line-member") ? 0.5 : 0;
  const activeBoost = circle.classList.contains("active") ? 2 : 0;
  const radius = baseRadius + selectedBoost + lineBoost + activeBoost;
  circle.setAttribute("r", String(radius / plotView.scale));
}

function baseRadiusForRoot(root) {
  const height = Math.max(1, root.total);
  const radius = 8 - 1.15 * Math.log2(height);
  return clamp(radius, 3.2, 8);
}

function onRootClick(index) {
  const root = currentRoots[index];
  if (!root || !isRootVisible(root)) {
    return;
  }
  if (selectRank2Enabled) {
    if (selectedRootIndices.length === 0) {
      selectedRootIndices = [index];
    } else if (selectedRootIndices.length === 1) {
      if (selectedRootIndices[0] === index) {
        selectedRootIndices = [];
      } else {
        selectedRootIndices = [selectedRootIndices[0], index];
      }
    } else if (selectedRootIndices.includes(index)) {
      selectedRootIndices = [index];
    } else {
      selectedRootIndices = [index];
    }
  } else {
    selectedRootIndices = selectedRootIndices.includes(index)
      ? selectedRootIndices.filter((selectedIndex) => selectedIndex !== index)
      : [...selectedRootIndices, index];
  }

  invalidateSeparatingRegionHighlight();
  recomputeLineSelection();
  refreshLineSelectionVisuals();
  drawTable();
  runExtensionHook("afterRootClick", {
    index,
    root,
    selected: selectedRootIndices.includes(index),
  });
}

function recomputeLineSelection() {
  highlightedLineRootIndices = new Set();
  if (!selectRank2Enabled || selectedRootIndices.length !== 2) {
    return;
  }

  const [firstIndex, secondIndex] = selectedRootIndices;
  const first = currentRoots[firstIndex];
  const second = currentRoots[secondIndex];
  if (!first || !second || !isRootVisible(first) || !isRootVisible(second)) {
    return;
  }

  for (let i = 0; i < currentRoots.length; i += 1) {
    if (isRootVisible(currentRoots[i]) && isRootOnLine(currentRoots[i], first, second)) {
      highlightedLineRootIndices.add(i);
    }
  }
}

function isRootOnLine(candidate, first, second) {
  const ax = first.point.x;
  const ay = first.point.y;
  const bx = second.point.x;
  const by = second.point.y;
  const cx = candidate.point.x;
  const cy = candidate.point.y;
  const area2 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const scale = Math.max(1, Math.abs(bx - ax) + Math.abs(by - ay));
  return Math.abs(area2) <= 1e-6 * scale;
}

function syncSeparatingLineControls() {
  const disabled = !separatingLineEnabled;
  nodes.separatingLineActions.hidden = disabled;
  nodes.flipSeparatingSideButton.disabled = disabled;
  nodes.separatedRootsButton.disabled = disabled;
  nodes.findSeparatingLineButton.disabled = disabled;
}

function setSeparatingLineStatus(message) {
  nodes.separatingLineStatus.textContent = message;
}

function ensureSeparatingLine() {
  if (separatingLine.first && separatingLine.second) {
    return;
  }
  separatingLine.first = barycentricToCanvas([0.58, 0.34, 0.08]);
  separatingLine.second = barycentricToCanvas([0.08, 0.34, 0.58]);
  separatingLine.halfspaceSign = 1;
}

function selectedRootSignature(indices = selectedRootIndices) {
  return indices
    .map((index) => currentRoots[index])
    .filter(Boolean)
    .map((root) => vectorKey(root.vector))
    .sort()
    .join("|");
}

function invalidateSeparatingRegionHighlight() {
  if (
    separatingLine.regionHighlight
    && separatingLine.regionHighlight.selectionSignature !== selectedRootSignature()
  ) {
    separatingLine.regionHighlight = null;
    if (separatingLineEnabled) {
      setSeparatingLineStatus("");
    }
  }
}

function visibleRootIndices() {
  return currentRoots
    .map((root, index) => ({ root, index }))
    .filter(({ root }) => isRootVisible(root))
    .map(({ index }) => index);
}

function lineSignedValue(first, second, point) {
  return (second.x - first.x) * (point.y - first.y)
    - (second.y - first.y) * (point.x - first.x);
}

function lineTolerance(first, second) {
  return Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)) * 1e-7;
}

function shadedRootClassification(first = separatingLine.first, second = separatingLine.second) {
  if (!first || !second) {
    return { indices: [], boundaryIndices: [] };
  }
  const tolerance = lineTolerance(first, second);
  const indices = [];
  const boundaryIndices = [];
  for (const index of visibleRootIndices()) {
    const value = lineSignedValue(first, second, currentRoots[index].point);
    if (Math.abs(value) <= tolerance) {
      boundaryIndices.push(index);
    } else if (value * separatingLine.halfspaceSign > 0) {
      indices.push(index);
    }
  }
  return { indices, boundaryIndices };
}

function flipSeparatingHalfspace() {
  if (!separatingLineEnabled) {
    return;
  }
  separatingLine.halfspaceSign *= -1;
  updateShadedSideStatus();
  renderSeparatingOverlays();
}

function updateShadedSideStatus() {
  const classification = shadedRootClassification();
  setSeparatingLineStatus(
    `The shaded side contains ${classification.indices.length} visible root${classification.indices.length === 1 ? "" : "s"}.`,
  );
}

function setSeparatingHalfspace(first, second, halfspaceSign) {
  separatingLine.first = { ...first };
  separatingLine.second = { ...second };
  separatingLine.halfspaceSign = halfspaceSign >= 0 ? 1 : -1;
  separatingLine.regionHighlight = null;
  if (separatingLineEnabled) {
    updateShadedSideStatus();
    renderSeparatingOverlays();
  }
}

function selectSeparatedRoots() {
  if (!separatingLineEnabled) {
    return;
  }
  const classification = shadedRootClassification();
  if (selectRank2Enabled && classification.indices.length > 2) {
    selectRank2Enabled = false;
    nodes.selectRank2Toggle.checked = false;
  }
  selectedRootIndices = classification.indices;
  recomputeLineSelection();

  separatingLine.regionHighlight = null;
  const witness = findSeparatingLineForSelectedRoots();
  const highlighted = witness ? activateSeparatingRegionHighlight(witness) : false;
  const boundaryNote = classification.boundaryIndices.length
    ? ` ${classification.boundaryIndices.length} root${classification.boundaryIndices.length === 1 ? " lies" : "s lie"} on the line.`
    : "";
  const highlightNote = highlighted ? " Its dual region is highlighted." : "";
  setSeparatingLineStatus(
    `Selected ${classification.indices.length} root${classification.indices.length === 1 ? "" : "s"} from the shaded open half-space.${boundaryNote}${highlightNote}`,
  );
  refreshLineSelectionVisuals();
  drawTable();
}

function findSeparatingLine() {
  if (!separatingLineEnabled) {
    return;
  }
  const result = findSeparatingLineForSelectedRoots();
  if (!result) {
    separatingLine.regionHighlight = null;
    setSeparatingLineStatus("The current visible-root selection is not separable by a line.");
    refreshLineSelectionVisuals();
    return;
  }

  separatingLine.first = result.first;
  separatingLine.second = result.second;
  separatingLine.halfspaceSign = result.halfspaceSign;
  const highlighted = activateSeparatingRegionHighlight(result);
  setSeparatingLineStatus(
    `Found a separating line for the ${selectedRootIndices.length} selected root${selectedRootIndices.length === 1 ? "" : "s"}.${highlighted ? " Its dual region is highlighted." : ""}`,
  );
  refreshLineSelectionVisuals();
}

function findSeparatingLineForSelectedRoots() {
  const universe = visibleRootIndices();
  if (!universe.length) {
    return null;
  }
  const selected = new Set(selectedRootIndices.filter((index) => universe.includes(index)));
  const selectedPoints = universe
    .filter((index) => selected.has(index))
    .map((index) => currentRoots[index].point);
  const unselectedPoints = universe
    .filter((index) => !selected.has(index))
    .map((index) => currentRoots[index].point);

  if (!selectedPoints.length || !unselectedPoints.length) {
    const normal = { x: 1, y: 0 };
    const projections = universe.map((index) => currentRoots[index].point.x);
    const margin = 20;
    const threshold = selectedPoints.length
      ? Math.min(...projections) - margin
      : Math.max(...projections) + margin;
    return separatingLineForNormal(normal, threshold, selected, universe);
  }

  const criticalAngles = [0];
  const points = universe.map((index) => currentRoots[index].point);
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      if (Math.hypot(dx, dy) <= 1e-8) {
        continue;
      }
      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      angle %= Math.PI;
      if (angle < 0) {
        angle += Math.PI;
      }
      criticalAngles.push(angle);
    }
  }
  criticalAngles.sort((left, right) => left - right);
  const angles = criticalAngles.filter(
    (angle, index) => index === 0 || Math.abs(angle - criticalAngles[index - 1]) > 1e-9,
  );

  for (let i = 0; i < angles.length; i += 1) {
    const start = angles[i];
    const end = i + 1 < angles.length ? angles[i + 1] : angles[0] + Math.PI;
    const angle = (start + end) / 2;
    for (const orientation of [1, -1]) {
      const normal = {
        x: orientation * Math.cos(angle),
        y: orientation * Math.sin(angle),
      };
      const candidate = separatingLineForNormal(normal, null, selected, universe);
      if (candidate) {
        return candidate;
      }
    }
  }
  return null;
}

function separatingLineForNormal(normal, threshold, selected, universe) {
  const selectedProjections = [];
  const unselectedProjections = [];
  for (const index of universe) {
    const point = currentRoots[index].point;
    const projection = normal.x * point.x + normal.y * point.y;
    if (selected.has(index)) {
      selectedProjections.push(projection);
    } else {
      unselectedProjections.push(projection);
    }
  }

  let lineThreshold = threshold;
  if (lineThreshold === null) {
    const minSelected = Math.min(...selectedProjections);
    const maxUnselected = Math.max(...unselectedProjections);
    const scale = Math.max(
      1,
      ...selectedProjections.map(Math.abs),
      ...unselectedProjections.map(Math.abs),
    );
    if (minSelected - maxUnselected <= scale * 1e-8) {
      return null;
    }
    lineThreshold = (minSelected + maxUnselected) / 2;
  }

  const controls = controlPointsForLine(normal, lineThreshold);
  const tolerance = lineTolerance(controls.first, controls.second);
  let halfspaceSign = 1;
  for (const index of universe) {
    const value = lineSignedValue(controls.first, controls.second, currentRoots[index].point);
    if (Math.abs(value) <= tolerance) {
      return null;
    }
    if (selected.has(index)) {
      halfspaceSign = value > 0 ? 1 : -1;
      break;
    }
    halfspaceSign = value > 0 ? -1 : 1;
  }

  const candidate = {
    first: controls.first,
    second: controls.second,
    halfspaceSign,
  };
  return lineMatchesSelectedRoots(candidate, selected, universe) ? candidate : null;
}

function controlPointsForLine(normal, threshold) {
  const anchor = {
    x: normal.x * threshold,
    y: normal.y * threshold,
  };
  const direction = { x: -normal.y, y: normal.x };
  const extended = extendedLineThroughPoints(
    { x: anchor.x - direction.x * 2000, y: anchor.y - direction.y * 2000 },
    { x: anchor.x + direction.x * 2000, y: anchor.y + direction.y * 2000 },
    720,
    640,
  );
  if (extended) {
    const start = { x: extended.x1, y: extended.y1 };
    const end = { x: extended.x2, y: extended.y2 };
    return {
      first: interpolatePoint(start, end, 0.2),
      second: interpolatePoint(start, end, 0.8),
    };
  }
  return {
    first: { x: anchor.x - direction.x * 120, y: anchor.y - direction.y * 120 },
    second: { x: anchor.x + direction.x * 120, y: anchor.y + direction.y * 120 },
  };
}

function interpolatePoint(first, second, t) {
  return {
    x: first.x + (second.x - first.x) * t,
    y: first.y + (second.y - first.y) * t,
  };
}

function lineMatchesSelectedRoots(candidate, selected, universe) {
  const tolerance = lineTolerance(candidate.first, candidate.second);
  return universe.every((index) => {
    const value = lineSignedValue(candidate.first, candidate.second, currentRoots[index].point);
    if (Math.abs(value) <= tolerance) {
      return false;
    }
    return (value * candidate.halfspaceSign > 0) === selected.has(index);
  });
}

function activateSeparatingRegionHighlight(candidate) {
  const dualData = dualRegionDataForLine(candidate);
  if (
    !dualData
    || !isDualRegionVisible(dualData.point)
    || !lineMatchesSelectedRoots(candidate, new Set(selectedRootIndices), visibleRootIndices())
  ) {
    separatingLine.regionHighlight = null;
    return false;
  }
  separatingLine.regionHighlight = {
    selectionSignature: selectedRootSignature(),
    point: dualData.point,
    dualSign: dualData.dualSign,
  };
  return true;
}

function isDualRegionVisible(point) {
  return Boolean(
    currentConeData
    && (arrangementViewEnabled || pointInPolygon(point, currentConeData.points)),
  );
}

function dualRegionDataForLine(candidate) {
  if (!currentConeData) {
    return null;
  }
  const first = canvasToBarycentric(candidate.first);
  const second = canvasToBarycentric(candidate.second);
  const firstEquation = vectorMatrixProduct(first, currentConeData.bilinear);
  const secondEquation = vectorMatrixProduct(second, currentConeData.bilinear);
  const dualVector = crossProduct3(firstEquation, secondEquation);
  const sum = dualVector[0] + dualVector[1] + dualVector[2];
  if (Math.abs(sum) <= 1e-9) {
    return null;
  }
  const normalizedDual = dualVector.map((value) => value / sum);
  const point = barycentricToCanvas(normalizedDual);
  const tolerance = lineTolerance(candidate.first, candidate.second);
  for (const index of visibleRootIndices()) {
    const root = currentRoots[index];
    const lineValue = lineSignedValue(candidate.first, candidate.second, root.point);
    const dualValue = quadraticPair(root.barycentric, currentConeData.bilinear, normalizedDual);
    if (Math.abs(lineValue) > tolerance && Math.abs(dualValue) > 1e-10) {
      return {
        point,
        dualSign: candidate.halfspaceSign * Math.sign(lineValue * dualValue),
      };
    }
  }
  return null;
}

function orientedDualVectorForLine(candidate) {
  if (!currentConeData) {
    return null;
  }
  const first = canvasToBarycentric(candidate.first);
  const second = canvasToBarycentric(candidate.second);
  const firstEquation = vectorMatrixProduct(first, currentConeData.bilinear);
  const secondEquation = vectorMatrixProduct(second, currentConeData.bilinear);
  const dualVector = crossProduct3(firstEquation, secondEquation);
  const tolerance = lineTolerance(candidate.first, candidate.second);
  for (const index of visibleRootIndices()) {
    const root = currentRoots[index];
    const lineValue = lineSignedValue(candidate.first, candidate.second, root.point);
    const dualValue = quadraticPair(root.barycentric, currentConeData.bilinear, dualVector);
    if (Math.abs(lineValue) > tolerance && Math.abs(dualValue) > 1e-10) {
      const orientation = candidate.halfspaceSign * Math.sign(lineValue * dualValue);
      return dualVector.map((value) => orientation * value);
    }
  }
  return null;
}

function vectorMatrixProduct(vector, matrix) {
  return matrix[0].map((_, column) => (
    vector[0] * matrix[0][column]
      + vector[1] * matrix[1][column]
      + vector[2] * matrix[2][column]
  ));
}

function crossProduct3(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function canvasToBarycentric(point) {
  const [first, second, third] = simplexTriangle();
  const b = (first.y - point.y) / (first.y - second.y);
  const c = (point.x - first.x - b * (second.x - first.x)) / (third.x - first.x);
  return [1 - b - c, b, c];
}

function renderSeparatingOverlays() {
  if (!separatingBackgroundLayer || !separatingForegroundLayer) {
    return;
  }
  separatingBackgroundLayer.replaceChildren();
  separatingForegroundLayer.replaceChildren();
  if (!separatingLineEnabled) {
    return;
  }
  ensureSeparatingLine();
  drawSeparatingRegionHighlight();
  drawSeparatingLineShade();
  drawSeparatingLineControls();
}

function drawSeparatingRegionHighlight() {
  const highlight = separatingLine.regionHighlight;
  if (!highlight || highlight.selectionSignature !== selectedRootSignature() || !currentConeData) {
    return;
  }
  if (!arrangementViewEnabled && !pointInPolygon(highlight.point, currentConeData.points)) {
    return;
  }
  let polygon = arrangementViewEnabled
    ? canvasRectangle()
    : currentConeData.points.map((point) => ({ ...point }));
  const selected = new Set(selectedRootIndices);
  for (const index of visibleRootIndices()) {
    const root = currentRoots[index];
    const desiredSign = selected.has(index) ? highlight.dualSign : -highlight.dualSign;
    polygon = clipPolygonToHalfPlane(
      polygon,
      (point) => desiredSign * dualValueAtCanvasPoint(root, point),
    );
    if (polygon.length < 3) {
      return;
    }
  }
  separatingBackgroundLayer.append(
    svgElement("polygon", {
      points: polygon.map((point) => `${point.x},${point.y}`).join(" "),
      class: "separating-region-highlight",
    }),
  );
}

function drawSeparatingLineShade() {
  const polygon = clipPolygonToHalfPlane(
    canvasRectangle(),
    (point) => separatingLine.halfspaceSign
      * lineSignedValue(separatingLine.first, separatingLine.second, point),
  );
  if (polygon.length < 3) {
    return;
  }
  separatingBackgroundLayer.append(
    svgElement("polygon", {
      points: polygon.map((point) => `${point.x},${point.y}`).join(" "),
      class: "separating-line-shade",
    }),
  );
}

function drawSeparatingLineControls() {
  const line = extendedLineThroughPoints(separatingLine.first, separatingLine.second, 720, 640);
  if (line) {
    separatingForegroundLayer.append(
      svgElement("line", {
        x1: line.x1,
        y1: line.y1,
        x2: line.x2,
        y2: line.y2,
        class: "separating-line",
      }),
    );
  }
  for (const [handle, point, label] of [
    ["first", separatingLine.first, "Drag the first separating-line point"],
    ["second", separatingLine.second, "Drag the second separating-line point"],
  ]) {
    const circle = svgElement("circle", {
      cx: point.x,
      cy: point.y,
      r: 10 / plotView.scale,
      class: "separating-handle",
      role: "button",
      tabindex: "0",
      "aria-label": `${label}; use arrow keys for small adjustments`,
    });
    circle.addEventListener("pointerdown", (event) => beginSeparatingHandleDrag(event, handle));
    circle.addEventListener("keydown", (event) => nudgeSeparatingHandle(event, handle));
    separatingForegroundLayer.append(circle);
  }
}

function canvasRectangle() {
  return [
    { x: 0, y: 0 },
    { x: 720, y: 0 },
    { x: 720, y: 640 },
    { x: 0, y: 640 },
  ];
}

function clipPolygonToHalfPlane(polygon, valueAtPoint) {
  if (!polygon.length) {
    return [];
  }
  const clipped = [];
  let previous = polygon[polygon.length - 1];
  let previousValue = valueAtPoint(previous);
  for (const current of polygon) {
    const currentValue = valueAtPoint(current);
    const previousInside = previousValue >= -1e-9;
    const currentInside = currentValue >= -1e-9;
    if (previousInside !== currentInside) {
      const t = previousValue / (previousValue - currentValue);
      clipped.push(interpolatePoint(previous, current, t));
    }
    if (currentInside) {
      clipped.push(current);
    }
    previous = current;
    previousValue = currentValue;
  }
  return clipped;
}

function dualValueAtCanvasPoint(root, point) {
  return quadraticPair(
    root.barycentric,
    currentConeData.bilinear,
    canvasToBarycentric(point),
  );
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const first = polygon[i];
    const second = polygon[j];
    const crosses = (first.y > point.y) !== (second.y > point.y);
    if (crosses && point.x < (second.x - first.x) * (point.y - first.y) / (second.y - first.y) + first.x) {
      inside = !inside;
    }
  }
  return inside;
}

function beginSeparatingHandleDrag(event, handle) {
  if (!separatingLineEnabled || (event.pointerType === "mouse" && event.button !== 0)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  separatingLine.dragPointerId = event.pointerId;
  separatingLine.dragHandle = handle;
  plotView.pointerDown = false;
  plotView.dragging = false;
  plotView.activePointers.clear();
  nodes.plot.classList.remove("is-dragging");
  nodes.plot.setPointerCapture(event.pointerId);
}

function moveSeparatingHandle(event) {
  if (!separatingLine.dragHandle) {
    return;
  }
  event.preventDefault();
  const point = plotPointFromClient(event.clientX, event.clientY);
  const other = separatingLine.dragHandle === "first" ? separatingLine.second : separatingLine.first;
  if (Math.hypot(point.x - other.x, point.y - other.y) < 16 / plotView.scale) {
    return;
  }
  separatingLine[separatingLine.dragHandle] = point;
  updateShadedSideStatus();
  renderSeparatingOverlays();
}

function endSeparatingHandleDrag(event) {
  separatingLine.dragPointerId = null;
  separatingLine.dragHandle = null;
  if (nodes.plot.hasPointerCapture(event.pointerId)) {
    nodes.plot.releasePointerCapture(event.pointerId);
  }
}

function nudgeSeparatingHandle(event, handle) {
  const directions = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
  };
  const direction = directions[event.key];
  if (!direction) {
    return;
  }
  event.preventDefault();
  const step = (event.shiftKey ? 20 : 5) / plotView.scale;
  const point = separatingLine[handle];
  const other = handle === "first" ? separatingLine.second : separatingLine.first;
  const next = {
    x: clamp(point.x + direction.x * step, 0, 720),
    y: clamp(point.y + direction.y * step, 0, 640),
  };
  if (Math.hypot(next.x - other.x, next.y - other.y) < 16 / plotView.scale) {
    return;
  }
  separatingLine[handle] = next;
  updateShadedSideStatus();
  renderSeparatingOverlays();
}

function plotPointFromClient(clientX, clientY) {
  const point = clientToSvgPoint(clientX, clientY);
  return {
    x: clamp((point.x - plotView.tx) / plotView.scale, 0, 720),
    y: clamp((point.y - plotView.ty) / plotView.scale, 0, 640),
  };
}

function updateSeparatingHandleScreenSize() {
  if (!separatingForegroundLayer) {
    return;
  }
  for (const handle of separatingForegroundLayer.querySelectorAll(".separating-handle")) {
    handle.setAttribute("r", String(10 / plotView.scale));
  }
}

function refreshLineSelectionVisuals() {
  if (currentLineElement) {
    currentLineElement.remove();
    currentLineElement = null;
  }

  for (let i = 0; i < rootCircles.length; i += 1) {
    const circle = rootCircles[i];
    if (!isRootVisible(currentRoots[i])) {
      circle.classList.remove("selected", "line-member", "active", "arrangement-muted");
      const dualLine = dualLineElements[i];
      if (dualLine) {
        dualLine.classList.remove("selected", "line-member", "active");
      }
      updateCircleRadius(circle);
      continue;
    }
    const isSelected = selectedRootIndices.includes(i);
    const isLineMember = highlightedLineRootIndices.has(i) && !isSelected;
    circle.classList.toggle("arrangement-muted", arrangementViewEnabled);
    circle.classList.toggle("selected", isSelected);
    circle.classList.toggle("line-member", isLineMember);
    const dualLine = dualLineElements[i];
    if (dualLine) {
      dualLine.classList.toggle("selected", isSelected);
      dualLine.classList.toggle("line-member", isLineMember);
    }
    updateCircleRadius(circle);
  }

  if (selectRank2Enabled && selectedRootIndices.length === 2) {
    const [firstIndex, secondIndex] = selectedRootIndices;
    const first = currentRoots[firstIndex];
    const second = currentRoots[secondIndex];
    if (first && second && isRootVisible(first) && isRootVisible(second) && plotLayer) {
      const line = extendedLineThroughPoints(first.point, second.point, 720, 640);
      if (line) {
        currentLineElement = svgElement("line", {
          x1: line.x1,
          y1: line.y1,
          x2: line.x2,
          y2: line.y2,
          class: "selection-line",
        });
        plotLayer.insertBefore(currentLineElement, plotLayer.firstChild);
      }
    }
  }

  renderSeparatingOverlays();
}

function extendedLineThroughPoints(first, second, width, height) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const points = [];
  const epsilon = 1e-9;

  if (Math.abs(dx) > epsilon) {
    const yAtLeft = first.y + (0 - first.x) * dy / dx;
    if (yAtLeft >= 0 && yAtLeft <= height) {
      points.push({ x: 0, y: yAtLeft });
    }
    const yAtRight = first.y + (width - first.x) * dy / dx;
    if (yAtRight >= 0 && yAtRight <= height) {
      points.push({ x: width, y: yAtRight });
    }
  }

  if (Math.abs(dy) > epsilon) {
    const xAtTop = first.x + (0 - first.y) * dx / dy;
    if (xAtTop >= 0 && xAtTop <= width) {
      points.push({ x: xAtTop, y: 0 });
    }
    const xAtBottom = first.x + (height - first.y) * dx / dy;
    if (xAtBottom >= 0 && xAtBottom <= width) {
      points.push({ x: xAtBottom, y: height });
    }
  }

  const uniquePoints = [];
  for (const point of points) {
    if (!uniquePoints.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < 1e-6)) {
      uniquePoints.push(point);
    }
  }

  if (uniquePoints.length < 2) {
    return null;
  }

  const [start, end] = uniquePoints.length === 2
    ? uniquePoints
    : farthestPair(uniquePoints);

  return {
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
  };
}

function simpleRootSymbol(index) {
  return ["α₁", "α₂", "α₃"][index] || `α${index + 1}`;
}

function isotropicConeData(cartan) {
  const symmetrizer = symmetrizerForCartan(cartan);
  if (!symmetrizer) {
    return null;
  }

  const bilinear = symmetricBilinearForm(cartan, symmetrizer);
  if (!isIndefiniteSymmetric3(bilinear)) {
    return null;
  }

  const reduced = reducedQuadraticOnSlice(bilinear);
  if (!reduced) {
    return null;
  }

  const { center, matrix, shiftedConstant } = reduced;
  const signedMatrix = matrix2SignNormalized(matrix, shiftedConstant);
  if (!signedMatrix) {
    return null;
  }

  const { normalized, rhs } = signedMatrix;
  const eig = eigenDecomposition2(normalized);
  if (!eig || eig.values.some((value) => value <= 1e-10) || rhs <= 1e-10) {
    return null;
  }

  const radius1 = Math.sqrt(rhs / eig.values[0]);
  const radius2 = Math.sqrt(rhs / eig.values[1]);
  const points = [];
  const samples = 240;
  for (let i = 0; i <= samples; i += 1) {
    const theta = 2 * Math.PI * i / samples;
    const local = {
      x: radius1 * Math.cos(theta),
      y: radius2 * Math.sin(theta),
    };
    const uv = {
      x: center.x + eig.vectors[0].x * local.x + eig.vectors[1].x * local.y,
      y: center.y + eig.vectors[0].y * local.x + eig.vectors[1].y * local.y,
    };
    const barycentric = [uv.x, uv.y, 1 - uv.x - uv.y];
    const canvas = barycentricToCanvas(barycentric);
    points.push(canvas);
  }

  if (points.length < 2) {
    return null;
  }

  const path =
    `M ${points[0].x} ${points[0].y} ` +
    points.slice(1).map((point) => `L ${point.x} ${point.y}`).join(" ") +
    " Z";

  return { path, points, bilinear, reduced };
}

function symmetrizerForCartan(cartan) {
  const ratios = [null, null, null];
  ratios[0] = { num: 1, den: 1 };
  const queue = [0];

  while (queue.length) {
    const i = queue.shift();
    for (let j = 0; j < 3; j += 1) {
      if (i === j) {
        continue;
      }
      const aij = cartan[i][j];
      const aji = cartan[j][i];
      if (aij === 0 && aji === 0) {
        continue;
      }
      if (aij === 0 || aji === 0) {
        return null;
      }
      const candidate = multiplyFraction(ratios[i], { num: Math.abs(aij), den: Math.abs(aji) });
      if (!ratios[j]) {
        ratios[j] = candidate;
        queue.push(j);
      } else if (!sameFraction(ratios[j], candidate)) {
        return null;
      }
    }
  }

  for (let i = 0; i < 3; i += 1) {
    if (!ratios[i]) {
      ratios[i] = { num: 1, den: 1 };
    }
  }

  let lcm = 1;
  for (const ratio of ratios) {
    lcm = lcm2(lcm, ratio.den);
  }

  return ratios.map((ratio) => ratio.num * (lcm / ratio.den));
}

function symmetricBilinearForm(cartan, symmetrizer) {
  const form = [];
  for (let i = 0; i < 3; i += 1) {
    form[i] = [];
    for (let j = 0; j < 3; j += 1) {
      form[i][j] = symmetrizer[i] * cartan[i][j];
    }
  }
  return form;
}

function reducedQuadraticOnSlice(bilinear) {
  const basis1 = [1, 0, -1];
  const basis2 = [0, 1, -1];
  const z0 = [0, 0, 1];

  const matrix = [
    [quadraticPair(basis1, bilinear, basis1), quadraticPair(basis1, bilinear, basis2)],
    [quadraticPair(basis2, bilinear, basis1), quadraticPair(basis2, bilinear, basis2)],
  ];
  const linear = [
    2 * quadraticPair(basis1, bilinear, z0),
    2 * quadraticPair(basis2, bilinear, z0),
  ];
  const constant = quadraticPair(z0, bilinear, z0);

  const inverse = invert2(matrix);
  if (!inverse) {
    return null;
  }

  const center = {
    x: -0.5 * (inverse[0][0] * linear[0] + inverse[0][1] * linear[1]),
    y: -0.5 * (inverse[1][0] * linear[0] + inverse[1][1] * linear[1]),
  };
  const shiftedConstant =
    evaluateQuadratic2(matrix, center, center) +
    linear[0] * center.x +
    linear[1] * center.y +
    constant;

  return {
    basis1,
    basis2,
    z0,
    center,
    matrix,
    linear,
    constant,
    shiftedConstant,
  };
}

function matrix2SignNormalized(matrix, constant) {
  const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  const trace = matrix[0][0] + matrix[1][1];
  if (Math.abs(det) < 1e-10) {
    return null;
  }
  const positiveDefinite = det > 0 && trace > 0;
  const negativeDefinite = det > 0 && trace < 0;
  if (!positiveDefinite && !negativeDefinite) {
    return null;
  }

  const sign = positiveDefinite ? 1 : -1;
  const rhs = -sign * constant;
  if (rhs <= 1e-10) {
    return null;
  }

  return {
    normalized: [
      [sign * matrix[0][0], sign * matrix[0][1]],
      [sign * matrix[1][0], sign * matrix[1][1]],
    ],
    rhs,
  };
}

function quadraticPair(left, matrix, right) {
  let total = 0;
  for (let i = 0; i < left.length; i += 1) {
    for (let j = 0; j < right.length; j += 1) {
      total += left[i] * matrix[i][j] * right[j];
    }
  }
  return total;
}

function evaluateQuadratic2(matrix, left, right) {
  return (
    left.x * (matrix[0][0] * right.x + matrix[0][1] * right.y) +
    left.y * (matrix[1][0] * right.x + matrix[1][1] * right.y)
  );
}

function invert2(matrix) {
  const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  if (Math.abs(det) < 1e-10) {
    return null;
  }
  return [
    [matrix[1][1] / det, -matrix[0][1] / det],
    [-matrix[1][0] / det, matrix[0][0] / det],
  ];
}

function eigenDecomposition2(matrix) {
  const a = matrix[0][0];
  const b = matrix[0][1];
  const d = matrix[1][1];
  const trace = a + d;
  const delta = Math.sqrt((a - d) * (a - d) + 4 * b * b);
  const lambda1 = 0.5 * (trace - delta);
  const lambda2 = 0.5 * (trace + delta);
  return {
    values: [lambda1, lambda2],
    vectors: [
      normalizeVector2(Math.abs(b) > 1e-10 ? { x: b, y: lambda1 - a } : { x: 1, y: 0 }),
      normalizeVector2(Math.abs(b) > 1e-10 ? { x: b, y: lambda2 - a } : { x: 0, y: 1 }),
    ],
  };
}

function normalizeVector2(vector) {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 1e-10) {
    return { x: 1, y: 0 };
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function jacobiEigenvalues3(matrix) {
  const a = matrix.map((row) => row.slice());
  for (let iter = 0; iter < 24; iter += 1) {
    let p = 0;
    let q = 1;
    let max = Math.abs(a[0][1]);
    for (const [i, j] of [[0, 2], [1, 2]]) {
      if (Math.abs(a[i][j]) > max) {
        max = Math.abs(a[i][j]);
        p = i;
        q = j;
      }
    }
    if (max < 1e-10) {
      break;
    }
    const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
    const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;
    const app = a[p][p];
    const aqq = a[q][q];
    const apq = a[p][q];
    a[p][p] = app - t * apq;
    a[q][q] = aqq + t * apq;
    a[p][q] = 0;
    a[q][p] = 0;
    for (let r = 0; r < 3; r += 1) {
      if (r !== p && r !== q) {
        const arp = a[r][p];
        const arq = a[r][q];
        a[r][p] = c * arp - s * arq;
        a[p][r] = a[r][p];
        a[r][q] = s * arp + c * arq;
        a[q][r] = a[r][q];
      }
    }
  }
  return [a[0][0], a[1][1], a[2][2]];
}

function isIndefiniteSymmetric3(matrix) {
  const d1 = matrix[0][0];
  const d2 = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  const d3 =
    matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
    matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
    matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);

  const positiveDefinite = d1 > 1e-8 && d2 > 1e-8 && d3 > 1e-8;
  const negativeDefinite = d1 < -1e-8 && d2 > 1e-8 && d3 < -1e-8;
  if (positiveDefinite || negativeDefinite) {
    return false;
  }

  return Math.abs(d3) > 1e-8;
}

function multiplyFraction(left, right) {
  const num = left.num * right.num;
  const den = left.den * right.den;
  const g = gcd2(num, den);
  return { num: num / g, den: den / g };
}

function sameFraction(left, right) {
  return left.num * right.den === right.num * left.den;
}

function gcd2(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

function lcm2(a, b) {
  return Math.abs(a * b) / gcd2(a, b);
}

function farthestPair(points) {
  let bestPair = [points[0], points[1]];
  let bestDistance = -1;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distance = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      if (distance > bestDistance) {
        bestDistance = distance;
        bestPair = [points[i], points[j]];
      }
    }
  }
  return bestPair;
}

function edgeIndices(key) {
  const [iText, jText] = key.split("");
  return [Number(iText) - 1, Number(jText) - 1];
}

function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

function svgElement(tag, attributes) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

setupControls();
