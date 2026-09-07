import { io } from "socket.io-client";

// Connect to the same host as the window location
const socket = io({
  autoConnect: false,
  auth: callback => callback({ token: localStorage.getItem('tangolab_auth_token') || '' })
});

export default socket;
