function startOfDay(inputDate) {
  const date = new Date(inputDate);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function diffInDays(later, earlier) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(later) - startOfDay(earlier)) / msPerDay);
}

function diffInMonths(later, earlier) {
  const yearDiff = later.getFullYear() - earlier.getFullYear();
  return yearDiff * 12 + (later.getMonth() - earlier.getMonth());
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

module.exports = {
  startOfDay,
  addDays,
  diffInDays,
  diffInMonths,
  clamp
};
