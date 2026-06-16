# CalTrack V2 UI and Function Audit

Audit date: 2026-06-16  
Local preview tested: `http://localhost:4173/`  
Viewport: mobile, 390 x 844  
Scope: current app state only. No fixes were made during this audit.

## Screenshots

| # | Screen / State | File |
|---|---|---|
| 1 | First launch PIN setup | `01-first-launch-pin-setup.png` |
| 2 | Onboarding dashboard | `02-onboarding-dashboard.png` |
| 3 | Diary tab | `03-tab-diary.png` |
| 4 | Add tab | `04-tab-add.png` |
| 5 | Tools tab | `05-tab-tools.png` |
| 6 | Coach tab | `06-tab-coach.png` |
| 7 | Progress tab | `07-tab-progress.png` |
| 8 | Settings tab | `08-tab-settings.png` |
| 9 | Open Food Facts search error | `09-add-open-food-facts-results.png` |
| 10 | USDA missing key error | `10-add-usda-error.png` |
| 11 | Barcode result | `11-add-barcode-result-or-error.png` |
| 12 | Food log modal | `12-log-food-modal.png` |
| 13 | Diary after barcode add | `13-diary-after-barcode-add.png` |
| 14 | Custom food log modal | `14-custom-food-log-modal.png` |
| 15 | Diary after custom food | `15-diary-after-custom-food.png` |
| 16 | Diary water/activity/notes | `16-diary-water-activity-notes.png` |
| 17 | Lock screen after refresh | `17-after-refresh-lock-screen.png` |
| 18 | Data persisted after refresh | `18-after-refresh-data-persisted.png` |
| 19 | Package calculator custom grams | `19-package-calculator-custom-grams.png` |
| 20 | Package calculator half package | `20-package-calculator-half-package.png` |
| 21 | Diary after package calculator | `21-diary-after-package-calculator.png` |
| 22 | AI missing key error | `22-ai-missing-key-error.png` |
| 23 | Progress after one measurement | `23-progress-after-one-measurement.png` |
| 24 | Progress stale date label bug | `24-progress-stale-date-label-after-save.png` |
| 25 | Coach after data | `25-tab-coach-after-data.png` |
| 26 | Pantry saved | `26-coach-pantry-saved.png` |
| 27 | Recipe builder filled | `27-coach-recipe-builder-filled.png` |
| 28 | Recipe saved | `28-coach-recipe-saved.png` |
| 29 | Diary after log recipe | `29-diary-after-log-recipe.png` |
| 30 | Settings after audit data | `30-settings-after-audit-data.png` |
| 31 | Diary after settings goals | `31-diary-after-settings-goals.png` |
| 32 | Settings PIN changed | `32-settings-pin-changed.png` |
| 33 | Lock now screen | `33-lock-now-screen.png` |
| 34 | Unlocked after PIN change | `34-unlocked-after-pin-change.png` |
| 35 | Current state after export attempt | `35-current-state-after-export-attempt.png` |

Supporting inventory files:

- `control-inventory.json`
- `file-inputs.json`

## Screen Inventory

### First Launch / Lock

Buttons:

- Create PIN
- Unlock

Forms:

- PIN
- Confirm PIN

Notes:

- PIN setup works.
- Refresh returns to lock screen when a PIN exists.
- PIN is clearly described as a local privacy barrier, not encryption.

### Diary

Buttons:

- Dismiss getting started
- Set goals
- Log first food
- Add food
- Add breakfast
- Add lunch
- Add dinner
- Add snack
- Remove food
- Remove activity
- Bottom navigation: Diary, Add, Tools, Coach, Progress, Settings

Forms:

- Diary date
- Water consumed
- Add activity
- Activity minutes
- Daily notes

Notes:

- Food totals update correctly.
- Water value persists and coach guidance updates.
- Activity stores minutes, but the visible row reads awkwardly as `Swimming min`; the number is in the input but not obvious in text output.
- Daily notes persist, but the saved value is not visually prominent.

### Add

Buttons:

- Search OFF
- Search USDA
- Look up barcode
- Review & add
- Save pantry
- Save reusable food
- Add saved custom food
- Delete saved custom food

Forms:

- Search a food or product
- Enter barcode digits
- Food name
- Brand
- Serving size
- Calories per serving
- Protein per serving
- Carbs per serving
- Fat per serving
- Fiber per serving
- Amount eaten modal
- Meal modal

Notes:

- Barcode lookup works with real Open Food Facts data.
- Search OFF failed locally with generic `Failed to fetch`.
- USDA route exists, but local server has no `USDA_API_KEY`, so it returns a clear server configuration error.
- Custom food works and opens a review modal before logging.
- Several fields are visually labeled but not consistently accessible through label targeting.

