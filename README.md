# Viewly

Viewly is a minimalist web app that calculates statistics for regular long-form YouTube videos from a channel, excluding Shorts and live streams.

## Overview

- React + Vite frontend
- Express backend proxy for YouTube Data API v3
- Single deployment on Render
- One environment variable: `YOUTUBE_API_KEY`

## Local setup

1. Install dependencies:
   npm install

2. Create a local environment file:
   cp .env.example .env

3. Add your YouTube Data API v3 key:
   - Open `.env`
   - Replace `your_key_here` with your API key

4. Run the project locally:
   npm run dev

5. Open the app:
   http://localhost:5173

## Where to put your API key

### 1) Local development
Create a `.env` file in the project root and add:

YOUTUBE_API_KEY=your_actual_key_here

### 2) GitHub Codespaces
Add the secret in the Codespaces environment or repo secrets:

- Name: `YOUTUBE_API_KEY`
- Value: your actual key

Then it will be available in the environment during runtime.

### 3) Hosting platform (Render)
In Render:

- Open your web service
- Go to Environment
- Add a variable named `YOUTUBE_API_KEY`
- Paste your key

## Google Cloud setup

1. Go to the Google Cloud Console: https://console.cloud.google.com/
2. Create a new project or select an existing one.
3. Enable the YouTube Data API v3:
   - APIs & Services > Library
   - Search for "YouTube Data API v3"
   - Click Enable
4. Create an API key:
   - APIs & Services > Credentials
   - Create credentials > API key
5. Restrict the key:
   - Restrict it to YouTube Data API v3
   - Optionally limit to the IPs or apps that will use it
6. Copy the key into your `.env` file or Render environment variables.

## Run the app locally

Start both the backend and frontend in development mode:

npm run dev

This runs:
- Vite frontend on http://localhost:5173
- Express backend on http://localhost:3001

The frontend uses a Vite proxy to call the backend.

## Production / Render deployment

Use one web service with the following settings:

- Build command:
  npm install && npm run build

- Start command:
  npm run start

The Express app serves the built frontend from the `dist` folder.

Important:
- The YouTube API key is read only from the environment variable `YOUTUBE_API_KEY`
- The key is never exposed in the browser
- The backend exits immediately if the variable is missing

## Important API behavior

- The app resolves a channel via `@handle`, channel ID, custom URL, or username.
- It prefers the long-form playlist ID format `UULF{channelId.slice(2)}`.
- It falls back to the normal uploads playlist when needed.
- It excludes Shorts and live streams.
- It stops paginating once the playlist is older than the selected period start date to conserve quota.
- It caches results in memory for a few minutes.

## Development notes

- If `YOUTUBE_API_KEY` is missing, startup fails with:
  `Missing YOUTUBE_API_KEY. Create a .env file and add your key (see README).`
- The backend uses a strict `.env` check on startup.
- The app is designed for modern browsers only.
