class OfflineController {
  constructor(initialValue = false) {
    this.offline = Boolean(initialValue);
    this.listeners = new Set();
  }

  isOffline() {
    return this.offline;
  }

  setOffline(value) {
    const next = Boolean(value);
    if (next === this.offline) {
      return;
    }
    this.offline = next;
    this.listeners.forEach((listener) => {
      try {
        listener(this.offline);
      } catch (error) {
        // Intentionally swallow listener errors to avoid crashing state flips.
      }
    });
  }

  toggle() {
    this.setOffline(!this.offline);
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

module.exports = OfflineController;
