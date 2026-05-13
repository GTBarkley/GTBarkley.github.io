(function registerSnakeMode() {
  let viardModeEnabled = false;
  let viardWindowValue = "10";
  const VIARD_DEFAULT_WINDOW = 10;
  const VIARD_SAFETY_CAP = 2500;

  window.RootViewerExtensions = window.RootViewerExtensions || [];
  window.RootViewerExtensions.push({
    name: "snake-mode",
    afterSetup(app) {
      document.body.dataset.viewerMode = "snake";
      app.setTitleSuffix(" (Snake Mode)");
      addViardToggle(app);
      addIndex6Button(app);
      addViardWindowControl(app);
      syncIndex6Button(app);
    },
    afterRender(app) {
      syncIndex6Button(app);
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
