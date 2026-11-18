ARMAADHA – EDITABLE SEMESTER 3 TIMETABLE UPDATE

WHAT IS INCLUDED
- index.html – ARMAADHA app with a visual weekly timetable matching the supplied Semester 3 timetable image.
- Code.gs – timetable storage, initial schedule import and admin-only edit APIs.
- config.js – existing Apps Script Web App URL (unchanged).
- manifest.webmanifest, service-worker.js and icons/ – PWA files.

TIMETABLE CONTENT
- The first timetable load imports the 18 class/activity blocks read from the supplied image into the TIMETABLE sheet, but only if the sheet is empty. Existing timetable rows are preserved.
- Displays Monday to Friday with the supplied periods, morning break, lunch break, prayer and SSA Activities. Semester, classroom, studio, class tutor and studio coordinator details are shown above the grid.
- Admin can add, edit and delete timetable blocks. The Edit button appears in each class cell. The detailed entry list also supports Edit/Delete.
- Students, Studio Head and Class Representative can view the full timetable. Faculty accounts are shown the timetable entries where their Faculty Name matches the listed faculty names; this allows multi-faculty Architectural Design periods to appear for each listed faculty.
- Schedule rows are stored in the TIMETABLE Google Sheet tab.

INSTALLATION
1. Back up the current GitHub index.html and Apps Script Code.gs.
2. Replace the GitHub Pages index.html with this package's index.html.
3. Replace Code.gs in the existing Google Apps Script project with this package's Code.gs.
4. Save, then Deploy > Manage deployments > Edit > New version > Deploy. Keep the existing Web App URL unless you create a new deployment.
5. Upload manifest.webmanifest, service-worker.js and the complete icons/ folder to GitHub. config.js is unchanged.
6. Hard refresh the site (Ctrl+Shift+R); close and reopen an installed PWA after its service worker updates.
7. Log in as Admin and open Timetable to edit any subject block.

IMPORTANT
- The Semester 3 schedule content is transcribed from the image supplied in this conversation. Please review spelling/timing once after import.
- Initial import runs once only and only when TIMETABLE has no data rows. It does not overwrite existing entries.
- This is a deployable code package, not a live deployment. Live Apps Script / Google Sheet testing was not possible here.
