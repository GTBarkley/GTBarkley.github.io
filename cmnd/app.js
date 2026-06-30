const state = {
  n: 4,
  perm: identity(4),
  word: [],
  pendingWord: false,
  history: [],
  future: [],
  mode: "left",
  changedPositions: [],
  changedValues: [],
  lastReason: null,
  activeLink: null,
};

const els = {
  rank: document.getElementById("rank-select"),
  tiles: document.getElementById("tiles"),
  form: document.getElementById("perm-form"),
  input: document.getElementById("perm-input"),
  message: document.getElementById("input-message"),
  reset: document.getElementById("reset-btn"),
  undo: document.getElementById("undo-btn"),
  redo: document.getElementById("redo-btn"),
  simpleButtons: document.getElementById("simple-buttons"),
  transpositionButtons: document.getElementById("transposition-buttons"),
  rightMode: document.getElementById("right-mode"),
  leftMode: document.getElementById("left-mode"),
  generateWord: document.getElementById("generate-word-btn"),
  factPermutation: document.getElementById("fact-permutation"),
  factCycles: document.getElementById("fact-cycles"),
  factInversions: document.getElementById("fact-inversions"),
  factLength: document.getElementById("fact-length"),
  factDescents: document.getElementById("fact-descents"),
  wordDisplay: document.getElementById("word-display"),
  exchangePanel: document.getElementById("exchange-panel"),
};

function identity(n) {
  return Array.from({ length: n }, (_, i) => i + 1);
}

function cloneSnapshot() {
  return {
    n: state.n,
    perm: [...state.perm],
    word: state.word ? [...state.word] : null,
    pendingWord: state.pendingWord,
    mode: state.mode,
    changedPositions: [...state.changedPositions],
    changedValues: [...state.changedValues],
    lastReason: state.lastReason ? structuredClone(state.lastReason) : null,
    activeLink: state.activeLink ? { ...state.activeLink } : null,
  };
}

function restoreSnapshot(snapshot) {
  state.n = snapshot.n;
  state.perm = [...snapshot.perm];
  state.word = snapshot.word ? [...snapshot.word] : null;
  state.pendingWord = snapshot.pendingWord;
  state.mode = snapshot.mode;
  state.changedPositions = [...snapshot.changedPositions];
  state.changedValues = [...snapshot.changedValues];
  state.lastReason = snapshot.lastReason ? structuredClone(snapshot.lastReason) : null;
  state.activeLink = snapshot.activeLink ? { ...snapshot.activeLink } : null;
}

function commit(mutator) {
  state.history.push(cloneSnapshot());
  state.future = [];
  state.activeLink = null;
  mutator();
  render();
}

function permKey(perm) {
  return perm.join(",");
}

function permText(perm) {
  return perm.join("");
}

function rightTransposition(perm, a, b) {
  const next = [...perm];
  [next[a - 1], next[b - 1]] = [next[b - 1], next[a - 1]];
  return next;
}

function transpositionKey(a, b) {
  const x = Math.min(a, b);
  const y = Math.max(a, b);
  return `${x}-${y}`;
}

function leftTransposition(perm, a, b) {
  return perm.map((value) => {
    if (value === a) return b;
    if (value === b) return a;
    return value;
  });
}

function applyTranspositionToPerm(perm, a, b, mode) {
  return mode === "right" ? rightTransposition(perm, a, b) : leftTransposition(perm, a, b);
}

function evaluateWord(word, n) {
  return word.reduce((perm, i) => rightTransposition(perm, i, i + 1), identity(n));
}

function inversionPairs(perm) {
  const pos = Array(perm.length + 1);
  perm.forEach((value, index) => {
    pos[value] = index + 1;
  });
  const inversions = [];
  for (let a = 1; a <= perm.length; a += 1) {
    for (let b = a + 1; b <= perm.length; b += 1) {
      if (pos[b] < pos[a]) inversions.push([a, b]);
    }
  }
  return inversions;
}

function lengthOf(perm) {
  return inversionPairs(perm).length;
}

