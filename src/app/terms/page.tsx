import type { Metadata } from "next";
import { CHECKOUT_LIVE, PRICES } from "@/components/landing/pricing";
import { ContactLine, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms", description: "The terms for using Trailerly to make App Store videos." };

export default function Terms() {
  return (
    <LegalPage title="Terms" updated="26 October 2026">
      <p>These terms cover using Trailerly to make videos for your app. By making a pack you agree to them.</p>

      <h2>Your content</h2>
      <ul>
        <li>You need the right to use the app, recording and listing you give us. Usually that means it&apos;s your app.</li>
        <li>You keep ownership of your recording and of the videos we make for you. You give us permission to process them only to make and deliver your pack.</li>
        <li>Don&apos;t upload anything illegal or anything you don&apos;t have permission to share.</li>
      </ul>

      <h2>Drafts and packs</h2>
      <ul>
        <li>Drafts are free to make and preview.</li>
        <li>
          {CHECKOUT_LIVE
            ? `A pack costs ${PRICES.launch ?? "the price shown at checkout"}, paid once. There is no subscription.`
            : `Paid downloads aren't open yet. When they open, a pack will be ${PRICES.launch ?? "a one-off price shown at checkout"}, paid once, with no subscription.`}
        </li>
      </ul>

      <h2>Apple&apos;s review</h2>
      <p>We check every video against Apple&apos;s published rules for each slot and show you the results. Apple makes the final decision in App Review, so we can&apos;t promise a video will be accepted.</p>

      <h2>The service</h2>
      <p>We work hard to keep Trailerly running and your files safe, but the service is provided as it is. We may change or pause features, and we&apos;ll update these terms when that affects you.</p>
      <ContactLine />
    </LegalPage>
  );
}
