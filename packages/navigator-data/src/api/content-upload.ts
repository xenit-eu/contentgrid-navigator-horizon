export interface ContentUploadHandle {
  readonly abort: () => void;
  readonly promise: Promise<void>;
}

/**
 * Upload a file to a content URL via XHR.
 *
 * fetch lacks upload progress events — XHR is the only browser API that exposes
 * xhr.upload.onprogress. The promise resolves on HTTP 2xx and rejects otherwise.
 *
 * @param url      - PUT target (cg:content link href)
 * @param file     - File object to upload
 * @param token    - Bearer token; null sends the request without an Authorization header
 * @param onProgress - Called with integer 0–100 as bytes are sent
 */
export function uploadContent(
  url: string,
  file: File,
  token: string | null,
  onProgress: (percentage: number) => void,
): ContentUploadHandle {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<void>((resolve, reject) => {
    xhr.open("PUT", url, true);

    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = function () {
      reject(new Error("Upload failed: network error"));
    };

    xhr.ontimeout = function () {
      reject(new Error("Upload failed: timeout"));
    };

    xhr.send(file);
  });

  return { abort: () => xhr.abort(), promise };
}
