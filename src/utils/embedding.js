const STOP_WORDS = new Set(['the', 'is', 'and', 'a', 'of', 'to', 'for', 'in', 'on', 'with', 'about']);

function tokenize(text = '') {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token));
}

function vectorize(text = '') {
  const tokens = Array.isArray(text) ? text : tokenize(text);
  const vector = new Map();
  tokens.forEach((token) => {
    vector.set(token, (vector.get(token) || 0) + 1);
  });
  return vector;
}

function cosineSimilarity(vecA, vecB) {
  if (!vecA.size || !vecB.size) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;

  vecA.forEach((value, key) => {
    magA += value * value;
    if (vecB.has(key)) {
      dot += value * vecB.get(key);
    }
  });

  vecB.forEach((value) => {
    magB += value * value;
  });

  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function similarityAgainstCorpus(text, corpus = []) {
  const textVector = vectorize(text);
  const scores = corpus.map((entry) => cosineSimilarity(textVector, vectorize(entry)));
  return Math.max(...scores, 0);
}

module.exports = {
  tokenize,
  vectorize,
  cosineSimilarity,
  similarityAgainstCorpus,
};
