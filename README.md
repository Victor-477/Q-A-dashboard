# Q&A Dashboard

Classroom question-and-answer dashboard.

## Routes

- Home: `http://localhost:3000`
- Student: `http://localhost:3000/student`
- Teacher: `http://localhost:3000/teacher`

Legacy routes are still supported:

- Student: `http://localhost:3000/aluno`
- Teacher: `http://localhost:3000/professor`

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
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/questions/export?all=1" -o log.xlsx
```

Get `$TOKEN` from `POST /api/teacher/login`, or read the value stored under
`qa-board.teacherSession` in the teacher page's local storage.

Append `?all=1` to either export route (`/api/questions/export` and
`/api/questions/export/pdf`) to include archived sessions.

## Teacher Password

The default password is defined in `server.ts` as `professor123`.

To configure it without changing code, create a `.env` file or define the variable:

```bash
TEACHER_PASSWORDS="password1,password2"
```

Use commas to allow more than one password.

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

By default, the server tries to open at `http://localhost:3000`. If the port is already in use, it automatically tries the next available port and prints the correct URL in the terminal.

## Access From Other Devices On The Network

When the server starts, the terminal shows the available network addresses. Use the IP of the machine running the service, the displayed port, and choose the interface:

```text
http://MACHINE_IP:PORT
http://MACHINE_IP:PORT/student
http://MACHINE_IP:PORT/teacher
```

Example on this machine:

```text
http://172.20.10.3:3002
http://172.20.10.3:3002/student
http://172.20.10.3:3002/teacher
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
