# DSG Agent Worker Run: abc-game-worker

Goal: สร้างเกม ABC เด็ก 3 ขวบ มีปุ่มใหญ่และบันทึกคะแนน

## Output

- App route: /generated-apps/abc-game-worker
- API route: /api/generated-apps/abc-game-worker/items

## Truth boundary

- productionReadyClaim: false
- Requires CI/build/deploy/live proof before service claim.

## Required checks

- npm run dsg:typecheck
- npm run build:termux
- open generated app route
- verify API route
