import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CarFront, Check, ChevronDown, ChevronRight, Clock3, Compass, CreditCard, Crosshair, Headphones, HelpCircle, LocateFixed, LockKeyhole, LogOut, MapPin, MessageCircle, Navigation, Phone, PhoneCall, Send, ShieldCheck, Sparkles, Star, Users, WalletCards, X } from 'lucide-react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type Stage = 'login' | 'home' | 'support' | 'request' | 'matching' | 'pool' | 'tracking'
type Vehicle = 'AUTO_3' | 'CAB_4'
type Location = { name: string; lat: number; lng: number }

const pickupPresets: Location[] = [
  { name: 'BH-1', lat: 26.2495, lng: 78.174 },
  { name: 'BH-2', lat: 26.2488, lng: 78.1732 },
  { name: 'BH-3', lat: 26.2501, lng: 78.1748 },
  { name: 'BH-4', lat: 26.251, lng: 78.1755 },
  { name: 'GH', lat: 26.2475, lng: 78.1718 },
  { name: 'Main Gate', lat: 26.246, lng: 78.1702 },
]
const destinations: Location[] = [
  { name: 'Gwalior Railway Station', lat: 26.2183, lng: 78.1828 },
  { name: 'City Center / DD Mall', lat: 26.2052, lng: 78.1944 },
  { name: 'Maharaj Bada', lat: 26.2005, lng: 78.1589 },
  { name: 'Rajmata Vijayaraje Scindia Airport', lat: 26.2941, lng: 78.2272 },
]
const members = [
  { name: 'Aarav Mehta', initials: 'AM', color: 'gold', paid: true, stop: 1 },
  { name: 'You', initials: 'Y', color: 'navy', paid: true, stop: 2 },
  { name: 'Priya Singh', initials: 'PS', color: 'green', paid: false, stop: 3 },
]

function getSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY
  return url && key ? createClient(url, key) : null
}

function App() {
  const [stage, setStage] = useState<Stage>(() => {
    const path = window.location.pathname
    if (path === '/support') return 'support'
    if (path === '/explore' || localStorage.getItem('campuspool-stage') === 'home') return 'home'
    return 'login'
  })
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loginSent, setLoginSent] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [pickup, setPickup] = useState<Location>(pickupPresets[0])
  const [dropoff, setDropoff] = useState<Location>(destinations[0])
  const [vehicle, setVehicle] = useState<Vehicle>('AUTO_3')
  const [when, setWhen] = useState<'now' | 'later'>('later')
  const [destinationQuery, setDestinationQuery] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [messages, setMessages] = useState([{ name: 'Aarav', text: 'Leaving BH-1 in 5 mins', time: '10:42' }, { name: 'Priya', text: 'I’ll be at GH on time.', time: '10:43' }])
  const [paid, setPaid] = useState(false)
  const [sosSent, setSosSent] = useState(false)
  const [mapPin, setMapPin] = useState({ x: 44, y: 61 })
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (stage === 'login') localStorage.removeItem('campuspool-stage')
    else localStorage.setItem('campuspool-stage', stage === 'home' || stage === 'support' ? 'home' : stage)
    const path = stage === 'home' ? '/explore' : `/${stage}`
    window.history.replaceState(null, '', path)
  }, [stage])

  const filteredDestinations = useMemo(() => destinations.filter((item) => item.name.toLowerCase().includes(destinationQuery.toLowerCase())), [destinationQuery])
  const fare = vehicle === 'AUTO_3' ? 68 : 92
  const distance = dropoff.name.includes('Airport') ? '12.8 km' : dropoff.name.includes('Station') ? '6.4 km' : '7.1 km'

  const signIn = () => {
    setLoginError('')
    if (!email.toLowerCase().endsWith('@iiitm.ac.in')) {
      setLoginError('Use your official @iiitm.ac.in email address.')
      return
    }
    if (!loginSent) { setLoginSent(true); return }
    if (otp !== '123456') { setLoginError('Enter the 6-digit code. Demo code: 123456'); return }
    localStorage.setItem('token', `demo-${Date.now()}`)
    setStage('home')
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('campuspool-stage')
    setPaid(false)
    setSosSent(false)
    setChatOpen(false)
    setMessages([])
    setToast('Logged out successfully')
    setStage('login')
    window.setTimeout(() => setToast(''), 2600)
  }

  const requestRide = async () => {
    const supabase = getSupabase()
    if (supabase) {
      await supabase.from('ride_requests').insert({ pickup_location_name: pickup.name, dropoff_location_name: dropoff.name, pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng, flex_time_start: new Date().toISOString(), flex_time_end: new Date(Date.now() + 15 * 60000).toISOString(), vehicle_type: vehicle, status: 'PENDING' })
    }
    setStage('matching')
    window.setTimeout(() => setStage('pool'), 1600)
  }

  const sendMessage = () => {
    if (!chatMessage.trim()) return
    setMessages([...messages, { name: 'You', text: chatMessage.trim(), time: 'now' }])
    setChatMessage('')
  }

  if (stage === 'login') return <LoginView email={email} setEmail={setEmail} otp={otp} setOtp={setOtp} loginSent={loginSent} error={loginError} toast={toast} onContinue={signIn} />
  return <div className="app-shell">
    <TopBar onHome={() => setStage('home')} onSupport={() => setStage('support')} onLogout={logout} />
    <main className="main-content">
      {stage === 'home' && <HomeView onRequest={() => setStage('request')} onTracking={() => setStage('tracking')} />}
      {stage === 'support' && <SupportView />}
      {stage === 'request' && <RequestView pickup={pickup} setPickup={setPickup} dropoff={dropoff} setDropoff={setDropoff} vehicle={vehicle} setVehicle={setVehicle} when={when} setWhen={setWhen} query={destinationQuery} setQuery={setDestinationQuery} destinations={filteredDestinations} mapPin={mapPin} setMapPin={setMapPin} onBack={() => setStage('home')} onRequest={requestRide} fare={fare} />}
      {stage === 'matching' && <MatchingView pickup={pickup} dropoff={dropoff} />}
      {stage === 'pool' && <PoolView pickup={pickup} dropoff={dropoff} vehicle={vehicle} fare={fare} paid={paid} setPaid={setPaid} chatOpen={chatOpen} setChatOpen={setChatOpen} messages={messages} message={chatMessage} setMessage={setChatMessage} sendMessage={sendMessage} onTrack={() => setStage('tracking')} />}
      {stage === 'tracking' && <TrackingView sosSent={sosSent} onSos={() => setSosSent(true)} onBack={() => setStage('pool')} />}
    </main>
    <BottomNav stage={stage} onHome={() => setStage('home')} onRides={() => setStage('pool')} onSafety={() => setStage('tracking')} onSupport={() => setStage('support')} />
    {toast && <div className="toast"><Check size={16} /> {toast}</div>}
  </div>
}

