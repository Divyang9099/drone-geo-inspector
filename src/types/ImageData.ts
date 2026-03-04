export interface ImageData {
    id: string
    file: File
    name: string
    folderId: string
    folderName: string
    folderColor: string
    latitude: number
    longitude: number
    altitude: number
    timestamp?: string
    type: 'thermal' | 'visual' | 'unknown'
    objectUrl?: string
}
