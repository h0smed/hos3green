# Free Deployment Options for Hos3Green Backend

## Option 1: Railway.app (Free Tier - No Credit Card Required)

### Steps:
1. Go to https://railway.app
2. Sign up with GitHub (no credit card needed for free tier)
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your backend repository
6. Railway auto-detects Node.js
7. Add environment variables in Variables tab:
   ```
   NODE_ENV=production
   PORT=3000
   GOOGLE_CLOUD_PROJECT_NUMBER=708560085041
   ALLOWED_PACKAGE_NAMES=com.android.hos3green
   JWT_SECRET=ZJ8F7mHkZs3N9+6K8bHcP6ZrFqM4B0wzq+4A7U1xE=
   RESPONSE_SIGNING_KEY=Yx4D9A+MZ0FzX6v2rTnK0LwB9H6Gm8CkS1eP5JQOaU8=
   ```
8. Add your service account JSON as a secret
9. Deploy!

**Limits**: 500 hours/month, sleeps after inactivity

---

## Option 2: Fly.io (Free Tier - Credit Card Required but Free)

### Steps:
1. Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
2. Sign up: `fly auth signup`
3. In your backend folder:
   ```bash
   fly launch
   ```
4. Set secrets:
   ```bash
   fly secrets set JWT_SECRET=ZJ8F7mHkZs3N9+6K8bHcP6ZrFqM4B0wzq+4A7U1xE=
   fly secrets set RESPONSE_SIGNING_KEY=Yx4D9A+MZ0FzX6v2rTnK0LwB9H6Gm8CkS1eP5JQOaU8=
   fly secrets set GOOGLE_CLOUD_PROJECT_NUMBER=708560085041
   ```
5. Deploy: `fly deploy`

**Limits**: 2340 hours/month (always free for small apps)

---

## Option 3: Glitch.com (Free - Good for Testing)

### Steps:
1. Go to https://glitch.com
2. Create new project → Import from GitHub
3. Import your backend repo
4. Add `.env` file with your variables
5. Project auto-starts

**Limits**: Sleeps after 5 minutes inactivity, limited resources

---

## Option 4: Vercel (Serverless Functions)

Convert to serverless and deploy:

### Steps:
1. Install Vercel CLI: `npm i -g vercel`
2. Create `vercel.json`:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "src/index.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "src/index.js"
       }
     ]
   }
   ```
3. Deploy: `vercel`

**Limits**: 100GB bandwidth, good for testing

---

## Option 5: Local Network (No Cloud Needed!)

If your phone and computer are on the same WiFi:

### Steps:
1. Find your computer's local IP:
   - Windows: Run `ipconfig` in CMD
   - Look for "IPv4 Address" (e.g., `192.168.1.100`)

2. Update backend to listen on all interfaces:
   In `backend/src/index.js`, change:
   ```javascript
   app.listen(PORT, '0.0.0.0', () => {
     console.log(`Server running on http://0.0.0.0:${PORT}`);
   });
   ```

3. Update Android app:
   ```kotlin
   buildConfigField("String", "API_BASE_URL", "\"http://192.168.1.100:3000/\"")
   ```

4. Run backend: `npm start`

5. Build and install APK on phone

**Note**: Phone and computer must be on same WiFi. Backend stops when you close your computer.

---

## Option 6: ngrok (Temporary Public URL)

Expose your local backend temporarily:

### Steps:
1. Download ngrok: https://ngrok.com/download
2. Sign up (free) and get authtoken
3. Configure: `ngrok config add-authtoken YOUR_TOKEN`
4. Start backend: `npm start` (in backend folder)
5. In new terminal: `ngrok http 3000`
6. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
7. Update Android app with this URL
8. Build APK

**Limits**: URL changes every time you restart ngrok, 1 concurrent connection on free plan

---

## Recommendation for Testing:

**Best Free Option**: Railway.app
- No credit card required
- Easy GitHub integration
- Generous free tier
- Good for testing

**For Development**: Local Network (Option 5)
- No deployment needed
- Fast iteration
- Works immediately

**For Sharing**: ngrok (Option 6)
- Quick temporary URL
- Good for demos
- No deployment needed