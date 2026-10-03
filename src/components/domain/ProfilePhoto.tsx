import { useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { uploadImage } from "@/services/api";
import { ACCEPTED_IMAGE_TYPES, imageFileError } from "@/lib/cloudinary";
import { apiErrorMessage } from "@/lib/http";
import { Avatar } from "@/components/domain/Avatar";
import { Button } from "@/components/ui/Button";

/**
 * The signed-in user's profile photo, with buttons to upload, change or
 * remove it. A picked file is uploaded straight to Cloudinary, then saved
 * on the account (`PATCH /auth/me`); the backend deletes the photo it
 * replaces.
 */
export function ProfilePhoto() {
  const { user, updateProfile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"uploading" | "removing" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleFile = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    const problem = imageFileError(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy("uploading");
    try {
      const uploaded = await uploadImage(file, "profile");
      await updateProfile({ profileImage: uploaded });
    } catch (e) {
      setError(apiErrorMessage(e, "Could not update your photo."));
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    setError(null);
    setBusy("removing");
    try {
      await updateProfile({ profileImage: null });
    } catch (e) {
      setError(apiErrorMessage(e, "Could not remove your photo."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar user={user} size="lg" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id="profile-photo"
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            aria-label="Profile photo"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
            disabled={!!busy}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            isLoading={busy === "uploading"}
            disabled={!!busy}
          >
            {user.profileImage ? "Change photo" : "Upload photo"}
          </Button>
          {user.profileImage && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={handleRemove}
              isLoading={busy === "removing"}
              disabled={!!busy}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">JPG, PNG or WebP, up to 5 MB.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
