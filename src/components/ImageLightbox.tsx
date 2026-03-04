import React, { useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { formatCoords, formatTimestamp } from '../utils/geoUtils'

const ImageLightbox: React.FC = () => {
    const { lightboxImage, closeLightbox, filteredImages, openLightbox, setSelectedImage } = useStore()

    const currentIndex = lightboxImage
        ? filteredImages.findIndex((img) => img.id === lightboxImage.id)
        : -1

    const goPrev = useCallback(() => {
        if (currentIndex <= 0) return
        const prev = filteredImages[currentIndex - 1]
        openLightbox(prev)
        setSelectedImage(prev)
    }, [currentIndex, filteredImages, openLightbox, setSelectedImage])

    const goNext = useCallback(() => {
        if (currentIndex === -1 || currentIndex >= filteredImages.length - 1) return
        const next = filteredImages[currentIndex + 1]
        openLightbox(next)
        setSelectedImage(next)
    }, [currentIndex, filteredImages, openLightbox, setSelectedImage])

    useEffect(() => {
        if (!lightboxImage) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeLightbox()
            if (e.key === 'ArrowLeft') goPrev()
            if (e.key === 'ArrowRight') goNext()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [lightboxImage, closeLightbox, goPrev, goNext])

    useEffect(() => {
        document.body.style.overflow = lightboxImage ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [lightboxImage])

    if (!lightboxImage) return null

    const hasPrev = currentIndex > 0
    const hasNext = currentIndex < filteredImages.length - 1

    const typeLabel =
        lightboxImage.type === 'thermal' ? '🌡 Thermal'
            : lightboxImage.type === 'visual' ? '📷 Visual'
                : '❓ Unknown'

    return (
        <div className="lightbox-overlay" onClick={closeLightbox} role="dialog" aria-modal="true">
            <div className="lightbox-panel" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="lightbox-header">
                    <div className="lightbox-title-row">
                        {/* Folder color pill */}
                        <span
                            className="lightbox-folder-pill"
                            style={{ background: lightboxImage.folderColor + '22', borderColor: lightboxImage.folderColor }}
                        >
                            <span
                                className="lightbox-folder-dot"
                                style={{ background: lightboxImage.folderColor }}
                            />
                            {lightboxImage.folderName}
                        </span>
                        <span className="lightbox-filename">{lightboxImage.name}</span>
                        <span className={`lightbox-type-badge type-${lightboxImage.type}`}>{typeLabel}</span>
                    </div>
                    <div className="lightbox-header-right">
                        <span className="lightbox-counter">{currentIndex + 1} / {filteredImages.length}</span>
                        <button className="lightbox-close" onClick={closeLightbox} aria-label="Close">✕</button>
                    </div>
                </div>

                {/* Image */}
                <div className="lightbox-image-area">
                    <button className={`lightbox-nav prev ${!hasPrev ? 'disabled' : ''}`}
                        onClick={goPrev} disabled={!hasPrev}>‹</button>

                    {lightboxImage.objectUrl
                        ? <img key={lightboxImage.id} src={lightboxImage.objectUrl} alt={lightboxImage.name} className="lightbox-img" />
                        : <div className="lightbox-no-img">📷 No preview available</div>
                    }

                    <button className={`lightbox-nav next ${!hasNext ? 'disabled' : ''}`}
                        onClick={goNext} disabled={!hasNext}>›</button>
                </div>

                {/* Meta strip */}
                <div className="lightbox-meta">
                    <div className="lightbox-meta-item">
                        <span className="lm-label">📍 Coordinates</span>
                        <span className="lm-val">{formatCoords(lightboxImage.latitude, lightboxImage.longitude)}</span>
                    </div>
                    <div className="lightbox-meta-item">
                        <span className="lm-label">⬆ Altitude</span>
                        <span className="lm-val">{lightboxImage.altitude.toFixed(1)} m</span>
                    </div>
                    <div className="lightbox-meta-item">
                        <span className="lm-label">🕐 Captured</span>
                        <span className="lm-val">{formatTimestamp(lightboxImage.timestamp)}</span>
                    </div>
                    <div className="lightbox-meta-item keyboard-hint">
                        <span className="lm-label">⌨ Keys</span>
                        <span className="lm-val">← → navigate &nbsp;|&nbsp; Esc close</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ImageLightbox
