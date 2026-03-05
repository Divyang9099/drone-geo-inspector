import React, { useEffect, useCallback, useMemo } from 'react'
import {
    MapContainer,
    TileLayer,
    Polyline,
    useMap,
    useMapEvents,
    ScaleControl,
    ZoomControl,
    Popup,
    Marker,
} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import { LatLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css'
import { useStore } from '../store/useStore'
import type { MapLayer } from '../store/useStore'
import type { ImageData } from '../types/ImageData'
import { getImageBounds, formatCoords, formatTimestamp } from '../utils/geoUtils'

// ── Tile providers ────────────────────────────────────────────
interface TileConfig { url: string; attribution: string; maxZoom: number; subdomains?: string | string[] }

const TILES: Record<MapLayer, TileConfig> = {
    'google-satellite': {
        url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        attribution: 'Map data &copy; <a href="https://maps.google.com">Google</a>',
        maxZoom: 21, subdomains: ['0', '1', '2', '3'],
    },
    'google-hybrid': {
        url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        attribution: 'Map data &copy; <a href="https://maps.google.com">Google</a>',
        maxZoom: 21, subdomains: ['0', '1', '2', '3'],
    },
    esri: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>',
        maxZoom: 19,
    },
    street: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    },
}

const LAYER_OPTIONS: Array<{ key: MapLayer; label: string }> = [
    { key: 'google-satellite', label: '🛰 Satellite' },
    { key: 'google-hybrid', label: '🌐 Hybrid' },
    { key: 'esri', label: '🗺 Esri' },
    { key: 'street', label: '🏙 Street' },
]

// ── Marker icon factory ─────────────────────────────────────────
// Outer wrapper adds invisible padding so hover fires in a wider area.
// The visible dot is centered inside.
function createMarkerIcon(color: string, isSelected: boolean): L.DivIcon {
    const dot = isSelected ? 26 : 16      // visible dot size (px)
    const pad = isSelected ? 8 : 6        // invisible padding around dot (px)
    const total = dot + pad * 2           // total icon size including padding
    const ring = isSelected
        ? `box-shadow:0 0 0 4px #ffffff, 0 0 20px ${color}ff;`
        : `box-shadow:0 2px 6px rgba(0,0,0,0.55);`

    // Add pulsing class name if selected
    const extraClass = isSelected ? 'marker-selected-pulse' : ''

    return L.divIcon({
        className: '',
        // Outer transparent wrapper extends hit area; inner div is the visible dot
        html: `<div style="
      width:${total}px;
      height:${total}px;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
    "><div class="${extraClass}" style="
      width:${dot}px;
      height:${dot}px;
      background:${color};
      border-radius:50%;
      border:3px solid rgba(255,255,255,0.95);
      ${ring}
      transition:all 0.15s ease;
    "></div></div>`,
        iconSize: [total, total],
        iconAnchor: [total / 2, total / 2],
    })
}

// ── Type-based marker color ───────────────────────────────────────────
// Thermal always orange so pairs (thermal+visual at same GPS) are
// visually distinct even after jitter offset separates them.
function getMarkerColor(image: ImageData): string {
    if (image.type === 'thermal') return '#f97316'  // 🌡 orange
    return image.folderColor                         // 📷 folder color
}

