import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

const maptilerKey = import.meta.env.VITE_MAPTILER_API_KEY || ''

// Fix default leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom pins matching the brand colors
const pickupIcon = L.divIcon({
  className: 'custom-pin pickup-pin',
  html: `<div style="background-color: #1E4E8C; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const dropoffIcon = L.divIcon({
  className: 'custom-pin dropoff-pin',
  html: `<div style="background-color: #D99B26; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})


function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function MapUpdater({ pickup, dropoff }: { pickup: { lat: number, lng: number }, dropoff?: { lat: number, lng: number } }) {
  const map = useMap()
  
  useEffect(() => {
    if (pickup && dropoff && dropoff.lat !== 0) {
      const bounds = L.latLngBounds([pickup, dropoff])
      map.fitBounds(bounds, { padding: [50, 50], animate: true })
    } else if (pickup) {
      map.setView(pickup, 15, { animate: true })
    }
  }, [pickup, dropoff, map])

  return null
}

export function InteractiveMap({
  pickup,
  dropoff,
  onMapClick,
}: {
  pickup: { lat: number; lng: number }
  dropoff: { lat: number; lng: number }
  onMapClick: (lat: number, lng: number) => void
}) {
  return (
    <div className="w-full relative z-0 rounded-xl overflow-hidden shadow-inner border border-gray-100" style={{ height: '220px' }}>
      <MapContainer
        center={[pickup.lat, pickup.lng]}
        zoom={14}
        style={{ height: '220px', width: '100%', zIndex: 0 }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url={`https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${maptilerKey}`}
        />
        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />
        {dropoff.lat !== 0 && (
          <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />
        )}
        <MapEvents onMapClick={onMapClick} />
        <MapUpdater pickup={pickup} dropoff={dropoff.lat !== 0 ? dropoff : undefined} />
      </MapContainer>
    </div>
  )
}
