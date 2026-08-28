import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Link href="/" className="text-sm text-accent underline">
        Back to dashboard
      </Link>
    </div>
  );
}
