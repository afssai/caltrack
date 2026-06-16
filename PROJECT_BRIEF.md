# CalTrack Project Brief

## Purpose

CalTrack V1 is a private-first personal weight-loss companion. Its mission is to help one person stay motivated, consistent, accountable, and aware of progress during weight loss without turning the process into shame, noise, or surveillance.

The app should support the emotional side of weight loss as much as the tracking side: helping the user see effort, recover from imperfect days, notice trends, and keep going. Food logging, calorie tracking, exercise tracking, reminders, progress photos, and cloud sync are supporting tools for that larger goal.

CalTrack should remain useful locally even when cloud services are unavailable.

## Current Product Scope

Implemented in the React/Vite app:

- local PIN lock
- local calorie and macro diary
- water, notes, activity, weight, waist, and progress photo tracking
- custom food entry
- pantry and recipe logging
- package calculator
- browser OCR with Tesseract.js
- Open Food Facts search and barcode lookup
- optional Supabase email magic-link authentication and cloud sync
- backup export/import

## Deployment Targets

- GitHub Pages: static frontend deployment.
- Vercel: frontend plus serverless API routes for `/api/usda` and `/api/gemini`.
- Supabase: Auth, Postgres, Row Level Security, and private progress photo storage.

## Non-Goals For V1

- No UI redesign until infrastructure is stable.
- No new AI features.
- No Google Drive backup.
- No health/watch sync.
- No claim that local PIN encrypts data.

## Current Priority

Stabilize infrastructure, deployment documentation, Supabase authentication, cloud sync reliability, and data safety before adding product features.
