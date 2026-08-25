import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add onMatching to TrackingView instantiation
replacement1 = r'''<TrackingView
            pickup={pickup}
            dropoff={dropoff}
            vehicle={vehicle}
            fare={fare}
            distance={realDistance}
            time={realTime}
            sosSent={sosSent}
            onSos={() => setSosSent(true)}
            onBack={() => setStage("pool")}
            onMatching={() => setStage("matching")}
            onShare={() => {
              setToast("Trip tracking link copied to clipboard!");
              window.setTimeout(() => setToast(""), 2500);
            }}
          />'''
text = re.sub(r'<TrackingView[^>]*/>', replacement1, text, count=1, flags=re.DOTALL)

# 2. Add onMatching to TrackingView signature
text = re.sub(r'  onShare,\n\}: \{', r'  onShare,\n  onMatching,\n}: {', text, count=1)
text = re.sub(r'onShare: \(\) => void;\n\}\) \{', r'onShare: () => void;\n  onMatching: () => void;\n}) {', text, count=1)

# 3. Update TrackingView fetchPool to check waiting queue
pattern3 = r'(setPoolData\(data\);\n\s+if \(data\.pool && data\.pool\.driverDetails\) \{\n\s+const parsedDriver = [^\n]*;\n\s+setDriverInfo\([^)]*\);\n\s+\})'
replacement3 = r'''\1
        if (data.error === "No active pool found") {
           fetch(`${apiUrl}/api/pools/waiting`)
             .then(r => r.json())
             .then(wData => {
                if (wData.waiting && wData.waiting.some((w: any) => w.userId === token)) {
                   onMatching();
                }
             }).catch(console.error);
        }'''
text = re.sub(pattern3, replacement3, text, count=1)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Success')
