const FESTIVAL_BY_MONTH = {
  0: 'New Year savings',
  1: 'Tax planning season',
  7: 'Independence Day offers',
  9: 'Diwali gifting outlook',
  11: 'Year-end reflection',
};

function getFestivalContext(date = new Date(), userContextFestival) {
  if (userContextFestival) return userContextFestival;
  const month = new Date(date).getMonth();
  return FESTIVAL_BY_MONTH[month] || 'Operate with standard fiscal discipline';
}

module.exports = { getFestivalContext };
