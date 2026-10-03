import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { uploadImage, type ImagePurpose } from "@/services/api";
import { ACCEPTED_IMAGE_TYPES, cldUrl, imageFileError } from "@/lib/cloudinary";
import { apiErrorMessage } from "@/lib/http";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CloseIcon, ImageIcon, TrashIcon } from "@/components/ui/icons";
import type { UploadedImage } from "@/types/domain";

interface ImageUploaderProps {
  /** Id of the file input, for a FieldWrapper's `htmlFor`. */
  id: string;
  purpose: ImagePurpose;
  /** Most images allowed in `value`, counting uploads still running. */
  max: number;
  /** The finished uploads, in order — the first is the cover. */
  value: UploadedImage[];
  /** Takes an updater, like a `useState` setter: two uploads finishing
   *  together must each add to the latest list, not overwrite each other. */
  onChange: Dispatch<SetStateAction<UploadedImage[]>>;
  /** Told whenever uploads start or all finish, so a form can hold its submit. */
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
}

interface PendingUpload {
  key: number;
  name: string;
  /** Local preview while the file uploads; null where object URLs aren't available. */
  preview: string | null;
  progress: number;
  error: string | null;
}

/**
 * Picks image files and uploads each straight to Cloudinary as soon as
 * it's chosen (see `uploadImage`), showing progress. Finished images can
 * be removed or made the cover (moved first). Nothing is saved until the
 * form using this is submitted with `value`; an image dropped before then
 * is cleaned up on Cloudinary by the backend's orphan sweeper.
 */
export function ImageUploader({
  id,
  purpose,
  max,
  value,
  onChange,
  onUploadingChange,
  disabled,
}: ImageUploaderProps) {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const controllers = useRef(new Map<number, AbortController>());

  const running = pending.filter((p) => !p.error);
  const uploading = running.length > 0;
  const slotsLeft = max - value.length - running.length;

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  // Leaving the page cancels uploads still running.
  useEffect(() => {
    const active = controllers.current;
    return () => active.forEach((controller) => controller.abort());
  }, []);

  const updatePending = (key: number, patch: Partial<PendingUpload>) =>
    setPending((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const dropPending = (key: number) =>
    setPending((list) => {
      const item = list.find((p) => p.key === key);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return list.filter((p) => p.key !== key);
    });

  const start = async (file: File) => {
    const key = nextKey.current++;
    const preview = typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
    const controller = new AbortController();
    controllers.current.set(key, controller);
    setPending((list) => [...list, { key, name: file.name, preview, progress: 0, error: null }]);

    try {
      const uploaded = await uploadImage(file, purpose, {
        signal: controller.signal,
        onProgress: (fraction) => updatePending(key, { progress: fraction }),
      });
      onChange((images) => [...images, uploaded]);
      dropPending(key);
    } catch (error) {
      if (!controller.signal.aborted) {
        updatePending(key, { error: apiErrorMessage(error, `${file.name} couldn't be uploaded.`) });
      }
    } finally {
      controllers.current.delete(key);
    }
  };

  const handleFiles = (files: FileList | null) => {
    const problems: string[] = [];
    let room = slotsLeft;
    for (const file of Array.from(files ?? [])) {
      const problem = imageFileError(file);
      if (problem) {
        problems.push(problem);
      } else if (room <= 0) {
        problems.push(`${file.name} wasn't added — at most ${max} images.`);
      } else {
        room -= 1;
        void start(file);
      }
    }
    setRejected(problems);
    // Lets the same file be picked again after it was removed.
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (index: number) => onChange((images) => images.filter((_, i) => i !== index));

  const makeCover = (index: number) =>
    onChange((images) => [images[index], ...images.filter((_, i) => i !== index)]);

  return (
    <div className="space-y-3">
      {(value.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((image, index) => (
            <li key={image.publicId} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="relative aspect-square bg-slate-100">
                <img
                  src={cldUrl(image, "thumb")}
                  alt={`Image ${index + 1}`}
                  className="h-full w-full object-cover"
                />
                {index === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-white">
                    Cover
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                {index === 0 ? (
                  <span className="px-1 text-xs text-slate-500">Shown first</span>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => makeCover(index)}
                    disabled={disabled}
                    aria-label={`Set image ${index + 1} as cover`}
                  >
                    Set as cover
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-red-600 hover:bg-red-50"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  aria-label={`Remove image ${index + 1}`}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
          {pending.map((item) => (
            <li
              key={`pending-${item.key}`}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white"
              aria-label={item.error ? `${item.name} failed` : `Uploading ${item.name}`}
            >
              <div className="relative flex aspect-square items-center justify-center bg-slate-100">
                {item.preview ? (
                  <img src={item.preview} alt="" className="h-full w-full object-cover opacity-60" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-slate-400" />
                )}
              </div>
              <div className="space-y-1 p-1.5">
                {item.error ? (
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs text-red-600">{item.error}</p>
                    <button
                      type="button"
                      onClick={() => dropPending(item.key)}
                      className="shrink-0 text-slate-400 hover:text-slate-600"
                      aria-label={`Dismiss ${item.name}`}
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <ProgressBar value={Math.round(item.progress * 100)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          multiple={max > 1}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled || slotsLeft <= 0}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || slotsLeft <= 0}
        >
          <ImageIcon className="h-4 w-4" />
          {value.length > 0 ? "Add more images" : max > 1 ? "Add images" : "Choose image"}
        </Button>
        <span className="text-xs text-slate-500">
          {value.length + running.length} of {max} · JPG, PNG or WebP, up to 5 MB each
        </span>
      </div>

      {rejected.length > 0 && (
        <ul className="space-y-0.5 text-sm text-red-600">
          {rejected.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
