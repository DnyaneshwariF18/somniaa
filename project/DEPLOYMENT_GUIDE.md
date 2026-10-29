# Somnia Zero-Cost Deployment Guide 🚀
*100% Free Hosting Options for Devpost Submission*

---

### Understanding the Hackathon "Demo URL" Requirement
Devpost requires a demo link. You have two completely free (₹0) routes:

---

### Option 1 (Recommended & 100% Free): Vercel Frontend Deployment
Deploy the React frontend on **Vercel** or **Netlify** for free. In this mode, the frontend runs with its browser-based cache and offline Demo Mode, allowing judges to immediately interact with Somnia's UI, memory management, and simulated replies.

1. Create a free account at [vercel.com](https://vercel.com) using your GitHub account.
2. Click **"Add New Project"** and import `somniaa`.
3. Set **Root Directory** to: `project`.
4. Build command: `npm run build`
5. Output directory: `dist`
6. Click **Deploy**.
7. In ~60 seconds, you get a free live URL (e.g. `https://somnia-ai.vercel.app`) to paste into Devpost!

---

### Option 2: Render Free Web Service (Full Frontend + Backend + SQLite)
If you wish to host both the Node backend and frontend together on a single server:

1. Sign up for free at [render.com](https://render.com).
2. Create a **New Web Service** connected to your GitHub repository `somniaa`.
3. Settings:
   * **Root Directory:** `project`
   * **Environment:** `Node`
   * **Build Command:** `npm install && npm run build`
   * **Start Command:** `npm run dev:backend`
   * **Plan Type:** Free (₹0)
4. Add Environment Variables (optional, only if using Nebius promotional credits):
   * `SOMNIA_AI_BASE_URL` = `https://api.tokenfactory.nebius.com/v1/`
   * `SOMNIA_AI_API_KEY` = your Nebius key
   * `SOMNIA_AI_MODEL` = `nvidia/nemotron-3-super-120b-a12b`
5. Click **Create Web Service**.

---

### Option 3: Local Demo Video + GitHub Repo (Sufficient for Judging)
Devpost rules state:
> *"Working application demo (hosted application URL, test build, or link to video demo)."*

If you submit:
1. Public GitHub Repository URL (`https://github.com/DnyaneshwariF18/somniaa`)
2. 3-minute YouTube Demo Video (using [`DEMO_VIDEO_SCRIPT.md`](DEMO_VIDEO_SCRIPT.md))
3. Clear local setup instructions (from [`README.md`](../README.md))

Your submission is 100% compliant even without a hosted cloud server!

