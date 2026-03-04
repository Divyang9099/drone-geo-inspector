import React from 'react'
import { useStore } from '../store/useStore'
import { formatCoords } from '../utils/geoUtils'

const HoverCard: React.FC = () => {
    const {
        hoveredImage,
        hoverPosition,
        openLightbox,
        setSelectedImage,
        setHoveredImage,
    } = useStore()

    if (!hoveredImage || !hoverPosition) return null

    // Smart position: flip left if near right edge, flip up if near bottom
    const CARD_W = 248
    const CARD_H = 220
    const MARGIN = 18

    let left = hoverPosition.x + MARGIN
    let top = hoverPosition.y - 10

    // Keep card inside the map viewport (approx 800px wide, 600px tall)
    if (hoverPosition.x > 550) left = hoverPosition.x - CARD_W - MARGIN
    if (hoverPosition.y > 320) top = hoverPosition.y - CARD_H - MARGIN
    // Never go off-screen left/top
    if (left < 4) left = 4
    if (top < 4) top = 4

    const typeLabel =
        hoveredImage.type === 'thermal' ? '🌡 Thermal'
            : hoveredImage.type === 'visual' ? '📷 Visual'
                : '❓ Unknown'

    const closeCard = () => setHoveredImage(null, null)

    return (
        /*
         * IMPORTANT: pointer-events: none on the wrapper so this floating card
         * NEVER blocks Leaflet mouseover/mouseout events on the markers below.
         * Only the interactive children (close btn, full-view btn) re-enable
         * pointer-events so they remain clickable.
         */
        <div
            className="hover-card"
            style={{ left, top, pointerEvents: 'none' }}
        >
            {/* Folder color stripe */}
            <div className="hover-card-stripe" style={{ background: hoveredImage.folderColor }} />

            {/* Close button — re-enables pointer-events just for itself */}
            <button
                className="hover-card-close"
                style={{ pointerEvents: 'auto' }}
                onClick={closeCard}
                title="Close"
            >✕</button>

            {/* Thumbnail */}
            {hoveredImage.objectUrl && (
                <img
                    src={hoveredImage.objectUrl}
                    alt={hoveredImage.name}
                    className="hover-card-thumb"
                />
            )}

            <div className="hover-card-body">
                <div className="hover-card-header">
                    <span className="hover-card-type">{typeLabel}</span>
                    <span
                        className="hover-card-folder-dot"
                        style={{ background: hoveredImage.folderColor }}
                        title={hoveredImage.folderName}
                    />
                </div>

                <p className="hover-card-name">{hoveredImage.name}</p>
                <p className="hover-card-folder">📁 {hoveredImage.folderName}</p>

                <div className="hover-card-meta">
                    <span>📍 {formatCoords(hoveredImage.latitude, hoveredImage.longitude)}</span>
                    <span>⬆ {hoveredImage.altitude.toFixed(1)} m</span>
                </div>

                <button
                    className="hover-card-btn"
                    style={{ pointerEvents: 'auto' }}
                    onClick={() => {
                        setSelectedImage(hoveredImage)
                        openLightbox(hoveredImage)
                        closeCard()
                    }}
                >
                    🖼 Full View
                </button>
            </div>
        </div>
    )
}

export default HoverCard
