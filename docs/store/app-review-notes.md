# App Review notes

Paste the text below into:

- **App Store Connect** > your version > App Review Information > Notes. Put the sitter account in the Sign-In fields.
- **Google Play Console** > App content > App access > "All or some functionality is restricted" > add instructions. Add both accounts.

Run `npm run demo:create` against **production** right before each submission. It resets the demo data, and then there is a demo visit every day for 90 days.

---

Pet Sitter is a business app for pet-sitting companies. Clients and sitters join a business by invitation, so we have set up a demo business for you. Location is used only at check-in and check-out; it is never collected in the background.

**Sitter account (main flow)**

- Email: appreview-sitter@[DOMAIN]
- Password: [DEMO_PASSWORD]

Steps:

1. Log in. On the Today tab you'll see a drop-in visit at "Demo home". There is one every day at 12:00 Pacific; you can do it at any time of day.
2. Tap **Start trip**, then **Check in**.
   - The app asks for location **while using the app**, only to confirm the sitter is at the pet's home. It warns, but doesn't block, if you are far away: tap "Check in".
   - You can also deny location and still check in.
3. Tap **Open visit at Demo home**. Log care with the large buttons, for example **All** under Biscuit's food.
4. Tap **Choose from gallery** or **Camera** to send a photo to the owner.
5. Tap **Check out**, add a note, and confirm.

**Pet owner account**

- Email: appreview-owner@[DOMAIN]
- Password: [DEMO_PASSWORD]

Steps:

1. Log in. Under **Recent**, open yesterday's visit to see the report card.
2. Open the cat, Mochi, to see her severe-allergy banner.
3. Tap **Book a visit** to request a new one, and **Messages** to chat with the business.

**Notes for the reviewer**

- **Notifications:** the app explains what notifications are for before the system prompt. Saying no doesn't block anything.
- **Account deletion:** My profile > Delete my account.
- **Chat:** messages are private between a household, its pet-sitting business and the sitters assigned to it. They are not public. Business admins can delete any message.
- **Admin site (optional):** businesses manage schedules on a website: [ADMIN SITE URL]. Admin account: appreview-admin@[DOMAIN], same password.
- **Data:** this demo business is isolated. No real clients' data is visible.
