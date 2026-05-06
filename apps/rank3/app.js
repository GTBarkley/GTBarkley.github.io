const EDGE_LABELS = [2, 3, 4, 6, "inf", "custom"];
const EDGE_KEYS = ["12", "23", "13"];

const PRESETS = {
  A3: [
    [2, -1, 0],
    [-1, 2, -1],
    [0, -1, 2],
  ],
  B3: [
    [2, -1, 0],
    [-1, 2, -2],
    [0, -1, 2],
  ],
  C3: [
    [2, -2, 0],
    [-1, 2, -1],
    [0, -1, 2],
  ],
  "A2 x A1": [
    [2, -1, 0],
    [-1, 2, 0],
    [0, 0, 2],
  ],
  "A1 x A1 x A1": [
    [2, 0, 0],
    [0, 2, 0],
    [0, 0, 2],
  ],
};

const nodes = {
  presetSelect: document.getElementById("preset-select"),
  applyPresetButton: document.getElementById("apply-preset-button"),
  cartanEditor: document.getElementById("cartan-editor"),
  cartanOutput: document.getElementById("cartan-output"),
  diagram: document.getElementById("diagram"),
  diagramOutput: document.getElementById("diagram-output"),
  statusOutput: document.getElementById("status-output"),
  maxHeightInput: document.getElementById("max-height-input"),
  plot: document.getElementById("plot"),
  tooltip: document.getElementById("tooltip"),
  rootCount: document.getElementById("root-count"),
  clearPairButton: document.getElementById("clear-pair-button"),
  resetViewButton: document.getElementById("reset-view-button"),
  rootTableBody: document.getElementById("root-table-body"),
  showMoreButton: document.getElementById("show-more-button"),
};

const matrixInputs = [];
const ROOTS_PAGE_SIZE = 25;
let visibleRootCount = ROOTS_PAGE_SIZE;
let currentRoots = [];
let plotLayer = null;
let rootCircles = [];
let currentLineElement = null;
let selectedRootIndices = [];
let highlightedLineRootIndices = new Set();
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

function edgeSelect(key) {
  return document.getElementById(`edge-${key}`);
}

function flipButton(key) {
  return document.getElementById(`flip-${key}`);
}

function setupControls() {
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

  applyPreset();
}

function setupPresetMenu() {
  for (const name of Object.keys(PRESETS)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
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
  setMatrix(cloneMatrix(preset));
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

function renderAll() {
  const cartan = readMatrix();
  const analysis = analyzeRootSystem(cartan, readMaxHeight());
  currentRoots = analysis.positiveRoots;
  visibleRootCount = ROOTS_PAGE_SIZE;
  selectedRootIndices = [];
  highlightedLineRootIndices = new Set();
  currentLineElement = null;
  drawMatrixOutput(cartan);
  nodes.statusOutput.textContent = analysis.status;
  nodes.rootCount.textContent = `${analysis.positiveRoots.length} positive roots`;
  nodes.diagramOutput.textContent = diagramSummary(cartan);
  drawDiagram(cartan);
  drawPlot(analysis.positiveRoots);
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
    vector[0] * cartan[0][index] +
    vector[1] * cartan[1][index] +
    vector[2] * cartan[2][index];
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
          : Math.abs(aij) > Math.abs(aji) ? `${j + 1} <- ${i + 1}` : `${i + 1} <- ${j + 1}`;
        return `${i + 1}-${j + 1}: label ∞, ${arrow}`;
      }
      if (label === 4 || label === 6) {
        const arrow = Math.abs(aij) > Math.abs(aji) ? `${j + 1} <- ${i + 1}` : `${i + 1} <- ${j + 1}`;
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
        const arrowToJ = Math.abs(aij) > Math.abs(aji);
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
  const p2 = { x: margin + side, y: margin + side * 0.8660254037844386 };
  const p3 = { x: margin + side / 2, y: margin };
  return {
    x: a * p1.x + b * p2.x + c * p3.x,
    y: a * p1.y + b * p2.y + c * p3.y,
  };
}

function drawPlot(roots) {
  const svg = nodes.plot;
  svg.innerHTML = "";
  rootCircles = [];
  currentLineElement = null;
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

  const vertexLabels = [
    { point: triangle[0], text: "α₁" },
    { point: triangle[1], text: "α₂" },
    { point: triangle[2], text: "α₃" },
  ];

  for (const label of vertexLabels) {
    const text = svgElement("text", {
      x: label.point.x,
      y: label.point.y + (label.text === "α₃" ? -16 : 24),
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
  updateRootCircleScreenSize();
  refreshLineSelectionVisuals();
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
    row.innerHTML = `
      <td>${index + 1}</td>
      <td><code>${root.label}</code></td>
      <td><code>(${root.vector.join(", ")})</code></td>
      <td><code>${root.witness}</code></td>
    `;
    nodes.rootTableBody.append(row);
  }
  nodes.showMoreButton.hidden = visibleRootCount >= currentRoots.length;
}

function showMoreRoots() {
  visibleRootCount = Math.min(visibleRootCount + ROOTS_PAGE_SIZE, currentRoots.length);
  drawTable();
}

function showTooltip(event, text, circle) {
  circle.classList.add("active");
  updateCircleRadius(circle);
  nodes.tooltip.textContent = text;
  nodes.tooltip.classList.remove("hidden");
  moveTooltip(event);
}

function showTooltipAtCircle(text, circle) {
  circle.classList.add("active");
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
  updateCircleRadius(circle);
  nodes.tooltip.classList.add("hidden");
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
}

function clearLineSelection() {
  selectedRootIndices = [];
  highlightedLineRootIndices = new Set();
  refreshLineSelectionVisuals();
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

  recomputeLineSelection();
  refreshLineSelectionVisuals();
}

function recomputeLineSelection() {
  highlightedLineRootIndices = new Set();
  if (selectedRootIndices.length !== 2) {
    return;
  }

  const [firstIndex, secondIndex] = selectedRootIndices;
  const first = currentRoots[firstIndex];
  const second = currentRoots[secondIndex];
  if (!first || !second) {
    return;
  }

  for (let i = 0; i < currentRoots.length; i += 1) {
    if (isRootOnLine(currentRoots[i], first, second)) {
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

function refreshLineSelectionVisuals() {
  if (currentLineElement) {
    currentLineElement.remove();
    currentLineElement = null;
  }

  for (let i = 0; i < rootCircles.length; i += 1) {
    const circle = rootCircles[i];
    circle.classList.toggle("selected", selectedRootIndices.includes(i));
    circle.classList.toggle("line-member", highlightedLineRootIndices.has(i) && !selectedRootIndices.includes(i));
    updateCircleRadius(circle);
  }

  if (selectedRootIndices.length === 2) {
    const [firstIndex, secondIndex] = selectedRootIndices;
    const first = currentRoots[firstIndex];
    const second = currentRoots[secondIndex];
    if (first && second && plotLayer) {
      const line = extendedLineThroughPoints(first.point, second.point, 720, 640);
      if (!line) {
        return;
      }
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
