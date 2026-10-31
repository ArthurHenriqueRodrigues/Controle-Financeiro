import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from './FinanceContext';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  CHART_COLORS,
  CATEGORY_GLYPHS,
  DEFAULT_RATES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  formatCurrency,
  groupExpenses,
  inRange,
  isoDate,
  monthBounds,
  prettyMonth,
  shiftMonth,
  shortDate,
  sumTransactions,
  taxFor,
  taxTotal,
  validTransaction,
} from './finance';
import { styles } from './ui';

const LEGAL_REFERENCES = [
  {
    label: 'FEDERAL · LC 87/1996',
    title: 'ICMS · regras gerais',
    detail: 'Lei Complementar nº 87/1996',
    url: 'https://github.com/ctresb/leis/blob/main/federal/leis-complementares/1996/lcp-87-1996-09-13.md',
  },
  {
    label: 'FEDERAL · LC 116/2003',
    title: 'ISS · serviços',
    detail: 'Lei Complementar nº 116/2003',
    url: 'https://github.com/ctresb/leis/blob/main/federal/leis-complementares/2003/lcp-116-2003-07-31.md',
  },
  {
    label: 'ESTADUAL · SP',
    title: 'ICMS em São Paulo',
    detail: 'Lei estadual nº 6.374/1989',
    url: 'https://www.al.sp.gov.br/norma/25030',
  },
  {
    label: 'FEDERAL · LC 214/2025',
    title: 'IBS, CBS e Imposto Seletivo',
    detail: 'Reforma dos tributos sobre o consumo',
    url: 'https://github.com/ctresb/leis/tree/main/federal/leis-complementares/2025',
  },
];

const PAYMENTS = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Transferência', 'Boleto', 'Outro'];
const NAVY = '#101b2d';
const GREEN = '#168d68';
const MUTED = '#8490a2';
const WHITE = '#ffffff';
const PURPLE = '#8076bf';

function moneyInput(value) {
  const parsed = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

function transactionId() {
  return `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function AppCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Eyebrow({ children }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

function SectionTitle({ title, subtitle, action }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.flexOne}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

function PrimaryButton({ label, onPress, compact = false }) {
  return (
    <Pressable onPress={onPress} style={[styles.primaryButton, compact && styles.compactButton]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function MonthControl({ month, onChange }) {
  return (
    <View style={styles.monthPicker}>
      <Pressable accessibilityLabel="Mês anterior" onPress={() => onChange(-1)} style={styles.monthArrow}>
        <Text style={styles.monthArrowText}>‹</Text>
      </Pressable>
      <Text numberOfLines={1} style={styles.monthLabel}>{prettyMonth(month)}</Text>
      <Pressable accessibilityLabel="Próximo mês" onPress={() => onChange(1)} style={styles.monthArrow}>
        <Text style={styles.monthArrowText}>›</Text>
      </Pressable>
    </View>
  );
}

function Chip({ label, active, onPress, tint }) {
  return (
    <Pressable onPress={onPress} style={[
      styles.chip,
      active && styles.chipSelected,
      active && tint ? { backgroundColor: tint, borderColor: tint } : null,
    ]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Chips({ options, selected, onSelect, tint, inline = false }) {
  return (
    <View style={inline ? styles.inlineChipGroup : styles.chipRow}>
      {options.map(option => {
        const value = typeof option === 'string' ? option : option.value;
        const label = typeof option === 'string' ? option : option.label;
        return (
          <Chip
            active={selected === value}
            key={value}
            label={label}
            onPress={() => onSelect(value)}
            tint={tint}
          />
        );
      })}
    </View>
  );
}

function MoneyInput({ value, onChangeText }) {
  return (
    <View style={styles.amountInputShell}>
      <Text style={styles.amountPrefix}>R$</Text>
      <TextInput
        accessibilityLabel="Valor em reais"
        keyboardType="decimal-pad"
        maxLength={14}
        onChangeText={onChangeText}
        placeholder="0,00"
        placeholderTextColor={MUTED}
        style={styles.amountInput}
        value={value}
      />
    </View>
  );
}

function SummaryCard({ label, value, glyph, kind, footer }) {
  const balance = kind === 'balance';
  return (
    <AppCard style={[styles.summaryCard, balance && styles.balanceCard]}>
      <View style={styles.between}>
        <Text style={[styles.summaryLabel, balance && styles.balanceMuted]}>{label}</Text>
        <Text style={[styles.summaryGlyph, styles[`summaryGlyph_${kind}`]]}>{glyph}</Text>
      </View>
      <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={[styles.summaryValue, balance && styles.balanceText]}>{value}</Text>
      <Text numberOfLines={2} style={[styles.summaryFooter, balance && styles.balanceMuted]}>{footer}</Text>
    </AppCard>
  );
}

function MetricCard({ label, value, kind }) {
  return (
    <AppCard style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.76} numberOfLines={1} style={[
        styles.metricValue,
        kind === 'income' ? styles.incomeAmount : null,
        kind === 'expense' ? styles.deleteText : null,
        kind === 'tax' ? styles.taxMetric : null,
      ]}>{value}</Text>
    </AppCard>
  );
}

function CategoryBars({ transactions, limit = 5 }) {
  const groups = groupExpenses(transactions).slice(0, limit);
  if (!groups.length) return <Text style={styles.emptyCopy}>Nenhuma despesa neste período.</Text>;
  const maximum = groups[0][1] || 1;
  return (
    <View style={styles.categoryBars}>
      {groups.map(([category, amount], index) => (
        <View key={category} style={styles.categoryBarRow}>
          <Text numberOfLines={1} style={styles.categoryBarLabel}>{category}</Text>
          <View style={styles.categoryBarTrack}>
            <View style={[
              styles.categoryBarFill,
              { width: `${Math.max(3, amount / maximum * 100)}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] },
            ]} />
          </View>
          <Text style={styles.categoryBarAmount}>{formatCurrency(amount)}</Text>
        </View>
      ))}
    </View>
  );
}

