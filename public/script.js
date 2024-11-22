const socket = io({
    reconnection: true, // Enable automatic reconnection
    reconnectionAttempts: 5, // Retry 5 times before giving up
    reconnectionDelay: 1000, // Initial delay between attempts (1 second)
    reconnectionDelayMax: 5000, // Maximum delay (5 seconds)
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

// Monitor network status
function updateNetworkStatus() {
    if (navigator.onLine) {
        // console.log("Network is online.");
        if (!isConnected) {
            reconnect();
        }
        peerConnection.restartIce();
    } else {
        // console.log("Network is offline. Waiting for reconnection...");
        // alert("You are offline. The app will reconnect automatically once the network is restored.");
    }
}

// updating network state on itrruption state
window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);


// Attempt to reconnect
async function reconnect() {
    if (!isConnected) {
        // console.log("Attempting to reconnect...");
        socket.connect(); // Reconnect the Socket.IO client

        // Reinitialize WebRTC peer connection
        if (localStream) {
            peerConnection = new RTCPeerConnection(config);
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            // Handle ICE state changes
            peerConnection.oniceconnectionstatechange = () => {
                const state = peerConnection.iceConnectionState;
                console.log('ICE Connection State:', state);
            
                if (state === 'disconnected' || state === 'failed') {
                    console.log('Connection lost. Attempting ICE restart...');
                    peerConnection.restartIce(); // Restart ICE
                }
            };


            // Handle connection state changes
            peerConnection.onconnectionstatechange = () => {
                const state = peerConnection.connectionState;
                console.log('Connection State:', state);
            
                if (state === 'disconnected' || state === 'failed') {
                    console.log('Connection lost. Attempting reconnection...');
                    handleReconnection();
                }
            };
        
            // Handle new ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('iceCandidate', roomId, userId, event.candidate);
                }
            };

            // Handle remote tracks
            peerConnection.ontrack = (event) => {
                remoteVideo.srcObject = event.streams[0];
            };

            // Renegotiate the session
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('offer', roomId, userId, offer);
        }
    }
}



// Handle connection events
// socket.on("connect", () => {
//     if (isConnected) {
//         console.log("Connected to server.");
//     }else{
//         console.log("Connected to server.");
//         // alert("Reconnected successfully!");
//     }
//     isConnected = true;
// });


socket.on("connect", () => {
    // console.log("Connected to server.");
    if (roomId) {
        console.log(`Rejoining room: ${roomId}`);
        socket.emit('joinRoom', roomId); // Rejoin the room
        if (localStream) {
            reconnect(); // Reinitialize WebRTC
        }
    }
    isConnected = true;
});




socket.on("disconnect", () => {
    isConnected = false;
    console.log("Disconnected from server.");
    // alert("Disconnected from the server, or due to network Error. Attempting to reconnect...");
});

// ICE Servers Configuration
const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // { urls: 'turn:turn.example.com', username: 'user', credential: 'password' }
    ]
};

// Register User (in index.html)
if (registerButton) {
    registerButton.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const UserHtml = () => {

        }
        if (username) {
            socket.emit('registerUser', username);
        }
    });

    socket.on('userRegistered', (id) => {
        userId = id;
        // console.log(`Registered as ${userId}`);
        // Redirect to the video call page after successful registration
        window.location.href = 'video-call.html';
    });
}

// Room & Video Call Operations (in video-call.html)
if (createRoomButton || joinRoomButton) {
    socket.on("roomFull", roomId => {
        alert(`${roomId} Room is Full, Create new Room or join Different room`);
        window.location.href = "index.html";
    })
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
    // joinRoomButton.addEventListener('click', () => {
    //     console.log("in Join User ",userId);
    //     roomId = roomIdInput.value.trim();
    //     if (roomId) {
    //         socket.emit('joinRoom', roomId, userId);
    //         console.log(`Joined room: ${roomId}`);
    //         document.getElementById('room').style.display = 'none';
    //         document.getElementById('callControls').style.display = 'block';
    //     }
    // });

    joinRoomButton.addEventListener('click', () => {
        roomId = roomIdInput.value.trim();
        if (roomId) {
            // console.log(`Joining room: ${roomId}`);  // Debugging log
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
        // console.log(`Offer received from ${senderId}`);
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
        console.log('Answer received');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    // Handle ICE Candidate
    socket.on('iceCandidate', async (senderId, candidate) => {
        console.log('ICE candidate received');
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
}
