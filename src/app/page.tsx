import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted">
          Kisi bhi Rohtak FPS ka stock, din-wise sale, aur transactions.
        </p>
      </div>
      <Dashboard />
    </div>
  );
}