function descents(perm) {
  const result = [];
  for (let i = 1; i < perm.length; i += 1) {
    if (perm[i - 1] > perm[i]) result.push(i);
  }
  return result;
}

function cycleNotation(perm) {
  const seen = Array(perm.length + 1).fill(false);
  const cycles = [];
  for (let start = 1; start <= perm.length; start += 1) {
    if (seen[start]) continue;
    let current = start;
    const cycle = [];
    while (!seen[current]) {
      seen[current] = true;
      cycle.push(current);
      current = perm[current - 1];
    }
    if (cycle.length > 1) cycles.push(`(${cycle.join(" ")})`);
  }
  return cycles.length ? cycles.join(" ") : "e";
}

function canonicalReducedWord(target) {
  const arr = identity(target.length);
  const word = [];
  for (let pos = 0; pos < target.length; pos += 1) {
    let index = arr.indexOf(target[pos]);
    while (index > pos) {
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      word.push(index);
      index -= 1;
    }
  }
  return word;
}

function reflectionKeysForWord(word, n) {
  let prefix = identity(n);
  return word.map((simple) => {
    const key = transpositionKey(prefix[simple - 1], prefix[simple]);
    prefix = rightTransposition(prefix, simple, simple + 1);
    return key;
  });
}

function simpleHtml(i) {
  return `s<span class="simple-sub">${i}</span>`;
}

function subscriptDigits(value) {
  const subscripts = {
    0: "\u2080",
    1: "\u2081",
    2: "\u2082",
    3: "\u2083",
    4: "\u2084",
    5: "\u2085",
    6: "\u2086",
    7: "\u2087",
    8: "\u2088",
    9: "\u2089",
  };
  return String(value).split("").map((digit) => subscripts[digit]).join("");
}

function simpleText(i) {
  return `s${subscriptDigits(i)}`;
}

function groupText(n) {
  return `S${subscriptDigits(n)}`;
}

function parsePermutation(raw, n) {
  const text = raw.trim();
  const values = /[\s,]/.test(text)
    ? text.split(/[\s,]+/).filter(Boolean).map(Number)
    : text.split("").map(Number);
  if (values.length !== n) return { ok: false, message: `Enter exactly ${n} values.` };
  if (values.some((value) => !Number.isInteger(value) || value < 1 || value > n)) {
    return { ok: false, message: `Use each value from 1 through ${n}.` };
  }
  if (new Set(values).size !== n) return { ok: false, message: "Each value must appear exactly once." };
  return { ok: true, values };
}

function removeIndices(word, indices) {
  const removal = new Set(indices);
  return word.filter((_, index) => !removal.has(index));
}

function findOneDeletion(word, target, n) {
  const targetKey = permKey(target);
  for (let j = 0; j < word.length; j += 1) {
    if (permKey(evaluateWord(removeIndices(word, [j]), n)) === targetKey) return j;
  }
  return null;
}

function findPairDeletion(word, target, n) {
  const targetKey = permKey(target);
  for (let i = 0; i < word.length; i += 1) {
    for (let j = i + 1; j < word.length; j += 1) {
      if (permKey(evaluateWord(removeIndices(word, [i, j]), n)) === targetKey) return [i, j];
    }
  }
  return null;
}

function findSingleInsertion(word, target, n) {
  const targetKey = permKey(target);
  for (let pos = 0; pos <= word.length; pos += 1) {
    for (let i = 1; i < n; i += 1) {
      const candidate = [...word.slice(0, pos), i, ...word.slice(pos)];
      if (permKey(evaluateWord(candidate, n)) === targetKey) return candidate;
    }
  }
  return null;
}

