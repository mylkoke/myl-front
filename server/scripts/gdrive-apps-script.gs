/**
 * MYL — Subida de cartas a Google Drive vía Apps Script (sin Cloud Console).
 *
 * Instalación (una sola vez, ~3 minutos):
 *   1. Abre https://script.google.com → "Nuevo proyecto".
 *   2. Borra el contenido y pega este archivo completo.
 *   3. Cambia TOKEN por un secreto largo (p. ej. el resultado de
 *      `openssl rand -hex 24` en la terminal).
 *   4. "Implementar" → "Nueva implementación" → tipo "Aplicación web":
 *        - Ejecutar como: Yo (tu cuenta)
 *        - Quién tiene acceso: Cualquier persona
 *      → Copia la URL que termina en /exec.
 *   5. Añade a server/.env:
 *        GAS_UPLOAD_URL=<la URL /exec>
 *        GAS_UPLOAD_TOKEN=<el mismo secreto del paso 3>
 *      y reinicia el backend.
 *
 * El script guarda cada imagen en la carpeta "myl-cards" de tu Drive
 * (la crea si no existe), la hace pública por enlace y devuelve su id.
 */

const FOLDER_NAME = 'myl-cards';
const TOKEN = 'CAMBIA-ESTE-SECRETO';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!TOKEN || TOKEN === 'CAMBIA-ESTE-SECRETO' || body.token !== TOKEN) {
      return jsonResponse({ error: 'unauthorized' });
    }
    const blob = Utilities.newBlob(
      Utilities.base64Decode(body.data),
      body.mimeType || 'image/jpeg',
      body.filename || 'card.jpg',
    );
    const file = getFolder().createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return jsonResponse({ id: file.getId() });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

function getFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
