import { useCallback, useEffect, useRef, useState } from "react";

const COMMIT_DELAY_MS = 500;

export type HistoryState<T> = {
  value: T;
  set: (updater: T | ((current: T) => T), options?: { immediate?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (value: T) => void;
  commitPending: () => void;
};

/**
 * Tracks `value` with an undo/redo history. Rapid successive `set` calls
 * (e.g. keystrokes, slider drags) are coalesced into a single history entry
 * until `COMMIT_DELAY_MS` passes without a change, or `{ immediate: true }`
 * forces a boundary right away for discrete actions like button clicks.
 */
export function useHistoryState<T>(initial: T): HistoryState<T> {
  const [value, setValue] = useState(initial);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const pendingBase = useRef<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const commitPending = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (pendingBase.current !== null) {
      past.current.push(pendingBase.current);
      pendingBase.current = null;
      setCanUndo(true);
    }
  }, []);

  const set = useCallback((updater: T | ((current: T) => T), options?: { immediate?: boolean }) => {
    const next = typeof updater === "function" ? (updater as (current: T) => T)(value) : updater;
    if (pendingBase.current === null) pendingBase.current = value;
    if (future.current.length > 0) { future.current = []; setCanRedo(false); }
    if (timer.current) clearTimeout(timer.current);
    if (options?.immediate) commitPending();
    else timer.current = setTimeout(commitPending, COMMIT_DELAY_MS);
    setValue(next);
  }, [value, commitPending]);

  const undo = useCallback(() => {
    commitPending();
    const previous = past.current.pop();
    if (previous === undefined) return;
    future.current.push(value);
    setCanUndo(past.current.length > 0);
    setCanRedo(true);
    setValue(previous);
  }, [value, commitPending]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return;
    past.current.push(value);
    setCanRedo(future.current.length > 0);
    setCanUndo(true);
    setValue(next);
  }, [value]);

  const reset = useCallback((next: T) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    past.current = [];
    future.current = [];
    pendingBase.current = null;
    setCanUndo(false);
    setCanRedo(false);
    setValue(next);
  }, []);

  return { value, set, undo, redo, canUndo, canRedo, reset, commitPending };
}
