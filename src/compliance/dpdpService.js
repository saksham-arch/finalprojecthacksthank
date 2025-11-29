class DPDPService {
  constructor({ consentStore, warningStore, languagePacks } = {}) {
    this.consents = consentStore || new Map();
    this.warnings = warningStore || new Map();
    this.languagePacks = languagePacks || {
      en: {
        consent_request:
          'We protect your data. Reply YES to consent so we can store conversations for 90 days.',
        consent_pending:
          'Please provide consent before we share personalised financial tips.',
        deletion_warning:
          'Reminder: Your data will be deleted in 48 hours unless you reply KEEP.',
      },
      hi: {
        consent_request:
          'हम आपके डेटा की सुरक्षा करते हैं। बातचीत सहेजने की अनुमति देने के लिए YES भेजें।',
        consent_pending:
          'कृपया व्यक्तिगत सलाह के लिए पहले अनुमति दें।',
        deletion_warning:
          'स्मरण: आपका डेटा 48 घंटों में हट जाएगा, रखने के लिए KEEP भेजें।',
      },
    };
  }

  getLocalized(key, locale = 'en') {
    const lang = this.languagePacks[locale] ? locale : 'en';
    const fallback = this.languagePacks.en[key] || '';
    return this.languagePacks[lang][key] || fallback;
  }

  recordConsent(userId, { granted = true, locale = 'en' } = {}) {
    this.consents.set(userId, {
      granted,
      locale,
      grantedAt: new Date().toISOString(),
    });
  }

  getConsentStatus(userId) {
    return this.consents.get(userId);
  }

  async ensureConsent({ userId, locale, channelAdapter, destination }) {
    const status = this.getConsentStatus(userId);
    if (status?.granted) {
      return true;
    }
    const message = this.getLocalized('consent_request', locale);
    if (channelAdapter && destination) {
      await channelAdapter.sendSMS({ to: destination, body: message });
    }
    if (!status) {
      this.consents.set(userId, {
        granted: false,
        requestedAt: new Date().toISOString(),
        locale,
      });
    }
    return false;
  }

  async scheduleDeletionWarning({ userId, locale, channelAdapter, destination }) {
    const lastWarning = this.warnings.get(userId);
    const now = Date.now();
    if (lastWarning && now - lastWarning < 12 * 60 * 60 * 1000) {
      return false;
    }
    const message = this.getLocalized('deletion_warning', locale);
    if (channelAdapter && destination) {
      await channelAdapter.sendSMS({ to: destination, body: message });
    }
    this.warnings.set(userId, now);
    return true;
  }
}

module.exports = { DPDPService };
