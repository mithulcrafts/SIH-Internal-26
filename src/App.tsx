import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CarFront,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  CreditCard,
  Crosshair,
  Headphones,
  HelpCircle,
  LocateFixed,
  LockKeyhole,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  PhoneCall,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { InteractiveMap } from "./components/InteractiveMap";
import { reverseGeocode, searchPlaces } from "./services/maps";

type Stage =
  "login" | "home" | "support" | "request" | "matching" | "pool" | "tracking";
type Vehicle = "AUTO_3" | "CAB_4";
type Location = { name: string; lat: number; lng: number };

const pickupPresets: Location[] = [
  { name: "BH-1", lat: 26.2495, lng: 78.174 },
  { name: "BH-2", lat: 26.2488, lng: 78.1732 },
  { name: "BH-3", lat: 26.2501, lng: 78.1748 },
  { name: "BH-4", lat: 26.251, lng: 78.1755 },
  { name: "GH", lat: 26.2475, lng: 78.1718 },
  { name: "Main Gate", lat: 26.246, lng: 78.1702 },
];
const destinations: Location[] = [
  { name: "Gwalior Railway Station", lat: 26.2183, lng: 78.1828 },
  { name: "City Center / DD Mall", lat: 26.2052, lng: 78.1944 },
  { name: "Maharaj Bada", lat: 26.2005, lng: 78.1589 },
  { name: "Rajmata Vijayaraje Scindia Airport", lat: 26.2941, lng: 78.2272 },
  { name: "BH-1", lat: 26.2495, lng: 78.174 },
  { name: "BH-2", lat: 26.2488, lng: 78.1732 },
  { name: "BH-3", lat: 26.2501, lng: 78.1748 },
  { name: "BH-4", lat: 26.251, lng: 78.1755 },
  { name: "Girls Hostel (GH)", lat: 26.2475, lng: 78.1718 },
  { name: "Main Gate", lat: 26.246, lng: 78.1702 },
  { name: "Cafeteria", lat: 26.248, lng: 78.173 },
  { name: "Satpura", lat: 26.249, lng: 78.176 },
  { name: "Academic Block", lat: 26.247, lng: 78.174 },
  { name: "Admin Block", lat: 26.2465, lng: 78.1735 },
  { name: "MDP", lat: 26.2485, lng: 78.172 },
];
const members = [
  { name: "Aarav Mehta", initials: "AM", color: "gold", paid: true, stop: 1 },
  { name: "You", initials: "Y", color: "navy", paid: true, stop: 2 },
  { name: "Priya Singh", initials: "PS", color: "green", paid: false, stop: 3 },
];

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

function getTime(distanceStr: string) {
  const dist = parseFloat(distanceStr);
  const time = Math.round((dist / 30) * 60); // Assuming 30 km/h average speed in city
  return Math.max(5, time); // Minimum 5 minutes
}

function getSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function App() {
  const [stage, setStage] = useState<Stage>(() => {
    const path = window.location.pathname;
    if (path === "/support") return "support";
    if (
      path === "/explore" ||
      localStorage.getItem("campuspool-stage") === "home"
    )
      return "home";
    return "login";
  });
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loginSent, setLoginSent] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [pickup, setPickup] = useState<Location>(pickupPresets[0]);
  const [dropoff, setDropoff] = useState<Location>(destinations[0]);
  const [vehicle, setVehicle] = useState<Vehicle>("AUTO_3");
  const [when, setWhen] = useState<"now" | "later">("later");
  const [prebookTime, setPrebookTime] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<
    { name: string; text: string; time: string }[]
  >([]);
  const [paid, setPaid] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [mapPin, setMapPin] = useState({ x: 44, y: 61 });
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (stage === "login") localStorage.removeItem("campuspool-stage");
    else
      localStorage.setItem(
        "campuspool-stage",
        stage === "home" || stage === "support" ? "home" : stage,
      );
    const path = stage === "home" ? "/explore" : `/${stage}`;
    window.history.replaceState(null, "", path);
  }, [stage]);

  const filteredDestinations = useMemo(
    () =>
      destinations.filter((item) =>
        item.name.toLowerCase().includes(destinationQuery.toLowerCase()),
      ),
    [destinationQuery],
  );
  const fare = vehicle === "AUTO_3" ? 68 : 92;
  const realDistance = getDistance(
    pickup.lat,
    pickup.lng,
    dropoff.lat,
    dropoff.lng,
  );
  const realTime = getTime(realDistance);

  const signIn = async () => {
    setLoginError("");
    if (!email.toLowerCase().endsWith("@iiitm.ac.in")) {
      setLoginError("Use your official @iiitm.ac.in email address.");
      return;
    }
    if (!loginSent) {
      setLoginSent(true);
      return;
    }
    if (otp !== "123456") {
      setLoginError("Enter the 6-digit code. Demo code: 123456");
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    try {
      const res = await fetch(`${apiUrl}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("token", data.user.id);
        localStorage.setItem("user", JSON.stringify(data.user));
        setStage("home");
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch (e) {
      console.error(e);
      setLoginError("Network error");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("campuspool-stage");
    setPaid(false);
    setSosSent(false);
    setChatOpen(false);
    setMessages([]);
    setToast("Logged out successfully");
    setStage("login");
    window.setTimeout(() => setToast(""), 2600);
  };

  const requestRide = async () => {
    if (when === "later" && !prebookTime) {
      setToast("Please select a valid time for pre-booking");
      window.setTimeout(() => setToast(""), 2600);
      return;
    }

    const start = when === "later" ? new Date(prebookTime) : new Date();
    const end = new Date(start.getTime() + 15 * 60000);

    const token = localStorage.getItem("token") || `demo-${Date.now()}`;
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/rides/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: token,
          pickupLocationName: pickup.name,
          dropoffLocationName: dropoff.name,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
          flexTimeStart: start.toISOString(),
          flexTimeEnd: end.toISOString(),
          vehicleType: vehicle,
        }),
      });
      const data = await res.json();

      if (when === "later") {
        setToast("Ride scheduled! We will notify you when matched.");
        window.setTimeout(() => setToast(""), 3500);
        setStage("home");
      } else {
        setStage("matching");
        window.setTimeout(() => {
          if (data.poolId) {
            setStage("pool");
          } else {
            setToast("Added to waiting queue! Waiting for others to join...");
            window.setTimeout(() => setToast(""), 3500);
            setStage("home");
          }
        }, 1600);
      }
    } catch (e) {
      console.error(e);
      setToast("Failed to request ride");
      window.setTimeout(() => setToast(""), 2600);
    }
  };

  const sendMessage = () => {
    if (!chatMessage.trim()) return;
    setMessages([
      ...messages,
      { name: "You", text: chatMessage.trim(), time: "now" },
    ]);
    setChatMessage("");
  };

  if (stage === "login")
    return (
      <LoginView
        email={email}
        setEmail={setEmail}
        otp={otp}
        setOtp={setOtp}
        loginSent={loginSent}
        error={loginError}
        toast={toast}
        onContinue={signIn}
      />
    );
  return (
    <div className="app-shell">
      <TopBar
        onHome={() => setStage("home")}
        onSupport={() => setStage("support")}
        onLogout={logout}
      />
      <main className="main-content">
        {stage === "home" && (
          <HomeView
            onRequest={async (dest?: string) => {
              if (dest) {
                const found = destinations.find(d => d.name.toLowerCase().includes(dest.toLowerCase()));
                if (found) {
                  setDropoff(found);
                } else {
                  const results = await searchPlaces(dest);
                  if (results && results.length > 0) {
                    setDropoff(results[0]);
                  }
                }
              }
              setStage("request");
            }}
            onTracking={() => setStage("tracking")}
          />
        )}
        {stage === "support" && <SupportView />}
        {stage === "request" && (
          <RequestView
            pickup={pickup}
            setPickup={setPickup}
            dropoff={dropoff}
            setDropoff={setDropoff}
            vehicle={vehicle}
            setVehicle={setVehicle}
            when={when}
            setWhen={setWhen}
            prebookTime={prebookTime}
            setPrebookTime={setPrebookTime}
            query={destinationQuery}
            setQuery={setDestinationQuery}
            destinations={filteredDestinations}
            mapPin={mapPin}
            setMapPin={setMapPin}
            onBack={() => setStage("home")}
            onRequest={requestRide}
            fare={fare}
          />
        )}
        {stage === "matching" && (
          <MatchingView pickup={pickup} dropoff={dropoff} />
        )}
        {stage === "pool" && (
          <PoolView
            pickup={pickup}
            dropoff={dropoff}
            vehicle={vehicle}
            fare={fare}
            distance={realDistance}
            time={realTime}
            paid={paid}
            setPaid={setPaid}
            chatOpen={chatOpen}
            setChatOpen={setChatOpen}
            messages={messages}
            message={chatMessage}
            setMessage={setChatMessage}
            sendMessage={sendMessage}
            onTrack={() => setStage("tracking")}
          />
        )}
        {stage === "tracking" && (
          <TrackingView
            pickup={pickup}
            dropoff={dropoff}
            distance={realDistance}
            time={realTime}
            sosSent={sosSent}
            onSos={() => setSosSent(true)}
            onBack={() => setStage("pool")}
            onShare={() => {
              setToast("Trip tracking link copied to clipboard!");
              window.setTimeout(() => setToast(""), 2500);
            }}
          />
        )}
      </main>
      <BottomNav
        stage={stage}
        onHome={() => setStage("home")}
        onRides={() => setStage("pool")}
        onSafety={() => setStage("tracking")}
        onSupport={() => setStage("support")}
      />
      {toast && (
        <div className="toast">
          <Check size={16} /> {toast}
        </div>
      )}
      <button 
        style={{ position: 'fixed', bottom: '80px', right: '20px', zIndex: 9999, background: '#1E4E8C', color: 'white', padding: '10px 15px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
        onClick={() => {
          const mockId = "demo-" + Math.floor(Math.random() * 10000);
          localStorage.setItem("token", mockId);
          window.location.reload();
        }}
      >
        <Users size={16} /> Simulate Another Rider
      </button>
    </div>
  );
}

function LoginView({
  email,
  setEmail,
  otp,
  setOtp,
  loginSent,
  error,
  toast,
  onContinue,
}: {
  email: string;
  setEmail: (value: string) => void;
  otp: string;
  setOtp: (value: string) => void;
  loginSent: boolean;
  error: string;
  toast: string;
  onContinue: () => void;
}) {
  return (
    <div className="login-page">
      <div className="login-glow" />
      <div className="login-card">
        <div className="brand-mark iiitm-logo">
          <span>IIITM</span>
          <CarFront size={22} strokeWidth={2.5} />
        </div>
        <p className="eyebrow">ABV-IIITM GWALIOR</p>
        <h1>
          CampusPool<span>.</span>
        </h1>
        <p className="login-copy">
          Shared rides. Lower fares.
          <br />
          Safer journeys with your campus crew.
        </p>
        <div className="student-badge">
          <ShieldCheck size={18} />
          <span>Verified student network</span>
          <Check size={16} />
        </div>
        {!loginSent ? (
          <label className="field-label">
            IIITM email
            <input
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="yourname@iiitm.ac.in"
              type="email"
            />
          </label>
        ) : (
          <label className="field-label">
            6-digit verification code
            <input
              autoFocus
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="123456"
              inputMode="numeric"
            />
          </label>
        )}
        {error && <p className="error-text">{error}</p>}
        <button className="primary-button wide" onClick={onContinue}>
          {loginSent ? "Enter CampusPool" : "Send verification code"}
          <ChevronRight size={18} />
        </button>
        <p className="secure-note">
          <LockKeyhole size={14} /> Your campus identity stays private
        </p>
      </div>
      <p className="login-footer">Built for the IIITM community · v1.0</p>
      {toast && (
        <div className="toast login-toast">
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  );
}

function TopBar({
  onHome,
  onSupport,
  onLogout,
}: {
  onHome: () => void;
  onSupport: () => void;
  onLogout: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const user = getUser();
  const name = user.name || "Student";
  const email = user.email || "student@iiitm.ac.in";
  const initials = name.substring(0, 2).toUpperCase();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="top-brand" onClick={onHome}>
          <span className="mini-mark iiitm-logo-mini">
            <span>IIITM</span>
          </span>
          <span>CampusPool</span>
        </button>
        <nav className="top-links">
          <button className="top-link active" onClick={onHome}>
            Explore
          </button>
          <button className="top-link" onClick={onSupport}>
            Support
          </button>
        </nav>
        <div className="profile-wrap">
          <button
            className="profile-trigger"
            onClick={() => setProfileOpen(!profileOpen)}
          >
            <span className="avatar">{initials}</span>
            <span className="profile-name">{name}</span>
            <ChevronDown size={15} />
          </button>
          {profileOpen && (
            <div className="profile-menu">
              <div className="profile-menu-head">
                <span className="avatar large">{initials}</span>
                <div>
                  <strong>{name}</strong>
                  <small>Student</small>
                </div>
              </div>
              <p className="profile-email">{email}</p>
              <button className="logout-button" onClick={onLogout}>
                <LogOut size={16} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function HomeView({
  onRequest,
  onTracking,
}: {
  onRequest: (dest?: string) => void;
  onTracking: () => void;
}) {
  const user = getUser();
  const firstName = (user.name || "Student").split(" ")[0];
  const [weather, setWeather] = useState<{ temp: number; desc: string } | null>(null);
  const [activePoolsCount, setActivePoolsCount] = useState<number>(0);
  const [waitingQueue, setWaitingQueue] = useState<{name: string, destination: string, vehicle: string}[]>([]);

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=26.2183&longitude=78.1828&current_weather=true")
      .then(res => res.json())
      .then(data => {
         if (data?.current_weather) {
            setWeather({ 
              temp: Math.round(data.current_weather.temperature), 
              desc: data.current_weather.weathercode === 0 ? 'Clear skies' : 'Cloudy' 
            });
         }
      }).catch(console.error);

    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    fetch(`${apiUrl}/api/pools/stats`)
      .then(res => res.json())
      .then(data => setActivePoolsCount(data.activeCount || 0))
      .catch(console.error);

    fetch(`${apiUrl}/api/pools/waiting`)
      .then(res => res.json())
      .then(data => setWaitingQueue(data.waiting || []))
      .catch(console.error);
  }, []);

  return (
    <div className="home-view">
      <section className="welcome">
        <div>
          <p className="eyebrow">TODAY</p>
          <h2>
            Where are you headed,
            <br />
            <em>{firstName}?</em>
          </h2>
        </div>
        <div className="weather-card">
          <span>{weather ? `${weather.temp}°` : '...'}</span>
          <small>
            Gwalior
            <br />
            {weather ? weather.desc : 'Loading...'}
          </small>
        </div>
      </section>
      <section className="hero-ride">
        <div className="hero-icon">
          <Navigation size={22} />
        </div>
        <div>
          <p className="eyebrow light">READY WHEN YOU ARE</p>
          <h3>Pool your next ride</h3>
          <p>Split the fare with friends and reach together.</p>
        </div>
        <button className="circle-action" onClick={() => onRequest()}>
          <ChevronRight size={20} />
        </button>
      </section>
      <div className="section-heading">
        <h3>Quick start</h3>
        <span>Save up to ₹120 / ride</span>
      </div>
      <div className="quick-actions">
        <button onClick={() => onRequest()}>
          <span className="quick-icon gold">
            <LocateFixed size={19} />
          </span>
          <strong>Request a ride</strong>
          <small>Find a pool</small>
        </button>
        <button onClick={onTracking}>
          <span className="quick-icon green">
            <Navigation size={19} />
          </span>
          <strong>My active ride</strong>
          <small>Track your pool</small>
        </button>
      </div>
      <section className="explore-section">
        <div className="section-heading">
          <h3>Popular around campus</h3>
          <span>Search destinations</span>
        </div>
        <div className="hub-grid">
          <button onClick={() => onRequest("Gwalior Railway Station")}>
            <MapPin size={16} />
            <span>Gwalior Railway Station</span>
            <small>Weekend trains</small>
          </button>
          <button onClick={() => onRequest("DD Mall")}>
            <MapPin size={16} />
            <span>DD Mall · City Center</span>
            <small>Food & shopping</small>
          </button>
          <button onClick={() => onRequest("Maharaj Bada")}>
            <MapPin size={16} />
            <span>Maharaj Bada</span>
            <small>Old city</small>
          </button>
          <button onClick={() => onRequest("Airport")}>
            <MapPin size={16} />
            <span>Airport</span>
            <small>12.8 km away</small>
          </button>
          <button onClick={() => onRequest("MITS / JIET")}>
            <MapPin size={16} />
            <span>MITS / JIET</span>
            <small>Campus routes</small>
          </button>
        </div>
        <div className="trend-strip">
          <span className="live-dot">
            <span /> LIVE
          </span>
          <strong>{activePoolsCount} active {activePoolsCount === 1 ? 'pool' : 'pools'} right now</strong>
        </div>
      </section>
      <section className="explore-section">
        <div className="section-heading">
          <h3>Waiting for a ride</h3>
          <span>Live demand</span>
        </div>
        {waitingQueue.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
            {waitingQueue.map((w, i) => (
              <div key={i} style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="avatar" style={{ width: '36px', height: '36px', fontSize: '13px' }}>
                  {w.name.substring(0, 2).toUpperCase()}
                </span>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '14px', display: 'block', color: '#0F172A', marginBottom: '2px' }}>{w.name}</strong>
                  <small style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} /> Going to {w.destination}
                  </small>
                </div>
                <div className="matched-chip" style={{ background: '#FFF', border: '1px solid #E2E8F0', color: '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                   {w.vehicle === 'CAB_4' ? 'Cab' : 'Auto'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1', textAlign: 'center', marginTop: '16px', color: '#64748B', fontSize: '14px' }}>
            No one is currently waiting for a ride.<br />Request a ride to start a new pool!
          </div>
        )}
      </section>
      <div className="section-heading">
        <h3>How it works</h3>
        <span>3 simple steps</span>
      </div>
      <div className="steps">
        <Step
          number="01"
          icon={<MapPin size={17} />}
          title="Choose your stops"
          text="Pick up from campus, select your destination."
        />
        <Step
          number="02"
          icon={<Users size={17} />}
          title="Find your crew"
          text="We match you with students going your way."
        />
        <Step
          number="03"
          icon={<WalletCards size={17} />}
          title="Split & go"
          text="Pay your share and ride safely together."
        />
      </div>
      <section className="trust-card">
        <ShieldCheck size={25} />
        <div>
          <strong>Only verified IIITM students</strong>
          <p>Every rider is part of our campus network.</p>
        </div>
        <ChevronRight size={18} />
      </section>
    </div>
  );
}

function Step({
  number,
  icon,
  title,
  text,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="step">
      <span className="step-number">{number}</span>
      <span className="step-icon">{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function RequestView({
  pickup,
  setPickup,
  dropoff,
  setDropoff,
  vehicle,
  setVehicle,
  when,
  setWhen,
  prebookTime,
  setPrebookTime,
  query,
  setQuery,
  destinations: filtered,
  mapPin,
  setMapPin,
  onBack,
  onRequest,
  fare,
}: {
  pickup: Location;
  setPickup: (value: Location) => void;
  dropoff: Location;
  setDropoff: (value: Location) => void;
  vehicle: Vehicle;
  setVehicle: (value: Vehicle) => void;
  when: "now" | "later";
  setWhen: (value: "now" | "later") => void;
  prebookTime: string;
  setPrebookTime: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  destinations: Location[];
  mapPin: { x: number; y: number };
  setMapPin: (value: { x: number; y: number }) => void;
  onBack: () => void;
  onRequest: () => void;
  fare: number;
}) {
  const [liveQuery, setLiveQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [liveResults, setLiveResults] = useState(filtered);

  const [livePickupQuery, setLivePickupQuery] = useState("");
  const [isEditingPickup, setIsEditingPickup] = useState(false);
  const [livePickupResults, setLivePickupResults] = useState(pickupPresets);

  useEffect(() => {
    if (!livePickupQuery) {
      setLivePickupResults(pickupPresets);
      return;
    }
    const t = setTimeout(() => {
      searchPlaces(livePickupQuery).then((res) => setLivePickupResults(res));
    }, 300);
    return () => clearTimeout(t);
  }, [livePickupQuery]);
  useEffect(() => {
    if (!liveQuery) {
      setLiveResults(filtered);
      return;
    }
    const t = setTimeout(() => {
      searchPlaces(liveQuery).then((res) => setLiveResults(res));
    }, 300);
    return () => clearTimeout(t);
  }, [liveQuery, filtered]);

  return (
    <div className="request-view">
      <button className="back-button" onClick={onBack}>
        ← <span>Request a ride</span>
      </button>
      <div className="request-head">
        <div>
          <p className="eyebrow">STEP 1 OF 2</p>
          <h2>Plan your ride</h2>
        </div>
        <span className="fare-estimate">From ₹{fare}</span>
      </div>
      <div className="segmented">
        <button
          className={when === "later" ? "active" : ""}
          onClick={() => setWhen("later")}
        >
          <Clock3 size={16} /> Pre-book for later <span>Recommended</span>
        </button>
        <button
          className={when === "now" ? "active" : ""}
          onClick={() => setWhen("now")}
        >
          <Navigation size={16} /> Immediate ride
        </button>
      </div>
      {when === "later" && (
        <div
          className="prebook-time"
          style={{
            padding: "16px 20px",
            background: "#F8FAFC",
            borderRadius: "12px",
            margin: "0 20px 20px",
            border: "1px solid #E2E8F0",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <label
            style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}
          >
            Select departure time
          </label>
          <input
            type="datetime-local"
            value={prebookTime}
            onChange={(event) => setPrebookTime(event.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "15px",
            }}
          />
        </div>
      )}
      <section className="location-card">
        <div className="location-row">
          <span className="location-dot pickup-dot" />
          <div className="destination-field">
            <small>Pickup from</small>
            <input
              value={isEditingPickup ? livePickupQuery : pickup.name}
              onChange={(event) => setLivePickupQuery(event.target.value)}
              onFocus={() => {
                setIsEditingPickup(true);
                setLivePickupQuery("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && livePickupResults.length > 0) {
                  setPickup(livePickupResults[0]);
                  setLivePickupQuery("");
                  setIsEditingPickup(false);
                }
              }}
              onBlur={() =>
                setTimeout(() => {
                  if (
                    isEditingPickup &&
                    livePickupQuery &&
                    livePickupResults.length > 0
                  ) {
                    setPickup(livePickupResults[0]);
                  }
                  setIsEditingPickup(false);
                }, 200)
              }
            />
            <Compass size={18} />
          </div>
        </div>
        <div className="connector" />
        <div className="location-row">
          <span className="location-dot drop-dot" />
          <div className="destination-field">
            <small>Going to</small>
            <input
              value={isEditing ? liveQuery : dropoff.name}
              onChange={(event) => setLiveQuery(event.target.value)}
              onFocus={() => {
                setIsEditing(true);
                setLiveQuery("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && liveResults.length > 0) {
                  setDropoff(liveResults[0]);
                  setLiveQuery("");
                  setIsEditing(false);
                }
              }}
              onBlur={() =>
                setTimeout(() => {
                  if (isEditing && liveQuery && liveResults.length > 0) {
                    setDropoff(liveResults[0]);
                  }
                  setIsEditing(false);
                }, 200)
              }
            />
            <Compass size={18} />
          </div>
        </div>
      </section>
      <div className="preset-scroll">
        {pickupPresets.map((item) => (
          <button
            key={item.name}
            className={pickup.name === item.name ? "preset active" : "preset"}
            onClick={() => setPickup(item)}
          >
            {item.name}
          </button>
        ))}
      </div>
      {isEditingPickup && livePickupQuery && (
        <div className="destination-results">
          {livePickupResults.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setPickup(item);
                setLivePickupQuery("");
                setIsEditingPickup(false);
              }}
            >
              <MapPin size={16} />
              <span>{item.name}</span>
              <small>
                {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
              </small>
            </button>
          ))}
        </div>
      )}
      {isEditing && liveQuery && (
        <div className="destination-results">
          {liveResults.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setDropoff(item);
                setLiveQuery("");
                setIsEditing(false);
              }}
            >
              <MapPin size={16} />
              <span>{item.name}</span>
              <small>
                {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
              </small>
            </button>
          ))}
        </div>
      )}
      <div className="map-picker">
        <div className="map-label">
          <span>
            <Crosshair size={15} /> Tap map to pin destination
          </span>
          <small>
            {dropoff.lat.toFixed(4)}, {dropoff.lng.toFixed(4)}
          </small>
        </div>
        <div
          style={{
            width: "100%",
            height: "220px",
            margin: "16px 0",
            padding: "0 20px",
          }}
        >
          <InteractiveMap
            pickup={pickup}
            dropoff={dropoff}
            onMapClick={async (lat, lng) => {
              const name = await reverseGeocode(lat, lng);
              setDropoff({ name: name || "Custom destination", lat, lng });
            }}
          />
        </div>
      </div>
      <div className="vehicle-title">
        <h3>Choose your vehicle</h3>
        <span>Capacity & fare</span>
      </div>
      <div className="vehicle-options">
        <button
          className={vehicle === "AUTO_3" ? "vehicle active" : "vehicle"}
          onClick={() => setVehicle("AUTO_3")}
        >
          <span className="vehicle-emoji">⌁</span>
          <div>
            <strong>Auto</strong>
            <small>Up to 3 riders</small>
          </div>
          <b>₹{fare}</b>
          {vehicle === "AUTO_3" && <Check size={17} />}
        </button>
        <button
          className={vehicle === "CAB_4" ? "vehicle active" : "vehicle"}
          onClick={() => setVehicle("CAB_4")}
        >
          <CarFront size={23} />
          <div>
            <strong>Cab</strong>
            <small>Up to 4 riders</small>
          </div>
          <b>₹92</b>
          {vehicle === "CAB_4" && <Check size={17} />}
        </button>
      </div>
      <button
        className="primary-button wide request-button"
        onClick={onRequest}
      >
        Find my pool <ChevronRight size={18} />
      </button>
    </div>
  );
}

function MatchingView({
  pickup,
  dropoff,
}: {
  pickup: Location;
  dropoff: Location;
}) {
  return (
    <div className="matching-view">
      <div className="matching-map">
        <div className="pulse pulse-one" />
        <div className="pulse pulse-two" />
        <span className="map-pin match-pickup">
          <MapPin size={27} fill="#1E4E8C" />
        </span>
        <span className="map-pin match-drop">
          <MapPin size={29} fill="#D99B26" />
        </span>
        <div className="route-line" />
      </div>
      <div className="matching-copy">
        <span className="loading-ring">
          <Users size={23} />
        </span>
        <p className="eyebrow">LOOKING AROUND CAMPUS</p>
        <h2>
          Finding your
          <br />
          <em>ride crew...</em>
        </h2>
        <p>
          Matching students near {pickup.name} going towards {dropoff.name}.
        </p>
        <div className="match-progress">
          <span />
        </div>
        <small>Usually takes less than a minute</small>
      </div>
    </div>
  );
}

function PoolView({
  pickup,
  dropoff,
  vehicle,
  fare,
  distance,
  time,
  paid,
  setPaid,
  chatOpen,
  setChatOpen,
  messages,
  message,
  setMessage,
  sendMessage,
  onTrack,
}: {
  pickup: Location;
  dropoff: Location;
  vehicle: Vehicle;
  fare: number;
  distance: string;
  time: number;
  paid: boolean;
  setPaid: (value: boolean) => void;
  chatOpen: boolean;
  setChatOpen: (value: boolean) => void;
  messages: { name: string; text: string; time: string }[];
  message: string;
  setMessage: (value: string) => void;
  sendMessage: () => void;
  onTrack: () => void;
}) {
  const [activePool, setActivePool] = useState<any>(null);
  const [realMembers, setRealMembers] = useState<any[]>([]);
  const [splitModalOpen, setSplitModalOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token") || `demo-user`;
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    
    const fetchPool = () => {
      fetch(`${apiUrl}/api/pools/active/${token}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.pool) setActivePool(data.pool);
          if (data.members) setRealMembers(data.members);
        })
        .catch(console.error);
    };

    fetchPool();
    const interval = setInterval(fetchPool, 3000);
    return () => clearInterval(interval);
  }, []);

  const poolIdPrefix = activePool?.id
    ? activePool.id.replace(/-/g, "").substring(0, 4).toUpperCase()
    : "4821";
  const displayMembers = realMembers.map((m) => ({
    name: m.user?.name || "Rider",
    initials: (m.user?.name || "Rider").substring(0, 2).toUpperCase(),
    color: m.userId === localStorage.getItem("token") ? "navy" : "green",
    paid: m.paymentStatus === "PAID",
    stop: m.stopSequence,
    userId: m.userId,
    individualFare: m.individualFare,
    distanceKm: m.distanceKm || 0
  }));

  const myMember = realMembers.find(m => m.userId === (localStorage.getItem("token") || `demo-user`));
  const estimatedShare = myMember?.individualFare > 0 ? myMember.individualFare : fare;

  return (
    <div className="pool-view">
      <div className="pool-top">
        <div>
          <p className="eyebrow">POOL FOUND · #CP{poolIdPrefix}</p>
          <h2>Your ride crew is ready</h2>
        </div>
        <div className="matched-chip">
          <span />
          <strong>
            {displayMembers.length}/{vehicle === "CAB_4" ? 4 : 3}
          </strong>
          <small>Matched</small>
        </div>
      </div>
      <div className="route-card">
        <div className="route-summary">
          <div>
            <span className="route-point navy" />
            <strong>{pickup.name}</strong>
          </div>
          <span className="route-time">ETA: 2m</span>
          <div className="route-rule" />
          <div>
            <span className="route-point gold" />
            <strong>{dropoff.name}</strong>
          </div>
          <span className="route-time">{time}m trip</span>
        </div>
        <div
          style={{
            width: "100%",
            height: "140px",
            marginTop: "16px",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <InteractiveMap
            pickup={pickup}
            dropoff={dropoff}
            onMapClick={() => {}}
          />
        </div>
      </div>
      <div className="pool-info-row">
        <span>
          <Users size={17} /> {vehicle === "AUTO_3" ? "Auto" : "Cab"} ·{" "}
          {vehicle === "CAB_4" ? 4 : 3} seats
        </span>
        <span>
          <Clock3 size={17} /> {time} min
        </span>
        <span>
          <Navigation size={17} />{" "}
          {distance} km
        </span>
      </div>
      <section className="member-card">
        <div className="card-title">
          <h3>Your crew</h3>
          <button onClick={() => setChatOpen(true)}>
            <MessageCircle size={16} /> Chat
          </button>
        </div>
        {displayMembers.map((member) => (
          <div className="member-row" key={member.name}>
            <span className={`member-avatar ${member.color}`}>
              {member.initials}
            </span>
            <div>
              <strong>
                {member.name}{" "}
                {member.userId === localStorage.getItem("token") && "(You)"}
              </strong>
              <small>
                Stop {member.stop} ·{" "}
                {member.stop === 1
                  ? pickup.name
                  : member.stop === 3
                    ? "GH"
                    : "Main Gate"}
              </small>
            </div>
            <span
              className={member.paid || paid ? "paid-status" : "pending-status"}
            >
              {member.paid || paid ? (
                <>
                  <Check size={13} /> Paid
                </>
              ) : (
                "Pending"
              )}
            </span>
          </div>
        ))}
      </section>
      <section className="payment-card">
        <div className="payment-top">
          <div>
            <p className="eyebrow">YOUR ESTIMATED SHARE</p>
            <h2>₹{paid ? estimatedShare : estimatedShare}</h2>
          </div>
          <button className="split-badge" onClick={() => setSplitModalOpen(true)} style={{ border: 'none', background: '#F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', color: '#4B5563' }}>
            <WalletCards size={15} /> Distance split
          </button>
        </div>
        <div className="payment-bar">
          <span style={{ width: paid ? "100%" : "66%" }} />
        </div>
        <div className="payment-foot">
          <span>{paid ? "All members paid" : "Waiting for others to pay"}</span>
          <span>Fare may vary ±₹8</span>
        </div>
        {!paid ? (
          <button className="primary-button wide" onClick={() => setPaid(true)}>
            <CreditCard size={17} /> Pay with Razorpay · ₹{estimatedShare}
          </button>
        ) : (
          <button className="success-button wide" onClick={onTrack}>
            <Check size={17} /> All paid · View live ride
          </button>
        )}
      </section>
      {chatOpen && (
        <ChatDrawer
          messages={messages}
          message={message}
          setMessage={setMessage}
          sendMessage={sendMessage}
          onClose={() => setChatOpen(false)}
        />
      )}
      {splitModalOpen && (
        <DistanceSplitModal
          members={displayMembers}
          totalFare={activePool?.totalEstimatedFare || (vehicle === "AUTO_3" ? 60 : 92)}
          onClose={() => setSplitModalOpen(false)}
        />
      )}
    </div>
  );
}

function ChatDrawer({
  messages,
  message,
  setMessage,
  sendMessage,
  onClose,
}: {
  messages: { name: string; text: string; time: string }[];
  message: string;
  setMessage: (value: string) => void;
  sendMessage: () => void;
  onClose: () => void;
}) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="chat-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <p className="eyebrow">POOL CHAT</p>
            <h3>Ride crew</h3>
          </div>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="chat-messages">
          {messages.map((item, index) => (
            <div
              className={item.name === "You" ? "chat-item own" : "chat-item"}
              key={`${item.text}-${index}`}
            >
              <strong>{item.name}</strong>
              <p>{item.text}</p>
              <small>{item.time}</small>
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && sendMessage()}
            placeholder="Message your crew"
          />
          <button onClick={sendMessage}>
            <ChevronRight size={18} />
          </button>
        </div>
      </aside>
    </div>
  );
}

function TrackingView({
  pickup,
  dropoff,
  distance,
  time,
  sosSent,
  onSos,
  onBack,
  onShare,
}: {
  pickup: Location;
  dropoff: Location;
  distance: string;
  time: number;
  sosSent: boolean;
  onSos: () => void;
  onBack: () => void;
  onShare: () => void;
}) {
  const [driverInfo, setDriverInfo] = useState<any>(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    fetch(`${apiUrl}/api/uber/mock-dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
      }),
    })
      .then((res) => res.json())
      .then((data) => setDriverInfo(data))
      .catch(console.error);
  }, [pickup, dropoff]);

  const eta = driverInfo?.etaMinutes || time;
  const driverName = driverInfo?.driver?.name || "Assigning...";
  const driverVehicle = driverInfo?.driver?.vehicle || "Finding nearby cab";
  const driverPlate = driverInfo?.driver?.plate || "...";
  const driverRating = driverInfo?.driver?.rating || 5.0;
  const displayDistance = driverInfo?.distanceKm || distance;
  const initials = driverName
    .split(" ")
    .map((n: string) => n[0])
    .join("");

  return (
    <div className="tracking-view">
      <button className="back-button" onClick={onBack}>
        ← <span>Pool room</span>
      </button>
      <div className="tracking-head">
        <div>
          <p className="eyebrow success-label">LIVE RIDE · ON THE WAY</p>
          <h2>Heading to {dropoff.name.split(" ")[0]}</h2>
          <p>Your driver is {eta} minutes away.</p>
        </div>
        <span className="live-dot">
          <span /> LIVE
        </span>
      </div>
      <div
        className="tracking-map-real"
        style={{
          width: "100%",
          height: "260px",
          padding: "0 20px",
          marginBottom: "16px",
          position: "relative",
        }}
      >
        <InteractiveMap
          pickup={pickup}
          dropoff={dropoff}
          onMapClick={() => {}}
        />
        <div
          className="eta-card-overlay"
          style={{
            position: "absolute",
            top: "16px",
            right: "36px",
            background: "white",
            padding: "10px 14px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <small
            style={{ fontSize: "10px", color: "#64748B", fontWeight: 700 }}
          >
            ARRIVING IN
          </small>
          <strong style={{ fontSize: "24px", lineHeight: 1 }}>
            {eta}{" "}
            <em
              style={{
                fontSize: "14px",
                fontStyle: "normal",
                color: "#64748B",
              }}
            >
              min
            </em>
          </strong>
          <span style={{ fontSize: "12px", color: "#94A3B8" }}>
            {displayDistance} km away
          </span>
        </div>
      </div>
      <section className="driver-card">
        <span className="driver-avatar">{initials}</span>
        <div className="driver-info">
          <strong>{driverName}</strong>
          <span>
            <Star size={14} fill="#D99B26" /> {driverRating} · {driverVehicle}
          </span>
          <small>{driverPlate}</small>
        </div>
        <a
          href="tel:+919876543210"
          className="call-button"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Phone size={18} />
        </a>
      </section>
      <div className="trip-progress">
        <div className="progress-label">
          <span>{pickup.name}</span>
          <span>{dropoff.name}</span>
        </div>
        <div className="progress-track">
          <span />
        </div>
        <div className="progress-stops">
          <span>On the way</span>
          <span>{eta + Math.round(parseFloat(displayDistance as string) * 3)} min left</span>
        </div>
      </div>
      <div className="tracking-actions">
        <button
          className="share-button"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href).catch(() => {});
            onShare();
          }}
        >
          <Compass size={18} /> Share trip status
        </button>
        <button
          className={sosSent ? "sos-button sent" : "sos-button"}
          onClick={onSos}
        >
          {sosSent ? (
            <>
              <Check size={18} /> Alert sent
            </>
          ) : (
            <>
              <ShieldCheck size={18} /> SOS
            </>
          )}
        </button>
      </div>
      {sosSent && (
        <div className="sos-confirm">
          <Check size={17} />
          <span>Emergency contacts notified with your live location.</span>
        </div>
      )}
    </div>
  );
}

function SupportView() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [submitted, setSubmitted] = useState(false);
  const faqs = [
    {
      question: "Why do I need an @iiitm.ac.in email?",
      answer:
        "CampusPool uses your institute email to keep rides inside the verified IIITM student network.",
    },
    {
      question: "How do mock payment refunds work?",
      answer:
        "The demo payment flow never charges a real account. In production, refunds would be issued from the payment provider after a server-side review.",
    },
    {
      question: "How many seats can I book?",
      answer:
        "Autos support up to 3 riders and cabs support up to 4 riders, including you.",
    },
  ];
  return (
    <div className="support-view">
      <div className="support-heading">
        <div>
          <p className="eyebrow">CAMPUSPOOL SUPPORT</p>
          <h2>We’re here to help.</h2>
          <p>Quick answers and direct campus contacts for every ride.</p>
        </div>
        <div className="support-mark">
          <HelpCircle size={25} />
        </div>
      </div>
      <section className="support-card sos-guide">
        <div className="support-card-title">
          <span className="support-icon red">
            <AlertTriangle size={18} />
          </span>
          <div>
            <h3>Emergency SOS guide</h3>
            <p>What happens when you need help on a ride.</p>
          </div>
        </div>
        <div className="sos-steps">
          <div>
            <b>1</b>
            <span>Tap SOS from your live ride screen.</span>
          </div>
          <div>
            <b>2</b>
            <span>Your location and pool details are shared.</span>
          </div>
          <div>
            <b>3</b>
            <span>Emergency contacts receive an SMS and call alert.</span>
          </div>
        </div>
      </section>
      <section className="support-card contact-card">
        <div className="support-card-title">
          <span className="support-icon blue">
            <PhoneCall size={18} />
          </span>
          <div>
            <h3>Campus contacts</h3>
            <p>Available when the app cannot wait.</p>
          </div>
        </div>
        <div className="contact-grid">
          <a href="tel:+917512440100">
            <span>Campus security</span>
            <strong>+91 751 244 0100</strong>
            <small>24 × 7 hotline</small>
          </a>
          <a href="tel:+917512440120">
            <span>Proctor office</span>
            <strong>+91 751 244 0120</strong>
            <small>Student support desk</small>
          </a>
        </div>
      </section>
      <section className="support-card ticket-card">
        <div className="support-card-title">
          <span className="support-icon gold">
            <Send size={18} />
          </span>
          <div>
            <h3>Submit a ride ticket</h3>
            <p>Report a dispute, fare issue, or lost item.</p>
          </div>
        </div>
        {submitted ? (
          <div className="ticket-success">
            <Check size={18} />
            <span>
              Your ticket is in. We’ll follow up through your IIITM email.
            </span>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
            }}
          >
            <select defaultValue="">
              <option value="" disabled>
                Choose an issue
              </option>
              <option>Ride dispute</option>
              <option>Fare calculation</option>
              <option>Lost item</option>
            </select>
            <textarea required placeholder="Tell us what happened" rows={3} />
            <button className="primary-button" type="submit">
              <Send size={16} /> Submit ticket
            </button>
          </form>
        )}
      </section>
      <section className="faq-section">
        <div className="section-heading">
          <h3>Frequently asked</h3>
          <span>{faqs.length} answers</span>
        </div>
        {faqs.map((faq, index) => (
          <div
            className={`faq-item ${openFaq === index ? "open" : ""}`}
            key={faq.question}
          >
            <button
              onClick={() => setOpenFaq(openFaq === index ? null : index)}
            >
              <span>{faq.question}</span>
              <ChevronDown size={17} />
            </button>
            {openFaq === index && <p>{faq.answer}</p>}
          </div>
        ))}
      </section>
    </div>
  );
}

function BottomNav({
  stage,
  onHome,
  onRides,
  onSafety,
  onSupport,
}: {
  stage: Stage;
  onHome: () => void;
  onRides: () => void;
  onSafety: () => void;
  onSupport: () => void;
}) {
  return (
    <nav className="bottom-nav">
      <button
        className={stage === "home" || stage === "request" ? "active" : ""}
        onClick={onHome}
      >
        <Compass size={20} />
        <span>Explore</span>
      </button>
      <button
        className={stage === "pool" || stage === "matching" ? "active" : ""}
        onClick={onRides}
      >
        <CarFront size={20} />
        <span>My rides</span>
      </button>
      <button
        className={stage === "tracking" ? "active" : ""}
        onClick={onSafety}
      >
        <ShieldCheck size={20} />
        <span>Safety</span>
      </button>
      <button
        className={stage === "support" ? "active" : ""}
        onClick={onSupport}
      >
        <Headphones size={20} />
        <span>Support</span>
      </button>
    </nav>
  );
}

function DistanceSplitModal({
  members,
  totalFare,
  onClose,
}: {
  members: any[];
  totalFare: number;
  onClose: () => void;
}) {
  const totalDistance = members.reduce((sum, m) => sum + (m.distanceKm || 0), 0);
  
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="chat-drawer" onClick={(e) => e.stopPropagation()} style={{ height: 'auto', maxHeight: '80vh', padding: '24px' }}>
        <div className="drawer-head" style={{ borderBottom: 'none', padding: '0 0 16px 0' }}>
          <div>
            <p className="eyebrow">FARE CALCULATION</p>
            <h3>Distance Split Breakdown</h3>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        
        <div style={{ background: '#F9FAFB', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#6B7280', fontSize: '14px' }}>Total Pool Fare</span>
            <strong style={{ fontSize: '16px' }}>₹{totalFare}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#6B7280', fontSize: '14px' }}>Combined Distance</span>
            <strong style={{ fontSize: '16px' }}>{totalDistance.toFixed(2)} km</strong>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {members.map((m, i) => {
            const pct = totalDistance > 0 ? ((m.distanceKm || 0) / totalDistance) * 100 : (100 / members.length);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className={`member-avatar ${m.color}`} style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                    {m.initials}
                  </span>
                  <div>
                    <strong style={{ display: 'block', fontSize: '14px', marginBottom: '2px' }}>{m.name} {m.userId === (localStorage.getItem("token") || 'demo-user') ? '(You)' : ''}</strong>
                    <span style={{ color: '#6B7280', fontSize: '12px' }}>{m.distanceKm?.toFixed(2) || 0} km · {pct.toFixed(0)}%</span>
                  </div>
                </div>
                <strong style={{ fontSize: '15px' }}>₹{m.individualFare}</strong>
              </div>
            );
          })}
        </div>
        
        <div style={{ marginTop: '32px', padding: '16px', background: '#FEF3C7', color: '#92400E', borderRadius: '8px', fontSize: '13px', lineHeight: '1.5' }}>
          <strong style={{ display: 'block', marginBottom: '4px' }}>How is this calculated?</strong>
          The base pool fare is split proportionally based on the distance each rider travels. Riders traveling longer distances pay a proportionally higher share of the total fare.
        </div>
      </aside>
    </div>
  );
}

export default App;
