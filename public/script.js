const socket = io();

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
        console.log(`Registered as ${userId}`);
        // Redirect to the video call page after successful registration
        window.location.href = 'video-call.html';
    });
}

// Room & Video Call Operations (in video-call.html)
if (createRoomButton) {
    // Create Room
    createRoomButton.addEventListener('click', () => {
        roomId = roomIdInput.value.trim();
        if (roomId) {
            socket.emit('joinRoom', roomId, userId);
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
            console.log(`Joining room: ${roomId}`);  // Debugging log
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
        console.log(`Offer received from ${senderId}`);
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
