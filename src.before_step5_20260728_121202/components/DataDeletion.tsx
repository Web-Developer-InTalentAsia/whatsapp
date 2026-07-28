import { ArrowLeft, Trash2 } from "lucide-react";

export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-zinc-800 bg-[#0c0c0e] p-6 shadow-2xl shadow-black/20 sm:p-8 lg:p-10">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-zinc-300 transition hover:border-emerald-500 hover:text-emerald-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to App
            </a>

            <span className="rounded-full border border-rose-900/50 bg-rose-950/30 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-rose-300">
              Data Deletion Request
            </span>
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Data Deletion
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
                If you want us to delete your personal data from InTalent WhatsApp Inbox, please submit a request using the contact details below. We will review and process legitimate deletion requests in line with applicable laws and internal business requirements.
              </p>
            </div>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-950/40 text-rose-300">
                <Trash2 className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold text-white">How to request deletion</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Please send an email to <a className="text-emerald-400 underline decoration-emerald-500/60" href="mailto:privacy@intalent.asia">privacy@intalent.asia</a> with the subject line <span className="font-semibold text-zinc-200">Data Deletion Request</span> and include your full name, associated email address, WhatsApp number if relevant, and a short description of the data you want removed.
              </p>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
                <h2 className="text-lg font-semibold text-white">What may be deleted</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  We can remove account records, message history, recruiter notes, and related configuration records when they are no longer needed for lawful business purposes or when your request is verified and valid.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
                <h2 className="text-lg font-semibold text-white">What may remain</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Certain records may need to be retained for legal compliance, fraud prevention, or dispute resolution. In those cases, we will keep only the minimum amount of information required and for the shortest lawful period.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Processing expectations</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                We aim to acknowledge verified requests promptly and complete the deletion process within a reasonable timeframe, subject to any legal or operational constraints. If additional information is required, we will contact you directly.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
