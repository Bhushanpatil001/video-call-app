const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const cors = require('cors');

// Load SSL credentials
const privateKey = fs.readFileSync('path/to/your/private-key.pem', 'utf8');
const certificate = fs.readFileSync('path/to/your/certificate.crt', 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.static('public'));

// Create HTTPS server on port 4000
const httpsServer = https.createServer(credentials, app);
const io = socketIo(httpsServer);

const rooms = {};
const users = {};

// Socket.io handling
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

// Start HTTPS Server on port 4000
httpsServer.listen(4000, () => {
    console.log('Server running on https://localhost:4000');
});
