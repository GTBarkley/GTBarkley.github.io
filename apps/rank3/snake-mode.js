(function registerSnakeMode() {
  let viardModeEnabled = false;
  let viardWindowValue = "10";
  let shardModeEnabled = false;
  let shardRootKey = null;
  let selectedShardAngle = null;
  let viewShardEnabled = false;
  let selectedShardVisible = false;
  let shardBackgroundLayer = null;
  let shardForegroundLayer = null;
  const VIARD_DEFAULT_WINDOW = 10;
  const VIARD_SAFETY_CAP = 2500;
  const TWO_PI = 2 * Math.PI;

  window.RootViewerExtensions = window.RootViewerExtensions || [];
  window.RootViewerExtensions.push({
    name: "snake-mode",
    afterSetup(app) {
      document.body.dataset.viewerMode = "snake";
      app.setTitleSuffix(" (Snake Mode)");
      addViardToggle(app);
      addIndex6Button(app);
      addShardControls(app);
      addViardWindowControl(app);
      syncIndex6Button(app);
    },
    afterRender(app) {
      syncIndex6Button(app);
      renderShardOverlay(app);
    },
    afterPlotTransform(app) {
      if (shardModeEnabled && shardRootKey) {
        renderShardOverlay(app);
      }
    },
    afterResetView(app) {
      clearShardSelection(app);
    },
    afterRootClick(app, { root }) {
      if (!shardModeEnabled) {
        return;
      }
      shardRootKey = app.vectorKey(root.vector);
      selectedShardAngle = null;
      syncShardActionButtons();
      renderShardOverlay(app);
    },
    afterSelectRank2Change(app, { enabled }) {
      if (enabled && shardModeEnabled) {
        setShardMode(app, false);
      }
    },
    transformAnalysis(app, { value, cartan }) {
      if (!viardModeEnabled) {
        return value;
      }
      return computeViardAnalysis(app, cartan);
    },
  });

  function addViardToggle(app) {
    const arrangementToggle = app.nodes.arrangementViewToggle;
    const modeRow = arrangementToggle?.closest(".plot-mode-row");
    if (!modeRow || document.getElementById("viard-view-toggle")) {
      return;
    }

    const label = document.createElement("label");
    label.className = "view-toggle";
    label.htmlFor = "viard-view-toggle";

    const input = document.createElement("input");
    input.id = "viard-view-toggle";
    input.type = "checkbox";
    input.checked = viardModeEnabled;
    input.addEventListener("change", () => {
      viardModeEnabled = input.checked;
      syncViardWindowVisibility();
      app.renderAll({ preserveSelection: true });
    });

    const text = document.createElement("span");
    text.textContent = "Viard Mode";

    label.append(input, text);
    modeRow.append(label);
    syncViardWindowVisibility();
  }

  function addShardControls(app) {
    const modeRow = app.nodes.selectRank2Toggle?.closest(".plot-mode-row");
    if (!modeRow || document.getElementById("shard-mode-toggle")) {
      return;
    }

    const label = document.createElement("label");
    label.className = "view-toggle";
    label.htmlFor = "shard-mode-toggle";

    const input = document.createElement("input");
    input.id = "shard-mode-toggle";
    input.type = "checkbox";
    input.checked = shardModeEnabled;
    input.addEventListener("change", () => setShardMode(app, input.checked));

    const text = document.createElement("span");
    text.textContent = "Shard Mode";
    label.append(input, text);
    modeRow.append(label);

    const actions = document.createElement("div");
    actions.id = "shard-actions-row";
    actions.className = "shard-actions-row";
    actions.hidden = true;

    const joinButton = document.createElement("button");
    joinButton.id = "shard-join-irreducible-button";
    joinButton.type = "button";
    joinButton.className = "secondary-button";
    joinButton.textContent = "Join-Irreducible";
    joinButton.disabled = true;
    joinButton.addEventListener("click", () => selectShardIrreducible(app, true));

    const meetButton = document.createElement("button");
    meetButton.id = "shard-meet-irreducible-button";
    meetButton.type = "button";
    meetButton.className = "secondary-button";
    meetButton.textContent = "Meet-Irreducible";
    meetButton.disabled = true;
    meetButton.addEventListener("click", () => selectShardIrreducible(app, false));

    const viewShardLabel = document.createElement("label");
    viewShardLabel.id = "view-shard-toggle-wrap";
    viewShardLabel.className = "view-toggle";
    viewShardLabel.htmlFor = "view-shard-toggle";
    viewShardLabel.hidden = true;

    const viewShardToggle = document.createElement("input");
    viewShardToggle.id = "view-shard-toggle";
    viewShardToggle.type = "checkbox";
    viewShardToggle.checked = viewShardEnabled;
    viewShardToggle.addEventListener("change", () => {
      viewShardEnabled = viewShardToggle.checked;
      renderShardOverlay(app);
    });

    const viewShardText = document.createElement("span");
    viewShardText.textContent = "View Shard";
    viewShardLabel.append(viewShardToggle, viewShardText);

    const status = document.createElement("span");
    status.id = "shard-mode-status";
    status.className = "helper-text shard-mode-status";
    status.setAttribute("aria-live", "polite");
    status.textContent = "Select a root to inspect its shards.";

    actions.append(joinButton, meetButton, viewShardLabel, status);

    const feedbackStack = document.createElement("div");
    feedbackStack.id = "snake-mode-feedback-stack";
    feedbackStack.className = "snake-mode-feedback-stack";
    const separatingStatus = app.nodes.separatingLineStatus;
    modeRow.insertAdjacentElement("afterend", feedbackStack);
    feedbackStack.append(actions);
    if (separatingStatus) {
      feedbackStack.append(separatingStatus);
    }
    syncShardControls();
  }

  function setShardMode(app, enabled) {
    shardModeEnabled = Boolean(enabled);
    const toggle = document.getElementById("shard-mode-toggle");
    if (toggle) {
      toggle.checked = shardModeEnabled;
    }
    if (shardModeEnabled) {
      app.setSelectRank2Enabled(false);
    } else {
      clearShardSelection(app);
    }
    syncShardControls();
    renderShardOverlay(app);
  }

  function syncShardControls() {
    const actions = document.getElementById("shard-actions-row");
    if (actions) {
      actions.hidden = !shardModeEnabled;
    }
    syncShardActionButtons();
  }

  function syncShardActionButtons() {
    const enabled = shardModeEnabled && shardRootKey !== null && selectedShardAngle !== null;
    const joinButton = document.getElementById("shard-join-irreducible-button");
    const meetButton = document.getElementById("shard-meet-irreducible-button");
    if (joinButton) {
      joinButton.disabled = !enabled;
    }
    if (meetButton) {
      meetButton.disabled = !enabled;
    }
    const viewShardWrap = document.getElementById("view-shard-toggle-wrap");
    if (viewShardWrap) {
      viewShardWrap.hidden = !enabled || !selectedShardVisible;
    }
    setShardStatus(
      !shardModeEnabled
        ? ""
        : !shardRootKey
          ? "Select a root to inspect its shards."
          : selectedShardAngle === null
            ? "Choose a sector in the annulus."
            : "Shard selected.",
    );
  }

  function setShardStatus(message) {
    const status = document.getElementById("shard-mode-status");
    if (status) {
      status.textContent = message;
    }
  }

  function addViardWindowControl(app) {
    const diagramSummary = app.nodes.diagramOutput?.closest(".summary-card");
    if (!diagramSummary || document.getElementById("viard-window-control")) {
      return;
    }

    const card = document.createElement("div");
    card.id = "viard-window-control";
    card.className = "summary-card";
    card.hidden = !viardModeEnabled;

    const heading = document.createElement("h2");
    heading.textContent = "Viard Level";

    const wrapper = document.createElement("div");
    wrapper.className = "height-control";

    const label = document.createElement("label");

    const input = document.createElement("input");
    input.id = "viard-window-input";
    input.type = "number";
    input.min = "1";
    input.step = "1";
    input.value = viardWindowValue || String(VIARD_DEFAULT_WINDOW);
    input.addEventListener("input", () => {
      viardWindowValue = input.value || String(VIARD_DEFAULT_WINDOW);
      if (viardModeEnabled) {
        app.renderAll({ preserveSelection: true });
      }
    });

    const help = document.createElement("p");
    help.className = "helper-text";
    help.textContent = "Shows only the first N roots in Viard order.";

    label.append(input);
    wrapper.append(label);
    card.append(heading, wrapper, help);
    diagramSummary.insertAdjacentElement("afterend", card);
  }

  function addIndex6Button(app) {
    const arrangementToggle = app.nodes.arrangementViewToggle;
    const modeRow = arrangementToggle?.closest(".plot-mode-row");
    if (!modeRow || document.getElementById("index-6-button")) {
      return;
    }

    const button = document.createElement("button");
    button.id = "index-6-button";
    button.type = "button";
    button.className = "secondary-button";
    button.textContent = "U3";
    button.addEventListener("click", () => selectIndex6Subsystem(app));
    modeRow.append(button);
  }

  function computeViardAnalysis(app, cartan) {
    const requestedCount = readViardWindow(app);
    viardWindowValue = String(requestedCount);
    const issues = app.validateCartan(cartan);
    const orderedEntries = computeViardEntries(app, cartan, requestedCount, VIARD_SAFETY_CAP);
    const positiveRoots = orderedEntries.entries.map((entry) => app.decorateRoot(entry));

    const parts = [];
    if (issues.length) {
      parts.push(`Matrix warning: ${issues.join(" ")}`);
    }
    parts.push(`Generated ${positiveRoots.length} positive roots in Viard order.`);
    parts.push(`Viard level window: first ${requestedCount} roots.`);
    if (orderedEntries.truncated) {
      parts.push("Viard exploration hit the safety cap before reaching the requested window.");
    } else if (positiveRoots.length < requestedCount) {
      parts.push("Viard exploration exhausted the positive roots before filling the requested window.");
    }

    return {
      status: parts.join(" "),
      positiveRoots,
    };
  }

  function readViardWindow(app) {
    const parsed = Number(document.getElementById("viard-window-input")?.value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : VIARD_DEFAULT_WINDOW;
  }

  function syncViardWindowVisibility() {
    const card = document.getElementById("viard-window-control");
    const standardHeightCard = document.getElementById("max-height-label")?.closest(".summary-card");
    if (card) {
      card.hidden = !viardModeEnabled;
    }
    if (standardHeightCard) {
      standardHeightCard.hidden = viardModeEnabled;
    }
    if (!card && !standardHeightCard) {
      return;
    }
  }

  function syncIndex6Button(app) {
    const button = document.getElementById("index-6-button");
    if (!button) {
      return;
    }
    const showingPreset = app.getPresetName() === "triangle_2_3_inf";
    button.hidden = !showingPreset;
  }

  function renderShardOverlay(app) {
    removeShardLayers();
    selectedShardVisible = false;
    if (!shardModeEnabled || !shardRootKey) {
      syncShardActionButtons();
      return;
    }

    const state = app.getState();
    const rootIndex = state.currentRoots.findIndex(
      (root) => app.vectorKey(root.vector) === shardRootKey,
    );
    const root = state.currentRoots[rootIndex];
    const context = app.getPlotContext();
    if (!root || !context.plotLayer) {
      shardRootKey = null;
      selectedShardAngle = null;
      syncShardActionButtons();
      return;
    }

    shardBackgroundLayer = app.createSvgElement("g", { class: "shard-background-layer" });
    shardForegroundLayer = app.createSvgElement("g", { class: "shard-foreground-layer" });
    const separatingBackground = context.plotLayer.querySelector(".separating-background-layer");
    context.plotLayer.insertBefore(shardBackgroundLayer, separatingBackground || context.plotLayer.firstChild);
    context.plotLayer.append(shardForegroundLayer);

    const cutAngles = computeShardCutAngles(root, state.currentRoots);
    const sectors = shardSectors(cutAngles);
    const radii = shardAnnulusRadii(rootIndex, root, state.currentRoots, context);
    drawShardAnnulus(app, root, sectors, cutAngles, radii);

    if (selectedShardAngle !== null) {
      const sector = sectorContainingAngle(sectors, selectedShardAngle);
      drawShardHalfspace(app, root, selectedShardAngle);
      const signedSegments = visibleShardSegments(app, rootIndex, root, sector, context);
      selectedShardVisible = signedSegments.shard.length > 0 || signedSegments.negative.length > 0;
      if (viewShardEnabled && selectedShardVisible) {
        drawVisibleShardHighlights(app, signedSegments);
      }
    }
    syncShardActionButtons();
  }

  function removeShardLayers() {
    shardBackgroundLayer?.remove();
    shardForegroundLayer?.remove();
    shardBackgroundLayer = null;
    shardForegroundLayer = null;
  }

  function clearShardSelection(app) {
    shardRootKey = null;
    selectedShardAngle = null;
    selectedShardVisible = false;
    removeShardLayers();
    syncShardActionButtons();
  }

  function computeShardCutAngles(root, roots) {
    const groups = new Map();
    for (const candidate of roots) {
      if (candidate === root) {
        continue;
      }
      const normal = primitiveNormal(crossProduct(root.vector, candidate.vector));
      if (!normal) {
        continue;
      }
      const key = normal.join(",");
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(candidate);
    }

    const angles = [];
    for (const candidates of groups.values()) {
      const reference = candidates
        .map((candidate) => ({
          x: candidate.point.x - root.point.x,
          y: candidate.point.y - root.point.y,
        }))
        .find((direction) => Math.hypot(direction.x, direction.y) > 1e-9);
      if (!reference) {
        continue;
      }
      const length = Math.hypot(reference.x, reference.y);
      const direction = { x: reference.x / length, y: reference.y / length };
      const projections = candidates.map((candidate) => (
        (candidate.point.x - root.point.x) * direction.x
        + (candidate.point.y - root.point.y) * direction.y
      ));
      const tolerance = Math.max(1, ...projections.map(Math.abs)) * 1e-8;
      if (Math.min(...projections) >= -tolerance || Math.max(...projections) <= tolerance) {
        continue;
      }
      const angle = normalizeAngle(Math.atan2(direction.y, direction.x));
      angles.push(angle, normalizeAngle(angle + Math.PI));
    }

    angles.sort((left, right) => left - right);
    return angles.filter(
      (angle, index) => index === 0 || angularDistance(angle, angles[index - 1]) > 1e-7,
    );
  }

  function primitiveNormal(vector) {
    if (vector.every((value) => value === 0)) {
      return null;
    }
    const divisor = vector.reduce((gcd, value) => greatestCommonDivisor(gcd, value), 0) || 1;
    const primitive = vector.map((value) => value / divisor);
    const firstNonzero = primitive.find((value) => value !== 0);
    return firstNonzero < 0 ? primitive.map((value) => -value) : primitive;
  }

  function crossProduct(left, right) {
    return [
      left[1] * right[2] - left[2] * right[1],
      left[2] * right[0] - left[0] * right[2],
      left[0] * right[1] - left[1] * right[0],
    ];
  }

  function greatestCommonDivisor(left, right) {
    let a = Math.abs(left);
    let b = Math.abs(right);
    while (b !== 0) {
      const remainder = a % b;
      a = b;
      b = remainder;
    }
    return a;
  }

  function shardSectors(cutAngles) {
    if (!cutAngles.length) {
      return [{ start: 0, end: TWO_PI, full: true }];
    }
    return cutAngles.map((start, index) => ({
      start,
      end: index + 1 < cutAngles.length ? cutAngles[index + 1] : cutAngles[0] + TWO_PI,
      full: false,
    }));
  }

  function shardAnnulusRadii(rootIndex, root, roots, context) {
    const nearestDistance = roots.reduce((nearest, candidate, index) => {
      if (index === rootIndex) {
        return nearest;
      }
      return Math.min(nearest, Math.hypot(candidate.point.x - root.point.x, candidate.point.y - root.point.y));
    }, Number.POSITIVE_INFINITY);
    const nearestScreenDistance = nearestDistance * context.plotScale;
    const outerScreenRadius = Number.isFinite(nearestScreenDistance)
      ? Math.min(64, nearestScreenDistance * 0.5)
      : 64;
    const safeOuterScreenRadius = Math.max(0.001, outerScreenRadius);
    return {
      inner: Math.max(safeOuterScreenRadius * 0.3, safeOuterScreenRadius - 16) / context.plotScale,
      outer: safeOuterScreenRadius / context.plotScale,
    };
  }

  function drawShardAnnulus(app, root, sectors, cutAngles, radii) {
    for (const sector of sectors) {
      const element = app.createSvgElement("path", {
        d: sector.full
          ? fullAnnulusPath(root.point, radii.inner, radii.outer)
          : annularSectorPath(root.point, radii.inner, radii.outer, sector.start, sector.end),
        class: "shard-sector",
      });
      if (selectedShardAngle !== null && angleInSector(selectedShardAngle, sector)) {
        element.classList.add("selected");
      }
      element.setAttribute("role", "button");
      element.setAttribute("tabindex", "0");
      element.setAttribute("aria-label", "Select this shard sector");
      element.addEventListener("pointerdown", (event) => event.stopPropagation());
      element.addEventListener("click", (event) => selectShardSectorFromEvent(app, event, root, cutAngles));
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectShardSector(app, root, midpointAngle(sector));
        }
      });
      shardForegroundLayer.append(element);
    }

    for (const angle of cutAngles) {
      const direction = directionForAngle(angle);
      shardForegroundLayer.append(
        app.createSvgElement("line", {
          x1: root.point.x + direction.x * radii.inner,
          y1: root.point.y + direction.y * radii.inner,
          x2: root.point.x + direction.x * radii.outer,
          y2: root.point.y + direction.y * radii.outer,
          class: "shard-sector-divider",
        }),
      );
    }
  }

  function annularSectorPath(center, innerRadius, outerRadius, start, end) {
    const startOuter = pointAtAngle(center, outerRadius, start);
    const endOuter = pointAtAngle(center, outerRadius, end);
    const endInner = pointAtAngle(center, innerRadius, end);
    const startInner = pointAtAngle(center, innerRadius, start);
    const largeArc = end - start > Math.PI ? 1 : 0;
    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
      "Z",
    ].join(" ");
  }

  function fullAnnulusPath(center, innerRadius, outerRadius) {
    return [
      `M ${center.x + outerRadius} ${center.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${center.x - outerRadius} ${center.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${center.x + outerRadius} ${center.y}`,
      `L ${center.x + innerRadius} ${center.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${center.x - innerRadius} ${center.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${center.x + innerRadius} ${center.y}`,
      "Z",
    ].join(" ");
  }

  function selectShardSectorFromEvent(app, event, root, cutAngles) {
    event.preventDefault();
    event.stopPropagation();
    const point = app.plotPointFromClient(event.clientX, event.clientY);
    const angle = normalizeAngle(Math.atan2(point.y - root.point.y, point.x - root.point.x));
    if (cutAngles.some((boundary) => angularDistance(angle, boundary) < 0.018)) {
      setShardStatus("Choose a point away from a sector boundary.");
      return;
    }
    selectShardSector(app, root, angle);
  }

  function selectShardSector(app, root, angle) {
    selectedShardAngle = normalizeAngle(angle);
    syncShardActionButtons();
    if (app.getState().separatingLineEnabled) {
      moveSeparatingLineToShardHalfspace(app, root, selectedShardAngle);
    }
    renderShardOverlay(app);
  }

  function moveSeparatingLineToShardHalfspace(app, root, angle) {
    const direction = directionForAngle(angle);
    const extended = app.extendedLineThroughPoints(
      {
        x: root.point.x - direction.x * 2000,
        y: root.point.y - direction.y * 2000,
      },
      {
        x: root.point.x + direction.x * 2000,
        y: root.point.y + direction.y * 2000,
      },
      720,
      640,
    );
    let extendedStart = extended ? { x: extended.x1, y: extended.y1 } : null;
    let extendedEnd = extended ? { x: extended.x2, y: extended.y2 } : null;
    if (
      extendedStart
      && extendedEnd
      && (extendedEnd.x - extendedStart.x) * direction.x
        + (extendedEnd.y - extendedStart.y) * direction.y < 0
    ) {
      [extendedStart, extendedEnd] = [extendedEnd, extendedStart];
    }
    const first = extended
      ? interpolateCanvasPoint(extendedStart, extendedEnd, 0.2)
      : { x: root.point.x - direction.x * 120, y: root.point.y - direction.y * 120 };
    const second = extended
      ? interpolateCanvasPoint(extendedStart, extendedEnd, 0.8)
      : { x: root.point.x + direction.x * 120, y: root.point.y + direction.y * 120 };
    app.setSeparatingHalfspace(
      first,
      second,
      -1,
    );
  }

  function interpolateCanvasPoint(first, second, ratio) {
    return {
      x: first.x + (second.x - first.x) * ratio,
      y: first.y + (second.y - first.y) * ratio,
    };
  }

  function drawShardHalfspace(app, root, angle) {
    const direction = directionForAngle(angle);
    const second = {
      x: root.point.x + direction.x,
      y: root.point.y + direction.y,
    };
    const polygon = app.clipPolygonToHalfPlane(
      app.canvasRectangle(),
      (point) => -app.lineSignedValue(root.point, second, point),
    );
    if (polygon.length < 3) {
      return;
    }
    shardBackgroundLayer.append(
      app.createSvgElement("polygon", {
        points: polygon.map((point) => `${point.x},${point.y}`).join(" "),
        class: "shard-halfspace-shade",
      }),
    );
  }

  function visibleShardSegments(app, rootIndex, root, sector, context) {
    const displayedLine = context.dualLineElements[rootIndex];
    if (!displayedLine || !sector) {
      return { shard: [], negative: [] };
    }
    const visibleSegment = displayedLineSegment(displayedLine);
    if (sector.full) {
      return { shard: [visibleSegment], negative: [] };
    }
    const midpointVector = orientedDualVectorForDirection(app, root, midpointAngle(sector));
    let firstBoundary = orientedDualVectorForDirection(app, root, sector.start);
    let secondBoundary = orientedDualVectorForDirection(app, root, sector.end);
    if (!midpointVector || !firstBoundary || !secondBoundary) {
      return { shard: [], negative: [] };
    }
    if (!planeCoordinates(midpointVector, firstBoundary, secondBoundary)) {
      return classifySignedHalfPlaneSegments(visibleSegment, firstBoundary, midpointVector);
    }
    const orientedBoundaries = orientBoundaryVectors(firstBoundary, secondBoundary, midpointVector);
    firstBoundary = orientedBoundaries.first;
    secondBoundary = orientedBoundaries.second;
    return classifySignedShardSegments(visibleSegment, firstBoundary, secondBoundary);
  }

  function drawVisibleShardHighlights(app, signedSegments) {
    for (const [kind, segments] of Object.entries(signedSegments)) {
      for (const segment of segments) {
        for (const className of ["shard-highlight-underlay", `shard-highlight shard-highlight-${kind}`]) {
          const line = app.createSvgElement("line", {
            x1: segment.start.x,
            y1: segment.start.y,
            x2: segment.end.x,
            y2: segment.end.y,
            class: className,
            "aria-label": kind === "shard" ? "Selected shard" : "Negative of selected shard",
          });
          if (className.startsWith("shard-highlight ")) {
            const title = app.createSvgElement("title", {});
            title.textContent = kind === "shard" ? "Selected shard" : "Negative of selected shard";
            line.append(title);
          }
          shardForegroundLayer.append(line);
        }
      }
    }
  }

  function orientedDualVectorForDirection(app, root, angle) {
    const direction = directionForAngle(angle);
    return app.orientedDualVectorForLine({
      first: {
        x: root.point.x - direction.x * 120,
        y: root.point.y - direction.y * 120,
      },
      second: {
        x: root.point.x + direction.x * 120,
        y: root.point.y + direction.y * 120,
      },
      halfspaceSign: -1,
    });
  }

  function orientBoundaryVectors(first, second, interior) {
    let best = { first, second, score: Number.NEGATIVE_INFINITY };
    for (const firstSign of [1, -1]) {
      for (const secondSign of [1, -1]) {
        const candidateFirst = first.map((value) => firstSign * value);
        const candidateSecond = second.map((value) => secondSign * value);
        const coefficients = planeCoordinates(interior, candidateFirst, candidateSecond);
        if (!coefficients) {
          continue;
        }
        const score = Math.min(coefficients.first, coefficients.second);
        if (score > best.score) {
          best = { first: candidateFirst, second: candidateSecond, score };
        }
      }
    }
    return best;
  }

  function classifySignedShardSegments(visibleSegment, firstBoundary, secondBoundary) {
    const firstPoint = planeCoordinates(
      canvasPointToBarycentric(visibleSegment.start),
      firstBoundary,
      secondBoundary,
    );
    const secondPoint = planeCoordinates(
      canvasPointToBarycentric(visibleSegment.end),
      firstBoundary,
      secondBoundary,
    );
    if (!firstPoint || !secondPoint) {
      return { shard: [], negative: [] };
    }

    const breakpoints = [0, 1];
    for (const key of ["first", "second"]) {
      const start = firstPoint[key];
      const delta = secondPoint[key] - start;
      if (Math.abs(delta) <= 1e-12) {
        continue;
      }
      const crossing = -start / delta;
      if (crossing > 1e-9 && crossing < 1 - 1e-9) {
        breakpoints.push(crossing);
      }
    }
    breakpoints.sort((left, right) => left - right);

    const result = { shard: [], negative: [] };
    for (let index = 0; index + 1 < breakpoints.length; index += 1) {
      const start = breakpoints[index];
      const end = breakpoints[index + 1];
      const middle = (start + end) / 2;
      const firstCoefficient = firstPoint.first + middle * (secondPoint.first - firstPoint.first);
      const secondCoefficient = firstPoint.second + middle * (secondPoint.second - firstPoint.second);
      const kind = firstCoefficient >= -1e-8 && secondCoefficient >= -1e-8
        ? "shard"
        : firstCoefficient <= 1e-8 && secondCoefficient <= 1e-8
          ? "negative"
          : null;
      if (!kind) {
        continue;
      }
      result[kind].push({
        start: interpolateCanvasPoint(visibleSegment.start, visibleSegment.end, start),
        end: interpolateCanvasPoint(visibleSegment.start, visibleSegment.end, end),
      });
    }
    return result;
  }

  function classifySignedHalfPlaneSegments(visibleSegment, boundary, interior) {
    const firstPoint = planeCoordinates(
      canvasPointToBarycentric(visibleSegment.start),
      boundary,
      interior,
    );
    const secondPoint = planeCoordinates(
      canvasPointToBarycentric(visibleSegment.end),
      boundary,
      interior,
    );
    if (!firstPoint || !secondPoint) {
      return { shard: [], negative: [] };
    }

    const breakpoints = [0, 1];
    const delta = secondPoint.second - firstPoint.second;
    if (Math.abs(delta) > 1e-12) {
      const crossing = -firstPoint.second / delta;
      if (crossing > 1e-9 && crossing < 1 - 1e-9) {
        breakpoints.push(crossing);
      }
    }
    breakpoints.sort((left, right) => left - right);

    const result = { shard: [], negative: [] };
    for (let index = 0; index + 1 < breakpoints.length; index += 1) {
      const start = breakpoints[index];
      const end = breakpoints[index + 1];
      const middle = (start + end) / 2;
      const interiorCoefficient = firstPoint.second + middle * delta;
      const kind = interiorCoefficient >= -1e-8 ? "shard" : "negative";
      result[kind].push({
        start: interpolateCanvasPoint(visibleSegment.start, visibleSegment.end, start),
        end: interpolateCanvasPoint(visibleSegment.start, visibleSegment.end, end),
      });
    }
    return result;
  }

  function planeCoordinates(vector, firstBasis, secondBasis) {
    let bestPair = null;
    for (const [firstIndex, secondIndex] of [[0, 1], [0, 2], [1, 2]]) {
      const determinant = firstBasis[firstIndex] * secondBasis[secondIndex]
        - firstBasis[secondIndex] * secondBasis[firstIndex];
      if (!bestPair || Math.abs(determinant) > Math.abs(bestPair.determinant)) {
        bestPair = { firstIndex, secondIndex, determinant };
      }
    }
    if (!bestPair || Math.abs(bestPair.determinant) <= 1e-12) {
      return null;
    }
    const { firstIndex, secondIndex, determinant } = bestPair;
    return {
      first: (
        vector[firstIndex] * secondBasis[secondIndex]
        - vector[secondIndex] * secondBasis[firstIndex]
      ) / determinant,
      second: (
        firstBasis[firstIndex] * vector[secondIndex]
        - firstBasis[secondIndex] * vector[firstIndex]
      ) / determinant,
    };
  }

  function canvasPointToBarycentric(point) {
    const margin = 90;
    const side = Math.min(720 - 2 * margin, (640 - 2 * margin) / 0.8660254037844386);
    const first = { x: margin, y: margin + side * 0.8660254037844386 };
    const second = { x: margin + side / 2, y: margin };
    const third = { x: margin + side, y: margin + side * 0.8660254037844386 };
    const beta = (first.y - point.y) / (first.y - second.y);
    const gamma = (
      point.x - first.x - beta * (second.x - first.x)
    ) / (third.x - first.x);
    return [1 - beta - gamma, beta, gamma];
  }

  function displayedLineSegment(line) {
    return {
      start: { x: Number(line.getAttribute("x1")), y: Number(line.getAttribute("y1")) },
      end: { x: Number(line.getAttribute("x2")), y: Number(line.getAttribute("y2")) },
    };
  }

  function selectShardIrreducible(app, includeRoot) {
    if (!shardRootKey || selectedShardAngle === null) {
      return;
    }
    const roots = app.getState().currentRoots;
    const root = roots.find((candidate) => app.vectorKey(candidate.vector) === shardRootKey);
    if (!root) {
      return;
    }
    const cutAngles = computeShardCutAngles(root, roots);
    const sector = sectorContainingAngle(shardSectors(cutAngles), selectedShardAngle);
    const candidates = incidentSeparatingSets(app, root, roots, sector, includeRoot);
    const keys = Array.from(
      includeRoot ? inclusionMinimalSet(candidates) : inclusionMaximalSet(candidates),
    );
    app.setSelectRank2Enabled(false);
    app.selectRootsByKeys(keys, { reveal: true });
    setShardStatus(
      `Selected the ${includeRoot ? "join" : "meet"}-irreducible set (${keys.length} root${keys.length === 1 ? "" : "s"}).`,
    );
    renderShardOverlay(app);
  }

  function incidentSeparatingSets(app, root, roots, sector, includeRoot) {
    const eventAngles = [sector.start, sector.end];
    for (const candidate of roots) {
      if (candidate === root) {
        continue;
      }
      const dx = candidate.point.x - root.point.x;
      const dy = candidate.point.y - root.point.y;
      if (Math.hypot(dx, dy) <= 1e-9) {
        continue;
      }
      for (const angle of [Math.atan2(dy, dx), Math.atan2(dy, dx) + Math.PI]) {
        const unwrapped = unwrapAngleIntoSector(angle, sector);
        if (unwrapped !== null) {
          eventAngles.push(unwrapped);
        }
      }
    }
    eventAngles.sort((left, right) => left - right);
    const uniqueAngles = eventAngles.filter(
      (angle, index) => index === 0 || Math.abs(angle - eventAngles[index - 1]) > 1e-8,
    );
    const candidates = [];
    const signatures = new Set();
    for (let index = 0; index + 1 < uniqueAngles.length; index += 1) {
      if (uniqueAngles[index + 1] - uniqueAngles[index] <= 1e-8) {
        continue;
      }
      const angle = (uniqueAngles[index] + uniqueAngles[index + 1]) / 2;
      const direction = directionForAngle(angle);
      const second = { x: root.point.x + direction.x, y: root.point.y + direction.y };
      const keys = new Set(
        roots
          .filter((candidate) => app.lineSignedValue(root.point, second, candidate.point) < -1e-7)
          .map((candidate) => app.vectorKey(candidate.vector)),
      );
      if (includeRoot) {
        keys.add(shardRootKey);
      } else {
        keys.delete(shardRootKey);
      }
      const signature = Array.from(keys).sort().join("|");
      if (!signatures.has(signature)) {
        signatures.add(signature);
        candidates.push(keys);
      }
    }
    return candidates.length ? candidates : [new Set(includeRoot ? [shardRootKey] : [])];
  }

  function unwrapAngleIntoSector(angle, sector) {
    let unwrapped = normalizeAngle(angle);
    while (unwrapped <= sector.start + 1e-8) {
      unwrapped += TWO_PI;
    }
    return unwrapped < sector.end - 1e-8 ? unwrapped : null;
  }

  function inclusionMinimalSet(candidates) {
    return candidates
      .slice()
      .sort((left, right) => left.size - right.size)
      .find((candidate) => !candidates.some(
        (other) => other !== candidate && other.size < candidate.size && isSubset(other, candidate),
      )) || candidates[0];
  }

  function inclusionMaximalSet(candidates) {
    return candidates
      .slice()
      .sort((left, right) => right.size - left.size)
      .find((candidate) => !candidates.some(
        (other) => other !== candidate && other.size > candidate.size && isSubset(candidate, other),
      )) || candidates[0];
  }

  function isSubset(left, right) {
    return Array.from(left).every((value) => right.has(value));
  }

  function sectorContainingAngle(sectors, angle) {
    return sectors.find((sector) => angleInSector(angle, sector)) || sectors[0] || null;
  }

  function angleInSector(angle, sector) {
    if (sector.full) {
      return true;
    }
    let normalized = normalizeAngle(angle);
    if (normalized < sector.start) {
      normalized += TWO_PI;
    }
    return normalized > sector.start + 1e-8 && normalized < sector.end - 1e-8;
  }

  function midpointAngle(sector) {
    return normalizeAngle((sector.start + sector.end) / 2);
  }

  function normalizeAngle(angle) {
    let normalized = angle % TWO_PI;
    if (normalized < 0) {
      normalized += TWO_PI;
    }
    return normalized;
  }

  function angularDistance(left, right) {
    const difference = Math.abs(normalizeAngle(left) - normalizeAngle(right));
    return Math.min(difference, TWO_PI - difference);
  }

  function directionForAngle(angle) {
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  function pointAtAngle(center, radius, angle) {
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    };
  }

  function computeViardEntries(app, cartan, requestedCount, safetyCap) {
    if (requestedCount <= 0) {
      return { entries: [], truncated: false };
    }

    const orderedEntries = [];
    const seen = new Set();
    let frontier = [
      { vector: [1, 0, 0], source: 0, word: [] },
      { vector: [0, 1, 0], source: 1, word: [] },
      { vector: [0, 0, 1], source: 2, word: [] },
    ];

    for (const entry of frontier) {
      addRoot(entry);
      if (orderedEntries.length >= requestedCount) {
        return { entries: orderedEntries, truncated: false };
      }
    }

    while (frontier.length > 0) {
      const nextFrontier = [];
      for (let reflection = 0; reflection < 3; reflection += 1) {
        for (const entry of frontier) {
          const image = app.reflect(entry.vector, reflection, cartan);
          if (!app.isPositive(image)) {
            continue;
          }
          const nextEntry = {
            vector: image,
            source: entry.source,
            word: [reflection, ...entry.word],
          };
          if (addRoot(nextEntry)) {
            nextFrontier.push(nextEntry);
            if (orderedEntries.length >= requestedCount) {
              return { entries: orderedEntries, truncated: false };
            }
            if (seen.size >= safetyCap) {
              return { entries: orderedEntries, truncated: true };
            }
          }
        }
      }
      frontier = nextFrontier;
    }

    return { entries: orderedEntries, truncated: false };

    function addRoot(entry) {
      const key = app.vectorKey(entry.vector);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      orderedEntries.push(entry);
      return true;
    }
  }

  function selectIndex6Subsystem(app) {
    const cartan = app.readMatrix();
    const currentRoots = app.getState().currentRoots;
    const availableKeys = new Set(currentRoots.map((root) => app.vectorKey(root.vector)));
    const subgroupRoots = computeIndex6SubsystemRootKeys(app, cartan, availableKeys);
    app.setSelectRank2Enabled(false);
    app.selectRootsByKeys(subgroupRoots, { reveal: true });
  }

  function computeIndex6SubsystemRootKeys(app, cartan, availableKeys) {
    const generators = [
      [2],
      [1, 2, 1],
      [0, 1, 2, 1, 0],
    ];
    const seedVectors = [
      [0, 0, 1],
      applyWord(app, [1], [0, 0, 1], cartan),
      applyWord(app, [1, 0], [0, 0, 1], cartan),
    ];
    const selectedPositiveKeys = new Set();
    const queue = [];

    for (const seedVector of seedVectors) {
      enqueuePositive(seedVector);
    }

    for (let head = 0; head < queue.length; head += 1) {
      const vector = queue[head];
      for (const word of generators) {
        enqueuePositive(applyWord(app, word, vector, cartan));
      }
    }

    return Array.from(selectedPositiveKeys);

    function enqueuePositive(vector) {
      const positiveVector = positiveRepresentative(app, vector);
      if (!positiveVector) {
        return;
      }
      const positiveKey = app.vectorKey(positiveVector);
      if (selectedPositiveKeys.has(positiveKey) || !availableKeys.has(positiveKey)) {
        return;
      }
      selectedPositiveKeys.add(positiveKey);
      queue.push(positiveVector);
    }
  }

  function applyWord(app, word, vector, cartan) {
    let next = vector.slice();
    for (const reflection of word) {
      next = app.reflect(next, reflection, cartan);
    }
    return next;
  }

  function positiveRepresentative(app, vector) {
    if (app.isPositive(vector)) {
      return vector;
    }
    const negated = vector.map((value) => -value);
    if (app.isPositive(negated)) {
      return negated;
    }
    return null;
  }
}());
