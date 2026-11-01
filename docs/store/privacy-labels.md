# App Store privacy labels and Google Play Data Safety

These answers are based on what the app actually does (database schema, app code,
Sentry and PostHog setup) as of version 1.0.0. Re-check them whenever a feature
adds new data.

Items marked **Decide** are judgment calls. Confirm them with your lawyer.

## What the app collects

| Data                                                                                                                  | Where it comes from  | Who provides it                  | Required?                            |
| --------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------- | ------------------------------------ |
| Name, email                                                                                                           | Sign-up              | Everyone                         | Yes                                  |
| Phone number                                                                                                          | My profile           | Everyone                         | Optional                             |
| Home address, home coordinates (if entered)                                                                           | Household setup      | Owners                           | Yes (to book)                        |
| Entry instructions, alarm notes, Wi-Fi                                                                                | Household setup      | Owners                           | Optional                             |
| Emergency contacts (other people's names and phones)                                                                  | Household setup      | Owners                           | Optional                             |
| Pet profile: species, breed, birth date, weight, microchip, temperament, vet details, allergies, medications, feeding | Pet screens          | Owners                           | Optional (name and species required) |
| Bookings, visits, check-in and check-out times                                                                        | Booking and visits   | Owners, sitters, admins          | Yes                                  |
| Precise location at check-in and check-out only (foreground)                                                          | Check-in button      | Sitters                          | Optional (can deny)                  |
| Care log, notes, incident reports, visit summary, live status line                                                    | Visit screen         | Sitters                          | Optional                             |
| Photos and videos (videos include sound)                                                                              | Camera or library    | Sitters, owners                  | Optional                             |
| In-app messages and chat photos                                                                                       | Chat                 | Everyone                         | Optional                             |
| Push token, notification settings                                                                                     | Device               | Everyone                         | Optional (can deny)                  |
| User ID                                                                                                               | Account              | Everyone                         | Yes                                  |
| Crash and error reports (scrubbed), performance traces                                                                | Sentry               | Automatic                        | Yes                                  |
| 3 anonymous product events                                                                                            | PostHog              | Automatic                        | Yes                                  |
| IP address (kept for up to 1 day for rate limiting)                                                                   | Server               | Automatic                        | Yes                                  |
| Device and browser signals for the sign-in security check                                                             | Cloudflare Turnstile | Automatic at sign-in and sign-up | Yes                                  |

**Not collected:**

- payment or financial data;
- the device's contacts or address book, calendar or files;
- browsing history;
- background location;
- advertising IDs.

There is **no tracking** across other companies' apps or websites, **no ads**, and **no data sold**.

---

## Apple App Store Connect: App Privacy

App Store Connect > your app > App Privacy > Get Started.

**"Do you or your third-party partners collect data from this app?"** Yes.

For each data type, Apple asks:

1. Is it linked to the user's identity?
2. Is it used for tracking? **No** for every type.
3. What are the purposes?

| Apple data type                                                                                   | Collect?                     | Linked to user         | Purposes          |
| ------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------- | ----------------- |
| Contact Info: Name                                                                                | Yes                          | Yes                    | App Functionality |
| Contact Info: Email Address                                                                       | Yes                          | Yes                    | App Functionality |
| Contact Info: Phone Number                                                                        | Yes                          | Yes                    | App Functionality |
| Contact Info: Physical Address                                                                    | Yes                          | Yes                    | App Functionality |
| Contact Info: Other User Contact Info (emergency contacts)                                        | Yes                          | Yes                    | App Functionality |
| Health & Fitness: Health                                                                          | **No** (see Decide 1)        |                        |                   |
| Financial Info                                                                                    | No                           |                        |                   |
| Location: Precise Location                                                                        | Yes                          | Yes                    | App Functionality |
| Location: Coarse Location                                                                         | No (precise covers check-in) |                        |                   |
| Sensitive Info                                                                                    | No                           |                        |                   |
| Contacts (address book)                                                                           | No                           |                        |                   |
| User Content: Emails or Text Messages (in-app chat)                                               | Yes                          | Yes                    | App Functionality |
| User Content: Photos or Videos                                                                    | Yes                          | Yes                    | App Functionality |
| User Content: Audio Data (sound in videos)                                                        | Yes (Decide 2)               | Yes                    | App Functionality |
| User Content: Customer Support                                                                    | No                           |                        |                   |
| User Content: Other User Content (pet profiles, care logs, notes, incidents, home access details) | Yes                          | Yes                    | App Functionality |
| Browsing History, Search History                                                                  | No                           |                        |                   |
| Identifiers: User ID                                                                              | Yes                          | Yes                    | App Functionality |
| Identifiers: Device ID (push token)                                                               | Yes                          | Yes                    | App Functionality |
| Purchases                                                                                         | No                           |                        |                   |
| Usage Data: Product Interaction (3 PostHog events)                                                | Yes                          | **No**                 | Analytics         |
| Usage Data: Advertising Data, Other Usage Data                                                    | No                           |                        |                   |
| Diagnostics: Crash Data                                                                           | Yes                          | Yes (user ID attached) | App Functionality |
| Diagnostics: Performance Data                                                                     | Yes                          | Yes                    | App Functionality |
| Diagnostics: Other Diagnostic Data (device model, OS version)                                     | Yes                          | Yes                    | App Functionality |
| Other Data                                                                                        | No                           |                        |                   |

**Tracking:** answer **No**. The app has no ads, no data brokers, does not link our data with other companies' data, and has no advertising identifier.

**Privacy Policy URL:** `https://<admin site>/privacy`.

**Account deletion (App Review guideline 5.1.1(v)):** in the app at My profile > Delete my account.

---

## Google Play Console: Data Safety

Play Console > your app > Policy > App content > Data safety.

**Data collection and security**

| Question                                                            | Answer                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Does your app collect or share any of the required user data types? | Yes                                                                 |
| Is all of the user data collected by your app encrypted in transit? | Yes (HTTPS only)                                                    |
| Which ways do you provide for users to request deletion?            | In the app, and a web link: `https://<admin site>/account-deletion` |
| Account creation methods                                            | Username and password (email); one-time code by email               |

**Shared data: answer "No" for every type.** Google doesn't count these as sharing:

- transfers the user starts (owners share with their own pet-sitting business);
- service providers that process data for us (Supabase, Expo, Sentry, PostHog, email).

**Collected data**

For each type: collected, processed ephemerally (No for all), required or optional, and purposes.

| Category: type                                                              | Collected         | Required? | Purposes                              |
| --------------------------------------------------------------------------- | ----------------- | --------- | ------------------------------------- |
| Location: Approximate location                                              | Yes               | Optional  | App functionality                     |
| Location: Precise location                                                  | Yes               | Optional  | App functionality                     |
| Personal info: Name                                                         | Yes               | Required  | App functionality, Account management |
| Personal info: Email address                                                | Yes               | Required  | App functionality, Account management |
| Personal info: User IDs                                                     | Yes               | Required  | App functionality, Account management |
| Personal info: Address                                                      | Yes               | Required  | App functionality                     |
| Personal info: Phone number                                                 | Yes               | Optional  | App functionality                     |
| Personal info: Other info (emergency contacts; home access details)         | Yes               | Optional  | App functionality                     |
| Financial info                                                              | No                |           |                                       |
| Health and fitness                                                          | **No** (Decide 1) |           |                                       |
| Messages: Other in-app messages                                             | Yes               | Optional  | App functionality                     |
| Messages: Emails, SMS or MMS                                                | No                |           |                                       |
| Photos and videos: Photos                                                   | Yes               | Optional  | App functionality                     |
| Photos and videos: Videos                                                   | Yes               | Optional  | App functionality                     |
| Audio: Voice or sound recordings (sound in videos)                          | Yes (Decide 2)    | Optional  | App functionality                     |
| Files and docs, Calendar, Contacts                                          | No                |           |                                       |
| App activity: App interactions (3 anonymous events)                         | Yes               | Required  | Analytics                             |
| App activity: Other user-generated content (pet profiles, care logs, notes) | Yes               | Optional  | App functionality                     |
| App activity: In-app search history, Installed apps, Other actions          | No                |           |                                       |
| Web browsing                                                                | No                |           |                                       |
| App info and performance: Crash logs                                        | Yes               | Required  | App functionality, Analytics          |
| App info and performance: Diagnostics                                       | Yes               | Required  | App functionality, Analytics          |
| App info and performance: Other app performance data                        | No                |           |                                       |
| Device or other IDs (push token)                                            | Yes               | Optional  | App functionality                     |

---

## Decide (confirm with your lawyer)

1. **Pet health information.** Apple's "Health" and Google's "Health and fitness" are about the user's own health. Pet allergies and medications are declared as "Other User Content" (Apple) and "Other user-generated content" (Google). If you or your lawyer see it otherwise, declare Health as well. Declaring more is never a rejection reason; declaring less can be.
2. **Sound in videos.** Videos keep their sound, so Audio is declared. If videos become silent, remove it.
3. **IP address for rate limiting and the Cloudflare security check.** It's kept for up to a day for fraud prevention and security. Neither store has an exact type for it. Many apps don't declare it; to be thorough, add "Fraud prevention, security, and compliance" as a purpose under Device or other IDs.
4. **Business admins on the website.** The labels cover the mobile app. The admin website isn't covered by the store forms, but the privacy policy covers both.
