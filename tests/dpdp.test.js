const { DPDPService } = require('../src/compliance/dpdpService');

describe('DPDPService', () => {
  it('captures consent before storage and supports localization', async () => {
    const adapter = { sendSMS: jest.fn().mockResolvedValue({ status: 'sent' }) };
    const dpdp = new DPDPService();

    const granted = await dpdp.ensureConsent({
      userId: 'user-consent',
      locale: 'hi',
      channelAdapter: adapter,
      destination: '+91123456',
    });

    expect(granted).toBe(false);
    expect(adapter.sendSMS).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('हम आपके डेटा की सुरक्षा') })
    );

    dpdp.recordConsent('user-consent', { granted: true, locale: 'hi' });
    const secondCheck = await dpdp.ensureConsent({
      userId: 'user-consent',
      locale: 'hi',
      channelAdapter: adapter,
      destination: '+91123456',
    });
    expect(secondCheck).toBe(true);
  });

  it('issues deletion warning with fallback messaging', async () => {
    const adapter = { sendSMS: jest.fn().mockResolvedValue({ status: 'sent' }) };
    const dpdp = new DPDPService();

    await dpdp.scheduleDeletionWarning({
      userId: 'user-delete',
      locale: 'ta',
      channelAdapter: adapter,
      destination: '+91123457',
    });

    expect(adapter.sendSMS).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('48 hours') })
    );
  });
});
