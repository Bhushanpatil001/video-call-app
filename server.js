const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

app.use(cors());
const rooms = {};
const disconnectedUsers = {};

// Socket.IO connection
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    // Register User
    socket.on('registerUser', (username) => {
        socket.emit('userRegistered', socket.id);
    });

    // Join Room
    socket.on('joinRoom', (roomId) => {
        if (!rooms[roomId]) rooms[roomId] = [];
        if (!rooms[roomId].includes(socket.id)) rooms[roomId].push(socket.id);
        socket.join(roomId);
    });

    // Handle User Disconnection
    socket.on('userDisconnected', (roomId, userId) => {
        disconnectedUsers[userId] = roomId;
        socket.leave(roomId);
        console.log(`User ${userId} disconnected.`);
    });

    // Rejoin Room
    socket.on('rejoinRoom', (roomId, userId) => {
        if (disconnectedUsers[userId] === roomId) {
            delete disconnectedUsers[userId];
            socket.join(roomId);
            rooms[roomId].push(socket.id);
            console.log(`User ${userId} rejoined room ${roomId}`);
        }
    });

    // Handle WebRTC Signaling
    socket.on('offer', (roomId, userId, offer) => {
        socket.to(roomId).emit('offerReceived', userId, offer);
    });

    socket.on('answer', (roomId, userId, answer) => {
        socket.to(roomId).emit('answerReceived', userId, answer);
    });

    socket.on('iceCandidate', (roomId, userId, candidate) => {
        socket.to(roomId).emit('iceCandidate', userId, candidate);
    });
});

server.listen(4000, () => {
    console.log('Server is running on port 4000');
});

