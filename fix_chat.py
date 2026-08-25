import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

poolview_chat_logic = '''  // Chat polling for PoolView
  const [chatMessages, setChatMessages] = useState<{ name: string; text: string; time: string; isOwn?: boolean }[]>([]);
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
  };
'''

# Find a good place in PoolView to insert this. e.g. after 'const maxSeats = ...'
target = '''  const maxSeats = (activePool?.vehicleType === "CAB_4" || vehicle === "CAB_4") ? 4 : 3;'''

content = content.replace(target, target + '\n' + poolview_chat_logic)

# Replace ChatDrawer usages in PoolView to use new state
old_chat_drawer = '''      {chatOpen && (
        <ChatDrawer messages={messages} message={message} setMessage={setMessage} sendMessage={sendMessage} onClose={() => setChatOpen(false)} />
      )}'''
new_chat_drawer = '''      {chatOpen && (
        <ChatDrawer messages={chatMessages} message={chatMessage} setMessage={setChatMessage} sendMessage={sendChatMessage} onClose={() => setChatOpen(false)} />
      )}'''

content = content.replace(old_chat_drawer, new_chat_drawer)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
