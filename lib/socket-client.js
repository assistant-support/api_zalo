// /lib/socket-client.js
"use client";
import { io } from 'socket.io-client';

let _socket;
export function getSocket() {
    if (typeof window === 'undefined') return null;
    if (!_socket) {
        _socket = io(window.location.origin, {
            path: '/socket.io',
            transports: ['websocket'],
            // withCredentials: true, // bật nếu SOCKET_REQUIRE_AUTH=true + khác origin
        });
    }
    return _socket;
}
