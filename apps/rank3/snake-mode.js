(function registerSnakeMode() {
  let viardModeEnabled = false;
  let standardMaxHeightValue = "100";
  let viardWindowValue = "10";
  let activeWindowMode = "standard";
  const VIARD_DEFAULT_WINDOW = 10;
  const VIARD_SAFETY_CAP = 2500;

  window.RootViewerExtensions = window.RootViewerExtensions || [];
  window.RootViewerExtensions.push({
    name: "snake-mode",
    afterSetup(app) {
      document.body.dataset.viewerMode = "snake";
      app.setTitleSuffix(" (Snake Mode)");
      addViardToggle(app);
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
      syncWindowMode(app);
      app.renderAll({ preserveSelection: true });
    });

    const text = document.createElement("span");
    text.textContent = "Viard Mode";

    label.append(input, text);
    modeRow.append(label);
    syncWindowMode(app);
  }

  function syncWindowMode(app) {
    const label = app.nodes.maxHeightLabel;
    const input = app.nodes.maxHeightInput;
    if (!label || !input) {
      return;
    }

    if (viardModeEnabled) {
      if (activeWindowMode !== "viard") {
        standardMaxHeightValue = input.value || standardMaxHeightValue;
      }
      label.textContent = "Viard Level";
      input.value = viardWindowValue || String(VIARD_DEFAULT_WINDOW);
      activeWindowMode = "viard";
    } else {
      if (activeWindowMode === "viard") {
        viardWindowValue = input.value || viardWindowValue;
      }
      label.textContent = "Maximum Root Height";
      input.value = standardMaxHeightValue || "100";
      activeWindowMode = "standard";
    }
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
    const parsed = Number(app.nodes.maxHeightInput?.value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : VIARD_DEFAULT_WINDOW;
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
}());
