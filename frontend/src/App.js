// src/App.js
import React, { useEffect, useRef, useState } from 'react';
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

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isCalling, setIsCalling] = useState(false); // Thêm state isCalling

  const myVideoRef = useRef();
  const userVideoRef = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    // Kết nối với Socket.IO và nhận ID
    socket.on('connect', () => {
      setMyId(socket.id);
    });

    // Lấy stream từ camera và microphone
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((currentStream) => {
      setStream(currentStream);
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = currentStream;
      }
    });

    // Lắng nghe sự kiện nhận cuộc gọi
    socket.on('receive-call', (data) => {
      setReceivingCall(true);
      setCallerId(data.from);
      setCallerOffer(data.offer);
    });

    // Lắng nghe sự kiện cuộc gọi được trả lời
    socket.on('call-answered', (data) => {
      if (connectionRef.current) {
        connectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer))
          .catch((err) => console.error('Error setting remote description:', err));
      }
      setCallAccepted(true);
      setIsCalling(false); // Đặt lại trạng thái khi cuộc gọi được trả lời
    });

    // Lắng nghe và thêm ICE candidate
    socket.on('ice-candidate', (data) => {
      if (connectionRef.current) {
        connectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
          .catch((err) => console.error('Error adding received ice candidate', err));
      }
    });

    // Clean up khi component bị unmount
    return () => {
      socket.off('connect');
      socket.off('receive-call');
      socket.off('call-answered');
      socket.off('ice-candidate');
    };
  }, []);

  // Hàm chung tạo RTCPeerConnection và xử lý các sự kiện
  const createPeerConnection = (toId, isCaller) => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    // Xử lý ICE candidate
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('send-ice-candidate', { to: toId, candidate: event.candidate });
      }
    };

    // Xử lý khi nhận stream từ đối tác
    peer.ontrack = (event) => {
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Thêm các track từ stream vào peer connection
    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    if (isCaller) {
      connectionRef.current = peer; // Lưu kết nối của người gọi vào ref
    }

    return peer;
  };

  // Hàm thực hiện cuộc gọi (caller)
  const callUser = async () => {
    if (!calleeId) {
      alert('Vui lòng nhập ID người nhận!');
      return;
    }

    setIsCalling(true); // Đặt trạng thái đang gọi

    const peer = createPeerConnection(calleeId, true); // Tạo kết nối và đánh dấu là caller

    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit('call-user', { to: calleeId, offer });

      connectionRef.current = peer; // Lưu peer connection
    } catch (err) {
      console.error('Error creating offer:', err);
      setIsCalling(false); // Đặt lại trạng thái nếu có lỗi
    }
  };

  // Hàm trả lời cuộc gọi (callee)
  const answerCall = async () => {
    setCallAccepted(true);
    setIsCalling(false); // Đặt lại trạng thái khi trả lời cuộc gọi

    const peer = createPeerConnection(callerId, false); // Tạo kết nối và đánh dấu là callee

    try {
      await peer.setRemoteDescription(new RTCSessionDescription(callerOffer));

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit('answer-call', { to: callerId, answer });

      connectionRef.current = peer; // Lưu peer connection
    } catch (err) {
      console.error('Error answering call:', err);
      setIsCalling(false); // Đặt lại trạng thái nếu có lỗi
    }
  };

  // Hàm bật/tắt mic
  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsMicOn(track.enabled);
      });
    }
  };

  // Hàm bật/tắt camera
  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsCameraOn(track.enabled);
      });
    }
  };

  // Hàm kết thúc cuộc gọi
  const endCall = () => {
    // Đóng kết nối peer
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }

    // Dừng các track media
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    // Reset state
    setCallAccepted(false);
    setReceivingCall(false);
    setCallerId('');
    setCallerOffer(null);
    setCalleeId('');
    setIsMicOn(true);
    setIsCameraOn(true);
    setIsCalling(false); // Đặt lại trạng thái khi kết thúc cuộc gọi
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
          <video ref={myVideoRef} autoPlay playsInline muted />
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

        {/* Thêm các nút điều khiển mới */}
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

      {/* Thêm thông báo khi đang gọi */}
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
