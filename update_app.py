import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add onMatching to App rendering PoolView
pattern1 = r'(onTrack=\{\(\) => setStage\("tracking"\)\})'
replacement1 = r'\1\n            onMatching={() => setStage("matching")}'
text = re.sub(pattern1, replacement1, text, count=1)

# 2. Add onMatching to PoolView signature
text = re.sub(r'  onTrack,\n\}: \{', r'  onTrack,\n  onMatching,\n}: {', text, count=1)
pattern2 = r'(onTrack: \(\) => void;\n\}\) \{)'
replacement2 = r'onTrack: () => void;\n  onMatching: () => void;\n}) {'
text = re.sub(pattern2, replacement2, text, count=1)

# 3. Update simDestination state type
pattern3 = r'(const \[simDestination, setSimDestination\] = useState\("Gwalior Railway Station"\);)'
replacement3 = r'const [simDestination, setSimDestination] = useState<Location>({ name: "Gwalior Railway Station", lat: 26.2183, lng: 78.1828 });'
text = re.sub(pattern3, replacement3, text, count=1)

# 4. Update handleSimulateRider dest
pattern4 = r'(const dest = DESTINATIONS\.find\(\(d\) => d\.name === simDestination\) \|\| DESTINATIONS\[0\];)'
replacement4 = r'const dest = simDestination;'
text = re.sub(pattern4, replacement4, text, count=1)

# 5. Update fetchPool to check waiting queue
pattern5 = r'(if \(data\.error === "No active pool found"\) \{\n\s+)(setNoActiveRides\(true\);\n\s+\})'
replacement5 = r'''\1fetch(`${apiUrl}/api/pools/waiting`)
              .then(res => res.json())
              .then(wData => {
                 if (wData.waiting && wData.waiting.some((w: any) => w.userId === token)) {
                    onMatching();
                 } else {
                    setNoActiveRides(true);
                 }
              }).catch(() => setNoActiveRides(true));
          }'''
text = re.sub(pattern5, replacement5, text, count=1)

# 6. Replace <select> with <InteractiveMap> in PoolView
pattern6 = r'<select\s+value=\{simDestination\}.*?</select>'
replacement6 = r'''<div className="map-picker">
                <div className="map-label">
                  <span>
                    <Crosshair size={15} /> Tap map to pin destination
                  </span>
                  <small>
                    {simDestination.lat.toFixed(4)}, {simDestination.lng.toFixed(4)}
                  </small>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "150px",
                    margin: "10px 0",
                    padding: "0",
                  }}
                >
                  <InteractiveMap
                    pickup={currentPickup}
                    dropoff={simDestination}
                    onMapClick={async (lat, lng) => {
                      const name = await reverseGeocode(lat, lng);
                      setSimDestination({ name: name || "Custom destination", lat, lng });
                    }}
                  />
                </div>
              </div>'''
text = re.sub(pattern6, replacement6, text, flags=re.DOTALL)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Success')
