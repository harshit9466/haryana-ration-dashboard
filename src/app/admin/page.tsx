import { AdminPanel } from "@/components/AdminPanel";

export default function AdminPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Monitor Setup</h1>
        <p className="text-sm text-muted">
          Jo FPS yahan add karoge — wo din ki pehli ration de to email, aur din ke
          end me summary email. Poll sirf shop hours me chalta hai.
        </p>
      </div>
      <AdminPanel />
    </div>
  );
}
