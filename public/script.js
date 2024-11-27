const socket = io({
    reconnection: true, // Enable automatic reconnection
    reconnectionAttempts: 10, // Retry up to 10 times
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

// Track user status
let isConnected = false;

// Monitor network status
function updateNetworkStatus() {
    if (navigator.onLine) {
        console.log("Network is online.");
        if (!isConnected) {
            reconnect(); // Attempt to reconnect if not connected
        }
    } else {
        console.log("Network is offline.");
        socket.emit('userDisconnected', roomId, userId);
    }
}

// Event listeners for network changes
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// Attempt to reconnect
async function reconnect() {
    if (!isConnected) {
        console.log("Reconnecting...");
        socket.connect();

        if (roomId && localStream) {
            socket.emit('rejoinRoom', roomId, userId);
            reinitializePeerConnection();
        }
    }
}

// Reinitialize WebRTC connection
async function reinitializePeerConnection() {
    peerConnection = new RTCPeerConnection(config);

    // Add local tracks to the connection
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('iceCandidate', roomId, userId, event.candidate);
        }
    };

    // Handle remote tracks
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Create a new offer and send it to the server
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', roomId, userId, offer);
}

// Handle connection events
socket.on('connect', () => {
    console.log("Connected to server.");
    isConnected = true;

    if (roomId) {
        socket.emit('rejoinRoom', roomId, userId);
    }
});

socket.on('disconnect', () => {
    console.log("Disconnected from server.");
    isConnected = false;
});

const iceServers = [
    // {
    //     urls: ["stun:167.99.121.56:3478"],
    // },
    // {
    //     urls: "turn:167.99.121.56:3478", // TURN server URL
    //     username: "myturnserver", // User defined in turnserver.conf
    //     credential: "FskdjbbSFCsRcWRFfc3TG4g4456yg4EGE", // Password defined in turnserver.conf
    // }
]
// ICE Servers Configuration
const config = {
    iceServers: iceServers,
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

// Room Operations
if (createRoomButton || joinRoomButton) {
    socket.on('roomFull', (roomId) => {
        console.log(`Room ${roomId} is full.`)
        alert(`${roomId} Room is Full, Create new Room or join Different room`);

        window.location.href = "index.html";
    })
    // Create Room
    createRoomButton.addEventListener('click', () => {
        roomId = roomIdInput.value.trim();
        if (roomId) {
            socket.emit('joinRoom', roomId);
            document.getElementById('room').style.display = 'none';
            document.getElementById('callControls').style.display = 'block';
        }
    });

    // Join Room
    joinRoomButton.addEventListener('click', () => {
        roomId = roomIdInput.value.trim();
        if (roomId) {
            socket.emit('joinRoom', roomId);
            document.getElementById('room').style.display = 'none';
            document.getElementById('callControls').style.display = 'block';
        }
    });

    // Start Call
    startCallButton.addEventListener('click', async () => {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        reinitializePeerConnection();
    });

    // Handle Incoming WebRTC Messages
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
