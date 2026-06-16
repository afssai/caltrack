# CalTrack Project Brief

## Purpose

CalTrack V1 is a personal/private-first nutrition and progress tracker. The app should remain useful locally even when cloud services are unavailable.

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
