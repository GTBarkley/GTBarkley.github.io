(function registerCambrianMode() {
  const TWO_PI = 2 * Math.PI;
  const CAMBRIAN_DEFAULT_HEIGHT = 50;
  const COXETER_ELEMENTS = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];

  let coxeterOrder = COXETER_ELEMENTS[0].slice();
  let showAnnihilators = false;
  let showAlignedShards = false;
  let currentCambrianData = null;
  let annihilatorLayer = null;
  let alignedShardLayer = null;
  let selectedAlignedShardKey = null;

  window.RootViewerExtensions = window.RootViewerExtensions || [];
  window.RootViewerExtensions.push({
    name: "cambrian-mode",
    afterSetup(app) {
      document.body.dataset.viewerMode = "cambrian";
      app.setTitleSuffix(" (Cambrian Mode)");
      app.nodes.maxHeightInput.value = String(CAMBRIAN_DEFAULT_HEIGHT);
      addCambrianControls(app);
      app.renderAll({ preserveSelection: true });
    },
    afterRender(app, { cartan }) {
      currentCambrianData = cambrianData(cartan, coxeterOrder);
      syncCambrianControls(currentCambrianData);
      renderCambrianOverlays(app, currentCambrianData);
    },
    afterPlotTransform(app) {
      renderCambrianOverlays(app, currentCambrianData);
    },
  });

  function addCambrianControls(app) {
    addOrientationCard(app);
    addOverlayToggles(app);
    syncCambrianControls(currentCambrianData || cambrianData(app.readMatrix(), coxeterOrder));
  }

  function addOrientationCard(app) {
    const diagramCard = app.nodes.diagramOutput?.closest(".summary-card");
    if (!diagramCard || document.getElementById("cambrian-orientation-control")) {
      return;
    }

    const card = document.createElement("div");
    card.id = "cambrian-orientation-control";
    card.className = "summary-card cambrian-orientation-card";

    const heading = document.createElement("h2");
    heading.textContent = "Cambrian Orientation";

    const row = document.createElement("div");
    row.className = "preset-row";
    const label = document.createElement("label");
    const labelText = document.createElement("span");
    labelText.textContent = "Coxeter element";
    const select = document.createElement("select");
    select.id = "cambrian-coxeter-element";

    for (const order of COXETER_ELEMENTS) {
      const option = document.createElement("option");
      option.value = order.join(",");
      option.textContent = coxeterElementLabel(order);
      select.append(option);
    }
    for (const orientation of ["clockwise", "counterclockwise"]) {
      const option = document.createElement("option");
      option.value = orientation;
      option.textContent = `c = ${orientation}`;
      select.append(option);
    }
    select.value = orientationChoiceValue(coxeterOrder);
    select.addEventListener("change", () => {
      const nextOrientation = orientationFromValue(select.value);
      if (!nextOrientation) {
        return;
      }
      coxeterOrder = nextOrientation;
      clearAlignedShardSelection();
      app.renderAll({ preserveSelection: true });
    });

    label.append(labelText, select);
    row.append(label);

    const orientation = document.createElement("p");
    orientation.id = "cambrian-diagram-orientation";
    orientation.className = "helper-text";

    const status = document.createElement("p");
    status.id = "cambrian-signing-status";
    status.className = "helper-text cambrian-signing-status";
    status.setAttribute("aria-live", "polite");

    card.append(heading, row, orientation, status);
    diagramCard.insertAdjacentElement("afterend", card);
  }

  function addOverlayToggles(app) {
    const modeRow = app.nodes.selectRank2Toggle?.closest(".plot-mode-row");
    if (!modeRow || document.getElementById("cambrian-annihilators-toggle")) {
      return;
    }

    const annihilators = createToggle(
      "cambrian-annihilators-toggle",
      "Show annihilators",
      showAnnihilators,
      (input) => {
        showAnnihilators = input.checked;
        renderCambrianOverlays(app, currentCambrianData);
      },
    );
    const shards = createToggle(
      "cambrian-aligned-shards-toggle",
      "Show aligned shards",
      showAlignedShards,
      (input) => {
        showAlignedShards = input.checked;
        if (!showAlignedShards) {
          clearAlignedShardSelection();
        }
        renderCambrianOverlays(app, currentCambrianData);
      },
    );
    modeRow.append(annihilators, shards);

    const actions = document.createElement("div");
    actions.id = "cambrian-shard-actions-row";
    actions.className = "cambrian-shard-actions-row";
    actions.hidden = true;

    const joinButton = document.createElement("button");
    joinButton.id = "cambrian-shard-join-irreducible-button";
    joinButton.type = "button";
    joinButton.className = "secondary-button";
    joinButton.textContent = "Join-Irreducible";
    joinButton.disabled = true;
    joinButton.addEventListener("click", () => selectCambrianIrreducible(app, true));

    const meetButton = document.createElement("button");
    meetButton.id = "cambrian-shard-meet-irreducible-button";
    meetButton.type = "button";
    meetButton.className = "secondary-button";
    meetButton.textContent = "Meet-Irreducible";
    meetButton.disabled = true;
    meetButton.addEventListener("click", () => selectCambrianIrreducible(app, false));

    const status = document.createElement("span");
    status.id = "cambrian-shard-status";
    status.className = "helper-text cambrian-shard-status";
    status.setAttribute("aria-live", "polite");

    actions.append(joinButton, meetButton, status);
    modeRow.insertAdjacentElement("afterend", actions);
  }

  function createToggle(id, text, checked, onChange) {
    const label = document.createElement("label");
    label.className = "view-toggle cambrian-view-toggle";
    label.htmlFor = id;

    const input = document.createElement("input");
    input.id = id;
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange(input));

    const labelText = document.createElement("span");
    labelText.textContent = text;
    label.append(input, labelText);
    return label;
  }

  function syncCambrianControls(data) {
    const select = document.getElementById("cambrian-coxeter-element");
    if (select) {
      select.value = orientationChoiceValue(coxeterOrder);
    }

    const orientation = document.getElementById("cambrian-diagram-orientation");
    if (orientation) {
      orientation.textContent = data.orientationText;
    }

    const status = document.getElementById("cambrian-signing-status");
    if (status) {
      status.textContent = data.symmetrizer
        ? `The signed off-diagonal Cartan matrix is skew-symmetrizable (D = diag(${data.symmetrizer.join(", ")})). Coral marks ω_c positive and teal marks ω_c negative.`
        : "The signed off-diagonal Cartan matrix is not skew-symmetrizable for this Cartan data, so ω_c and the Cambrian overlays are unavailable.";
    }

    const overlaysAvailable = Boolean(data.symmetrizer);
    for (const id of ["cambrian-annihilators-toggle", "cambrian-aligned-shards-toggle"]) {
      const input = document.getElementById(id);
      if (!input) {
        continue;
      }
      input.disabled = !overlaysAvailable;
      if (!overlaysAvailable) {
        input.checked = false;
      }
    }
    if (!overlaysAvailable) {
      showAnnihilators = false;
      showAlignedShards = false;
      clearAlignedShardSelection();
    }
  }

  function cambrianData(cartan, orientation) {
    const signedCartan = signedOffDiagonalCartan(cartan, orientation);
    const symmetrizer = skewSymmetrizerFor(signedCartan);
    const omega = symmetrizer ? scaleRows(signedCartan, symmetrizer) : null;
    return {
      omega,
      orientationText: diagramOrientationText(cartan, orientation),
      signedCartan,
      symmetrizer,
    };
  }

  function signedOffDiagonalCartan(cartan, orientation) {
    const directions = orientationDirections(orientation);
    return cartan.map((row, i) => row.map((value, j) => {
      if (i === j) {
        return 0;
      }
      return directions[i][j] ? -value : value;
    }));
  }

  function orientationDirections(orientation) {
    if (orientation === "clockwise") {
      return [
        [false, true, false],
        [false, false, true],
        [true, false, false],
      ];
    }
    if (orientation === "counterclockwise") {
      return [
        [false, false, true],
        [true, false, false],
        [false, true, false],
      ];
    }
    const position = orderPositions(orientation);
    return position.map((left, i) => position.map((right, j) => i !== j && left < right));
  }

  function orderPositions(order) {
    const position = [0, 0, 0];
    order.forEach((simple, index) => {
      position[simple] = index;
    });
    return position;
  }

  function skewSymmetrizerFor(matrix) {
    const ratios = [null, null, null];
    for (let start = 0; start < 3; start += 1) {
      if (ratios[start]) {
        continue;
      }
      ratios[start] = { num: 1, den: 1 };
      const queue = [start];
      for (let head = 0; head < queue.length; head += 1) {
        const i = queue[head];
        for (let j = 0; j < 3; j += 1) {
          if (i === j) {
            continue;
          }
          const bij = matrix[i][j];
          const bji = matrix[j][i];
          if (bij === 0 && bji === 0) {
            continue;
          }
          if (bij === 0 || bji === 0 || Math.sign(bij) === Math.sign(bji)) {
            return null;
          }
          const candidate = multiplyFraction(
            ratios[i],
            reduceFraction(Math.abs(bij), Math.abs(bji)),
          );
          if (!ratios[j]) {
            ratios[j] = candidate;
            queue.push(j);
          } else if (!sameFraction(ratios[j], candidate)) {
            return null;
          }
        }
      }
    }

    let denominatorLcm = 1;
    for (const ratio of ratios) {
      denominatorLcm = leastCommonMultiple(denominatorLcm, ratio.den);
    }
    const weights = ratios.map((ratio) => ratio.num * (denominatorLcm / ratio.den));
    const commonDivisor = weights.reduce(greatestCommonDivisor, 0) || 1;
    return weights.map((weight) => weight / commonDivisor);
  }

  function scaleRows(matrix, scalars) {
    return matrix.map((row, i) => row.map((value) => scalars[i] * value));
  }

  function diagramOrientationText(cartan, orientation) {
    const directions = orientationDirections(orientation);
    const directedEdges = [];
    for (let i = 0; i < 3; i += 1) {
      for (let j = i + 1; j < 3; j += 1) {
        if (cartan[i][j] === 0 && cartan[j][i] === 0) {
          continue;
        }
        const first = directions[i][j] ? i : j;
        const second = first === i ? j : i;
        directedEdges.push(`s${first + 1} → s${second + 1}`);
      }
    }
    if (orientation === "clockwise" || orientation === "counterclockwise") {
      return directedEdges.length
        ? `Cyclic ${orientation} orientation (not a Coxeter element): ${directedEdges.join(", ")}.`
        : `Cyclic ${orientation} orientation (not a Coxeter element); the current diagram has no edges to orient.`;
    }
    return directedEdges.length
      ? `Diagram arrows point from the earlier to the later letter of c: ${directedEdges.join(", ")}.`
      : "The current Coxeter diagram has no edges to orient.";
  }

  function orientationChoiceValue(orientation) {
    return typeof orientation === "string" ? orientation : orientation.join(",");
  }

  function orientationFromValue(value) {
    if (value === "clockwise" || value === "counterclockwise") {
      return value;
    }
    const order = value.split(",").map(Number);
    return order.length === 3
      && new Set(order).size === 3
      && order.every((simple) => Number.isInteger(simple) && simple >= 0 && simple < 3)
      ? order
      : null;
  }

  function coxeterElementLabel(order) {
    const names = ["s₁", "s₂", "s₃"];
    return `c = ${order.map((simple) => names[simple]).join(" ")}`;
  }

  function renderCambrianOverlays(app, data) {
    removeCambrianLayers();
    if (!data?.symmetrizer || (!showAnnihilators && !showAlignedShards)) {
      if (!data?.symmetrizer || !showAlignedShards) {
        clearAlignedShardSelection();
      }
      syncCambrianShardActions();
      return;
    }

    const state = app.getState();
    const context = app.getPlotContext();
    if (!context.plotLayer) {
      syncCambrianShardActions();
      return;
    }

    annihilatorLayer = app.createSvgElement("g", { class: "cambrian-annihilator-layer" });
    alignedShardLayer = app.createSvgElement("g", { class: "cambrian-aligned-shard-layer" });
    const firstRootCircle = context.rootCircles.find(Boolean);
    context.plotLayer.insertBefore(annihilatorLayer, firstRootCircle || null);
    context.plotLayer.insertBefore(alignedShardLayer, firstRootCircle || null);

    let selectedShardRendered = false;
    for (const [rootIndex, root] of state.currentRoots.entries()) {
      if (context.rootCircles[rootIndex]?.classList.contains("is-hidden")) {
        continue;
      }
      if (showAnnihilators) {
        drawAnnihilator(app, root, data.omega, context.plotScale);
      }
      if (showAlignedShards) {
        const alignedShard = alignedShardForRoot(root, state.currentRoots, data.omega);
        if (alignedShard) {
          const selected = app.vectorKey(root.vector) === selectedAlignedShardKey;
          drawAlignedShard(app, rootIndex, root, state.currentRoots, context, alignedShard, selected);
          selectedShardRendered ||= selected;
        }
      }
    }
    if (selectedAlignedShardKey && !selectedShardRendered) {
      clearAlignedShardSelection();
    }
    syncCambrianShardActions();
  }

  function removeCambrianLayers() {
    annihilatorLayer?.remove();
    alignedShardLayer?.remove();
    annihilatorLayer = null;
    alignedShardLayer = null;
  }

  function clearAlignedShardSelection() {
    selectedAlignedShardKey = null;
  }

  function drawAnnihilator(app, root, omega, plotScale) {
    const functional = vectorMatrixProduct(root.vector, omega);
    const tangent = crossProduct([1, 1, 1], functional);
    const length = Math.hypot(...tangent);
    if (length <= 1e-12) {
      return;
    }
    const scale = 1000 / length;
    const first = barycentricToCanvas(root.barycentric.map((value, i) => value - tangent[i] * scale));
    const second = barycentricToCanvas(root.barycentric.map((value, i) => value + tangent[i] * scale));
    const segment = clipLineToTriangle(first, second);
    if (!segment) {
      return;
    }

    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength <= 1e-9) {
      return;
    }
    const perpendicular = { x: -dy / segmentLength, y: dx / segmentLength };
    const probe = {
      x: root.point.x + perpendicular.x * 4,
      y: root.point.y + perpendicular.y * 4,
    };
    const positiveOnPerpendicularSide = dotProduct(functional, canvasToBarycentric(probe)) > 0;
    const positiveOffset = positiveOnPerpendicularSide ? perpendicular : negatePoint(perpendicular);
    const negativeOffset = negatePoint(positiveOffset);
    const offset = 2.2 / Math.max(plotScale, 1e-9);

    annihilatorLayer.append(
      offsetLine(app, segment, positiveOffset, offset, "cambrian-annihilator-positive", "ω_c(root, −) > 0"),
      offsetLine(app, segment, negativeOffset, offset, "cambrian-annihilator-negative", "ω_c(root, −) < 0"),
      app.createSvgElement("line", {
        x1: segment.start.x,
        y1: segment.start.y,
        x2: segment.end.x,
        y2: segment.end.y,
        class: "cambrian-annihilator-zero",
        "aria-label": "Annihilator: ω_c(root, −) = 0",
      }),
    );
  }

  function offsetLine(app, segment, direction, distance, className, label) {
    return app.createSvgElement("line", {
      x1: segment.start.x + direction.x * distance,
      y1: segment.start.y + direction.y * distance,
      x2: segment.end.x + direction.x * distance,
      y2: segment.end.y + direction.y * distance,
      class: className,
      "aria-label": label,
    });
  }

  function alignedShardForRoot(root, roots, omega) {
    const rankTwoData = rankTwoConstraints(root, roots, omega);
    if (!rankTwoData) {
      return null;
    }
    const { constraints, cutAngles } = rankTwoData;
    if (!constraints.length) {
      return { sector: { start: 0, end: TWO_PI, full: true } };
    }

    const sectors = shardSectors(cutAngles);
    const alignedSectors = sectors.filter((sector) => {
      const normal = dualNormalForSector(root, midpointAngle(sector));
      return normal && constraints.every((constraint) => (
        dotProduct(constraint.selected.vector, normal) > 1e-8
      ));
    });
    if (alignedSectors.length !== 1) {
      return null;
    }
    return { sector: alignedSectors[0] };
  }

  function rankTwoConstraints(root, roots, omega) {
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

    const constraints = [];
    const cutAngles = [];
    for (const candidates of groups.values()) {
      const rankTwo = relativelySimpleRoots(root, candidates);
      if (!rankTwo) {
        continue;
      }
      const omegaValue = bilinearPair(rankTwo.first.vector, omega, rankTwo.second.vector);
      if (Math.abs(omegaValue) <= 1e-8) {
        return null;
      }
      constraints.push({
        selected: omegaValue > 0 ? rankTwo.first : rankTwo.second,
      });
      cutAngles.push(rankTwo.angle, normalizeAngle(rankTwo.angle + Math.PI));
    }

    cutAngles.sort((left, right) => left - right);
    return {
      constraints,
      cutAngles: cutAngles.filter(
        (angle, index) => index === 0 || angularDistance(angle, cutAngles[index - 1]) > 1e-7,
      ),
    };
  }

  function relativelySimpleRoots(root, candidates) {
    const reference = candidates
      .map((candidate) => ({
        x: candidate.point.x - root.point.x,
        y: candidate.point.y - root.point.y,
      }))
      .find((direction) => Math.hypot(direction.x, direction.y) > 1e-9);
    if (!reference) {
      return null;
    }
    const length = Math.hypot(reference.x, reference.y);
    const direction = { x: reference.x / length, y: reference.y / length };
    const projected = candidates.map((candidate) => ({
      candidate,
      value: (candidate.point.x - root.point.x) * direction.x
        + (candidate.point.y - root.point.y) * direction.y,
    }));
    const tolerance = Math.max(1, ...projected.map(({ value }) => Math.abs(value))) * 1e-8;
    const min = projected.reduce((best, entry) => entry.value < best.value ? entry : best);
    const max = projected.reduce((best, entry) => entry.value > best.value ? entry : best);
    if (min.value >= -tolerance || max.value <= tolerance) {
      return null;
    }
    return {
      first: min.candidate,
      second: max.candidate,
      angle: normalizeAngle(Math.atan2(direction.y, direction.x)),
    };
  }

  function dualNormalForSector(root, angle) {
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const point = {
      x: root.point.x + direction.x,
      y: root.point.y + direction.y,
    };
    const tangent = canvasToBarycentric(point).map((value, i) => value - root.barycentric[i]);
    const normal = crossProduct(root.vector, tangent);
    return Math.hypot(...normal) > 1e-10 ? normal : null;
  }

  function drawAlignedShard(app, rootIndex, root, roots, context, alignedShard, selected) {
    const radii = shardAnnulusRadii(rootIndex, root, roots, context);
    const { sector } = alignedShard;
    const element = app.createSvgElement("path", {
      d: sector.full
        ? fullAnnulusPath(root.point, radii.inner, radii.outer)
        : annularSectorPath(root.point, radii.inner, radii.outer, sector.start, sector.end),
      class: "cambrian-aligned-shard-sector",
      "fill-rule": "evenodd",
      "aria-label": "c-aligned shard",
    });
    if (selected) {
      element.classList.add("selected");
    }
    element.setAttribute("role", "button");
    element.setAttribute("tabindex", "0");
    element.addEventListener("pointerdown", (event) => event.stopPropagation());
    element.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectedAlignedShardKey = app.vectorKey(root.vector);
      setCambrianShardStatus("c-aligned shard selected.");
      renderCambrianOverlays(app, currentCambrianData);
    });
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      selectedAlignedShardKey = app.vectorKey(root.vector);
      setCambrianShardStatus("c-aligned shard selected.");
      renderCambrianOverlays(app, currentCambrianData);
    });
    alignedShardLayer.append(element);
  }

  function syncCambrianShardActions() {
    const actions = document.getElementById("cambrian-shard-actions-row");
    const selected = Boolean(showAlignedShards && selectedAlignedShardKey);
    if (actions) {
      actions.hidden = !selected;
    }
    for (const id of [
      "cambrian-shard-join-irreducible-button",
      "cambrian-shard-meet-irreducible-button",
    ]) {
      const button = document.getElementById(id);
      if (button) {
        button.disabled = !selected;
      }
    }
    if (!selected) {
      setCambrianShardStatus("");
    }
  }

  function setCambrianShardStatus(message) {
    const status = document.getElementById("cambrian-shard-status");
    if (status) {
      status.textContent = message;
    }
  }

  function selectCambrianIrreducible(app, includeRoot) {
    if (!selectedAlignedShardKey || !currentCambrianData?.omega) {
      return;
    }
    const roots = app.getState().currentRoots;
    const root = roots.find((candidate) => app.vectorKey(candidate.vector) === selectedAlignedShardKey);
    const alignedShard = root && alignedShardForRoot(root, roots, currentCambrianData.omega);
    if (!root || !alignedShard) {
      clearAlignedShardSelection();
      renderCambrianOverlays(app, currentCambrianData);
      return;
    }
    const candidates = incidentSeparatingSets(app, root, roots, alignedShard.sector, includeRoot);
    const keys = Array.from(
      includeRoot ? inclusionMinimalSet(candidates) : inclusionMaximalSet(candidates),
    );
    app.setSelectRank2Enabled(false);
    app.selectRootsByKeys(keys, { reveal: true });
    setCambrianShardStatus(
      `Selected the ${includeRoot ? "join" : "meet"}-irreducible set (${keys.length} root${keys.length === 1 ? "" : "s"}).`,
    );
    renderCambrianOverlays(app, currentCambrianData);
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
        keys.add(selectedAlignedShardKey);
      } else {
        keys.delete(selectedAlignedShardKey);
      }
      const signature = Array.from(keys).sort().join("|");
      if (!signatures.has(signature)) {
        signatures.add(signature);
        candidates.push(keys);
      }
    }
    return candidates.length ? candidates : [new Set(includeRoot ? [selectedAlignedShardKey] : [])];
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

  function unwrapAngleIntoSector(angle, sector) {
    if (sector.full) {
      return normalizeAngle(angle);
    }
    let unwrapped = normalizeAngle(angle);
    while (unwrapped <= sector.start + 1e-8) {
      unwrapped += TWO_PI;
    }
    return unwrapped < sector.end - 1e-8 ? unwrapped : null;
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

  function clipLineToTriangle(first, second) {
    const direction = { x: second.x - first.x, y: second.y - first.y };
    const intersections = [];
    const triangle = simplexTriangle();
    for (let index = 0; index < triangle.length; index += 1) {
      const start = triangle[index];
      const end = triangle[(index + 1) % triangle.length];
      const edge = { x: end.x - start.x, y: end.y - start.y };
      const denominator = cross2(direction, edge);
      if (Math.abs(denominator) <= 1e-10) {
        continue;
      }
      const offset = { x: start.x - first.x, y: start.y - first.y };
      const lineParameter = cross2(offset, edge) / denominator;
      const edgeParameter = cross2(offset, direction) / denominator;
      if (edgeParameter >= -1e-8 && edgeParameter <= 1 + 1e-8) {
        const point = {
          x: first.x + lineParameter * direction.x,
          y: first.y + lineParameter * direction.y,
        };
        if (!intersections.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < 1e-6)) {
          intersections.push(point);
        }
      }
    }
    if (intersections.length < 2) {
      return null;
    }
    let best = { start: intersections[0], end: intersections[1], distance: 0 };
    for (let i = 0; i < intersections.length; i += 1) {
      for (let j = i + 1; j < intersections.length; j += 1) {
        const distance = Math.hypot(intersections[i].x - intersections[j].x, intersections[i].y - intersections[j].y);
        if (distance > best.distance) {
          best = { start: intersections[i], end: intersections[j], distance };
        }
      }
    }
    return best.distance > 1e-6 ? best : null;
  }

  function simplexTriangle() {
    const margin = 90;
    const side = Math.min(720 - 2 * margin, (640 - 2 * margin) / 0.8660254037844386);
    return [
      { x: margin, y: margin + side * 0.8660254037844386 },
      { x: margin + side / 2, y: margin },
      { x: margin + side, y: margin + side * 0.8660254037844386 },
    ];
  }

  function barycentricToCanvas([a, b, c]) {
    const [first, second, third] = simplexTriangle();
    return {
      x: a * first.x + b * second.x + c * third.x,
      y: a * first.y + b * second.y + c * third.y,
    };
  }

  function canvasToBarycentric(point) {
    const [first, second, third] = simplexTriangle();
    const b = (first.y - point.y) / (first.y - second.y);
    const c = (point.x - first.x - b * (second.x - first.x)) / (third.x - first.x);
    return [1 - b - c, b, c];
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
      "Z",
      `M ${center.x + innerRadius} ${center.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${center.x - innerRadius} ${center.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${center.x + innerRadius} ${center.y}`,
      "Z",
    ].join(" ");
  }

  function pointAtAngle(center, radius, angle) {
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    };
  }

  function directionForAngle(angle) {
    return { x: Math.cos(angle), y: Math.sin(angle) };
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

  function primitiveNormal(vector) {
    if (vector.every((value) => value === 0)) {
      return null;
    }
    const divisor = vector.reduce((gcd, value) => greatestCommonDivisor(gcd, value), 0) || 1;
    const primitive = vector.map((value) => value / divisor);
    const firstNonzero = primitive.find((value) => value !== 0);
    return firstNonzero < 0 ? primitive.map((value) => -value) : primitive;
  }

  function vectorMatrixProduct(vector, matrix) {
    return matrix[0].map((_, column) => (
      vector[0] * matrix[0][column]
        + vector[1] * matrix[1][column]
        + vector[2] * matrix[2][column]
    ));
  }

  function bilinearPair(left, matrix, right) {
    return dotProduct(vectorMatrixProduct(left, matrix), right);
  }

  function dotProduct(left, right) {
    return left.reduce((total, value, index) => total + value * right[index], 0);
  }

  function crossProduct(left, right) {
    return [
      left[1] * right[2] - left[2] * right[1],
      left[2] * right[0] - left[0] * right[2],
      left[0] * right[1] - left[1] * right[0],
    ];
  }

  function cross2(left, right) {
    return left.x * right.y - left.y * right.x;
  }

  function negatePoint(point) {
    return { x: -point.x, y: -point.y };
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

  function leastCommonMultiple(left, right) {
    return Math.abs(left * right) / (greatestCommonDivisor(left, right) || 1);
  }

  function reduceFraction(num, den) {
    const divisor = greatestCommonDivisor(num, den) || 1;
    return { num: num / divisor, den: den / divisor };
  }

  function multiplyFraction(left, right) {
    return reduceFraction(left.num * right.num, left.den * right.den);
  }

  function sameFraction(left, right) {
    return left.num === right.num && left.den === right.den;
  }
}());
