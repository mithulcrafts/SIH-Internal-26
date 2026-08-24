const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add getDistance and getTime functions
if (!content.includes('function getDistance')) {
  const insertIndex = content.indexOf('function getSupabase');
  content = content.slice(0, insertIndex) + 
`function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1);
}

function getTime(distanceStr: string) {
  const dist = parseFloat(distanceStr);
  const time = Math.round((dist / 30) * 60); // Assuming 30 km/h average speed in city
  return Math.max(5, time); // Minimum 5 minutes
}

` + content.slice(insertIndex);
}

// 2. Remove mock members array
content = content.replace(/const members = \[\s*\{ name: "Aarav Mehta".*?\s*\},\s*\{ name: "You".*?\s*\},\s*\{ name: "Priya Singh".*?\s*\}\s*\];/s, '');

// 3. Replace mock distance logic in App
const oldDistanceLogic = `const distance = dropoff.name.includes("Airport")
    ? "12.8 km"
    : dropoff.name.includes("Station")
      ? "6.4 km"
      : "7.1 km";`;
const newDistanceLogic = `const realDistance = getDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
  const realTime = getTime(realDistance);`;
content = content.replace(oldDistanceLogic, newDistanceLogic);

// 4. Update PoolView props to take distance and time
content = content.replace('vehicle={vehicle}\n            fare={fare}', 'vehicle={vehicle}\n            fare={fare}\n            distance={realDistance}\n            time={realTime}');
content = content.replace('function PoolView({\n  pickup,\n  dropoff,\n  vehicle,\n  fare,', 'function PoolView({\n  pickup,\n  dropoff,\n  vehicle,\n  fare,\n  distance,\n  time,');
content = content.replace('  fare: number;\n  paid: boolean;', '  fare: number;\n  distance: string;\n  time: number;\n  paid: boolean;');
// Replace hardcoded values in PoolView
content = content.replace('<span className="route-time">ETA: 5m</span>', '<span className="route-time">ETA: 2m</span>');
content = content.replace('<span className="route-time">25m trip</span>', '<span className="route-time">{time}m trip</span>');
content = content.replace('<span><Clock3 size={17} /> 25 min</span>', '<span><Clock3 size={17} /> {time} min</span>');
content = content.replace(/<span><Navigation size=\{17\} \/> \{dropoff\.name\.includes\('Airport'\) \? '12\.8 km' : '6\.4 km'\}<\/span>/, '<span><Navigation size={17} /> {distance} km</span>');

// Replace fallback to members
content = content.replace('const displayMembers = realMembers.length > 0 ? realMembers.map((m: any, i: number) => ({\n    name: m.profiles?.name || "Student",\n    initials: (m.profiles?.name || "S").substring(0, 2).toUpperCase(),\n    color: i === 0 ? "gold" : i === 1 ? "navy" : "green",\n    paid: true,\n    stop: i + 1\n  })) : members;', 'const displayMembers = realMembers.map((m: any, i: number) => ({\n    name: m.profiles?.name || "Student",\n    initials: (m.profiles?.name || "S").substring(0, 2).toUpperCase(),\n    color: i === 0 ? "gold" : i === 1 ? "navy" : "green",\n    paid: true,\n    stop: i + 1\n  }));');

// 5. Update TrackingView props to take distance and time
content = content.replace('dropoff={dropoff}\n            sosSent={sosSent}', 'dropoff={dropoff}\n            distance={realDistance}\n            time={realTime}\n            sosSent={sosSent}');
content = content.replace('function TrackingView({\n  pickup,\n  dropoff,\n  sosSent,', 'function TrackingView({\n  pickup,\n  dropoff,\n  distance,\n  time,\n  sosSent,');
content = content.replace('  dropoff: Location;\n  sosSent: boolean;', '  dropoff: Location;\n  distance: string;\n  time: number;\n  sosSent: boolean;');
content = content.replace('distanceKm: driverInfo?.distanceKm || 1.8', 'distanceKm: driverInfo?.distanceKm || distance');

// 6. Reset chat messages mock
content = content.replace(/const \[messages, setMessages\] = useState\(\[\s*\{ name: "Aarav", text: "Leaving BH-1 in 5 mins", time: "10:42" \},\s*\{ name: "Priya", text: "I’ll be at GH on time\.", time: "10:43" \},\s*\]\);/s, 'const [messages, setMessages] = useState<{name: string, text: string, time: string}[]>([]);');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done!');
