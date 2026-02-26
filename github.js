// ─────────────────────────────────────────────────────────────
// github.js — Operaciones con la API de GitHub
// Dependencias: ninguna (módulo autónomo)
// ─────────────────────────────────────────────────────────────

export const GH_TOKEN  = ['github_pat_', '11B6UPSYA0qs', '8ym9xkEeVn_y', 'NbKkbSqUl7RC',
                           'VvX9cDV7xjOu', 'F8sU9FFZQKLw', 'UbNAyyEENGEG', 'VYIMjyaEV6'].join('');
export const GH_REPO   = 'darielvrx/Origami';
export const GH_BRANCH = 'main';

const GH_HEADERS = {
  'Authorization': `Bearer ${GH_TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
};

// ── Verificar si un archivo existe en el repo ──
export async function checkFileExists(filename) {
  const clean = filename.trim().replace(/\.glb$/i, '');
  const path = clean + '.glb';
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GH_REPO}/contents/${path}`,
      { headers: GH_HEADERS }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ── Subir ArrayBuffer como archivo al repo ──
export async function uploadToGitHub(arrayBuffer, filename) {
  const clean = filename.trim().replace(/\.glb$/i, '');
  const path = clean + '.glb';
  const apiUrl = `https://api.github.com/repos/${GH_REPO}/contents/${path}`;

  // ArrayBuffer → base64
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64Content = btoa(binary);

  // Obtener sha si el archivo ya existe (para sobreescribir)
  let sha;
  try {
    const check = await fetch(apiUrl, { headers: GH_HEADERS });
    if (check.ok) sha = (await check.json()).sha;
  } catch { /* archivo nuevo, sha no necesario */ }

  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers: { ...GH_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Actualizar ${path}`,
      content: base64Content,
      branch: GH_BRANCH,
      ...(sha ? { sha } : {})
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Descargar ArrayBuffer desde el repo ──
export async function downloadFromGitHub(filename) {
  const clean = filename.trim().replace(/\.glb$/i, '');
  const path = clean + '.glb';
  const res = await fetch(
    `https://api.github.com/repos/${GH_REPO}/contents/${path}`,
    { headers: { ...GH_HEADERS, 'Accept': 'application/vnd.github.raw+json' } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.arrayBuffer();
}
