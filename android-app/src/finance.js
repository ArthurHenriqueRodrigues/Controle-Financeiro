const EXPENSE_CATEGORIES = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Contas', 'Compras', 'Outros'];
const INCOME_CATEGORIES = ['Salário', 'Freelance', 'Investimentos', 'Reembolso', 'Outros'];

const DEFAULT_RATES = {
  Moradia: 18,
  Alimentação: 18,
  Transporte: 18,
  Saúde: 18,
  Educação: 18,
  Lazer: 18,
  Contas: 18,
  Compras: 18,
  Outros: 18,
};

const LEGACY_DEFAULT_RATES = {
  Moradia: 13,
  Alimentação: 22,
  Transporte: 28,
  Saúde: 16,
  Educação: 15,
  Lazer: 30,
  Contas: 24,
  Compras: 25,
  Outros: 20,
};

function normalizedRates(savedRates) {
  const rates = { ...DEFAULT_RATES };
  const isLegacyDefault = Object.entries(LEGACY_DEFAULT_RATES)
    .every(([category, value]) => Number(savedRates && savedRates[category]) === value);
  if (isLegacyDefault) return rates;
  Object.entries(savedRates || {}).forEach(([category, value]) => {
    if (Object.prototype.hasOwnProperty.call(rates, category) &&
      Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100) {
      rates[category] = Number(value);
    }
  });
  return rates;
}

const CATEGORY_GLYPHS = {
  Moradia: '⌂',
  Alimentação: '◇',
  Transporte: '↗',
  Saúde: '+',
  Educação: '▤',
  Lazer: '✳',
  Contas: 'ϟ',
  Compras: '□',
  Salário: '↓',
  Freelance: '✳',
  Investimentos: '↗',
  Reembolso: '↩',
  Outros: '•',
};

const CHART_COLORS = ['#35b98c', '#f0a08d', '#9185d4', '#e3b857', '#56a8c5', '#d989b4'];

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: `${month}-01`,
    end: isoDate(new Date(year, monthNumber, 0)),
  };
}

function shiftMonth(month, offset) {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthKey(new Date(year, monthNumber - 1 + offset, 1));
}

function prettyMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 15));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);
}

function shortDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(new Date(year, month - 1, day))
    .replace('.', '');
}

function createDemoState(now = new Date()) {
  const transactions = [];
  const samples = [
    ['Mercado Confiança', 'Alimentação', 486.32, 'expense', 'Cartão de crédito'],
    ['Aluguel', 'Moradia', 1450, 'expense', 'Pix'],
    ['Conta de energia', 'Contas', 174.86, 'expense', 'Boleto'],
    ['Posto Avenida', 'Transporte', 220, 'expense', 'Cartão de débito'],
    ['Farmácia São João', 'Saúde', 83.47, 'expense', 'Pix'],
    ['Cinema e jantar', 'Lazer', 138, 'expense', 'Cartão de crédito'],
    ['Salário professor (bruto, referência 40h)', 'Salário', 5130.63, 'income', 'Transferência'],
    ['Projeto extra', 'Freelance', 650, 'income', 'Pix'],
    ['Internet fibra', 'Contas', 109.9, 'expense', 'Boleto'],
  ];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    samples.forEach((sample, index) => {
      if (offset > 0 && index === 8) return;
      const monthDate = new Date(date.getFullYear(), date.getMonth(), 1);
      monthDate.setDate(Math.min([2, 4, 7, 10, 12, 16, 1, 21, 25][index], new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
      const multiplier = sample[3] === 'expense' && offset > 0
        ? 0.82 + ((offset + index) % 4) * 0.07
        : 1;
      transactions.push({
        id: `demo-${monthKey(date)}-${index}`,
        description: sample[0],
        category: sample[1],
        amount: Math.round(sample[2] * multiplier * 100) / 100,
        type: sample[3],
        payment: sample[4],
        date: isoDate(monthDate),
      });
    });
  }

  return { transactions, budget: 4200, rates: { ...DEFAULT_RATES } };
}

function inRange(transaction, start, end) {
  return transaction.date >= start && transaction.date <= end;
}

function sumTransactions(transactions) {
  return transactions.reduce((sum, transaction) => {
    sum[transaction.type] += Number(transaction.amount) || 0;
    sum.count += 1;
    return sum;
  }, { income: 0, expense: 0, count: 0 });
}

function taxFor(transaction, rates) {
  return transaction.type === 'expense'
    ? (Number(transaction.amount) || 0) * (Number(rates[transaction.category]) || 0) / 100
    : 0;
}

function taxTotal(transactions, rates) {
  return transactions.reduce((sum, transaction) => sum + taxFor(transaction, rates), 0);
}

function groupExpenses(transactions) {
  const groups = {};
  transactions.forEach(transaction => {
    if (transaction.type === 'expense') {
      groups[transaction.category] = (groups[transaction.category] || 0) + Number(transaction.amount);
    }
  });
  return Object.entries(groups).sort((a, b) => b[1] - a[1]);
}

function validTransaction(transaction) {
  return transaction
    && typeof transaction.id === 'string'
    && typeof transaction.description === 'string'
    && transaction.description.trim().length > 0
    && Number.isFinite(Number(transaction.amount))
    && Number(transaction.amount) > 0
    && ['income', 'expense'].includes(transaction.type)
    && typeof transaction.category === 'string'
    && typeof transaction.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(transaction.date);
}

module.exports = {
  CHART_COLORS,
  CATEGORY_GLYPHS,
  DEFAULT_RATES,
  normalizedRates,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  createDemoState,
  formatCurrency,
  groupExpenses,
  inRange,
  isoDate,
  monthBounds,
  monthKey,
  prettyMonth,
  shiftMonth,
  shortDate,
  sumTransactions,
  taxFor,
  taxTotal,
  validTransaction,
};
