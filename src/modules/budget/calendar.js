const MS_IN_DAY = 86_400_000;

const DEFAULT_FESTIVALS = [
  { name: 'Diwali', date: '2024-11-01' },
  { name: 'Eid', date: '2024-04-10' }
];

function normalizeFestivalDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid festival date provided: ${value}`);
  }
  return date;
}

function normalizeFestivals(entries = DEFAULT_FESTIVALS) {
  return entries.map((festival) => ({
    name: festival.name,
    date: normalizeFestivalDate(festival.date)
  }));
}

function describeFestivalPhase(currentDate, customFestivals) {
  const referenceDate = currentDate instanceof Date ? currentDate : new Date(currentDate);
  const festivals = normalizeFestivals(customFestivals);

  let closest = null;
  let smallestDiff = Infinity;

  festivals.forEach((festival) => {
    const diffDays = Math.round((festival.date - referenceDate) / MS_IN_DAY);
    const absoluteDiff = Math.abs(diffDays);

    if (absoluteDiff < smallestDiff) {
      smallestDiff = absoluteDiff;
      closest = {
        name: festival.name,
        date: festival.date,
        diffDays
      };
    }
  });

  if (!closest) {
    return { phase: 'none', festival: null, weeksToEvent: null };
  }

  const weeksToEvent = closest.diffDays >= 0 ? Math.ceil(closest.diffDays / 7) : Math.floor(closest.diffDays / 7);

  if (Math.abs(closest.diffDays) <= 1) {
    return { phase: 'during', festival: closest.name, weeksToEvent };
  }

  if (closest.diffDays >= 0 && closest.diffDays <= 28) {
    return { phase: 'pre', festival: closest.name, weeksToEvent };
  }

  if (closest.diffDays < 0 && closest.diffDays >= -7) {
    return { phase: 'post', festival: closest.name, weeksToEvent };
  }

  return { phase: 'none', festival: null, weeksToEvent: null };
}

module.exports = {
  describeFestivalPhase,
  DEFAULT_FESTIVALS
};
