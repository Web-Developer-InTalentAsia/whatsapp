# InTalent WhatsApp Cloud API Production Setup

Target application: `https://hrm.intalent.asia`

## 1. Meta prerequisites

Create or use a Meta Business Portfolio and a Meta Developer app with the **WhatsApp** product. Add the InTalent business phone number to the WhatsApp Business Account (WABA).

Collect these values from Meta:

- Phone Number ID
- WhatsApp Business Account ID (WABA ID)
- Meta App ID
- Meta App Secret
- Permanent system-user access token

The permanent token should be created for a Meta Business system user with only the permissions required by this application. Do not use the temporary developer token in production.

## 2. Configure the application

Sign in as Super Admin and go to **Settings → WhatsApp Numbers → Add Number**.

Enter:

- Display name: e.g. `InTalent Asia Recruitment`
- Phone number: international format, e.g. `+947XXXXXXXX`
- Phone Number ID
- WABA ID
- App ID
- App Secret
- Permanent Access Token
- Verify Token: create a long random value; this is your own secret, not supplied by Meta

Save the number. The application will display a callback URL similar to:

`https://hrm.intalent.asia/webhooks/whatsapp/3`

The final number is the application's internal WhatsApp-number record ID. Use the exact URL shown in Settings.

## 3. Configure Meta webhook

In Meta Developer Dashboard:

1. Open the app.
2. Go to **WhatsApp → Configuration**.
3. Set **Callback URL** to the exact URL displayed by the application.
4. Set **Verify Token** to the same value saved in the application.
5. Verify and save.
6. Subscribe the WABA to at least the `messages` webhook field.

Meta sends a GET challenge during verification. The app returns the challenge only when the verify token matches. Incoming POST requests are validated using the `X-Hub-Signature-256` HMAC generated from the Meta App Secret.

## 4. Test in the correct order

1. In Settings, click **Test Connection**. This validates Phone Number ID + access token.
2. Complete webhook verification in Meta.
3. Add your own phone as an allowed recipient while the app is still in development mode, or move the Meta app to Live mode after business verification and required reviews.
4. Send a WhatsApp message from the test phone to the business number.
5. Confirm that the conversation appears in the Inbox.
6. Reply from the Inbox within the 24-hour customer-service window.

Outside the 24-hour window, Meta requires an approved message template. This project currently blocks free-form messages after 24 hours and does not yet provide a template-send UI.

## 5. Windows Server / IIS deployment

From the project directory on the Remote Desktop server:

```powershell
npm ci
npm run lint
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

Confirm Node is listening locally:

```powershell
curl http://127.0.0.1:3000/api/health
```

Confirm IIS reverse proxy and HTTPS:

```powershell
curl https://hrm.intalent.asia/api/health
```

IIS requires URL Rewrite and Application Request Routing (ARR) proxy support. The supplied `web.config` proxies all traffic to `127.0.0.1:3000`.

Allow inbound HTTPS (TCP 443). Port 3000 should remain private/local and should not be exposed publicly.

## 6. Required production safeguards

- Keep `.env` outside Git and never commit Meta tokens, App Secret, JWT secret, or database passwords.
- Rotate any credential that has previously been committed or shared.
- Set `NODE_ENV=production` and `ALLOW_UNSIGNED_WEBHOOK_TESTS=false`.
- Disable demo database seeding after controlled initialization.
- Replace all seeded/default user passwords immediately.
- Back up PostgreSQL before deployment.
- Use a dedicated Meta system-user token and rotate it according to company policy.
- Restrict application Settings access to trusted administrators.

## 7. Current functional scope

Implemented:

- Meta credential validation
- Signed webhook verification
- Inbound text, button, and interactive reply ingestion
- Delivery/read event acknowledgement
- Outbound free-form text replies within 24 hours
- Multiple WhatsApp numbers

Not yet implemented:

- Approved template-message sending outside 24 hours
- Media download/storage for CVs and documents
- Webhook event idempotency/deduplication
- Token encryption at rest
