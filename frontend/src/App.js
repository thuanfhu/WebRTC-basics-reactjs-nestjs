import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:8081');

function App() {
  const [myId, setMyId] = useState('');
  const [calleeId, setCalleeId] = useState('');
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerId, setCallerId] = useState('');
  const [callerOffer, setCallerOffer] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);

  const myVideoRef = useRef();
  const userVideoRef = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    socket.on('connect', () => {
      setMyId(socket.id)
    });

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((currentStream) => {
      setStream(currentStream);
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = currentStream;
      }
    });

    socket.on('receive-call', (data) => {
      setReceivingCall(true);
      setCallerId(data.from);
      setCallerOffer(data.offer);
    });

    socket.on('call-answered', (data) => {
      if (connectionRef.current) {
        connectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer))
        .catch((err) => console.error('Error setting remote description:', err));
      }
      setCallAccepted(true);
    });

    socket.on('ice-candidate', (data) => {
      if (connectionRef.current) {
        connectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
          .catch((err) => console.error('Error adding received ice candidate', err));
      }
    });

    // Clean up when events of component is cancelled!
    return () => {
      socket.off('connect');
      socket.off('receive-call');
      socket.off('call-answered');
      socket.off('ice-candidate');
    };
  }, []);

  const callUser = async () => {
    if (!calleeId) {
      alert('Vui lòng nhập ID người nhận!');
      return;
    }

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('send-ice-candidate', { to: calleeId, candidate: event.candidate });
      }
    };

    peer.ontrack = (event) => {
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = event.streams[0];
      }
    };

    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit('call-user', { to: calleeId, offer });

      connectionRef.current = peer;
    } catch (err) {
      console.error('Error creating offer:', err);
    }
  };

  const answerCall = async () => {
    setCallAccepted(true);
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('send-ice-candidate', { to: callerId, candidate: event.candidate });
      }
    };

    peer.ontrack = (event) => {
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = event.streams[0];
      }
    };

    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    try {
      await peer.setRemoteDescription(new RTCSessionDescription(callerOffer));

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('answer-call', { to: callerId, answer });

      connectionRef.current = peer;
    } catch (err) {
      console.error('Error answering call:', err);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Ứng dụng Gọi Video</h1>
        <p>Chào mừng bạn đến với ứng dụng gọi video WebRTC!</p>
        <p>Mã ID của bạn: <strong>{myId}</strong></p>
      </div>  

      <div className="video-section">
        <div className="video-container">
          <video ref={myVideoRef} autoPlay playsInline muted />
          <p style={{ textAlign: 'center', marginTop: '5px' }}>Bạn</p>
        </div>
        {callAccepted && (
          <div className="video-container">
            <video ref={userVideoRef} autoPlay playsInline />
            <p style={{ textAlign: 'center', marginTop: '5px' }}>Đối tác</p>
          </div>
        )}
      </div>

      <div className="controls">
        <input
          type="text"
          value={calleeId}
          onChange={(e) => setCalleeId(e.target.value)}
          placeholder="Nhập ID người nhận"
        />
        <div className="button-group">
          <button className="call-button" onClick={callUser} disabled={!calleeId || callAccepted}>
            Gọi
          </button>
          {receivingCall && !callAccepted && (
            <button className="answer-button" onClick={answerCall}>
              Trả lời
            </button>
          )}
        </div>
      </div>

      {receivingCall && !callAccepted && (
        <div className="call-notification">
          <p>Đang có cuộc gọi từ: {callerId}</p>
          <button className="answer-button" onClick={answerCall}>Trả lời</button>
        </div>
      )}
    </div>
  );
}

export default App;
