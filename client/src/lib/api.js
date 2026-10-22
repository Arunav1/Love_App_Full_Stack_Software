async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error ?? `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  patch: (url, body) => request('PATCH', url, body),
  del: (url) => request('DELETE', url),
};

/** Upload with progress (fetch can't report upload progress, XHR can). */
export function uploadFiles(files, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    form.append('lastModified', JSON.stringify(files.map((f) => f.lastModified)));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/media');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        xhr.status < 400 ? resolve(data) : reject(new Error(data.error ?? 'Upload failed'));
      } catch {
        reject(new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading'));
    xhr.send(form);
  });
}

export const mediaUrl = (m) => `/media/${m.file}`;
export const thumbUrl = (m) => (m.thumb ? `/thumbs/${m.thumb}` : m.type === 'image' ? mediaUrl(m) : null);
