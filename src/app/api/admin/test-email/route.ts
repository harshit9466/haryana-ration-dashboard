import { z } from "zod";
import { sendTestEmail } from "@/lib/mailer";
import { ok, fail, failFromError } from "@/lib/http";
import { readJson } from "@/lib/params";

const schema = z.object({
  emails: z.array(z.string().trim().email()).min(1, "Ek email daalo").max(5),
});

/** POST /api/admin/test-email  body: { emails: [...] } */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  try {
    const result = await sendTestEmail(parsed.data.emails);
    if (!result.ok) {
      return fail(result.error ?? "Email nahi gayi", 502);
    }
    return ok({ sent: true });
  } catch (err) {
    return failFromError(err);
  }
}
