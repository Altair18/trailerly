import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy", description: "What Trailerly collects, why, and who helps us process it." };

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="26 October 2026">
      <p>Trailerly turns your App Store listing and a screen recording of your app into marketing videos. This page explains what we collect to do that and who helps us.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Your account:</b> your email address, so you can sign in and come back to your packs.</li>
        <li><b>Your App Store link and listing:</b> the public name, icon, screenshots, description and recent reviews of the app you link.</li>
        <li><b>Your screen recording:</b> the video you upload, and the clips, notes and drafts we make from it.</li>
        <li><b>Your choices:</b> the hooks, edits and rules results for each pack.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>Your recording is only used to make your pack. We don&apos;t use it to advertise anything else.</li>
        <li>Reviews are used to write hook ideas. Reviewer names are never kept.</li>
        <li>When a recording shows private information, we blur those parts or replace them with your App Store screenshots.</li>
      </ul>

      <h2>Who helps us</h2>
      <p>We use these services to run Trailerly. Each one only gets what it needs for its part of the job.</p>
      <ul>
        <li><b>Supabase</b> (hosted in London) stores your account, recordings and packs.</li>
        <li><b>Vercel</b> hosts the website.</li>
        <li><b>Anthropic</b> (Claude) reads your listing, reviews and frames from your recording to plan hooks, captions and edits.</li>
        <li><b>Trigger.dev</b> runs the background jobs that cut and render your videos.</li>
        <li><b>AI video providers</b> may make the short AI scenes some header and search videos include. Every AI scene is labelled in your rules check.</li>
        <li><b>Stripe</b> will handle payments when checkout opens. We never see your card details.</li>
        <li><b>Google Fonts</b> serves the fonts on this site, which means your browser asks Google for them.</li>
      </ul>

      <h2>Your choices</h2>
      <p>You can ask us to show you, correct or delete your account and everything in it. Under UK and EU data protection law you can also complain to your local data protection authority.</p>
      <ContactLine />
    </LegalPage>
  );
}
