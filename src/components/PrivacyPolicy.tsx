import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";

export default function PrivacyPolicy() {
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

            <span className="rounded-full border border-emerald-900/50 bg-emerald-950/30 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">
              Privacy Policy
            </span>
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Privacy Policy
              </h1>
              <p className="mt-3 text-sm font-medium text-emerald-400 sm:text-base">
                Effective date: January 1st, 2022
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
                InTalent (Pvt) Ltd (“us”, “we”, or “our”) operates the following websites (the “Service”):
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
                www.intalent.lk
                <br />
                www.intalent.asia
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
                This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
                We use your data to provide and improve the Service. By using the Service, you agree to the collection and use of information in accordance with this policy. Unless otherwise defined in this Privacy Policy, terms used in this Privacy Policy have the same meanings as in our Terms and Conditions, accessible from the above-mentioned websites.
              </p>
            </div>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Information Collection And Use</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                We collect several different types of information for various purposes to provide and improve our Service to you.
              </p>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/40 text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-white">Personal Data</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  While using our Service, we may ask you to provide us with certain personally identifiable information that can be used to contact or identify you (“Personal Data”). Personally identifiable information may include, but is not limited to: email address, first name and last name, phone number, address, state, province, ZIP/postal code, city, cookies, and usage data.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/40 text-emerald-400">
                  <Lock className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-white">Usage Data</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  We may also collect information how the Service is accessed and used (“Usage Data”). This Usage Data may include information such as your computer’s Internet Protocol address (e.g. IP address), browser type, browser version, the pages of our Service that you visit, the time and date of your visit, the time spent on those pages, unique device identifiers, and other diagnostic data.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Tracking & Cookies Data</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                We use cookies and similar tracking technologies to track the activity on our Service and hold certain information. Cookies are files with small amounts of data which may include an anonymous unique identifier. Cookies are sent to your browser from a website and stored on your device. Tracking technologies also used are beacons, tags, and scripts to collect and track information and to improve and analyze our Service.
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Examples of cookies we use: Session Cookies to operate our Service, Preference Cookies to remember your preferences and various settings, and Security Cookies for security purposes.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Use of Data</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                InTalent (Pvt) Ltd uses the collected data for various purposes, including to provide and maintain the Service, notify you about changes to our Service, allow you to participate in interactive features of our Service when you choose to do so, provide customer care and support, provide analysis or valuable information so that we can improve the Service, monitor the usage of the Service, and detect, prevent, and address technical issues.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Transfer Of Data</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Your information, including Personal Data, may be transferred to and maintained on computers located outside of your state, province, country, or other governmental jurisdiction where the data protection laws may differ from those from your jurisdiction.
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                If you are located outside Sri Lanka and choose to provide information to us, please note that we transfer the data, including Personal Data, to Sri Lanka and process it there. InTalent (Pvt) Ltd will take all steps reasonably necessary to ensure that your data is treated securely and in accordance with this Privacy Policy.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Disclosure Of Data</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                InTalent (Pvt) Ltd may disclose your Personal Data in the good faith belief that such action is necessary to comply with a legal obligation, protect and defend the rights or property of InTalent (Pvt) Ltd, prevent or investigate possible wrongdoing in connection with the Service, protect the personal safety of users of the Service or the public, and protect against legal liability.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Security Of Data</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage, is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Service Providers & Analytics</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                We may employ third party companies and individuals to facilitate our Service (“Service Providers”). We use third-party Service Providers to monitor and analyze the use of our Service.
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Google Analytics is a web analytics service offered by Google that tracks and reports website traffic. Google uses the data collected to track and monitor the use of our Service. This data is shared with other Google services.
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                For more information on the privacy practices of Google, please visit the Google Privacy & Terms web page: <a className="text-emerald-400 underline decoration-emerald-500/60" href="https://policies.google.com/privacy?hl=en" target="_blank" rel="noreferrer">https://policies.google.com/privacy?hl=en</a>.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Children’s Privacy</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Our Service does not address anyone under the age of 18 (“Children”). We do not knowingly collect personally identifiable information from anyone under the age of 18.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Equal Employment Opportunity Policy Statement</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                It is the policy of InTalent (Pvt) Ltd not to discriminate against any applicant for employment, or any employee because of age, color, sex, disability, national origin, race, religion, or veteran status.
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                InTalent (Pvt) Ltd will take affirmative action to ensure that the EEO Policy is implemented, with particular regard to advertising, application procedures, compensation, demotion, employment, fringe benefits, job assignment, job classification, layoff, leave, promotion, recruitment, rehire, social activities, training, termination, transfer, upgrade, and working conditions.
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                It is the policy of InTalent (Pvt) Ltd that all company activities, facilities, and job sites are non-segregated. Separate or single-user toilet and changing facilities are provided to assure privacy.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Whistleblowing Policy</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                InTalent (Pvt) Ltd is committed to conducting business fairly, honestly, and with transparency. We encourage employees to report any concerns as soon as they arise. This policy aims to encourage and empower colleagues to speak up and report suspected wrongdoing, provide colleagues with guidance as to how to raise those concerns, reassure colleagues that they will be able to raise genuine concerns without fear of reprisals, and encourage a culture of openness.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Changes To This Privacy Policy</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the “effective date” at the top of this page.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Contact Us</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                If you have any questions about this Privacy Policy, please contact us:
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                By email: <a className="text-emerald-400 underline decoration-emerald-500/60" href="mailto:heshani@intalent.asia">heshani@intalent.asia</a>
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                By phone number: <a className="text-emerald-400 underline decoration-emerald-500/60" href="tel:+94117088811">+94-117-088-811</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