function buildDeletionReason(beforeWord, afterPerm, n, label, mode = "left", firstStepKind = "Strong exchange property") {
  let current = [...beforeWord];
  const targetLength = lengthOf(afterPerm);
  const steps = [];
  const first = findOneDeletion(current, afterPerm, n);
  if (first === null) {
    return {
      finalWord: canonicalReducedWord(afterPerm),
      steps: [],
      fallback: true,
      title: "Generated a reduced word",
      label,
      operationLabel: label,
      operationSide: mode,
      beforeWord: [...beforeWord],
    };
  }

  let next = removeIndices(current, [first]);
  steps.push({
    kind: firstStepKind,
    from: current,
    deleteIndices: [first],
    to: next,
  });
  current = next;

  while (current.length > targetLength) {
    const pair = findPairDeletion(current, afterPerm, n);
    if (!pair) break;
    next = removeIndices(current, pair);
    steps.push({
      kind: "Deletion property",
      from: current,
      deleteIndices: pair,
      to: next,
    });
    current = next;
  }

  return {
    finalWord: current.length === targetLength ? current : canonicalReducedWord(afterPerm),
    steps,
    fallback: current.length !== targetLength,
    title: `${label} lowered length`,
    label,
    operationLabel: label,
    operationSide: mode,
    beforeWord: [...beforeWord],
  };
}

function formatWord(word, emptyText = "empty word", options = {}) {
  if (!word || !word.length) return `<span class="empty-word">${emptyText}</span>`;
  const marks = options.marks || [];
  const linkKeys = options.linkKeys || [];
  return word.map((i, index) => {
    const key = linkKeys[index];
    const marked = marks.includes(index) ? " mark-delete" : "";
    const selected = state.activeLink && state.activeLink.index === index && state.activeLink.key === key
      ? " linked-selected"
      : "";
    const linkAttrs = options.interactive && key
      ? ` data-word-index="${index}" data-link-key="${key}" title="Corresponding transposition (${key.replace("-", ",")})"`
      : "";
    return `<span class="word-letter${marked}${selected}"${linkAttrs}>${simpleHtml(i)}</span>`;
  }).join("");
}

function formatMarkedWord(word, marks) {
  return formatWord(word, "empty word", { marks });
}

function setMessage(text, ok = false) {
  els.message.textContent = text;
  els.message.classList.toggle("ok", ok);
}

function positionsChanged(before, after) {
  const changed = [];
  for (let i = 0; i < Math.max(before.length, after.length); i += 1) {
    if (before[i] !== after[i]) changed.push(i + 1);
  }
  return changed;
}

function renderTiles() {
  els.tiles.style.setProperty("--tile-count", state.n);
  els.tiles.innerHTML = state.perm.map((value, index) => {
    const position = index + 1;
    const byPosition = state.changedPositions.includes(position);
    const byValue = state.changedValues.includes(value);
    const className = byPosition ? "tile changed" : byValue ? "tile value-changed" : "tile";
    return `<div class="${className}" data-position="${position}">${value}</div>`;
  }).join("");
}

function renderSimpleButtons() {
  const descentSet = new Set(descents(state.perm));
  els.simpleButtons.innerHTML = "";
  for (let i = 1; i < state.n; i += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `simple-btn ${descentSet.has(i) ? "lower" : "raise"}`;
    btn.innerHTML = simpleHtml(i);
    btn.title = `Right multiply by ${simpleText(i)}`;
    btn.disabled = state.pendingWord;
    btn.addEventListener("click", () => applySimple(i));
    els.simpleButtons.append(btn);
  }
}

function renderTranspositionButtons() {
  els.transpositionButtons.innerHTML = "";
  const beforeLength = lengthOf(state.perm);
  for (let a = 1; a <= state.n; a += 1) {
    for (let b = a + 1; b <= state.n; b += 1) {
      const after = applyTranspositionToPerm(state.perm, a, b, state.mode);
      const delta = lengthOf(after) - beforeLength;
      const btn = document.createElement("button");
      btn.type = "button";
      const key = transpositionKey(a, b);
      const linked = state.activeLink && state.activeLink.key === key ? " linked-selected" : "";
      btn.className = `transposition-btn ${delta < 0 ? "lower" : delta > 0 ? "raise" : "same"}${linked}`;
      btn.dataset.transpositionKey = key;
      if (delta < 0 && !state.pendingWord && state.word) {
        const deleteIndex = findOneDeletion(state.word, after, state.n);
        if (deleteIndex !== null) btn.dataset.deleteWordIndex = String(deleteIndex);
      }
      btn.innerHTML = `<span>(${a},${b})</span><small>${delta > 0 ? "+" : ""}${delta}</small>`;
      btn.title = `${state.mode} multiply by (${a},${b}); length ${delta > 0 ? "increases" : delta < 0 ? "decreases" : "does not change"} by ${Math.abs(delta)}`;
      btn.addEventListener("click", () => applyGeneralTransposition(a, b));
      els.transpositionButtons.append(btn);
    }
  }
}