function LoginView({ email, setEmail, otp, setOtp, loginSent, error, toast, onContinue }: { email: string; setEmail: (value: string) => void; otp: string; setOtp: (value: string) => void; loginSent: boolean; error: string; toast: string; onContinue: () => void }) {
  return <div className="login-page"><div className="login-glow" /><div className="login-card">
    <div className="brand-mark iiitm-logo"><span>IIITM</span><CarFront size={22} strokeWidth={2.5} /></div><p className="eyebrow">ABV-IIITM GWALIOR</p><h1>CampusPool<span>.</span></h1><p className="login-copy">Shared rides. Lower fares.<br />Safer journeys with your campus crew.</p>
    <div className="student-badge"><ShieldCheck size={18} /><span>Verified student network</span><Check size={16} /></div>
    {!loginSent ? <label className="field-label">IIITM email<input autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="yourname@iiitm.ac.in" type="email" /></label> : <label className="field-label">6-digit verification code<input autoFocus value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" /></label>}
    {error && <p className="error-text">{error}</p>}<button className="primary-button wide" onClick={onContinue}>{loginSent ? 'Enter CampusPool' : 'Send verification code'}<ChevronRight size={18} /></button>
    <p className="secure-note"><LockKeyhole size={14} /> Your campus identity stays private</p>
  </div><p className="login-footer">Built for the IIITM community · v1.0</p>{toast && <div className="toast login-toast"><Check size={16} /> {toast}</div>}</div>
}

function TopBar({ onHome, onSupport, onLogout }: { onHome: () => void; onSupport: () => void; onLogout: () => void }) {
  const [profileOpen, setProfileOpen] = useState(false)
  return <header className="topbar"><div className="topbar-inner"><button className="top-brand" onClick={onHome}><span className="mini-mark iiitm-logo-mini"><span>IIITM</span></span><span>CampusPool</span></button><nav className="top-links"><button className="top-link active" onClick={onHome}>Explore</button><button className="top-link" onClick={onSupport}>Support</button></nav><div className="profile-wrap"><button className="profile-trigger" onClick={() => setProfileOpen(!profileOpen)}><span className="avatar">RK</span><span className="profile-name">Rishabh Kumar</span><ChevronDown size={15} /></button>{profileOpen && <div className="profile-menu"><div className="profile-menu-head"><span className="avatar large">RK</span><div><strong>Rishabh Kumar</strong><small>2023BTechCSE042</small></div></div><p className="profile-email">rishabh.kumar@iiitm.ac.in</p><button className="logout-button" onClick={onLogout}><LogOut size={16} /> Log out</button></div>}</div></div></header>
}

function HomeView({ onRequest, onTracking }: { onRequest: () => void; onTracking: () => void }) { return <div className="home-view"><section className="welcome"><div><p className="eyebrow">MONDAY, 24 AUGUST</p><h2>Where are you headed,<br /><em>Rishabh?</em></h2></div><div className="weather-card"><span>28°</span><small>Gwalior<br />Clear skies</small></div></section><section className="hero-ride"><div className="hero-icon"><Navigation size={22} /></div><div><p className="eyebrow light">READY WHEN YOU ARE</p><h3>Pool your next ride</h3><p>Split the fare with friends and reach together.</p></div><button className="circle-action" onClick={onRequest}><ChevronRight size={20} /></button></section><div className="section-heading"><h3>Quick start</h3><span>Save up to ₹120 / ride</span></div><div className="quick-actions"><button onClick={onRequest}><span className="quick-icon gold"><LocateFixed size={19} /></span><strong>Request a ride</strong><small>Find a pool</small></button><button onClick={onTracking}><span className="quick-icon green"><Navigation size={19} /></span><strong>My active ride</strong><small>Track your pool</small></button></div><section className="explore-section"><div className="section-heading"><h3>Popular around campus</h3><span>Search destinations</span></div><div className="hub-grid"><button><MapPin size={16} /><span>Gwalior Railway Station</span><small>Weekend trains</small></button><button><MapPin size={16} /><span>DD Mall · City Center</span><small>Food & shopping</small></button><button><MapPin size={16} /><span>Maharaj Bada</span><small>Old city</small></button><button><MapPin size={16} /><span>Airport</span><small>12.8 km away</small></button><button><MapPin size={16} /><span>MITS / JIET</span><small>Campus routes</small></button></div><div className="trend-strip"><span className="live-dot"><span /> LIVE</span><strong>6 active pools leaving in the next 2 hours</strong><ChevronRight size={16} /></div></section><div className="section-heading"><h3>How it works</h3><span>3 simple steps</span></div><div className="steps"><Step number="01" icon={<MapPin size={17} />} title="Choose your stops" text="Pick up from campus, select your destination." /><Step number="02" icon={<Users size={17} />} title="Find your crew" text="We match you with students going your way." /><Step number="03" icon={<WalletCards size={17} />} title="Split & go" text="Pay your share and ride safely together." /></div><section className="trust-card"><ShieldCheck size={25} /><div><strong>Only verified IIITM students</strong><p>Every rider is part of our campus network.</p></div><ChevronRight size={18} /></section></div> }

function Step({ number, icon, title, text }: { number: string; icon: React.ReactNode; title: string; text: string }) { return <div className="step"><span className="step-number">{number}</span><span className="step-icon">{icon}</span><div><strong>{title}</strong><p>{text}</p></div></div> }

function RequestView({ pickup, setPickup, dropoff, setDropoff, vehicle, setVehicle, when, setWhen, query, setQuery, destinations: filtered, mapPin, setMapPin, onBack, onRequest, fare }: { pickup: Location; setPickup: (value: Location) => void; dropoff: Location; setDropoff: (value: Location) => void; vehicle: Vehicle; setVehicle: (value: Vehicle) => void; when: 'now' | 'later'; setWhen: (value: 'now' | 'later') => void; query: string; setQuery: (value: string) => void; destinations: Location[]; mapPin: { x: number; y: number }; setMapPin: (value: { x: number; y: number }) => void; onBack: () => void; onRequest: () => void; fare: number }) { return <div className="request-view"><button className="back-button" onClick={onBack}>← <span>Request a ride</span></button><div className="request-head"><div><p className="eyebrow">STEP 1 OF 2</p><h2>Plan your ride</h2></div><span className="fare-estimate">From ₹{fare}</span></div><div className="segmented"><button className={when === 'later' ? 'active' : ''} onClick={() => setWhen('later')}><Clock3 size={16} /> Pre-book for later <span>Recommended</span></button><button className={when === 'now' ? 'active' : ''} onClick={() => setWhen('now')}><Navigation size={16} /> Immediate ride</button></div><section className="location-card"><div className="location-row"><span className="location-dot pickup-dot" /><div><small>Pickup from campus</small><strong>{pickup.name}</strong></div></div><div className="connector" /><div className="location-row"><span className="location-dot drop-dot" /><div className="destination-field"><small>Going to</small><input value={query || dropoff.name} onChange={(event) => setQuery(event.target.value)} onFocus={() => setQuery('')} /><Compass size={18} /></div></div></section><div className="preset-scroll">{pickupPresets.map((item) => <button key={item.name} className={pickup.name === item.name ? 'preset active' : 'preset'} onClick={() => setPickup(item)}>{item.name}</button>)}</div>{query && <div className="destination-results">{filtered.map((item) => <button key={item.name} onClick={() => { setDropoff(item); setQuery('') }}><MapPin size={16} /><span>{item.name}</span><small>{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</small></button>)}</div>}<div className="map-picker"><div className="map-label"><span><Crosshair size={15} /> Tap map to pin destination</span><small>{dropoff.lat.toFixed(4)}, {dropoff.lng.toFixed(4)}</small></div><div className="map-art" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const x = ((event.clientX - rect.left) / rect.width) * 100; const y = ((event.clientY - rect.top) / rect.height) * 100; setMapPin({ x, y }); setDropoff({ name: 'Custom destination', lat: +(26.19 + (100 - y) * 0.0012).toFixed(4), lng: +(78.15 + x * 0.0008).toFixed(4) }) }}><div className="map-road road-a" /><div className="map-road road-b" /><div className="map-road road-c" /><span className="map-campus">IIITM</span><span className="map-pin pickup-map" style={{ left: '27%', top: '70%' }}><MapPin size={25} fill="#1E4E8C" /></span><span className="map-pin drop-map" style={{ left: `${mapPin.x}%`, top: `${mapPin.y}%` }}><MapPin size={29} fill="#D99B26" /></span><span className="map-place station">Railway Station</span><span className="map-place mall">DD Mall</span></div></div><div className="vehicle-title"><h3>Choose your vehicle</h3><span>Capacity & fare</span></div><div className="vehicle-options"><button className={vehicle === 'AUTO_3' ? 'vehicle active' : 'vehicle'} onClick={() => setVehicle('AUTO_3')}><span className="vehicle-emoji">⌁</span><div><strong>Auto</strong><small>Up to 3 riders</small></div><b>₹{fare}</b>{vehicle === 'AUTO_3' && <Check size={17} />}</button><button className={vehicle === 'CAB_4' ? 'vehicle active' : 'vehicle'} onClick={() => setVehicle('CAB_4')}><CarFront size={23} /><div><strong>Cab</strong><small>Up to 4 riders</small></div><b>₹92</b>{vehicle === 'CAB_4' && <Check size={17} />}</button></div><button className="primary-button wide request-button" onClick={onRequest}>Find my pool <ChevronRight size={18} /></button></div> }

