const SMS_LIMIT = 160;

function formatCurrency(amount) {
  return `₹${Math.round(amount)}`;
}

function envelopeMap(envelopes) {
  const base = {
    food: 0,
    travel: 0,
    bachatDabba: 0,
    festivalPot: 0
  };
  return envelopes.reduce((acc, envelope) => {
    acc[envelope.name] = envelope.amount;
    return acc;
  }, base);
}

const SMS_BUILDERS = {
  en: ({ rent, envelopes }) =>
    `Roof first ${formatCurrency(rent)}. ➤ Roti dabba ${formatCurrency(envelopes.food)}. ➤ Bus coins ${formatCurrency(envelopes.travel)}. ➤ Gullak save ${formatCurrency(envelopes.bachatDabba)}. ➤ Festival pot ${formatCurrency(envelopes.festivalPot)}.`,
  hi: ({ rent, envelopes }) =>
    `Chhat pehle ${formatCurrency(rent)}. ➤ Roti dabba ${formatCurrency(envelopes.food)}. ➤ Bus paisa ${formatCurrency(envelopes.travel)}. ➤ Gullak bachat ${formatCurrency(envelopes.bachatDabba)}. ➤ Tyohar matka ${formatCurrency(envelopes.festivalPot)}.`,
  ta: ({ rent, envelopes }) =>
    `Maadi rent ${formatCurrency(rent)}. ➤ Saapadu dabba ${formatCurrency(envelopes.food)}. ➤ Bus kaasu ${formatCurrency(envelopes.travel)}. ➤ Kumbam save ${formatCurrency(envelopes.bachatDabba)}. ➤ Thiruvizha pot ${formatCurrency(envelopes.festivalPot)}.`
};

function enforceSmsLength(text) {
  if (text.length <= SMS_LIMIT) {
    return text;
  }

  const compacted = text.replace(/\s+/g, ' ').trim();
  if (compacted.length <= SMS_LIMIT) {
    return compacted;
  }

  throw new Error(`SMS template exceeds ${SMS_LIMIT} characters`);
}

function formatSms({ locale = 'en', allocations }) {
  const builder = SMS_BUILDERS[locale] || SMS_BUILDERS.en;
  const payload = {
    rent: allocations.rent.amount,
    envelopes: envelopeMap(allocations.envelopes)
  };
  const text = builder(payload);
  return {
    locale,
    text: enforceSmsLength(text)
  };
}

module.exports = {
  SMS_LIMIT,
  formatSms,
  enforceSmsLength
};