function renderFacts() {
  const inversions = inversionPairs(state.perm);
  const descentList = descents(state.perm);
  els.factPermutation.textContent = permText(state.perm);
  els.factCycles.textContent = cycleNotation(state.perm);
  els.factInversions.textContent = inversions.length
    ? inversions.map(([a, b]) => `(${a},${b})`).join(", ")
    : "none";
  els.factLength.textContent = String(inversions.length);
  els.factDescents.innerHTML = descentList.length ? descentList.map(simpleHtml).join(", ") : "none";
}

function renderWord() {
  els.generateWord.classList.toggle("hidden", !state.pendingWord);
  if (state.pendingWord) {
    els.wordDisplay.innerHTML = `<span class="empty-word">reduced word not generated yet</span>`;
    return;
  }
  els.wordDisplay.innerHTML = formatWord(state.word, "empty word", {
    interactive: true,
    linkKeys: reflectionKeysForWord(state.word, state.n),
  });
}

function renderReasoning() {
  if (!state.lastReason) {
    els.exchangePanel.innerHTML = `
      <div class="exchange-note">
        <p>When a transposition lowers length, the deletion steps will appear here.</p>
      </div>
    `;
    return;
  }

  if (state.lastReason.pending) {
    els.exchangePanel.innerHTML = `
      <div class="exchange-note">
        <h3>Length increased by ${state.lastReason.delta}</h3>
        <p>Use the button in the reduced-word display to generate a reduced word for ${permText(state.perm)}.</p>
      </div>
    `;
    return;
  }

  if (!state.lastReason.steps.length) {
    els.exchangePanel.innerHTML = `
      <div class="exchange-note">
        <p>${state.lastReason.message || "No deletion step was needed."}</p>
      </div>
    `;
    return;
  }

  const operationLine = state.lastReason.beforeWord
    ? state.lastReason.operationSide === "right"
      ? `
        <div class="operation-line">
          <div class="witness-word">${formatWord(state.lastReason.beforeWord)}</div>
          <span>· ${state.lastReason.operationLabel}</span>
        </div>
      `
      : `
        <div class="operation-line">
          <span>${state.lastReason.operationLabel} ·</span>
          <div class="witness-word">${formatWord(state.lastReason.beforeWord)}</div>
        </div>
      `
    : "";
  const stepHtml = state.lastReason.steps.map((step, index) => `
    <div class="reason-step">
      <h3>${step.kind}</h3>
      <div class="witness-word">${formatMarkedWord(step.from, step.deleteIndices)}</div>
      <div class="down-arrow">↓</div>
      <div class="witness-word">${formatWord(step.to)}</div>
      ${index < state.lastReason.steps.length - 1 ? `<div class="step-spacer"></div>` : ""}
    </div>
  `).join("");
  els.exchangePanel.innerHTML = operationLine + stepHtml;
}

function render() {
  els.rank.value = String(state.n);
  els.input.value = permText(state.perm);
  els.rightMode.classList.toggle("active", state.mode === "right");
  els.leftMode.classList.toggle("active", state.mode === "left");
  els.undo.disabled = state.history.length === 0;
  els.redo.disabled = state.future.length === 0;
  renderTiles();
  renderSimpleButtons();
  renderTranspositionButtons();
  renderFacts();
  renderWord();
  renderReasoning();
}

