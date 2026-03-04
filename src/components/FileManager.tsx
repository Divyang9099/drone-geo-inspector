import React, { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import type { ImageData } from '../types/ImageData'
import type { FolderData } from '../types/FolderData'

// Card is opened by PendingCardHandler inside MapView after flyTo ends

// ── Single image row ───────────────────────────────────────────
interface ImageRowProps {
    image: ImageData
    isSelected: boolean
    isHovered: boolean
    onClick: () => void
}

const ImageRow: React.FC<ImageRowProps> = ({ image, isSelected, isHovered, onClick }) => {
    const ref = useRef<HTMLDivElement>(null)

    // When highlighted from map hover, scroll into view without jumping folders
    useEffect(() => {
        if (isHovered && ref.current) {
            ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
    }, [isHovered])

    return (
        <div
            ref={ref}
            className={`fmi-row${isSelected ? ' fmi-selected' : ''}${isHovered ? ' fmi-hovered' : ''}`}
            onClick={onClick}
            title={image.name}
        >
            <span className="fmi-accent" style={{ background: image.folderColor }} />
            <span className="fmi-name">{image.name}</span>
        </div>
    )
}

// ── Folder block with sticky header + toggleable image list ────
interface FolderBlockProps {
    folder: FolderData
    isExpanded: boolean
    onToggle: () => void
    selectedImageId: string | null
    hoveredImageId: string | null
    onImageClick: (img: ImageData) => void
}

const FolderBlock: React.FC<FolderBlockProps> = ({
    folder, isExpanded, onToggle,
    selectedImageId, hoveredImageId, onImageClick,
}) => {
    const hasActive = folder.images.some(
        i => i.id === selectedImageId || i.id === hoveredImageId
    )

    return (
        <div className="fmf-block">
            {/* STICKY folder header — pinned, never scrolls away */}
            <div
                className={`fmf-header${hasActive ? ' fmf-header-active' : ''}`}
                onClick={onToggle}
                title={`${folder.name} — ${folder.images.length} images`}
            >
                <span className="fmf-dot" style={{ background: folder.color, boxShadow: `0 0 5px ${folder.color}99` }} />
                <span className="fmf-name">{folder.name}</span>
                <span className="fmf-count">{folder.images.length}</span>
                <span className={`fmf-chevron${isExpanded ? ' open' : ''}`}>›</span>
            </div>

            {/* Collapsible image list — only this part expand/collapses */}
            {isExpanded && (
                <div className="fmf-list">
                    {folder.images.length === 0 ? (
                        <div className="fmf-empty">No geotagged images</div>
                    ) : (
                        folder.images.map(img => (
                            <ImageRow
                                key={img.id}
                                image={img}
                                isSelected={img.id === selectedImageId}
                                isHovered={img.id === hoveredImageId}
                                onClick={() => onImageClick(img)}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

// ── FileManager ────────────────────────────────────────────────
const FileManager: React.FC = () => {
    const {
        folders,
        hoveredImage,
        selectedImage,
        setSelectedImage,
        setPendingCard,
        expandedFolders,
        toggleFolderExpanded,
        totalDistance,
        showPath,
    } = useStore()

    // When map selects/hovers an image, auto-expand that folder
    useEffect(() => {
        if (selectedImage && !expandedFolders.has(selectedImage.folderId)) {
            toggleFolderExpanded(selectedImage.folderId)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedImage?.folderId])

    useEffect(() => {
        if (hoveredImage && !expandedFolders.has(hoveredImage.folderId)) {
            toggleFolderExpanded(hoveredImage.folderId)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hoveredImage?.folderId])

    const totalImages = folders.reduce((s, f) => s + f.images.length, 0)

    // Sidebar click: fly to marker, then show card exactly beside pin after animation
    const handleImageClick = (img: ImageData) => {
        setSelectedImage(img)   // → triggers map.flyTo() via FocusSelected
        setPendingCard(img)     // → MapView fires setHoveredImage after moveend
    }

    if (folders.length === 0) {
        return (
            <aside className="file-manager">
                <div className="fm-header">
                    <div className="fm-header-title">
                        <span className="fm-header-icon">🗂</span>
                        <span>File Manager</span>
                    </div>
                </div>
                <div className="fm-empty-state">
                    <div className="fm-empty-icon">📂</div>
                    <p className="fm-empty-title">No folders loaded</p>
                    <p className="fm-empty-sub">
                        Click <strong>+ Add Folder</strong> in the top bar to upload drone JPG folders.
                        Each folder gets its own color on the map.
                    </p>
                </div>
            </aside>
        )
    }

    return (
        <aside className="file-manager">
            {/* Fixed panel header */}
            <div className="fm-header">
                <div className="fm-header-title">
                    <span className="fm-header-icon">🗂</span>
                    <span>File Manager</span>
                </div>
                <div className="fm-header-meta">
                    <span>{folders.length} folder{folders.length > 1 ? 's' : ''}</span>
                    <span className="fm-dot">·</span>
                    <span>{totalImages} images</span>
                </div>
            </div>

            {/* Scrollable area — all folders + their images */}
            <div className="fm-scroll-body">
                {folders.map(folder => (
                    <FolderBlock
                        key={folder.id}
                        folder={folder}
                        isExpanded={expandedFolders.has(folder.id)}
                        onToggle={() => toggleFolderExpanded(folder.id)}
                        selectedImageId={selectedImage?.id ?? null}
                        hoveredImageId={hoveredImage?.id ?? null}
                        onImageClick={handleImageClick}
                    />
                ))}
            </div>

            {/* Fixed bottom stats */}
            <div className="fm-stats-bar">
                <div className="fm-stat">
                    <span className="fm-stat-label">Images</span>
                    <span className="fm-stat-val">{totalImages}</span>
                </div>
                <div className="fm-stat">
                    <span className="fm-stat-label">Folders</span>
                    <span className="fm-stat-val">{folders.length}</span>
                </div>
                <div className="fm-stat">
                    <span className="fm-stat-label">Path</span>
                    <span className="fm-stat-val">{showPath ? `${totalDistance.toFixed(1)} km` : '—'}</span>
                </div>
            </div>
        </aside>
    )
}

export default FileManager
