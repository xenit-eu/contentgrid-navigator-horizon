import { useCallback, useRef, useState } from "react";
import { uploadContent } from "../api/content-upload";
import { useNavigatorData } from "./context";

export type ContentUploadStatus = "idle" | "uploading" | "done" | "error";

export interface ContentUploadState {
  readonly status: ContentUploadStatus;
  readonly progress: number;
}

const IDLE: ContentUploadState = { status: "idle", progress: 0 };

/**
 * Manages a single file upload over XHR.
 *
 * One hook instance = one upload slot. Multiple concurrent uploads are
 * achieved by mounting multiple consumers (e.g. one per content attribute).
 *
 * @param url  - PUT target (cg:content link href), or null when not yet known.
 * @param file - File selected by the user, or null when nothing is selected.
 */
export function useContentUpload(
  url: string | null,
  file: File | null,
): {
  uploadState: ContentUploadState;
  upload: () => void;
  cancel: () => void;
  retry: () => void;
} {
  const { getToken } = useNavigatorData();
  const [uploadState, setContentUploadState] = useState<ContentUploadState>(IDLE);
  const abortRef = useRef<(() => void) | null>(null);
  const lastParamsRef = useRef<{ url: string; file: File } | null>(null);

  const startUpload = useCallback(
    async (uploadUrl: string, uploadFile: File) => {
      setContentUploadState({ status: "uploading", progress: 0 });
      lastParamsRef.current = { url: uploadUrl, file: uploadFile };

      const token = await getToken();
      const handle = uploadContent(uploadUrl, uploadFile, token, (percentage) => {
        setContentUploadState({ status: "uploading", progress: percentage });
      });
      abortRef.current = handle.abort;

      handle.promise.then(
        () => {
          abortRef.current = null;
          setContentUploadState({ status: "done", progress: 100 });
        },
        () => {
          abortRef.current = null;
          setContentUploadState({ status: "error", progress: 0 });
        },
      );
    },
    [getToken],
  );

  const upload = useCallback(() => {
    if (!url || !file) return;
    startUpload(url, file);
  }, [url, file, startUpload]);

  const cancel = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setContentUploadState(IDLE);
  }, []);

  const retry = useCallback(() => {
    const last = lastParamsRef.current;
    if (!last) return;
    startUpload(last.url, last.file);
  }, [startUpload]);

  return { uploadState, upload, cancel, retry };
}