function setLinkedClass(key, className, enabled) {
  if (!key) return;
  document.querySelectorAll(`[data-link-key="${key}"], [data-transposition-key="${key}"]`).forEach((el) => {
    el.classList.toggle(className, enabled);
  });
}

function setWordIndexClass(index, className, enabled) {
  if (index === undefined || index === null || index === "") return;
  const letter = els.wordDisplay.querySelector(`[data-word-index="${index}"]`);
  if (letter) letter.classList.toggle(className, enabled);
}

function clearHoverLinks() {
  document.querySelectorAll(".linked-hover").forEach((el) => {
    el.classList.remove("linked-hover");
  });
}

function applySimple(i) {
  if (state.pendingWord) {
    setMessage("Generate a reduced word before applying another simple reflection.");
    return;
  }
  commit(() => {
    const beforePerm = [...state.perm];
    const afterPerm = rightTransposition(state.perm, i, i + 1);
    const beforeLength = lengthOf(beforePerm);
    const afterLength = lengthOf(afterPerm);
    state.perm = afterPerm;
    state.changedPositions = [i, i + 1];
    state.changedValues = [];
    if (afterLength > beforeLength) {
      state.word = [...state.word, i];
      state.lastReason = { steps: [], message: `${simpleText(i)} increased length, so it appended to the reduced word.` };
    } else {
      const reason = buildDeletionReason(state.word, afterPerm, state.n, simpleText(i), "right", "Exchange property");
      state.word = reason.finalWord;
      state.lastReason = reason;
    }
    setMessage(`Applied right multiplication by ${simpleText(i)}.`, true);
  });
}

function applyGeneralTransposition(a, b) {
  commit(() => {
    const beforePerm = [...state.perm];
    const beforeWord = state.pendingWord ? null : [...state.word];
    const afterPerm = applyTranspositionToPerm(state.perm, a, b, state.mode);
    const beforeLength = lengthOf(beforePerm);
    const afterLength = lengthOf(afterPerm);
    const delta = afterLength - beforeLength;
    const label = `(${a},${b})`;

    state.perm = afterPerm;
    state.changedPositions = state.mode === "right" ? [a, b] : [];
    state.changedValues = state.mode === "left" ? [a, b] : [];

    if (delta > 1 || !beforeWord) {
      state.word = null;
      state.pendingWord = true;
      state.lastReason = { pending: true, delta, label };
    } else if (delta === 1) {
      const inserted = findSingleInsertion(beforeWord, afterPerm, state.n);
      state.word = inserted || canonicalReducedWord(afterPerm);
      state.pendingWord = false;
      state.lastReason = {
        steps: [],
        message: `${label} increased length by 1, so one simple reflection was inserted to keep a reduced word.`,
      };
    } else if (delta < 0) {
      const reason = buildDeletionReason(beforeWord, afterPerm, state.n, label, state.mode);
      state.word = reason.finalWord;
      state.pendingWord = false;
      state.lastReason = reason;
    } else {
      state.word = canonicalReducedWord(afterPerm);
      state.pendingWord = false;
      state.lastReason = { steps: [], message: `${label} did not change length; a reduced word was regenerated.` };
    }

    const side = state.mode === "right" ? "right" : "left";
    setMessage(`Applied ${side} multiplication by ${label}; length changed by ${delta > 0 ? "+" : ""}${delta}.`, true);
  });
}

function setPermutationFromInput(raw) {
  const parsed = parsePermutation(raw, state.n);
  if (!parsed.ok) {
    setMessage(parsed.message);
    return;
  }
  commit(() => {
    const beforePerm = [...state.perm];
    state.perm = parsed.values;
    state.word = null;
    state.pendingWord = true;
    state.changedPositions = positionsChanged(beforePerm, state.perm);
    state.changedValues = [];
    state.lastReason = {
      pending: true,
      delta: lengthOf(state.perm),
      label: "typed permutation",
    };
    setMessage("Permutation applied; press Generate reduced word when ready.", true);
  });
}

