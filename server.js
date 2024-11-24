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
const disconnectedUsers = [];

// Serve static files
app.use(express.static('public'));

// Socket.io
io.on('connection', (socket) => {
    // console.log(`New connection: ${socket.id}`);

    // Register User
    socket.on('registerUser', (username) => {
        users[socket.id] = username;
        // console.log(`${username} registered with ID: ${socket.id}`);
        // console.log({users});
        socket.emit('userRegistered', socket.id);
    });

    // Join Room
    // socket.on('joinRoom', (roomId, userId) => {
    //     console.log("Room Id : " + roomId + "userID" + userId);
    //     if (!rooms[roomId]) {
    //         rooms[roomId] = [];
    //     }
    //     rooms[roomId].push(userId);
    //     socket.join(roomId);
    //     console.log(`${userId} joined room ${roomId}`);
    // });


    // Join Room
    // socket.on('joinRoom', (roomId) => {
    //     // Use socket.id as the userId
    //     const userId = socket.id;
    //     console.log(`${userId} joined room ${roomId}`);

    //     if (!rooms[roomId]) {
    //         rooms[roomId] = [];
    //     }
    //     rooms[roomId].push(userId);
    //     socket.join(roomId);  // Join the room
    //     console.log("users", users);
    //     console.log("rooms", rooms);

    //     // You can optionally emit back to the client the list of users in the room if needed
    //     socket.emit('joinedRoom', roomId, userId);  // Inform the client they've joined
    // });


    socket.on('joinRoom', (roomId) => {
        if (!rooms[roomId]) rooms[roomId] = [];
        
        if(rooms[roomId].length === 2){
            console.log('Room is full. Cannot join');
            socket.emit("roomFull", roomId);
            return;
        }else{
            if (!rooms[roomId].includes(socket.id)) rooms[roomId].push(socket.id);
        }
        socket.join(roomId);
        // console.log(`${socket.id} rejoined room ${roomId}`);
        console.log('users in room', roomId, rooms[roomId]);
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

    socket.on('interrupted', (roomId, userId) => {
        socket.to(roomId).emit('interrupted', roomId, userId);
        // console.log(`${userId} is interrupted in room ${roomId}`);
        // Disconnect the user from the room
        socket.leave(roomId);
        disconnectedUsers.push(userId);
        console.log('Users in room after disconnection', roomId, rooms[roomId]);
        console.log('Disconnected users', disconnectedUsers);

        Object.keys(rooms).forEach((roomId) => {
            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
        });
        delete users[socket.id];

        socket.emit("joinInterrupted", roomId)  ;

        // If all users in the room are disconnected, remove the room from the rooms object
        if (rooms[roomId].length === 0) {
            delete rooms[roomId];
            console.log(`Room ${roomId} deleted`);
        }
    })

    // Disconnect
    socket.on('disconnect', () => {
    // console.log(`${socket.id} disconnected`);
    // console.log('users in room', roomId, rooms[roomId]);
    // console.log(rooms);
        Object.keys(rooms).forEach((roomId) => {
            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
        });
    delete users[socket.id];
    });
});

// Start Server
server.listen(4000, () => {
    console.log('Server running on port 4000');
});
