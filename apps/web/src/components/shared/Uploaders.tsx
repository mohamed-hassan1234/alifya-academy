import { forwardRef, useId, useRef, useState, type InputHTMLAttributes } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate,
  faCloudArrowUp,
  faEye,
  faEyeSlash,
  faFile,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { MEDIA_PURPOSES, type MediaAssetDto, type MediaPurpose } from '@alifya/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { apiUpload, normalizeError } from '@/lib/api';
import { cn } from '@/lib/utils';

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

/** Client-side pre-check for fast feedback. The server re-validates by sniffing file content. */
function precheck(file: File, purpose: MediaPurpose): string | null {
  const rule = MEDIA_PURPOSES[purpose];
  if (file.size > rule.maxBytes) return `File is too large (max ${mb(rule.maxBytes)}).`;
  if (file.type && !(rule.types as readonly string[]).includes(file.type))
    return 'This file type is not allowed here.';
  return null;
}

function useUpload(purpose: MediaPurpose) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (file: File): Promise<MediaAssetDto | null> => {
    setError(null);
    const pre = precheck(file, purpose);
    if (pre) {
      setError(pre);
      return null;
    }
    setProgress(0);
    try {
      return await apiUpload(file, purpose, setProgress);
    } catch (err) {
      const e = normalizeError(err);
      setError(e.fields.file && e.fields.file !== 'Required' ? `${e.message}: ${e.fields.file}` : e.message);
      return null;
    } finally {
      setProgress(null);
    }
  };
  return { progress, error, run };
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-mint"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full bg-primary transition-[width]" style={{ width: `${value}%` }} />
    </div>
  );
}

interface ImageUploaderProps {
  label: string;
  purpose: MediaPurpose;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  /** CSS aspect ratio of the preview, e.g. '16/10' or '1/1'. */
  aspect?: string;
  hint?: string;
  error?: string;
}

/** Select → validate → preview → upload (with progress) → replace / remove. */
export function ImageUploader({
  label,
  purpose,
  value,
  onChange,
  aspect = '16/10',
  hint,
  error,
}: ImageUploaderProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const { progress, error: uploadError, run } = useUpload(purpose);
  const rule = MEDIA_PURPOSES[purpose];
  const message = uploadError ?? error;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const asset = await run(file);
    if (asset) onChange(asset.url);
    if (input.current) input.current.value = '';
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-semibold">
        {label}
      </span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          className="relative w-full max-w-[16rem] overflow-hidden rounded-md border border-border bg-mint"
          style={{ aspectRatio: aspect }}
        >
          {value ? (
            <img src={value} alt={`${label} preview`} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center p-4 text-center text-xs text-muted-foreground">
              No image yet
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={input}
            id={id}
            type="file"
            accept={rule.types.join(',')}
            className="sr-only"
            aria-labelledby={`${id}-label`}
            aria-describedby={`${id}-hint`}
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={progress !== null}
              onClick={() => input.current?.click()}
            >
              <FontAwesomeIcon icon={value ? faArrowsRotate : faCloudArrowUp} aria-hidden />{' '}
              {value ? 'Replace' : 'Upload image'}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-danger"
                onClick={() => onChange(null)}
              >
                <FontAwesomeIcon icon={faTrash} aria-hidden /> Remove
              </Button>
            )}
          </div>
          {progress !== null && <ProgressBar value={progress} />}
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint ?? `JPG, PNG, WebP or GIF up to ${mb(rule.maxBytes)}.`}
          </p>
          {message && (
            <p role="alert" className="text-xs font-medium text-danger">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Generic file uploader (lesson PDFs, videos, documents). Returns the stored asset. */
export function FileUploader({
  label,
  purpose,
  onUploaded,
  accept,
}: {
  label: string;
  purpose: MediaPurpose;
  onUploaded: (asset: MediaAssetDto) => void;
  accept?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const { progress, error, run } = useUpload(purpose);
  const rule = MEDIA_PURPOSES[purpose];
  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        id={id}
        type="file"
        className="sr-only"
        accept={accept ?? rule.types.join(',')}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            const asset = await run(f);
            if (asset) onUploaded(asset);
          }
          e.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        loading={progress !== null}
        onClick={() => input.current?.click()}
      >
        <FontAwesomeIcon icon={faFile} aria-hidden /> {label}
      </Button>
      {progress !== null && <ProgressBar value={progress} />}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Password input with an accessible show/hide toggle. */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground hover:text-primary"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        <FontAwesomeIcon icon={visible ? faEyeSlash : faEye} />
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';
