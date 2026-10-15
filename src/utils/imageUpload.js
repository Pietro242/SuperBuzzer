// imageUpload.js – Carica immagini sul server HTTP (evita WS per dati binari grossi)

function getServerBase() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return window.location.origin;
}


/**
 * Carica un File/Blob immagine sul server e restituisce l'imageId.
 * @param {File|Blob} file
 * @returns {Promise<string>} imageId
 */
export async function uploadImageFile(file) {
  const headers = { 'X-Image-Mime': file.type || 'image/jpeg' };
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('superbuzzer_host_token') : null;
  if (token) {
    headers['X-Host-Token'] = token;
  }
  const res = await fetch(`${getServerBase()}/image`, {
    method: 'POST',
    headers,
    body: file,
  });
  if (!res.ok) throw new Error(`Upload fallito: ${res.status}`);
  const { imageId } = await res.json();
  return imageId;
}

/**
 * Carica un'immagine a partire dalla sua stringa base64 (data URL).
 * @param {string} dataUrl  stringa "data:image/...;base64,..."
 * @returns {Promise<string>} imageId
 */
export async function uploadImageBase64(dataUrl) {
  // Converte la data URL in un Blob binario
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return uploadImageFile(blob);
}

/**
 * Restituisce l'URL HTTP per visualizzare un'immagine dato il suo ID.
 * @param {string} imageId
 * @returns {string}
 */
export function getImageUrl(imageId) {
  return `${getServerBase()}/image/${imageId}`;
}
