"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="text-lg font-semibold">Kuch gadbad ho gayi</h1>
      <p className="text-sm text-muted">
        {error.message || "Unexpected error"}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-border px-4 py-2 text-sm"
      >
        Dobara try karo
      </button>
    </div>
  );
}
