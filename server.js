const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
const rooms = {};
const users = {};

// Serve static files
app.use(express.static('public'));

// Socket.io
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    // Register User
    socket.on('registerUser', (username) => {
        users[socket.id] = username;
        console.log(`${username} registered with ID: ${socket.id}`);
        socket.emit('userRegistered', socket.id);
    });

    // Join Room
    socket.on('joinRoom', (roomId) => {
        if (!rooms[roomId]) rooms[roomId] = [];

        if (rooms[roomId].length === 2) {
            console.log(`Room ${roomId} is full. Cannot join.`);
            socket.emit('roomFull', roomId);
            return;
        }

        if (!rooms[roomId].includes(socket.id)) rooms[roomId].push(socket.id);
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
        console.log('Users in room:', rooms[roomId]);
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

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`${socket.id} disconnected`);
        Object.keys(rooms).forEach((roomId) => {
            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
            if (rooms[roomId].length === 0) delete rooms[roomId];
        });
        delete users[socket.id];
        console.log('Remaining rooms:', rooms);
    });
});

// Start Server
server.listen(4000, () => {
    console.log('Server running on port 4000');
});
