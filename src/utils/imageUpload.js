// imageUpload.js – Carica immagini sul server HTTP (evita WS per dati binari grossi)

const HTTP_PORT = 3001;

function getServerBase() {
  const host = window.location.hostname;
  return `http://${host}:${HTTP_PORT}`;
}

/**
 * Carica un File/Blob immagine sul server e restituisce l'imageId.
 * @param {File|Blob} file
 * @returns {Promise<string>} imageId
 */
export async function uploadImageFile(file) {
  const res = await fetch(`${getServerBase()}/image`, {
    method: 'POST',
    headers: { 'X-Image-Mime': file.type || 'image/jpeg' },
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
