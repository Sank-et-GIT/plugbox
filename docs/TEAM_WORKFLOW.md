# PlugBox Team Workflow (Single Source of Truth)
This document defines the **daily workflow**, **branch rules**, and **exact Git commands**
for all 5 team members working on the PlugBox repository.
This is mandatory reading for everyone on the team.

-----------------------------------------------------------------------------------------------------------------------------------------------------------

## 1. Branches (DO NOT VIOLATE)

### Protected branches
- **main**
  - Production / demo-ready only
  - NEVER push directly
- **integration**
  - Staging branch
  - Must always build
  - Changes come only via Pull Requests (PRs)

### Working branches (short-lived)
Branches are **created per task**, not permanent.

Format:

Examples:
- `android/rashi/login-ui`
- `dashboard/sai/vendor-panel`
- `backend/sanket/session-api`
- `device-sim/ritesh/sensor-mock`
- `qa/rishita/smoke-tests`

--------------------------------------------------------------------------------------------------------------------------------------------------------------

## 2. Folder Ownership (Responsibility)

Ownership means:  
- You are responsible for changes in this folder  
- You review PRs touching this folder  

| Person   | Folder |
|--------|--------|
| Rashi   | `/android` |
| Sai     | `/dashboard` |
| Ritesh  | `/device-sim` |
| Rishita | QA / docs / tests |
| Sanket  | `/backend` + repo admin |

---------------------------------------------------------------------------------------------------------------------------------------------------------------

## 3. ABSOLUTE RULES

No direct push to `main`  
No direct push to `integration`  
No permanent personal branches  
No secrets, `.env`, keys, tokens in Git  

Feature branch → PR → integration  
integration → PR → main (Sanket only)  

---------------------------------------------------------------------------------------------------------------------------------------------------------------

## 4. Daily Workflow (EVERYONE)

### Start of day (MANDATORY)
```bash
git checkout integration
git pull origin integration

Create a new feature branch 
git checkout -b <your-branch-name>

Example:
git checkout -b android/rashi/login-ui

During work
Commit small, logical changes:
git add .
git commit -m "Clear message describing change"

Push your branch
git push -u origin <your-branch-name>

Open Pull Request (PR)
Base branch: integration
Compare branch: your feature branch
Request review from:
Folder owner
Sanket (admin)

---------------------------------------------------------------------------------------------------------------------------------------------------------------

##Exact Daily Commands per Person

##Rashi (Android)
git checkout integration
git pull origin integration
git checkout -b android/rashi/<task>
# work only inside /android
git add android
git commit -m "Android: <what you did>"
git push -u origin android/rashi/<task>
Open PR → integration

##Sai (Dashboard)
git checkout integration
git pull origin integration
git checkout -b dashboard/sai/<task>
# work only inside /dashboard
git add dashboard
git commit -m "Dashboard: <what you did>"
git push -u origin dashboard/sai/<task>
Open PR → integration

##Ritesh (Device Simulation)
git checkout integration
git pull origin integration
git checkout -b device-sim/ritesh/<task>
# work only inside /device-sim
git add device-sim
git commit -m "Device-sim: <what you did>"
git push -u origin device-sim/ritesh/<task>

##Rishita (QA)
git checkout integration
git pull origin integration
git checkout -b qa/rishita/<task>
# tests, docs, bug repros
git add .
git commit -m "QA: <what you did>"
git push -u origin qa/rishita/<task>

##Sanket (Backend + Admin)
Backend work (same rules as others):
git checkout integration
git pull origin integration
git checkout -b backend/sanket/<task>

git add backend
git commit -m "Backend: <what you did>"
git push -u origin backend/sanket/<task>

---------------------------------------------------------------------------------------------------------------------------------------------------------------

##Merging Rules (IMPORTANT)
Merging into integration
Only when:
Code builds
No secrets committed
Conflicts resolved
At least 1 review done
Merged by: Sanket

##Merging into main
Only when:
integration is stable
QA smoke test done
Release/demo ready
Merged by: Sanket only

Files That MUST NEVER Be Committed
.env, .env.*
node_modules/
Android build/, .gradle/, local.properties
dashboard/.vite/
API keys, tokens, passwords

If environment variables are needed:
Create .env.example
Commit .env.example
Keep real .env local or on VPS

---------------------------------------------------------------------------------------------------------------------------------------------------------------

Network Layer (Android – IMPORTANT)
The following folder is CRITICAL and must NOT be deleted: 
android/app/src/main/java/.../network/
Files inside this folder:
ApiClient.kt
ApiModels.kt
PlugBoxApi.kt
All API-related changes go here.

---------------------------------------------------------------------------------------------------------------------------------------------------------------

Conflict Policy
If conflicts appear:
STOP
Inform folder owner + Sanket
Prefer resolving conflicts in feature branch before PR merge

---------------------------------------------------------------------------------------------------------------------------------------------------------------

Golden Rule
Small PRs daily are better than big PRs weekly.
If something is unclear:
Ask before pushing
Never guess with main or integration


---------------------------------------------------------------------------------------------------------------------------------------------------------------

