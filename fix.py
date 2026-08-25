import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace the local messages state with the backend chat logic
old_chat_state = '''  const [messages, setMessages] = useState<{ name: string; text: string; time: string }[]>([
    { name: "Aman", text: "I'll be at the main gate in 2 mins", time: "10:42 AM" },
    { name: "Priya", text: "Waiting near the security cabin", time: "10:43 AM" },
  ]);
  const [message, setMessage] = useState("");
  
  const sendMessage = () => {
    if (!message.trim()) return;
    setMessages([...messages, { name: "You", text: message, time: "Now" }]);
    setMessage("");
  };'''

new_chat_state = '''  const [chatMessages, setChatMessages] = useState<{ name: string; text: string; time: string; isOwn?: boolean }[]>([]);
  const [chatMessage, setChatMessage] = useState("");

  useEffect(() => {
    const poolId = activePool?.id;
    if (!poolId) return;

    const fetchChat = () => {
      fetch(`${apiUrl}/api/chat/${poolId}`)
        .then((res) => res.json())
        .then((msgs: any[]) => {
          if (Array.isArray(msgs)) {
            setChatMessages(msgs.map((m) => ({
              name: m.user?.name || m.userId?.split("-")[0] || "Rider",
              text: m.text,
              time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isOwn: m.userId === token,
            })));
          }
        })
        .catch(console.error);
    };

    fetchChat();
    const interval = setInterval(fetchChat, 3000);
    return () => clearInterval(interval);
  }, [activePool?.id]);

  const sendChatMessage = () => {
    if (!chatMessage.trim()) return;
    const poolId = activePool?.id;
    if (!poolId) return;

    fetch(`${apiUrl}/api/chat/${poolId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: token, text: chatMessage.trim() }),
    })
      .then((res) => res.json())
      .then(() => setChatMessage(""))
      .catch(console.error);
  };'''

content = content.replace(old_chat_state, new_chat_state)

# 2. Update PoolView props to use the new names
content = content.replace(
'''          messages={messages}
          message={message}
          setMessage={setMessage}
          sendMessage={sendMessage}''',
'''          messages={chatMessages}
          message={chatMessage}
          setMessage={setChatMessage}
          sendMessage={sendChatMessage}'''
)

# 3. Update TrackingView props similarly
content = content.replace(
'''          messages={messages}
          message={message}
          setMessage={setMessage}
          sendMessage={sendMessage}''',
'''          messages={chatMessages}
          message={chatMessage}
          setMessage={setChatMessage}
          sendMessage={sendChatMessage}'''
)

# 4. Remove TrackingView's internal chat state since we moved it out
tracking_internal_chat = '''  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ name: string; text: string; time: string; isOwn?: boolean }[]>([]);
  const [chatMessage, setChatMessage] = useState("");'''

content = content.replace(tracking_internal_chat, '''  // Chat state
  const [chatOpen, setChatOpen] = useState(false);''')

tracking_internal_chat_logic = '''  // Poll chat messages from backend
  useEffect(() => {
    const poolId = poolData?.pool?.id;
    if (!poolId) return;

    const fetchChat = () => {
      fetch(`${apiUrl}/api/chat/${poolId}`)
        .then((res) => res.json())
        .then((msgs: any[]) => {
          if (Array.isArray(msgs)) {
            setChatMessages(msgs.map((m) => ({
              name: m.user?.name || m.userId?.split("-")[0] || "Rider",
              text: m.text,
              time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isOwn: m.userId === token,
            })));
          }
        })
        .catch(console.error);
    };

    fetchChat();
    const interval = setInterval(fetchChat, 3000);
    return () => clearInterval(interval);
  }, [poolData?.pool?.id]);

  // Send chat message to backend
  const sendChatMessage = () => {
    if (!chatMessage.trim()) return;
    const poolId = poolData?.pool?.id;
    if (!poolId) {
      setChatMessages((prev) => [...prev, { name: "You", text: chatMessage.trim(), time: "now", isOwn: true }]);
      setChatMessage("");
      return;
    }
    fetch(`${apiUrl}/api/chat/${poolId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: token, text: chatMessage.trim() }),
    })
      .then((res) => res.json())
      .then(() => {
        setChatMessage("");
        // Immediately fetch updated messages
        fetch(`${apiUrl}/api/chat/${poolId}`)
          .then((res) => res.json())
          .then((msgs: any[]) => {
            if (Array.isArray(msgs)) {
              setChatMessages(msgs.map((m) => ({
                name: m.user?.name || m.userId?.split("-")[0] || "Rider",
                text: m.text,
                time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isOwn: m.userId === token,
              })));
            }
          });
      })
      .catch(console.error);
  };'''

content = content.replace(tracking_internal_chat_logic, '')

# 5. Fix UUID bug in PoolView displayMembers
uuid_bug_old = '''  const displayMembers = realMembers.map((m, i) => ({
    name: m.user?.name || "Rider",
    initials: (m.user?.name || "Rider").substring(0, 2).toUpperCase(),
    color: m.userId === token ? "navy" : i % 2 === 0 ? "green" : "gold",
    paid: m.paymentStatus === "PAID",
    stop: m.stopSequence,
    userId: m.userId,
    individualFare: m.individualFare,
    distanceKm: m.distanceKm || 0,
  }));'''

uuid_bug_new = '''  const displayMembers = realMembers.map((m, i) => {
    let rawName = m.user?.name || m.name || "Rider";
    if (rawName.length > 20) rawName = "Rider";
    return {
      name: rawName,
      initials: rawName.substring(0, 2).toUpperCase(),
      color: m.userId === token ? "navy" : i % 2 === 0 ? "green" : "gold",
      paid: m.paymentStatus === "PAID",
      stop: m.stopSequence,
      userId: m.userId,
      individualFare: m.individualFare,
      distanceKm: m.distanceKm || 0,
    };
  });'''

content = content.replace(uuid_bug_old, uuid_bug_new)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
