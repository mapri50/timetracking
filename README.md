# timetracking

A lovely local-first time tracker built with Next.js.

## Features

- Start/stop timer flow for work sessions
- Add and later edit session description, customer, start and end timestamps
- Manage customers with hourly rates and keep the rate history per time entry
- Track customer balances (`hours * rate - payments`)
- Register and edit incoming payments
- Persist everything in `localStorage`
- Import/export all data as JSON

## Run locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.
