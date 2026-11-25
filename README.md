# Q&A Dashboard

Classroom question-and-answer dashboard.

## Routes

- Home: `https://localhost:3000`
- Student: `https://localhost:3000/student`
- Teacher: `https://localhost:3000/teacher`

Legacy routes are still supported:

- Student: `https://localhost:3000/aluno`
- Teacher: `https://localhost:3000/professor`

The teacher route requires a password. The student route asks for the student's name on first access and stores it in the browser.

## Data Persistence

Questions and answers are stored in a SQLite database, so nothing is lost when the
server restarts or the machine reboots. The database uses Node's built-in
`node:sqlite` module — there is no native dependency to compile and no external
database to install.

The database location is:

- **Electron dashboard**: `%APPDATA%\qa-dashboard\data\qa-board.db` by default.
  You can point it somewhere else (a USB drive, for example) in the
  *Database Folder* field under Configuration.
- **`npm run dev`**: `./data/qa-board.db`.
- **Any run**: overridden by the `QA_DATA_DIR` environment variable.

The path in use is printed at startup and shown in the dashboard's Activity Logs.

### Starting a new class

The teacher page has a **Clear board** button. It empties the board for a fresh
class but **does not delete anything** — the questions are archived and stay in
the database.

To export them, tick **Include previous sessions** in the dashboard before
downloading the PDF or XLS. Without that option, exports cover only the current
board.

## Export Access

The export endpoints are **not public** — they would otherwise let anyone on the
network download every question ever recorded. They require a teacher token:

- The Electron dashboard authenticates itself automatically. Its export buttons
  work with no extra setup.
- Over HTTP you must send the token from the teacher login, so a plain browser
  URL will not work:

```bash
curl -H "Authorization: Bearer $TOKEN" "https://localhost:3000/api/questions/export?all=1" --insecure -o log.xlsx
```

Get `$TOKEN` from `POST /api/teacher/login`, or read the value stored under
`qa-board.teacherSession` in the teacher page's local storage.

Append `?all=1` to either export route (`/api/questions/export` and
`/api/questions/export/pdf`) to include archived sessions.

## Teacher Password

**There is no password in the source code.** On first run the server generates
one, stores it in its database and prints it at startup — it also appears in the
dashboard's Activity Logs:

```text
  ┌──────────────────────────────────────────────┐
  │  TEACHER PASSWORD (generated on first run)   │
  │           xxxx-xxxx-xxxx-xxxx                │
  └──────────────────────────────────────────────┘
```

It stays the same across restarts. To choose your own, type it in the
dashboard's Configuration tab, or set the environment variable (commas allow
more than one):

```bash
TEACHER_PASSWORDS="password1,password2"
```

Logins are compared in constant time, so a wrong password reveals nothing about
how much of it was right.

## Teacher Sessions

Sessions are stored in the database, so restarting the server no longer logs the
teacher out mid-class. They expire after 12 hours by default
(`QA_SESSION_TTL_HOURS`), and expired rows are dropped at startup and hourly.

## Encrypted Connection (HTTPS)

The teacher password is sent to the server when logging in. Over plain HTTP it
crosses the classroom network in cleartext, where anyone on the same Wi-Fi can
read it. The server therefore serves **HTTPS by default**, using a self-signed
certificate it creates on first run and stores next to the database.

Because no public authority vouches for that certificate, each device shows a
warning the first time:

> Your connection is not private → **Advanced** → **Proceed**

The certificate is reused across restarts, so each device only sees this once.
It covers `localhost` and every LAN address the machine had when it was created;
if the machine moves to a different network, a new one is issued automatically.

To go back to plain HTTP — faster to hand out, but the password is exposed:

```bash
QA_TLS=off
```

## Automatic Translation

Translation is **off by default**, and nothing leaves the machine.

Earlier versions called an undocumented Google Translate endpoint
(`client=gtx`) from every student's browser, which meant an unsupported
dependency and the class's questions being sent to a third party from thirty
devices at once.

Translation now runs on the server against a provider you configure — point it
at a self-hosted [LibreTranslate](https://libretranslate.com/), or anything
exposing the same API:

```bash
QA_TRANSLATE_URL="http://libretranslate.local:5000"
QA_TRANSLATE_API_KEY=""     # only if your instance requires one
```

With nothing configured, questions and answers are shown exactly as written.
When a provider is set, the server translates once per distinct string and
caches the result for the whole room; if the provider fails or times out, the
original text is shown rather than an error.

## Run Locally

Start the Electron control panel:

```bash
npm run dashboard
```

Use the dashboard to configure and start the web application. The available settings are application name, port, host, teacher passwords, working directory, and run mode.

After the application starts, the student and teacher pages continue to work normally through the dashboard links.

To run only the web application without the Electron dashboard:

```bash
npm install
npm run dev
```

By default, the server tries to open at `https://localhost:3000`. If the port is already in use, it automatically tries the next available port and prints the correct URL in the terminal.

## Access From Other Devices On The Network

When the server starts, the terminal shows the available network addresses. Use the IP of the machine running the service, the displayed port, and choose the interface:

```text
https://MACHINE_IP:PORT
https://MACHINE_IP:PORT/student
https://MACHINE_IP:PORT/teacher
```

Example on this machine:

```text
https://172.20.10.3:3002
https://172.20.10.3:3002/student
https://172.20.10.3:3002/teacher
```

If another device cannot open the app, make sure it is on the same Wi-Fi/wired network and that Windows Firewall allows inbound connections for Node.js on the port in use.

To open Windows Firewall access, open PowerShell as Administrator in this folder and run:

```bash
npm run firewall:allow
```

To choose a port manually in PowerShell:

```bash
$env:PORT=3001; npm run dev
```
