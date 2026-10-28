import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearLocalData,
  emptyLocalData,
  readLocalData,
  saveLocalData,
  subscribeToLocalData,
  type LocalData,
} from '@/localData';
import { clearServerData, getServerData, saveServerData } from '@/api';

export default function useLocalData() {
  const [initial] = useState(() => {
    try {
      return { data: readLocalData(), error: null };
    } catch (reason) {
      return {
        data: emptyLocalData(),
        error: reason instanceof Error ? reason.message : 'Somnia could not read saved data.',
      };
    }
  });
  const [data, setData] = useState<LocalData>(initial.data);
  const dataRef = useRef(data);
  const [error, setError] = useState<string | null>(initial.error);
  const serverReady = useRef(false);
  const changeGeneration = useRef(0);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    const startingGeneration = changeGeneration.current;

    void getServerData()
      .then(async ({ data: serverData }) => {
        if (!active) return;
        if (changeGeneration.current !== startingGeneration) {
          await saveServerData(dataRef.current);
        } else if (serverData) {
          dataRef.current = serverData;
          setData(serverData);
          saveLocalData(serverData);
        } else {
          await saveServerData(dataRef.current);
        }
        serverReady.current = true;
        if (active) setError(null);
      })
      .catch((reason: unknown) => {
        if (active) {
          const message = reason instanceof Error ? reason.message : 'Somnia backend is unavailable.';
          setError(`${message} Local browser storage is still available.`);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const reload = useCallback(() => {
    try {
      const current = readLocalData();
      dataRef.current = current;
      setData(current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Somnia could not read saved data.');
    }
  }, []);

  useEffect(() => subscribeToLocalData(reload), [reload]);

  const update = useCallback(
    (updater: LocalData | ((previous: LocalData) => LocalData)) => {
      const next = typeof updater === 'function' ? updater(dataRef.current) : updater;
      try {
        saveLocalData(next);
        changeGeneration.current += 1;
        dataRef.current = next;
        setData(next);
        setError(null);
        if (serverReady.current) {
          saveQueue.current = saveQueue.current
            .then(() => saveServerData(next))
            .catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : 'Somnia could not save data to its backend.');
            });
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Somnia could not save your changes.');
      }
    },
    [],
  );

  const clear = useCallback(() => {
    try {
      clearLocalData();
      const cleared = emptyLocalData();
      changeGeneration.current += 1;
      dataRef.current = cleared;
      setData(cleared);
      setError(null);
      if (serverReady.current) {
        saveQueue.current = saveQueue.current
          .then(() => clearServerData())
          .catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : 'Somnia could not delete backend data.');
          });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Somnia could not clear saved data.');
    }
  }, []);

  return { data, error, update, clear, reload };
}
