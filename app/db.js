/* Cola de movimientos pendientes en IndexedDB (sobrevive a cerrar la app y a estar sin conexión). */
const DB = (() => {
  const NOMBRE = 'gastos-fc';
  const STORE = 'cola';
  let dbPromise = null;

  function abrir() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NOMBRE, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(modo, fn) {
    return abrir().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, modo);
      const st = t.objectStore(STORE);
      let out;
      Promise.resolve(fn(st)).then(r => { out = r; });
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  return {
    /** Guarda/reemplaza un movimiento en la cola. */
    put: mov => tx('readwrite', st => { st.put(mov); }),
    get: id => tx('readonly', st => reqP(st.get(id))),
    all: () => tx('readonly', st => reqP(st.getAll())),
    del: id => tx('readwrite', st => { st.delete(id); }),
  };
})();