function MatchingView({ pickup, dropoff }: { pickup: Location; dropoff: Location }) { return <div className="matching-view"><div className="matching-map"><div className="pulse pulse-one" /><div className="pulse pulse-two" /><span className="map-pin match-pickup"><MapPin size={27} fill="#1E4E8C" /></span><span className="map-pin match-drop"><MapPin size={29} fill="#D99B26" /></span><div className="route-line" /></div><div className="matching-copy"><span className="loading-ring"><Users size={23} /></span><p className="eyebrow">LOOKING AROUND CAMPUS</p><h2>Finding your<br /><em>ride crew...</em></h2><p>Matching students near {pickup.name} going towards {dropoff.name}.</p><div className="match-progress"><span /></div><small>Usually takes less than a minute</small></div></div> }

function PoolView({ pickup, dropoff, vehicle, fare, paid, setPaid, chatOpen, setChatOpen, messages, message, setMessage, sendMessage, onTrack }: { pickup: Location; dropoff: Location; vehicle: Vehicle; fare: number; paid: boolean; setPaid: (value: boolean) => void; chatOpen: boolean; setChatOpen: (value: boolean) => void; messages: { name: string; text: string; time: string }[]; message: string; setMessage: (value: string) => void; sendMessage: () => void; onTrack: () => void }) { return <div className="pool-view"><div className="pool-top"><div><p className="eyebrow">POOL FOUND · #CP4821</p><h2>Your ride crew is ready</h2></div><div className="matched-chip"><span /><strong>3/3</strong><small>Matched</small></div></div><div className="route-card"><div className="route-summary"><div><span className="route-point navy" /><strong>{pickup.name}</strong></div><span className="route-time">10:55 AM</span><div className="route-rule" /><div><span className="route-point gold" /><strong>{dropoff.name}</strong></div><span className="route-time">11:20 AM</span></div><div className="pool-map-mini"><div className="mini-line" /><span className="mini-pin one">1</span><span className="mini-pin two">2</span><span className="mini-pin three">3</span><span className="mini-pin end"><MapPin size={19} fill="#D99B26" /></span></div></div><div className="pool-info-row"><span><Users size={17} /> {vehicle === 'AUTO_3' ? 'Auto' : 'Cab'} · 3 seats</span><span><Clock3 size={17} /> 25 min</span><span><Navigation size={17} /> 6.4 km</span></div><section className="member-card"><div className="card-title"><h3>Your crew</h3><button onClick={() => setChatOpen(true)}><MessageCircle size={16} /> Chat</button></div>{members.map((member) => <div className="member-row" key={member.name}><span className={`member-avatar ${member.color}`}>{member.initials}</span><div><strong>{member.name}</strong><small>Stop {member.stop} · {member.stop === 1 ? pickup.name : member.stop === 3 ? 'GH' : 'Main Gate'}</small></div><span className={member.paid || paid ? 'paid-status' : 'pending-status'}>{member.paid || paid ? <><Check size={13} /> Paid</> : 'Pending'}</span></div>)}</section><section className="payment-card"><div className="payment-top"><div><p className="eyebrow">YOUR ESTIMATED SHARE</p><h2>₹{paid ? 68 : fare}</h2></div><span className="split-badge"><WalletCards size={15} /> Distance split</span></div><div className="payment-bar"><span style={{ width: paid ? '100%' : '66%' }} /></div><div className="payment-foot"><span>{paid ? '3/3 members paid' : '2/3 members paid'}</span><span>Fare may vary ±₹8</span></div>{!paid ? <button className="primary-button wide" onClick={() => setPaid(true)}><CreditCard size={17} /> Pay with Razorpay · ₹{fare}</button> : <button className="success-button wide" onClick={onTrack}><Check size={17} /> All paid · View live ride</button>}</section>{chatOpen && <ChatDrawer messages={messages} message={message} setMessage={setMessage} sendMessage={sendMessage} onClose={() => setChatOpen(false)} />}</div> }

function ChatDrawer({ messages, message, setMessage, sendMessage, onClose }: { messages: { name: string; text: string; time: string }[]; message: string; setMessage: (value: string) => void; sendMessage: () => void; onClose: () => void }) { return <div className="drawer-backdrop" onClick={onClose}><aside className="chat-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">POOL CHAT</p><h3>Ride crew</h3></div><button onClick={onClose}><X size={20} /></button></div><div className="chat-messages">{messages.map((item, index) => <div className={item.name === 'You' ? 'chat-item own' : 'chat-item'} key={`${item.text}-${index}`}><strong>{item.name}</strong><p>{item.text}</p><small>{item.time}</small></div>)}</div><div className="chat-input"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} placeholder="Message your crew" /><button onClick={sendMessage}><ChevronRight size={18} /></button></div></aside></div> }