// ── Cluster icon factory ───────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any): L.DivIcon {
    const markers = cluster.getAllChildMarkers() as Array<{ options: { folderColor?: string } }>
    const colors = markers.map((m) => m.options.folderColor).filter(Boolean) as string[]
    const uniqueColors = [...new Set(colors)]
    const bg = uniqueColors.length === 1 ? uniqueColors[0] : '#475569'
    const count: number = cluster.getChildCount()

    const ringCss =
        uniqueColors.length > 1
            ? `background: conic-gradient(${uniqueColors.map((c, i) => `${c} ${(i * 100) / uniqueColors.length}% ${((i + 1) * 100) / uniqueColors.length}%`).join(', ')});`
            : `background:${bg};`

    return L.divIcon({
        className: '',
        html: `<div style="
      ${ringCss}
      width:36px;
      height:36px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:700;
      font-size:12px;
      font-family:Inter,sans-serif;
      color:white;
      border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 3px 10px rgba(0,0,0,0.55);
      text-shadow:0 1px 2px rgba(0,0,0,0.7);
    ">${count}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
    })
}

// ── Sub components ────────────────────────────────────────────
const FitBounds: React.FC<{ images: ImageData[] }> = ({ images }) => {
    const map = useMap()
    useEffect(() => {
        if (images.length === 0) return
        const bounds = getImageBounds(images)
        if (bounds) map.fitBounds(new LatLngBounds(bounds[0], bounds[1]), { padding: [60, 60], maxZoom: 18 })
    }, [images, map])
    return null
}

const FocusSelected: React.FC<{ selected: ImageData | null }> = ({ selected }) => {
    const map = useMap()
    useEffect(() => {
        if (!selected) return
        map.flyTo([selected.latitude, selected.longitude], 21, { duration: 1.0, easeLinearity: 0.2 })
    }, [selected, map])
    return null
}

// ── Instant close hover card when clicking empty map space ────────
const CloseCardOnMapClick: React.FC = () => {
    const { setHoveredImage } = useStore()
    useMapEvents({ click: () => setHoveredImage(null, null) })
    return null
}

// ── Pending card: shows hover card at exact marker pixel position after flyTo ──
// Triggered by sidebar click: setSelectedImage (→ flyTo) + setPendingCard.
// Listens for 'moveend' so we measure coordinates AFTER animation finishes.
const PendingCardHandler: React.FC = () => {
    const map = useMap()
    const { pendingCard, setPendingCard, setHoveredImage } = useStore()

    useEffect(() => {
        if (!pendingCard) return

        const onMoveEnd = () => {
            // Convert lat/lng to pixel coordinates inside the map container
            const pt = map.latLngToContainerPoint([
                pendingCard.latitude,
                pendingCard.longitude,
            ])
            setHoveredImage(pendingCard, { x: pt.x, y: pt.y })
            setPendingCard(null)
        }

        map.once('moveend', onMoveEnd)
        return () => { map.off('moveend', onMoveEnd) }
    }, [pendingCard, map, setHoveredImage, setPendingCard])

    return null
}

// ── Layer toggle ──────────────────────────────────────────────
const LayerToggle: React.FC = () => {
    const { mapLayer, setMapLayer } = useStore()
    return (
        <div className="map-layer-toggle">
            {LAYER_OPTIONS.map(({ key, label }) => (
                <button key={key} className={`layer-btn ${mapLayer === key ? 'active' : ''}`}
                    onClick={() => setMapLayer(key)}>{label}</button>
            ))}
        </div>
    )
}

// ── Group images at the exact same GPS coordinate ─────────────────────────
// Returns a map from image.id -> all images that share its lat/lng.
// Two images are "same location" if they are within ~1 meter (0.000009 deg).
const SAME_LOC_THRESHOLD = 0.000009 // ~1 meter

function buildLocationGroups(images: ImageData[]): Map<string, ImageData[]> {
    const groupMap = new Map<string, ImageData[]>()
    const processed = new Set<string>()

    for (const img of images) {
        if (processed.has(img.id)) continue
        // Collect all images within threshold of this image's coords
        const group = images.filter(other =>
            Math.abs(other.latitude - img.latitude) < SAME_LOC_THRESHOLD &&
            Math.abs(other.longitude - img.longitude) < SAME_LOC_THRESHOLD
        )
        group.forEach(g => {
            processed.add(g.id)
            groupMap.set(g.id, group)
        })
    }
    return groupMap
}


// ── Main MapView ──────────────────────────────────────────────
const MapView: React.FC = () => {
    const {
        filteredImages,
        selectedImage,
        setSelectedImage,
        setHoveredImages,
        scheduleHoverClear,
        openLightbox,
        showPath,
        mapLayer,
    } = useStore()

    const tile = TILES[mapLayer]

    // Compute location groups — which images share the same GPS point
    const locationGroups = useMemo(
        () => buildLocationGroups(filteredImages),
        [filteredImages]
    )

    const polylinePoints: [number, number][] = filteredImages.map((img) => [img.latitude, img.longitude])

    const handleMarkerClick = useCallback(
        (image: ImageData) => { setSelectedImage(image) },
        [setSelectedImage]
    )

    const handleMarkerHover = useCallback(
        (image: ImageData, e: L.LeafletMouseEvent) => {
            const cp = e.containerPoint
            // Get all images at this location and show them grouped
            const group = locationGroups.get(image.id) ?? [image]
            setHoveredImages(group, { x: cp.x, y: cp.y })
        },
        [setHoveredImages, locationGroups]
    )

    return (
        <div className="map-wrapper">
            <LayerToggle />

            <MapContainer center={[20, 78]} zoom={5} className="map-container"
                preferCanvas={false} zoomControl={false}>
                <TileLayer
                    key={mapLayer}
                    url={tile.url}
                    attribution={tile.attribution}
                    maxZoom={tile.maxZoom}
                    subdomains={tile.subdomains ?? 'abc'}
                />

                <ZoomControl position="bottomright" />
                <ScaleControl position="bottomleft" imperial={false} />
                <FitBounds images={filteredImages} />
                <FocusSelected selected={selectedImage} />
                <PendingCardHandler />
                <CloseCardOnMapClick />

                {showPath && polylinePoints.length > 1 && (
                    <Polyline positions={polylinePoints}
                        pathOptions={{ color: '#ef4444', weight: 2, opacity: 0.85, dashArray: '8 5' }} />
                )}

                {/* ── Cluster group ── */}
                <MarkerClusterGroup
                    chunkedLoading
                    maxClusterRadius={40}
                    showCoverageOnHover={false}
                    spiderfyOnMaxZoom={false}
                    zoomToBoundsOnClick={false}
                    disableClusteringAtZoom={18}
                    // @ts-ignore
                    iconCreateFunction={createClusterIcon}
                    eventHandlers={{
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        clusterclick: (e: any) => {
                            const cluster = e.layer
                            const childMarkers: L.Marker[] = cluster.getAllChildMarkers()
                            if (!childMarkers.length) return
                            // Build tight bounds from exactly the markers in THIS cluster
                            const bounds = L.latLngBounds(
                                childMarkers.map((m) => m.getLatLng())
                            )
                            // Calculate the required zoom to fit these bounds
                            const map: L.Map = e.sourceTarget._map ?? cluster._map
                            const currentZoom = map.getZoom()
                            const targetZoom = map.getBoundsZoom(bounds, false, L.point(50, 50))

                            // GUARANTEE NO ZOOMING OUT: 
                            // If Leaflet thinks we should zoom out, NO. Force at least a +2 zoom in.
                            // If Leaflet wants to zoom in a lot, let it. Max cap at 20.
                            const finalZoom = Math.min(Math.max(currentZoom + 2, targetZoom), 20)

                            // Zoom directly to the exact cluster point instead of full bounds to prevent weird panning
                            map.setView(cluster.getLatLng(), finalZoom, {
                                animate: true,
                                duration: 0.5,
                            })
                        },
                    }}
                >
                    {filteredImages.map((image) => {
                        const isSelected = selectedImage?.id === image.id
                        // Color: thermal always orange, visual gets folder color
                        const markerColor = getMarkerColor(image)
                        const icon = createMarkerIcon(markerColor, isSelected)
                        // EXACT GPS — no jitter offset
                        const pos: [number, number] = [image.latitude, image.longitude]

                        return (
                            <Marker
                                key={`${image.id}-${isSelected}`}
                                position={pos as [number, number]}
                                icon={icon}
                                eventHandlers={{
                                    // Attach folderColor so cluster icon can read it
                                    add: (e: L.LeafletEvent) => {
                                        (e.target as L.Marker & { options: { folderColor: string } }).options.folderColor = image.folderColor
                                    },
                                    click: () => handleMarkerClick(image),
                                    mouseover: (e) => handleMarkerHover(image, e as unknown as L.LeafletMouseEvent),
                                    mouseout: () => scheduleHoverClear(),
                                }}
                            >
                                <Popup className="custom-popup" maxWidth={260}>
                                    <div className="popup-inner">
                                        {image.objectUrl ? (
                                            <div className="popup-thumb-wrap"
                                                onClick={() => openLightbox(image)} title="Open full photo">
                                                <img src={image.objectUrl} alt={image.name} className="popup-img" />
                                                <div className="popup-thumb-overlay">
                                                    <span className="popup-thumb-icon">🔍 Open Photo</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="popup-no-thumb">📷 No preview</div>
                                        )}
                                        <div className="popup-body">
                                            <div className="popup-folder-tag" style={{ borderColor: image.folderColor }}>
                                                <span className="popup-folder-dot" style={{ background: image.folderColor }} />
                                                {image.folderName}
                                            </div>
                                            <p className="popup-name">{image.name}</p>
                                            <div className="popup-grid">
                                                <div className="popup-row">
                                                    <span className="popup-label">📍</span>
                                                    <span className="popup-val">{formatCoords(image.latitude, image.longitude)}</span>
                                                </div>
                                                <div className="popup-row">
                                                    <span className="popup-label">⬆ Alt</span>
                                                    <span className="popup-val">{image.altitude.toFixed(1)} m</span>
                                                </div>
                                                <div className="popup-row">
                                                    <span className="popup-label">🕐</span>
                                                    <span className="popup-val">{formatTimestamp(image.timestamp)}</span>
                                                </div>
                                            </div>
                                            <button className="popup-open-btn" onClick={() => openLightbox(image)}>
                                                🖼 Full View
                                            </button>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        )
                    })}
                </MarkerClusterGroup>
            </MapContainer>

            {filteredImages.length === 0 && (
                <div className="map-overlay">
                    <div className="map-overlay-content">
                        <div className="map-overlay-icon">🛸</div>
                        <h3>No images loaded</h3>
                        <p>Use <strong>+ Add Folder</strong> to upload drone JPG folders with GPS metadata</p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default MapView
