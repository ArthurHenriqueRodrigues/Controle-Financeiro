(() => {
  'use strict';

  const STORE_KEY = 'saldo-financeiro-v1';
  const DATABASE_NAME = 'saldo-financeiro-v2';
  const DATABASE_VERSION = 1;
  const DATABASE_STORE = 'app-state';
  const CATEGORIES = {
    expense: ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Contas', 'Compras', 'Outros'],
    income: ['Salário', 'Freelance', 'Investimentos', 'Reembolso', 'Outros']
  };
  const DEFAULT_RATES = {
    Moradia: 18,
    Alimentação: 18,
    Transporte: 18,
    Saúde: 18,
    Educação: 18,
    Lazer: 18,
    Contas: 18,
    Compras: 18,
    Outros: 18
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
    Outros: 20
  };
  const CATEGORY_SYMBOLS = {
    Moradia: '⌂', Alimentação: '◇', Transporte: '↗', Saúde: '+', Educação: '▤',
    Lazer: '✳', Contas: 'ϟ', Compras: '□', Salário: '↓', Freelance: '✳',
    Investimentos: '↗', Reembolso: '↩', Outros: '•'
  };
  const COLORS = ['#35b98c', '#f0a08d', '#9185d4', '#e3b857', '#56a8c5', '#d989b4'];
  const byId = id => document.getElementById(id);
  const currentDate = new Date();
  const monthString = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const isoDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  const dateLabel = value => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`)).replace('.', '');
  const monthLabel = value => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${value}-15T12:00:00`));
  const monthBounds = month => ({ start: `${month}-01`, end: `${month}-31` });
  const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let database;
  let persistenceMode = 'loading';

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

  function makeDemoData() {
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
      ['Internet fibra', 'Contas', 109.9, 'expense', 'Boleto']
    ];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - offset, 1);
      samples.forEach((sample, index) => {
        if (offset > 0 && index === 8) return;
        const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), Math.min([2, 4, 7, 10, 12, 16, 1, 21, 25][index], new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()));
        const seasonal = sample[3] === 'expense' ? (offset === 0 ? 1 : 0.82 + ((offset + index) % 4) * 0.07) : 1;
        transactions.push({ id: id(), description: sample[0], category: sample[1], amount: Math.round(sample[2] * seasonal * 100) / 100, type: sample[3], payment: sample[4], date: isoDate(date) });
      });
    }

    return { transactions, budget: 4200, rates: { ...DEFAULT_RATES }, userName: 'Marina', darkMode: false };
  }

  function normalizeSavedState(parsed) {
    if (!parsed || !Array.isArray(parsed.transactions)) throw new Error('Dados financeiros inválidos.');
    return {
      transactions: parsed.transactions.filter(tx => tx && typeof tx.id === 'string' && typeof tx.description === 'string' && Number.isFinite(Number(tx.amount)) && ['income', 'expense'].includes(tx.type) && typeof tx.date === 'string'),
      budget: Number.isFinite(Number(parsed.budget)) ? Math.max(0, Number(parsed.budget)) : 4200,
      rates: normalizedRates(parsed.rates),
      userName: typeof parsed.userName === 'string' && parsed.userName.trim() ? parsed.userName.trim().slice(0, 40) : 'Marina',
      darkMode: parsed.darkMode === true
    };
  }

  function readStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return makeDemoData();
      return normalizeSavedState(JSON.parse(raw));
    } catch (error) {
      console.error('Não foi possível carregar os dados financeiros salvos.', error);
      showToast('Não foi possível ler os dados salvos. Verifique o armazenamento do navegador.');
      return makeDemoData();
    }
  }

  let state = readStore();
  let selectedMonth = monthString(currentDate);
  let transactionSort = { field: 'date', direction: 'desc' };
  let toastTimer;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DATABASE_STORE)) {
          request.result.createObjectStore(DATABASE_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const opened = request.result;
        if (opened.objectStoreNames.contains(DATABASE_STORE)) {
          resolve(opened);
          return;
        }
        const upgrade = indexedDB.open(DATABASE_NAME, opened.version + 1);
        opened.close();
        upgrade.onupgradeneeded = () => {
          if (!upgrade.result.objectStoreNames.contains(DATABASE_STORE)) {
            upgrade.result.createObjectStore(DATABASE_STORE, { keyPath: 'id' });
          }
        };
        upgrade.onsuccess = () => resolve(upgrade.result);
        upgrade.onerror = () => reject(upgrade.error || new Error('Não foi possível preparar o banco local.'));
        upgrade.onblocked = () => reject(new Error('Feche outras abas do Saldo para preparar o banco local.'));
      };
      request.onerror = () => reject(request.error || new Error('Não foi possível abrir o banco local.'));
      request.onblocked = () => reject(new Error('O banco local está ocupado em outra aba.'));
    });
  }

  function readDatabaseState() {
    return new Promise((resolve, reject) => {
      const request = database.transaction(DATABASE_STORE, 'readonly')
        .objectStore(DATABASE_STORE)
        .get('current');
      request.onsuccess = () => resolve(request.result ? request.result.state : null);
      request.onerror = () => reject(request.error || new Error('Não foi possível ler o banco local.'));
    });
  }

  function writeDatabaseState(snapshot) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DATABASE_STORE, 'readwrite');
      transaction.objectStore(DATABASE_STORE).put({ id: 'current', state: snapshot });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Não foi possível gravar o banco local.'));
      transaction.onabort = () => reject(transaction.error || new Error('A gravação no banco local foi cancelada.'));
    });
  }

  async function initializePersistence() {
    let legacyData;
    try {
      database = await openDatabase();
      const savedState = await readDatabaseState();
      if (savedState) {
        state = normalizeSavedState(savedState);
      } else {
        const legacyRaw = localStorage.getItem(STORE_KEY);
        if (legacyRaw) {
          legacyData = normalizeSavedState(JSON.parse(legacyRaw));
          state = legacyData;
        }
        await writeDatabaseState(state);
        if (legacyRaw) {
          try {
            localStorage.removeItem(STORE_KEY);
          } catch (error) {
            console.error('Os dados foram migrados, mas a cópia antiga não pôde ser removida.', error);
          }
        }
      }
      persistenceMode = 'indexeddb';
    } catch (error) {
      console.error('Não foi possível inicializar o banco financeiro local.', error);
      database = null;
      persistenceMode = 'localStorage';
    }

    document.documentElement.classList.remove('storage-loading');
    applyTheme();
    applyUserName();
    renderAll();
    if (persistenceMode !== 'indexeddb') {
      showToast('O banco local não ficou disponível. Os dados serão salvos no armazenamento do navegador.');
    } else if (legacyData) {
      showToast('Seus dados antigos foram migrados para o banco local.');
    }
  }

  function save() {
    if (persistenceMode === 'loading') return false;
    if (persistenceMode === 'indexeddb' && database) {
      const snapshot = JSON.parse(JSON.stringify(state));
      writeDatabaseState(snapshot)
        .catch(error => {
          console.error('Não foi possível salvar no banco local.', error);
          try {
            localStorage.setItem(STORE_KEY, JSON.stringify(snapshot));
            persistenceMode = 'localStorage';
            showToast('Falha no banco local; seus dados foram salvos no armazenamento alternativo do navegador.');
          } catch (fallbackError) {
            console.error('Não foi possível salvar os dados no armazenamento alternativo.', fallbackError);
            showToast('Falha ao salvar. Exporte um backup JSON e verifique o espaço disponível.');
          }
        });
      return true;
    }
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Não foi possível salvar os dados financeiros.', error);
      showToast('Falha ao salvar. Verifique o espaço disponível no navegador.');
      return false;
    }
    return true;
  }

  function showToast(message) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function applyTheme() {
    document.body.classList.toggle('dark-mode', state.darkMode);
    document.documentElement.style.colorScheme = state.darkMode ? 'dark' : 'light';
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = state.darkMode ? '#111827' : '#101b2d';
    byId('darkModeInput').checked = state.darkMode;
    requestAnimationFrame(renderFlowChart);
  }

  function applyUserName() {
    const name = state.userName || 'Marina';
    state.userName = name;
    byId('userNameHeading').textContent = name;
    byId('openPreferences').textContent = Array.from(name.trim())[0].toLocaleUpperCase('pt-BR');
    byId('openPreferences').setAttribute('aria-label', `Perfil de ${name}; abrir preferências`);
    byId('userNameInput').value = name;
  }

  function inPeriod(tx, start, end) {
    return tx.date >= start && tx.date <= end;
  }

  function periodTransactions(start, end) {
    return state.transactions.filter(tx => inPeriod(tx, start, end));
  }

  function totals(transactions) {
    return transactions.reduce((result, tx) => {
      result[tx.type] += Number(tx.amount);
      result.count += 1;
      return result;
    }, { income: 0, expense: 0, count: 0 });
  }

  function taxAmount(tx) {
    if (tx.type !== 'expense') return 0;
    const rate = Number(state.rates[tx.category]) || 0;
    return Number(tx.amount) * rate / 100;
  }

  function totalTax(transactions) {
    return transactions.reduce((sum, tx) => sum + taxAmount(tx), 0);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function transactionIcon(tx) {
    const symbol = CATEGORY_SYMBOLS[tx.category] || (tx.type === 'income' ? '↓' : '•');
    return `<span class="transaction-symbol ${tx.type === 'expense' ? 'expense-symbol' : ''}">${symbol}</span>`;
  }

  function transactionRow(tx, includeActions = false) {
    const sign = tx.type === 'income' ? '+' : '−';
    const category = escapeHtml(tx.category);
    return `<tr>
      <td class="description-cell">${transactionIcon(tx)}<span>${escapeHtml(tx.description)}</span></td>
      <td><span class="category-tag">${category}</span></td>
      <td>${dateLabel(tx.date)}</td>
      ${includeActions ? `<td><span class="type-tag ${tx.type}">${tx.type === 'income' ? 'Receita' : 'Despesa'}</span></td>` : ''}
      <td class="amount-cell ${tx.type === 'income' ? 'income-amount' : ''}">${sign} ${money(tx.amount)}</td>
      ${includeActions ? `<td class="actions-cell"><button class="row-action" data-edit="${escapeHtml(tx.id)}" aria-label="Editar ${escapeHtml(tx.description)}" title="Editar">✎</button><button class="row-action delete" data-delete="${escapeHtml(tx.id)}" aria-label="Excluir ${escapeHtml(tx.description)}" title="Excluir">×</button></td>` : ''}
    </tr>`;
  }

  function categoryTotals(transactions) {
    const categories = {};
    transactions.filter(tx => tx.type === 'expense').forEach(tx => {
      categories[tx.category] = (categories[tx.category] || 0) + Number(tx.amount);
    });
    return Object.entries(categories).sort((a, b) => b[1] - a[1]);
  }

  function renderCategoryBars(target, transactions, limit = 5) {
    const categories = categoryTotals(transactions).slice(0, limit);
    if (!categories.length) {
      target.innerHTML = '<div class="category-empty">Nenhuma despesa neste período.</div>';
      return;
    }
    const max = categories[0][1] || 1;
    target.innerHTML = categories.map(([category, amount], index) => `<div class="category-row">
      <span>${escapeHtml(category)}</span><div class="category-track"><div class="category-fill" style="width:${Math.max(3, amount / max * 100)}%;background:${COLORS[index % COLORS.length]}"></div></div><strong>${money(amount)}</strong>
    </div>`).join('');
  }

  function renderDashboard() {
    const bounds = monthBounds(selectedMonth);
    const txs = periodTransactions(bounds.start, bounds.end);
    const total = totals(txs);
    const balance = total.income - total.expense;
    byId('balanceValue').textContent = money(balance);
    byId('incomeValue').textContent = money(total.income);
    byId('expenseValue').textContent = money(total.expense);
    byId('taxValue').textContent = money(totalTax(txs));
    byId('incomeCount').textContent = `${txs.filter(tx => tx.type === 'income').length} ${txs.filter(tx => tx.type === 'income').length === 1 ? 'entrada' : 'entradas'}`;
    byId('expenseCount').textContent = `${txs.filter(tx => tx.type === 'expense').length} ${txs.filter(tx => tx.type === 'expense').length === 1 ? 'saída' : 'saídas'}`;
    byId('balanceStatus').textContent = balance >= 0 ? 'Saldo positivo' : 'Saldo negativo';

    byId('budgetSpent').textContent = money(total.expense);
    byId('budgetLimit').textContent = money(state.budget);
    const percent = state.budget > 0 ? total.expense / state.budget * 100 : (total.expense > 0 ? 100 : 0);
    byId('budgetProgress').style.width = `${Math.min(percent, 100)}%`;
    byId('budgetProgress').classList.toggle('over', percent > 100);
    byId('budgetPercent').textContent = `${Math.round(percent)}% utilizado`;
    const remaining = state.budget - total.expense;
    byId('budgetRemaining').textContent = remaining >= 0 ? `${money(remaining)} disponíveis` : `${money(Math.abs(remaining))} acima do limite`;
    byId('budgetRemaining').classList.toggle('over-budget', remaining < 0);
    byId('budgetSpent').classList.toggle('over-budget', remaining < 0);
    byId('budgetPanel').classList.toggle('budget-exceeded', remaining < 0);
    renderCategoryBars(byId('categoryBars'), txs);

    const recent = [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 5);
    byId('recentRows').innerHTML = recent.length ? recent.map(tx => transactionRow(tx)).join('') : '<tr><td colspan="4" class="category-empty">Nenhum lançamento neste mês.</td></tr>';
    renderFlowChart();
  }

  function renderFlowChart() {
    const canvas = byId('flowChart');
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 10, right: 8, bottom: 25, left: 47 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const chartText = state.darkMode ? '#b4c0cf' : '#a0aab7';
    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)) - 1 - i, 1);
      const key = monthString(date);
      const bound = monthBounds(key);
      const values = totals(periodTransactions(bound.start, bound.end));
      months.push({ key, income: values.income, expense: values.expense, label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '') });
    }
    const maxValue = Math.max(...months.flatMap(item => [item.income, item.expense]), 1000) * 1.15;
    const y = value => padding.top + chartHeight - (value / maxValue) * chartHeight;
    context.font = '9px "DM Sans", sans-serif';
    context.textBaseline = 'middle';
    context.strokeStyle = state.darkMode ? '#303b4d' : '#eef1f4';
    context.fillStyle = chartText;
    context.lineWidth = 1;
    for (let i = 0; i < 4; i += 1) {
      const value = maxValue * (3 - i) / 3;
      const lineY = y(value);
      context.beginPath();
      context.moveTo(padding.left, lineY);
      context.lineTo(width - padding.right, lineY);
      context.stroke();
      context.textAlign = 'right';
      context.fillText(value >= 1000 ? `${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k` : String(Math.round(value)), padding.left - 8, lineY);
    }
    const groupWidth = chartWidth / months.length;
    const barWidth = Math.min(13, groupWidth * .25);
    months.forEach((item, index) => {
      const center = padding.left + groupWidth * (index + .5);
      const incomeY = y(item.income);
      const expenseY = y(item.expense);
      context.fillStyle = '#30b98a';
      context.beginPath();
      context.roundRect(center - barWidth - 2, incomeY, barWidth, Math.max(2, padding.top + chartHeight - incomeY), [4, 4, 0, 0]);
      context.fill();
      context.fillStyle = '#f1a08c';
      context.beginPath();
      context.roundRect(center + 2, expenseY, barWidth, Math.max(2, padding.top + chartHeight - expenseY), [4, 4, 0, 0]);
      context.fill();
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.fillStyle = chartText;
      context.fillText(item.label, center, height - padding.bottom + 9);
    });
    const current = months[months.length - 1];
    byId('chartTotal').textContent = `Saldo do mês: ${money(current.income - current.expense)}`;
  }

  function populateCategorySelect(select, type, selectedValue = '') {
    select.innerHTML = CATEGORIES[type].map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    if (selectedValue && CATEGORIES[type].includes(selectedValue)) select.value = selectedValue;
  }

  function renderCategoryFilter() {
    const select = byId('categoryFilter');
    const previous = select.value;
    const categories = [...new Set(state.transactions.map(tx => tx.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    select.innerHTML = '<option value="all">Todas as categorias</option>' + categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    select.value = categories.includes(previous) ? previous : 'all';
  }

  function renderTransactions() {
    renderCategoryFilter();
    const query = byId('searchTransactions').value.trim().toLocaleLowerCase('pt-BR');
    const type = byId('typeFilter').value;
    const category = byId('categoryFilter').value;
    const filtered = [...state.transactions].filter(tx => {
      const matchesQuery = !query || `${tx.description} ${tx.category} ${tx.payment || ''}`.toLocaleLowerCase('pt-BR').includes(query);
      return matchesQuery && (type === 'all' || tx.type === type) && (category === 'all' || tx.category === category);
    }).sort((a, b) => {
      const direction = transactionSort.direction === 'asc' ? 1 : -1;
      const primary = transactionSort.field === 'amount'
        ? (Number(a.amount) - Number(b.amount)) * direction
        : a.date.localeCompare(b.date) * direction;
      return primary || b.id.localeCompare(a.id);
    });
    byId('transactionRows').innerHTML = filtered.map(tx => transactionRow(tx, true)).join('');
    byId('emptyTransactions').classList.toggle('hidden', filtered.length > 0);
    byId('transactionRows').parentElement.classList.toggle('hidden', filtered.length === 0);
  }

  function renderRates() {
    byId('rateList').innerHTML = CATEGORIES.expense.map(category => `<label class="rate-item">
      <span>${escapeHtml(category)}</span><span class="rate-input-wrap"><input class="rate-input" type="number" min="0" max="100" step="0.1" value="${Number(state.rates[category] || 0).toFixed(1)}" data-rate="${escapeHtml(category)}" aria-label="Taxa estimada de ${escapeHtml(category)}">%</span>
    </label>`).join('');
  }

  function renderTaxes() {
    const bounds = monthBounds(selectedMonth);
    const txs = periodTransactions(bounds.start, bounds.end);
    const expenses = txs.filter(tx => tx.type === 'expense');
    const expenseSum = expenses.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const tax = totalTax(expenses);
    byId('taxPageTotal').textContent = money(tax);
    byId('taxPageBase').textContent = money(expenseSum);
    byId('taxRatio').textContent = `${expenseSum ? (tax / expenseSum * 100).toFixed(1).replace('.', ',') : '0,0'}% das despesas`;
    renderRates();
  }

  function renderReport() {
    const start = byId('reportStart').value;
    const end = byId('reportEnd').value;
    const txs = periodTransactions(start, end).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const result = totals(txs);
    const tax = totalTax(txs);
    const balance = result.income - result.expense;
    const annual = byId('reportMode').value === 'year';
    const year = byId('reportYear').value;
    const metrics = [
      ['Receitas', result.income, 'report-income'],
      ['Despesas', result.expense, 'report-expense'],
      ['Saldo do período', balance, balance >= 0 ? 'report-income' : 'report-expense'],
      ['ICMS simulado', tax, '']
    ];
    byId('reportMetrics').innerHTML = metrics.map(([label, amount, className]) => `<div class="report-metric"><span>${label}</span><strong class="${className}">${money(amount)}</strong></div>`).join('');
    byId('reportPeriodLabel').textContent = annual
      ? `${year} · ${txs.length} lançamento(s)`
      : `${new Intl.DateTimeFormat('pt-BR').format(new Date(`${start}T12:00:00`))} a ${new Intl.DateTimeFormat('pt-BR').format(new Date(`${end}T12:00:00`))} · ${txs.length} lançamento(s)`;
    byId('reportRows').innerHTML = txs.length ? txs.map(tx => transactionRow(tx, true).replace(/<td class="actions-cell">.*?<\/td>/, '')).join('') : '<tr><td colspan="5" class="category-empty">Nenhum lançamento no período.</td></tr>';
    renderCategoryBars(byId('reportCategoryBars'), txs, 9);
    byId('annualSummaryPanel').classList.toggle('hidden', !annual);
    if (annual) {
      byId('annualSummaryRows').innerHTML = Array.from({ length: 12 }, (_, index) => {
        const month = `${year}-${String(index + 1).padStart(2, '0')}`;
        const monthTotals = totals(txs.filter(tx => tx.date.startsWith(month)));
        return `<tr><td>${new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(Number(year), index, 1))}</td><td class="income-amount">${money(monthTotals.income)}</td><td>${money(monthTotals.expense)}</td><td class="${monthTotals.income >= monthTotals.expense ? 'report-income' : 'report-expense'}">${money(monthTotals.income - monthTotals.expense)}</td></tr>`;
      }).join('');
    }
    const expenses = txs.filter(tx => tx.type === 'expense');
    const byCategoryTax = {};
    expenses.forEach(tx => { byCategoryTax[tx.category] = (byCategoryTax[tx.category] || 0) + taxAmount(tx); });
    const topTax = Object.entries(byCategoryTax).sort((a, b) => b[1] - a[1]).slice(0, 4);
    byId('reportTaxSummary').innerHTML = `<div class="report-tax-stat"><span>Despesas consideradas</span><strong>${money(result.expense)}</strong></div><div class="report-tax-stat"><span>ICMS simulado</span><strong>${money(tax)}</strong></div>${topTax.map(([category, amount]) => `<div class="report-tax-stat"><span>${escapeHtml(category)}</span><strong>${money(amount)}</strong></div>`).join('')}`;
  }

  function lastDayOfMonth(month) {
    const [year, monthNumber] = month.split('-').map(Number);
    return `${month}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, '0')}`;
  }

  function updateReportPeriod() {
    const mode = byId('reportMode').value;
    byId('reportMonthField').classList.toggle('hidden', mode !== 'month');
    byId('reportYearField').classList.toggle('hidden', mode !== 'year');
    byId('reportCustomFields').classList.toggle('hidden', mode !== 'custom');

    if (mode === 'month') {
      const month = byId('reportMonth').value || selectedMonth;
      byId('reportMonth').value = month;
      byId('reportStart').value = `${month}-01`;
      byId('reportEnd').value = lastDayOfMonth(month);
    } else if (mode === 'year') {
      const year = byId('reportYear').value || String(currentDate.getFullYear());
      byId('reportYear').value = year;
      byId('reportStart').value = `${year}-01-01`;
      byId('reportEnd').value = `${year}-12-31`;
    }
  }

  function renderAll() {
    renderDashboard();
    renderTransactions();
    renderTaxes();
    renderReport();
  }

  function setPage(page) {
    const titles = { dashboard: 'Visão geral', transactions: 'Lançamentos', reports: 'Relatórios', taxes: 'Impostos' };
    document.querySelectorAll('.page-section').forEach(section => section.classList.remove('active'));
    byId(`${page}Page`).classList.add('active');
    document.querySelectorAll('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.page === page));
    document.querySelectorAll('.mobile-nav-link').forEach(button => button.classList.toggle('active', button.dataset.page === page));
    byId('pageTitle').textContent = titles[page];
    byId('sidebar').classList.remove('open');
    if (page === 'dashboard') requestAnimationFrame(renderFlowChart);
  }

  function openPreferences() {
    byId('userNameInput').value = state.userName || 'Marina';
    byId('darkModeInput').checked = state.darkMode;
    byId('preferencesModal').classList.remove('hidden');
  }

  function normalizeText(value) {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  }

  function addAssistantMessage(text, sender) {
    const message = document.createElement('div');
    message.className = `assistant-message ${sender === 'user' ? 'assistant-message-user' : 'assistant-message-bot'}`;
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    message.append(paragraph);
    byId('assistantMessages').append(message);
    byId('assistantMessages').scrollTop = byId('assistantMessages').scrollHeight;
  }

  function setTransactionFilters({ type = 'all', category = 'all', search = '' } = {}) {
    setPage('transactions');
    byId('typeFilter').value = type;
    byId('categoryFilter').value = category;
    byId('searchTransactions').value = search;
    renderTransactions();
  }

  function assistantAnswer(prompt) {
    const text = normalizeText(prompt);
    const bounds = monthBounds(selectedMonth);
    const monthTransactions = periodTransactions(bounds.start, bounds.end);
    const monthTotals = totals(monthTransactions);
    const monthName = monthLabel(selectedMonth);
    const categories = [...CATEGORIES.expense, ...CATEGORIES.income];
    const category = categories.find(item => text.includes(normalizeText(item)));

    if (/^(oi|ola|bom dia|boa tarde|boa noite|obrigad[oa])\b/.test(text)) {
      return 'Olá! Posso consultar seu saldo, receitas, despesas e categorias, além de filtrar ou ordenar a tabela de lançamentos.';
    }

    if (text.includes('comando') || text.includes('ajuda') || text.includes('o que voce faz') || text.includes('como funciona')) {
      return 'Comandos disponíveis:\n• “saldo”, “receitas”, “despesas”, “orçamento” e “impostos” para ver resumos de ' + monthName + ';\n• “maior gasto”, “maior despesa” ou “quanto gastei em Alimentação” para analisar categorias e lançamentos;\n• “mostre despesas”, “mostre receitas” ou “mostre despesas de Alimentação” para filtrar a tabela;\n• “buscar mercado” para procurar lançamentos pelo nome;\n• “organize por maior valor”, “menor valor” ou “mais recente” para ordenar;\n• “limpar filtros” para voltar à lista completa;\n• “editar Aluguel” para abrir um lançamento de nome exato;\n• “novo lançamento” e “alterar orçamento” para abrir os formulários;\n• “modo escuro” para alternar o tema;\n• “configurações” para alterar seu nome, tema e backup.';
    }

    if (text.includes('configuracao') || text.includes('preferencia') || text.includes('perfil')) {
      byId('userNameInput').value = state.userName || 'Marina';
      byId('darkModeInput').checked = state.darkMode;
      byId('preferencesModal').classList.remove('hidden');
      return 'Abri suas preferências. Você pode mudar seu nome, o tema e fazer backup ou restaurar seus dados.';
    }

    if (text.includes('modo escuro') || text.includes('tema escuro') || text.includes('modo claro')) {
      state.darkMode = !state.darkMode;
      if (save()) {
        applyTheme();
        return `Modo ${state.darkMode ? 'escuro' : 'claro'} ativado.`;
      }
      state.darkMode = !state.darkMode;
      return 'Não consegui salvar a preferência de tema. Verifique o armazenamento do navegador.';
    }

    if (text.includes('limpar') && (text.includes('filtro') || text.includes('tabela') || text.includes('busca'))) {
      transactionSort = { field: 'date', direction: 'desc' };
      setTransactionFilters();
      return 'Filtros removidos. A tabela mostra todos os lançamentos, dos mais recentes aos mais antigos.';
    }

    if (text.includes('novo lancamento') || text.includes('adicionar lancamento') || text.includes('incluir lancamento')) {
      openTransactionModal();
      return 'Abri o formulário de lançamento. Revise e salve os dados para adicioná-lo à tabela.';
    }

    if (text.includes('orcamento') && (text.includes('editar') || text.includes('alterar') || text.includes('mudar') || text.includes('definir'))) {
      byId('budgetInput').value = Number(state.budget).toFixed(2);
      byId('budgetModal').classList.remove('hidden');
      return 'Abri o orçamento mensal. Ajuste o limite e confirme em “Salvar limite”.';
    }

    if (text.startsWith('editar ') || text.startsWith('alterar lancamento ')) {
      const query = normalizeText(prompt.replace(/^(editar|alterar lancamento)\s+/i, ''));
      const matches = state.transactions.filter(tx => normalizeText(tx.description) === query);
      const selectedMonthMatches = matches.filter(tx => tx.date.startsWith(selectedMonth));
      const candidates = selectedMonthMatches.length ? selectedMonthMatches : matches;
      if (candidates.length === 1) {
        openTransactionModal(candidates[0]);
        return `Abri “${candidates[0].description}” para edição. Confira as informações e salve as alterações.`;
      }
      return candidates.length > 1
        ? 'Encontrei mais de um lançamento com essa descrição. Use a tabela para escolher o correto.'
        : 'Não encontrei essa descrição exata. Confira o nome na tabela ou peça para buscar parte do nome.';
    }

    if (text.includes('excluir') || text.includes('apagar') || text.includes('remover lancamento')) {
      return 'Para evitar excluir o item errado, filtre a tabela pelo nome e use o botão de exclusão do lançamento. O site pedirá confirmação antes de remover.';
    }

    if (text.includes('orcamento') || text.includes('limite')) {
      const spent = monthTotals.expense;
      const remaining = state.budget - spent;
      return `Em ${monthName}, você gastou ${money(spent)} de ${money(state.budget)} do limite mensal. ${remaining >= 0 ? `Restam ${money(remaining)}.` : `O limite foi ultrapassado em ${money(Math.abs(remaining))}.`}`;
    }

    if (text.includes('saldo')) {
      return `Seu saldo em ${monthName} é ${money(monthTotals.income - monthTotals.expense)}: ${money(monthTotals.income)} em receitas e ${money(monthTotals.expense)} em despesas.`;
    }

    if (category && (text.includes('quanto') || text.includes('total') || text.includes('gastei') || text.includes('gastos') || text.includes('recebi'))) {
      const categoryTransactions = monthTransactions.filter(tx => tx.category === category);
      const categoryTotal = categoryTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
      return `Em ${monthName}, há ${categoryTransactions.length} lançamento(s) em ${category}, somando ${money(categoryTotal)}.`;
    }

    if (text.includes('maior gasto') || text.includes('maiores gastos') || text.includes('onde mais gastei') || text.includes('categoria que mais')) {
      const largest = categoryTotals(monthTransactions)[0];
      if (!largest) return `Não há despesas registradas em ${monthName}.`;
      return `Sua maior categoria de despesas em ${monthName} é ${largest[0]}, com ${money(largest[1])}.`;
    }

    if (text.includes('maior lancamento') || text.includes('maior despesa') || text.includes('gasto mais alto')) {
      const largest = monthTransactions.filter(tx => tx.type === 'expense').sort((a, b) => b.amount - a.amount)[0];
      if (!largest) return `Não há despesas registradas em ${monthName}.`;
      return `A maior despesa em ${monthName} foi “${largest.description}”, de ${money(largest.amount)} (${largest.category}).`;
    }

    if (text.includes('imposto') || text.includes('tributo')) {
      return `A simulação de ICMS em ${monthName} soma ${money(totalTax(monthTransactions))}, usando as alíquotas configuradas por categoria. É uma referência simplificada, não um cálculo fiscal oficial.`;
    }

    const sortByAmount = text.includes('maior valor') || text.includes('maiores valores') || text.includes('mais caro') || text.includes('mais cara') || text.includes('maiores primeiro');
    const sortByLowestAmount = text.includes('menor valor') || text.includes('menores primeiro') || text.includes('mais barato');
    const sortByDate = text.includes('por data') || text.includes('mais recente') || text.includes('recentes primeiro');
    const wantsTable = text.includes('mostre') || text.includes('mostrar') || text.includes('filtre') || text.includes('filtrar') || text.includes('buscar') || text.includes('procure') || text.includes('orden') || text.includes('organize') || text.includes('tabela') || text.includes('lancamento');

    const typeFilterRequested = text.includes('receita') || text.includes('entrada') || text.includes('despesa') || text.includes('gasto');
    if (sortByAmount || sortByLowestAmount || sortByDate || ((category || typeFilterRequested) && wantsTable)) {
      transactionSort = sortByAmount
        ? { field: 'amount', direction: 'desc' }
        : sortByLowestAmount
          ? { field: 'amount', direction: 'asc' }
          : { field: 'date', direction: 'desc' };
      const type = text.includes('receita') || text.includes('entrada') ? 'income'
        : text.includes('despesa') || text.includes('gasto') ? 'expense' : 'all';
      setTransactionFilters({ type, category: category || 'all' });
      if (sortByAmount) return 'Tabela organizada do maior para o menor valor.';
      if (sortByLowestAmount) return 'Tabela organizada do menor para o maior valor.';
      if (category || type !== 'all') return `A tabela foi filtrada${type !== 'all' ? ` para ${type === 'income' ? 'receitas' : 'despesas'}` : ''}${category ? ` na categoria ${category}` : ''}.`;
      return 'Tabela organizada pelas datas mais recentes.';
    }

    const searchMatch = prompt.match(/^(?:buscar|procure|pesquise)\s+(.+)$/i);
    if (searchMatch) {
      transactionSort = { field: 'date', direction: 'desc' };
      setTransactionFilters({ search: searchMatch[1].trim() });
      return `A tabela está filtrada pela busca “${searchMatch[1].trim()}”.`;
    }

    if (wantsTable) {
      transactionSort = { field: 'date', direction: 'desc' };
      setTransactionFilters();
      return 'A tabela está exibindo todos os lançamentos, dos mais recentes aos mais antigos.';
    }

    if (text.includes('receita') || text.includes('entrada')) {
      return `Em ${monthName}, você teve ${money(monthTotals.income)} em receitas (${monthTransactions.filter(tx => tx.type === 'income').length} lançamento(s)).`;
    }

    if (text.includes('despesa') || text.includes('gastei') || text.includes('gastos')) {
      return `Em ${monthName}, você teve ${money(monthTotals.expense)} em despesas (${monthTransactions.filter(tx => tx.type === 'expense').length} lançamento(s)).`;
    }

    return 'Ainda não entendi esse pedido. Você pode perguntar sobre saldo, receitas, despesas, orçamento ou categorias, ou pedir “mostre despesas”, “buscar mercado” e “organize por maior valor”.';
  }

  function submitAssistantPrompt(prompt) {
    const value = prompt.trim();
    if (!value) return;
    addAssistantMessage(value, 'user');
    addAssistantMessage(assistantAnswer(value), 'bot');
    byId('assistantSuggestions').classList.add('hidden');
    byId('assistantInput').value = '';
  }

  function openTransactionModal(tx = null) {
    byId('transactionForm').reset();
    byId('transactionId').value = tx ? tx.id : '';
    byId('modalTitle').textContent = tx ? 'Editar lançamento' : 'Novo lançamento';
    byId('transactionType').value = tx ? tx.type : 'expense';
    populateCategorySelect(byId('transactionCategory'), byId('transactionType').value, tx ? tx.category : '');
    byId('descriptionInput').value = tx ? tx.description : '';
    byId('amountInput').value = tx ? Number(tx.amount).toFixed(2) : '';
    byId('dateInput').value = tx ? tx.date : isoDate(currentDate);
    byId('paymentInput').value = tx && tx.payment ? tx.payment : 'Pix';
    byId('transactionModal').classList.remove('hidden');
    window.setTimeout(() => byId('descriptionInput').focus(), 30);
  }

  function closeModals() {
    document.querySelectorAll('.modal-backdrop').forEach(modal => modal.classList.add('hidden'));
  }

  function toggleAssistant(open) {
    const panel = byId('assistantPanel');
    const isOpen = open === undefined ? panel.classList.contains('hidden') : open;
    panel.classList.toggle('hidden', !isOpen);
    byId('assistantToggle').setAttribute('aria-expanded', String(isOpen));
    if (isOpen) byId('assistantInput').focus();
  }

  function csvEscape(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
  }

  function downloadCsv() {
    const start = byId('reportStart').value;
    const end = byId('reportEnd').value;
    if (!start || !end || start > end) {
      showToast('Selecione um período válido antes de exportar.');
      return;
    }
    const transactions = periodTransactions(start, end).sort((a, b) => a.date.localeCompare(b.date));
    const lines = [['Data', 'Descrição', 'Tipo', 'Categoria', 'Forma de pagamento', 'Valor (BRL)', 'Imposto estimado (BRL)'].map(csvEscape).join(';')];
    transactions.forEach(tx => lines.push([tx.date, tx.description, tx.type === 'income' ? 'Receita' : 'Despesa', tx.category, tx.payment || '', Number(tx.amount).toFixed(2).replace('.', ','), taxAmount(tx).toFixed(2).replace('.', ',')].map(csvEscape).join(';')));
    let url;
    try {
      const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-financeiro-${start}-${end}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Arquivo CSV gerado para download.');
    } catch (error) {
      console.error('Não foi possível exportar o relatório CSV.', error);
      if (url) URL.revokeObjectURL(url);
      showToast('Não foi possível gerar o CSV neste navegador.');
    }
  }

  function downloadBackup() {
    let url;
    try {
      const backup = { format: 'saldo-backup-v1', exportedAt: new Date().toISOString(), ...state };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
      url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-saldo-${isoDate(currentDate)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Backup baixado neste aparelho.');
    } catch (error) {
      console.error('Não foi possível gerar o backup financeiro.', error);
      if (url) URL.revokeObjectURL(url);
      showToast('Não foi possível gerar o backup neste navegador.');
    }
  }

  function validateBackup(parsed) {
    if (!parsed || !Array.isArray(parsed.transactions)) throw new Error('O arquivo não contém uma lista de lançamentos.');
    if (!Number.isFinite(Number(parsed.budget)) || Number(parsed.budget) < 0) throw new Error('O limite de despesas do backup é inválido.');
    const ids = new Set();
    const transactions = parsed.transactions.map(tx => {
      const dateParts = typeof tx?.date === 'string' ? tx.date.split('-').map(Number) : [];
      const date = dateParts.length === 3 ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2]) : null;
      const validDate = date && date.getFullYear() === dateParts[0] && date.getMonth() === dateParts[1] - 1 && date.getDate() === dateParts[2];
      if (!tx || typeof tx.id !== 'string' || !tx.id || ids.has(tx.id) ||
        typeof tx.description !== 'string' || !tx.description.trim() ||
        !Number.isFinite(Number(tx.amount)) || Number(tx.amount) <= 0 ||
        !['income', 'expense'].includes(tx.type) ||
        typeof tx.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tx.date) ||
        !validDate) {
        throw new Error('Um ou mais lançamentos do backup são inválidos.');
      }
      ids.add(tx.id);
      return { ...tx, amount: Number(tx.amount), description: tx.description.trim() };
    });
    const rates = normalizedRates(parsed.rates);
    Object.entries(parsed.rates || {}).forEach(([category, value]) => {
      if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100) {
        throw new Error(`A taxa de ${category} precisa estar entre 0% e 100%.`);
      }
    });
    return {
      transactions,
      budget: Number(parsed.budget),
      rates,
      userName: typeof parsed.userName === 'string' && parsed.userName.trim() ? parsed.userName.trim().slice(0, 40) : 'Marina',
      darkMode: parsed.darkMode === true
    };
  }

  async function restoreBackup(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const restored = validateBackup(parsed);
      if (!window.confirm(`Restaurar este backup substituirá os ${state.transactions.length} lançamentos atuais por ${restored.transactions.length} lançamentos. Essa ação não pode ser desfeita. Continuar?`)) return;
      const previousState = state;
      state = restored;
      if (!save()) {
        state = previousState;
        return;
      }
      applyTheme();
      applyUserName();
      renderAll();
      showToast('Backup restaurado com sucesso.');
    } catch (error) {
      console.error('Não foi possível restaurar o backup financeiro.', error);
      showToast(`Backup não restaurado: ${error.message || 'arquivo inválido.'}`);
    } finally {
      byId('importBackup').value = '';
    }
  }

  function clearReportTransactions() {
    const start = byId('reportStart').value;
    const end = byId('reportEnd').value;
    if (!start || !end || start > end) {
      showToast('Selecione um período válido antes de apagar lançamentos.');
      return;
    }
    const transactionsToRemove = periodTransactions(start, end);
    if (!transactionsToRemove.length) {
      showToast('Não há lançamentos neste período.');
      return;
    }
    const confirmed = window.confirm(`Apagar permanentemente ${transactionsToRemove.length} lançamento(s) deste período? Os demais períodos serão mantidos.`);
    if (!confirmed) return;
    const previousTransactions = state.transactions;
    const removedIds = new Set(transactionsToRemove.map(tx => tx.id));
    state.transactions = state.transactions.filter(tx => !removedIds.has(tx.id));
    if (!save()) {
      state.transactions = previousTransactions;
      return;
    }
    renderAll();
    showToast(`${transactionsToRemove.length} lançamento(s) do período apagado(s).`);
  }

  let installPrompt = null;

  function isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function showInstallInstructions() {
    const instructions = byId('installInstructions');
    const agent = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      instructions.innerHTML = '<strong>No iPhone ou iPad</strong><ol><li>Abra esta página no Safari.</li><li>Toque em <b>Compartilhar</b> <span class="share-symbol">↑</span>.</li><li>Escolha <b>Adicionar à Tela de Início</b> e confirme em <b>Adicionar</b>.</li></ol>';
    } else if (/android/i.test(agent)) {
      instructions.innerHTML = '<strong>No Android</strong><ol><li>Abra esta página no Chrome.</li><li>Toque no menu <b>⋮</b> no canto superior.</li><li>Escolha <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b>.</li></ol>';
    } else {
      instructions.innerHTML = '<strong>No celular</strong><ol><li>Abra este endereço pelo navegador do aparelho.</li><li>Use o menu do navegador para <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b>.</li></ol>';
    }
    byId('installModal').classList.remove('hidden');
  }

  async function installApp() {
    if (isInstalled()) {
      showToast('O Saldo já está instalado neste aparelho.');
      return;
    }
    if (!installPrompt) {
      showInstallInstructions();
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        byId('installButtonText').textContent = 'Abrindo aplicativo';
        showToast('O Saldo está sendo instalado.');
      }
    } catch (error) {
      console.error('Não foi possível iniciar a instalação do aplicativo.', error);
      showToast('Não foi possível abrir a instalação. Use o menu do navegador.');
    }
  }

  function registerOfflineSupport() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext || window.location.protocol === 'file:') return;
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(registration => registration.update())
      .catch(error => {
        console.error('Não foi possível ativar o modo offline.', error);
        showToast('Não foi possível ativar o modo offline neste endereço.');
      });
  }

  document.querySelectorAll('.nav-link').forEach(button => button.addEventListener('click', () => setPage(button.dataset.page)));
  document.querySelectorAll('.mobile-nav-link').forEach(button => button.addEventListener('click', () => setPage(button.dataset.page)));
  document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => setPage(button.dataset.go)));
  byId('installApp').addEventListener('click', installApp);
  if (isInstalled()) {
    byId('installButtonText').textContent = 'Aplicativo instalado';
    byId('installApp').classList.add('installed');
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    byId('installButtonText').textContent = 'Instalar aplicativo';
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    byId('installButtonText').textContent = 'Aplicativo instalado';
    byId('installApp').classList.add('installed');
    showToast('Aplicativo instalado com sucesso.');
  });
  registerOfflineSupport();
  byId('monthPicker').value = selectedMonth;
  byId('monthPicker').addEventListener('change', event => {
    if (!event.target.value) return;
    selectedMonth = event.target.value;
    if (byId('reportMode').value === 'month') {
      byId('reportMonth').value = selectedMonth;
      updateReportPeriod();
    }
    renderAll();
  });
  byId('openPreferences').addEventListener('click', openPreferences);
  byId('openPreferencesSidebar').addEventListener('click', openPreferences);
  byId('preferencesForm').addEventListener('submit', event => {
    event.preventDefault();
    const userName = byId('userNameInput').value.trim();
    if (!userName) {
      showToast('Informe seu nome para salvar as preferências.');
      byId('userNameInput').focus();
      return;
    }
    const previous = { userName: state.userName, darkMode: state.darkMode };
    state.userName = userName;
    state.darkMode = byId('darkModeInput').checked;
    if (!save()) {
      Object.assign(state, previous);
      return;
    }
    applyTheme();
    applyUserName();
    closeModals();
    showToast('Preferências atualizadas.');
  });
  byId('exportBackup').addEventListener('click', downloadBackup);
  byId('chooseBackup').addEventListener('click', () => byId('importBackup').click());
  byId('importBackup').addEventListener('change', event => restoreBackup(event.target.files[0]));
  byId('addTransaction').addEventListener('click', () => openTransactionModal());
  byId('addTransactionSecondary').addEventListener('click', () => openTransactionModal());
  byId('transactionType').addEventListener('change', event => populateCategorySelect(byId('transactionCategory'), event.target.value));
  byId('transactionForm').addEventListener('submit', event => {
    event.preventDefault();
    const amount = Number(byId('amountInput').value);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Informe um valor maior que zero.');
      byId('amountInput').focus();
      return;
    }
    const tx = {
      id: byId('transactionId').value || id(),
      description: byId('descriptionInput').value.trim(),
      type: byId('transactionType').value,
      category: byId('transactionCategory').value,
      amount: Math.round(amount * 100) / 100,
      date: byId('dateInput').value,
      payment: byId('paymentInput').value
    };
    if (!tx.description || !tx.date) {
      showToast('Preencha a descrição e a data do lançamento.');
      return;
    }
    const previous = state.transactions.findIndex(item => item.id === tx.id);
    if (previous >= 0) state.transactions[previous] = tx;
    else state.transactions.push(tx);
    if (!save()) return;
    closeModals();
    renderAll();
    showToast(previous >= 0 ? 'Lançamento atualizado.' : 'Lançamento salvo.');
  });
  document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', closeModals));
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => {
    if (event.target === backdrop) closeModals();
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModals();
      toggleAssistant(false);
    }
  });
  byId('assistantToggle').addEventListener('click', () => toggleAssistant());
  byId('assistantClose').addEventListener('click', () => toggleAssistant(false));
  byId('assistantForm').addEventListener('submit', event => {
    event.preventDefault();
    submitAssistantPrompt(byId('assistantInput').value);
  });
  byId('assistantSuggestions').addEventListener('click', event => {
    const suggestion = event.target.closest('[data-assistant-prompt]');
    if (suggestion) submitAssistantPrompt(suggestion.dataset.assistantPrompt);
  });
  byId('editBudget').addEventListener('click', () => {
    byId('budgetInput').value = Number(state.budget).toFixed(2);
    byId('budgetModal').classList.remove('hidden');
  });
  byId('budgetForm').addEventListener('submit', event => {
    event.preventDefault();
    const budget = Number(byId('budgetInput').value);
    if (!Number.isFinite(budget) || budget < 0) {
      showToast('Informe um limite válido.');
      return;
    }
    state.budget = Math.round(budget * 100) / 100;
    if (!save()) return;
    closeModals();
    renderAll();
    showToast('Orçamento atualizado.');
  });
  byId('searchTransactions').addEventListener('input', renderTransactions);
  byId('typeFilter').addEventListener('change', renderTransactions);
  byId('categoryFilter').addEventListener('change', renderTransactions);
  byId('transactionRows').addEventListener('click', event => {
    const edit = event.target.closest('[data-edit]');
    const remove = event.target.closest('[data-delete]');
    if (edit) {
      const tx = state.transactions.find(item => item.id === edit.dataset.edit);
      if (tx) openTransactionModal(tx);
    } else if (remove) {
      const tx = state.transactions.find(item => item.id === remove.dataset.delete);
      if (tx && window.confirm(`Excluir o lançamento "${tx.description}"?`)) {
        state.transactions = state.transactions.filter(item => item.id !== tx.id);
        if (save()) {
          renderAll();
          showToast('Lançamento excluído.');
        }
      }
    }
  });
  byId('rateList').addEventListener('change', event => {
    const input = event.target.closest('[data-rate]');
    if (!input) return;
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      input.value = Number(state.rates[input.dataset.rate] || 0).toFixed(1);
      showToast('A taxa precisa estar entre 0% e 100%.');
      return;
    }
    state.rates[input.dataset.rate] = value;
    if (save()) {
      renderDashboard();
      renderTaxes();
      renderReport();
      showToast(`Estimativa de ${input.dataset.rate} atualizada.`);
    }
  });
  byId('resetRates').addEventListener('click', () => {
    if (!window.confirm('Restaurar os parâmetros ilustrativos originais?')) return;
    state.rates = { ...DEFAULT_RATES };
    if (save()) {
      renderAll();
      showToast('Parâmetros de exemplo restaurados.');
    }
  });
  byId('dashboardReport').addEventListener('click', () => setPage('reports'));
  byId('menuToggle').addEventListener('click', () => byId('sidebar').classList.toggle('open'));
  byId('printReport').addEventListener('click', () => window.print());
  byId('exportCsv').addEventListener('click', downloadCsv);
  byId('clearReportTransactions').addEventListener('click', clearReportTransactions);
  byId('reportMode').addEventListener('change', () => {
    updateReportPeriod();
    renderReport();
  });
  byId('reportMonth').addEventListener('change', () => {
    if (!byId('reportMonth').value) return;
    updateReportPeriod();
    renderReport();
  });
  byId('reportYear').addEventListener('change', () => {
    const year = Number(byId('reportYear').value);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      showToast('Escolha um ano entre 2000 e 2100.');
      return;
    }
    updateReportPeriod();
    renderReport();
  });
  byId('applyReport').addEventListener('click', () => {
    if (byId('reportMode').value === 'year') {
      const year = Number(byId('reportYear').value);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        showToast('Escolha um ano entre 2000 e 2100.');
        return;
      }
    }
    updateReportPeriod();
    if (!byId('reportStart').value || !byId('reportEnd').value || byId('reportStart').value > byId('reportEnd').value) {
      showToast('Informe um período válido, com a data inicial antes da final.');
      return;
    }
    renderReport();
  });

  const bounds = monthBounds(selectedMonth);
  byId('reportMode').value = 'month';
  byId('reportMonth').value = selectedMonth;
  byId('reportYear').value = String(currentDate.getFullYear());
  byId('reportStart').value = bounds.start;
  byId('reportEnd').value = `${selectedMonth}-${String(new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate()).padStart(2, '0')}`;
  byId('welcomeDate').textContent = `${monthLabel(selectedMonth).toLocaleUpperCase('pt-BR')} · SUAS FINANÇAS, EM UM SÓ LUGAR`;
  updateReportPeriod();
  document.documentElement.classList.add('storage-loading');
  initializePersistence();
  window.addEventListener('resize', () => requestAnimationFrame(renderFlowChart));
})();
