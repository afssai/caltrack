# 🥗 CalTrack — Personal Calorie Reference App

A personal food calorie tracker built for Safari on iPhone.
300+ foods covering Malaysian, Western, fast food, snacks, drinks, and more.

---

## 📱 How to Access on Your iPhone (Safari)

Once deployed, open Safari on your iPhone and go to your GitHub Pages URL:

```
https://YOUR-GITHUB-USERNAME.github.io/caltrack
```

To save it like an app on your home screen:
1. Open the URL in Safari
2. Tap the **Share** button (box with arrow at bottom of screen)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **Add** — it will appear as an app icon on your home screen ✅

---

## 🚀 How to Deploy (Step-by-Step)

### Step 1 — Create a GitHub account
Go to [github.com](https://github.com) and sign up if you don't have one.

### Step 2 — Create a new repository
1. Click the **+** button (top right) → **New repository**
2. Name it exactly: `caltrack`
3. Set to **Public**
4. Click **Create repository**

### Step 3 — Upload the files
**Option A — GitHub web upload (easiest, no coding):**
1. On your new repo page, click **"uploading an existing file"**
2. Drag and drop ALL the files and folders from this zip
3. Make sure you include hidden files: `.github/` folder and `.gitignore`
4. Click **Commit changes**

**Option B — Using Terminal (if you know Git):**
```bash
cd caltrack
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/caltrack.git
git push -u origin main
```

### Step 4 — Enable GitHub Pages
1. Go to your repo → **Settings** tab
2. Click **Pages** in the left sidebar
3. Under **Source**, select **GitHub Actions**
4. Click **Save**

### Step 5 — Wait for deployment
1. Go to the **Actions** tab in your repo
2. You'll see a workflow running — wait ~2 minutes for it to finish ✅
3. Once done, your app is live at:
   `https://YOUR-USERNAME.github.io/caltrack`

---

## 🔄 How to Update the App

Whenever you want to add new foods or make changes:
1. Edit `src/App.jsx` on GitHub (click the file → pencil icon)
2. Commit the change
3. GitHub Actions will automatically rebuild and redeploy in ~2 minutes

---

## 🗂 Project Structure

```
caltrack/
├── .github/
│   └── workflows/
│       └── deploy.yml        ← Auto-deploy to GitHub Pages
├── public/
│   └── icon.svg              ← App icon
├── src/
│   ├── App.jsx               ← Main app + all food data (edit here)
│   ├── main.jsx              ← Entry point
│   └── index.css             ← Global styles
├── index.html                ← HTML shell with iOS meta tags
├── vite.config.js            ← Build config
├── package.json              ← Dependencies
├── .gitignore                ← Ignored files
└── README.md                 ← This file
```

---

## ⚙️ Your Profile Settings

Edit these values at the top of `src/App.jsx` to update your targets:

```js
const TDEE_BASE = 2360;   // Your daily calorie budget
const SWIM_BONUS = 600;   // Extra calories on swim days
const WALK_BONUS = 350;   // Extra calories on incline walk days
```

---

## ➕ How to Add a New Food

Open `src/App.jsx` and add a line inside the `foods` array:

```js
{ cat: "🇲🇾 Malaysian Mains", icon: "🍛", name: "Your Food Name", cal: 300, note: "Short note", traffic: "yellow" },
```

- `traffic` options: `"green"` (safe) / `"yellow"` (moderate) / `"red"` (avoid)
- `cat` must match an existing category exactly (copy from an existing entry)

---

Built with React + Vite. Deployed via GitHub Pages.
