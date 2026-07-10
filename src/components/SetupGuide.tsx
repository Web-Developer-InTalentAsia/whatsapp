import React from "react";
import { BookOpen, CheckSquare, Smartphone, Key, Settings, ArrowRight, CornerDownRight, CheckCircle2 } from "lucide-react";

export default function SetupGuide() {
  const steps = [
    {
      title: "1. Create a Meta Developer Account & App",
      desc: "Go to developers.facebook.com, register an account, and create a 'Business' or 'Other' app type. Add the 'WhatsApp' product to your app configuration list."
    },
    {
      title: "2. Set up Test WhatsApp Phone Number",
      desc: "In your WhatsApp App Setup dashboard, choose a WhatsApp Test Number (provided by Meta). Note down your temporary developer access token, Phone Number ID, and WhatsApp Business Account ID."
    },
    {
      title: "3. Configure Meta webhook Webhook details",
      desc: "Go to 'WhatsApp -> Configuration' settings inside Developers portal. Click 'Edit' on Webhooks. Copy-paste the Webhook Callback URL shown in this app's WhatsApp credentials tab, and enter your chosen Verify Token."
    },
    {
      title: "4. Subscribe to Webhook events",
      desc: "Once verified, click 'Manage Webhooks' in Meta portal and 'Subscribe' to the 'messages' feed. This triggers real-time candidate delivery directly to your InTalent container!"
    },
    {
      title: "5. Register credentials here & Test",
      desc: "Enter all IDs, Tokens and Secrets into InTalent Settings, click 'Save' and 'Verify Webhook'. Finally, send an inbound text message to verify candidate ingestion."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 font-sans">
      
      {/* Header card */}
      <div className="bg-emerald-950/20 border border-emerald-900/50 text-zinc-100 p-6 md:p-8 rounded-2xl shadow-xl flex items-center justify-between gap-6">
        <div className="space-y-2 max-w-lg">
          <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">Interactive Recruiting Onboarding</span>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Meta WhatsApp Cloud API Setup Guide</h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Follow our 5-step integration protocol to securely wire your Meta Cloud Business lines, verify webhooks, and start receiving inbound candidate responses immediately.
          </p>
        </div>
        <BookOpen className="h-16 w-16 text-emerald-500/20 shrink-0 hidden sm:block" />
      </div>

      {/* Main Steps Timeline */}
      <div className="bg-[#0c0c0e] border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
        <h3 className="font-bold text-zinc-200 text-base flex items-center gap-2">
          <Settings className="h-5 w-5 text-emerald-500 animate-spin-slow" />
          5-Step Meta Credentials Verification Guide
        </h3>

        <div className="relative border-l-2 border-zinc-800 pl-6 space-y-8 ml-3">
          {steps.map((st, idx) => (
            <div key={idx} className="relative">
              
              {/* Timeline circle badge */}
              <span className="absolute -left-10 top-0.5 h-7.5 w-7.5 rounded-full bg-emerald-600 border-4 border-[#0c0c0e] text-white font-bold flex items-center justify-center text-xs shadow-sm">
                {idx + 1}
              </span>

              <div className="space-y-1.5">
                <h4 className="font-bold text-zinc-200 text-sm">{st.title}</h4>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">{st.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code Snippet Verification example card */}
      <div className="bg-[#0c0c0e] border border-zinc-800 text-zinc-100 rounded-2xl p-6 shadow-xl space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <span className="font-bold text-[10px] text-emerald-400 uppercase tracking-wider font-sans">
            Webhook Verification Contract
          </span>
          <span className="bg-zinc-900 border border-zinc-850 text-zinc-400 px-2 py-0.5 rounded text-[10px]">Verified Safe</span>
        </div>
        <p className="text-zinc-400 leading-normal font-sans text-xs">
          Meta verifies your webhook by sending a custom GET challenge response parameter. InTalent verifies this automatically in server.ts:
        </p>
        <pre className="bg-zinc-950 border border-zinc-900 p-3 rounded-lg overflow-x-auto text-[11px] leading-relaxed text-emerald-400">
{`app.get("/webhooks/whatsapp/:numberId", async (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
  const dbToken = await getVerifyTokenFromDatabase(req.params.numberId);
  
  if (mode === "subscribe" && token === dbToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});`}
        </pre>
      </div>

      {/* Verification instructions alert */}
      <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4 text-xs text-amber-300 space-y-1.5 leading-relaxed">
        <h5 className="font-bold flex items-center gap-1.5 text-amber-200">
          <CheckSquare className="h-4.5 w-4.5 text-amber-500" />
          Live Test Requirements Checklist
        </h5>
        <ul className="list-disc list-inside space-y-1 pl-1 text-amber-400">
          <li>Ensure the Meta App Secret token matches your Developers App Console settings exactly.</li>
          <li>For testing without paying Meta, add candidate numbers to your **Meta Web Developer Sandbox White-list** first!</li>
          <li>Inbound responses will automatically appear inside the **InTalent Inbox** in less than 500ms.</li>
        </ul>
      </div>

    </div>
  );
}