function TransactionRow({ transaction, onEdit, onDelete }) {
  const income = transaction.type === 'income';
  return (
    <View style={styles.transactionRow}>
      <View style={[styles.transactionIcon, income ? styles.transactionIconIncome : styles.transactionIconExpense]}>
        <Text style={styles.transactionIconText}>{CATEGORY_GLYPHS[transaction.category] || '•'}</Text>
      </View>
      <View style={styles.flexOne}>
        <Text numberOfLines={1} style={styles.transactionName}>{transaction.description}</Text>
        <Text style={styles.transactionDetails}>{transaction.category} · {shortDate(transaction.date)}</Text>
      </View>
      <View style={styles.transactionAmountBlock}>
        <Text style={[styles.transactionAmount, income && styles.incomeAmount]}>
          {income ? '+' : '−'} {formatCurrency(transaction.amount)}
        </Text>
        {onEdit && onDelete ? (
          <View style={styles.rowActions}>
            <Pressable accessibilityLabel={`Editar ${transaction.description}`} hitSlop={8} onPress={() => onEdit(transaction)} style={styles.rowAction}>
              <Text style={styles.rowActionText}>Editar</Text>
            </Pressable>
            <Pressable accessibilityLabel={`Excluir ${transaction.description}`} hitSlop={8} onPress={() => onDelete(transaction)} style={styles.rowAction}>
              <Text style={[styles.rowActionText, styles.deleteText]}>Excluir</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function FinanceModal({ kind, form, setForm, onClose, onSave, budget }) {
  const insets = useSafeAreaInsets();
  const [budgetText, setBudgetText] = useState(String(Number(budget).toFixed(2)).replace('.', ','));

  useEffect(() => {
    setBudgetText(String(Number(budget).toFixed(2)).replace('.', ','));
  }, [budget, kind]);

  if (!kind || (kind === 'transaction' && !form)) return null;

  const updateForm = (field, value) => setForm(previous => ({ ...previous, [field]: value }));
  const type = form?.type || 'expense';
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const transactionModal = kind === 'transaction';

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <View style={styles.modalScrim}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboard}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 22) }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeading}>
              <View style={styles.flexOne}>
                <Eyebrow>{transactionModal ? 'MOVIMENTAÇÃO FINANCEIRA' : 'PLANEJAMENTO'}</Eyebrow>
                <Text style={styles.modalTitle}>
                  {transactionModal ? (form.id ? 'Editar lançamento' : 'Novo lançamento') : 'Orçamento do mês'}
                </Text>
              </View>
              <Pressable accessibilityLabel="Fechar" onPress={onClose} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>×</Text>
              </Pressable>
            </View>

            {transactionModal ? (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                <Text style={styles.formLabel}>Descrição</Text>
                <TextInput maxLength={80} onChangeText={value => updateForm('description', value)} placeholder="Ex.: Conta de energia" style={styles.textInput} value={form.description} />

                <Text style={styles.formLabel}>Tipo</Text>
                <Chips
                  inline
                  options={[{ label: 'Despesa', value: 'expense' }, { label: 'Receita', value: 'income' }]}
                  selected={form.type}
                  onSelect={value => setForm(previous => ({
                    ...previous,
                    type: value,
                    category: (value === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0],
                  }))}
                />

                <Text style={styles.formLabel}>Categoria</Text>
                <Chips inline options={categories} selected={form.category} onSelect={value => updateForm('category', value)} />

                <Text style={styles.formLabel}>Valor</Text>
                <MoneyInput onChangeText={value => updateForm('amountText', value)} value={form.amountText} />

                <Text style={styles.formLabel}>Data · AAAA-MM-DD</Text>
                <TextInput autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={value => updateForm('date', value)} style={styles.textInput} value={form.date} />

                <Text style={styles.formLabel}>Forma de pagamento</Text>
                <Chips inline options={PAYMENTS} selected={form.payment} onSelect={value => updateForm('payment', value)} />

                <View style={styles.modalActions}>
                  <Pressable onPress={onClose} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancelar</Text></Pressable>
                  <PrimaryButton label="Salvar lançamento" onPress={onSave} />
                </View>
              </ScrollView>
            ) : (
              <>
                <Text style={styles.formLabel}>Limite mensal de despesas</Text>
                <MoneyInput onChangeText={setBudgetText} value={budgetText} />
                <Text style={styles.formHint}>O indicador compara as despesas lançadas neste mês com o limite definido.</Text>
                <View style={styles.modalActions}>
                  <Pressable onPress={onClose} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancelar</Text></Pressable>
                  <PrimaryButton label="Salvar limite" onPress={() => onSave(moneyInput(budgetText))} />
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function FinanceScreen({ page }) {
  const insets = useSafeAreaInsets();
  const { data, setData, month, setMonth } = useFinance();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(null);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [reportStart, setReportStart] = useState(() => monthBounds(month).start);
  const [reportEnd, setReportEnd] = useState(() => monthBounds(month).end);
  const [period, setPeriod] = useState(() => monthBounds(month));
  const [rateDraft, setRateDraft] = useState(() => ({ ...data.rates }));

  const monthRange = useMemo(() => monthBounds(month), [month]);
  const monthTransactions = useMemo(
    () => data.transactions.filter(transaction => inRange(transaction, monthRange.start, monthRange.end)),
    [data.transactions, monthRange],
  );
  const monthTotals = useMemo(() => sumTransactions(monthTransactions), [monthTransactions]);
  const monthBalance = monthTotals.income - monthTotals.expense;
  const monthTax = taxTotal(monthTransactions, data.rates);

  const reportTransactions = useMemo(
    () => data.transactions
      .filter(transaction => inRange(transaction, period.start, period.end))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [data.transactions, period],
  );
  const reportTotals = useMemo(() => sumTransactions(reportTransactions), [reportTransactions]);
  const reportTax = taxTotal(reportTransactions, data.rates);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return [...data.transactions].filter(transaction => {
      const matchesSearch = !query
        || `${transaction.description} ${transaction.category} ${transaction.payment || ''}`
          .toLocaleLowerCase('pt-BR').includes(query);
      return matchesSearch
        && (typeFilter === 'all' || transaction.type === typeFilter)
        && (categoryFilter === 'all' || transaction.category === categoryFilter);
    }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [data.transactions, search, typeFilter, categoryFilter]);

  useEffect(() => {
    setRateDraft({ ...data.rates });
  }, [data.rates]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  function changeMonth(offset) {
    const next = shiftMonth(month, offset);
    setMonth(next);
    const range = monthBounds(next);
    setReportStart(range.start);
    setReportEnd(range.end);
    setPeriod(range);
  }

  function openTransaction(transaction) {
    setForm(transaction ? {
      ...transaction,
      amountText: String(Number(transaction.amount).toFixed(2)).replace('.', ','),
    } : {
      id: '',
      description: '',
      type: 'expense',
      category: EXPENSE_CATEGORIES[0],
      amount: 0,
      amountText: '',
      date: isoDate(new Date()),
      payment: 'Pix',
    });
    setModal('transaction');
  }

  function saveTransaction() {
    if (!form) return;
    const transaction = {
      id: form.id || transactionId(),
      description: form.description.trim(),
      type: form.type,
      category: form.category,
      amount: moneyInput(form.amountText),
      date: form.date.trim(),
      payment: form.payment || 'Pix',
    };
    if (!validTransaction(transaction)) {
      Alert.alert('Confira o lançamento', 'Informe descrição, valor maior que zero e uma data no formato AAAA-MM-DD.');
      return;
    }
    setData(previous => {
      const exists = previous.transactions.some(item => item.id === transaction.id);
      return {
        ...previous,
        transactions: exists
          ? previous.transactions.map(item => item.id === transaction.id ? transaction : item)
          : [...previous.transactions, transaction],
      };
    });
    setModal(null);
    setForm(null);
    setToast(form.id ? 'Lançamento atualizado.' : 'Lançamento salvo.');
  }

  function deleteTransaction(transaction) {
    Alert.alert('Excluir lançamento?', `“${transaction.description}” será removido permanentemente.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          setData(previous => ({
            ...previous,
            transactions: previous.transactions.filter(item => item.id !== transaction.id),
          }));
          setToast('Lançamento excluído.');
        },
      },
    ]);
  }

  function saveBudget(budget) {
    if (!Number.isFinite(budget) || budget <= 0) {
      Alert.alert('Limite inválido', 'Informe um orçamento mensal maior que zero.');
      return;
    }
    setData(previous => ({ ...previous, budget }));
    setModal(null);
    setToast('Orçamento atualizado.');
  }

  function saveRate(category) {
    const rate = Number(String(rateDraft[category] ?? '').replace(',', '.'));
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      setRateDraft(previous => ({ ...previous, [category]: data.rates[category] }));
      Alert.alert('Percentual inválido', 'Use um valor entre 0% e 100%.');
      return;
    }
    setData(previous => ({ ...previous, rates: { ...previous.rates, [category]: rate } }));
  }

  function resetRates() {
    Alert.alert('Restaurar parâmetros?', 'As taxas editadas voltarão aos valores ilustrativos de exemplo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Restaurar',
        onPress: () => {
          setData(previous => ({ ...previous, rates: { ...DEFAULT_RATES } }));
          setToast('Taxas de exemplo restauradas.');
        },
      },
    ]);
  }

  function applyReportPeriod() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportStart) || !/^\d{4}-\d{2}-\d{2}$/.test(reportEnd) || reportStart > reportEnd) {
      Alert.alert('Período inválido', 'Use datas AAAA-MM-DD e escolha a data inicial antes da data final.');
      return;
    }
    setPeriod({ start: reportStart, end: reportEnd });
    Keyboard.dismiss();
    setToast('Relatório atualizado.');
  }

  function changeReportMonth(offset) {
    const monthStart = /^\d{4}-\d{2}-\d{2}$/.test(reportStart) ? reportStart : isoDate(new Date());
    const selected = shiftMonth(monthStart.slice(0, 7), offset);
    const bounds = monthBounds(selected);
    setReportStart(bounds.start);
    setReportEnd(bounds.end);
    setPeriod(bounds);
  }

  async function exportBackup() {
    try {
      const backup = {
        format: 'saldo-backup-v1',
        exportedAt: new Date().toISOString(),
        ...data,
      };
      const filename = `backup-saldo-${isoDate(new Date())}.json`;
      const file = new File(Paths.cache, filename);
      if (file.exists) file.delete();
      file.create();
      await file.write(JSON.stringify(backup, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Salvar backup financeiro',
        });
      } else {
        Alert.alert('Compartilhamento indisponível', 'O arquivo JSON foi gerado, mas este aparelho não oferece opções para compartilhá-lo.');
      }
    } catch (error) {
      console.error('Não foi possível gerar o backup financeiro.', error);
      Alert.alert('Falha no backup', 'O arquivo JSON não pôde ser criado ou compartilhado. Tente novamente.');
    }
  }

  async function importBackup() {
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ['application/json'] });
      if (picked.canceled) return;
      const parsed = JSON.parse(await picked.result.text());
      if (!parsed || !Array.isArray(parsed.transactions)) {
        throw new Error('O arquivo não contém uma lista de lançamentos.');
      }
      if (!Number.isFinite(Number(parsed.budget)) || Number(parsed.budget) < 0) {
        throw new Error('O limite mensal do backup é inválido.');
      }
      const ids = new Set();
      const transactions = parsed.transactions.map(transaction => {
        if (!validTransaction(transaction) || ids.has(transaction.id)) {
          throw new Error('O backup contém lançamentos inválidos ou repetidos.');
        }
        ids.add(transaction.id);
        return { ...transaction, amount: Number(transaction.amount) };
      });
      const rates = { ...DEFAULT_RATES };
      Object.entries(parsed.rates || {}).forEach(([category, value]) => {
        if (Object.prototype.hasOwnProperty.call(rates, category)) {
          if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100) {
            throw new Error(`A alíquota de ${category} precisa estar entre 0% e 100%.`);
          }
          rates[category] = Number(value);
        }
      });
      Alert.alert(
        'Restaurar backup JSON?',
        `Esta ação substituirá os ${data.transactions.length} lançamentos atuais por ${transactions.length} lançamentos.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Restaurar',
            style: 'destructive',
            onPress: () => {
              setData(previous => ({
                ...previous,
                transactions,
                budget: Number(parsed.budget),
                rates,
              }));
              setToast('Backup JSON restaurado.');
            },
          },
        ],
      );
    } catch (error) {
      if (error.code === 'ERR_DOCUMENT_PICKER_CANCELED') return;
      console.error('Não foi possível restaurar o backup financeiro.', error);
      Alert.alert('Backup não restaurado', error.message || 'O arquivo JSON é inválido.');
    }
  }

  async function exportCsv() {
    const quote = value => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [
      ['Data', 'Descrição', 'Tipo', 'Categoria', 'Forma de pagamento', 'Valor (BRL)', 'Imposto estimado (BRL)'],
      ...reportTransactions.map(transaction => [
        transaction.date,
        transaction.description,
        transaction.type === 'income' ? 'Receita' : 'Despesa',
        transaction.category,
        transaction.payment || '',
        Number(transaction.amount).toFixed(2).replace('.', ','),
        taxFor(transaction, data.rates).toFixed(2).replace('.', ','),
      ]),
    ].map(row => row.map(quote).join(';')).join('\r\n');

    try {
      const filename = `saldo-relatorio-${period.start}-${period.end}.csv`;
      const file = new File(Paths.cache, filename);
      if (file.exists) file.delete();
      file.create();
      await file.write(`\ufeff${rows}`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Compartilhar relatório financeiro' });
      } else {
        Alert.alert('Compartilhamento indisponível', 'Este aparelho não oferece opções para compartilhar arquivos.');
      }
    } catch (error) {
      console.error('Não foi possível gerar ou compartilhar o relatório CSV.', error);
      Alert.alert('Falha na exportação', 'O CSV não pôde ser criado ou compartilhado. Tente novamente.');
    }
  }

  async function exportPdf() {
    const rows = reportTransactions.map(transaction => `
      <tr>
        <td>${escapeHtml(transaction.date)}</td>
        <td>${escapeHtml(transaction.description)}</td>
        <td>${escapeHtml(transaction.category)}</td>
        <td>${transaction.type === 'income' ? 'Receita' : 'Despesa'}</td>
        <td>${escapeHtml(formatCurrency(transaction.amount))}</td>
      </tr>`).join('');
    const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
      body{font-family:Arial,sans-serif;color:#172338;padding:28px}h1{font-size:24px;margin-bottom:6px}.muted{color:#7d899a;font-size:12px}
      .summary{display:flex;gap:12px;margin:22px 0}.metric{border:1px solid #e8ebef;border-radius:8px;padding:12px;flex:1}
      .metric small{display:block;color:#788598;font-size:11px}.metric b{display:block;font-size:16px;margin-top:8px}
      table{border-collapse:collapse;width:100%;font-size:11px}th,td{text-align:left;padding:9px 5px;border-bottom:1px solid #e9edf2}th{color:#788598}
      .disclaimer{font-size:10px;color:#7d899a;line-height:1.55;margin-top:22px}
      </style></head><body><h1>Saldo · Relatório financeiro</h1>
      <p class="muted">São Paulo · Período ${escapeHtml(period.start)} a ${escapeHtml(period.end)}</p>
      <div class="summary"><div class="metric"><small>Receitas</small><b>${formatCurrency(reportTotals.income)}</b></div>
      <div class="metric"><small>Despesas</small><b>${formatCurrency(reportTotals.expense)}</b></div>
      <div class="metric"><small>Saldo</small><b>${formatCurrency(reportTotals.income - reportTotals.expense)}</b></div>
      <div class="metric"><small>ICMS simulado</small><b>${formatCurrency(reportTax)}</b></div></div>
      <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="disclaimer">A estimativa tributária é meramente ilustrativa e não representa apuração fiscal. Confirme a legislação aplicável e consulte orientação contábil.</p></body></html>`;

    try {
      const result = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar relatório PDF' });
      } else {
        await Print.printAsync({ html });
      }
    } catch (error) {
      console.error('Não foi possível gerar ou compartilhar o relatório PDF.', error);
      Alert.alert('Falha na exportação', 'O PDF não pôde ser criado ou compartilhado. Tente novamente.');
    }
  }

  async function openReference(url) {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Não foi possível abrir a referência legal.', error);
      Alert.alert('Não foi possível abrir o link', 'Confira sua conexão com a internet e tente novamente.');
    }
  }

  function pageHeading(label, title, description, action) {
    return (
      <View style={styles.pageHeading}>
        <View style={styles.flexOne}>
          <Eyebrow>{label}</Eyebrow>
          <Text style={styles.pageTitle}>{title}</Text>
          <Text style={styles.pageDescription}>{description}</Text>
        </View>
        {action}
      </View>
    );
  }

  function dashboard() {
    const percent = data.budget > 0
      ? monthTotals.expense / data.budget * 100
      : (monthTotals.expense > 0 ? 100 : 0);
    const remaining = data.budget - monthTotals.expense;
    const months = Array.from({ length: 6 }, (_, index) => shiftMonth(month, index - 5));
    const chart = months.map(item => {
      const bounds = monthBounds(item);
      return {
        month: item,
        ...sumTransactions(data.transactions.filter(transaction => inRange(transaction, bounds.start, bounds.end))),
      };
    });
    const max = Math.max(1, ...chart.flatMap(item => [item.income, item.expense]));
    const recent = [...monthTransactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    return (
      <>
        {pageHeading('FINANÇAS PESSOAIS · SÃO PAULO', 'Suas finanças', 'Acompanhe seu dinheiro com clareza.')}
        <View style={styles.summaryGrid}>
          <SummaryCard label="Saldo do mês" value={formatCurrency(monthBalance)} glyph="↗" kind="balance" footer={monthBalance >= 0 ? 'Saldo positivo' : 'Saldo negativo'} />
          <SummaryCard label="Receitas" value={formatCurrency(monthTotals.income)} glyph="↓" kind="income" footer={`${monthTransactions.filter(item => item.type === 'income').length} entrada(s) este mês`} />
          <SummaryCard label="Despesas" value={formatCurrency(monthTotals.expense)} glyph="↑" kind="expense" footer={`${monthTransactions.filter(item => item.type === 'expense').length} saída(s) este mês`} />
          <SummaryCard label="ICMS simulado" value={formatCurrency(monthTax)} glyph="％" kind="tax" footer="Referência paulista" />
        </View>

        <AppCard style={styles.panelCard}>
          <SectionTitle title="Fluxo financeiro" subtitle="Receitas e despesas · últimos seis meses" />
          <View style={styles.chart}>
            {chart.map(item => (
              <View key={item.month} style={styles.chartColumn}>
                <View style={styles.chartBarPair}>
                  <View style={[styles.chartBar, styles.incomeChartBar, { height: Math.max(4, item.income / max * 100) }]} />
                  <View style={[styles.chartBar, styles.expenseChartBar, { height: Math.max(4, item.expense / max * 100) }]} />
                </View>
                <Text style={styles.chartMonth}>{prettyMonth(item.month).split(' ')[0].slice(0, 3)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}><View style={styles.incomeLegendDot} /><Text style={styles.legendText}>Receitas</Text></View>
            <View style={styles.legendItem}><View style={styles.expenseLegendDot} /><Text style={styles.legendText}>Despesas</Text></View>
            <Text style={styles.chartCurrentBalance}>Saldo: {formatCurrency(monthBalance)}</Text>
          </View>
        </AppCard>

        <AppCard style={styles.panelCard}>
          <SectionTitle
            action={<Pressable onPress={() => setModal('budget')} style={styles.smallAction}><Text style={styles.smallActionText}>Editar</Text></Pressable>}
            subtitle="Despesas versus limite"
            title="Orçamento mensal"
          />
          <View style={styles.budgetAmountRow}>
            <Text style={styles.budgetSpent}>{formatCurrency(monthTotals.expense)}</Text>
            <Text style={styles.budgetOf}>de {formatCurrency(data.budget)}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, percent > 100 && styles.progressOver, { width: `${Math.min(percent, 100)}%` }]} />
          </View>
          <View style={styles.budgetStatus}>
            <Text style={styles.mutedSmall}>{Math.round(percent)}% utilizado</Text>
            <Text style={[styles.budgetRemaining, remaining < 0 && styles.deleteText]}>
              {remaining >= 0 ? `${formatCurrency(remaining)} disponíveis` : `${formatCurrency(Math.abs(remaining))} acima`}
            </Text>
          </View>
          <View style={styles.divider} />
          <SectionTitle title="Despesas por categoria" />
          <CategoryBars transactions={monthTransactions} />
        </AppCard>

        <AppCard style={styles.panelCard}>
          <SectionTitle
            action={<Text style={styles.linkText}>{recent.length ? 'Mais recentes' : ''}</Text>}
            subtitle={prettyMonth(month)}
            title="Últimos lançamentos"
          />
          {recent.length
            ? recent.map(transaction => <TransactionRow key={transaction.id} transaction={transaction} />)
            : <Text style={styles.emptyCopy}>Nenhum lançamento neste mês.</Text>}
        </AppCard>
      </>
    );
  }

  function transactions() {
    const categories = [...new Set(data.transactions.map(transaction => transaction.category))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return (
      <>
        {pageHeading('MOVIMENTAÇÕES', 'Lançamentos', 'Entradas e saídas organizadas em um só lugar.')}
        <AppCard style={styles.panelCard}>
          <TextInput
            accessibilityLabel="Buscar lançamentos"
            onChangeText={setSearch}
            placeholder="⌕  Buscar lançamento"
            placeholderTextColor={MUTED}
            style={styles.searchInput}
            value={search}
          />
          <Text style={styles.filterCaption}>Tipo de lançamento</Text>
          <Chips
            options={[{ label: 'Todos', value: 'all' }, { label: 'Receitas', value: 'income' }, { label: 'Despesas', value: 'expense' }]}
            selected={typeFilter}
            onSelect={setTypeFilter}
          />
          <Text style={styles.filterCaption}>Categoria</Text>
          <Chips options={[{ label: 'Todas', value: 'all' }, ...categories]} selected={categoryFilter} onSelect={setCategoryFilter} tint={GREEN} />
        </AppCard>
        <AppCard style={styles.panelCard}>
          <SectionTitle title={`${filteredTransactions.length} lançamento(s)`} subtitle="Edite ou exclua uma movimentação." />
          {filteredTransactions.length
            ? filteredTransactions.map(transaction => (
              <TransactionRow key={transaction.id} onDelete={deleteTransaction} onEdit={openTransaction} transaction={transaction} />
            ))
            : <Text style={styles.emptyCopy}>Nenhum lançamento encontrado. Ajuste os filtros ou adicione um registro.</Text>}
        </AppCard>
        <PrimaryButton label="+  Novo lançamento" onPress={() => openTransaction(null)} />
      </>
    );
  }

  function reports() {
    const transactionCount = reportTransactions.length;
    return (
      <>
        {pageHeading('ANÁLISE E EXPORTAÇÃO', 'Relatório financeiro', 'Seu resumo financeiro com período configurável.')}
        <AppCard style={styles.panelCard}>
          <SectionTitle title="Período do relatório" subtitle={`${period.start} a ${period.end}`} />
          <View style={styles.dateStepper}>
            <Pressable accessibilityLabel="Mês anterior no relatório" onPress={() => changeReportMonth(-1)} style={styles.monthArrow}>
              <Text style={styles.monthArrowText}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{prettyMonth(period.start.slice(0, 7))}</Text>
            <Pressable accessibilityLabel="Próximo mês no relatório" onPress={() => changeReportMonth(1)} style={styles.monthArrow}>
              <Text style={styles.monthArrowText}>›</Text>
            </Pressable>
          </View>
          <View style={styles.dateRangeRow}>
            <View style={styles.dateField}>
              <Text style={styles.formLabel}>De · AAAA-MM-DD</Text>
              <TextInput autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={setReportStart} style={styles.textInput} value={reportStart} />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.formLabel}>Até · AAAA-MM-DD</Text>
              <TextInput autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={setReportEnd} style={styles.textInput} value={reportEnd} />
            </View>
          </View>
          <PrimaryButton label="Atualizar relatório" onPress={applyReportPeriod} />
        </AppCard>
        <View style={styles.reportMetrics}>
          <MetricCard label="Receitas" value={formatCurrency(reportTotals.income)} kind="income" />
          <MetricCard label="Despesas" value={formatCurrency(reportTotals.expense)} kind="expense" />
          <MetricCard label="Saldo do período" value={formatCurrency(reportTotals.income - reportTotals.expense)} />
          <MetricCard label="ICMS simulado" value={formatCurrency(reportTax)} kind="tax" />
        </View>
        <AppCard style={styles.panelCard}>
          <SectionTitle title="Despesas por categoria" subtitle="Distribuição no período" />
          <CategoryBars limit={8} transactions={reportTransactions} />
        </AppCard>
        <AppCard style={styles.panelCard}>
          <SectionTitle title="Detalhamento do período" subtitle={`${transactionCount} movimentação(ões)`} />
          {reportTransactions.length
            ? reportTransactions.map(transaction => <TransactionRow key={transaction.id} transaction={transaction} />)
            : <Text style={styles.emptyCopy}>Nenhum lançamento neste período.</Text>}
        </AppCard>
        <AppCard style={styles.panelCard}>
          <SectionTitle title="Exportar relatório" subtitle="Gere um arquivo para compartilhar ou salvar." />
          <View style={styles.exportRow}>
            <PrimaryButton label="Compartilhar CSV" onPress={exportCsv} />
            <Pressable onPress={exportPdf} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Gerar PDF</Text></Pressable>
          </View>
          <Text style={styles.disclaimer}>
            A estimativa tributária é informativa e não substitui comprovantes, orientação contábil ou apuração oficial.
          </Text>
        </AppCard>
        <AppCard style={styles.panelCard}>
          <SectionTitle title="Arquivo de dados JSON" subtitle="Os dados são salvos no aparelho; use o backup para transferir ou recuperar." />
          <View style={{ gap: 8 }}>
            <PrimaryButton label="Exportar backup JSON" onPress={exportBackup} />
            <Pressable onPress={importBackup} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Restaurar backup JSON</Text>
            </Pressable>
          </View>
        </AppCard>
      </>
    );
  }

  function taxes() {
    const base = monthTransactions
      .filter(transaction => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    return (
      <>
        {pageHeading('ICMS · SÃO PAULO', 'Impostos no consumo', 'Simulação informativa com a alíquota interna de referência do ICMS paulista.')}
        <View style={styles.noticeCard}>
          <Text style={styles.noticeIcon}>i</Text>
          <View style={styles.flexOne}>
            <Text style={styles.noticeTitle}>Simulação, não cálculo fiscal</Text>
            <Text style={styles.noticeText}>
              A referência inicial é 18% de ICMS, alíquota interna geral em São Paulo. A incidência e a alíquota efetivas variam conforme o produto, serviço e regras específicas; o resultado não representa o imposto real das suas compras. Ajuste cada categoria quando tiver dados mais precisos.
            </Text>
          </View>
        </View>
        <AppCard style={styles.taxTotalCard}>
          <Text style={styles.taxLabel}>ICMS simulado neste mês · {prettyMonth(month)}</Text>
          <Text style={styles.taxValue}>{formatCurrency(monthTax)}</Text>
          <Text style={styles.taxRatio}>
            {formatCurrency(base)} em despesas · {base ? (monthTax / base * 100).toFixed(1).replace('.', ',') : '0,0'}% estimados
          </Text>
        </AppCard>
        <AppCard style={styles.panelCard}>
          <SectionTitle
            action={<Pressable onPress={resetRates} style={styles.smallAction}><Text style={styles.smallActionText}>Restaurar</Text></Pressable>}
            subtitle="O padrão é 18%; ajuste ou zere categorias sem incidência de ICMS."
            title="Parâmetros por categoria"
          />
          {EXPENSE_CATEGORIES.map(category => (
            <View key={category} style={styles.rateRow}>
              <Text style={styles.rateCategory}>{category}</Text>
              <View style={styles.rateInputRow}>
                <TextInput
                  accessibilityLabel={`Percentual estimado de ${category}`}
                  keyboardType="decimal-pad"
                  maxLength={5}
                  onBlur={() => saveRate(category)}
                  onChangeText={value => setRateDraft(previous => ({ ...previous, [category]: value }))}
                  onSubmitEditing={() => saveRate(category)}
                  returnKeyType="done"
                  selectTextOnFocus
                  style={styles.rateInput}
                  value={String(rateDraft[category] ?? '')}
                />
                <Text style={styles.ratePercent}>%</Text>
              </View>
            </View>
          ))}
          <View style={styles.methodNote}>
            <Text style={styles.methodNoteTitle}>Como calculamos</Text>
            <Text style={styles.methodNoteBody}>Valor da despesa × alíquota informada = ICMS simulado. É uma referência simplificada: muitas despesas não têm incidência de ICMS e alguns produtos seguem regras ou alíquotas diferentes.</Text>
          </View>
          <Text style={styles.taxPeriodBase}>Base de despesas no mês: {formatCurrency(base)}</Text>
        </AppCard>
        <AppCard style={styles.panelCard}>
          <SectionTitle title="Referências legais" subtitle="Acesse os textos do repositório indicado." />
          {LEGAL_REFERENCES.map(reference => (
            <Pressable key={reference.url} onPress={() => openReference(reference.url)} style={styles.legalLink}>
              <View style={styles.flexOne}>
                <Text style={styles.legalLabel}>{reference.label}</Text>
                <Text style={styles.legalTitle}>{reference.title}</Text>
                <Text style={styles.legalDetail}>{reference.detail}</Text>
              </View>
              <Text style={styles.linkText}>↗</Text>
            </Pressable>
          ))}
          <Text style={styles.disclaimer}>
            Fonte: github.com/ctresb/leis. O próprio repositório informa que seu conteúdo é informativo e não substitui a publicação oficial. A estimativa não apura IBS, CBS, transição tributária, créditos ou compensações.
          </Text>
        </AppCard>
      </>
    );
  }

  const titles = {
    dashboard: ['VISÃO GERAL', 'Saldo'],
    transactions: ['MOVIMENTAÇÕES', 'Lançamentos'],
    reports: ['RELATÓRIOS', 'Relatório'],
    taxes: ['IMPOSTOS', 'Tributos'],
  };
  const [eyebrow, screenTitle] = titles[page];

  return (
    <View style={styles.screen}>
      <View style={[styles.topbar, { paddingTop: Math.max(insets.top ? 7 : 12, 8) }]}>
        <View style={styles.brandMark}><Text style={styles.brandGlyph}>s</Text></View>
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>saldo<Text style={styles.brandPeriod}>.</Text></Text>
          <Text style={styles.brandLocation}>SÃO PAULO, SP · {screenTitle.toLocaleUpperCase('pt-BR')}</Text>
        </View>
        <MonthControl month={month} onChange={changeMonth} />
        <Pressable accessibilityLabel="Novo lançamento" onPress={() => openTransaction(null)} style={styles.quickAddButton}>
          <Text style={styles.quickAddGlyph}>＋</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.pageContent, { paddingBottom: 24 + Math.max(insets.bottom, 8) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {page === 'dashboard' ? dashboard() : null}
        {page === 'transactions' ? transactions() : null}
        {page === 'reports' ? reports() : null}
        {page === 'taxes' ? taxes() : null}
        <Text style={styles.footerCopy}>SEUS DADOS FICAM SOMENTE NESTE APARELHO</Text>
      </ScrollView>
      <FinanceModal
        budget={data.budget}
        form={form}
        kind={modal}
        onClose={() => { setModal(null); setForm(null); }}
        onSave={saveTransaction}
        setForm={setForm}
        visible={Boolean(modal)}
      />
    </View>
  );
}
