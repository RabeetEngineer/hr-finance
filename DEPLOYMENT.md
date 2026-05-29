# Deployment Guide

Recommended setup:

- Backend API: Render web service
- Frontend: Vercel Vite project
- Database: MongoDB Atlas

## 1. Prepare MongoDB Atlas

1. Create or use an Atlas cluster.
2. Create a database user.
3. Add network access for the deployment platform.
4. Copy the Atlas connection string.

## 2. Deploy Backend on Render

Create a new Render Web Service from this repository.

Settings:

- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`

Environment variables:

- `NODE_ENV=production`
- `MONGODB_URI=<your Atlas connection string>`
- `JWT_SECRET=<long random secret>`
- `CLIENT_URL=<your Vercel frontend URL>`

After deploy, test:

```txt
https://your-backend.onrender.com/api/v1/health
```

## 3. Deploy Frontend on Vercel

Create a new Vercel project from this repository.

Settings:

- Root Directory: `client`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Environment variable:

- `VITE_API_URL=https://your-backend.onrender.com/api/v1`

Redeploy after setting the variable.

## 4. Final Backend CORS Update

After Vercel gives the frontend URL, set Render `CLIENT_URL` to that exact URL.

If you want to allow multiple frontend URLs, separate them with commas:

```txt
CLIENT_URL=https://production.vercel.app,https://preview.vercel.app
```

## 5. Seed Admin

If the database is new, run the seed command once from a secure environment:

```bash
npm run seed:admin
```

Do not commit real `.env` files or passwords.
