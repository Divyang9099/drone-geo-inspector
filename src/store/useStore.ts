import { create } from 'zustand'
import type { ImageData } from '../types/ImageData'
import type { FolderData } from '../types/FolderData'
import { calculateTotalDistance } from '../utils/distance'
import { sortByTimestamp } from '../utils/geoUtils'

export type MapLayer = 'google-satellite' | 'google-hybrid' | 'esri' | 'street'
export type FilterType = 'all' | 'thermal' | 'visual'

export const FOLDER_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#f97316', '#a855f7',
    '#ec4899', '#eab308', '#14b8a6', '#6366f1', '#f43f5e',
]

export interface HoverPosition { x: number; y: number }

// Module-level timer — not reactive, just a side-effect handle
let hoverTimer: ReturnType<typeof setTimeout> | null = null

function applyFilter(images: ImageData[], type: FilterType): ImageData[] {
    if (type === 'all') return images
    return images.filter((img) => img.type === type)
}

function computeAll(folders: FolderData[], filter: FilterType) {
    const allImages = folders.flatMap((f) => f.images)
    const sorted = sortByTimestamp(allImages)
    const filtered = applyFilter(sorted, filter)
    const distance = calculateTotalDistance(sorted)
    return { allImages: sorted, filteredImages: filtered, totalDistance: distance }
}

interface AppState {
    folders: FolderData[]
    allImages: ImageData[]           // sorted union of all folders
    filteredImages: ImageData[]      // filtered subset
    selectedImage: ImageData | null
    hoveredImage: ImageData | null
    hoverPosition: HoverPosition | null
    lightboxImage: ImageData | null
    filterType: FilterType
    mapLayer: MapLayer
    loading: boolean
    loadingFolderName: string
    progress: { current: number; total: number }
    totalDistance: number
    showPath: boolean
    expandedFolders: Set<string>
    pendingCard: ImageData | null     // image whose card should open after flyTo

    // Actions
    addFolder: (folder: FolderData) => void
    removeFolder: (folderId: string) => void
    setSelectedImage: (image: ImageData | null) => void
    setHoveredImage: (image: ImageData | null, pos: HoverPosition | null) => void
    scheduleHoverClear: () => void      // start 250ms delayed hide
    keepHoverAlive: () => void          // cancel the pending hide (card mouseenter)
    openLightbox: (image: ImageData) => void
    closeLightbox: () => void
    setFilterType: (type: FilterType) => void
    setMapLayer: (layer: MapLayer) => void
    setLoading: (loading: boolean, folderName?: string) => void
    setProgress: (current: number, total: number) => void
    toggleFolderExpanded: (folderId: string) => void
    togglePath: () => void
    setPendingCard: (img: ImageData | null) => void
    clearAll: () => void
}

export const useStore = create<AppState>((set, get) => ({
    folders: [],
    allImages: [],
    filteredImages: [],
    selectedImage: null,
    hoveredImage: null,
    hoverPosition: null,
    lightboxImage: null,
    filterType: 'all',
    mapLayer: 'google-satellite',
    loading: false,
    loadingFolderName: '',
    progress: { current: 0, total: 0 },
    totalDistance: 0,
    showPath: false,
    expandedFolders: new Set(),
    pendingCard: null,

    addFolder: (folder) => {
        const newFolders = [...get().folders, folder]
        const computed = computeAll(newFolders, get().filterType)
        const expanded = new Set(get().expandedFolders)
        expanded.add(folder.id)
        set({ folders: newFolders, ...computed, expandedFolders: expanded })
    },

    removeFolder: (folderId) => {
        // Revoke object URLs for this folder
        const folder = get().folders.find((f) => f.id === folderId)
        folder?.images.forEach((img) => {
            if (img.objectUrl) URL.revokeObjectURL(img.objectUrl)
        })
        const newFolders = get().folders.filter((f) => f.id !== folderId)
        const computed = computeAll(newFolders, get().filterType)
        set({ folders: newFolders, ...computed, selectedImage: null, hoveredImage: null })
    },

    setSelectedImage: (image) => set({ selectedImage: image }),

    setHoveredImage: (image, pos) => {
        if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
        set({ hoveredImage: image, hoverPosition: pos })
    },

    scheduleHoverClear: () => {
        if (hoverTimer) clearTimeout(hoverTimer)
        hoverTimer = setTimeout(() => {
            hoverTimer = null
            set({ hoveredImage: null, hoverPosition: null })
        }, 80)   // 80ms — fast enough to move between markers without flicker
    },

    keepHoverAlive: () => {
        if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
    },

    openLightbox: (image) => set({ lightboxImage: image }),
    closeLightbox: () => set({ lightboxImage: null }),

    setFilterType: (type) => {
        const computed = computeAll(get().folders, type)
        set({ filterType: type, ...computed, selectedImage: null })
    },

    setMapLayer: (layer) => set({ mapLayer: layer }),

    setLoading: (loading, folderName = '') =>
        set({ loading, loadingFolderName: folderName }),

    setProgress: (current, total) => set({ progress: { current, total } }),

    toggleFolderExpanded: (folderId) => {
        const next = new Set(get().expandedFolders)
        if (next.has(folderId)) next.delete(folderId)
        else next.add(folderId)
        set({ expandedFolders: next })
    },

    togglePath: () => set((s) => ({ showPath: !s.showPath })),

    setPendingCard: (img) => set({ pendingCard: img }),

    clearAll: () => {
        get().allImages.forEach((img) => {
            if (img.objectUrl) URL.revokeObjectURL(img.objectUrl)
        })
        set({
            folders: [],
            allImages: [],
            filteredImages: [],
            selectedImage: null,
            hoveredImage: null,
            hoverPosition: null,
            lightboxImage: null,
            filterType: 'all',
            loading: false,
            loadingFolderName: '',
            progress: { current: 0, total: 0 },
            totalDistance: 0,
            showPath: false,
            expandedFolders: new Set(),
            pendingCard: null,
        })
    },
}))
