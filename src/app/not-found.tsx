import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="text-lg font-semibold">Page nahi mila</h1>
      <Link href="/" className="text-sm text-accent underline">
        Dashboard pe wapas
      </Link>
    </div>
  );
}
