const ANALOGIES = {
  'en-IN': [
    { threshold: 25, text: 'like filling the first steel tiffin box' },
    { threshold: 50, text: 'like stacking half the rice sacks at home' },
    { threshold: 75, text: 'like rolling three quarters of the chapati dough' },
    { threshold: 100, text: 'like sealing the spice box for the week' },
  ],
  'hi-IN': [
    { threshold: 25, text: 'jaise pehli dabba bharna' },
    { threshold: 50, text: 'jaise aadhi anaaj ki bori lag chuki hai' },
    { threshold: 75, text: 'jaise roti ka belna lagbhag poora ho' },
    { threshold: 100, text: 'jaise masale ka dabba band hone wala ho' },
  ],
};

const SMS_TEMPLATES = {
  'en-IN': {
    milestone: ({ goalName, percent, bar, analogy }) => `Goal ${goalName}: ${bar} ${percent}% done—${analogy}. Keep the rupees marching!`,
    income: ({ goalName, recommendedAmount, bar, analogy }) => `${goalName}: add ₹${recommendedAmount} today? ${bar} ${analogy}. A quick transfer after income keeps momentum.`,
    recovery: ({ goalName, daysInactive, analogy }) => `${goalName} misses you. ${daysInactive} days pause—${analogy}. Reply YES to resume softly.`,
  },
  'hi-IN': {
    milestone: ({ goalName, percent, bar, analogy }) => `${goalName}: ${bar} ${percent}% poora—${analogy}. Thoda aur jodte rahiye!`,
    income: ({ goalName, recommendedAmount, bar, analogy }) => `${goalName}: aaj ₹${recommendedAmount} rakhen? ${bar} ${analogy}. Aamdani ke turant baad bhejna aasaan hota hai.`,
    recovery: ({ goalName, daysInactive, analogy }) => `${goalName} aapka intezar kar raha hai. ${daysInactive} din se ruk gaya—${analogy}. Bas ek YES bhej kar wapas shuru karein.`,
  },
};

const VOICE_TEMPLATES = {
  'en-IN': {
    milestone: ({ goalName, percent, analogy }) => `Goal ${goalName} is ${percent} percent ready, ${analogy}. Keep the gentle rhythm going.`,
    income: ({ goalName, recommendedAmount, analogy }) => `You just earned. Move ₹${recommendedAmount} to ${goalName}, ${analogy}. It keeps the flow steady.`,
    recovery: ({ goalName, daysInactive }) => `${goalName} has been quiet for ${daysInactive} days. Take a calming breath and rejoin when ready.`,
  },
  'hi-IN': {
    milestone: ({ goalName, percent, analogy }) => `${goalName} ka ${percent} pratishat tayyar, ${analogy}. Isi gati se badhte rahiye.`,
    income: ({ goalName, recommendedAmount, analogy }) => `Aamdani mili. ₹${recommendedAmount} ${goalName} me daaliye, ${analogy}. Gati bani rahegi.`,
    recovery: ({ goalName, daysInactive }) => `${goalName} pichhle ${daysInactive} din se shaant hai. Aram se lautna theek hai, jab dil kahe.`,
  },
};

class LocalizationProvider {
  constructor({ smsLimit = 160 } = {}) {
    this.smsLimit = smsLimit;
    this.defaultLocale = 'en-IN';
  }

  buildSms({ locale, type, payload }) {
    const resolved = this._resolveLocale(locale);
    const template = (SMS_TEMPLATES[resolved] || {})[type];
    if (!template) {
      throw new Error(`Missing SMS template for ${type}`);
    }
    const text = template({ ...payload, analogy: this._pickAnalogy(resolved, payload.percent || 0) });
    return {
      locale: resolved,
      text: this._enforceLimit(text, payload.trailingSignature),
    };
  }

  buildVoice({ locale, type, payload }) {
    const resolved = this._resolveLocale(locale);
    const template = (VOICE_TEMPLATES[resolved] || {})[type];
    if (!template) {
      throw new Error(`Missing voice template for ${type}`);
    }
    const script = template({ ...payload, analogy: this._pickAnalogy(resolved, payload.percent || 0) });
    return {
      locale: resolved,
      script,
      durationSec: Math.min(15, Math.max(7, Math.round(script.split(' ').length * 0.6))),
    };
  }

  _resolveLocale(locale) {
    if (locale && SMS_TEMPLATES[locale]) {
      return locale;
    }
    return this.defaultLocale;
  }

  _pickAnalogy(locale, percent = 0) {
    const bank = ANALOGIES[locale] || ANALOGIES[this.defaultLocale];
    const selected = bank.find((item) => percent <= item.threshold) || bank[bank.length - 1];
    return selected.text;
  }

  _enforceLimit(text, trailingSignature = '') {
    const signature = trailingSignature ? ` ${trailingSignature}` : '';
    const limit = this.smsLimit;
    const combined = `${text}${signature}`;
    if (combined.length <= limit) {
      return combined;
    }
    const allowed = limit - signature.length - 1;
    return `${combined.slice(0, allowed)}…${signature}`;
  }
}

module.exports = { LocalizationProvider };
