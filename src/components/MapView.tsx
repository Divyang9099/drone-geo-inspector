import React, { useEffect, useCallback, useMemo } from 'react'
import {
    MapContainer,
    TileLayer,
    Polyline,
    useMap,
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

// ── Marker icon factory ───────────────────────────────────────
function createMarkerIcon(color: string, isSelected: boolean): L.DivIcon {
    const size = isSelected ? 18 : 11
    const ring = isSelected
        ? `box-shadow:0 0 0 3px ${color}55, 0 0 14px ${color}99;`
        : `box-shadow:0 2px 6px rgba(0,0,0,0.5);`
    return L.divIcon({
        className: '',
        html: `<div style="
      width:${size}px;
      height:${size}px;
      background:${color};
      border-radius:50%;
      border:2px solid rgba(255,255,255,0.95);
      ${ring}
      transition:all 0.15s ease;
    "></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    })
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
        map.flyTo([selected.latitude, selected.longitude], 21, { duration: 1.8, easeLinearity: 0.2 })
    }, [selected, map])
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

// ── Professional Jitter: Golden-angle spiral ──────────────────
// Groups points by a ~2m grid cell and fans duplicates out in a
// proper spiral so they never stack, even at max zoom.
function buildJitteredPositions(images: ImageData[]): Map<string, [number, number]> {
    const positions = new Map<string, [number, number]>()

    // Grid key at ~1m precision (5 decimal places ≈ 1.1m cell)
    const grid = new Map<string, ImageData[]>()
    for (const img of images) {
        const key = `${img.latitude.toFixed(5)},${img.longitude.toFixed(5)}`
        if (!grid.has(key)) grid.set(key, [])
        grid.get(key)!.push(img)
    }

    for (const group of grid.values()) {
        if (group.length === 1) {
            // No duplicate — exact GPS position
            positions.set(group[0].id, [group[0].latitude, group[0].longitude])
        } else {
            // Spiral fan: center stays exact, others spread out
            // Each ring adds ~2m of offset (0.000018° lat ≈ 2m)
            group.forEach((img, i) => {
                if (i === 0) {
                    positions.set(img.id, [img.latitude, img.longitude])
                } else {
                    const angle = i * 2.399963            // golden angle ≈ 137.5°
                    const ring = Math.ceil(i / 8)         // 8 points per ring
                    const radius = 0.000018 * ring         // ~2m per ring
                    positions.set(img.id, [
                        img.latitude + radius * Math.sin(angle),
                        img.longitude + radius * Math.cos(angle),
                    ])
                }
            })
        }
    }

    return positions
}

// ── Main MapView ──────────────────────────────────────────────
const MapView: React.FC = () => {
    const {
        filteredImages,
        selectedImage,
        setSelectedImage,
        setHoveredImage,
        scheduleHoverClear,
        openLightbox,
        showPath,
        mapLayer,
    } = useStore()

    const tile = TILES[mapLayer]

    // Compute jitter positions only when images change
    const jitteredPositions = useMemo(
        () => buildJitteredPositions(filteredImages),
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
            setHoveredImage(image, { x: cp.x, y: cp.y })
        },
        [setHoveredImage]
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

                {showPath && polylinePoints.length > 1 && (
                    <Polyline positions={polylinePoints}
                        pathOptions={{ color: '#ef4444', weight: 2, opacity: 0.85, dashArray: '8 5' }} />
                )}

                {/* ── Cluster group ── */}
                <MarkerClusterGroup
                    chunkedLoading
                    maxClusterRadius={40}
                    showCoverageOnHover={false}
                    spiderfyOnMaxZoom={true}
                    spiderfyDistanceMultiplier={3.5}
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
                            // Fly with animation — pad slightly so pins aren't at edges
                            const map: L.Map = e.sourceTarget._map ?? cluster._map
                            map.flyToBounds(bounds.pad(0.25), {
                                maxZoom: 19,
                                // @ts-ignore: duration is a valid flyTo option passed through
                                duration: 1.2,
                            })
                        },
                    }}
                >
                    {filteredImages.map((image) => {
                        const isSelected = selectedImage?.id === image.id
                        const icon = createMarkerIcon(image.folderColor, isSelected)
                        const pos = jitteredPositions.get(image.id) ?? [image.latitude, image.longitude]

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
