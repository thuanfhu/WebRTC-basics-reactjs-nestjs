import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:8081');

function App() {
  const [myId, setMyId] = useState('');
  const [calleeId, setCalleeId] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerId, setCallerId] = useState('');

  useEffect(() => {
    socket.on('connect', () => {
      setMyId(socket.id);
    });

    socket.on('receive-call', (data) => {
      setReceivingCall(true);
      setCallerId(data.from); 
      alert(`Đang có cuộc gọi từ: ${data.from}`);
    });

    socket.on('call-answered', (data) => {
      console.log(`Cuộc gọi đã được trả lời từ: ${data.from}`);
    });
  }, []);

  const callUser = () => {
    if (calleeId) {
      setIsCalling(true);
      socket.emit('call-user', { to: calleeId, offer: 'some-offer-data' });
    }
  };

  const answerCall = () => {
    socket.emit('answer-call', { to: callerId, answer: 'some-answer-data' });
    setReceivingCall(false);
  };

  return (
    <div>
      <h1>My ID: {myId}</h1>
      <input
        type="text"
        placeholder="Nhập ID người nhận"
        value={calleeId}
        onChange={(e) => setCalleeId(e.target.value)}
      />
      <button onClick={callUser} disabled={isCalling}>
        Gọi
      </button>

      {receivingCall && (
        <div>
          <p>Bạn đang nhận cuộc gọi từ: {callerId}</p>
          <button onClick={answerCall}>Trả lời</button>
        </div>
      )}
    </div>
  );
}

export default App;