els.rank.addEventListener("change", () => {
  const nextN = Number(els.rank.value);
  commit(() => {
    state.n = nextN;
    state.perm = identity(nextN);
    state.word = [];
    state.pendingWord = false;
    state.changedPositions = [];
    state.changedValues = [];
    state.lastReason = null;
    setMessage(`Reset to identity in ${groupText(nextN)}.`, true);
  });
});

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  setPermutationFromInput(els.input.value);
});

els.reset.addEventListener("click", () => {
  commit(() => {
    state.perm = identity(state.n);
    state.word = [];
    state.pendingWord = false;
    state.changedPositions = [];
    state.changedValues = [];
    state.lastReason = null;
    setMessage("Reset to the identity.", true);
  });
});

els.undo.addEventListener("click", () => {
  if (!state.history.length) return;
  state.future.push(cloneSnapshot());
  restoreSnapshot(state.history.pop());
  setMessage("Undid the last move.", true);
  render();
});

els.redo.addEventListener("click", () => {
  if (!state.future.length) return;
  state.history.push(cloneSnapshot());
  restoreSnapshot(state.future.pop());
  setMessage("Redid the move.", true);
  render();
});

els.leftMode.addEventListener("click", () => {
  state.mode = "left";
  state.activeLink = null;
  render();
});

els.rightMode.addEventListener("click", () => {
  state.mode = "right";
  state.activeLink = null;
  render();
});

els.generateWord.addEventListener("click", () => {
  commit(() => {
    state.word = canonicalReducedWord(state.perm);
    state.pendingWord = false;
    state.lastReason = { steps: [], message: `Generated a reduced word for ${permText(state.perm)}.` };
    setMessage("Generated a reduced word.", true);
  });
});

function handleLinkHover(event) {
  const letter = event.target.closest(".word-letter[data-link-key]");
  if (!letter || !els.wordDisplay.contains(letter)) return;
  setLinkedClass(letter.dataset.linkKey, "linked-hover", true);
}

function handleLinkLeave(event) {
  const letter = event.target.closest(".word-letter[data-link-key]");
  if (!letter || !els.wordDisplay.contains(letter)) return;
  setLinkedClass(letter.dataset.linkKey, "linked-hover", false);
}

els.wordDisplay.addEventListener("mouseover", handleLinkHover);
els.wordDisplay.addEventListener("pointerover", handleLinkHover);
els.wordDisplay.addEventListener("mouseout", handleLinkLeave);
els.wordDisplay.addEventListener("pointerout", handleLinkLeave);

els.wordDisplay.addEventListener("click", (event) => {
  const letter = event.target.closest(".word-letter[data-link-key]");
  if (!letter || !els.wordDisplay.contains(letter)) return;
  clearHoverLinks();
  const index = Number(letter.dataset.wordIndex);
  const key = letter.dataset.linkKey;
  state.activeLink = state.activeLink && state.activeLink.key === key && state.activeLink.index === index
    ? null
    : { key, index };
  render();
});

function handleTranspositionHover(event) {
  const btn = event.target.closest(".transposition-btn.lower[data-delete-word-index]");
  if (!btn || !els.transpositionButtons.contains(btn)) return;
  btn.classList.add("linked-hover");
  setWordIndexClass(btn.dataset.deleteWordIndex, "linked-hover", true);
}

function handleTranspositionLeave(event) {
  const btn = event.target.closest(".transposition-btn.lower[data-delete-word-index]");
  if (!btn || !els.transpositionButtons.contains(btn)) return;
  btn.classList.remove("linked-hover");
  setWordIndexClass(btn.dataset.deleteWordIndex, "linked-hover", false);
}

els.transpositionButtons.addEventListener("mouseover", handleTranspositionHover);
els.transpositionButtons.addEventListener("pointerover", handleTranspositionHover);
els.transpositionButtons.addEventListener("mouseout", handleTranspositionLeave);
els.transpositionButtons.addEventListener("pointerout", handleTranspositionLeave);

render();
