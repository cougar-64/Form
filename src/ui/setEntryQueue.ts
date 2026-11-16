// Inline editors share a write queue so one exercise's draft write cannot race
// another exercise's transaction on a separate SQLite connection.
let writes: Promise<void> = Promise.resolve();

export function enqueueSetEntryWrite<T>(task: () => Promise<T>): Promise<T> {
  const job = writes.then(task);
  writes = job.then(() => undefined, () => undefined);
  return job;
}

export function waitForSetEntryWrites(): Promise<void> {
  return writes;
}
