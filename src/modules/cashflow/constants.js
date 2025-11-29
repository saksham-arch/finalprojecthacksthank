const BASELINE_TABLE = {
  'ride-share': {
    urban: 1500,
    suburban: 1100,
    rural: 800
  },
  delivery: {
    urban: 1000,
    suburban: 820,
    rural: 600
  },
  freelance: {
    urban: 1350,
    suburban: 950,
    rural: 720
  }
};

const DEFAULT_BASELINE = 750;

const FESTIVAL_CALENDAR = [
  { name: 'Pongal', month: 0, day: 14, window: 2, modifier: 1.18 },
  { name: 'Holi', month: 2, day: 25, window: 1, modifier: 1.12 },
  { name: 'Eid', month: 3, day: 11, window: 2, modifier: 1.15 },
  { name: 'Diwali', month: 10, day: 1, window: 3, modifier: 1.25 }
];

const MONSOON_MONTHS = [5, 6, 7, 8];
const MONSOON_DAMPENING = 0.88;

const DEFAULT_OPTIONS = {
  horizonDays: 7,
  historyThreshold: 8,
  incomeGapThreshold: 320
};

const SMS_MAX_LENGTH = 160;
const VOICE_WORD_LIMIT = 35;
const VOICE_MAX_DURATION_SECONDS = 15;

function getBaseline(gigType, region) {
  const gigBaseline = BASELINE_TABLE[gigType] || {};
  return gigBaseline[region] || DEFAULT_BASELINE;
}

module.exports = {
  BASELINE_TABLE,
  DEFAULT_BASELINE,
  FESTIVAL_CALENDAR,
  MONSOON_MONTHS,
  MONSOON_DAMPENING,
  DEFAULT_OPTIONS,
  SMS_MAX_LENGTH,
  VOICE_WORD_LIMIT,
  VOICE_MAX_DURATION_SECONDS,
  getBaseline
};
