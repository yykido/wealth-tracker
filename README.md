# wealth-tracker

A personal finance dashboard for recording monthly expenses, tracking asset values, and exploring hypothetical investment growth.

## Current design

- React + TypeScript + Vite, with no backend service.
- IndexedDB through Dexie stores personal records in the current browser.
- GitHub tracks code, documentation, and fictional examples only.
- Sites hosts the application files; financial records are not uploaded to Sites.
- JSON backup export and restore provide recovery and manual transfer between browsers or devices.

Once deployed, the tracker works without the developer's Mac staying awake or running a service. Updating financial records does not require a commit or redeployment.

## Status

Planning stage. The application, backup features, and deployment are not implemented yet. Setup commands will be added during scaffolding.

## Documentation

- [Product requirements](docs/product.md): workflows, scope, and acceptance criteria.
- [Architecture](docs/architecture.md): stack, storage, calculations, backup format, and deployment.
- [Decisions](docs/decisions.md): current decisions and superseded alternatives.

Use GitHub Issues for implementation tasks and update these documents as requirements change.

## Personal data

Keep real financial imports, exported backups, credentials, and account sessions outside the repository. Use fictional data in examples, fixtures, and screenshots.

Browser storage is specific to a website origin and browser profile. Clearing it may erase records, and it does not synchronize automatically. Export a backup after monthly updates and store it privately outside the project folder. Plain JSON backups are readable text, not encrypted.
