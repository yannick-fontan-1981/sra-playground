import {
  BROWSER_DURABLE_SESSION_MAX_BYTES,
  BROWSER_DURABLE_SESSION_STORAGE_KEY,
  BrowserDurableSessionStore,
  type BrowserDurableSessionCheckpointV1,
  type BrowserDurableSessionLoadResult,
  type BrowserDurableSessionSaveResult,
  type BrowserSessionStorageLike,
} from './v6-browser-durable-session.ts';

export const BROWSER_DURABLE_SESSION_DB_NAME =
  'sra-playground-v6-browser-durable-session';
export const BROWSER_DURABLE_SESSION_DB_VERSION = 1;
export const BROWSER_DURABLE_SESSION_OBJECT_STORE = 'checkpoints';

export interface BrowserIndexedDbDurableSessionStoreLike {
  save(checkpoint: BrowserDurableSessionCheckpointV1): Promise<BrowserDurableSessionSaveResult>;
  load(nowMs?: number, expectedGameCode?: string): Promise<BrowserDurableSessionLoadResult>;
  clear(): Promise<boolean>;
}

class MemoryStorage implements BrowserSessionStorageLike {
  #value: string | null = null;

  getItem(_key: string): string | null {
    return this.#value;
  }

  setItem(_key: string, value: string): void {
    this.#value = value;
  }

  removeItem(_key: string): void {
    this.#value = null;
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('IndexedDB request failed'));
    }, { once: true });
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => {
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    }, { once: true });
    transaction.addEventListener('error', () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    }, { once: true });
  });
}

function openDatabase(
  factory: IDBFactory,
  databaseName: string,
  version: number,
  objectStoreName: string,
): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(databaseName, version);
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(objectStoreName)) {
        database.createObjectStore(objectStoreName);
      }
    });
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('IndexedDB open failed'));
    }, { once: true });
    request.addEventListener('blocked', () => {
      reject(new Error('IndexedDB upgrade is blocked by another connection'));
    }, { once: true });
  });
}

function codecStore(maxBytes: number): {
  storage: MemoryStorage;
  store: BrowserDurableSessionStore;
} {
  const storage = new MemoryStorage();
  return {
    storage,
    store: new BrowserDurableSessionStore(storage, {
      key: BROWSER_DURABLE_SESSION_STORAGE_KEY,
      maxBytes,
    }),
  };
}

