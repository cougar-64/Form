import { useEffect, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { discardSetDraft, loadSessionExercise, saveActualSets, saveSetDraft, type DraftSet, type SessionExercise } from '../data/sessions';
import { enqueueSetEntryWrite } from './setEntryQueue';

export type SetEntryState = { pending: boolean; saving: boolean; failed: boolean; changed: boolean };

export function useSetEntries(initial: SessionExercise) {
  const db = useSQLiteContext();
  const [exercise, setExercise] = useState(initial);
  const counter = useRef(0);
  function blank(unit: 'lb' | 'kg'): DraftSet {
    return { key: `new-${Date.now()}-${++counter.current}`, weight: '', reps: '', unit };
  }
  function initialRows(item: SessionExercise): DraftSet[] {
    if (item.draft !== null) return item.draft;
    const count = Math.max(item.planned_sets ?? 1, ...item.actual.map((set) => set.position + 1));
    return Array.from({ length: count }, (_, position) => {
      const saved = item.actual.find((set) => set.position === position);
      return saved ? { key: saved.client_key, weight: saved.weight_milli === null ? '' : String(saved.weight_milli / 1000), reps: String(saved.reps), unit: saved.unit } : blank(item.planned_unit);
    });
  }
  const [rows, setRows] = useState(() => initialRows(initial));
  const rowsRef = useRef(rows);
  const revision = useRef(initial.revision);
  const [changed, setChanged] = useState(initial.draft !== null);
  const changedRef = useRef(changed);
  const [pending, setPending] = useState(false);
  const pendingCount = useRef(0);
  const [saving, setSaving] = useState(false);
  const operation = useRef(false);
  const [writeError, setWriteError] = useState('');
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  function apply(item: SessionExercise, keepRows?: DraftSet[]) {
    revision.current = item.revision;
    const value = keepRows ?? initialRows(item);
    rowsRef.current = value;
    setRows(value); setExercise(item);
    changedRef.current = item.draft !== null;
    setChanged(changedRef.current);
  }

  // A focus refresh may deliver newer metadata. Never replace local edits or a
  // pending write with that snapshot; their revision guard handles conflicts.
  useEffect(() => {
    if (!changedRef.current && !pendingCount.current && !operation.current && initial.revision !== revision.current) apply(initial);
  }, [initial]);

  function persist(value: DraftSet[]) {
    pendingCount.current += 1; setPending(true);
    void enqueueSetEntryWrite(async () => {
      revision.current = await saveSetDraft(db, initial.id, value, revision.current);
    }).then(() => { if (mounted.current) setWriteError(''); }, (cause) => {
      if (mounted.current) setWriteError(cause instanceof Error ? cause.message : 'Could not save these changes.');
    }).finally(() => {
      pendingCount.current -= 1;
      if (mounted.current && !pendingCount.current) setPending(false);
    });
  }

  function change(value: DraftSet[]) {
    if (operation.current) return;
    changedRef.current = true; setChanged(true); setError('');
    rowsRef.current = value; setRows(value); persist(value);
  }

  async function save(reset = false) {
    if (operation.current) return;
    operation.current = true; setSaving(true); setError('');
    try {
      const item = await enqueueSetEntryWrite(async () => {
        if (reset) await discardSetDraft(db, initial.id, revision.current);
        else {
          revision.current = await saveSetDraft(db, initial.id, rowsRef.current, revision.current);
          if (mounted.current) setWriteError('');
          await saveActualSets(db, initial.id, revision.current, true);
        }
        return loadSessionExercise(db, initial.id);
      });
      if (mounted.current) { apply(item, reset ? undefined : rowsRef.current); setWriteError(''); }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not save these sets.');
    } finally {
      operation.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  async function reload() {
    if (operation.current) return;
    operation.current = true; setSaving(true);
    try {
      const item = await enqueueSetEntryWrite(() => loadSessionExercise(db, initial.id));
      if (mounted.current) { apply(item); setError(''); setWriteError(''); }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not reload this exercise.');
    } finally { operation.current = false; if (mounted.current) setSaving(false); }
  }

  return {
    exercise, rows, pending, saving, changed, writeError, error, save, reload,
    retry: () => persist(rowsRef.current),
    edit: (key: string, values: Partial<DraftSet>) => change(rowsRef.current.map((row) => row.key === key ? { ...row, ...values } : row)),
    add: () => change([...rowsRef.current, blank(rowsRef.current[rowsRef.current.length - 1]?.unit ?? exercise.planned_unit)]),
    removeLast: () => change(rowsRef.current.slice(0, -1)),
  };
}
