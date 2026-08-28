import { CardLookup } from "@/components/CardLookup";

export default async function CardLookupPage(props: PageProps<"/card">) {
  const { rc } = await props.searchParams;
  const initialRc = typeof rc === "string" ? rc.replace(/\D/g, "") : "";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Card Lookup</h1>
        <p className="text-sm text-muted">
          Ration card number + captcha → members, entitlement, authentication
          history, and this month&apos;s transactions.
        </p>
      </div>
      <CardLookup initialRc={initialRc} />
    </div>
  );
}
