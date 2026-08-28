import { CardLookup } from "@/components/CardLookup";

export default function CardLookupPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Card Lookup</h1>
        <p className="text-sm text-muted">
          Ration card number + captcha → members, entitlement, authentication
          history, aur is mahine ki transactions.
        </p>
      </div>
      <CardLookup />
    </div>
  );
}