function TrackingView({ sosSent, onSos, onBack }: { sosSent: boolean; onSos: () => void; onBack: () => void }) { return <div className="tracking-view"><button className="back-button" onClick={onBack}>← <span>Pool room</span></button><div className="tracking-head"><div><p className="eyebrow success-label">LIVE RIDE · ON THE WAY</p><h2>Heading to the station</h2><p>Your driver is 3 minutes away.</p></div><span className="live-dot"><span /> LIVE</span></div><div className="tracking-map"><div className="track-road track-one" /><div className="track-road track-two" /><div className="track-route" /><span className="track-campus">IIITM</span><span className="driver-car"><CarFront size={22} /></span><span className="track-destination"><MapPin size={27} fill="#D99B26" /></span><div className="eta-card"><small>ARRIVING IN</small><strong>03 <em>min</em></strong><span>1.8 km away</span></div></div><section className="driver-card"><span className="driver-avatar">RS</span><div className="driver-info"><strong>Ramesh Sharma</strong><span><Star size={14} fill="#D99B26" /> 4.8 · White Swift Dzire</span><small>MP-07-AB-1234</small></div><button className="call-button"><Phone size={18} /></button></section><div className="trip-progress"><div className="progress-label"><span>Campus</span><span>Destination</span></div><div className="progress-track"><span /></div><div className="progress-stops"><span>On the way</span><span>12 min left</span></div></div><div className="tracking-actions"><button className="share-button"><Compass size={18} /> Share trip status</button><button className={sosSent ? 'sos-button sent' : 'sos-button'} onClick={onSos}>{sosSent ? <><Check size={18} /> Alert sent</> : <><ShieldCheck size={18} /> SOS</>}</button></div>{sosSent && <div className="sos-confirm"><Check size={17} /><span>Emergency contacts notified with your live location.</span></div>}</div> }

