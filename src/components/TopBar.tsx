import React, { useRef, useCallback } from 'react'
import { useStore, FOLDER_COLORS } from '../store/useStore'
import { processFolder } from '../utils/exifExtractor'

const TopBar: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const {
        folders,
        filteredImages,
        filterType,
        setFilterType,
        addFolder,
        setLoading,
        setProgress,
        loading,
        showPath,
        togglePath,
        totalDistance,
        clearAll,
        progress,
        loadingFolderName,
    } = useStore()

    const getNextColor = useCallback(() => {
        return FOLDER_COLORS[folders.length % FOLDER_COLORS.length]
    }, [folders.length])

    const handleFolderSelect = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(e.target.files || [])
            if (files.length === 0) return

            // Derive folder name from the webkitRelativePath of first file
            const firstPath = files[0].webkitRelativePath || files[0].name
            const folderName = firstPath.split('/')[0] || `Folder ${folders.length + 1}`
            const folderId = `folder-${Date.now()}`
            const color = getNextColor()

            setLoading(true, folderName)
            setProgress(0, files.length)

            const result = await processFolder(files, folderId, folderName, color, (cur, tot) =>
                setProgress(cur, tot)
            )

            addFolder({ ...result, uploadedAt: new Date().toISOString() })
            setLoading(false)

            if (fileInputRef.current) fileInputRef.current.value = ''
        },
        [folders.length, getNextColor, addFolder, setLoading, setProgress]
    )

    const totalImages = folders.reduce((s, f) => s + f.images.length, 0)
    const totalSkipped = folders.reduce((s, f) => s + f.skipped, 0)

    const filters: Array<{ label: string; value: typeof filterType }> = [
        { label: 'All', value: 'all' },
        { label: '🌡 Thermal', value: 'thermal' },
        { label: '📷 Visual', value: 'visual' },
    ]

    return (
        <header className="topbar">
            {/* ── Brand ── */}
            <div className="topbar-left">
                <div className="brand">
                    <span className="brand-icon">🛸</span>
                    <span className="brand-name">Drone Geo Inspector</span>
                </div>

                <label className="btn-upload" htmlFor="folder-input" title="Add folder to session">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add Folder
                </label>
                <input
                    ref={fileInputRef}
                    id="folder-input"
                    type="file"
                    // @ts-expect-error: webkitdirectory not in standard typings
                    webkitdirectory=""
                    multiple
                    accept=".jpg,.jpeg"
                    onChange={handleFolderSelect}
                    className="hidden"
                    disabled={loading}
                />
            </div>

            {/* ── Center: progress or filters ── */}
            <div className="topbar-center">
                {loading ? (
                    <div className="progress-info">
                        <div className="spinner" />
                        <span>
                            Loading <strong>{loadingFolderName}</strong>&nbsp;
                            {progress.current} / {progress.total}
                        </span>
                    </div>
                ) : (
                    <div className="filter-group">
                        {filters.map((f) => (
                            <button
                                key={f.value}
                                className={`filter-btn ${filterType === f.value ? 'active' : ''}`}
                                onClick={() => setFilterType(f.value)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Right: stats + actions ── */}
            <div className="topbar-right">
                <div className="stats-row">
                    <div className="stat-chip">
                        <span className="stat-label">Folders</span>
                        <span className="stat-value">{folders.length}</span>
                    </div>
                    <div className="stat-chip">
                        <span className="stat-label">Points</span>
                        <span className="stat-value">{filteredImages.length}</span>
                    </div>
                    <div className="stat-chip">
                        <span className="stat-label">Total</span>
                        <span className="stat-value">{totalImages}</span>
                    </div>
                    <div className="stat-chip">
                        <span className="stat-label">Distance</span>
                        <span className="stat-value">{totalDistance.toFixed(2)} km</span>
                    </div>
                    {totalSkipped > 0 && (
                        <div className="stat-chip warn">
                            <span className="stat-label">Skipped</span>
                            <span className="stat-value">{totalSkipped}</span>
                        </div>
                    )}
                </div>

                {folders.length > 0 && (
                    <div className="action-row">
                        <button className={`btn-ghost ${showPath ? 'active' : ''}`} onClick={togglePath}>
                            {showPath ? '🛑 Hide Path' : '🗺 Path'}
                        </button>
                        <button className="btn-danger" onClick={clearAll}>🗑 Clear All</button>
                    </div>
                )}
            </div>
        </header>
    )
}

export default TopBar
