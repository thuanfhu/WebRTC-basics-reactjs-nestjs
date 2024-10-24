import React, { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import './App.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const socket = io('http://localhost:8081');

function App() {
  const [myId, setMyId] = useState('');
  const [calleeId, setCalleeId] = useState('');
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerId, setCallerId] = useState('');
  const [callerOffer, setCallerOffer] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [iceCandidateQueue, setIceCandidateQueue] = useState([]);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isCalling, setIsCalling] = useState(false);

  const myVideoRef = useRef();
  const userVideoRef = useRef();
  const connectionRef = useRef();
  const endCallRef = useRef();

  const endCall = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }

    if (stream) stream.getTracks().forEach(track => track.stop());

    setCallAccepted(false); setReceivingCall(false);
    setCallerId(''); setCallerOffer(null);
    setCalleeId(''); setIsMicOn(true);
    setIsCameraOn(true); setIsCalling(false);

    if (callerId) socket.emit('end-call', { to: callerId });
    else if (calleeId) socket.emit('end-call', { to: calleeId });

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideoRef.current) myVideoRef.current.srcObject = currentStream;
      })
      .catch((err) => {console.error('Error restarting media devices:', err)});
  }, [callerId, calleeId, stream]);

  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  useEffect(() => {
    socket.on('connect', () => {
      setMyId(socket.id);
    });

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((currentStream) => {
      setStream(currentStream);
      if (myVideoRef.current) myVideoRef.current.srcObject = currentStream;
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
      setIsCalling(false);
    });

    socket.on('ice-candidate', (data) => {
      if (connectionRef.current) {
        connectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
          .catch((err) => console.error('Error adding received ice candidate', err));
      } else {
        setIceCandidateQueue(prevQueue => [...prevQueue, data.candidate]);
      }
    });

    socket.on('end-call', () => {
      if (endCallRef.current) endCallRef.current();
    });

    return () => {
      socket.off('connect');
      socket.off('receive-call');
      socket.off('call-answered');
      socket.off('ice-candidate');
      socket.off('end-call')
    };
  }, []);

  const createPeerConnection = (toId, isCaller) => {
    const peer = new RTCPeerConnection({iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]});

    peer.onicecandidate = (event) => {
      if (event.candidate) socket.emit('send-ice-candidate', { to: toId, candidate: event.candidate });
    };

    peer.ontrack = (event) => {
      if (userVideoRef.current) userVideoRef.current.srcObject = event.streams[0];
    };

    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    if (isCaller) connectionRef.current = peer; 

    return peer;
  };

  const callUser = async () => {
    if (!calleeId) {
      alert('Vui lòng nhập ID người nhận!'); 
      return;
    }

    setIsCalling(true); 

    const peer = createPeerConnection(calleeId, true); 

    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit('call-user', { to: calleeId, offer });
      connectionRef.current = peer;

    } catch (err) {
      console.error('Error creating offer:', err);
      setIsCalling(false);
    }
  };

  const answerCall = async () => {
    setCallAccepted(true);
    setIsCalling(false);

    const peer = createPeerConnection(callerId, false);

    try {
      await peer.setRemoteDescription(new RTCSessionDescription(callerOffer));

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit('answer-call', { to: callerId, answer });

      connectionRef.current = peer;

      iceCandidateQueue.forEach(candidate => {
        connectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
          .catch((err) => console.error('Error adding ice candidate from queue', err));
      });
      setIceCandidateQueue([]);

    } catch (err) {
      console.error('Error answering call:', err);
      setIsCalling(false);
    }
  };

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsMicOn(track.enabled);
      });
    }
  };

  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsCameraOn(track.enabled);
      });
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Ứng dụng Gọi Video</h1>
        <p>Chào mừng bạn đến với ứng dụng gọi video WebRTC!</p>
        <p>Mã ID của bạn: <strong className="user-id">{myId}</strong></p>
      </div>  

      <div className="video-section">
        <div className="video-container">
          <video ref={myVideoRef} autoPlay playsInline muted/>
          <p>Bạn</p>
        </div>
        {callAccepted && (
          <div className="video-container">
            <video ref={userVideoRef} autoPlay playsInline />
            <p>Đối tác</p>
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
            <i className="fas fa-phone" style={{ marginRight: '10px' }}></i>Gọi
          </button>
          {receivingCall && !callAccepted && (
            <button className="answer-button" onClick={answerCall}>
              <i className="fas fa-phone-alt" style={{ marginRight: '10px' }}></i>Trả lời
            </button>
          )}
        </div>

        {callAccepted && (
          <div className="additional-controls">
            <button className={`mic-button ${isMicOn ? 'active' : 'inactive'}`} onClick={toggleMic} data-tooltip={isMicOn ? 'Tắt Mic' : 'Bật Mic'}>
              <i className={`fas ${isMicOn ? 'fa-microphone' : 'fa-microphone-slash'}`} style={{ marginRight: '10px' }}></i>
              {isMicOn ? 'Tắt Mic' : 'Bật Mic'}
            </button>
            <button className={`camera-button ${isCameraOn ? 'active' : 'inactive'}`} onClick={toggleCamera} data-tooltip={isCameraOn ? 'Tắt Camera' : 'Bật Camera'}>
              <i className={`fas ${isCameraOn ? 'fa-video' : 'fa-video-slash'}`} style={{ marginRight: '10px' }}></i>
              {isCameraOn ? 'Tắt Camera' : 'Bật Camera'}
            </button>
            <button className="end-call-button" onClick={endCall} data-tooltip="Kết thúc cuộc gọi">
              <i className="fas fa-phone-alt" style={{ marginRight: '10px' }}></i>
              Kết thúc Cuộc Gọi
            </button>
          </div>
        )}
      </div>

      {receivingCall && !callAccepted && (
        <div className="call-notification">
          <p>Đang có cuộc gọi từ: {callerId}</p>
          <button className="answer-button" onClick={answerCall}>
            <i className="fas fa-phone-alt" style={{ marginRight: '10px' }}></i> Trả lời
          </button>
        </div>
      )}

      {isCalling && (
        <div className="calling-overlay">
          <div className="calling-notification">
            <p>Đang gọi đến {calleeId}...</p>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
