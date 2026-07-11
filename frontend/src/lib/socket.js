import { io } from "socket.io-client";

// Resolve the backend URL so the SAME build works on localhost AND when a
// phone opens the app over the LAN. A phone loading http://192.168.1.2:5173
// must talk to http://192.168.1.2:4000 — NOT localhost (which, on the phone,
// is the phone itself). So:
//   - If VITE_SERVER_URL points at a real remote host (e.g. the Render URL in
//     production), honor it.
//   - Otherwise (unset, or a localhost value) derive the host from the page
//     that's currently open, keeping port 4000.
const envUrl = import.meta.env.VITE_SERVER_URL;
const isLocalEnv = !envUrl || /localhost|127\.0\.0\.1/.test(envUrl);
const SERVER_URL = isLocalEnv
  ? `${window.location.protocol}//${window.location.hostname}:4000`
  : envUrl;

// autoConnect: false so we can connect right after the player picks a name,
// avoiding orphaned sockets on the login screen.
export const socket = io(SERVER_URL, { autoConnect: false });