### Tools

Buttons:

- Take label photo
- Choose from gallery
- Whole package
- Half package
- Quarter
- Add calculated amount to diary
- Analyze with optional AI

Forms:

- OCR file inputs
- Food/package name
- Meal
- Serving size
- Package weight
- Amount eaten
- Calories/protein/carbs/fat/fiber per serving
- AI analysis type
- Optional AI image
- AI context

Notes:

- OCR controls are real file inputs:
  - `Take label photo`: `accept="image/*"`, `capture="environment"`
  - `Choose from gallery`: `accept="image/*"`
- OCR could not be completed in this audit because the browser automation cannot operate the OS camera/gallery picker.
- Package calculator math works for custom grams and half-package preset.
- Adding calculated package amount to diary works.
- Optional AI correctly reports missing `GEMINI_API_KEY` instead of faking output.

### Coach

Buttons:

- Save ingredient
- Edit pantry item
- Delete pantry item
- Save recipe
- Log recipe
- Generate optional AI suggestion

Forms:

- Pantry ingredient
- Pantry serving grams
- Pantry calories/protein/carbs/fat/fiber
- Recipe title
- Meal type
- Add pantry ingredient
- Preparation steps
- Why recommended
- AI mode
- Optional photo
- Goals/preferences

Notes:

- Pantry ingredient save works.
- Recipe builder can use pantry ingredient and calculates nutrition.
- Saved recipe can be logged to diary.
- AI photo/recipe suggestion depends on Gemini server key and was not configured locally.

### Progress

Buttons:

- Save measurement
- Delete measurement
- Front photo
- Side photo
- Back photo

Forms:

- Weight
- Waist
- Front/side/back photo inputs

Notes:

- Weight and waist save for the default date.
- Measurement date switching is broken/confusing: changing the header date to `2026-06-15` left the measurement labels at `2026-06-16`, and saving still saved for `2026-06-16`.
- Progress photo controls are real file inputs with `accept="image/*"` and `capture="environment"`, but actual upload could not be completed through browser automation.

### Settings

Buttons:

- Send Supabase sign-in link
- Lock now
- Change PIN
- Export backup
- Import backup
- Delete all local data

Forms:

- Daily calorie goal
- Protein goal
- Carbs goal
- Fat goal
- Fiber goal
- Water goal
- Goal weight
- Session timeout
- Email for magic link
- Current PIN
- New PIN
- Confirm new PIN
- Import backup file

Notes:

- Goal changes update dashboard targets.
- Change PIN works.
- Lock now and unlock work.
- Supabase sign-in is disabled locally because `VITE_SUPABASE_PUBLISHABLE_KEY` is missing.
- The badge still says `ONLINE`, which is confusing because Supabase is not configured.
- Local preview says `Vercel/full mode ready`, which is technically misleading on localhost.
- Export backup could not be verified because the in-app browser does not support download events.
- Import backup could not be completed because it requires selecting a local file.

## Function Status Table

| Function | Status | Notes |
|---|---|---|
| First launch PIN setup | Working | Created audit PIN successfully. |
| Unlock with PIN | Working | Refresh showed lock screen and unlocked with correct PIN. |
| Change PIN | Working | Changed audit PIN and unlocked with the new PIN. |
| Lock now | Working | Returned to lock screen. |
| Session timeout | Not completed | Timeout was visible as a setting, but waiting for inactivity was not completed in this run. |
| Diary totals | Working | Calories/macros updated after barcode, custom food, package item, and recipe. |
| Food removal | Not completed | Remove buttons are visible; destructive remove flow was not completed. |
| Water tracking | Working | Water value persisted and coach guidance updated. |
| Activity tracking | Partial | Activity and minutes persist, but display is confusing. |
| Daily notes | Working | Notes persisted in the textarea. |
| Open Food Facts search | Broken locally | Search returned generic `Failed to fetch`. |
| Barcode lookup | Working | Real Coca-Cola barcode returned Open Food Facts data and ingredients. |
| Add barcode food to diary | Working | Result opened review modal and added to diary. |
| USDA search | Partial | Endpoint exists, but local server lacks `USDA_API_KEY`. |
| Custom food entry | Working | Saved reusable custom food and added to diary. |
| Save custom food to pantry | Not completed | Button exists; pantry was tested separately from Coach. |
| Package calculator custom grams | Working | 90g from 30g/120 kcal serving calculated 360 kcal. |
| Whole/half/quarter package presets | Working | Half package set 90g and calculated correctly. |
| Add package calculation to diary | Working | Added calculated item to Snack. |
| OCR camera/gallery controls | Partial | Real file inputs exist with correct accept/capture attributes; OCR run not completed due file picker limitation. |
| Optional AI helper | Partial | Correctly reports missing `GEMINI_API_KEY`; no fake AI output. |
| Pantry ingredient save | Working | Manual pantry item saved. |
| Pantry edit/delete | Not completed | Buttons visible; edit/delete flow not completed. |
| Recipe builder | Working | Built and saved recipe from pantry item with calculated nutrition. |
| Log recipe | Working | Saved recipe logged to diary. |
| Coach recommendations | Working | Guidance updates from actual logged calories, protein, fiber, and water. |
| Weight tracking | Working for current date | Saved weight/waist for default date. |
| Measurement date switching | Broken | Header date changed, but measurement form stayed on old date and saved to old date. |
| Weight trend chart | Partial | Needs two distinct dates; blocked by date switching bug. |
| Progress photos | Partial | Real file inputs exist; upload not completed due file picker limitation. |
| Goal settings | Working | Targets update dashboard. |
| Supabase auth panel | Partial | Disabled locally because publishable key is missing. UI still says `ONLINE`, which is confusing. |
| Supabase sync | Not completed | Cannot test without configured Supabase env and real auth session. |
| Backup export | Not completed | In-app browser does not support download events; export click could not be verified. |
| Backup import | Not completed | Requires local file picker. |
| Delete all local data | Not completed | Destructive action not completed during audit. |

