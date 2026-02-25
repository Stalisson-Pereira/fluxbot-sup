# Fluxbot

This repository contains the source code for **Fluxbot**, a chat bot application built with Node.js and a frontend UI.

## Structure

- `fluxbot-api/` – Express-based back-end service including bot registry, database access, and API endpoints.
- `frontend/` – Static HTML/JS/CSS files for dashboard, login, and device management.

## Setup

1. Clone the repository.
2. In `fluxbot-api/`, create a `.env` file with the necessary environment variables (e.g. `PORT`, `DATABASE_URL`, etc.).
3. Install dependencies:
   ```bash
   cd fluxbot-api
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open the frontend files in a browser or serve them from a static host.

## Contributing

- Make sure `node_modules/` and other generated files are ignored in `.gitignore`.
- Run tests or linting if added later.

## License

Specify the appropriate license for your project.