export class BrowserIndexedDbDurableSessionStore
implements BrowserIndexedDbDurableSessionStoreLike {
  readonly #factory: IDBFactory;
  readonly #databaseName: string;
  readonly #databaseVersion: number;
  readonly #objectStoreName: string;
  readonly #key: string;
  readonly #maxBytes: number;

  constructor(
    factory: IDBFactory,
    options: {
      databaseName?: string;
      databaseVersion?: number;
      objectStoreName?: string;
      key?: string;
      maxBytes?: number;
    } = {},
  ) {
    this.#factory = factory;
    this.#databaseName = options.databaseName ?? BROWSER_DURABLE_SESSION_DB_NAME;
    this.#databaseVersion = options.databaseVersion ?? BROWSER_DURABLE_SESSION_DB_VERSION;
    this.#objectStoreName = options.objectStoreName ?? BROWSER_DURABLE_SESSION_OBJECT_STORE;
    this.#key = options.key ?? BROWSER_DURABLE_SESSION_STORAGE_KEY;
    this.#maxBytes = options.maxBytes ?? BROWSER_DURABLE_SESSION_MAX_BYTES;
    if (!Number.isInteger(this.#databaseVersion) || this.#databaseVersion <= 0) {
      throw new RangeError('IndexedDB durable-session version must be a positive integer');
    }
    if (!Number.isInteger(this.#maxBytes) || this.#maxBytes <= 0) {
      throw new RangeError('IndexedDB durable-session maxBytes must be a positive integer');
    }
  }

  async save(
    checkpoint: BrowserDurableSessionCheckpointV1,
  ): Promise<BrowserDurableSessionSaveResult> {
    const codec = codecStore(this.#maxBytes);
    const encoded = codec.store.save(checkpoint);
    if (encoded.status !== 'saved') {
      if (encoded.status === 'too-large') await this.clear();
      return encoded;
    }
    const serialized = codec.storage.getItem(BROWSER_DURABLE_SESSION_STORAGE_KEY);
    if (serialized === null) {
      return {
        status: 'unavailable',
        error: new Error('durable-session codec produced no serialized checkpoint'),
      };
    }

    let database: IDBDatabase | null = null;
    try {
      database = await openDatabase(
        this.#factory,
        this.#databaseName,
        this.#databaseVersion,
        this.#objectStoreName,
      );
      const transaction = database.transaction(this.#objectStoreName, 'readwrite', {
        durability: 'strict',
      });
      transaction.objectStore(this.#objectStoreName).put(serialized, this.#key);
      await transactionComplete(transaction);
      return encoded;
    } catch (error) {
      return { status: 'unavailable', error };
    } finally {
      database?.close();
    }
  }

  async load(
    nowMs = Date.now(),
    expectedGameCode?: string,
  ): Promise<BrowserDurableSessionLoadResult> {
    let database: IDBDatabase | null = null;
    try {
      database = await openDatabase(
        this.#factory,
        this.#databaseName,
        this.#databaseVersion,
        this.#objectStoreName,
      );
      const transaction = database.transaction(this.#objectStoreName, 'readonly');
      const serialized = await requestResult(
        transaction.objectStore(this.#objectStoreName).get(this.#key),
      );
      await transactionComplete(transaction);
      if (serialized === undefined) return { status: 'empty' };
      if (typeof serialized !== 'string') {
        await this.clear();
        return {
          status: 'invalid',
          error: new TypeError('IndexedDB durable-session value must be a string'),
        };
      }

      const codec = codecStore(this.#maxBytes);
      codec.storage.setItem(BROWSER_DURABLE_SESSION_STORAGE_KEY, serialized);
      const loaded = codec.store.load(nowMs, expectedGameCode);
      if (
        loaded.status === 'expired'
        || loaded.status === 'game-mismatch'
        || loaded.status === 'invalid'
      ) {
        await this.clear();
      }
      return loaded;
    } catch (error) {
      return { status: 'unavailable', error };
    } finally {
      database?.close();
    }
  }

  async clear(): Promise<boolean> {
    let database: IDBDatabase | null = null;
    try {
      database = await openDatabase(
        this.#factory,
        this.#databaseName,
        this.#databaseVersion,
        this.#objectStoreName,
      );
      const transaction = database.transaction(this.#objectStoreName, 'readwrite', {
        durability: 'strict',
      });
      transaction.objectStore(this.#objectStoreName).delete(this.#key);
      await transactionComplete(transaction);
      return true;
    } catch {
      return false;
    } finally {
      database?.close();
    }
  }
}

export class BrowserIndexedDbDurableSessionPersistence {
  readonly #store: BrowserIndexedDbDurableSessionStoreLike;
  #tail: Promise<BrowserDurableSessionSaveResult | boolean> = Promise.resolve(true);

  constructor(store: BrowserIndexedDbDurableSessionStoreLike) {
    this.#store = store;
  }

  enqueue(
    checkpoint: BrowserDurableSessionCheckpointV1,
  ): Promise<BrowserDurableSessionSaveResult> {
    const retained = structuredClone(checkpoint);
    const operation = this.#tail.then(
      () => this.#store.save(retained),
      () => this.#store.save(retained),
    );
    this.#tail = operation;
    return operation;
  }

  async flush(): Promise<BrowserDurableSessionSaveResult | boolean> {
    return await this.#tail;
  }

  async load(
    nowMs = Date.now(),
    expectedGameCode?: string,
  ): Promise<BrowserDurableSessionLoadResult> {
    await this.#tail.catch(() => undefined);
    return await this.#store.load(nowMs, expectedGameCode);
  }

  clear(): Promise<boolean> {
    const operation = this.#tail.then(
      () => this.#store.clear(),
      () => this.#store.clear(),
    );
    this.#tail = operation;
    return operation;
  }
}
