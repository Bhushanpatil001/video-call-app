const socket = io({
    reconnection: true, // Enable automatic reconnection
    reconnectionAttempts: 5, // Retry 5 times before giving up
    reconnectionDelay: 1000, // Initial delay (1 second)
    reconnectionDelayMax: 5000 // Maximum delay (5 seconds)
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

// Network Status
function updateNetworkStatus() {
    if (navigator.onLine && !isConnected) {
        reconnect();
    }
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// Reconnect Functionality
async function reconnect() {
    if (!isConnected) {
        socket.connect();
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

// Socket Events
socket.on('connect', () => {
    console.log('Connected to server.');
    if (roomId) {
        socket.emit('joinRoom', roomId);
        if (localStream) reconnect();
    }
    isConnected = true;
});

socket.on('disconnect', () => {
    isConnected = false;
    console.log('Disconnected. Attempting to reconnect...');
});

// ICE Servers Configuration
const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

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
    socket.on('roomFull', (roomId) => {
        alert(`${roomId} Room is full. Create a new room or join another.`);
        window.location.href = 'index.html';
    });

    createRoomButton.addEventListener('click', () => {
        roomId = roomIdInput.value.trim();
        if (roomId) {
            socket.emit('joinRoom', roomId);
            document.getElementById('room').style.display = 'none';
            document.getElementById('callControls').style.display = 'block';
        }
    });

    joinRoomButton.addEventListener('click', () => {
        roomId = roomIdInput.value.trim();
        if (roomId) {
            socket.emit('joinRoom', roomId);
            document.getElementById('room').style.display = 'none';
            document.getElementById('callControls').style.display = 'block';
        }
    });

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

    socket.on('answerReceived', async (senderId, answer) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('iceCandidate', async (senderId, candidate) => {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
}
