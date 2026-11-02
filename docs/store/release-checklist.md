# Store release checklist (version 1.0.0)

Work top to bottom. [Bracketed] items are things only you can provide. Steps marked **You** happen in a browser or console; the rest are commands in this repo.

## 0. Before anything

- [ ] **You:** Apple Developer Program membership ($99/year), as an organization if you sell to businesses (needs a D-U-N-S number; this takes days).
- [ ] **You:** Google Play developer account ($25), organization account.
  - New _personal_ accounts must run a closed test with at least 12 testers for 14 days before going to production. Organization accounts don't.
- [ ] **You:** production Supabase project set up per `docs/environments.md`:
  - Vault secrets;
  - Auth: email confirmations **on**, custom SMTP, rate limits, redirect URL `petsitter://**`;
  - Edge Functions deployed;
  - Point-in-Time Recovery.
- [ ] **You:** admin site deployed over HTTPS at [ADMIN SITE URL], with `/privacy`, `/terms`, `/account-deletion` and `/support` loading signed out.
- [ ] **You:** a lawyer has reviewed `docs/legal/*.md`. Fill in every [bracket] and remove the DRAFT notes before submitting. Both stores check these pages.
- [ ] **You:** EAS environment `production` variables (`eas env:create --environment production`):
  - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_LEGAL_URL` (= admin site URL)
  - `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`
  - `SENTRY_AUTH_TOKEN` (secret)
  - `GOOGLE_SERVICES_JSON` (file, for the Firebase Android app with package `com.kasamdh.petsitter`)
- [ ] Run `npm run check`. Everything must pass.

## 1. App Store Connect (iOS)

1. **You:** in Certificates, Identifiers & Profiles, check that the App ID `com.kasamdh.petsitter` exists with **Push Notifications** turned on. EAS creates it on the first build if you let it.
2. **You:** in App Store Connect, go to My Apps > + > New App:
   - Platform: iOS
   - Name: **Petsitters**. If the name is taken, pick another and change `name` in `apps/mobile/app.config.ts`.
   - Primary language: English (U.S.)
   - Bundle ID: `com.kasamdh.petsitter`
   - SKU: `petsitter-ios`
3. Copy the app's **Apple ID** (a number, under App Information) into `apps/mobile/eas.json` > `submit.production.ios.ascAppId`, and commit.
4. **You:** App Information:
   - Subtitle, for example "Pet sitting visits, live".
   - Category: **Business** (secondary: Lifestyle).
   - Content Rights: no third-party content.
   - Age Rating questionnaire: no objectionable content. Answer **Yes** to user-generated content / messaging (private chat between a business and its clients), then **4+**, or 9+ if Apple derives it.
5. **You:** App Privacy:
   - Privacy Policy URL: `[ADMIN SITE URL]/privacy`.
   - Data types: fill them in exactly as in `docs/store/privacy-labels.md` (Apple section). Tracking: **No**. Publish.
6. **You:** Pricing and Availability: Free, with the countries you've checked legally.
7. **You:** Version 1.0.0 page:
   - **Screenshots:** 6.9" iPhone (1320 × 2868) is required; 6.5" is optional. Take at least 3: owner home with live visit, sitter visit screen, report card.
   - **Promotional text, description, keywords:** keywords for example "pet sitter, dog walker, cat sitting, pet care, visits".
   - **Support URL:** `[ADMIN SITE URL]/support`. **Marketing URL:** optional.
   - **Copyright:** "2026 [COMPANY LEGAL NAME]".
   - **App Review Information:** contact details, sign-in = the sitter demo account, Notes = `docs/store/app-review-notes.md`.
   - **Version release:** "Manually release this version", so you control launch day.
8. Export compliance is already answered in the app (`ITSAppUsesNonExemptEncryption = false`; the app uses only standard HTTPS).

## 2. Google Play Console (Android)

1. **You:** Create app:
   - Name: Petsitters
   - Default language: English (US)
   - App, Free
   - Accept the declarations.
2. **You:** Set up > App signing: keep **Play App Signing** (the default). EAS signs uploads with its upload key.
3. **You:** API access for automated submit:
   - In Google Cloud, create a service account with **no** project roles, and create a JSON key.
   - In Play Console > Users and permissions, invite the service account email with release permissions for this app.
   - Save the key as `apps/mobile/secrets/google-play-service-account.json`. It is git-ignored; never commit it.
4. **You:** App content (Policy > App content):
   - **Privacy policy:** `[ADMIN SITE URL]/privacy`.
   - **App access:** restricted; add both demo accounts and the notes from `app-review-notes.md`.
   - **Ads:** No ads.
   - **Content rating (IARC):** category Utility/Productivity. Users can interact or exchange content: **Yes**, private messages. Shares user location with other users: **No** (check-in location is stored, never shown to others). Digital purchases: No.
   - **Target audience:** 18 and over. Not designed for children.
   - **Data safety:** exactly as in `docs/store/privacy-labels.md` (Google section). Account deletion URL: `[ADMIN SITE URL]/account-deletion`.
   - **Government apps:** No. **Financial features:** none. **Health apps:** not a health app (pet care). **News:** No.
   - **Permissions:** location is foreground only, so no background-location form. There is no broad photo access (the app uses the system photo picker), so no photo/video permission form.
5. **You:** Store listing:
   - Short description (80 characters) and full description.
   - App icon 512 × 512: export `apps/mobile/assets/images/icon.png` at 512 px.
   - Feature graphic 1024 × 500.
   - At least 2 phone screenshots.
   - Contact email; website `[ADMIN SITE URL]`.

## 3. Build and submit

```bash
npm run demo:create      # with production SUPABASE_URL / service key / DEMO_* in your shell, never saved
npm run release:build    # EAS production builds for iOS and Android (build numbers auto-increment)
```

- **iOS:** `npm run release:submit:ios` uploads the latest build to App Store Connect. When processing finishes (about 15–30 minutes):
  1. Test it in **TestFlight**.
  2. Select the build on the 1.0.0 page.
  3. **Submit for Review**.
- **Android:**
  1. The **first** upload must be done by hand. Download the `.aab` from the EAS build page, then in Play Console go to Testing > Internal testing > Create release and upload it.
  2. After that, `npm run release:submit:android` uploads to the internal track as a draft.
  3. Promote internal > closed (if required) > production, and send for review.

## 4. Before you press release

- [ ] TestFlight and internal-testing builds tested on real phones:
  - sign-in;
  - booking;
  - Start trip > Check in > food > photo > Check out;
  - the report card;
  - push notifications (with a production push setup);
  - delete account.
- [ ] `npm run e2e` (Maestro) passes against staging.
- [ ] VoiceOver and TalkBack pass on the main screens; the app is readable at the largest text size.
- [ ] Sentry receives a test error from the production build with readable stack traces (source maps). PostHog receives the three events.
- [ ] The "Must fix" items in `docs/launch-risks.md` are closed: CAPTCHA, the Expo push access token, MFA for admins, backups.

## 5. Later releases

- **JS-only changes:** after testing on the preview channel, run the **EAS Update** workflow with `production`.
- **Native changes:** these include new libraries and changes to `app.config` or `app.json` (they change the fingerprint). Bump `version` in `apps/mobile/app.json`, then `npm run release:build`, and submit again.
- Re-check `docs/store/privacy-labels.md` whenever a feature collects something new.
