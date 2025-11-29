class BudgetModule {
  handle({ entities = {}, prompt }) {
    const targetAmount = entities.amounts?.[0]?.value;
    const adviceAmount = targetAmount ? `Keep discretionary spend under ₹${targetAmount.toFixed(0)}.` : '';
    return `Budget watch: ${adviceAmount} ${prompt ? `Context ${prompt}` : ''}`.trim();
  }
}

module.exports = { BudgetModule };
