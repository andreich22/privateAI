const mockData = {};

export async function openDB(name, version, { upgrade } = {}) {
  if (!mockData[name]) mockData[name] = {};
  
  const db = {
    _name: name,
    _version: version,
    _stores: {},
    objectStoreNames: {
      contains: (store) => Boolean(mockData[name]?.stores?.[store]),
    },
    put: async (store, value, key) => {
      if (!mockData[name]) mockData[name] = {};
      if (!mockData[name].stores) mockData[name].stores = {};
      if (!mockData[name].stores[store]) mockData[name].stores[store] = {};
      mockData[name].stores[store][key] = value;
    },
    get: async (store, key) => {
      return mockData[name]?.stores?.[store]?.[key] || null;
    },
    delete: async (store, key) => {
      delete mockData[name]?.stores?.[store]?.[key];
    },
    deleteObjectStore: (store) => {
      delete mockData[name]?.stores?.[store];
    },
    clear: async (store) => {
      if (mockData[name]?.stores?.[store]) {
        mockData[name].stores[store] = {};
      }
    },
    transaction: (store, mode) => ({
      objectStore: (s) => ({
        get: async (key) => mockData[name]?.stores?.[s]?.[key] || null,
        put: async (value, key) => {
          if (!mockData[name]?.stores?.[s]) mockData[name].stores[s] = {};
          mockData[name].stores[s][key] = value;
        },
        delete: async (key) => {
          delete mockData[name]?.stores?.[s]?.[key];
        },
        clear: async () => {
          if (mockData[name]?.stores?.[s]) mockData[name].stores[s] = {};
        },
        getAll: async () => Object.values(mockData[name]?.stores?.[s] || {}),
        count: async () => Object.keys(mockData[name]?.stores?.[s] || {}).length,
        openCursor: async () => null,
      }),
      commit: async () => {},
      abort: () => {},
    }),
    close: () => {},
    transactionWithStore: (stores, mode) => ({
      objectStore: (s) => ({
        get: async (key) => mockData[name]?.stores?.[s]?.[key] || null,
        put: async (value, key) => {
          if (!mockData[name]?.stores?.[s]) mockData[name].stores[s] = {};
          mockData[name].stores[s][key] = value;
        },
      }),
      commit: async () => {},
    }),
  };

  if (upgrade) {
    const upgradeDb = {
      createObjectStore: (storeName) => {
        if (!mockData[name]) mockData[name] = {};
        if (!mockData[name].stores) mockData[name].stores = {};
        mockData[name].stores[storeName] = {};
        return {
          name: storeName,
          keyPath: null,
          autoIncrement: false,
          put: async (value, key) => db.put(storeName, value, key),
          get: async (key) => db.get(storeName, key),
        };
      },
    };
    upgrade(upgradeDb);
  }

  return db;
}

export async function deleteDatabase(name) {
  delete mockData[name];
}
