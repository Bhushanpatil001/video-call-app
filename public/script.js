const socket = io({
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 5000,
});

// HTML Elements
const usernameInput = document.getElementById('username');
const registerButton = document.getElementById('registerButton');
const roomIdInput = document.getElementById('roomId');
const createRoomButton = document.getElementById('createRoomButton');
const joinRoomButton = document.getElementById('joinRoomButton');
const startCallButton = document.getElementById('startCallButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// Global Variables
let localStream;
let peerConnection;
let userId;
let roomId;
let isConnected = false;

const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

// Monitor network status
function updateNetworkStatus() {
    if (navigator.onLine) {
        if (!isConnected) {
            reconnect();
        }
    } else {
        console.log("Network is offline.");
    }
}

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

// Attempt to reconnect
async function reconnect() {
    if (!isConnected) {
        socket.connect(); // Reconnect the Socket.IO client

        if (localStream) {
            peerConnection = new RTCPeerConnection(config);
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('iceCandidate', roomId, userId, event.candidate);
                }
            };

            peerConnection.ontrack = (event) => {
                remoteVideo.srcObject = event.streams[0];
            };

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('offer', roomId, userId, offer);
        }
    }
}

// Handle connection events
socket.on("connect", () => {
    if (roomId) {
        socket.emit('joinRoom', roomId); // Rejoin the room
    }
    isConnected = true;
});

socket.on("disconnect", () => {
    isConnected = false;
    console.log("Disconnected from server.");
});

// Register User
if (registerButton) {
    registerButton.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        if (username) {
            socket.emit('registerUser', username);
        }
    });

    socket.on('userRegistered', (id) => {
        userId = id;
        window.location.href = 'video-call.html';
    });
}

// Room & Video Call Operations
if (createRoomButton || joinRoomButton) {
    socket.on("roomFull", (roomId) => {
        alert(`${roomId} Room is Full. Create a new room or join another room.`);
        window.location.href = "index.html";
    });

    // Create Room
    createRoomButton.addEventListener('click', () => {
        roomId = roomIdInput.value.trim();
        if (roomId) {
            socket.emit('joinRoom', roomId);
            console.log(`Created room: ${roomId}`);
            document.getElementById('room').style.display = 'none';
            document.getElementById('callControls').style.display = 'block';
        }
    });

    // Join Room
    joinRoomButton.addEventListener('click', () => {
        roomId = roomIdInput.value.trim();
        if (roomId) {
            socket.emit('joinRoom', roomId);  // Emit only roomId, userId is automatically handled on the server
            document.getElementById('room').style.display = 'none';
            document.getElementById('callControls').style.display = 'block';
        }
    });

    // Start Video Call
    startCallButton.addEventListener('click', async () => {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        peerConnection = new RTCPeerConnection(config);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('iceCandidate', roomId, userId, event.candidate);
            }
        };

        peerConnection.ontrack = (event) => {
            remoteVideo.srcObject = event.streams[0];
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.emit('offer', roomId, userId, offer);
    });

    // Handle Incoming Calls (Offer)
    socket.on('offerReceived', async (senderId, offer) => {
        peerConnection = new RTCPeerConnection(config);

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('iceCandidate', roomId, userId, event.candidate);
            }
        };

        peerConnection.ontrack = (event) => {
            remoteVideo.srcObject = event.streams[0];
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit('answer', roomId, userId, answer);
    });

    // Handle Answer Received
    socket.on('answerReceived', async (senderId, answer) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    // Handle ICE Candidate
    socket.on('iceCandidate', async (senderId, candidate) => {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            console.error('Error adding received ice candidate', err);
        }
    });
}
