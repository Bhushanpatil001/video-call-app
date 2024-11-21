const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
const rooms = {}; // Object to hold rooms and users
const users = {}; // Map to hold socket ids and usernames

// Serve static files
app.use(express.static('public'));

// Socket.io connection
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
        if (!rooms[roomId]) {
            rooms[roomId] = []; // Initialize room if it doesn't exist
        }

        if (rooms[roomId].length === 2) {
            // If the room already has 2 users, it is full
            console.log('Room is full');
            socket.emit('roomFull', roomId); // Emit room full error to client
            return;
        }

        // Add the user to the room
        rooms[roomId].push(socket.id);
        socket.join(roomId);
        console.log(`${socket.id} joined room ${roomId}`);

        // Notify the client that they have successfully joined
        socket.emit('joinedRoom', roomId);
        io.to(roomId).emit('userJoined', socket.id); // Notify others in the room
    });

    // WebRTC Signaling
    socket.on('offer', (roomId, userId, offer) => {
        socket.to(roomId).emit('offerReceived', userId, offer);
    });

    socket.on('answer', (roomId, userId, answer) => {
        socket.to(roomId).emit('answerReceived', userId, answer);
    });

    socket.on('iceCandidate', (roomId, userId, candidate) => {
        socket.to(roomId).emit('iceCandidate', userId, candidate);
    });

    // Disconnect user from the room when they leave
    socket.on('disconnect', () => {
        // Remove the user from all rooms
        Object.keys(rooms).forEach((roomId) => {
            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
            if (rooms[roomId].length === 0) {
                delete rooms[roomId]; // Clean up empty rooms
            }
        });
        delete users[socket.id]; // Remove user from the users map
        console.log(`${socket.id} disconnected`);
    });
});

// Start Server
server.listen(4000, () => {
    console.log('Server running on port 4000');
});