function SupportView() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [submitted, setSubmitted] = useState(false)
  const faqs = [{ question: 'Why do I need an @iiitm.ac.in email?', answer: 'CampusPool uses your institute email to keep rides inside the verified IIITM student network.' }, { question: 'How do mock payment refunds work?', answer: 'The demo payment flow never charges a real account. In production, refunds would be issued from the payment provider after a server-side review.' }, { question: 'How many seats can I book?', answer: 'Autos support up to 3 riders and cabs support up to 4 riders, including you.' }]
  return <div className="support-view"><div className="support-heading"><div><p className="eyebrow">CAMPUSPOOL SUPPORT</p><h2>We’re here to help.</h2><p>Quick answers and direct campus contacts for every ride.</p></div><div className="support-mark"><HelpCircle size={25} /></div></div><section className="support-card sos-guide"><div className="support-card-title"><span className="support-icon red"><AlertTriangle size={18} /></span><div><h3>Emergency SOS guide</h3><p>What happens when you need help on a ride.</p></div></div><div className="sos-steps"><div><b>1</b><span>Tap SOS from your live ride screen.</span></div><div><b>2</b><span>Your location and pool details are shared.</span></div><div><b>3</b><span>Emergency contacts receive an SMS and call alert.</span></div></div></section><section className="support-card contact-card"><div className="support-card-title"><span className="support-icon blue"><PhoneCall size={18} /></span><div><h3>Campus contacts</h3><p>Available when the app cannot wait.</p></div></div><div className="contact-grid"><a href="tel:+917512440100"><span>Campus security</span><strong>+91 751 244 0100</strong><small>24 × 7 hotline</small></a><a href="tel:+917512440120"><span>Proctor office</span><strong>+91 751 244 0120</strong><small>Student support desk</small></a></div></section><section className="support-card ticket-card"><div className="support-card-title"><span className="support-icon gold"><Send size={18} /></span><div><h3>Submit a ride ticket</h3><p>Report a dispute, fare issue, or lost item.</p></div></div>{submitted ? <div className="ticket-success"><Check size={18} /><span>Your ticket is in. We’ll follow up through your IIITM email.</span></div> : <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true) }}><select defaultValue=""><option value="" disabled>Choose an issue</option><option>Ride dispute</option><option>Fare calculation</option><option>Lost item</option></select><textarea required placeholder="Tell us what happened" rows={3} /><button className="primary-button" type="submit"><Send size={16} /> Submit ticket</button></form>}</section><section className="faq-section"><div className="section-heading"><h3>Frequently asked</h3><span>{faqs.length} answers</span></div>{faqs.map((faq, index) => <div className={`faq-item ${openFaq === index ? 'open' : ''}`} key={faq.question}><button onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{faq.question}</span><ChevronDown size={17} /></button>{openFaq === index && <p>{faq.answer}</p>}</div>)}</section></div>
}

function BottomNav({ stage, onHome, onRides, onSafety, onSupport }: { stage: Stage; onHome: () => void; onRides: () => void; onSafety: () => void; onSupport: () => void }) { return <nav className="bottom-nav"><button className={stage === 'home' || stage === 'request' ? 'active' : ''} onClick={onHome}><Compass size={20} /><span>Explore</span></button><button className={stage === 'pool' || stage === 'matching' ? 'active' : ''} onClick={onRides}><CarFront size={20} /><span>My rides</span></button><button className={stage === 'tracking' ? 'active' : ''} onClick={onSafety}><ShieldCheck size={20} /><span>Safety</span></button><button className={stage === 'support' ? 'active' : ''} onClick={onSupport}><Headphones size={20} /><span>Support</span></button></nav> }

export default App
