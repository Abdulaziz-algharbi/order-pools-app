/**
 * Cloudinary image helpers: building image URLs, and sending a file to
 * Cloudinary with parameters the backend signed.
 *
 * Uploads go straight from the browser to Cloudinary — the file never
 * passes through our API. The backend only signs the upload (it alone
 * holds the secret, and it chooses the folder from the session), then
 * verifies the signed result when the image is saved. So this module
 * talks to Cloudinary directly with its own axios instance, without the
 * API client's cookies or CSRF header, which must never reach a third
 * party. Pages don't call `uploadToCloudinary` themselves — they use
 * `uploadImage()` from `services/api.ts`, which gets the signature first.
 */
import axios from "axios";
import { ApiError } from "@/lib/http";
import type { ImageRef, UploadedImage } from "@/types/domain";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

/**
 * The sizes the app shows images at. Each crops or limits on Cloudinary's
 * side, and `f_auto,q_auto` lets it pick the lightest format/quality the
 * browser supports, so a card never downloads the full upload.
 */
export const IMAGE_PRESETS = {
  /** Small square, e.g. a gallery thumbnail strip or an upload preview. */
  thumb: "c_fill,w_160,h_160",
  /** A pool card's cover, 16:10. */
  card: "c_fill,w_640,h_400",
  /** The main image on a detail page, never cropped. */
  gallery: "c_limit,w_1600,h_1600",
  /** A profile picture, square, centred on a face if there is one. */
  avatar: "c_fill,g_auto,w_256,h_256",
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export function cldUrl(image: ImageRef, preset: ImagePreset): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${IMAGE_PRESETS[preset]},f_auto,q_auto/v${image.version}/${image.publicId}`;
}

/** What `POST /uploads/{offer-image|profile-image}/signature` returns. */
export interface SignedUpload {
  uploadUrl: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  /** Sent back unchanged — Cloudinary refuses the upload if any differ from what was signed. */
  params: Record<string, string | number>;
}

export interface UploadOptions {
  /** Called with 0–1 as the file is sent. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

// No credentials, no XSRF header: Cloudinary is a third party.
const cloudinaryClient = axios.create();

/**
 * Sends one file to Cloudinary with a signature from the backend. Throws
 * an `ApiError` carrying Cloudinary's own reason (e.g. a file type that
 * isn't allowed) when it refuses.
 */
export async function uploadToCloudinary(
  signed: SignedUpload,
  file: File,
  { onProgress, signal }: UploadOptions = {},
): Promise<UploadedImage> {
  const form = new FormData();
  for (const [key, value] of Object.entries(signed.params)) form.append(key, String(value));
  form.append("timestamp", String(signed.timestamp));
  form.append("api_key", signed.apiKey);
  form.append("signature", signed.signature);
  form.append("file", file);

  try {
    const res = await cloudinaryClient.post<{
      public_id: string;
      version: number;
      signature: string;
      width?: number;
      height?: number;
    }>(signed.uploadUrl, form, {
      signal,
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(event.loaded / event.total);
      },
    });
    const { public_id, version, signature, width, height } = res.data;
    return {
      publicId: public_id,
      version,
      signature,
      ...(width !== undefined && { width }),
      ...(height !== undefined && { height }),
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const reason = (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
      throw new ApiError(
        reason ? `The image couldn't be uploaded: ${reason}` : "The image couldn't be uploaded. Please try again.",
        error.response?.status ?? 0,
      );
    }
    throw error;
  }
}
