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
        keepHoverAlive,
        scheduleHoverClear,
    } = useStore()

    if (!hoveredImage || !hoverPosition) return null

    // Smart position: flip left if near right edge, flip up if near bottom
    const CARD_W = 248
    const CARD_H = 225
    const MARGIN = 16

    let left = hoverPosition.x + MARGIN
    let top = hoverPosition.y - 10

    if (hoverPosition.x > 550) left = hoverPosition.x - CARD_W - MARGIN
    if (hoverPosition.y > 300) top = hoverPosition.y - CARD_H - MARGIN
    if (left < 4) left = 4
    if (top < 4) top = 4

    const typeLabel =
        hoveredImage.type === 'thermal' ? '🌡 Thermal'
            : hoveredImage.type === 'visual' ? '📷 Visual'
                : '❓ Unknown'

    const closeCard = () => setHoveredImage(null, null)

    return (
        /*
         * NO backdrop — the backdrop was blocking all marker mouse events.
         * The card uses pointer-events:auto so keepHoverAlive works,
         * letting users move to the card and click buttons without it disappearing.
         * When the user hovers a different marker, setHoveredImage updates instantly.
         */
        <div
            className="hover-card"
            style={{ left, top }}
            onMouseEnter={keepHoverAlive}
            onMouseLeave={scheduleHoverClear}
        >
            {/* Folder color stripe */}
            <div className="hover-card-stripe" style={{ background: hoveredImage.folderColor }} />

            {/* Close ✕ button */}
            <button className="hover-card-close" onClick={closeCard} title="Close">✕</button>

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
