import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { createDemoState, monthKey, normalizedRates, validTransaction } from './finance';

const STORAGE_KEY = 'saldo-financeiro-v1';
const DATA_FILE_NAME = 'saldo-financeiro.json';
const FinanceContext = createContext(null);

function validateSavedState(parsed) {
  if (!parsed || !Array.isArray(parsed.transactions)) {
    throw new Error('Os dados salvos estão em um formato inválido.');
  }
  const rates = normalizedRates(parsed.rates);
  Object.entries(parsed.rates || {}).forEach(([category, value]) => {
    if (Object.prototype.hasOwnProperty.call(rates, category) &&
      (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100)) {
      throw new Error(`A alíquota salva para ${category} é inválida.`);
    }
  });
  return {
    transactions: parsed.transactions.filter(validTransaction),
    budget: Number.isFinite(Number(parsed.budget)) ? Math.max(0, Number(parsed.budget)) : 4200,
    rates,
  };
}

async function writeDataFile(data) {
  const destination = new File(Paths.document, DATA_FILE_NAME);
  const temporary = new File(Paths.document, `${DATA_FILE_NAME}.tmp`);
  if (temporary.exists) temporary.delete();
  temporary.create();
  await temporary.write(JSON.stringify({ version: 1, ...data }));
  await temporary.move(destination, { overwrite: true });
}

export function FinanceProvider({ children }) {
  const [data, setData] = useState(() => createDemoState());
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [ready, setReady] = useState(false);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    async function loadSavedData() {
      try {
        const file = new File(Paths.document, DATA_FILE_NAME);
        let savedData;
        if (file.exists) {
          savedData = validateSavedState(JSON.parse(await file.text()));
        } else {
          const legacyData = await AsyncStorage.getItem(STORAGE_KEY);
          savedData = legacyData
            ? validateSavedState(JSON.parse(legacyData))
            : createDemoState();
          await writeDataFile(savedData);
        }
        if (active) {
          setData(savedData);
          setReady(true);
        }
      } catch (error) {
        console.error('Não foi possível carregar os dados financeiros.', error);
        if (active) {
          Alert.alert(
            'Não foi possível carregar os dados',
            'O arquivo financeiro não foi alterado. Verifique o armazenamento do aparelho e reinicie o aplicativo.',
          );
        }
      }
    }

    loadSavedData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const snapshot = JSON.stringify(data);
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(async () => {
        await writeDataFile(data);
        await AsyncStorage.setItem(STORAGE_KEY, snapshot);
      })
      .catch(error => {
        console.error('Não foi possível salvar os dados financeiros.', error);
        Alert.alert('Falha ao salvar', 'O arquivo JSON não pôde ser atualizado. Exporte um backup e verifique o espaço disponível no aparelho.');
      });
  }, [data, ready]);

  const context = useMemo(() => ({
    data,
    setData,
    month,
    setMonth,
    ready,
  }), [data, month, ready]);

  return <FinanceContext.Provider value={context}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('useFinance precisa estar dentro de FinanceProvider.');
  return context;
}
