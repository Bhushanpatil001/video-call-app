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
    socket.on('joinRoom', (roomId, userId) => {
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }
        rooms[roomId].push(userId);
        socket.join(roomId);
        console.log(`${userId} joined room ${roomId}`);
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
        delete users[socket.id];
    });
});

// Start Server
server.listen(4000, () => {
    console.log('Server running on port 4000');
});
