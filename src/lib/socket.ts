import { io } from "socket.io-client";

// Connect to the same host as the window location
const socket = io();

export default socket;
