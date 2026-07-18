import { io } from "socket.io-client";

const envUrl = import.meta.env.VITE_SERVER_URL;
const isLocalEnv = !envUrl || /localhost|127\.0\.0\.1/.test(envUrl);
const SERVER_URL = isLocalEnv
  ? `${window.location.protocol}//${window.location.hostname}:4000`
  : envUrl;

export const socket = io(SERVER_URL, { autoConnect: false });
