E-Cell QR Ticketing System (The "Nuclear Option")

This is a complete, end-to-end event ticketing system compressed into a single HTML file.

We stripped out React, Vite, Node.js, and the 200MB node_modules folder because the build process was causing you headaches. This is raw, unadulterated web development: HTML, CSS (Tailwind via CDN), and JavaScript (ES Modules).

⚡ Tech Stack

Frontend: Vanilla HTML5 + JavaScript (ES6)

Styling: Tailwind CSS (via CDN)

Icons: Lucide Icons (via CDN)

Backend: Firebase Firestore (Database) + Firebase Auth (Anonymous Login)

QR Generation: goqr.me or qrserver API

📂 Project Structure

/
└── index.html  <-- THE ENTIRE APP IS HERE.


🚀 Setup Instructions

You do not need a terminal. You do not need npm.

1. Firebase Setup (Critical)

The app will not load until you connect it to your own Firebase project.

Go to console.firebase.google.com.

Create a project.

Enable Firestore: Build -> Firestore Database -> Create Database -> Start in Test Mode.

Enable Auth: Build -> Authentication -> Get Started -> Sign-in method -> Anonymous -> Enable.

Get Config: Project Settings (Gear icon) -> General -> "Your apps" -> Web (</> icon) -> Register app -> Copy the firebaseConfig object.

2. Configure the Code

Open index.html in any text editor (VS Code, Notepad, etc.).

Scroll down to lines 235-242 (inside the <script> tag).

Replace the placeholder firebaseConfig object with your actual keys.

It should look like this:

const firebaseConfig = {
    apiKey: "AIzaSyDnf...",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    // ... other keys
};


3. Run It

Locally: Double-click index.html. That's it.

Deployment: Upload index.html to Vercel, Netlify, or GitHub Pages. It just works.

🛠 Features

1. Organizer Dashboard

Analytics: Real-time counter of tickets issued vs. tickets scanned.

Issue Ticket: Generates a secure Firestore document.

Preview: Shows the participant details and the QR code.

Email: Opens your default mail client with a pre-filled message containing the QR link.

2. Verifier Mode

Scanner Input: Accepts the raw JSON payload from the QR code.

Security Check: Validates the cryptographic signature (HMAC simulation) to prevent ID tampering.

Database Check: Verifies if the ticket exists and if it has already been used.

Access Control: Marks the ticket as USED in the database instantly.

⚠️ Troubleshooting

"I see a blank screen or a loading spinner forever."

You didn't replace the Firebase keys in index.html.

You didn't enable Anonymous Auth in Firebase Console.

You didn't create the Firestore Database in Test Mode.

"The verification fails."

The SECRET_SALT in the code is hardcoded. If you change it after issuing tickets, old tickets will fail validation.

🛡 Security Note

This is a client-side app. The "Secret Salt" is visible in the source code. For a high-stakes paid event, you would move the signature generation to a secure Backend (Cloud Function). For a college E-Cell event, this is sufficient to stop casual screenshots and fake tickets.
