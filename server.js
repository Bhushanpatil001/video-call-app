const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');


const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
const rooms = {};
let disconnectedSockets = {}; // Track disconnected socket IDs
// const users = {};

// Serve static files
app.use(express.static('public'));

// Socket.io
io.on('connection', socket => {
    let roomId;

    // User joins a room
    socket.on('joinRoom', (room) => {
        roomId = room;

        // Initialize room if it doesn't exist
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }

        // Check if room is full (max 2 users per room)
        if (rooms[roomId].length >= 2) {
            socket.emit('roomFull', 'Room is full, cannot join');
            return;
        }

        // Add the socket to the room
        rooms[roomId].push(socket.id);
        console.log(`Socket ${socket.id} joined room ${roomId}`);

        // Forward signaling data
        socket.on('offer', (offer) => {
            socket.broadcast.to(roomId).emit('offerReceived', socket.id, offer);
        });

        socket.on('answer', (answer) => {
            socket.broadcast.to(roomId).emit('answerReceived', socket.id, answer);
        });

        socket.on('iceCandidate', (candidate) => {
            socket.broadcast.to(roomId).emit('iceCandidate', socket.id, candidate);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`Socket ${socket.id} disconnected`);
            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
            disconnectedSockets[socket.id] = true; // Mark socket as disconnected
        });

        // Handle reconnection attempt
        socket.on('reconnect', () => {
            if (disconnectedSockets[socket.id]) {
                // Allow reconnection only if the socket was disconnected
                if (!rooms[roomId].includes(socket.id)) {
                    rooms[roomId].push(socket.id);
                    console.log(`Socket ${socket.id} reconnected to room ${roomId}`);
                    delete disconnectedSockets[socket.id]; // Remove from disconnectedSockets
                    socket.emit('newOffer', roomId); // Send a new offer
                }
            } else {
                socket.emit('roomFull', 'Room is full, cannot join');
            }
        });
    });
});

// Start Server
server.listen(4000, () => {
    console.log('Server running on port 4000');
});
