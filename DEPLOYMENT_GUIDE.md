# Hos3Green Backend Deployment Guide

## Option 1: Render.com (Recommended - Free Tier)

### Step 1: Prepare Your Code
1. Make sure your backend code is in a Git repository
2. The service account JSON file (`hos3green-backend-ec06aa6e5b57.json`) should be in the project root

### Step 2: Sign Up for Render
1. Go to https://render.com
2. Sign up with GitHub
3. Click "New Web Service"
4. Connect your GitHub repository

### Step 3: Configure the Service
- **Name**: `hos3green-backend`
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free

### Step 4: Add Environment Variables
In the Render dashboard, add these environment variables:

```
NODE_ENV=production
PORT=10000
GOOGLE_CLOUD_PROJECT_NUMBER=708560085041
ALLOWED_PACKAGE_NAMES=com.android.hos3green
JWT_SECRET=ZJ8F7mHkZs3N9+6K8bHcP6ZrFqM4B0wzq+4A7U1xE=
RESPONSE_SIGNING_KEY=Yx4D9A+MZ0FzX6v2rTnK0LwB9H6Gm8CkS1eP5JQOaU8=
```

### Step 5: Add Service Account JSON
The service account key needs to be accessible. You have two options:

**Option A: Environment Variable (More Secure)**
1. Copy the contents of `hos3green-backend-ec06aa6e5b57.json`
2. Create a new environment variable `GOOGLE_SERVICE_ACCOUNT_JSON`
3. Paste the entire JSON content as the value
4. Modify `playIntegrity.js` to read from environment variable instead of file

**Option B: Upload File**
1. Use Render's Shell to upload the file
2. Or commit the file to your repo (less secure)

### Step 6: Deploy
Click "Create Web Service" and wait for deployment.

### Step 7: Get Your URL
After deployment, Render will give you a URL like:
`https://hos3green-backend.onrender.com`

### Step 8: Update Android App
Update the API URL in `app/build.gradle.kts`:

```kotlin
release {
    buildConfigField("String", "API_BASE_URL", "\"https://hos3green-backend.onrender.com/\"")
}
```

---

## Option 2: Railway.app (Alternative)

### Steps:
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Node.js
6. Add environment variables in the Variables tab
7. Deploy!

---

## Option 3: Google Cloud Run (If you have GCP credits)

### Steps:
1. Install Google Cloud SDK
2. Authenticate: `gcloud auth login`
3. Set project: `gcloud config set project hos3green-backend`
4. Deploy: `gcloud run deploy`

---

## Testing Your Deployed Backend

Once deployed, test with:
```bash
curl https://your-backend-url.com/health
```

Should return:
```json
{"status": "ok", "timestamp": "..."}
```

## Security Notes

⚠️ **Important**: 
- Never commit `.env` files to Git
- Use environment variables for secrets in production
- The free tiers may have cold starts (slow first request)
- Consider upgrading for production use

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | Check Node version (needs 18+) |
| Service account error | Verify JSON is valid and accessible |
| CORS errors | Check CORS settings in `index.js` |
| Timeout | Free tiers have request limits |