# DSG Agent Worker Run: my-new-app

Goal: สร้างแอปใหม่ที่ต้องการ

## Output

- App route: /generated-apps/my-new-app
- API route: /api/generated-apps/my-new-app/items

## Truth boundary

- productionReadyClaim: false
- Requires CI/build/deploy/live proof before service claim.

## Required checks

- npm run dsg:typecheck
- npm run build:termux
- open generated app route
- verify API route
