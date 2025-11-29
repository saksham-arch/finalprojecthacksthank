class ProgressVisualizer {
  constructor(totalSegments = 10) {
    this.totalSegments = totalSegments;
  }

  buildBar(percent = 0) {
    const normalized = Math.max(0, Math.min(100, percent));
    const filledSegments = Math.round((normalized / 100) * this.totalSegments);
    const filled = '▮'.repeat(filledSegments);
    const empty = '▯'.repeat(this.totalSegments - filledSegments);
    return `${filled}${empty}`;
  }
}

module.exports = { ProgressVisualizer };
