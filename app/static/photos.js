// IndexedDB keeps photos out of localStorage and off the server.
let photoDB;
function database() {
  return (photoDB ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("eco-trail-photos", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("photos");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
export async function photoOperation(mode, operation) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", mode),
      request = operation(tx.objectStore("photos"));
    let result;
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export const removePhoto = (key) =>
  photoOperation("readwrite", (store) => store.delete(key));
export const clearPhotos = () =>
  photoOperation("readwrite", (store) => store.clear()).catch(() => {});
