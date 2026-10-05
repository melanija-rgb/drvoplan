export function createMemoryStore() {
  const map = new Map();
  return {
    async setJSON(key, value) {
      map.set(key, structuredClone(value));
    },
    async get(key) {
      return map.has(key) ? structuredClone(map.get(key)) : null;
    },
    async delete(key) {
      map.delete(key);
    },
    async list() {
      return [...map.values()].map((value) => structuredClone(value));
    },
  };
}

export async function inquiryStore() {
  if (process.env.INQUIRY_STORE === "memory") {
    if (!inquiryStore.memory) inquiryStore.memory = createMemoryStore();
    return inquiryStore.memory;
  }

  const { getStore } = await import("@netlify/blobs");
  // Strong consistency so the admin list reflects a new, read or deleted
  // inquiry right away instead of up to a minute later.
  const store = getStore({ name: "upiti", consistency: "strong" });
  return {
    async setJSON(key, value) {
      await store.setJSON(key, value);
    },
    async get(key) {
      return store.get(key, { type: "json" });
    },
    async delete(key) {
      await store.delete(key);
    },
    async list() {
      const result = await store.list();
      const blobs = result.blobs || [];
      const items = [];
      for (const blob of blobs) {
        const value = await store.get(blob.key, { type: "json" });
        if (value) items.push(value);
      }
      return items;
    },
  };
}
