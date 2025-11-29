const { Guardrails } = require('../src/router/guardrails');

describe('Guardrails', () => {
  it('blocks risky financial advice with semantic checks and logs it', async () => {
    const auditLogger = { write: jest.fn().mockResolvedValue() };
    const guardrails = new Guardrails({ auditLogger });
    const riskyText = 'Consider leveraging debt for investment risk to chase returns';

    const result = await guardrails.enforce(riskyText, { userId: 'u1', channel: 'sms' });

    expect(result.action).toBe('blocked');
    expect(auditLogger.write).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'guardrail_block', userId: 'u1' })
    );
  });

  it('allows education-centric responses', async () => {
    const auditLogger = { write: jest.fn().mockResolvedValue() };
    const guardrails = new Guardrails({ auditLogger });

    const safe = await guardrails.enforce('Stick to your budget categories');
    expect(safe.action).toBe('allow');
    expect(auditLogger.write).not.toHaveBeenCalled();
  });
});