## Broken Features

1. Open Food Facts text search fails locally with generic `Failed to fetch`.
2. Measurement date switching is broken: changing the date did not update/save measurements to the selected date.
3. Supabase status is misleading locally: Settings shows `ONLINE` while also saying the publishable key is missing.
4. Localhost deployment availability message says `Vercel/full mode ready`, which is misleading.

## Partially Working / Unverified Features

1. USDA search requires `USDA_API_KEY`; local behavior is clear but not a successful food search.
2. Gemini/AI requires `GEMINI_API_KEY`; local behavior is clear but no successful AI result was tested.
3. OCR inputs exist and are configured correctly, but OCR was not run with an image in this audit.
4. Progress photo inputs exist and are configured correctly, but upload was not completed.
5. Backup export/import could not be fully tested through the in-app browser.
6. Session timeout was not tested by waiting for inactivity.

## Working Features

1. PIN setup, unlock, change PIN, lock now.
2. Local persistence across refresh.
3. Barcode lookup through Open Food Facts.
4. Adding barcode food to diary.
5. Custom food creation and logging.
6. Diary calorie/protein/carbs/fat/fiber totals.
7. Water tracking.
8. Daily notes persistence.
9. Package calculator and add-to-diary flow.
10. Pantry save.
11. Recipe builder and log recipe.
12. Coach guidance from logged data.
13. Goal settings.
14. Weight/waist save for the default date.

## Technical / Developer Text Visible To Users

1. `Vercel/full mode ready`
2. `GitHub Pages: local diary, PIN, OCR, Open Food Facts, barcode, backups`
3. `Vercel: everything above plus USDA and optional Gemini server routes`
4. `Configure USDA_API_KEY and GEMINI_API_KEY on the server`
5. `Supabase publishable key is missing. Set VITE_SUPABASE_PUBLISHABLE_KEY in the deployment environment`
6. Raw errors like `Failed to fetch`
7. Raw server errors like `USDA_API_KEY is not configured on the server`
8. Raw server errors like `GEMINI_API_KEY is not configured on the server`

## UI Clutter / Confusing Areas

1. Settings mixes user goals, deployment information, API-key notes, Supabase sync, PIN security, backup, and destructive delete in one long screen.
2. `Online` badge conflicts with missing Supabase key.
3. Open Food Facts search failure gives no useful recovery path.
4. Food Add screen has both external search and custom food in one dense layout.
5. Coach tab combines coach advice, pantry, recipe builder, and AI in a single long screen.
6. Activity display hides or deemphasizes minutes.
7. Some inputs are visually labeled but not consistently accessible as real labels.

## Recommended Priorities

1. Fix measurement date switching before any visual redesign.
2. Fix Open Food Facts search error handling and endpoint/CORS behavior.
3. Make Supabase status honest: show `Not configured`, `Auth reachable`, `Signed in`, `Database ready`, or `Sync failed`.
4. Replace user-visible developer/API-key text with plain user guidance.
5. Run a real OCR test with a nutrition label image through camera/gallery.
6. Run real backup export/import outside the in-app browser if needed.
7. Improve form accessibility by connecting visible labels to inputs.
8. Reduce Settings and Coach clutter after reliability fixes.
