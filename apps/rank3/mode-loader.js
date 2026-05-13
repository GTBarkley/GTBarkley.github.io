(function loadViewerScripts() {
  const params = new URLSearchParams(window.location.search);
  const mode = (params.get("mode") || "").trim().toLowerCase();
  const snake = (params.get("snake") || "").trim().toLowerCase();
  const snakeModeEnabled = mode === "snake" || ["1", "true", "yes", "on"].includes(snake);

  window.RootViewerMode = {
    name: snakeModeEnabled ? "snake" : "default",
  };

  const scripts = snakeModeEnabled ? ["./snake-mode.js", "./app.js"] : ["./app.js"];

  function appendScript(src, onDone) {
    const script = document.createElement("script");
    script.src = src;
    script.onload = onDone;
    document.body.append(script);
  }

  function loadNext(index) {
    if (index >= scripts.length) {
      return;
    }
    appendScript(scripts[index], () => loadNext(index + 1));
  }

  loadNext(0);
}());
